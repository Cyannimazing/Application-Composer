# Local application composer

The user approved a local form-reading, Codex-drafting, review-and-fill application, then selected Next.js and this project directory. Build directly in the current chat.

## Approaches
1. Existing third-party extensions: quick, but their AI backends and external-draft interfaces are not verified.
2. Local Next.js app and minimal browser companion: chosen after the user requested a local application and Next.js; uses the existing Codex login and keeps form mapping explicit.
3. Dot orchestration and Upwork MCP: useful later; not required to deliver generic website form support.

## Behavior
- Saved portfolio-backed profile with editable additional skills and writing guidance.
- User-clicked extension captures visible supported fields and page context; authenticated localhost bridge stores the snapshot.
- App also accepts manually pasted job details, editable draft import, and a practice form.
- Codex runs via a bounded child process with stdin and JSON schema; no shell interpolation, bypass flags or automatic browser tools.
- Generated values are editable and individually selected. Fill is requested for one exact capture and page URL. Existing values changed since capture are skipped unless overwrite was explicitly enabled.
- No submission, file uploads, declarations, payment/card fields or credential collection. HTML values are inserted as text.
- Store profile and history locally; pair extension with a random local key and validate origin/host/body sizes.
- Clearly expose missing CLI/login, timeout, stale page, incompatible fields and browser connection failures.

## Verification
Unit tests for prompt grounding, output validation, URL/origin checks and process arguments. Real-browser tests for DOM capture/fill, special labels, controlled inputs, stale-page protection, hostile values, selection and no submission. TypeScript and production build. Test an actual Codex generation if the session permits its normal local state access. Do not claim actual-site coverage before a logged-in test.
