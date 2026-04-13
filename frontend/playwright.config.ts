import fs from "node:fs";
import path from "node:path";

import { defineConfig } from "@playwright/test";

// 避免 Node 在同时存在 NO_COLOR 与 FORCE_COLOR 时输出无关环境警告。
if (process.env.FORCE_COLOR && process.env.NO_COLOR) {
  delete process.env.NO_COLOR;
}

function findInstalledChromium() {
  const directCandidates = [
    process.env.PLAYWRIGHT_CHROMIUM_PATH,
    "/home/hxfeng/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome",
  ].filter(Boolean) as string[];

  for (const candidate of directCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const browserRoot =
    process.env.PLAYWRIGHT_BROWSERS_PATH ||
    path.join(process.env.HOME || "", ".cache", "ms-playwright");

  if (!browserRoot || !fs.existsSync(browserRoot)) {
    return "";
  }

  const browserDirs = fs
    .readdirSync(browserRoot)
    .filter((entry) => entry.startsWith("chromium-"))
    .sort()
    .reverse();

  for (const browserDir of browserDirs) {
    const executablePath = path.join(browserRoot, browserDir, "chrome-linux64", "chrome");
    if (fs.existsSync(executablePath)) {
      return executablePath;
    }
  }

  return "";
}

const configuredChromiumPath = findInstalledChromium();

const launchOptions = configuredChromiumPath
  ? { executablePath: configuredChromiumPath }
  : {};

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000",
    headless: true,
    launchOptions,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  workers: 1,
  reporter: [["list"]],
});
