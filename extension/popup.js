const status = document.getElementById("status");
const capture = document.getElementById("capture");
const captureJob = document.getElementById("capture-job");
const save = document.getElementById("save");
const key = document.getElementById("key");
const result = document.getElementById("result");
const answersElement = document.getElementById("answers");
const copyAll = document.getElementById("copy-all");
const createAnywayButton = document.getElementById("create-anyway");
const regenerateButton = document.getElementById("regenerate");
const platformButtons = Array.from(document.querySelectorAll("[data-platform]"));
let platform = "other", latest = null, pollTimer = null, starting = false, initialized = false;
let copyParts = [];
let requestRevision = 0;
function setStatus(text, loading = false) {
  status.replaceChildren();
  if (loading) { const spinner = document.createElement("span"); spinner.className = "spinner"; spinner.setAttribute("aria-hidden", "true"); status.append(spinner); }
  status.append(document.createTextNode(text));
}
function setBusy(busy) { capture.disabled = busy; captureJob.disabled = busy; regenerateButton.disabled = busy; createAnywayButton.disabled = busy; }
function choosePlatform(value, focus = false) {
  requestRevision++;
  clearTimeout(pollTimer); platform = value; latest = null; copyParts = []; result.hidden = true; setBusy(false);
  for (const button of platformButtons) { const selected = button.dataset.platform === value; button.setAttribute("aria-checked", String(selected)); button.tabIndex = selected ? 0 : -1; if (selected && focus) button.focus(); }
  if (initialized) void refreshDraft();
}
for (const button of platformButtons) {
  button.addEventListener("click", () => choosePlatform(button.dataset.platform));
  button.addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = platformButtons.indexOf(button), offset = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    const next = event.key === "Home" ? 0 : event.key === "End" ? platformButtons.length - 1 : (index + offset + platformButtons.length) % platformButtons.length;
    choosePlatform(platformButtons[next].dataset.platform, true);
  });
}
async function message(input) {
  const response = await chrome.runtime.sendMessage(input);
  if (!response?.ok) throw new Error(response?.error || "The companion did not respond. Reload it from your browser extensions page.");
  return response.data;
}
async function copyText(value) {
  try { await navigator.clipboard.writeText(value); setStatus("Copied. Paste it into the application."); }
  catch { setStatus("Copy was blocked. Select and copy the answer text below."); }
}
function renderSession(session) {
  latest = session; copyParts = []; answersElement.replaceChildren(); copyAll.disabled = true;
  document.body.classList.toggle("has-result", Boolean(session?.capture));
  copyAll.hidden = true; createAnywayButton.hidden = true;
  if (!session?.capture) { result.hidden = true; setBusy(false); setStatus("Choose a platform and capture the job. You send the application yourself."); return; }
  const source = session.capture, job = session.job;
  result.hidden = false;
  document.getElementById("job-name").textContent = source.title;
  const link = document.getElementById("job-source");
  try { const url = new URL(source.url); if (!["http:", "https:"].includes(url.protocol)) throw new Error(); link.href = url.href; link.hidden = false; link.textContent = url.hostname; } catch { link.hidden = true; }
  document.getElementById("job-context").value = source.context;
  const reviewElement = document.getElementById("review");
  reviewElement.replaceChildren(); reviewElement.hidden = true;
  const busy = job?.state === "running";
  setBusy(starting || busy);
  regenerateButton.hidden = busy;
  if (busy) {
    setStatus(job.stage === "reviewing" ? "Reviewing application…" : "Generating application…", true);
    pollTimer = setTimeout(refreshDraft, 1200);
    return;
  }
  if (session.error || job?.state === "failed") { setStatus(session.error || job.error || "Generation failed. Try again."); return; }
  if (!job?.draft?.review) { setStatus("Job captured. Generate an application to see the result."); return; }
  const review = job.draft.review;
  reviewElement.hidden = false;
  reviewElement.className = review.eligibility === "skip" ? "review-warning" : "review-ready";
  const heading = document.createElement("strong");
  heading.textContent = review.eligibility === "skip" ? "Skip: requirements not met" : review.eligibility === "needs_review" ? "Review these details" : "Drafted and reviewed";
  const summary = document.createElement("p"); summary.textContent = review.summary;
  reviewElement.append(heading, summary);
  if (review.warnings?.length) { const warnings = document.createElement("p"); warnings.textContent = review.warnings.join(" "); reviewElement.append(warnings); }
  if (review.eligibility === "skip") { createAnywayButton.hidden = false; setStatus("A required qualification does not match your profile. Review the explanation."); return; }
  for (const field of source.fields) {
    const answer = job.draft.answers.find(item => item.fieldId === field.id);
    if (!answer || (!answer.value?.trim() && !answer.needsInput)) continue;
    const value = field.type === "select" ? field.options?.find(option => option.value === answer.value)?.label || answer.value : answer.value;
    const block = document.createElement("div"); block.className = "result-answer";
    const header = document.createElement("div"); header.className = "result-answer-heading";
    const label = document.createElement("label"); label.textContent = field.label; label.htmlFor = "answer-" + field.id;
    const button = document.createElement("button"); button.type = "button"; button.className = "copy-answer"; button.textContent = "Copy"; button.disabled = !value.trim(); button.setAttribute("aria-label", "Copy " + field.label); button.addEventListener("click", () => copyText(value));
    const text = document.createElement("textarea"); text.id = label.htmlFor; text.value = value; text.readOnly = true; text.rows = field.type === "textarea" || field.type === "contenteditable" ? 7 : 2;
    header.append(label, button); block.append(header, text);
    if (answer.needsInput) { const hint = document.createElement("p"); hint.className = "copy-note"; hint.textContent = "Check this answer: " + (answer.reason || "a detail needs your input."); block.append(hint); }
    answersElement.append(block);
    if (value.trim() && !answer.needsInput) copyParts.push({ label: field.label, value });
  }
  copyAll.disabled = copyParts.length === 0;
  copyAll.hidden = false;
  setStatus(copyParts.length ? "Application ready. Review the answers and copy." : "Review the missing details before copying.");
}
async function refreshDraft() {
  clearTimeout(pollTimer);
  const requested = platform;
  const revision = requestRevision;
  try { const session = await message({ action: "draft-status", platform: requested }); if (platform === requested && revision === requestRevision) renderSession(session); }
  catch (error) { if (platform === requested && revision === requestRevision) { setStatus(error.message); setBusy(false); regenerateButton.hidden = false; } }
}
async function act(button, action, loadingText = "Capturing job details…") {
  if (starting) return;
  starting = true; setBusy(true); setStatus("Capturing job details…", true); clearTimeout(pollTimer);
  const requested = platform;
  const revision = ++requestRevision;
  copyParts = []; copyAll.disabled = true; result.hidden = true;
  try { const session = await action(); if (platform === requested && revision === requestRevision) renderSession(session); }
  catch (error) {
    try { const session = await message({ action: "draft-status", platform: requested }); if (session && platform === requested && revision === requestRevision) renderSession(session); } catch {}
    if (platform === requested && revision === requestRevision) setStatus(error.message);
  }
  finally { starting = false; setBusy(latest?.job?.state === "running"); }
}
captureJob.addEventListener("click", () => act(captureJob, () => message({ action: "capture-generate", mode: "job", platform })));
capture.addEventListener("click", () => act(capture, () => message({ action: "capture-generate", mode: "form", platform })));
regenerateButton.addEventListener("click", () => act(regenerateButton, () => message({ action: "regenerate", platform }), "Generating application…"));
createAnywayButton.addEventListener("click", () => act(createAnywayButton, () => message({ action: "regenerate", platform, createAnyway: true }), "Generating application…"));
copyAll.addEventListener("click", () => copyText(copyParts.length === 1 ? copyParts[0].value : copyParts.map(part => part.label + "\n" + part.value).join("\n\n")));
document.getElementById("copy-details").addEventListener("click", () => { if (latest?.capture) void copyText(latest.capture.title + "\n\n" + latest.capture.context); });
save.addEventListener("click", async () => {
  save.disabled = true;
  try {
    const value = key.value.trim(); if (!/^[a-f0-9]{64}$/.test(value)) throw new Error("Copy the full pairing key from Browser setup.");
    await chrome.storage.local.set({ pairingKey: value }); await message({ action: "check" }); document.getElementById("pairing").open = false; setStatus("Connected. Capture the job to generate your application.");
  } catch (error) { setStatus(error.message); }
  finally { save.disabled = false; }
});
try {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const host = new URL(tab?.url || "http://localhost").hostname;
  choosePlatform(host === "upwork.com" || host.endsWith(".upwork.com") ? "upwork" : host === "onlinejobs.ph" || host.endsWith(".onlinejobs.ph") ? "onlinejobs" : "other");
} catch { choosePlatform("other"); }
const { pairingKey } = await chrome.storage.local.get("pairingKey");
if (!pairingKey) document.getElementById("pairing").open = true;
else key.value = pairingKey;
initialized = true;
chrome.storage.onChanged?.addListener((changes, area) => {
  if (area !== "session" || !changes["application-draft:" + platform]) return;
  requestRevision++;
  void refreshDraft();
});
await refreshDraft();
