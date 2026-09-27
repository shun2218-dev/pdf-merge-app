// ページの読み込みごとの ID（ADR 0021 決定 6）。
// Web Vitals のイベントと PostHog の SDK の distinct_id に同じ値を使い、同じページの読み込みのイベントを結びつける。
// Cookie も localStorage も使わないので、ページを読み込み直すと別の ID になる（ADR 0011）

let pageViewId: string | null = null;

export function getPageViewId(): string {
	pageViewId ??= crypto.randomUUID();
	return pageViewId;
}
