import { chromium, type FullConfig } from "@playwright/test";
import { authFile, createDedicatedUser, login } from "../support/real-backend.ts";

export default async function setup(config: FullConfig) {
  const account = await createDedicatedUser();
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ baseURL: config.projects[0]?.use.baseURL });
    const page = await context.newPage();
    await login(page, account);
    await context.storageState({ path: authFile });
  } finally {
    await browser.close();
  }
}
