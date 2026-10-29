"use client";
import { useState } from "react";
import { ArrowRight, Check, CircleHelp, Copy, ExternalLink, FileText, LoaderCircle, PencilLine, RefreshCw, Terminal, X } from "lucide-react";
import type { CliStatus, Provider } from "@/lib/providers";

const choices = [
  { id: "codex" as const, name: "Codex CLI", account: "ChatGPT", description: "Use your existing ChatGPT / Codex sign-in." },
  { id: "claude" as const, name: "Claude CLI", account: "Anthropic", description: "Use your existing Claude Code sign-in." },
];
export default function ProviderGate({ current, onContinue, onCancel }: { current: Provider | null; onContinue: (provider: Provider) => void; onCancel?: () => void }) {
  const [selected, setSelected] = useState<Provider>(current || "codex");
  const [result, setResult] = useState<CliStatus | null>(null), [checking, setChecking] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState("");
  async function check() {
    setChecking(true); setError(""); setResult(null);
    try { const response = await fetch("/api/providers/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: selected }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setResult(data); }
    catch (error) { setError((error as Error).message); } finally { setChecking(false); }
  }
  async function proceed() {
    setSaving(true); setError("");
    try { const response = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: selected }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); onContinue(selected); }
    catch (error) { setError((error as Error).message); } finally { setSaving(false); }
  }
  return <main className="onboarding"><div className="onboarding-brand"><FileText size={21} strokeWidth={1.5} /><span>Application Composer</span></div><section className="onboarding-content"><div className="onboarding-title"><div><h1>Choose your drafting CLI</h1><p>Connect an installed CLI. Your profile and projects are already here.</p></div>{onCancel && <button className="icon-button" aria-label="Return to workspace" onClick={onCancel}><X size={18} /></button>}</div>
    <div className="provider-choices" role="radiogroup" aria-label="Drafting CLI">{choices.map(choice => <button key={choice.id} role="radio" aria-checked={selected === choice.id} className={`provider-choice ${selected === choice.id ? "chosen" : ""}`} onClick={() => { setSelected(choice.id); setResult(null); setError(""); }} disabled={checking || saving}><div><Terminal size={19} /><span className="provider-radio">{selected === choice.id && <span />}</span></div><h2>{choice.name} <small>{choice.account}</small></h2><p>{choice.description}</p></button>)}</div>
    <div className="panel provider-check"><div className="provider-check-heading"><h2>Check your connection</h2><button className="button secondary" onClick={check} disabled={checking || saving}>{checking ? <LoaderCircle size={15} className="spin" /> : result ? <RefreshCw size={15} /> : <Terminal size={15} />}{checking ? "Verifying…" : result ? "Check again" : "Verify selected CLI"}</button></div>
      {!result && !checking && <p>We’ll check that the CLI is installed, then verify its saved sign-in. If it needs attention, you’ll get the next step here.</p>}
      {checking && <p className="provider-checking">Looking for {selected === "codex" ? "Codex" : "Claude"} and checking authentication…</p>}
      {result && <><div className="provider-check-row"><span>Installation</span><span className={result.available ? "check-good" : "check-missing"}>{result.available ? <Check size={15} /> : <CircleHelp size={15} />}{result.available ? result.version : "Not detected"}</span></div><div className="provider-check-row"><span>Sign-in</span><span className={result.loggedIn ? "check-good" : "check-missing"}>{result.loggedIn ? <Check size={15} /> : <CircleHelp size={15} />}{result.loggedIn ? "Signed in" : result.available ? "Login needed" : "Waiting for installation"}</span></div><p className="provider-detail">{result.detail}</p>{result.solution && <div className="provider-solution"><h3>Here’s the next step</h3><p>{result.solution}</p>{result.command && <div className="command-row"><code>{result.command}</code><button className="icon-button" aria-label="Copy setup command" onClick={() => navigator.clipboard.writeText(result.command!).catch(() => setError("Select and copy the setup command manually."))}><Copy size={15} /></button></div>}<p className="provider-login-hint">{result.available ? "After signing in, choose Check again." : <>After installing, run <code>{selected === "codex" ? "codex login" : "claude auth login"}</code>, restart this app, and check again.</>}</p><a href={result.docs} target="_blank" rel="noreferrer">Official setup instructions <ExternalLink size={12} /></a></div>}</>}
    </div>{error && <div className="notice notice-error" role="alert">{error}</div>}<div className="onboarding-footer"><span>Both CLIs use the same saved profile.<br />Internet is required for drafting and review.</span><button className="button primary" disabled={!result?.available || !result.loggedIn || checking || saving} onClick={proceed}>{saving ? <LoaderCircle size={15} className="spin" /> : null}Continue to workspace <ArrowRight size={15} /></button></div><div className="onboarding-note"><PencilLine size={14} /> Your selected CLI drafts and reviews. You decide what gets sent.</div>
  </section></main>;
}
