"use client"
import { Viewer, Worker } from "@react-pdf-viewer/core"
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout"
import "@react-pdf-viewer/core/lib/styles/index.css"
import "@react-pdf-viewer/default-layout/lib/styles/index.css"

interface PdfPreviewProps {
  pdfUrl: string
}

export function PdfPreview({ pdfUrl }: PdfPreviewProps) {
  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    sidebarTabs: () => [],
    toolbarPlugin: {
      fullScreenPlugin: {
        onEnterFullScreen: (zoom) => {
          zoom(1)
        },
      },
    },
  })

  return (
    <div className="h-[800px] w-full rounded-lg border border-border bg-background">
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
        <Viewer fileUrl={pdfUrl} plugins={[defaultLayoutPluginInstance]} defaultScale={1} theme="dark" />
      </Worker>
    </div>
  )
}
