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
      thresholds: { lines: 4, functions: 7 },
    },
  },
})
