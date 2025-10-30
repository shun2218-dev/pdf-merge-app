import type { Meta, StoryObj } from "@storybook/react"
import { FileList } from "./file-list"
import { fn } from "storybook/test"

const meta = {
  title: "Components/FileList",
  component: FileList,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onReorder: fn(),
    onRemove: fn(),
  },
} satisfies Meta<typeof FileList>

export default meta
type Story = StoryObj<typeof meta>

const mockFiles = [
  new File(["content1"], "document1.pdf", { type: "application/pdf" }),
  new File(["content2"], "document2.pdf", { type: "application/pdf" }),
  new File(["content3"], "document3.pdf", { type: "application/pdf" }),
]

export const Default: Story = {
  args: {
    files: mockFiles,
  },
}

export const SingleFile: Story = {
  args: {
    files: [mockFiles[0]],
  },
}

export const ManyFiles: Story = {
  args: {
    files: [
      ...mockFiles,
      new File(["content4"], "document4.pdf", { type: "application/pdf" }),
      new File(["content5"], "document5.pdf", { type: "application/pdf" }),
    ],
  },
}

export const InCard: Story = {
  args: {
    files: mockFiles,
  },
  decorators: [
    (Story) => (
      <div className="w-[600px] rounded-lg border border-border bg-card p-6">
        <Story />
      </div>
    ),
  ],
}
