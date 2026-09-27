import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { onCLS, onINP, onLCP } from "web-vitals";
import { WebVitals } from "@/components/web-vitals";
import { reportWebVital } from "@/lib/analytics/web-vitals";

vi.mock("web-vitals", () => ({ onCLS: vi.fn(), onINP: vi.fn(), onLCP: vi.fn() }));

describe("WebVitals", () => {
	it("LCP / INP / CLS を 1 回だけ測り始め、何も描画しない", () => {
		const { container, rerender } = render(<WebVitals />);
		rerender(<WebVitals />);
		render(<WebVitals />);

		for (const on of [onLCP, onINP, onCLS]) {
			expect(on).toHaveBeenCalledTimes(1);
			expect(on).toHaveBeenCalledWith(reportWebVital);
		}
		expect(container).toBeEmptyDOMElement();
	});
});
