// ランダムな ID（UUID v4 の形）。crypto.randomUUID がない環境でも作れるようにする（B-12）。
// 本番で Windows の Chrome 138 から randomUUID がないエラーが届いた（2026-10-16）。getRandomValues はより広く使える

export function randomId(): string {
	if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	bytes[6] = (bytes[6] & 0x0f) | 0x40; // 版 4
	bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 の変種
	const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
