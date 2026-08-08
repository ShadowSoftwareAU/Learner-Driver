/**
 * E2E test — lesson notes survive the full continue-type-navigate-back cycle.
 *
 * Regression guard for the resume-hydration bug where setConfidenceNote was
 * overwriting locally-typed notes with the stale DB value on page remount.
 * The fix uses a functional state update (prev => prev !== "" ? prev : dbValue)
 * so the localStorage draft always wins over the server value.
 *
 * Flow tested:
 *  1. Open an in-progress assessment via ?resume=42
 *  2. Open the Lesson Notes dialog, type a note, click Back (no API save)
 *  3. Wait for the 400 ms debounced draft to flush to localStorage
 *  4. Navigate away to the assessments list
 *  5. Navigate back to the same ?resume=42 URL (full component remount)
 *  6. Assert the notes dialog re-opens with the previously typed note intact
 *  7. Save — verify the PATCH body contains the note
 *  8. Verify the detail page renders the saved note
 *
 * Network strategy
 * ────────────────
 * • Clerk React loads clerk.browser.js dynamically from https://js.clerk.com.
 *   We intercept that CDN request and serve the local npm bundle instead so
 *   the test runs without internet access.
 * • All Clerk FAPI requests (https://decent-flounder-71.clerk.accounts.dev)
 *   are fulfilled with mock responses that establish an active session.
 * • All app API calls are fulfilled with minimal mock data.
 *
 * Selector note
 * ─────────────
 * While the Radix "New Assessment Setup" dialog is open, Radix applies
 * aria-hidden to the rest of the DOM. getByRole() therefore cannot find the
 * "Save & Return" button in the fixed bottom bar. We use a CSS-based locator
 * (page.locator('button').filter(...)) which ignores aria-hidden, then wait
 * for toBeEnabled() — the signal that resume hydration finished and the setup
 * dialog was dismissed.
 */

import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { execSync } from "child_process";

// ── Local Clerk JS bundle ─────────────────────────────────────────────────────
// Clerk React dynamically loads clerk.browser.js from js.clerk.com at runtime.
// We find the local pnpm copy and serve it from the Playwright route handler
// so the test does not need internet access.
function findLocalClerkJsBundle(): Buffer | null {
  try {
    // Shell glob expansion is fast — no recursive find needed.
    const result = execSync(
      "ls /home/runner/workspace/node_modules/.pnpm/@clerk+clerk-js@*/node_modules/@clerk/clerk-js/dist/clerk.browser.js 2>/dev/null | head -1",
      { timeout: 8_000 },
    )
      .toString()
      .trim();
    if (result) return readFileSync(result);
  } catch {
    /* fall through */
  }
  return null;
}

const LOCAL_CLERK_JS = findLocalClerkJsBundle();

// ── Clerk FAPI constants ──────────────────────────────────────────────────────
// Domain encoded in pk_test_ZGVjZW50LWZsb3VuZGVyLTcxLmNsZXJrLmFjY291bnRzLmRldiQ
const FAPI_ORIGIN = "https://decent-flounder-71.clerk.accounts.dev";

// A structurally valid JWT — Clerk JS does NOT verify signatures browser-side.
const FAKE_JWT =
  "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9" +
  ".eyJzdWIiOiJ1c2VyX3Rlc3QxMjMiLCJleHAiOjk5OTk5OTk5OTl9" +
  ".ZmFrZXNpZw";

// Minimal Clerk /v1/client response that makes SignedIn render its children.
const CLERK_CLIENT_RESPONSE = {
  response: {
    id: "client_test",
    object: "client",
    last_active_session_id: "sess_test",
    sessions: [
      {
        id: "sess_test",
        object: "session",
        status: "active",
        expire_at: 9_999_999_999,
        abandon_at: 9_999_999_999,
        last_active_at: 1_700_000_000,
        user: {
          id: "user_test123",
          object: "user",
          username: null,
          first_name: "Test",
          last_name: "Instructor",
          profile_image_url: "",
          image_url: "",
          has_image: false,
          primary_email_address_id: "idn_test",
          primary_phone_number_id: null,
          primary_web3_wallet_id: null,
          email_addresses: [
            {
              id: "idn_test",
              object: "email_address",
              email_address: "test@example.com",
              verification: { status: "verified", strategy: "email_code" },
              linked_to: [],
            },
          ],
          phone_numbers: [],
          web3_wallets: [],
          external_accounts: [],
          saml_accounts: [],
          created_at: 1_700_000_000,
          updated_at: 1_700_000_000,
        },
        last_active_token: { object: "token", jwt: FAKE_JWT },
      },
    ],
    sign_in: null,
    sign_up: null,
    created_at: 1_700_000_000,
    updated_at: 1_700_000_000,
  },
  client: null,
};

// Minimal /v1/environment response (required fields for Clerk JS v6 init).
const CLERK_ENV_RESPONSE = {
  auth_config: {
    single_session_mode: false,
    url_based_session_syncing: false,
    cookieless_dev: false,
    demo: false,
  },
  display_config: {
    application_name: "Test",
    theme: {},
    preferred_sign_in_strategy: "password",
    logo_image_url: "",
    favicon_image_url: "",
    home_url: "http://localhost:5173",
    sign_in_url: "/sign-in",
    sign_up_url: "/sign-up",
    user_profile_url: "/user",
    after_sign_in_url: "/",
    after_sign_up_url: "/",
    after_sign_out_one_url: "/",
    after_sign_out_all_url: "/",
    after_sign_out_url: "/",
    branded: false,
    captcha_public_key: null,
    captcha_public_key_invisible: null,
    captcha_widget_type: null,
    experimental__force_oauth_first: false,
    google_one_tap_client_id: null,
    show_devmode_warning: false,
    clerk_js_version: "6",
    support_email: null,
  },
  user_settings: {
    attributes: {
      email_address: {
        enabled: true,
        required: true,
        used_for_first_factor: true,
        first_factors: ["email_code"],
        used_for_second_factor: false,
        second_factors: [],
        verifications: ["email_code"],
        verify_at_sign_up: true,
      },
      phone_number: { enabled: false },
      username: { enabled: false },
      first_name: { enabled: true, required: false },
      last_name: { enabled: true, required: false },
      password: { enabled: false, required: false },
    },
    social: {},
    saml: { enabled: false },
    sign_in: { second_factor: { status: "off" } },
    sign_up: {
      progressive: true,
      captcha_enabled: false,
      captcha_widget_type: null,
    },
    restrictions: {
      allowlist: { enabled: false },
      blocklist: { enabled: false },
      block_email_subaddresses: { enabled: false },
      block_disposable_email_domains: { enabled: false },
      ignore_dots_for_gmail_addresses: { enabled: false },
    },
    username_settings: { min_length: 4, max_length: 64 },
    enterprise_sso: { enabled: false },
    passkeys: { allow_autofill: true },
  },
  organization_settings: {
    enabled: false,
    max_allowed_memberships: 5,
    domains: { enabled: false },
    creator_role: "org:admin",
  },
  maintenance_mode: false,
  clerk_js_version: "6",
};

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_USER = {
  id: 1,
  role: "instructor",
  clerkUserId: "user_test123",
  firstName: "Test",
  lastName: "Instructor",
  email: "test@example.com",
};

const MOCK_STUDENT = {
  id: 1,
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  userId: null,
  learnerCode: "JD001",
  phone: null,
  dateOfBirth: null,
  notes: null,
};

const MOCK_MANEUVER = {
  id: 1,
  name: "Three-Point Turn",
  category: "Manoeuvres",
  description: null,
};

// The DB value has no confidenceNote — exactly the scenario where a naive
// hydration would wipe notes the instructor typed but hadn't saved yet.
const BASE_ASSESSMENT = {
  id: 42,
  studentId: 1,
  instructorId: 1,
  status: "in_progress",
  assessmentType: "qsafe",
  lessonDate: "2026-08-07T00:00:00.000Z",
  durationMinutes: 60,
  pedalOperator: "student",
  weatherCondition: "clear",
  lightingCondition: "daylight",
  confidenceNote: null, // ← empty server-side; draft holds the typed value
  focusAreasNext: null,
  finalizationStatus: "draft",
  vehicleId: null,
  routePath: null,
  maneuverResults: [],
};

const NOTES_TEXT = "Great progress today on hill starts";

// ── Test ──────────────────────────────────────────────────────────────────────

test("lesson notes survive the continue-type-navigate-back cycle", async ({
  page,
}) => {
  // Emit browser errors and page errors to the test runner output so failures
  // are easier to diagnose without re-running interactively.
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error("BROWSER:", msg.text());
  });
  page.on("pageerror", (err) => console.error("PAGE ERROR:", err.message));

  /**
   * patchedNote is set inside the PATCH route handler (Node.js / test runner
   * process). Reads after the request is intercepted reflect the sent value.
   */
  let patchedNote: string | null = null;

  // ── Clerk JS CDN intercept ────────────────────────────────────────────────
  // Clerk React loads clerk.browser.js dynamically from https://js.clerk.com.
  // Serve the local npm copy so initialization doesn't hit the internet.
  if (LOCAL_CLERK_JS) {
    await page.route("**/npm/@clerk/clerk-js@*/dist/clerk.browser.js", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/javascript; charset=utf-8",
        body: LOCAL_CLERK_JS,
      }),
    );
    // Also intercept the legacy variant path (clerk.legacy.browser.js)
    await page.route(
      "**/npm/@clerk/clerk-js@*/dist/clerk.legacy.browser.js",
      (route) =>
        route.fulfill({
          status: 200,
          contentType: "text/javascript; charset=utf-8",
          body: LOCAL_CLERK_JS,
        }),
    );
    // Intercept any other js.clerk.com requests (chunks, etc.)
    await page.route("https://js.clerk.com/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/javascript; charset=utf-8",
        body: "/* clerk cdn chunk */",
      }),
    );
  }

  // ── Clerk FAPI mocks ────────────────────────────────────────────────────────
  // Intercept all requests to the Clerk FAPI domain so the browser-side Clerk
  // JS SDK believes there is an active session without hitting the real service.
  //
  // IMPORTANT: Clerk derives scriptHost from the publishable key's frontendApi
  // field (decent-flounder-71.clerk.accounts.dev), so clerk.browser.js is
  // fetched from THIS domain, not from js.clerk.com. We must serve the local
  // bundle for that path or the browser receives "{}" which is not executable.
  await page.route(`${FAPI_ORIGIN}/**`, async (route) => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();

    // Preflight — always allow.
    if (method === "OPTIONS") {
      return route.fulfill({ status: 200 });
    }

    // Clerk JS bundle — served from the FAPI domain, not a CDN.
    if (pathname.includes("/dist/clerk.browser.js") || pathname.includes("/dist/clerk.legacy.browser.js")) {
      if (LOCAL_CLERK_JS) {
        return route.fulfill({
          status: 200,
          contentType: "text/javascript; charset=utf-8",
          body: LOCAL_CLERK_JS,
        });
      }
      // No local bundle found — pass through to the real server.
      return route.continue();
    }

    // Clerk JS chunk files (dynamically imported by the bundle).
    if (pathname.startsWith("/npm/") && !pathname.startsWith("/npm/@clerk/clerk-js")) {
      return route.fulfill({
        status: 200,
        contentType: "text/javascript; charset=utf-8",
        body: "/* clerk cdn chunk */",
      });
    }

    if (pathname === "/v1/environment") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(CLERK_ENV_RESPONSE),
      });
    }

    if (pathname === "/v1/client") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(CLERK_CLIENT_RESPONSE),
      });
    }

    if (
      pathname.startsWith("/v1/client/sessions/") &&
      pathname.endsWith("/tokens")
    ) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ object: "token", jwt: FAKE_JWT }),
      });
    }

    if (pathname.startsWith("/v1/client/sessions/")) {
      // touch, remove, etc.
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(CLERK_CLIENT_RESPONSE),
      });
    }

    // All other Clerk endpoints — return empty OK so the SDK doesn't hard-error.
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });

  // ── App API mocks ───────────────────────────────────────────────────────────

  // ── App API mocks ──────────────────────────────────────────────────────────
  //
  // IMPORTANT — Playwright 1.62 uses unshift() when registering routes, which
  // means routes are processed in LIFO (last-registered = first-matched) order.
  // To ensure specific routes win over the catch-all:
  //   1. Register the catch-all FIRST (so it sits at the back of the queue).
  //   2. Register specific routes AFTER (so they sit at the front and match first).
  //
  // Registration order in code  →  Processing priority
  //   catch-all (1st)           →  lowest priority (only runs if nothing else matched)
  //   specific routes (2nd+)    →  higher priority (run first due to LIFO)

  // ── 1. Catch-all (registered first = lowest priority) ─────────────────────
  // Covers: assessments list, PreviousLessonCard calls, maneuver-results POST,
  // terms acceptance POST, and any other endpoint the pages request.
  await page.route(/\/api\//, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    }),
  );

  // ── 2. Specific routes (registered after = higher priority) ───────────────

  // GET /api/users/me — generated client uses /users/me, NOT /api/me
  await page.route(/\/api\/users\/me$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_USER),
    }),
  );

  // GET /api/terms/status → accepted so TermsGate passes through immediately
  await page.route(/\/api\/terms\/status$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accepted: true, version: "1.0" }),
    }),
  );

  // GET /api/students
  await page.route(/\/api\/students$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([MOCK_STUDENT]),
    }),
  );

  // GET /api/maneuvers
  await page.route(/\/api\/maneuvers$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([MOCK_MANEUVER]),
    }),
  );

  // GET /api/instructor/my-vehicles
  await page.route(/\/api\/instructor\/my-vehicles$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    }),
  );

  // GET + PATCH /api/assessments/42 — the in-progress assessment under test.
  // GET returns null note on first load; PATCH captures the note for assertions.
  // Registered last = highest priority (LIFO).
  await page.route(/\/api\/assessments\/42$/, async (route) => {
    if (route.request().method() === "PATCH") {
      const body = JSON.parse(route.request().postData() ?? "{}");
      patchedNote = body.confidenceNote ?? null;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...BASE_ASSESSMENT, confidenceNote: patchedNote }),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...BASE_ASSESSMENT, confidenceNote: patchedNote }),
    });
  });

  // ── Step 1: Open the in-progress assessment via ?resume=42 ─────────────────
  await page.goto("/instructor/assessments/new?resume=42");

  // ── Step 2: Wait until resume hydration completes ─────────────────────────
  // While the Radix "New Assessment Setup" dialog is open, Radix applies
  // aria-hidden to the rest of the DOM, making getByRole() unable to find the
  // "Save & Return" button in the fixed bottom bar. We use a CSS-based locator
  // (which ignores aria-hidden) and wait for toBeEnabled() — the signal that
  // hydration finished and the setup dialog was dismissed.
  const saveReturnBtn = page
    .locator("button")
    .filter({ hasText: /Save & Return/i })
    .first();
  await expect(saveReturnBtn).toBeEnabled({ timeout: 25_000 });

  // ── Step 3: Open the Lesson Notes dialog ───────────────────────────────────
  await saveReturnBtn.click();

  // ── Step 4: Type a confidence note ─────────────────────────────────────────
  const confidenceTextarea = page.getByPlaceholder(
    "How did the student perform overall?",
  );
  await expect(confidenceTextarea).toBeVisible();
  await confidenceTextarea.fill(NOTES_TEXT);

  // ── Step 5: Click Back — dialog closes, note is NOT sent to the API ────────
  await page.locator("button").filter({ hasText: /^Back$/ }).click();
  await expect(confidenceTextarea).not.toBeVisible();

  // ── Step 6: Let the debounced draft flush to localStorage ──────────────────
  // The save effect fires 400 ms after the last state change; 600 ms is safe.
  await page.waitForTimeout(600);

  // ── Step 7: Navigate away ──────────────────────────────────────────────────
  await page.goto("/instructor/assessments");

  // ── Step 8: Navigate back — this triggers a full component remount ─────────
  await page.goto("/instructor/assessments/new?resume=42");

  // ── Step 9: Wait for the page to be ready again ────────────────────────────
  await expect(saveReturnBtn).toBeEnabled({ timeout: 25_000 });

  // ── Step 10: Open the notes dialog again ───────────────────────────────────
  await saveReturnBtn.click();

  // ── Step 11: The draft-held note must be present ───────────────────────────
  // On remount, useState reads from loadAssessmentDraft() which holds NOTES_TEXT.
  // The hydration effect's functional update (prev => prev !== "" ? prev : dbValue)
  // leaves it untouched because prev is already NOTES_TEXT (not "").
  await expect(confidenceTextarea).toBeVisible();
  await expect(confidenceTextarea).toHaveValue(NOTES_TEXT);

  // ── Step 12: Save for real ─────────────────────────────────────────────────
  // Target the notes dialog directly so we click its "Save & Return" button,
  // not the bottom bar button (both match the same text at this moment).
  const notesDialog = page.getByRole("dialog");
  await notesDialog
    .locator("button")
    .filter({ hasText: /Save & Return/i })
    .click();

  // ── Step 13: Wait for the PATCH and the subsequent redirect ────────────────
  await page.waitForURL("**/instructor/assessments/42", { timeout: 10_000 });

  // ── Step 14: Verify the PATCH payload contained the note ───────────────────
  expect(patchedNote).toBe(NOTES_TEXT);

  // ── Step 15: The detail page must show the saved note ──────────────────────
  // Navigate fresh so the browser issues a new GET /api/assessments/42 rather
  // than relying on TanStack Query's stale cache (the mutation doesn't
  // invalidate the cache, so a client-side navigation would reuse stale data).
  // A fresh page.goto clears React state and forces a real network request
  // through our mock handler, which now returns confidenceNote = NOTES_TEXT.
  await page.goto("/instructor/assessments/42");
  await expect(page.getByText(NOTES_TEXT)).toBeVisible({ timeout: 15_000 });
});
