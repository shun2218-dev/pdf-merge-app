import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";

// `pnpm analyze` でチャンクの中身を見る（ADR 0012 決定 1）
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

/** @type {import('next').NextConfig} */
const nextConfig = {
	// PostHog の受け口（/ingest/i/v0/e/）は末尾が / なので、末尾の / を外すリダイレクトをしない（ADR 0021 決定 5）。
	// /ingest の転送そのものは vercel.json に書く（ここに rewrites を書くと、ブラウザ側に rewrites を解決するコードが入るため）
	skipTrailingSlashRedirect: true,
	images: {
		unoptimized: true,
	},
	webpack: (config, { isServer }) => {
		if (isServer) {
			// 'canvas' をサーバーサイドのバンドルから除外する
			// 'pdf-preview.tsx' は 'ssr: false' なので、
			// サーバー上で 'canvas' が require されることはない
			config.externals.push("canvas");
		}
		return config;
	},
};

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
	// For all available options, see:
	// https://www.npmjs.com/package/@sentry/webpack-plugin#options

	org: "vercel-development",

	project: "pdf-merge-app",

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

	// Automatically tree-shake Sentry logger statements to reduce bundle size
	disableLogger: true,

	// トレースのコードをブラウザ・サーバー・Edge のビルドから除く（ADR 0022）
	bundleSizeOptimizations: {
		excludeTracing: true,
	},

	// Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
	// See the following for more information:
	// https://docs.sentry.io/product/crons/
	// https://vercel.com/docs/cron-jobs
	automaticVercelMonitors: true,
});
