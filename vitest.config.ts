import { defineConfig } from "vitest/config"
import { resolve } from "path"

export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
  test: {
    globals: true,
    testTimeout: 60_000,
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.claude/**", "**/e2e/**"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/actions/**", "src/validations/**"],
      thresholds: { lines: 75, functions: 72, statements: 75, branches: 70 },
    },
  },
})
