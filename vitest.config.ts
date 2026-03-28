import { defineConfig } from "vitest/config"
import { resolve } from "path"

export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
  test: {
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Note: component tests (jsdom) will be added in Phase 2
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/actions/**", "src/validations/**"],
      // Phase 1 covers lib/utils, lib/encryption, lib/permissions, invoice/tenant actions
      // and all validation schemas. Actions requiring DB/auth will be covered in Phase 2.
      // Global thresholds reflect Phase 1 scope; Phase 2 will raise these to 70%+.
      // Measured Phase 1 values: lines 4.96%, functions 7.77%, stmts 4.59%, branches 4.16%
      // Thresholds set ~1-2 points below measured to guard against regression with room for variation.
      thresholds: { lines: 3, functions: 5, statements: 3, branches: 3 },
    },
  },
})
