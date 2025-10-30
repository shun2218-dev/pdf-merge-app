# Storybook for PDF Merger App

This project uses Storybook for component development and documentation.

## Running Storybook

To start Storybook in development mode:

\`\`\`bash
npm run storybook
\`\`\`

This will start Storybook on `http://localhost:6006`

## Building Storybook

To build a static version of Storybook:

\`\`\`bash
npm run build-storybook
\`\`\`

## Available Stories

- **UI Components**: Button, Card
- **App Components**: Header, FileUploader, FileList

## Writing Stories

Stories are located next to their components with the `.stories.tsx` extension. Each story demonstrates different states and variations of a component.

Example:
\`\`\`typescript
import type { Meta, StoryObj } from "@storybook/react"
import { MyComponent } from "./my-component"

const meta = {
  title: "Components/MyComponent",
  component: MyComponent,
  tags: ["autodocs"],
} satisfies Meta<typeof MyComponent>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    // component props
  },
}
