import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PdfMergerPage from "@/app/page";

vi.mock("@/components/header", () => ({ Header: () => <div data-testid="header" /> }));
vi.mock("@/components/web-vitals", () => ({ WebVitals: () => null }));
vi.mock("@/components/merge/merge-workspace", () => ({ MergeWorkspace: () => <div data-testid="merge-workspace" /> }));

describe("PdfMergerPage", () => {
	it("ヘッダーと結合の画面を並べる", () => {
		render(<PdfMergerPage />);
		expect(screen.getByTestId("header")).toBeInTheDocument();
		expect(screen.getByTestId("merge-workspace")).toBeInTheDocument();
	});

	it('サーバーコンポーネントのまま（"use client" を書かない。ADR 0005 決定 5）', () => {
		const source = readFileSync(resolve(__dirname, "../../app/page.tsx"), "utf8");
		expect(source).not.toMatch(/^\s*["']use client["']/m);
	});
});
