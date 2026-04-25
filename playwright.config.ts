import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "html" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 360_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://fake:fake@127.0.0.1:65432/fake?connect_timeout=1",
      DIRECT_URL: process.env.DIRECT_URL || "postgresql://fake:fake@127.0.0.1:65432/fake?connect_timeout=1",
      AUTH_SECRET: process.env.AUTH_SECRET || "e2e-test-secret-with-at-least-32-chars",
      AUTH_URL: "http://localhost:3000",
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
      NEXT_PUBLIC_APP_NAME: "E2E Tests",
      RESEND_API_KEY: process.env.RESEND_API_KEY || "e2e-stub-key",
      EMAIL_FROM: "e2e@example.com",
    },
  },
})
