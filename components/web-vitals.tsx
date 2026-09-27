"use client";

import { useEffect } from "react";
import { onCLS, onINP, onLCP } from "web-vitals";
import { reportWebVital } from "@/lib/analytics/web-vitals";

// 実利用者の Web Vitals を測る（ADR 0021 決定 1）。ルートの layout に置き、ページを開いた時点から測る。
// Next.js の useReportWebVitals は使わない指標（FCP / TTFB / FID）まで読み込むので、web-vitals から 3 つだけを読み込む
let registered = false;

export function WebVitals() {
	useEffect(() => {
		// 開発中の Strict Mode では effect が 2 回走るので、測るのは 1 回だけにする
		if (registered) return;
		registered = true;
		onLCP(reportWebVital);
		onINP(reportWebVital);
		onCLS(reportWebVital);
	}, []);
	return null;
}
