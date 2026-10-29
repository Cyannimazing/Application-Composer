import assert from "node:assert/strict";
import { chromium } from "playwright";
import { cp, mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Explicit live CLI check: consumes normal CLI usage; never starts a server or submits applications.
const base = "http://127.0.0.1:32187";
const source = (await (await fetch(base + "/api/state")).json()).capture;
if (!source?.context?.trim()) throw new Error("Capture a job in the running app before this live check.");
const extension = await mkdtemp(path.resolve(".local/live-extension-"));
await cp("extension", extension, { recursive: true });
const background = path.join(extension, "background.js");
await writeFile(background, (await readFile(background, "utf8")).replace('"X-Composer-Key": pairingKey', '"X-Composer-Key": pairingKey, "X-Composer-Test": "1"'));
const manifestPath = path.join(extension, "manifest.json"), manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.host_permissions.push("https://www.onlinejobs.ph/*");
await writeFile(manifestPath, JSON.stringify(manifest));
const installed = (await readdir(".local/browsers")).find(name => /^chromium-\d+$/.test(name));
const context = await chromium.launchPersistentContext(await mkdtemp(path.resolve(".local/live-extension-browser-")), { executablePath: path.resolve(".local/browsers", installed, "chrome-win64/chrome.exe"), headless: true, permissions: ["clipboard-read", "clipboard-write"], viewport: { width: 420, height: 840 }, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`], extraHTTPHeaders: { "X-Composer-Test": "1" } });
context.setDefaultTimeout(15000);
try {
  const escape = text => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  await context.route("https://www.onlinejobs.ph/**", route => route.fulfill({ contentType: "text/html", body: "<h1>" + escape(source.title) + '</h1><main><div id="job-description">' + escape(source.context).replace(/\n/g, "<br>") + "</div></main>" }));
  const page = await context.newPage();
  await page.goto("https://www.onlinejobs.ph/jobseekers/job/composer-live-check-1758461");
  const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
  const { key } = JSON.parse(await readFile(".local/pairing.json", "utf8"));
  await worker.evaluate(key => chrome.storage.local.set({ pairingKey: key }), key);
  const initial = await worker.evaluate(() => captureAndGenerate("job", "onlinejobs"));
  assert.equal(await page.url(), "https://www.onlinejobs.ph/jobseekers/job/composer-live-check-1758461");
  console.log("Actual extension capture started a real CLI draft; source tab was preserved.");
  const popup = await context.newPage();
  await popup.goto("chrome-extension://" + new URL(worker.url()).host + "/popup.html");
  await popup.getByRole("radio", { name: "OnlineJobs.ph", exact: true }).click();
  let latest, previousStage;
  const deadline = Date.now() + 500000;
  while (Date.now() < deadline) {
    latest = await worker.evaluate(() => draftStatus("onlinejobs"));
    if (latest.job.stage !== previousStage) { previousStage = latest.job.stage; console.log("CLI stage: " + previousStage); }
    if (latest.job.state === "failed") throw new Error(latest.job.error);
    if (latest.job.state === "complete") break;
    await new Promise(resolve => setTimeout(resolve, 1800));
  }
  assert.equal(latest.job.state, "complete", "Live generation must finish");
  assert.ok(latest.job.draft.review);
  assert.notEqual(latest.job.draft.review.eligibility, "skip");
  await popup.waitForFunction(() => !document.getElementById("copy-all").disabled);
  await popup.getByRole("button", { name: "Copy application", exact: true }).click();
  const copied = await popup.evaluate(() => navigator.clipboard.readText());
  assert.ok(copied.trim().length > 100);
  assert.doesNotMatch(copied, /C:\\Users|UNTRUSTED WEBSITE|CV CONTEXT|PROJECT CONTEXT/);
  const message = latest.job.draft.answers.find(answer => latest.capture.fields.find(field => field.id === answer.fieldId)?.label === "Application message")?.value || "";
  if (/3\s*[–-]\s*5|3\s+to\s+5/.test(source.context)) assert.ok((message.match(/https?:\/\/[^\s)]+/g) || []).length >= 3, "This client requested 3–5 linked examples");
  assert.doesNotMatch(message, /\b[1-9]\d*\+?\s+years?\s+(?:of\s+)?(?:professional\s+)?experience/i);
  await popup.close();
  const reopened = await context.newPage();
  await reopened.goto("chrome-extension://" + new URL(worker.url()).host + "/popup.html");
  await reopened.getByRole("radio", { name: "OnlineJobs.ph", exact: true }).click();
  await reopened.waitForFunction(() => !document.getElementById("copy-all").disabled);
  await mkdir("output/playwright", { recursive: true });
  await reopened.screenshot({ path: "output/playwright/extension-real-generated-result.png", fullPage: true });
  await writeFile(".local/verified-extension-generation.json", JSON.stringify(latest, null, 2));
  await reopened.request.post(base + "/api/reset", { data: { captureId: initial.capture.id } });
  console.log("PASS: real extension → paired API → actual CLI draft/review → popup results → clipboard copy → reopen/resume. Client example-link count satisfied; no submission.");
} finally { await context.close(); }
