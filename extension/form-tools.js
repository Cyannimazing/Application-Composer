(() => {
  if (window.ApplicationComposer?.version === 2) return;
  let current = null;
  const protectedWords = /password|credit.?card|card.?number|\bcvv\b|\bcvc\b|one.?time.?password|verification.?code|secret.?key|captcha|\botp\b/i;
  const allowed = new Set(["text", "email", "url", "tel", "number", "search"]);
  function visible(el) { const style = getComputedStyle(el); return style.display !== "none" && style.visibility !== "hidden" && el.getClientRects().length > 0 && !el.closest('[hidden],[aria-hidden="true"],[inert]'); }
  function label(el) {
    const labelled = (el.getAttribute("aria-labelledby") || "").split(/\s+/).map(id => document.getElementById(id)?.textContent || "").join(" ").trim();
    const explicit = Array.from(el.labels || []).map(l => l.textContent.trim()).join(" ");
    const wrapping = el.closest("label");
    let wrapped = "";
    if (wrapping) { const clone = wrapping.cloneNode(true); clone.querySelectorAll("input,textarea,select,button").forEach(n => n.remove()); wrapped = clone.textContent.trim(); }
    return (labelled || el.getAttribute("aria-label") || explicit || wrapped || el.getAttribute("placeholder") || el.getAttribute("name") || el.id || "Unlabelled field").replace(/\s+/g, " ").trim().slice(0, 1000);
  }
  function type(el) { if (el.matches("[data-composer-select]")) return "select"; if (el.matches("textarea")) return "textarea"; if (el.matches("select")) return "select"; if (el.isContentEditable) return "contenteditable"; return (el.getAttribute("type") || "text").toLowerCase(); }
  function value(el) { return el.matches("[data-composer-select]") ? el.dataset.value || "" : el.isContentEditable ? el.innerText : el.value; }
  function options(el) { return el.matches("[data-composer-select]") ? Array.from(el.querySelectorAll('[role="option"]')).map(o => ({ value: o.dataset.value, label: o.textContent.trim(), disabled: o.getAttribute("aria-disabled") === "true" })) : Array.from(el.options || []).map(o => ({ value: o.value, label: o.textContent.trim(), disabled: o.disabled })); }
  function supported(el) {
    const t = type(el);
    if (!(allowed.has(t) || ["textarea", "select", "contenteditable"].includes(t))) return false;
    if (el.disabled || el.readOnly || el.getAttribute("aria-disabled") === "true" || !visible(el) || (el.multiple && t === "select")) return false;
    const descriptor = [label(el), el.name, el.id, el.getAttribute("autocomplete")].join(" ");
    if (protectedWords.test(descriptor) || /\bcc-|current-password|new-password|one-time-code/.test(descriptor)) return false;
    if (el.closest('[role="search"],nav,header')) return false;
    return true;
  }
  function elements() {
    const found = [];
    const visit = root => { root.querySelectorAll('input,textarea,select,[data-composer-select],[contenteditable="true"],[contenteditable="plaintext-only"]').forEach(el => { if (supported(el) && !found.some(parent => parent.contains(el))) found.push(el); }); root.querySelectorAll("*").forEach(el => { if (el.shadowRoot) visit(el.shadowRoot); }); };
    visit(document);
    return found.slice(0, 100);
  }
  function pageDetails() {
    const description = Array.from(document.querySelectorAll('#job-description,[itemprop="description"],[data-test="description"],[data-test="job-description"],[data-test="job-details-description"],[data-testid="job-description"],.job-description')).find(visible);
    const root = description || document.querySelector("main,[role=main],article") || document.body;
    const parts = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement;
      if (!parent || !visible(parent) || parent.closest('input,textarea,select,button,script,style,noscript,nav,footer,header,[contenteditable],[role="search"]')) continue;
      const text = walker.currentNode.textContent.replace(/\s+/g, " ").trim();
      if (text) parts.push(text);
    }
    const heading = Array.from(document.querySelectorAll("main h1,[role=main] h1,article h1,h1")).find(visible);
    return { title: (heading?.textContent || document.title || "Job application").trim().slice(0, 1000), context: parts.join("\n").slice(0, 30000) };
  }
  function capture(id) {
    if (!id || typeof id !== "string") throw new Error("A capture id is required.");
    const map = new Map();
    const fields = elements().map((el, index) => {
      const fieldId = `${id}-f${index + 1}`;
      const field = { id: fieldId, label: label(el), type: type(el), value: String(value(el) || "").slice(0, 30000), required: Boolean(el.required || el.getAttribute("aria-required") === "true"), maxLength: el.maxLength > 0 ? Math.min(el.maxLength, 30000) : 30000, options: type(el) === "select" ? options(el).filter(o => !o.disabled).map(o => ({ value: o.value, label: o.label })).slice(0, 300) : [] };
      map.set(fieldId, { el, field, original: value(el) || "" });
      return field;
    });
    const details = pageDetails();
    const snapshot = { id, url: location.href, ...details, fields, capturedAt: new Date().toISOString(), tabId: -1 };
    current = { ...snapshot, map };
    return snapshot;
  }
  function fill(command) {
    if (!current || command.captureId !== current.id || command.url !== location.href || current.url !== location.href) throw new Error("The captured page changed. Capture the form again before filling.");
    const filled = [], skipped = [], seen = new Set();
    if (!Array.isArray(command.answers) || command.answers.length > 100) throw new Error("Invalid answer list.");
    for (const answer of command.answers) {
      const target = current.map.get(answer.fieldId);
      const skip = reason => skipped.push({ fieldId: String(answer.fieldId), reason });
      if (!target || seen.has(answer.fieldId)) { skip("Field is no longer available."); continue; }
      seen.add(answer.fieldId);
      const { el, field } = target;
      if (!el.isConnected || !supported(el) || label(el) !== field.label || type(el) !== field.type) { skip("The field changed. Recapture the form."); continue; }
      if (!command.overwrite && (value(el) || "") !== target.original) { skip("You changed this field after capture. Your edit was kept."); continue; }
      if (typeof answer.value !== "string" || answer.value.length > Math.min(field.maxLength, el.maxLength > 0 ? el.maxLength : 30000)) { skip("Answer is over the field's character limit."); continue; }
      if (field.type === "select" && !options(el).some(o => o.value === answer.value && !o.disabled)) { skip("This option is no longer available."); continue; }
      if (el.matches("[data-composer-select]")) el.dispatchEvent(new CustomEvent("application-composer-set", { detail: answer.value, bubbles: false }));
      else if (field.type === "contenteditable") el.textContent = answer.value;
      else {
        const prototype = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : el.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, "value").set.call(el, answer.value);
      }
      el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      if (String(value(el)) !== answer.value) { skip("The website did not accept this value. Enter it manually."); continue; }
      target.original = answer.value;
      filled.push(field.id);
    }
    return { filled, skipped };
  }
  window.ApplicationComposer = { version: 2, capture, fill };
})();
