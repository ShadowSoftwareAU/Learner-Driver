import { defineConfig, devices } from "@playwright/test";
import { execSync } from "child_process";

/**
 * Playwright config for the driving-app E2E tests.
 *
 * The webServer starts a dedicated Vite dev server on port 5173 so the tests
 * run isolated from any workflow already serving the app on its own PORT.
 *
 * NixOS note: Playwright's downloaded Chromium headless shell binary requires
 * glibc-compatible shared libraries (libgbm, libglib, …) that are not on the
 * standard library search path in NixOS. Instead we detect the Nix-packaged
 * Chromium (which is properly patchelf'd for NixOS) and pass it as the
 * executablePath so Playwright skips its own binary.
 */

const TEST_PORT = 5173;

/**
 * Locate the NixOS Chromium binary. Tries `which chromium` in the current
 * PATH first (fast), then falls back to a `nix-build` lookup. Returns
 * undefined on non-NixOS environments so Playwright uses its default binary.
 */
function findNixChromium(): string | undefined {
  // Fast path — chromium is already on PATH (nix-shell or nix profile)
  try {
    const result = execSync("which chromium 2>/dev/null", { timeout: 5_000 })
      .toString()
      .trim();
    if (result) return result;
  } catch {
    // not on PATH — try nix-build
  }

  // Slow path — resolve via nix-build (first run only; result is cached)
  try {
    const storePath = execSync(
      "nix-build '<nixpkgs>' -A chromium --no-out-link 2>/dev/null",
      { timeout: 60_000 },
    )
      .toString()
      .trim();
    if (storePath) return `${storePath}/bin/chromium`;
  } catch {
    // not available — use Playwright default
  }

  return undefined;
}

const chromiumExecutablePath = findNixChromium();

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: `http://localhost:${TEST_PORT}`,
    headless: true,
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // On NixOS: override the Playwright binary with the Nix-patched one.
        ...(chromiumExecutablePath
          ? { launchOptions: { executablePath: chromiumExecutablePath } }
          : {}),
      },
    },
  ],
  webServer: {
    command: "pnpm dev",
    port: TEST_PORT,
    reuseExistingServer: true,
    // These env vars are NOT inherited automatically — pass them explicitly.
    env: {
      PORT: String(TEST_PORT),
      BASE_PATH: "/",
      VITE_CLERK_PUBLISHABLE_KEY:
        process.env.VITE_CLERK_PUBLISHABLE_KEY ?? "",
    },
    timeout: 60_000,
  },
});
