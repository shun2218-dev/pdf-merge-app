import type { Meta, StoryObj } from "@storybook/react"
import { FileUploader } from "./file-uploader"
import { fn } from "@storybook/test"

const meta = {
  title: "Components/FileUploader",
  component: FileUploader,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onFilesSelected: fn(),
  },
} satisfies Meta<typeof FileUploader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const InCard: Story = {
  decorators: [
    (Story) => (
      <div className="w-[600px] rounded-lg border border-border bg-card p-6">
        <Story />
      </div>
    ),
  ],
}
