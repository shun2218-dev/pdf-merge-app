import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMergeWorkflow } from "@/hooks/use-merge-workflow";
import { track } from "@/lib/analytics";
import { sentry } from "@/lib/sentry/browser";

vi.mock("@/lib/sentry/browser", () => ({ sentry: { captureException: vi.fn(), addBreadcrumb: vi.fn() } }));
vi.mock("@/lib/analytics", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/analytics")>()),
	track: vi.fn(),
}));

const pdf = (name: string) => new File(["%PDF"], name, { type: "application/pdf" });
const txt = (name: string) => new File(["text"], name, { type: "text/plain" });

function mergeSucceeds() {
	vi.mocked(fetch).mockResolvedValueOnce({
		ok: true,
		blob: async () => new Blob(["merged"], { type: "application/pdf" }),
	} as Response);
}

function trackedNames() {
	return vi.mocked(track).mock.calls.map(([name]) => name);
}

let urlCount = 0;

beforeEach(() => {
	vi.clearAllMocks();
	global.fetch = vi.fn();
	urlCount = 0;
	global.URL.createObjectURL = vi.fn(() => `blob:merged-${++urlCount}`);
	global.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
	vi.restoreAllMocks();
});

async function setupWithFiles(...files: File[]) {
	const hook = renderHook(() => useMergeWorkflow());
	act(() => hook.result.current.addFiles(files, "picker"));
	return hook;
}

describe("useMergeWorkflow", () => {
	describe("ファイルの追加", () => {
		it("PDF を足し、files_added を送る", async () => {
			const { result } = await setupWithFiles(pdf("a.pdf"), pdf("b.pdf"));

			expect(result.current.items.map((i) => i.file.name)).toEqual(["a.pdf", "b.pdf"]);
			expect(track).toHaveBeenCalledWith("files_added", { source: "picker", count_bucket: "2", size_bucket: "<1MB" });
		});

		it("同じ名前のファイルにも別の id を振る（ADR 0005 決定 2）", async () => {
			const { result } = await setupWithFiles(pdf("same.pdf"), pdf("same.pdf"));

			const [first, second] = result.current.items;
			expect(first.id).not.toBe(second.id);
		});

		it("PDF 以外が混ざったら全部を受け付けず、not_pdf のエラーにして files_rejected を送る", async () => {
			const { result } = renderHook(() => useMergeWorkflow());
			act(() => result.current.addFiles([pdf("a.pdf"), txt("b.txt")], "drop"));

			expect(result.current.items).toEqual([]);
			expect(result.current.error).toBe("not_pdf");
			expect(track).toHaveBeenCalledWith("files_rejected", { reason: "not_pdf", count_bucket: "1" });
			expect(trackedNames()).not.toContain("files_added");
		});

		it("アナリティクスにファイル名を送らない（ADR 0011）", async () => {
			const SECRET = "2026_源泉徴収票_山田.pdf";
			const { result } = await setupWithFiles(pdf(SECRET));
			mergeSucceeds();
			await act(() => result.current.openPreview());
			act(() => result.current.addFiles([txt(`${SECRET}.txt`)], "drop"));
			act(() => result.current.removeFile(result.current.items[0].id));

			expect(JSON.stringify(vi.mocked(track).mock.calls)).not.toContain("源泉徴収票");
			expect(JSON.stringify(vi.mocked(sentry.addBreadcrumb).mock.calls)).not.toContain("源泉徴収票");
		});

		it("空の選択は何もしない", async () => {
			const { result } = renderHook(() => useMergeWorkflow());
			act(() => result.current.addFiles([], "picker"));

			expect(result.current.items).toEqual([]);
			expect(track).not.toHaveBeenCalled();
		});
	});

	describe("削除と並び替え", () => {
		it("削除すると file_removed を残りの数とともに送る", async () => {
			const { result } = await setupWithFiles(pdf("a.pdf"), pdf("b.pdf"));
			act(() => result.current.removeFile(result.current.items[0].id));

			expect(result.current.items.map((i) => i.file.name)).toEqual(["b.pdf"]);
			expect(track).toHaveBeenCalledWith("file_removed", { remaining_bucket: "1" });
		});

		it("並び替えを終えたら files_reordered を送る", async () => {
			const { result } = await setupWithFiles(pdf("a.pdf"), pdf("b.pdf"));
			act(() => result.current.moveFile(0, 1));
			act(() => result.current.reorderEnded());

			expect(result.current.items.map((i) => i.file.name)).toEqual(["b.pdf", "a.pdf"]);
			expect(track).toHaveBeenCalledWith("files_reordered", { method: "pointer" });
		});
	});

	describe("プレビュー", () => {
		it("並び順どおりにサーバーへ送って結合し、結果を持つ", async () => {
			const { result } = await setupWithFiles(pdf("a.pdf"), pdf("b.pdf"));
			act(() => result.current.moveFile(0, 1));
			mergeSucceeds();
			const append = vi.spyOn(FormData.prototype, "append");

			await act(() => result.current.openPreview());

			expect(fetch).toHaveBeenCalledWith("/api/merge-pdf", expect.objectContaining({ method: "POST" }));
			expect(append.mock.calls.map(([key, file]) => [key, (file as File).name])).toEqual([
				["files", "b.pdf"],
				["files", "a.pdf"],
			]);
			expect(result.current.phase).toBe("done");
			expect(result.current.result).toEqual({ url: "blob:merged-1" });
		});

		it("merge_started → merge_succeeded → preview_opened の順に送る", async () => {
			const { result } = await setupWithFiles(pdf("a.pdf"));
			mergeSucceeds();

			await act(() => result.current.openPreview());

			expect(trackedNames()).toEqual(["files_added", "merge_started", "merge_succeeded", "preview_opened"]);
		});

		it("結合の結果があれば、プレビューを押し直しても結合し直さない", async () => {
			const { result } = await setupWithFiles(pdf("a.pdf"));
			mergeSucceeds();

			await act(() => result.current.openPreview());
			await act(() => result.current.openPreview());

			expect(fetch).toHaveBeenCalledTimes(1);
		});

		it("結合している間は phase が merging", async () => {
			const { result } = await setupWithFiles(pdf("a.pdf"));
			let resolveFetch: (response: Response) => void = () => {};
			vi.mocked(fetch).mockReturnValueOnce(
				new Promise((resolve) => {
					resolveFetch = resolve;
				}),
			);

			let pending: Promise<void> = Promise.resolve();
			act(() => {
				pending = result.current.openPreview();
			});
			expect(result.current.phase).toBe("merging");

			await act(async () => {
				resolveFetch({ ok: true, blob: async () => new Blob(["merged"]) } as Response);
				await pending;
			});
			expect(result.current.phase).toBe("done");
		});
	});

	describe("結合の失敗", () => {
		it.each([
			[500, "server_error"],
			[413, "payload_too_large"],
		])("サーバーが %d を返したら merge_failed（%s）にし、Sentry には送らない", async (status, reason) => {
			const { result } = await setupWithFiles(pdf("a.pdf"));
			vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status } as Response);

			await act(() => result.current.openPreview());

			expect(result.current.phase).toBe("error");
			expect(result.current.error).toBe("merge_failed");
			expect(track).toHaveBeenCalledWith("merge_failed", { reason });
			expect(trackedNames()).not.toContain("preview_opened");
			expect(sentry.captureException).not.toHaveBeenCalled();
		});

		it("通信に失敗したら、想定外のエラーとして Sentry に送る（ADR 0007 決定 4）", async () => {
			const { result } = await setupWithFiles(pdf("a.pdf"));
			const error = new TypeError("Failed to fetch");
			vi.mocked(fetch).mockRejectedValueOnce(error);

			await act(() => result.current.openPreview());

			expect(result.current.error).toBe("merge_failed");
			expect(track).toHaveBeenCalledWith("merge_failed", { reason: "network_error" });
			expect(sentry.captureException).toHaveBeenCalledWith(error);
		});

		it("もう一度結合すると、前のエラーを消す", async () => {
			const { result } = await setupWithFiles(pdf("a.pdf"));
			vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500 } as Response);
			await act(() => result.current.openPreview());
			mergeSucceeds();

			await act(() => result.current.openPreview());

			expect(result.current.error).toBeNull();
			expect(result.current.phase).toBe("done");
		});
	});

	describe("ダウンロード", () => {
		function spyOnLinkClick() {
			const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
			return click;
		}

		it("プレビューせずに押すと、結合してから merged.pdf をダウンロードする（B-1）", async () => {
			const click = spyOnLinkClick();
			const { result } = await setupWithFiles(pdf("a.pdf"));
			mergeSucceeds();

			await act(() => result.current.download());

			expect(fetch).toHaveBeenCalledTimes(1);
			expect(click).toHaveBeenCalledTimes(1);
			const link = click.mock.contexts[0] as HTMLAnchorElement;
			expect(link.download).toBe("merged.pdf");
			expect(link.href).toBe("blob:merged-1");
			expect(track).toHaveBeenCalledWith("download_clicked", { renamed: false, previewed: false });
			expect(trackedNames()).not.toContain("preview_opened");
		});

		it("プレビューしてから押すと、結合し直さず previewed: true を送る", async () => {
			const click = spyOnLinkClick();
			const { result } = await setupWithFiles(pdf("a.pdf"));
			mergeSucceeds();
			await act(() => result.current.openPreview());

			await act(() => result.current.download());

			expect(fetch).toHaveBeenCalledTimes(1);
			expect(click).toHaveBeenCalledTimes(1);
			expect(track).toHaveBeenCalledWith("download_clicked", { renamed: false, previewed: true });
		});

		it("結合に失敗したらダウンロードしない", async () => {
			const click = spyOnLinkClick();
			const { result } = await setupWithFiles(pdf("a.pdf"));
			vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500 } as Response);

			await act(() => result.current.download());

			expect(click).not.toHaveBeenCalled();
			expect(trackedNames()).not.toContain("download_clicked");
		});
	});

	describe("URL の解放（ADR 0005 決定 3・B-5）", () => {
		async function setupMerged() {
			const hook = await setupWithFiles(pdf("a.pdf"), pdf("b.pdf"));
			mergeSucceeds();
			await act(() => hook.result.current.openPreview());
			expect(URL.revokeObjectURL).not.toHaveBeenCalled();
			return hook;
		}

		it("ファイルを足すと、前の結果の URL を解放する", async () => {
			const { result } = await setupMerged();
			act(() => result.current.addFiles([pdf("c.pdf")], "picker"));
			await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:merged-1"));
			expect(result.current.result).toBeNull();
		});

		it("ファイルを消すと、前の結果の URL を解放する", async () => {
			const { result } = await setupMerged();
			act(() => result.current.removeFile(result.current.items[0].id));
			await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:merged-1"));
		});

		it("並び替えると、前の結果の URL を解放する", async () => {
			const { result } = await setupMerged();
			act(() => result.current.moveFile(0, 1));
			await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:merged-1"));
		});

		it("アンマウントすると、結果の URL を解放する", async () => {
			const { unmount } = await setupMerged();
			unmount();
			expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:merged-1");
		});
	});
});

describe("Sentry のパンくず（ADR 0024 決定 2）", () => {
	it("アナリティクスと同じ名前・同じ値で、操作をパンくずに残す", async () => {
		const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
		const { result } = await setupWithFiles(pdf("a.pdf"), pdf("b.pdf"));
		act(() => result.current.moveFile(0, 1));
		act(() => result.current.reorderEnded());
		act(() => result.current.removeFile(result.current.items[0].id));
		vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));
		await act(() => result.current.openPreview());
		mergeSucceeds();
		await act(() => result.current.download());
		click.mockRestore();

		const crumbs = vi.mocked(sentry.addBreadcrumb).mock.calls.map(([crumb]) => crumb);
		expect(crumbs.map((c) => c.message)).toEqual([
			"files_added",
			"files_reordered",
			"file_removed",
			"merge_started",
			"merge_failed",
			"merge_started",
			"merge_succeeded",
			"download_clicked",
		]);
		expect(crumbs.every((c) => c.category === "merge")).toBe(true);
		// 値もアナリティクスと同じ
		expect(crumbs.map((c) => [c.message, c.data])).toEqual(vi.mocked(track).mock.calls);
		// 失敗だけは目立つように warning にする
		expect(crumbs.find((c) => c.message === "merge_failed")?.level).toBe("warning");
	});

	it("PDF 以外を拒んだこともパンくずに残す", () => {
		const { result } = renderHook(() => useMergeWorkflow());
		act(() => result.current.addFiles([txt("a.txt")], "drop"));

		expect(sentry.addBreadcrumb).toHaveBeenCalledWith(
			expect.objectContaining({
				category: "merge",
				message: "files_rejected",
				data: { reason: "not_pdf", count_bucket: "1" },
			}),
		);
	});
});
