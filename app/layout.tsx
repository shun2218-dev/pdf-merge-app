import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "@/styles/globals.css"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "PDF Merge App - 複数のPDFファイルを簡単に結合",
  description:
    "ブラウザ上で複数のPDFファイルを簡単に結合できる無料ツール。ドラッグ&ドロップで順序を変更し、プレビューを確認しながら1つのPDFにまとめられます。",
  generator: "v0.app",
  keywords: ["PDF結合", "PDF merge", "PDFツール", "オンラインPDF", "無料PDFツール"],
  openGraph: {
    title: "PDF Merge App - 複数のPDFファイルを簡単に結合",
    description:
      "ブラウザ上で複数のPDFファイルを簡単に結合できる無料ツール。ドラッグ&ドロップで順序を変更し、プレビューを確認しながら1つのPDFにまとめられます。",
    type: "website",
    locale: "ja_JP",
  },
  twitter: {
    card: "summary_large_image",
    title: "PDF Merge App - 複数のPDFファイルを簡単に結合",
    description: "ブラウザ上で複数のPDFファイルを簡単に結合できる無料ツール",
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" className="dark">
      <body className={`font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
