"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowRight, BriefcaseBusiness, Check, CheckCheck, ChevronDown, CircleHelp, Clipboard, Copy, ExternalLink, FileText, Globe2, History, LayoutPanelLeft, Link2, LoaderCircle, Monitor, PencilLine, Plus, Settings2, ShieldCheck, Sparkles, UserRound, X } from "lucide-react";
import { emptyProfile, type Answer, type Capture, type Draft, type Profile, type Review } from "@/lib/contracts";
import type { FillResult, HistoryEntry } from "@/lib/store";
import { ProfileView, SetupView, HistoryView } from "./workspace-views";
import SelectMenu from "./select-menu";
import { platforms, detectPlatform, templateCapture, personalAnswers, type Platform } from "@/lib/platforms";
import ProviderGate from "./provider-gate";
import type { Provider } from "@/lib/providers";

declare global { interface Window { ApplicationComposer?: { capture(id: string): Capture; fill(command: unknown): { filled: string[]; skipped: { fieldId: string; reason: string }[] } } } }
type View = "compose" | "profile" | "history" | "setup";
type Workspace = { capture: Capture; draft: Draft; selected: string[]; manual: boolean; title: string; context: string; questions: string };
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch("/api/" + path, { cache: "no-store", ...(body === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || "The request failed. Try again."); return data;
}
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function platform(capture: Capture | null) { if (!capture) return "No page captured"; if (capture.practice) return "Practice form"; if (capture.manual) return "Manual entry"; const hostname = new URL(capture.url).hostname; return hostname.endsWith("upwork.com") ? "Upwork" : hostname.endsWith("onlinejobs.ph") ? "OnlineJobs.ph" : hostname; }

export default function Composer() {
  const [provider, setProvider] = useState<Provider | null>(null);
  const [providerScreen, setProviderScreen] = useState<"loading" | "choose" | "ready">("loading");
  const [activePlatform, setActivePlatform] = useState<Platform>("onlinejobs");
  const activePlatformRef = useRef<Platform>("onlinejobs");
  const workspaces = useRef<Partial<Record<Platform, Workspace>>>({});
  const initialized = useRef(false);
  const [view, setView] = useState<View>("compose");
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const profileRef = useRef<Profile>(emptyProfile);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [capture, setCapture] = useState<Capture | null>(null);
  const captureRef = useRef<Capture | null>(null);
  const serverCaptureRef = useRef<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<string[]>([]);
  const [review, setReview] = useState<Review | undefined>();
  const [reviewDirty, setReviewDirty] = useState(false);
  const [generationStage, setGenerationStage] = useState("drafting");
  const [busy, setBusy] = useState(false);
  const [fillPending, setFillPending] = useState(false);
  const pendingRef = useRef<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [manual, setManual] = useState(true);
  const [manualTitle, setManualTitle] = useState("");
  const [manualContext, setManualContext] = useState("");
  const [manualQuestions, setManualQuestions] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [showPractice, setShowPractice] = useState(false);
  const [paste, setPaste] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [pasteField, setPasteField] = useState("");
  const [cli, setCli] = useState<{ available: boolean; loggedIn: boolean; version: string; detail: string } | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const iframe = useRef<HTMLIFrameElement>(null);
  const notify = useCallback((text: string, error = false) => setNotice({ text, error }), []);
  const loadCapture = useCallback((next: Capture, draft?: Draft) => {
    captureRef.current = next; setCapture(next);
    const initialAnswers = draft?.answers || personalAnswers(next, profileRef.current);
    setAnswers(initialAnswers);
    setSelected(new Set(initialAnswers.filter(a => a.value && !a.needsInput).map(a => a.fieldId)));
    setNotes(draft?.notes || []); setReview(draft?.review); setReviewDirty(false); setManual(Boolean(next.manual)); setManualTitle(next.manual && !platforms.some(p => p.title === next.title) ? next.title : ""); setManualContext(next.context); setPaste(false); setOverwrite(false);
    setShowPractice(Boolean(next.practice));
  }, []);
  function switchPlatform(next: Platform, initial = false) {
    if (!initial && captureRef.current && !captureRef.current.practice) workspaces.current[activePlatformRef.current] = { capture: captureRef.current, draft: { answers, notes, review }, selected: [...selected], manual, title: manualTitle, context: manualContext, questions: manualQuestions };
    activePlatformRef.current = next; setActivePlatform(next); setView("compose"); setMobileNav(false); setNotice(null);
    const saved = workspaces.current[next];
    if (saved) { loadCapture(saved.capture, saved.draft); setSelected(new Set(saved.selected)); setManual(Boolean(saved.capture.manual || saved.manual)); setManualTitle(saved.title); setManualContext(saved.context || saved.capture.context); setManualQuestions(saved.questions); }
    else { const template = templateCapture(next); loadCapture(template, { answers: personalAnswers(template, profile), notes: [] }); setManual(true); setManualTitle(""); setManualContext(""); setManualQuestions(""); }
    history.replaceState(null, "", "?platform=" + next);
  }
  useEffect(() => {
    api<{ provider: Provider | null }>("settings").then(data => { setProvider(data.provider); setProviderScreen(data.provider ? "ready" : "choose"); }).catch(() => setProviderScreen("choose"));
    let previous: Partial<Record<Platform, Workspace>> = {};
    try { previous = JSON.parse(localStorage.getItem("composer-workspaces-v1") || "{}"); } catch {}
    for (const key of ["onlinejobs", "upwork", "other"] as const) {
      const saved = previous[key];
      if (!saved) continue;
      const url = new URL(saved.capture.url);
      // Practice captures belong to the current test session, never a saved application.
      if (saved.capture.practice || url.origin === "http://127.0.0.1:32188" || url.pathname === "/practice-form.html") { delete previous[key]; continue; }
      // Older manual templates were saved with the capture layout active.
      if (url.origin === location.origin && url.pathname.endsWith("/manual")) saved.capture.manual = true;
    }
    workspaces.current = previous;
    const query = new URLSearchParams(location.search).get("platform");
    const first: Platform = query === "upwork" || query === "other" ? query : "onlinejobs";
    if (!initialized.current) { switchPlatform(first, true); initialized.current = true; }
    api<Profile>("profile").then(data => {
      profileRef.current = data; setProfile(data); setProfileLoaded(true);
      setAnswers(current => { const defaults = captureRef.current ? personalAnswers(captureRef.current, data) : []; return current.map(answer => answer.value ? answer : defaults.find(value => value.fieldId === answer.fieldId) || answer); });
    }).catch(e => { setProfileError(e.message); notify(e.message, true); });
    api<NonNullable<typeof cli>>("health").then(setCli).catch(() => {});
    const receive = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== location.origin || event.data?.source !== "application-composer-companion") return;
      if (event.data.action === "ready") setConnected(true);
      if (event.data.action === "result" && !event.data.ok) { setFillPending(false); pendingRef.current = null; notify(event.data.error || "The browser could not fill this form. Recapture and retry.", true); }
    };
    window.addEventListener("message", receive);
    window.postMessage({ source: "application-composer-app", action: "ping" }, location.origin);
    const announce = setTimeout(() => window.postMessage({ source: "application-composer-app", action: "ping" }, location.origin), 1500);
    let alive = true;
    const poll = async () => {
      try {
        const state = await api<{ capture: Capture | null; fillResult: FillResult | null }>("state");
        if (!alive) return;
        if (captureRef.current?.url.startsWith("http://127.0.0.1:32188/") && !state.capture) { const fresh = templateCapture(activePlatformRef.current); loadCapture(fresh); }
        if (state.capture && state.capture.id !== serverCaptureRef.current) {
          serverCaptureRef.current = state.capture.id;
          if (state.capture.id !== captureRef.current?.id && !state.capture.manual && !state.capture.practice && (detectPlatform(state.capture) === activePlatformRef.current || Date.now() - Date.parse(state.capture.capturedAt) < 30000)) {
            const next = state.capture.practice ? activePlatformRef.current : detectPlatform(state.capture);
            activePlatformRef.current = next; setActivePlatform(next); setView("compose");
            loadCapture(state.capture); history.replaceState(null, "", "?platform=" + next);
          }
        }
        if (state.fillResult && state.fillResult.commandId === pendingRef.current) {
          pendingRef.current = null; setFillPending(false);
          const result = state.fillResult;
          notify(result.error || `${result.filled.length} ${result.filled.length === 1 ? "field" : "fields"} filled. ${result.skipped.length ? `${result.skipped.length} skipped to preserve your changes. ` : ""}Review the website before you send.`, Boolean(result.error));
          if (result.skipped.length) setNotes(result.skipped.map(s => `${captureRef.current?.fields.find(f => f.id === s.fieldId)?.label || "Field"}: ${s.reason}`));
        }
      } catch { /* Do not replace an in-progress draft while the development server restarts. */ }
    };
    void poll(); const interval = setInterval(poll, 1800);
    return () => { alive = false; clearTimeout(announce); clearInterval(interval); window.removeEventListener("message", receive); };
  }, [loadCapture, notify]);
  useEffect(() => {
    if (!initialized.current || !capture || capture.practice || activePlatformRef.current !== activePlatform) return;
    const timer = setTimeout(() => {
      workspaces.current[activePlatform] = { capture, draft: { answers, notes, review }, selected: [...selected], manual, title: manualTitle, context: manualContext, questions: manualQuestions };
      try { localStorage.setItem("composer-workspaces-v1", JSON.stringify(workspaces.current)); } catch {}
    }, 350);
    return () => clearTimeout(timer);
  }, [activePlatform, capture, answers, notes, review, selected, manual, manualTitle, manualContext, manualQuestions]);
  function navigate(next: View) { setView(next); setMobileNav(false); setNotice(null); }
  async function generate(reviewOnly = false) {
    if (!capture) return; const source = capture;
    if (!source.context.trim()) { notify("Add this job's details and choose Prepare application first.", true); return; }
    setBusy(true); setGenerationStage(reviewOnly ? "reviewing" : "drafting"); setNotice(null);
    try {
      const job = await api<{ id: string }>(reviewOnly ? "review" : "generate", { capture: source, ...(reviewOnly ? { draft: { answers, notes } } : {}) });
      const deadline = Date.now() + 500000;
      while (Date.now() < deadline) {
        await wait(1800);
        const status = await api<{ state: string; stage?: string; draft?: Draft; error?: string }>("jobs/" + job.id);
        if (status.stage) setGenerationStage(status.stage);
        if (status.state === "failed") throw new Error(status.error || "Draft generation failed. Try again.");
        if (status.state === "complete" && status.draft) {
          if (captureRef.current?.id === source.id) { setAnswers(status.draft.answers); setNotes(status.draft.notes); setReview(status.draft.review); setReviewDirty(false); setSelected(new Set(status.draft.answers.filter(a => a.value && !a.needsInput).map(a => a.fieldId))); notify(status.draft.review?.eligibility === "skip" ? "Review found a hard requirement that does not match your experience. This application is marked to skip." : "Application reviewed. Check the wording and selected fields before filling."); }
          else notify("Your draft was saved to history for the previous form.");
          return;
        }
      }
      throw new Error("Drafting timed out. Check Codex and try again.");
    } catch (error) { notify((error as Error).message, true); } finally { setBusy(false); }
  }
  async function practiceCapture() {
    try {
      const frame = iframe.current;
      if (!frame?.contentWindow?.ApplicationComposer) throw new Error("The practice form is loading. Try again in a moment.");
      const raw = frame.contentWindow.ApplicationComposer.capture(crypto.randomUUID());
      if (capture && !capture.practice) {
        workspaces.current[activePlatform] = { capture, draft: { answers, notes, review }, selected: [...selected], manual, title: manualTitle, context: manualContext, questions: manualQuestions };
        localStorage.setItem("composer-workspaces-v1", JSON.stringify(workspaces.current));
      }
      const result: Capture = { ...raw, practice: true, platform: activePlatform };
      loadCapture(result); notify(`${result.fields.length} practice fields captured. Generate a draft or type your own answers.`);
    } catch (error) { notify((error as Error).message, true); }
  }
  async function fill() {
    if (!capture) return;
    if (review?.eligibility === "skip") { notify(review.summary, true); return; }
    if (review && reviewDirty) { notify("Review the edited draft again before filling.", true); return; }
    const chosen = answers.filter(a => selected.has(a.fieldId) && a.value.trim());
    if (!chosen.length) { notify("Select at least one answer with text to fill.", true); return; }
    try {
      if (capture.practice) {
        const result = iframe.current?.contentWindow?.ApplicationComposer?.fill({ captureId: capture.id, url: capture.url, answers: chosen, overwrite });
        if (!result) throw new Error("Open the practice form and capture it again before filling.");
        notify(`${result.filled.length} practice fields filled. ${result.skipped.length ? `${result.skipped.length} skipped. ` : ""}No form was submitted.`);
        if (result.skipped.length) setNotes(result.skipped.map(s => s.reason));
        return;
      }
      if (capture.manual) { await navigator.clipboard.writeText(chosen.map(a => `${capture.fields.find(f => f.id === a.fieldId)?.label}\n${a.value}`).join("\n\n")); notify("Selected answers copied. Paste them into the website fields."); return; }
      if (!connected) throw new Error("Open this app in the Chrome/Edge profile with the companion installed, then reload this tab. See Browser setup.");
      setFillPending(true);
      const { commandId } = await api<{ commandId: string }>("fill", { captureId: capture.id, answers: chosen, overwrite });
      pendingRef.current = commandId;
      window.postMessage({ source: "application-composer-app", action: "fill", commandId }, location.origin);
      setTimeout(() => { if (pendingRef.current === commandId) { pendingRef.current = null; setFillPending(false); notify("The browser did not confirm the fill. Check the original form before trying again.", true); } }, 25000);
    } catch (error) { setFillPending(false); notify((error as Error).message, true); }
  }
  function editAnswer(id: string, value: string) { setReviewDirty(Boolean(review)); setAnswers(previous => previous.map(a => a.fieldId === id ? { ...a, value, needsInput: false } : a)); setSelected(previous => new Set(previous).add(id)); }
  async function copyAll() {
    if (!capture) return;
    const blocks = capture.fields.flatMap(field => {
      const value = answers.find(answer => answer.fieldId === field.id)?.value || "";
      if (!value.trim()) return [];
      const text = field.type === "select" ? field.options.find(option => option.value === value)?.label || value : value;
      return [`${field.label}\n${text}`];
    });
    try { await navigator.clipboard.writeText(blocks.join("\n\n")); notify("All filled answers copied. Paste them wherever you need."); }
    catch { notify("Copy was blocked. Select and copy the answer text manually.", true); }
  }
  async function saveDraft() { if (!capture) return; try { await api("history", { capture, draft: { answers, notes, review } }); notify("Draft saved on this computer."); } catch (error) { notify((error as Error).message, true); } }
  async function useManual() {
    try {
      if (!manualContext.trim()) throw new Error("Paste the job description first.");
      const result = await api<Capture>("capture", templateCapture(activePlatform, "", manualContext, manualTitle));
      const defaults = personalAnswers(result, profile);
      const preserved = result.fields.map(field => { const previous = capture?.fields.find(old => old.label === field.label); const answer = answers.find(a => a.fieldId === previous?.id); return answer?.value ? { ...answer, fieldId: field.id } : defaults.find(a => a.fieldId === field.id)!; });
      serverCaptureRef.current = result.id; loadCapture(result, { answers: preserved, notes: [] });
    } catch (error) { notify((error as Error).message, true); }
  }
  const wordCount = answers.reduce((count, a) => count + (a.value.trim() ? a.value.trim().split(/\s+/).length : 0), 0);
  const selectedCount = answers.filter(a => selected.has(a.fieldId) && a.value.trim()).length;
  const projectCount = (profile.experience.match(/^### \d+\./gm) || []).length;
  const platformInfo = platforms.find(p => p.id === activePlatform)!;
  const providerName = provider === "claude" ? "Claude" : "Codex";
  if (providerScreen === "loading") return <main className="onboarding"><div className="onboarding-brand"><FileText size={21} />Application Composer</div><div className="view-loading"><LoaderCircle size={20} className="spin" /> Checking your workspace…</div></main>;
  if (providerScreen === "choose") return <ProviderGate current={provider} onCancel={provider ? () => setProviderScreen("ready") : undefined} onContinue={selected => { setProvider(selected); setProviderScreen("ready"); api<NonNullable<typeof cli>>("health").then(setCli).catch(() => {}); }} />;
  return <div className="app-shell">
    <button className="mobile-menu icon-button" aria-label="Toggle navigation" onClick={() => setMobileNav(!mobileNav)}><LayoutPanelLeft size={20} /></button>
    <aside className={`sidebar ${mobileNav ? "mobile-open" : ""}`}>
      <div className="brand"><div className="brand-symbol"><FileText size={22} strokeWidth={1.5} /><PencilLine size={12} strokeWidth={1.8} /></div><span>Application<br /><strong>Composer</strong></span></div>
      <div className="workspace-label">Your workspace</div>
      <nav aria-label="Main navigation">
        <div className="nav-group-label">Job platforms</div>{platforms.map(item => <button key={item.id} disabled={busy} className={view === "compose" && activePlatform === item.id ? "nav-active" : ""} onClick={() => switchPlatform(item.id)}>{item.id === "other" ? <Globe2 size={17} /> : <BriefcaseBusiness size={17} />}{item.label}</button>)}<div className="nav-group-label nav-tools-label">Your materials</div>
        <button className={view === "history" ? "nav-active" : ""} onClick={() => navigate("history")}><History size={17} /> Saved drafts</button>
        <button className={view === "profile" ? "nav-active" : ""} onClick={() => navigate("profile")}><UserRound size={17} /> My profile</button>
      </nav>
      <div className="sidebar-bottom"><button className={`setup-nav ${view === "setup" ? "nav-active" : ""}`} onClick={() => navigate("setup")}><Settings2 size={17} /> Browser setup <span className={`connection-dot ${connected ? "online" : ""}`} /></button><div className="local-note"><Monitor size={15} /><span>Runs on your computer</span></div><button className="profile-summary" onClick={() => navigate("profile")}><span className="avatar">{profile.name ? profile.name.split(" ").map(n => n[0]).slice(0, 2).join("") : "You"}</span><span><strong>{profile.name.split(" ").slice(0, 2).join(" ") || "Your profile"}</strong><small>{profile.title || "Add your experience"}</small></span><ChevronDown size={14} /></button></div>
    </aside>
    <main className="main-content" data-ui="application-composer">
      <header className="page-header"><div><h1>{view === "compose" ? platformInfo.title : view === "profile" ? "Your experience, in one place" : view === "history" ? "Saved drafts" : "Connect your browser"}</h1><p>{view === "compose" ? platformInfo.description : view === "profile" ? "The source behind every answer. Keep it specific and up to date." : view === "history" ? "Pick up a previous application. Everything is saved locally." : "A small companion connects website forms to this workspace."}</p></div><div className="header-status">{view === "compose" && capture && <button className="text-button" disabled={busy} onClick={async () => { try { await api("reset", { captureId: capture?.id }); const next = templateCapture(activePlatform); loadCapture(next, { answers: personalAnswers(next, profile), notes: [] }); setManual(true); setManualTitle(""); setManualContext(""); setManualQuestions(""); setShowPractice(false); setNotice(null); } catch (error) { notify((error as Error).message, true); } }}><Plus size={14} /> New application</button>}<span className={`connection-dot ${cli?.loggedIn ? "online" : ""}`} />{cli === null ? `Checking ${providerName}…` : cli.loggedIn ? `${providerName} connected` : `${providerName} needs attention`}</div></header>
      {notice && <div className={`notice ${notice.error ? "notice-error" : ""}`} role={notice.error ? "alert" : "status"}><span>{notice.error ? <CircleHelp size={17} /> : <Check size={17} />}{notice.text}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setNotice(null)}><X size={15} /></button></div>}
      {view === "profile" && (profileLoaded ? <ProfileView profile={profile} onSave={async next => { const saved = await api<Profile>("profile", next); profileRef.current = saved; setProfile(saved); notify("Profile saved. Your next draft will use these details."); }} /> : <div className="view-loading">{profileError ? <><span>{profileError}</span><button className="button secondary" onClick={() => { setProfileError(""); api<Profile>("profile").then(data => { setProfile(data); setProfileLoaded(true); }).catch(e => setProfileError(e.message)); }}>Retry loading profile</button></> : <><LoaderCircle className="spin" size={18} /> Loading your saved profile…</>}</div>)}
      {view === "setup" && <SetupView connected={connected} onNotice={notify} onStatus={setCli} onChangeCli={() => setProviderScreen("choose")} />}
      {view === "history" && <HistoryView onOpen={entry => { switchPlatform(detectPlatform(entry.capture)); loadCapture(entry.capture, entry.draft); setView("compose"); notify("Saved draft opened. Recapture the live website form before filling it."); }} />}
      {view === "compose" && <>
        <div className="workflow-strip"><span className={capture ? "step-done" : "step-current"}><Monitor size={15} /> {capture?.manual ? "Add job details" : "Capture the form"}</span><ArrowRight size={14} /><span className={answers.some(a => a.value) ? "step-done" : capture ? "step-current" : ""}><PencilLine size={15} /> Draft & review</span><ArrowRight size={14} /><span><CheckCheck size={16} /> Fill, then send yourself</span></div>
        <div className="composer-grid">
          <section className="source-panel panel"><div className="panel-heading"><h2><FileText size={17} /> Job details</h2><span className={`small-status ${capture ? "captured" : ""}`}>{capture?.manual ? platformInfo.label : platform(capture)}</span></div>
            {manual ? <div className="source-body"><div className="section-title"><h3>What does this client need?</h3></div><label className="field-label" htmlFor="job-title">Job title</label><input id="job-title" value={manualTitle} onChange={e => setManualTitle(e.target.value)} placeholder="e.g. Next.js & Supabase developer" /><label className="field-label" htmlFor="job-description">Job description</label><textarea id="job-description" rows={10} value={manualContext} onChange={e => setManualContext(e.target.value)} placeholder="Include the requested stack, application directions and keywords." maxLength={30000} /><p className="input-hint job-paste-hint">Paste the full listing, including the client’s questions and required keywords. The application message will answer them.</p><button className="button primary full" onClick={useManual}>Prepare application <ArrowRight size={15} /></button></div>
              : capture ? <div className="source-body"><div className="source-title"><h3>{capture.title}</h3>{!capture.manual && !capture.practice && <a className="icon-button" href={capture.url} target="_blank" rel="noreferrer" aria-label="Open original website"><ExternalLink size={15} /></a>}</div><label className="field-label" htmlFor="job-context">Job context <span>Editable</span></label><textarea className="job-context" id="job-context" disabled={busy} rows={13} value={capture.context} maxLength={40000} onChange={e => { const next = { ...capture, context: e.target.value }; setCapture(next); captureRef.current = next; }} /><div className="source-caption">Add missing job details, instructions or required keywords here before drafting.</div><div className="detected-fields"><div><strong>{capture.fields.length}</strong> form fields detected</div><div className="field-tags">{capture.fields.slice(0, 6).map(f => <span key={f.id} title={f.label}>{f.label}</span>)}{capture.fields.length > 6 && <span>+{capture.fields.length - 6} more</span>}</div></div><button className="text-button" onClick={() => setManual(true)}><Plus size={15} /> Paste a different job</button></div>
                : <div className="source-body empty-source"><div className="form-illustration" aria-hidden="true"><div className="mini-form"><div /><span /><i /><span /><i /><i className="mini-area" /><em /></div><div className="mini-cursor"><ArrowDownToLine size={17} /></div></div><h3>Bring the form.<br />We’ll help with the words.</h3><p>Open a job application in your browser and capture its fields with the companion.</p><button className="button primary full" onClick={() => navigate("setup")}><Link2 size={16} /> Set up browser companion</button><button className="button secondary full" onClick={() => setManual(true)}><Clipboard size={16} /> Paste a job instead</button><div className="source-hint"><CircleHelp size={15} /> Capture the application page, where the editable fields are visible.</div></div>}
            <div className="source-profile"><span className="avatar small"><UserRound size={15} /></span><div><strong>{profile.name ? "Your profile is ready" : "Add your profile"}</strong><small>{projectCount ? `${projectCount} project references · CV context loaded` : "Experience and skills for better answers"}</small></div><button className="icon-button" aria-label="Edit your profile" onClick={() => navigate("profile")}><PencilLine size={15} /></button></div>
          </section>
          <section className="draft-panel panel"><div className="panel-heading"><h2><PencilLine size={17} /> {platformInfo.form}</h2><div className="heading-actions">{capture && answers.some(a => a.value) && <button className="text-button" disabled={busy} onClick={() => generate(true)}><ShieldCheck size={14} /> Review draft</button>}{capture && <button className="text-button" disabled={busy} onClick={() => { setPaste(!paste); setPasteField(capture.fields.find(f => f.type === "textarea" || f.type === "contenteditable")?.id || capture.fields[0]?.id || ""); }}><Clipboard size={14} /> Paste a draft</button>}</div></div>
            {!capture ? <div className="draft-empty"><div className="draft-preview" aria-hidden="true"><div>Hey there,</div><span /><span /><span className="short" /><div className="preview-signature"><span /> <Check size={16} /></div></div><h3>A thoughtful application<br />starts with the details.</h3><p>Capture a form or paste a job. Your selected CLI will match your experience to the client’s questions and requested stack.</p><button className="button secondary" onClick={() => { setShowPractice(true); setTimeout(() => document.getElementById("practice")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100); }}>Try the practice form <ArrowRight size={15} /></button><span className="quiet-note">No account actions. Nothing gets sent.</span></div>
              : <div className="answers-area">{review && <div className={`review-summary review-${review.eligibility}`}><div><ShieldCheck size={16} /><strong>{review.eligibility === "skip" ? "Skip: requirements not met" : reviewDirty ? "Edited after review" : review.eligibility === "needs_review" ? "Review: a detail needs attention" : "Reviewed for this job"}</strong></div><p>{review.summary}</p><span>{review.questionsCovered.length} client questions checked · {review.keywordsChecked.length} keywords checked</span>{review.warnings.length > 0 && <ul>{review.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}</div>}{paste && <div className="paste-draft"><h3>Use a draft you already have</h3><label className="field-label" htmlFor="paste-field">Target field</label><SelectMenu id="paste-field" value={pasteField} onChange={setPasteField} label="Target field" options={capture.fields.map(f => ({ value: f.id, label: f.label }))} /><textarea aria-label="Paste your application draft" rows={5} value={pastedText} onChange={e => setPastedText(e.target.value)} placeholder="Paste text from Codex, Dot, or your own draft." /><button className="button secondary" disabled={!pastedText.trim()} onClick={() => { editAnswer(pasteField, pastedText); setPaste(false); setPastedText(""); }}>Use this answer</button></div>}
                <div className="draft-toolbar"><span>{capture.fields.length} fields to review</span><div className="heading-actions"><button className="text-button" disabled={busy || !answers.some(answer => answer.value.trim())} onClick={copyAll}><Copy size={14} /> Copy all</button><button className="text-button" onClick={() => setSelected(selectedCount === answers.filter(a => a.value.trim()).length && selectedCount > 0 ? new Set() : new Set(answers.filter(a => a.value.trim()).map(a => a.fieldId)))}>{selectedCount > 0 ? "Change selection" : "Select filled answers"}</button></div></div>
                {capture.fields.map((field, i) => { const answer = answers.find(a => a.fieldId === field.id); const value = answer?.value || ""; return <article className={`answer-field ${selected.has(field.id) ? "answer-selected" : ""}`} key={field.id}><div className="answer-heading"><label><input type="checkbox" disabled={busy} checked={selected.has(field.id)} aria-label={`Select ${field.label}`} onChange={e => setSelected(prev => { const next = new Set(prev); if (e.target.checked) next.add(field.id); else next.delete(field.id); return next; })} /><span>{field.label}{field.required && <span className="required-mark" aria-label="required"> *</span>}</span></label><div className="field-actions">{answer?.needsInput && <span className="needs-input">Needs your input</span>}<button className="icon-button" disabled={!value} aria-label={`Copy ${field.label}`} onClick={() => navigator.clipboard.writeText(value).then(() => notify("Answer copied.")).catch(() => notify("Copy was blocked. Select and copy the answer text manually.", true))}><Copy size={14} /></button></div></div>
                  {field.type === "select" ? <SelectMenu label={`Answer for ${field.label}`} disabled={busy} value={value} onChange={next => editAnswer(field.id, next)} placeholder="Choose an answer" options={[{ value: "", label: "Leave unanswered" }, ...field.options.filter(o => o.value)]} /> : field.type !== "textarea" && field.type !== "contenteditable" ? <input aria-label={`Answer for ${field.label}`} disabled={busy} value={value} maxLength={field.maxLength} inputMode={field.type === "number" ? "decimal" : undefined} placeholder={field.type === "number" ? "Review the suggested value" : "Filled from your profile when available"} onChange={e => editAnswer(field.id, e.target.value)} /> : <textarea aria-label={`Answer for ${field.label}`} disabled={busy} value={value} maxLength={field.maxLength} rows={i === 0 ? 7 : 5} placeholder={busy ? "Your CLI is preparing this answer…" : "Generate a draft, paste one, or write your answer here."} onChange={e => editAnswer(field.id, e.target.value)} />}
                  <div className="answer-meta"><span title={answer?.reason}>{answer?.reason || (field.type === "number" ? "Set this value yourself before selecting it." : "Review before filling the website.")}</span><span>{value.length.toLocaleString()}{field.maxLength < 30000 ? ` / ${field.maxLength.toLocaleString()}` : " chars"}</span></div></article>; })}
                {notes.length > 0 && <div className="draft-notes"><h3><CircleHelp size={15} /> Notes for your review</h3><ul>{notes.map((note, i) => <li key={i}>{note}</li>)}</ul></div>}
              </div>}
            <div className="draft-footer"><div className="footer-summary"><span>{wordCount} words · {selectedCount} selected</span>{capture && <button className="text-button" onClick={saveDraft}><ArrowDownToLine size={14} /> Save draft</button>}</div><div className="primary-actions"><button className="button secondary" disabled={!capture || busy || !capture.context.trim()} onClick={() => generate(false)}>{busy ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}{busy ? generationStage === "reviewing" ? "Reviewing application…" : `Drafting with ${providerName}…` : answers.some(a => a.value) ? "Regenerate" : `Generate with ${providerName}`}</button><button className="button primary" disabled={!selectedCount || busy || fillPending || review?.eligibility === "skip" || Boolean(review && reviewDirty)} onClick={fill}>{fillPending ? <LoaderCircle size={16} className="spin" /> : <CheckCheck size={16} />}{capture?.manual ? "Copy selected answers" : capture?.practice ? "Fill practice form" : `Fill ${selectedCount || "selected"} ${selectedCount === 1 ? "field" : "fields"}`}</button></div>{capture && !capture.manual && <label className="overwrite-option"><input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} /> Replace fields I changed after capture</label>}<div className="submission-note"><ShieldCheck size={14} /> You review and click Send on the website.</div></div>
          </section>
        </div>
        {showPractice && <section className="practice-section panel" id="practice"><div className="panel-heading"><div><h2>Practice website form</h2><p>A local test page. It does not send applications.</p></div><div className="heading-actions"><button className="button secondary" onClick={practiceCapture}><Monitor size={15} /> Capture practice form</button><button className="icon-button" aria-label="Close practice form" onClick={() => { if (capture?.practice) switchPlatform(activePlatform); setShowPractice(false); }}><X size={17} /></button></div></div><iframe ref={iframe} title="Practice application form" src="/practice-form.html" className="practice-frame" /></section>}
        {!showPractice && capture && <button className="text-button practice-link" onClick={() => setShowPractice(true)}>Open the practice form <ArrowRight size={14} /></button>}
        <footer className="workspace-footer"><span>Local workspace · Existing CLI login</span><span>Capture only when you choose. Fill only what you review.</span></footer>
      </>}
    </main>
  </div>;
}
