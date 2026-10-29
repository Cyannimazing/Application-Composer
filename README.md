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

- Node.js **22 or newer** and npm.
- **One** supported CLI installed and signed in:
  - [Codex CLI](https://learn.chatgpt.com/docs/codex-cli), using an existing ChatGPT/Codex login.
  - A current [Claude Code CLI](https://code.claude.com/docs/en/setup), using its own Claude login. The adapter requires support for `--safe-mode`, print mode and JSON Schema output.
- Internet access for AI generation. Local does not mean offline inference.
- Chrome or Edge for the optional browser companion.

No separate model API key or Ollama service is required by this application. Each CLI uses its own existing authentication and usage allowance.

## Run locally

```powershell
npm install
npm run dev
```

Open **http://127.0.0.1:32187**. On Windows, you can also double-click **Start Application Composer.cmd**. Keep the server window open while using the app.

For a production build:

```powershell
npm run build
npm start
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

The current local installation is already populated from the supplied portfolio and CV. Name, email, portfolio, GitHub, project contributions, timezone and availability are not information that needs retyping for each application. Known fields are prefilled, and the CLI selects relevant projects for the particular job.

The saved starting rate policy is **USD 25/hour** for Upwork freelance work and **USD 2,000/month** for a long-term, full-time OnlineJobs.ph role at 40 hours/week. These are editable starting preferences, not a claim that either platform has one market rate. Rate suggestions adapt to the actual job and scope. Fixed-price assumptions belong in the applicant-only review notes.

Private context deliberately stays out of this repository. On a fresh clone, restore your own `.local/profile.json` backup or populate **My profile**. To import this portfolio's existing Markdown export:

```powershell
node scripts/import-portfolio.mjs "C:\path\to\portfolio"
```

The importer reads `public/cyril-profile.md` and optional `.local/cv-source.txt`. It updates this app's copy without modifying the source portfolio or CV. Do not run it over later profile edits without making a backup.

## Compose an application

1. Choose the platform in the sidebar.
2. Paste the **job title** and **complete job description**, including the employer's questions and required keywords.
3. Choose **Prepare application**.
4. Choose **Generate**. The selected CLI drafts, then reviews the application in a separate pass.
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
8. On a visible website application form, click the companion and choose **Capture this form**.
9. Review the mapped answers in the local app. Select only the fields you want, then choose **Fill selected fields**.

The shipped extension requests `activeTab`, `scripting`, `storage`, and access to the localhost bridge. It does not request persistent access to all websites. Pairing secrets are stored locally in that browser profile.

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

`.local/`, `.env*`, browser test profiles, screenshots, `node_modules/` and Next.js build output are ignored by Git. Do not upload the CV, pairing file or local profile accidentally. Information selected for generation is sent to the selected CLI's model provider. The CLI's authentication files are reused in their normal location; this app does not copy or expose their tokens.

Draft processes receive their prompt on stdin without shell interpolation. Codex runs with isolated configuration and tool features disabled. Claude uses safe mode, an empty built-in tool set and empty strict MCP configuration. These are writing/review processes, not browser agents.

## Development and verification

```powershell
npm run typecheck
npm test
node tests/browser-fields.mjs
npm run build
```

For the integration browser suite, run the development server in another terminal, then install the test browser **inside the ignored local directory**:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = "$PWD\.local\browsers"
npx playwright install chromium
npm run test:browser
```

The browser suite uses a separate temporary browser profile, a local fixture at port 32188, and isolated API state. It tests companion pairing, capture, review controls, actual extension filling, custom dropdowns, preservation of edits, no submission, and responsive layouts. Its fixture-only website permission is added to a temporary extension copy; the shipped manifest is unchanged.

`npx tsx scripts/check-codex.ts` runs a real Codex draft and independent review against a labelled practice job. It uses the saved personal profile, consumes normal Codex usage, sends no applications and does not add the diagnostic to saved history.

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
