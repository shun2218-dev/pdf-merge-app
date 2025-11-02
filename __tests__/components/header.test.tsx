import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Header } from "@/components/header";

describe("Header", () => {
	it("ヘッダーが正しくレンダリングされる", () => {
		render(<Header />);

		const header = screen.getByRole("banner");
		expect(header).toBeInTheDocument();
	});

	it("タイトルが表示される", () => {
		render(<Header />);

		const title = screen.getByRole("heading", { name: "PDF Merger" });
		expect(title).toBeInTheDocument();
		expect(title).toHaveClass("text-2xl", "font-semibold", "text-foreground");
	});

	it("説明文が表示される", () => {
		render(<Header />);

		const description = screen.getByText("複数のPDFファイルを1つに結合");
		expect(description).toBeInTheDocument();
		expect(description).toHaveClass("text-sm", "text-muted-foreground");
	});

	it("アイコンが表示される", () => {
		const { container } = render(<Header />);

		const icon = container.querySelector("svg");
		expect(icon).toBeInTheDocument();
		expect(icon).toHaveClass("text-primary-foreground");
	});

	it("アイコンコンテナが正しいスタイルを持つ", () => {
		const { container } = render(<Header />);

		const iconContainer = container.querySelector(".bg-primary");
		expect(iconContainer).toBeInTheDocument();
		expect(iconContainer).toHaveClass("flex", "h-10", "w-10", "items-center", "justify-center", "rounded-lg");
	});

	it("ヘッダーが正しいレイアウトクラスを持つ", () => {
		const { container } = render(<Header />);

		const header = container.querySelector("header");
		expect(header).toHaveClass("border-b", "border-border", "bg-card");
	});

	it("コンテナが正しいスタイルを持つ", () => {
		const { container } = render(<Header />);

		const containerDiv = container.querySelector(".container");
		expect(containerDiv).toBeInTheDocument();
		expect(containerDiv).toHaveClass("mx-auto", "px-4", "py-6");
	});

	it("タイトルとアイコンが横並びで表示される", () => {
		const { container } = render(<Header />);

		const flexContainer = container.querySelector(".flex.items-center.gap-3");
		expect(flexContainer).toBeInTheDocument();
	});
});
