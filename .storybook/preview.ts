import type { Preview } from "@storybook/nextjs-vite";
import "@/app/globals.css";

const preview: Preview = {
	// 本番は常に暗いテーマ（app/layout.tsx の <html className="dark">）なので、ストーリーも同じ色で描き、
	// a11y の検査（コントラストなど。ADR 0014）を利用者が見る色で行う
	beforeEach: () => {
		document.documentElement.classList.add("dark");
	},
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i,
			},
		},

		a11y: {
			// 'todo' - show a11y violations in the test UI only
			// 'error' - fail CI on a11y violations
			// 'off' - skip a11y checks entirely
			test: "error",
		},
	},
};

export default preview;
