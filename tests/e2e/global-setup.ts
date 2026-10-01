import { chromium, type FullConfig } from "@playwright/test";
import { authFile, createDedicatedUser, login, sessionCookies } from "../support/real-backend.ts";

export default async function setup(config: FullConfig) {
  const account = await createDedicatedUser();
  const browser = await chromium.launch();
  try {
    const baseURL = config.projects[0]?.use.baseURL;
    const context = await browser.newContext({ baseURL });
    if (process.env.E2E_BASE_URL) {
      // Remote deployment: inject the SSR session instead of typing credentials into its form.
      await context.addCookies(await sessionCookies(String(baseURL), account));
    } else {
      await login(await context.newPage(), account);
    }
    await context.storageState({ path: authFile });
  } finally {
    await browser.close();
  }
}
