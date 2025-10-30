import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      enabled: true,
      exclude: [
        'node_modules/',
        'dist/',
        '.next/',
        'coverage/',
        '*.config.js',
        '*.config.ts',
        'vitest.setup.ts',
        'app/layout.tsx',
        'app/page.tsx',        
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.stories.tsx',
        '.storybook/',
      ]
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
})
