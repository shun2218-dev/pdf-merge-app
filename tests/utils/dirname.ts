import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// リポジトリのルート。テストの設定（Vitest・Playwright）と E2E で、ルートからのパスを作るのに使う（ADR 0004 決定 8）
const here = typeof __dirname !== "undefined" ? __dirname : dirname(fileURLToPath(import.meta.url));

export const rootDir = resolve(here, "../..");
