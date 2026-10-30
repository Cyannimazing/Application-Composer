# Project memory

## Confirmed decisions

- Agent selection is recorded in project.json.

## Current work

- Local Next.js workspace has separate platform views, saved profile context, custom dropdowns, and CLI selection for Codex or Claude.
- Default source is job title plus full description, including employer questions. Practice captures must never persist into real saved applications.
- Copy all copies every nonempty answer in form order, independent of the fill selection. It excludes internal review notes.
- Browser regression verifies practice-state cleanup, preservation of real saved jobs, refresh persistence, clipboard contents, and mobile fit.
- Companion 0.2.0 has a custom OnlineJobs.ph / Upwork / Other selector and separate job-details/form capture actions. Job listings do not require form fields. Preserve the matching description when capturing an application; never merge unrelated jobs.
- Description extraction was checked against the public OnlineJobs.ph listing HTML supplied in the user's screenshot. Private inputs and hidden content are excluded.
- User confirmed the initial repository push succeeded. Credentials, local profile, CV, pairing key and drafts remain excluded from Git.
- Prepare application now immediately generates and independently reviews the current job, with generating/reviewing loading labels and edit locks.
- Companion 0.3.0 captures and generates without leaving the website; popup results support individual/application copy, retain sessions on closure, and exclude internal notes from copied text.
- Current private context comes from actual Izee Work and Personal Work source; user confirms implemented work is theirs. Use portfolio for public URLs only. Match the complete client brief using simple, direct English and relevant work/URLs, not a fixed set of integration examples.

## Next step

- Preserve the approved design and personal context when applying further corrections. Do not start the user's development server unless explicitly requested.

- Use pnpm for project development, checks, installs and the launcher; packageManager pins pnpm 12.16.1.
- Application writing uses normal hyphens (-). Standard scoped-web estimates use a 1-2 week agile cycle: about 2 days mockups, about 1 week MVP, then testing and client feedback, adjusted to actual scope.
- Application prose must not use semicolons. Preserve exact URLs and actual platform select values.
- User clarified the work is custom JavaScript script injection into existing sites, including form event listeners that send field data to client CRM APIs. Do not describe this as building WordPress widgets, themes or plugins. Use the relevant script/integration work directly, without internal verification caveats in client-facing text.
- Companion 0.3.1 prioritizes active job panels and proposal-page Job details sections, handles case-insensitive description markers and display:contents, and avoids including search results or existing form answers. A Composer browser tab is unnecessary while the local server is running.

- Companion 0.3.2 and the workspace provide Create anyway for skipped jobs. This explicit per-generation option drafts and reviews honest answers despite qualification gaps, retaining warnings and needs_review. Ordinary generation retains the existing eligibility check.

- Companion 0.3.3 and the workspace show explicit job compatibility labels for fit, needs_review and skip. Unmet requirements retain the Create anyway action.

- Client-stated rates take priority. Choose lower-middle pricing within a client range (about 40% from minimum to maximum), or use a single stated hourly rate as given. Only without a stated rate, use USD 10/hour by default and USD 8-10/hour as the fallback. Respect stated monthly/fixed budgets and keep quote assumptions in applicant-only notes.

- Standalone native desktop app: bundled Next + Node + embedded WebView2 SDK, own window, close X shuts down owned server/job tree. Persistent desktop data is %LOCALAPPDATA%/ApplicationComposer/data after one-time migration; future desktop profile updates belong there. Original development .local remains separate. Companion 0.3.4 bridges native fill/draft events through a temporary localhost tab, no new permissions. Desktop EXE and private data remain outside Git.

- Minimize hides the app in the system tray and keeps its server running; tray Open/double-click/second EXE launch restores it. X or tray Exit shuts down its owned server. Browser handoff uses the Windows default profile, which needs the paired companion.
- Always include saved portfolio and GitHub links in the main message with a friendly portfolio-for-more-sample-work line. Use technology names without version numbers. Preserve rates, hours, timelines and URLs. Both saved profile locations and importer defaults have this guidance.
