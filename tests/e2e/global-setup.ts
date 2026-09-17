import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

import {
  ARTIFACT_DIR,
  BASE_URL,
  STATUS_FILE,
  STORAGE_STATE_FILE,
  type EnvironmentStatus,
} from "./support/environment";

const EMAIL = process.env.WELLPLACE_E2E_EMAIL ?? "";
const PASSWORD = process.env.WELLPLACE_E2E_PASSWORD ?? "";

const NO_CREDENTIALS =
  "No staff credentials were supplied. Set WELLPLACE_E2E_EMAIL and " +
  "WELLPLACE_E2E_PASSWORD to an account that can open the console — " +
  "npm run staff:bootstrap creates the first Management account, and " +
  '"Forgot your password?" on /sign-in sets its password. Every console ' +
  "assertion is skipped without one.";

async function serverIsReachable(): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch(`${BASE_URL}/sign-in`, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status >= 500) {
      return {
        ok: false,
        message: `${BASE_URL}/sign-in answered ${response.status}. The application is running but failing.`,
      };
    }
    return { ok: true, message: `${BASE_URL} answered ${response.status}.` };
  } catch (cause) {
    return {
      ok: false,
      message:
        `${BASE_URL} is not answering (${cause instanceof Error ? cause.message : String(cause)}). ` +
        "Start it with: npm run dev — or point WELLPLACE_E2E_BASE_URL at a deployment.",
    };
  }
}

const WARM_ROUTES = ["/book", "/sign-in", "/reception", "/reception/board"];

async function warmUp(): Promise<void> {
  for (const route of WARM_ROUTES) {
    await fetch(`${BASE_URL}${route}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(120_000),
    })
      .then((response) => response.text())
      .catch(() => "");
  }
}

async function signIn(): Promise<{ ok: boolean; role: string | null; message: string }> {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`${BASE_URL}/sign-in`, { waitUntil: "domcontentloaded" });
    await page.fill("#console-email", EMAIL);
    await page.fill("#console-password", PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();

    await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), {
      timeout: 30_000,
    });

    const landed = new URL(page.url()).pathname;
    const role = landed.startsWith("/manage")
      ? "management"
      : landed.startsWith("/reception")
        ? "reception"
        : null;

    if (role === null) {
      return {
        ok: false,
        role: null,
        message: `Sign-in landed on ${landed}, which is neither console home.`,
      };
    }

    const home = role === "management" ? "/manage/suites" : "/reception";
    await page.goto(`${BASE_URL}${home}`, { waitUntil: "domcontentloaded" });

    if (new URL(page.url()).pathname !== home) {
      return {
        ok: false,
        role,
        message: `${EMAIL} signed in as ${role} but cannot open ${home}.`,
      };
    }

    await context.storageState({ path: STORAGE_STATE_FILE });

    return { ok: true, role, message: `Signed in as ${EMAIL} (${role}).` };
  } catch (cause) {
    return {
      ok: false,
      role: null,
      message: `Sign-in failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    };
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(): Promise<void> {
  rmSync(STORAGE_STATE_FILE, { force: true });
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  const server = await serverIsReachable();

  if (server.ok) await warmUp();

  let signedIn = false;
  let role: string | null = null;
  let sessionMessage = NO_CREDENTIALS;

  if (server.ok && EMAIL !== "" && PASSWORD !== "") {
    const attempt = await signIn();
    signedIn = attempt.ok;
    role = attempt.role;
    sessionMessage = attempt.message;
  } else if (!server.ok) {
    sessionMessage = "No server, so no session could be established.";
  }

  const status: EnvironmentStatus = {
    serverReachable: server.ok,
    signedIn,
    role,
    serverMessage: server.message,
    sessionMessage,
  };

  writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));

  console.log(`\n  e2e environment — ${status.serverMessage}`);
  console.log(`  e2e session     — ${status.sessionMessage}\n`);
}
