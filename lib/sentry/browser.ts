import { createLazySentry } from "./lazy";
import { sharedSentryOptions } from "./options";

// ブラウザの Sentry。SDK はページの load のあとに読み込む（ADR 0026）。
// ブラウザ側のコードは、@sentry/nextjs を直接 import せずにこれを使う（決定 4。Biome の noRestrictedImports で止めている）
export const sentry = createLazySentry({
	load: () => import("./client"),
	options: () => sharedSentryOptions(),
});
