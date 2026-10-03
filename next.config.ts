import { type SentryBuildOptions, withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

// ビルドは Turbopack（Next.js 16 の既定。ADR 0015）。webpack の独自設定は持たない
export const nextConfig: NextConfig = {
	// PostHog の受け口（/ingest/i/v0/e/）は末尾が / なので、末尾の / を外すリダイレクトをしない（ADR 0021 決定 5）。
	// /ingest の転送そのものは vercel.json に書く（ここに rewrites を書くと、ブラウザ側に rewrites を解決するコードが入るため）
	skipTrailingSlashRedirect: true,
	images: {
		unoptimized: true,
	},
	compiler: {
		// Sentry のトレースのコード（ADR 0022）とデバッグ用のログのコードをビルドから除く。
		// Sentry の `bundleSizeOptimizations.excludeTracing` と `disableLogger` は webpack のビルドにしか効かないので、
		// 同じ定数をここで置き換える（ブラウザとサーバーの両方に効く）。値は文字列ではなく boolean にする
		// （文字列の "false" は真と見なされ、コードが残る）
		define: { __SENTRY_TRACING__: false, __SENTRY_DEBUG__: false },
	},
};

export const sentryBuildOptions: SentryBuildOptions = {
	// For all available options, see:
	// https://www.npmjs.com/package/@sentry/webpack-plugin#options

	// ソースマップの送り先。Vercel の Sentry の連携が入れる環境変数から読む。
	// 以前は実際と違う組織名とプロジェクト名を直接書いていて、ソースマップを送れていなかった（B-10）
	org: process.env.SENTRY_ORG,

	project: process.env.SENTRY_PROJECT,

	// Only print logs for uploading source maps in CI
	silent: !process.env.CI,

	// For all available options, see:
	// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

	// Upload a larger set of source maps for prettier stack traces (increases build time)
	widenClientFileUpload: true,

	// Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
	// This can increase your server load as well as your hosting bill.
	// Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
	// side errors will fail.
	// tunnelRoute: "/monitoring",

	// 画面遷移のトレースは使わないので、onRouterTransitionStart を export しない（ADR 0022）
	suppressOnRouterTransitionStartWarning: true,
};

export default withSentryConfig(nextConfig, sentryBuildOptions);
