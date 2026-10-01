export const SELECTORS = {
	// --- DropZone (from components/merge/drop-zone.tsx) ---
	/** FileUploader のドラッグ＆ドロップ領域 */
	FILE_UPLOADER_DROPZONE: '[data-testid="dropzone"]',
	/** FileUploader の <input type="file"> (hidden) */
	FILE_INPUT: '[data-testid="file-input"]',

	// --- FileList (from components/merge/file-list.tsx) ---
	/** FileList 全体のコンテナ */
	FILE_LIST_CONTAINER: '[data-testid="file-list"]',

	/**
	 * file-list.tsx 内の特定のファイル名を持つアイテムコンテナ <div>
	 * @param name ファイル名 (e.g., "dummy1.pdf")
	 */
	fileItemContainer: (name: string) => `[data-testid="file-item-container-${name}"]`,

	/**
	 * file-list.tsx 内の特定のファイル名を持つ <p> タグ
	 * @param name ファイル名 (e.g., "dummy1.pdf")
	 */
	fileName: (name: string) => `[data-testid="file-item-container-${name}"] >> [data-testid="file-name"]`,

	/**
	 * file-list.tsx 内の特定のファイルに対応する「削除する」ボタン
	 * @param name ファイル名 (e.g., "dummy1.pdf")
	 */
	removeButton: (name: string) => `[data-testid="file-item-container-${name}"] >> [aria-label="削除する"]`,

	/**
	 * file-list.tsx 内の特定のファイルに対応する「ドラッグハンドル」
	 * @param name ファイル名 (e.g., "dummy1.pdf")
	 */
	dragHandle: (name: string) => `[data-testid="file-item-container-${name}"] >> [data-testid="drag-handle"]`,

	// --- Buttons (from components/merge/merge-actions.tsx) ---
	PREVIEW_BUTTON: 'button:has-text("プレビュー")',
	DOWNLOAD_BUTTON: 'button:has-text("ダウンロード")',
	PROCESSING_BUTTON: 'button:has-text("処理中...")',

	// --- Preview (from pdf-preview.tsx) ---
	/** PdfPreview コンポーネントのルート <div> */
	PDF_PREVIEW: "div.h-\\[800px\\].w-full.rounded-lg.border",

	// --- Disclaimer Modal (disclaimer-modal.tsx) ---
	/** モーダル（DialogContent） */
	DISCLAIMER_MODAL: '[data-testid="header-dialog"]',
	/** モーダルのチェックボックス */
	DISCLAIMER_MODAL_CHECKBOX: "#disclaimer-checkbox",
	/** モーダルの閉じるボタン */
	DISCLAIMER_MODAL_CLOSE_BUTTON: 'button:has-text("理解して閉じる")',
};
