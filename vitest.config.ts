import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { dirname as _dirname, join, resolve } from "node:path";
const dirname = typeof __dirname !== 'undefined' ? __dirname : _dirname(fileURLToPath(import.meta.url));

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      enabled: true,
      exclude: ['node_modules/', 'dist/', '.next/', 'coverage/', '*.config.js', '*.config.ts', 'vitest.setup.ts', 'app/layout.tsx', 'app/page.tsx', '**/*.d.ts', '**/*.test.ts', '**/*.test.tsx', '**/*.stories.tsx', '.storybook/']
    },
    alias: {
      "@": resolve(__dirname, "./")
    },
    projects: [
      {
        extends: true,
        plugins: [
        // The plugin will run tests for the stories defined in your Storybook config
        // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
        storybookTest({
          configDir: join(dirname, '.storybook')
        })],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [{
              browser: 'chromium'
            }]
          },
          setupFiles: ['.storybook/vitest.setup.ts']
        }
      },
      {
        plugins: [react()],
        test: {
          name: 'unit',          
          include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
          setupFiles: ["./vitest.setup.ts"],
          environment: "jsdom",
          globals: true,
          alias: {
            "@": resolve(__dirname, "./")
          }
        }
      }
    ]
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./")
    }
  }
});
