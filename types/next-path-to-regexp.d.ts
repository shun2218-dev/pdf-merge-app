// Next.js が同梱する path-to-regexp（6 系）には型がない。vercel.json の rewrites のテストで使う分だけ宣言する
declare module "next/dist/compiled/path-to-regexp" {
	export function pathToRegexp(
		path: string,
		keys?: { name: string | number }[],
		options?: { strict?: boolean; sensitive?: boolean; delimiter?: string },
	): RegExp;
}
