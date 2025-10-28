"use client"

import type React from "react"
import { useRef } from "react"
import { Button } from "@/components/ui/button"

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void
}

export function FileUploader({ onFilesSelected }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    const pdfFiles = selectedFiles.filter((file) => file.type === "application/pdf")

    if (pdfFiles.length !== selectedFiles.length) {
      alert("PDFファイルのみ選択してください")
    }

    if (pdfFiles.length > 0) {
      onFilesSelected(pdfFiles)
    }

    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files)
    const pdfFiles = droppedFiles.filter((file) => file.type === "application/pdf")

    if (pdfFiles.length !== droppedFiles.length) {
      alert("PDFファイルのみ選択してください")
    }

    if (pdfFiles.length > 0) {
      onFilesSelected(pdfFiles)
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-8 text-center transition-colors hover:border-primary/50 hover:bg-muted/50"
    >
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" x2="12" y1="3" y2="15" />
          </svg>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">ファイルをドラッグ&ドロップ</p>
          <p className="text-xs text-muted-foreground">または</p>
        </div>
        <Button onClick={() => inputRef.current?.click()} variant="default">
          ファイルを選択
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  )
}
