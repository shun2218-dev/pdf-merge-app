// アナリティクスのイベントの定義（ADR 0011 決定 1・4）。正本の表は docs/analytics.md。
// イベントを足すときは、この型と表を同じ PR で更新する。
//
// ファイル名・ファイルの中身は送らない。数や大きさは区間（バケット）に丸めて送る（決定 3）。

export type CountBucket = "0" | "1" | "2" | "3-5" | "6-10" | "11-30" | "31+";
export type SizeBucket = "<1MB" | "1-5MB" | "5-20MB" | "20-100MB" | "100MB+";
export type DurationBucket = "<1s" | "1-3s" | "3-10s" | "10-30s" | "30s+";

export type AnalyticsEvent =
	| {
			name: "files_added";
			properties: { source: "picker" | "drop"; count_bucket: CountBucket; size_bucket: SizeBucket };
	  }
	| {
			// not_pdf は追加のとき、encrypted / corrupt は結合のときに飛ばしたファイル（ADR 0030 決定 3）
			name: "files_rejected";
			properties: { reason: "not_pdf" | "encrypted" | "corrupt"; count_bucket: CountBucket };
	  }
	| { name: "file_removed"; properties: { remaining_bucket: CountBucket } }
	| {
			// touch / keyboard / menu / sort_by_name は、並び替えの UI ができてから足す（ADR 0010）
			name: "files_reordered";
			properties: { method: "pointer" };
	  }
	| { name: "merge_started"; properties: { count_bucket: CountBucket; size_bucket: SizeBucket } }
	| {
			name: "merge_succeeded";
			properties: { duration_bucket: DurationBucket; count_bucket: CountBucket; size_bucket: SizeBucket };
	  }
	| {
			// ブラウザ内で結合する（ADR 0002）ので、失敗の理由は端末の中のもの（ADR 0030 決定 3）。
			// no_valid_files は、読めるファイルが 1 つもなかったとき
			name: "merge_failed";
			properties: { reason: "worker_error" | "out_of_memory" | "no_valid_files" | "unknown" };
	  }
	// 足したことで、合計 300MB または 100 ファイルを超えたとき（ADR 0002 決定 5）。超えたままなら送り直さない
	| { name: "size_warning_shown"; properties: { size_bucket: SizeBucket } }
	| { name: "preview_opened"; properties: Record<string, never> }
	| { name: "download_clicked"; properties: { renamed: boolean; previewed: boolean } };

export type EventName = AnalyticsEvent["name"];
export type EventProperties<N extends EventName> = Extract<AnalyticsEvent, { name: N }>["properties"];
