import type { addBreadcrumb, captureException, init } from "./client";

// ブラウザの Sentry を、あとから読み込んで初期化する仕組み（ADR 0026）。
// SDK の読み込みと初期化は 1 回だけで、パンくずと captureException はそれを待ってから渡す
export type SentryFunctions = {
	init: typeof init;
	addBreadcrumb: typeof addBreadcrumb;
	captureException: typeof captureException;
};

type Breadcrumb = Parameters<typeof addBreadcrumb>[0];
type Options = NonNullable<Parameters<typeof init>[0]>;

type EventTargetLike = Pick<Window, "addEventListener" | "removeEventListener">;

// 初期化までにためておくエラーの上限（決定 2）
export const MAX_EARLY_ERRORS = 10;

// ページの load のあと（すでに済んでいればすぐ）に、次のタスクで run を呼ぶ（決定 1）。
// load のイベントの処理の中で重い処理を走らせないよう、setTimeout で 1 つ後ろに回す
export function runAfterLoad(run: () => void, win: Window = window) {
	const next = () => win.setTimeout(run, 0);
	if (win.document.readyState === "complete") next();
	else win.addEventListener("load", next, { once: true });
}

export function createLazySentry({ load, options }: { load: () => Promise<SentryFunctions>; options: () => Options }) {
	let ready: Promise<SentryFunctions | undefined> | undefined;
	const earlyErrors: unknown[] = [];
	let removeEarlyHandlers = () => {};

	// 読み込みと初期化を始める。2 回目からは同じ Promise を返す（決定 1）。
	// 読み込めなかったとき（チャンクの取得の失敗など）は、送る先がないので何もしない
	function start(): Promise<SentryFunctions | undefined> {
		ready ??= load().then(
			(sentry) => {
				// 初期化したあとは、Sentry の自動の受け口がエラーを拾うので、ここの受け口は外す（決定 2）
				removeEarlyHandlers();
				sentry.init(options());
				for (const error of earlyErrors.splice(0)) sentry.captureException(error);
				return sentry;
			},
			() => undefined,
		);
		return ready;
	}

	// load の前に起きたエラーを取りこぼさないよう、初期化までためておく（決定 2）
	function captureEarlyErrors(target: EventTargetLike) {
		const keep = (error: unknown) => {
			if (earlyErrors.length < MAX_EARLY_ERRORS) earlyErrors.push(error);
		};
		const onError = (event: ErrorEvent) => keep(event.error ?? event.message);
		const onRejection = (event: PromiseRejectionEvent) => keep(event.reason);
		target.addEventListener("error", onError);
		target.addEventListener("unhandledrejection", onRejection);
		removeEarlyHandlers = () => {
			target.removeEventListener("error", onError);
			target.removeEventListener("unhandledrejection", onRejection);
		};
	}

	return {
		start,
		captureEarlyErrors,
		// 初期化の前に呼ばれたら、そこで読み込みを始める。beforeBreadcrumb / beforeSend の消し込みが必ず通る（決定 3）
		addBreadcrumb(breadcrumb: Breadcrumb) {
			void start().then((sentry) => sentry?.addBreadcrumb(breadcrumb));
		},
		captureException(exception: unknown) {
			void start().then((sentry) => sentry?.captureException(exception));
		},
	};
}
