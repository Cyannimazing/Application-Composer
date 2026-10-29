(() => {
  if (window.ApplicationComposer?.version === 3) return;
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
  const descriptionSelector = '#job-description,[itemprop="description" i],[data-test="description" i],[data-test="job-description" i],[data-test="job-details-description" i],[data-testid="job-description" i],.job-description';
  const genericTitle = /^(?:submit a proposal|proposal settings|job details|job overview|job description|description|terms|scope(?: and working arrangement)?|what success looks like|please include in your application|skills(?: and expertise)?|requirements|responsibilities|qualifications|search(?: freelance)? jobs|find work|apply(?: for this job)?|about (?:the client|this job))$/i;
  function readableText(root) {
    const parts = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode, parent = node.parentElement;
      const text = node.textContent.replace(/\s+/g, " ").trim();
      if (!text || !parent || parent.closest('input,textarea,select,button,script,style,noscript,nav,footer,header,[contenteditable],[role="search"],[hidden],[aria-hidden="true"],[inert]')) continue;
      const style = getComputedStyle(parent);
      if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse") continue;
      // Text ranges still have layout when an ancestor uses display:contents.
      const range = document.createRange(); range.selectNode(node);
      if (!range.getClientRects().length) continue;
      parts.push(text);
    }
    return parts.join("\n").slice(0, 30000);
  }
  function jobSection(root) {
    for (const heading of root.querySelectorAll('h1,h2,h3,h4,h5,[role="heading"],strong')) {
      if (!/^(?:job details|job overview|job description)$/i.test(heading.textContent.trim()) || !visible(heading)) continue;
      const section = heading.closest('section,article,[role="region"],.air3-card,.card');
      if (section && root.contains(section) && readableText(section).length > 40) return section;
      for (let parent = heading.parentElement; parent && root.contains(parent) && !parent.matches("main,[role=main],body"); parent = parent.parentElement) {
        if (readableText(parent).length > heading.textContent.trim().length + 40) return parent;
      }
    }
    return null;
  }
  function jobTitle(root) {
    const candidates = [
      ...root.querySelectorAll('[data-test="job-title" i],[data-testid="job-title" i],[itemprop="title"]'),
      ...root.querySelectorAll('a[href*="/jobs/"]'),
      ...root.querySelectorAll('h1,h2,h3,h4,[role="heading"]')
    ];
    const heading = candidates.find(el => visible(el) && !el.closest('nav,footer,[role="search"]') && el.textContent.trim() && !genericTitle.test(el.textContent.trim()));
    return heading?.textContent.replace(/\s+/g, " ").trim().slice(0, 1000);
  }
  function pageDetails() {
    const overlays = Array.from(document.querySelectorAll('dialog[open],[role="dialog"],[aria-modal="true"],.air3-slider-content,.air3-slider')).reverse();
    const roots = [...overlays, ...document.querySelectorAll("main,[role=main],article"), document.body];
    for (const candidate of roots) {
      const section = jobSection(candidate);
      const description = Array.from(candidate.querySelectorAll(descriptionSelector)).find(el => readableText(el).trim());
      const overlay = overlays.includes(candidate);
      if (overlay && !section && !description && !candidate.querySelector('[data-test="job-title" i],[data-testid="job-title" i],a[href*="/jobs/"]')) continue;
      const root = section || (overlay ? candidate : description || candidate);
      const context = readableText(root).trim();
      if (!context) continue;
      const titleScope = overlay ? candidate.closest('dialog,[role="dialog"],[aria-modal="true"],.air3-slider') || candidate : candidate;
      const title = jobTitle(section || candidate) || jobTitle(titleScope) || (!overlay && jobTitle(document)) || document.title || "Job application";
      return { title: title.trim().slice(0, 1000), context };
    }
    return { title: document.title || "Job application", context: "" };
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
  window.ApplicationComposer = { version: 3, capture, fill };
})();
