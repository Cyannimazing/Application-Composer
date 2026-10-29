import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFile, mkdir } from "node:fs/promises";
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"], viewport: { width: 380, height: 780 } });
try {
  const page = await context.newPage(); page.setDefaultTimeout(6000);
  const html = (await readFile("extension/popup.html", "utf8")).replace(/<script[\s\S]*?<\/script>/g, "").replace(/<link[^>]+>/g, "");
  await page.route("https://composer-popup.test/", route => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto("https://composer-popup.test/");
  await page.addStyleTag({ path: "extension/popup.css" });
  await mkdir("output/playwright", { recursive: true });
  await page.evaluate(() => {
    window.sentMessages = []; window.qaStage = "drafting"; window.qaSession = null;
    const capture = { id: "popup-job", title: "Next.js CMS developer", url: "https://www.upwork.com/jobs/Developer_~0123456789", context: "Build a Next.js and Supabase CMS. Include CMS PARTNER.", fields: [{ id: "subject", label: "Application subject", type: "text" }, { id: "message", label: "Application message", type: "textarea" }] };
    function job() { return { id: "popup-generation", state: window.qaStage === "complete" ? "complete" : "running", stage: window.qaStage, draft: window.qaStage === "complete" ? { answers: [{ fieldId: "subject", value: "CMS PARTNER", needsInput: false }, { fieldId: "message", value: "Hey! I built a Next.js CMS with Supabase. Project: https://example.com/demo", needsInput: false }], notes: ["PRIVATE-NOTE-DO-NOT-COPY"], review: { eligibility: window.qaEligibility || "fit", summary: "Questions and keywords checked.", warnings: [] } } : undefined }; }
    window.chrome = { storage: { local: { get: async () => ({ pairingKey: "0".repeat(64) }), set: async () => {} } }, tabs: { query: async () => [{ url: capture.url }] }, runtime: { sendMessage: async message => {
      window.sentMessages.push(message);
      if (message.action === "draft-status") return { ok: true, data: window.qaSession ? { capture, job: job() } : null };
      if (message.action === "capture-generate" || message.action === "regenerate") { if (message.createAnyway === true) { window.qaStage = "drafting"; window.qaEligibility = "needs_review"; } window.qaSession = true; return { ok: true, data: { capture, job: job() } }; }
      return { ok: true, data: {} };
    } } };
  });
  await page.addScriptTag({ path: "extension/popup.js", type: "module" });
  await page.waitForFunction(() => document.querySelector('[role=radio][data-platform=upwork]').getAttribute('aria-checked') === 'true');
  await page.getByRole("button", { name: "Capture & generate", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Generating application" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Capture & generate", exact: true }).isDisabled(), true);
  assert.equal(await page.evaluate(() => window.sentMessages.find(message => message.action === "capture-generate").platform), "upwork");
  await page.evaluate(() => { window.qaStage = "reviewing"; });
  await page.getByRole("status").filter({ hasText: "Reviewing application" }).waitFor();
  await page.evaluate(() => { window.qaStage = "complete"; });
  await page.getByRole("button", { name: "Copy application", exact: true }).waitFor();
  await page.waitForFunction(() => !document.getElementById('copy-all').disabled);
  await page.getByRole("button", { name: "Copy application", exact: true }).click();
  const copied = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n");
  assert.match(copied, /Application subject\nCMS PARTNER/);
  assert.match(copied, /https:\/\/example.com\/demo/);
  assert.doesNotMatch(copied, /PRIVATE-NOTE|Questions and keywords/);
  await page.getByRole("button", { name: "Copy Application message", exact: true }).click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "Hey! I built a Next.js CMS with Supabase. Project: https://example.com/demo");
  await page.evaluate(() => { window.qaEligibility = "skip"; });
  await page.getByRole("button", { name: "Generate again", exact: true }).click();
  const createAnyway = page.getByRole("button", { name: "Create anyway", exact: true });
  await createAnyway.waitFor();
  assert.equal(await page.getByRole("button", { name: "Copy application", exact: true }).isVisible(), false);
  assert.equal((await createAnyway.boundingBox()).height, 40);
  await page.screenshot({ path: "output/playwright/companion-create-anyway.png", fullPage: true });
  await createAnyway.click();
  await page.getByRole("status").filter({ hasText: "Generating application" }).waitFor();
  assert.equal(await createAnyway.isVisible(), false);
  assert.equal(await page.evaluate(() => window.sentMessages.filter(m => m.action === "regenerate").at(-1).createAnyway), true);
  await page.evaluate(() => { window.qaStage = "complete"; });
  await page.getByRole("button", { name: "Copy application", exact: true }).waitFor();
  assert.equal(await createAnyway.isVisible(), false);
  await page.getByRole("button", { name: "Copy application", exact: true }).click();
  assert.match(await page.evaluate(() => navigator.clipboard.readText()), /Next.js CMS/);
  await page.getByRole("radio", { name: "Other", exact: true }).click();
  await page.getByRole("radio", { name: "Other", exact: true }).press("ArrowRight");
  assert.equal(await page.getByRole("radio", { name: "OnlineJobs.ph", exact: true }).getAttribute("aria-checked"), "true");
  assert.equal(await page.locator("select").count(), 0);
  assert.equal(await page.locator("body").evaluate(el => el.scrollWidth <= innerWidth), true);
  await mkdir("output/playwright", { recursive: true });
  await page.screenshot({ path: "output/playwright/companion-generated-application.png", fullPage: true });
  console.log("PASS: extension capture/generate, loading/review stages, direct answer/whole application clipboard copy, private-note exclusion, and custom platform selector.");
} finally { await context.close(); await browser.close(); }
