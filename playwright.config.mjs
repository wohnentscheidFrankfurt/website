// Browser checks of the built site. `npm test` builds nothing: run `npm run build` first (deploy.sh does both).
// The tests run against `astro preview`, which serves dist/ like Caddy does on the server.
// Desktop and Chrome with touch use the system Chrome, the iPhone uses Playwright's WebKit.
import { defineConfig, devices } from "@playwright/test";

const chrome = { browserName: "chromium", channel: "chrome" };
const port = 4322; // not 4321, so a running `npm run preview` does not get in the way

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  reporter: "list",
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  webServer: [
    {
      command: "mailpit --smtp 127.0.0.1:1026 --listen 127.0.0.1:8026",
      url: "http://127.0.0.1:8026",
      reuseExistingServer: false,
    },
    {
      command: "node api/src/main.ts",
      env: {
        API_PORT: "8788", SITE_ORIGIN: `http://localhost:${port}`,
        SMTP_HOST: "127.0.0.1", SMTP_PORT: "1026", SMTP_TLS: "none", TOKEN_SECRET: "test-secret-0123456789",
        LIMIT_PER_IP: "1000", LIMIT_PER_ADDRESS: "1000", LIMIT_TOTAL: "1000",
      },
      port: 8788, // the API has no GET route, so wait for the port
      reuseExistingServer: false,
    },
    {
      command: `API_URL=http://127.0.0.1:8788 ASTRO_TELEMETRY_DISABLED=1 npx astro preview --port ${port} --ignore-lock`,
      url: `http://localhost:${port}`,
      reuseExistingServer: false,
    },
  ],
  projects: [
    { name: "desktop-chrome", testIgnore: /(unit|api)\//, use: { ...chrome, viewport: { width: 1400, height: 900 } } },
    { name: "chrome-390", testIgnore: /(unit|api)\//,
      use: { ...chrome, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
    { name: "webkit-iphone", testIgnore: /(unit|api)\//, use: { ...devices["iPhone 15"] } },
    { name: "unit", testMatch: /unit\/.*\.spec\.ts/ },
  ],
});
