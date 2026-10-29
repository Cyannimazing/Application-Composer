const base = "http://127.0.0.1:32187";
async function api(route, options = {}) {
  const { pairingKey } = await chrome.storage.local.get("pairingKey");
  if (!pairingKey) throw new Error("Pair the companion first. Copy the key from Browser setup in Application Composer.");
  let response;
  try { response = await fetch(base + "/api/bridge" + route, { ...options, headers: { "Content-Type": "application/json", "X-Composer-Key": pairingKey }, signal: AbortSignal.timeout(10000) }); }
  catch { throw new Error("Application Composer is not reachable. Start the local app and try again."); }
  const data = await response.json(); if (!response.ok) throw new Error(data.error || "Browser connection failed."); return data;
}
async function captureTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https?:\/\//.test(tab.url || "")) throw new Error("Open a regular website application form before capturing.");
  if ((tab.url || "").startsWith(base)) throw new Error("Capture from the website's application tab, not the Composer tab. For a test, open the practice form.");
  await api("");
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["form-tools.js"] });
  const id = crypto.randomUUID();
  const [result] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: captureId => window.ApplicationComposer.capture(captureId), args: [id] });
  if (!result?.result?.fields?.length) throw new Error("No supported editable fields were found. Open the application form, then capture again. Frames or custom controls may need manual input.");
  const capture = { ...result.result, tabId: tab.id };
  await api("/capture", { method: "POST", body: JSON.stringify(capture) });
  await chrome.storage.session.set({ lastCapture: capture });
  const tabs = await chrome.tabs.query({ url: base + "/*" });
  if (tabs.length) await chrome.tabs.update(tabs[0].id, { active: true });
  else await chrome.tabs.create({ url: base });
  return { count: capture.fields.length };
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
  if (message?.action === "capture" && ownPage) job = captureTab();
  else if (message?.action === "check" && ownPage) job = api("");
  else if (message?.action === "fill" && sender.tab?.url?.startsWith(base + "/") && typeof message.commandId === "string") job = fillCommand(message.commandId);
  else return;
  job.then(data => respond({ ok: true, data })).catch(error => respond({ ok: false, error: error.message || "Browser action failed." }));
  return true;
});
