const status = document.getElementById("status");
const capture = document.getElementById("capture");
const save = document.getElementById("save");
const key = document.getElementById("key");
const { pairingKey } = await chrome.storage.local.get("pairingKey");
if (!pairingKey) document.getElementById("pairing").open = true;
else key.value = pairingKey;
async function act(button, fn) { button.disabled = true; status.textContent = "Connecting…"; try { await fn(); } catch (error) { status.textContent = error.message; } finally { button.disabled = false; } }
capture.addEventListener("click", () => act(capture, async () => { const result = await chrome.runtime.sendMessage({ action: "capture" }); if (!result?.ok) throw new Error(result?.error || "The companion did not respond. Reload it from your browser extensions page and try again."); status.textContent = `${result.data.count} fields captured. Review them in Application Composer.`; }));
save.addEventListener("click", () => act(save, async () => { const value = key.value.trim(); if (!/^[a-f0-9]{64}$/.test(value)) throw new Error("Copy the full pairing key from Browser setup."); await chrome.storage.local.set({ pairingKey: value }); const result = await chrome.runtime.sendMessage({ action: "check" }); if (!result?.ok) throw new Error(result?.error || "The companion did not respond. Reload it from your browser extensions page and try again."); status.textContent = "Connected. Open a website form and click Capture this form."; document.getElementById("pairing").open = false; }));
