(() => {
  const origin = "http://127.0.0.1:32187";
  if (location.origin !== origin) return;
  const announce = () => window.postMessage({ source: "application-composer-companion", action: "ready" }, origin);
  window.addEventListener("message", event => {
    if (event.source !== window || event.origin !== origin || event.data?.source !== "application-composer-app") return;
    if (event.data.action === "ping") announce();
    if (event.data.action === "draft-session" && typeof event.data.jobId === "string" && typeof event.data.captureId === "string") {
      chrome.runtime.sendMessage({ action: "draft-session", jobId: event.data.jobId, captureId: event.data.captureId }).catch(() => {});
    }
    if (event.data.action === "fill" && typeof event.data.commandId === "string") {
      chrome.runtime.sendMessage({ action: "fill", commandId: event.data.commandId }).then(result => window.postMessage({ source: "application-composer-companion", action: "result", commandId: event.data.commandId, ...result }, origin)).catch(() => window.postMessage({ source: "application-composer-companion", action: "result", ok: false, error: "Reload the Composer tab after reloading the extension." }, origin));
    }
  });
  announce();
  const query = new URLSearchParams(location.search);
  if (location.pathname === "/api/desktop/bridge") {
    const valid = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value);
    const action = query.get("operation");
    const input = action === "fill" && valid(query.get("commandId")) ? { action, commandId: query.get("commandId") } : action === "draft-session" && valid(query.get("jobId")) && valid(query.get("captureId")) ? { action, jobId: query.get("jobId"), captureId: query.get("captureId") } : null;
    if (input) chrome.runtime.sendMessage({ ...input, closeDesktopBridge: true }).catch(() => {});
  }
})();
