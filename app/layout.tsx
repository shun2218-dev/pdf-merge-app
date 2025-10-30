import type React from "react"
import type { Metadata, Viewport } from "next"
import { Analytics } from "@vercel/analytics/next"
import "@/styles/globals.css"

const title = "PDF Merge App - 複数のPDFファイルを簡単に結合"
const description = "ブラウザ上で複数のPDFファイルを簡単に結合できる無料ツール。ドラッグ&ドロップで順序を変更し、プレビューを確認しながら1つのPDFにまとめられます。"


export const metadata: Metadata = {
  title,
  description,  
  openGraph: {
    title,
    description,
    type: "website",
    url: "https://vercel.com/shun2218devs-projects/pdf-merge-app"
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  keywords: "PDF結合, PDF merge, PDFツール, オンラインPDF, 無料PDFツール"
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
