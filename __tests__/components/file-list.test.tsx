import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { FileList } from "@/components/file-list"

describe("FileList", () => {
  const createMockFile = (name: string, size: number): File => {
    return new File(["content"], name, { type: "application/pdf" })
  }

  const mockFiles = [
    Object.assign(createMockFile("test1.pdf", 1024), { size: 1024 }),
    Object.assign(createMockFile("test2.pdf", 2048), { size: 2048 }),
    Object.assign(createMockFile("test3.pdf", 1048576), { size: 1048576 }),
  ]

  it("ファイルリストが正しくレンダリングされる", () => {
    const mockOnReorder = vi.fn()
    const mockOnRemove = vi.fn()

    render(<FileList files={mockFiles} onReorder={mockOnReorder} onRemove={mockOnRemove} />)

    expect(screen.getByText("test1.pdf")).toBeInTheDocument()
    expect(screen.getByText("test2.pdf")).toBeInTheDocument()
    expect(screen.getByText("test3.pdf")).toBeInTheDocument()
  })

  it("各ファイルの名前とサイズが表示される", () => {
    const mockOnReorder = vi.fn()
    const mockOnRemove = vi.fn()

    render(<FileList files={mockFiles} onReorder={mockOnReorder} onRemove={mockOnRemove} />)

    expect(screen.getByText("test1.pdf")).toBeInTheDocument()
    expect(screen.getByText("1.0 KB")).toBeInTheDocument()
    expect(screen.getByText("test2.pdf")).toBeInTheDocument()
    expect(screen.getByText("2.0 KB")).toBeInTheDocument()
    expect(screen.getByText("test3.pdf")).toBeInTheDocument()
    expect(screen.getByText("1.0 MB")).toBeInTheDocument()
  })

  it("ファイルサイズのフォーマット（B, KB, MB）が正しい", () => {
    const mockOnReorder = vi.fn()
    const mockOnRemove = vi.fn()

    const testFiles = [
      Object.assign(createMockFile("small.pdf", 512), { size: 512 }),
      Object.assign(createMockFile("medium.pdf", 2048), { size: 2048 }),
      Object.assign(createMockFile("large.pdf", 2097152), { size: 2097152 }),
    ]

    render(<FileList files={testFiles} onReorder={mockOnReorder} onRemove={mockOnRemove} />)

    expect(screen.getByText("512 B")).toBeInTheDocument()
    expect(screen.getByText("2.0 KB")).toBeInTheDocument()
    expect(screen.getByText("2.0 MB")).toBeInTheDocument()
  })

  it("ファイルの順番（インデックス番号）が表示される", () => {
    const mockOnReorder = vi.fn()
    const mockOnRemove = vi.fn()

    render(<FileList files={mockFiles} onReorder={mockOnReorder} onRemove={mockOnRemove} />)

    expect(screen.getByText("1")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
  })

  it("削除ボタンをクリックするとonRemoveが呼ばれる", () => {
    const mockOnReorder = vi.fn()
    const mockOnRemove = vi.fn()

    render(<FileList files={mockFiles} onReorder={mockOnReorder} onRemove={mockOnRemove} />)

    const deleteButtons = screen.getAllByRole("button")
    fireEvent.click(deleteButtons[0])

    expect(mockOnRemove).toHaveBeenCalledWith(0)
  })

  it("ドラッグ開始時に要素の透明度が変わる", () => {
    const mockOnReorder = vi.fn()
    const mockOnRemove = vi.fn()

    const { container } = render(<FileList files={mockFiles} onReorder={mockOnReorder} onRemove={mockOnRemove} />)

    const firstItem = container.querySelector('[draggable="true"]') as HTMLElement

    fireEvent.dragStart(firstItem)

    expect(firstItem).toHaveClass("opacity-50")
  })

  it("ドラッグ終了時に透明度が元に戻る", () => {
    const mockOnReorder = vi.fn()
    const mockOnRemove = vi.fn()

    const { container } = render(<FileList files={mockFiles} onReorder={mockOnReorder} onRemove={mockOnRemove} />)

    const firstItem = container.querySelector('[draggable="true"]') as HTMLElement

    fireEvent.dragStart(firstItem)
    expect(firstItem).toHaveClass("opacity-50")

    fireEvent.dragEnd(firstItem)
    expect(firstItem).toHaveClass("opacity-100")
  })

  it("ドラッグオーバー時にonReorderが呼ばれる", () => {
    const mockOnReorder = vi.fn()
    const mockOnRemove = vi.fn()

    const { container } = render(<FileList files={mockFiles} onReorder={mockOnReorder} onRemove={mockOnRemove} />)

    const items = container.querySelectorAll('[draggable="true"]')
    const firstItem = items[0] as HTMLElement
    const secondItem = items[1] as HTMLElement

    fireEvent.dragStart(firstItem)
    fireEvent.dragOver(secondItem)

    expect(mockOnReorder).toHaveBeenCalledWith(0, 1)
  })

  it("同じ要素へのドラッグオーバーではonReorderが呼ばれない", () => {
    const mockOnReorder = vi.fn()
    const mockOnRemove = vi.fn()

    const { container } = render(<FileList files={mockFiles} onReorder={mockOnReorder} onRemove={mockOnRemove} />)

    const firstItem = container.querySelector('[draggable="true"]') as HTMLElement

    fireEvent.dragStart(firstItem)
    fireEvent.dragOver(firstItem)

    expect(mockOnReorder).not.toHaveBeenCalled()
  })

  it("空のファイルリストでも正しくレンダリングされる", () => {
    const mockOnReorder = vi.fn()
    const mockOnRemove = vi.fn()

    const { container } = render(<FileList files={[]} onReorder={mockOnReorder} onRemove={mockOnRemove} />)

    expect(container.querySelector(".space-y-2")).toBeInTheDocument()
    expect(container.querySelectorAll('[draggable="true"]')).toHaveLength(0)
  })
})
