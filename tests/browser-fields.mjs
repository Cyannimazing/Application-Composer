import assert from "node:assert/strict";
import { chromium } from "playwright";
import path from "node:path";
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
try {
  const page = await browser.newPage();
  await page.setContent(`<h1>Next.js Developer</h1><form id="application"><label for="subject">Subject</label><input id="subject" maxlength="100"><label for="message">Your cover letter</label><textarea id="message"></textarea><label for="timezone">Timezone</label><select id="timezone"><option value="">Select</option><option value="utc8">UTC+8</option></select><label>Password<input type="password" value="secret"></label><input type="hidden" value="csrf"><label>Agree<input type="checkbox"></label><div contenteditable="true" role="textbox" aria-label="Describe a project"></div><button type="submit">Send application</button></form>`);
  await page.evaluate(() => { window.submitted = false; document.querySelector("form").addEventListener("submit", e => { e.preventDefault(); window.submitted = true; }); });
  await page.addScriptTag({ path: path.resolve("extension/form-tools.js") });
  const capture = await page.evaluate(() => window.ApplicationComposer.capture("test-capture"));
  assert.equal(capture.fields.length, 4, "Capture only supported visible editable fields");
  assert.equal(capture.fields.some(f => /password|agree/i.test(f.label)), false);
  const subject = capture.fields.find(f => f.label === "Subject");
  const message = capture.fields.find(f => f.label === "Your cover letter");
  const select = capture.fields.find(f => f.type === "select");
  const rich = capture.fields.find(f => f.type === "contenteditable");
  await page.locator("#subject").fill("My newer edit");
  const result = await page.evaluate(({ capture, subject, message, select, rich }) => window.ApplicationComposer.fill({ captureId: capture.id, url: capture.url, overwrite: false, answers: [{ fieldId: subject.id, value: "Old draft" }, { fieldId: message.id, value: "Hey! I built a booking workflow." }, { fieldId: select.id, value: "utc8" }, { fieldId: rich.id, value: "<img src=x onerror=alert(1)>" }] }), { capture, subject, message, select, rich });
  assert.equal(result.filled.length, 3);
  assert.equal(result.skipped.length, 1);
  assert.equal(await page.locator("#subject").inputValue(), "My newer edit");
  assert.equal(await page.locator("#timezone").inputValue(), "utc8");
  assert.equal(await page.locator('[contenteditable="true"] img').count(), 0, "Draft text cannot execute HTML");
  assert.equal(await page.evaluate(() => window.submitted), false, "Filling never submits the form");
  await assert.rejects(page.evaluate(({ capture, message }) => window.ApplicationComposer.fill({ captureId: "stale", url: capture.url, answers: [{ fieldId: message.id, value: "No" }] }), { capture, message }), /capture|changed|again/i);
  const overlong = await page.evaluate(({ capture, subject }) => window.ApplicationComposer.fill({ captureId: capture.id, url: capture.url, overwrite: true, answers: [{ fieldId: subject.id, value: "x".repeat(101) }] }), { capture, subject });
  assert.equal(overlong.filled.length, 0, "Length limits are enforced at the actual field");
  console.log("PASS: form capture, label mapping, selects, contenteditable text, changed values, stale capture, limits, and no submission.");
} finally { await browser.close(); }
