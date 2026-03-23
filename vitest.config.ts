import { defineConfig } from "vitest/config"
import { resolve } from "path"

export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
  test: {
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    environmentMatchGlobs: [
      ["src/components/**/*.test.tsx", "jsdom"],
    ],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/actions/**", "src/validations/**"],
      thresholds: { lines: 70, functions: 70 },
    },
  },
})
