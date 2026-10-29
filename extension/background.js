const base = "http://127.0.0.1:32187";
async function api(route, options = {}) {
  const { pairingKey } = await chrome.storage.local.get("pairingKey");
  if (!pairingKey) throw new Error("Pair the companion first. Copy the key from Browser setup in Application Composer.");
  let response;
  try { response = await fetch(base + "/api/bridge" + route, { ...options, headers: { "Content-Type": "application/json", "X-Composer-Key": pairingKey }, signal: AbortSignal.timeout(10000) }); }
  catch { throw new Error("Application Composer is not reachable. Start the local app and try again."); }
  const data = await response.json(); if (!response.ok) throw new Error(data.error || "Browser connection failed."); return data;
}
async function captureTab(mode = "form", platform, openComposer = true) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:\/\//.test(tab.url || "")) throw new Error("Open a website job listing or application form before capturing.");
  if ((tab.url || "").startsWith(base)) throw new Error("Capture from the website's application tab, not the Composer tab. For a test, open the practice form.");
  await api("");
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["form-tools.js"] });
  const id = crypto.randomUUID();
  const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: captureId => window.ApplicationComposer.capture(captureId), args: [id] });
  if (!result?.result) throw new Error("This page could not be read. Reload it and try again.");
  const jobListing = mode === "job";
  if (jobListing && !result.result.context?.trim()) throw new Error("No readable job details were found. Expand the description or paste it into Composer.");
  if (!jobListing && !result.result.fields?.length) throw new Error("No editable fields were found. Choose Capture job details on a listing, or open the application form and choose Capture form.");
  const selectedPlatform = ["onlinejobs", "upwork", "other"].includes(platform) ? platform : undefined;
  const capture = { ...result.result, tabId: tab.id, jobListing, fields: jobListing ? [] : result.result.fields, ...(selectedPlatform ? { platform: selectedPlatform } : {}) };
  const saved = await api("/capture", { method: "POST", body: JSON.stringify(capture) });
  const prepared = saved.capture || capture;
  await chrome.storage.session.set({ lastCapture: prepared });
  if (openComposer) {
    const tabs = await chrome.tabs.query({ url: base + "/*" });
    if (tabs.length) await chrome.tabs.update(tabs[0].id, { active: true });
    else await chrome.tabs.create({ url: base });
  }
  return { count: capture.fields.length, mode: jobListing ? "job" : "form", capture: prepared };
}
function sessionKey(platform) { return "application-draft:" + (["onlinejobs", "upwork", "other"].includes(platform) ? platform : "other"); }
async function generateCaptured(capture, platform) {
  const key = sessionKey(platform);
  const previous = (await chrome.storage.session.get(key))[key];
  const pending = previous?.capture.id === capture.id ? { ...previous, error: null } : { capture, jobId: null, error: null };
  await chrome.storage.session.set({ [key]: pending });
  try {
    const job = await api("/generate", { method: "POST", body: JSON.stringify({ captureId: capture.id }) });
    await chrome.storage.session.set({ [key]: { capture, jobId: job.id, error: null } });
    return { capture, job };
  } catch (error) {
    await chrome.storage.session.set({ [key]: { ...pending, error: error.message } });
    throw error;
  }
}
async function captureAndGenerate(mode, platform) {
  const { capture } = await captureTab(mode, platform, false);
  return generateCaptured(capture, platform);
}
async function draftStatus(platform) {
  const key = sessionKey(platform), values = await chrome.storage.session.get(key), session = values[key];
  if (!session) return null;
  if (session.job?.state === "complete") return { capture: session.capture, job: session.job };
  if (!session.jobId) return { capture: session.capture, job: null, error: session.error };
  const job = await api("/jobs/" + encodeURIComponent(session.jobId));
  const current = (await chrome.storage.session.get(key))[key];
  if (current?.capture.id !== session.capture.id || current?.jobId !== session.jobId) return draftStatus(platform);
  if (job.state === "complete") await chrome.storage.session.set({ [key]: { ...session, job } });
  return { capture: session.capture, job };
}
async function regenerate(platform) {
  const key = sessionKey(platform), values = await chrome.storage.session.get(key), session = values[key];
  if (!session?.capture) throw new Error("Capture a job before generating.");
  return generateCaptured(session.capture, platform);
}
async function rememberDraft(jobId, captureId) {
  const job = await api("/jobs/" + encodeURIComponent(jobId));
  if (job.captureId !== captureId) throw new Error("This draft belongs to a different job.");
  const capture = await api("/captures/" + encodeURIComponent(captureId));
  const key = sessionKey(capture.platform);
  await chrome.storage.session.set({ [key]: { capture, jobId: job.id, error: null } });
  return { ok: true };
}
async function fillCommand(commandId) {
  const { command } = await api("/command?id=" + encodeURIComponent(commandId));
  if (!command) throw new Error("This fill request expired or was already handled. Review the form and request a new fill.");
  let result;
  try {
    const tab = await chrome.tabs.get(command.tabId);
    if (tab.url !== command.url) throw new Error("The source page changed. Capture the form again.");
    const [response] = await chrome.scripting.executeScript({ target: { tabId: command.tabId }, func: payload => window.ApplicationComposer.fill(payload), args: [command] });
    if (!response?.result) throw new Error("The page could not receive the draft. Capture it again.");
    result = response.result;
  } catch (error) { result = { filled: [], skipped: command.answers.map(a => ({ fieldId: a.fieldId, reason: "Not filled" })), error: error.message }; }
  await api("/result", { method: "POST", body: JSON.stringify({ commandId, ...result }) });
  return result;
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  let job;
  const ownPage = !sender.tab || sender.url?.startsWith(chrome.runtime.getURL(""));
  if (message?.action === "capture" && ownPage) job = captureTab(message.mode, message.platform);
  else if (message?.action === "capture-generate" && ownPage) job = captureAndGenerate(message.mode, message.platform);
  else if (message?.action === "draft-status" && ownPage) job = draftStatus(message.platform);
  else if (message?.action === "regenerate" && ownPage) job = regenerate(message.platform);
  else if (message?.action === "draft-session" && sender.tab?.url?.startsWith(base + "/") && typeof message.jobId === "string" && typeof message.captureId === "string") job = rememberDraft(message.jobId, message.captureId);
  else if (message?.action === "check" && ownPage) job = api("");
  else if (message?.action === "fill" && sender.tab?.url?.startsWith(base + "/") && typeof message.commandId === "string") job = fillCommand(message.commandId);
  else return;
  job.then(data => respond({ ok: true, data })).catch(error => respond({ ok: false, error: error.message || "Browser action failed." }));
  return true;
});
