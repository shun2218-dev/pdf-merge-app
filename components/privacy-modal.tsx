"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "./ui/checkbox";
import { Label } from "./ui/label";

export const STORAGE_KEY = "disclaimerAgreed";

export function PrivacyModal() {
	const [isChecked, setIsChecked] = useState(false);

	useEffect(() => {
		const hasAgreed = sessionStorage.getItem(STORAGE_KEY) === "true";
		if (hasAgreed) {
			setIsChecked(true);
		}
	}, []);
	return (
		<DialogContent
			className="sm:max-w-md"
			data-testid="header-dialog"
			onInteractOutside={(e) => {
				e.preventDefault();
			}}
			onEscapeKeyDown={(e) => {
				e.preventDefault();
			}}
		>
			<DialogHeader>
				<DialogTitle>ご利用上の注意</DialogTitle>
				<DialogDescription>PDFファイルの取り扱いについて</DialogDescription>
			</DialogHeader>
			<div className="space-y-4 py-4 text-sm text-foreground">
				<p>本サービスは、アップロードされたPDFファイルを結合処理のためにサーバーに送信します。</p>
				<p>ファイルはサーバーのディスクには保存されず、処理完了後にメモリから破棄されます。</p>
				<p className="font-semibold text-destructive">
					社外秘の文書、個人情報、その他機密性の高い情報を含むファイルのアップロードはご遠慮ください。
				</p>
				<p>本サービスの利用によって生じたいかなる損害についても、開発者は一切の責任を負いません。</p>
			</div>
			<DialogFooter className="sm:justify-end flex-col sm:flex-row">
				<div className="flex justify-center items-center gap-2 flex-1">
					<Label htmlFor="privacy-checkbox">上記の内容を理解しました</Label>
					<Checkbox
						id="privacy-checkbox"
						className="ml-2"
						checked={isChecked}
						onCheckedChange={(checked) => setIsChecked(!!checked)}
					/>
				</div>
				<DialogClose asChild>
					<Button className="mt-2" type="button" variant="default" disabled={!isChecked}>
						理解して閉じる
					</Button>
				</DialogClose>
			</DialogFooter>
		</DialogContent>
	);
}
