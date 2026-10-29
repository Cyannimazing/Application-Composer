import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const tools = await readFile("extension/form-tools.js", "utf8");
const workerCode = await readFile("extension/background.js", "utf8");
async function runCapture(snapshot, mode) {
  let posted;
  const sandbox = { crypto, AbortSignal, fetch: async (url, options) => { if (url.endsWith("/capture")) posted = JSON.parse(options.body); return { ok: true, json: async () => ({ ok: true }) }; }, chrome: { storage: { local: { get: async () => ({ pairingKey: "0".repeat(64) }) }, session: { set: async () => {} } }, tabs: { query: async query => query.active ? [{ id: 4, url: snapshot.url }] : [{ id: 2 }], update: async () => {}, create: async () => {} }, scripting: { executeScript: async request => request.files ? [] : [{ result: snapshot }] }, runtime: { onMessage: { addListener() {} }, getURL: () => "chrome-extension://test/" } } };
  vm.createContext(sandbox);
  vm.runInContext(workerCode, sandbox);
  const result = await sandbox.captureTab(mode);
  return { result, posted };
}
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(`<title>OnlineJobs.ph</title><nav>Account navigation</nav><main><h1>Website Designer &amp; Developer</h1><section><h2>JOB OVERVIEW</h2><p id="job-description">Build a client website.<br>Use Next.js, TypeScript and Supabase.<br>Include SUNSHINE in the subject.<br>Explain your CMS experience.</p></section><p hidden>HIDDEN-SECRET-MARKER</p><textarea style="display:none">PRIVATE-DRAFT-MARKER</textarea><footer>Unrelated links</footer></main>`);
  await page.addScriptTag({ content: tools });
  const snapshot = await page.evaluate(() => window.ApplicationComposer.capture("listing-test"));
  snapshot.url = "https://www.onlinejobs.ph/jobseekers/job/designer-1758461";
  const { result, posted } = await runCapture(snapshot, "job");
  assert.equal(result.mode, "job");
  assert.equal(posted.jobListing, true);
  assert.equal(posted.fields.length, 0);
  assert.match(posted.context, /Include SUNSHINE/);
  assert.equal(posted.title, "Website Designer & Developer");
  assert.doesNotMatch(posted.context, /HIDDEN-SECRET-MARKER|PRIVATE-DRAFT-MARKER|Account navigation|Unrelated links/);
  await assert.rejects(runCapture(snapshot, "form"), /application form|editable fields/i);
  const form = { ...snapshot, fields: [{ id: "message", type: "textarea", label: "Message", value: "", options: [], required: true, maxLength: 4000 }] };
  const captured = await runCapture(form, "form");
  assert.equal(captured.posted.jobListing, false);
  assert.equal(captured.posted.fields.length, 1);
  const descriptionOnly = await runCapture(form, "job");
  assert.equal(descriptionOnly.posted.fields.length, 0, "Job capture must not treat unrelated inputs as application targets");
  // Existing tabs must accept a reloaded helper instead of keeping the old implementation.
  await page.evaluate(() => { window.ApplicationComposer = { version: 1, capture: () => ({ title: "Old helper" }) }; });
  await page.addScriptTag({ content: tools });
  assert.notEqual(await page.evaluate(() => window.ApplicationComposer.capture("reload").title), "Old helper");
  try {
    const html = await readFile(".local/capture-debug/onlinejobs.html", "utf8");
    await page.route("**/*", route => route.abort());
    await page.setContent(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, ""));
    await page.addScriptTag({ content: tools });
    const actual = await page.evaluate(() => window.ApplicationComposer.capture("actual-public-listing"));
    assert.match(actual.context, /Sunshine Socials/);
    assert.match(actual.context, /SEO/);
    console.log("PASS: description extraction verified against the saved public OnlineJobs.ph listing HTML.");
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  console.log("PASS: listing-only capture, complete description, hidden/form text exclusion, separate form capture, and helper reload.");
} finally { await browser.close(); }
