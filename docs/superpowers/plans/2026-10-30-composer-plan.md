# Application Composer Implementation Plan

> For agentic workers: implement sequentially in this session; user requested setup and approved the described behavior.

**Goal:** A working local Next.js form-composition app with a Chrome/Edge companion and Codex CLI drafting.
**Architecture:** A localhost Next.js server holds persisted profile/history and capture/fill jobs. A paired MV3 extension uses activeTab to capture and fill reviewed answers. Codex is spawned with structured output and existing authentication.
**Tech Stack:** Next.js 16, React 19, TypeScript, Node.js, Manifest V3.
**Spec:** ../specs/2026-10-30-composer-design.md

## Global constraints
No automatic submission, broad website permissions, fabricated qualifications or API credentials in frontend bundles. Use the requested Desktop project directory. Profile comes from the supplied portfolio. Ordinary local operation uses internet for Codex.

## Review focus
- Untrusted job text cannot become a shell command, HTML or unrestricted tool instruction.
- A stale capture must not fill a different page or overwrite subsequent edits by default.
- Generated output must refer to captured fields and respect actual length limits.
- Local endpoints must reject unrelated website origins and require extension pairing.
- CLI failures and shutdowns must not leave an indefinite spinner or claim a successful draft.

## Tasks
1. [ ] Write failing contract tests, implement data validation, prompt and safe process arguments; run tests.
2. [ ] Implement localhost API, persistence, async drafting, pairing and browser handoff; exercise real requests.
3. [ ] Implement companion capture/fill and practice fixtures; test in a real browser, including no-submit and stale edits.
4. [ ] Implement responsive Next.js UI, saved profile, field review, history, connection setup and manual draft import; inspect screenshots.
5. [ ] Run typecheck, tests, production build and a fresh review; fix important findings. Provide launchers and installation instructions; report unverified live-site/CLI limitations precisely.
