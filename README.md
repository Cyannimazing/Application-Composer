# Application Composer

A personal, local workspace for preparing relevant job applications. Paste the complete job listing, let an installed **Codex CLI or Claude CLI** draft and independently review the answers, then review and copy them—or fill the real website form through the browser companion. You send the application yourself.

## Purpose

Reduce repetitive application writing without losing the details that matter to a client: their questions, requested technologies, exact application keywords, and relevant examples from the applicant's own projects.

The app has separate **OnlineJobs.ph**, **Upwork**, and **Other websites** views. All views share one saved personal profile while keeping separate working drafts. The default source panel is **Job title + Job description**. Paste the whole listing, including questions; there is no need to split questions into another input. A captured website form can supply actual separate answer fields when those exist.

Use **Copy all** above the answers to copy every filled answer in form order, with field labels and readable dropdown choices. Empty answers and internal review notes are excluded. The checkboxes control selective copying or filling; they do not limit Copy all. The optional practice form stays in its current test session and is not restored as a real application after refreshing.

The writing process has two independent CLI passes:

1. **Draft:** connect the client's requirements to relevant project work and answer the questions.
2. **Review:** check the questions, mandatory keywords, technology claims, contribution scope, rate policy and experience requirements. Correct the draft before displaying it as reviewed.

This personal setup records **less than one year of professional experience**. It must not claim 1+, 2+, 3+ or more years. A hard experience minimum the applicant does not meet is marked **Skip**. Ambiguous or preferred requirements are flagged for review. Internship wording is omitted from application messages; actual project contributions remain the source of claims.

## Requirements

- Node.js **22 or newer** and **pnpm 12.16.1** (pinned in package.json).
- **One** supported CLI installed and signed in:
  - [Codex CLI](https://learn.chatgpt.com/docs/codex-cli), using an existing ChatGPT/Codex login.
  - A current [Claude Code CLI](https://code.claude.com/docs/en/setup), using its own Claude login. The adapter requires support for `--safe-mode`, print mode and JSON Schema output.
- Internet access for AI generation. Local does not mean offline inference.
- Chrome or Edge for the optional browser companion.

No separate model API key or Ollama service is required by this application. Each CLI uses its own existing authentication and usage allowance.

## Run locally

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

Open **http://127.0.0.1:32187**. On Windows, you can also double-click **Start Application Composer.cmd**. Keep the server window open while using the app.

For a production build:

```powershell
pnpm build
pnpm start
```

The server binds to loopback. This is a local application, not a public deployment.

## First opening: choose and verify a CLI

1. Select **Codex CLI (ChatGPT)** or **Claude CLI (Anthropic)**.
2. Click **Verify selected CLI**. The app checks installation/version and saved authentication.
3. If it is missing or signed out, follow the proposed command and the linked official instructions. Restart the app after installing so the server sees the updated PATH.
4. Once verified, continue to the workspace. You can change engines later in **Browser setup → Change drafting CLI**.

Common commands:

```powershell
# Codex
npm install -g @openai/codex
codex login
codex login status

# Claude Code (the official setup page also offers native installers)
npm install -g @anthropic-ai/claude-code
claude auth login
claude auth status
```

Authentication verification is not a model-generation test. Your first actual draft verifies generation and review. Claude needs its own account; the ChatGPT login is not shared with it.

If the executable is in a custom location, set `COMPOSER_CODEX_PATH` or `COMPOSER_CLAUDE_PATH` in the server environment before launch. Native executables and standard npm installations are supported; Windows npm shims are resolved to their Node entry points without invoking a command shell.

## Personal profile and context

The current local installation is already populated with the supplied CV and source-backed project context from the applicant's Izee Work and Personal Work folders. Portfolio entries supply public project URLs only. The applicant confirms the implemented work-folder projects are their work. Name, email, links, timezone and availability do not need retyping for each application.

Drafts use normal hyphens (-), no semicolons in prose, and simple, direct English and cover the complete client brief: questions, technologies, deliverables, requested examples and URLs, keywords, rate, timeline, platform recommendations and ongoing costs. The CLI selects relevant actual work rather than inserting a fixed list of integrations. It follows the requested number of examples, including 3–5 websites when asked. Internal source paths and review notes are not part of the client message.

Client-stated rates take priority. For a range, suggest a lower-middle rate, about 40% of the way from the minimum to maximum (for example, USD 24/hour for USD 20-30/hour). Use a single stated hourly rate as given. When no client rate is listed, use **USD 10/hour** by default with a **USD 8-10/hour** fallback range. Respect stated monthly and fixed-price budgets. If a monthly salary must be derived, use actual weekly hours and 52/12 weeks per month, with assumptions in applicant-only notes. Fixed-price assumptions belong in the applicant-only review notes. For normally scoped web projects, the saved agile timeline is 1-2 weeks: about 2 days of mockups, about 1 week for the MVP, with the rest for testing, revisions and client feedback. Adjust for the actual scope and dependencies.

Private context deliberately stays out of this repository. On a fresh clone, restore your own `.local/profile.json` backup or populate **My profile**. To import this portfolio's existing Markdown export:

```powershell
node scripts/import-portfolio.mjs "C:\path\to\portfolio"
```

The legacy importer reads `public/cyril-profile.md` and optional `.local/cv-source.txt`. Do not use it to replace the current work-folder context: that would restore old portfolio contribution descriptions. Back up `.local/profile.json`, `.local/work-projects.json` and `.local/work-evidence/` to preserve this personalized setup. These private files are excluded from Git.

## Compose an application

1. Choose the platform in the sidebar.
2. Paste the **job title** and **complete job description**, including the employer's questions and required keywords.
3. Choose **Prepare application**. It captures the current details and starts generation immediately.
4. The button shows **Generating application…**, then **Reviewing application…**. Inputs are locked while the selected CLI drafts and independently reviews the answers. **Generate with Codex/Claude** or **Regenerate** can also be used on the prepared form.
5. Read the eligibility decision, question/keyword checks and any warnings. Edit wording as needed. Use **Review draft** after editing an AI-reviewed application.
6. Copy the selected answers, or capture and fill the real website form with the companion.
7. Review the original website form and click **Send/Submit** yourself.

The built-in platform forms are composition templates; they do not claim every listing has identical fields. Capture the actual application page when you need its exact field mapping. Never add fake questions or reuse a practice question as a default.

## Browser companion

1. Start the local app.
2. Open `chrome://extensions` or `edge://extensions`.
3. Enable **Developer mode**, choose **Load unpacked**, and select this repository's `extension` folder.
4. Pin **Application Composer Companion** to the toolbar.
5. In the app, open **Browser setup** and copy the pairing key.
6. Open the companion, expand **Pair with the local app**, paste the key, and choose **Save and check connection**.
7. Open the app at **127.0.0.1:32187 in that same browser profile** and reload the tab. The in-app preview is useful for the app itself, but a Chrome extension cannot fill another browser's pages.
8. On a job listing, open the companion, choose **OnlineJobs.ph**, **Upwork** or **Other**, and click **Capture & generate**. It captures the title/description, drafts and reviews an application, and displays the result in the popup while keeping you on the job website. A listing does not need editable inputs.
9. Use the popup's individual **Copy** buttons or **Copy application**. Only answer text is copied; review notes and reasons are excluded. **Captured job details → Copy job details** is also available. Closing the popup does not cancel generation: reopen it to see progress or the saved result.
10. When the actual application inputs are open, **Capture form** captures those fields and generates their answers. For browser autofill, open the full Composer workspace, review and select the mapped answers, then choose **Fill … fields**. Matching job descriptions are retained; unrelated jobs are not mixed together. You click Send yourself.

After updating this repository, use **Reload** on the companion's card in `chrome://extensions` / `edge://extensions`, then refresh Composer. Version 0.3.1 also handles proposal-page job-details cards and active slide-out panels, including descriptions with capitalized data attributes and display:contents wrappers. The actual job title is preferred over generic page headings such as Submit a proposal.

The review shows **This job is compatible**, **Compatibility needs review**, or **This job has unmet requirements** based on the saved profile and job requirements. **Create anyway** appears when a review marks a job to skip. It generates and independently reviews an application using actual experience, keeps unmet qualifications in review warnings, and never claims those requirements are met. The result is marked for review and supports the usual copy controls. This is a per-generation choice. **Generate again** runs the normal eligibility check. Reload companion version 0.3.3 after updating.

The Composer browser tab does not need to remain open. The local server must remain running. Capture, generation, review and copy use the paired extension directly, and closing/reopening the popup restores the current result. App-started generations are also shared with the paired popup. Captured job details use copyable application templates and are never treated as live website form fields.

The shipped extension requests `activeTab`, `scripting`, `storage`, `clipboardWrite` for the requested copy controls, and access to the localhost bridge. It does not request persistent access to all websites or clipboard read access. Pairing secrets and popup draft sessions are stored locally in that browser profile.

Supported controls include visible standard text, email, URL, telephone, number and textarea fields, native selects, and common contenteditable fields. The app's own dropdowns are custom styled and keyboard accessible. Arbitrary third-party custom widgets, embedded frames and closed shadow roots may require manual entry. Passwords, hidden fields, uploads, checkboxes/declarations, payment details and submission controls are not filled.

Capture identity, original URL, field labels and live element identity are checked again before filling. Edits made on the source website after capture are preserved unless you explicitly enable overwrite. Filling does not click Send.

Website interaction still depends on each platform's rules. Upwork also has an [official MCP integration](https://www.upwork.com/ai/mcp) for supported agent workflows. Do not interpret the existence of a browser extension as platform approval. [OnlineJobs.ph terms](https://www.onlinejobs.ph/terms).

## Local data and privacy

- `.local/profile.json`: applicant context and writing/rate preferences.
- `.local/settings.json`: selected CLI.
- `.local/history.json`: saved reviewed drafts and edits, capped at 50 entries.
- `.local/pairing.json`: browser pairing secret.
- Browser local storage: separate in-progress platform workspaces.
- `.local/jobs/`: temporary schema/output files, cleaned after each CLI job.
- `.local/work-projects.json` and `.local/work-evidence/`: private source-backed project context. No credentials or private customer records are imported.

`.local/`, `.env*`, browser test profiles, screenshots, `node_modules/` and Next.js build output are ignored by Git. Do not upload the CV, pairing file or local profile accidentally. Information selected for generation is sent to the selected CLI's model provider. The CLI's authentication files are reused in their normal location; this app does not copy or expose their tokens.

Draft processes receive their prompt on stdin without shell interpolation. Codex runs with isolated configuration and tool features disabled. Claude uses safe mode, an empty built-in tool set and empty strict MCP configuration. These are writing/review processes, not browser agents.

## Development and verification

```powershell
pnpm typecheck
pnpm test
node tests/browser-fields.mjs
node tests/browser-job-capture.mjs
node tests/browser-upwork-capture.mjs
node tests/browser-popup.mjs
node tests/browser-prepare-generation.mjs
pnpm build
```

For the integration browser suite, run the development server in another terminal, then install the test browser **inside the ignored local directory**:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\.local\browsers"
pnpm exec playwright install chromium
ppnpm test:browser
```

The browser suite uses a separate temporary browser profile, a local fixture at port 32188, and isolated API state. It tests companion pairing, capture, review controls, actual extension filling, custom dropdowns, preservation of edits, no submission, and responsive layouts. Its fixture-only website permission is added to a temporary extension copy; the shipped manifest is unchanged.

`pnpm exec tsx scripts/check-codex.ts` runs a real Codex draft and independent review against a labelled practice job. It uses the saved personal profile, consumes normal Codex usage, sends no applications and does not add the diagnostic to saved history.

## Troubleshooting

| Symptom | Next step |
| --- | --- |
| CLI not detected after installation | Restart the app; check `where codex` / `where claude` on Windows. |
| Installed but signed out | Run the login command shown in the opening screen and verify again. |
| CLI denied access to its state | Run the launcher in your normal Windows session; the CLI needs its own state directory. |
| Companion missing | Open the app in the browser profile where the extension is installed, then reload. |
| Pairing fails | Start the local server, recopy the full key and retry. |
| Page or field changed | Capture the current application form again. |
| Review says Skip | A hard requirement does not match the saved experience; do not invent qualifications. |
| Claude flags unsupported | Update Claude Code to a current version supporting the documented flags. |

Live Upwork and OnlineJobs.ph application pages still need a logged-in check on the actual listing. A passing local fixture does not prove every third-party form layout is supported.
