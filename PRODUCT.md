# Application Composer

Personal local workspace for Cyril's job applications. A Next.js app runs at http://127.0.0.1:32187. An explicitly paired Chrome/Edge companion captures the active page's editable fields and fills only reviewed answers. Codex CLI, using its existing login, produces job-specific drafts from the supplied portfolio. No Ollama or separate AI API key.

The user controls every submission. No job scraping, automatic applications, account login automation, or website polling. Only capture and fill after user action. Standard text, email, URL, numeric, select and contenteditable fields are in scope. Passwords, hidden fields, payment details, uploads, checkboxes, declarations, and submit controls are excluded. Cross-origin frames and closed shadow roots require manual work.

Application tone: friendly, concise, professional, specific to client needs; omit internship references. Additional skills may be confirmed by the user. Unsupported expertise, employers, years, metrics or ownership must not be invented. Relevant project contributions are preserved.

Local profile and draft history are persisted under .local and ignored by Git. Job/profile information is sent to OpenAI through Codex when the user generates. Browser permissions are granted for the clicked tab, not persistent access to every website. No service is publicly hosted.
