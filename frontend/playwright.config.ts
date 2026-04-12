import { defineConfig } from "@playwright/test";

// 避免 Node 在同时存在 NO_COLOR 与 FORCE_COLOR 时输出无关环境警告。
if (process.env.FORCE_COLOR && process.env.NO_COLOR) {
  delete process.env.NO_COLOR;
}

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || "/home/hxfeng/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome";

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    headless: true,
    launchOptions: {
      executablePath,
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  workers: 1,
  reporter: [["list"]],
});
