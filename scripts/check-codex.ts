import { startDraft } from "../src/lib/codex";
import { getProfile } from "../src/lib/store";
import { validateCapture } from "../src/lib/contracts";
import { writeFile } from "node:fs/promises";

async function main() {
  const profile = await getProfile();
  const capture = validateCapture({ id: "verified-practice-draft", url: "http://127.0.0.1:32187/practice-form.html", title: "Practice: Next.js and Supabase CMS", context: "We need a developer for a client CMS in Next.js App Router, TypeScript and Supabase/PostgreSQL. Include CMS PARTNER in your subject. Tell us a relevant CMS project, your contribution, an approach to RLS and your availability. Be friendly and concise.", capturedAt: new Date().toISOString(), tabId: -1, manual: true, practice: true, fields: [
    { id: "subject", label: "Application subject", type: "text", value: "", required: true, maxLength: 160, options: [] },
    { id: "message", label: "Application message", type: "textarea", value: "", required: true, maxLength: 4000, options: [] },
    { id: "screening", label: "What relevant CMS project have you worked on, and how would you handle Supabase RLS?", type: "textarea", value: "", required: true, maxLength: 3000, options: [] },
  ] });
  const job = startDraft(profile, capture, undefined, { persist: false });
  console.log("Testing actual Codex draft generation with the saved profile. No browser actions or submissions.");
  while (job.state === "running") await new Promise(resolve => setTimeout(resolve, 1000));
  if (job.state === "failed") throw new Error(job.error);
  const combined = job.draft!.answers.map(a => a.value).join("\n");
  if (!combined.includes("CMS PARTNER")) throw new Error("The sample did not follow the required subject keyword.");
  if (/\bintern(ship)?\b/i.test(combined)) throw new Error("The sample included excluded internship wording.");
  await writeFile(".local/verified-sample.json", JSON.stringify(job.draft, null, 2));
  console.log(JSON.stringify({ state: job.state, fields: job.draft!.answers.length, requiredKeyword: true, internshipWordingExcluded: true, sample: job.draft }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
