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
			// encrypted / corrupt は、ブラウザ内で PDF を読むようになってから足す（ADR 0002）
			name: "files_rejected";
			properties: { reason: "not_pdf"; count_bucket: CountBucket };
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
			// いまはサーバーで結合しているので、失敗の理由はサーバーとの通信の結果で分ける。
			// ブラウザ内の結合（ADR 0002）に移したら out_of_memory / worker_error / unknown に置き換える
			name: "merge_failed";
			properties: { reason: "payload_too_large" | "server_error" | "network_error" };
	  }
	| { name: "preview_opened"; properties: Record<string, never> }
	| { name: "download_clicked"; properties: { renamed: boolean; previewed: boolean } };

export type EventName = AnalyticsEvent["name"];
export type EventProperties<N extends EventName> = Extract<AnalyticsEvent, { name: N }>["properties"];
