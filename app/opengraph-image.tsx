import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "PDF Merge App - 複数のPDFファイルを簡単に結合";
export const size = {
	width: 1200,
	height: 630,
};
export const contentType = "image/png";

export default async function Image() {
	return new ImageResponse(
		<div
			style={{
				background: "#000",
				width: "100%",
				height: "100%",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				flexDirection: "column",
				gap: "24px",
			}}
		>
			<div
				style={{
					fontSize: 80,
					fontWeight: "bold",
					color: "#fff",
					letterSpacing: "-0.02em",
				}}
			>
				PDF Merge App
			</div>
		</div>,
		{
			...size,
		},
	);
}
