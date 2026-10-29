import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { buildPrompt, buildReviewPrompt, draftSchema, reviewedDraftSchema, validateDraft, type Profile, type Capture, type Draft } from "./contracts";
import { localDir, addHistory } from "./store";
import { runCli, cliStatus, claudeArgs, parseClaudeOutput, type Provider } from "./providers";

export function codexArgs(cwd: string, schema: string, output: string): string[] {
  const disabled = ["shell_tool", "unified_exec", "apps", "plugins", "browser_use", "browser_use_external", "computer_use", "multi_agent", "view_image", "image_generation", "hooks", "tool_suggest", "workspace_dependencies", "goals", "skill_search", "skill_mcp_dependency_install", "code_mode_host"];
  return ["exec", "--ignore-user-config", "--ephemeral", "--sandbox", "read-only", ...disabled.flatMap(feature => ["--disable", feature]), "--config", "tools.web_search=false", "--config", 'web_search="disabled"', "--skip-git-repo-check", "--cd", cwd, "--color", "never", "--output-schema", schema, "--output-last-message", output, "-"];
}
export const runProcess = (args: string[], input = "", timeout = 15000) => runCli("codex", args, input, timeout);
export const codexStatus = () => cliStatus("codex");
export type DraftJob = { id: string; captureId: string; state: "running" | "complete" | "failed"; stage: "drafting" | "reviewing"; startedAt: string; draft?: Draft; error?: string };
const jobsGlobal = globalThis as typeof globalThis & { composerJobs?: Map<string, DraftJob> };
export const jobs = jobsGlobal.composerJobs ??= new Map<string, DraftJob>();
export function startDraft(profile: Profile, capture: Capture, existingDraft?: Draft, options: { provider?: Provider; persist?: boolean; createAnyway?: boolean } = {}): DraftJob {
  if ([...jobs.values()].some(job => job.state === "running")) throw new Error("Another draft is being generated. Wait for it to finish before starting a new one.");
  for (const [id, job] of jobs) if (Date.now() - Date.parse(job.startedAt) > 3600000) jobs.delete(id);
  const job: DraftJob = { id: crypto.randomUUID(), captureId: capture.id, state: "running", stage: existingDraft ? "reviewing" : "drafting", startedAt: new Date().toISOString() };
  jobs.set(job.id, job);
  void (async () => {
    const dir = path.join(localDir, "jobs", job.id);
    try {
      await mkdir(dir, { recursive: true });
      const pass = async (prompt: string, reviewed: boolean) => {
        const schema = path.join(dir, reviewed ? "review-schema.json" : "schema.json"), output = path.join(dir, reviewed ? "reviewed.json" : "candidate.json");
        await writeFile(schema, JSON.stringify(reviewed ? reviewedDraftSchema : draftSchema));
        const provider = options.provider || "codex";
        const result = await runCli(provider, provider === "codex" ? codexArgs(dir, schema, output) : claudeArgs(reviewed ? reviewedDraftSchema : draftSchema), prompt, 240000, dir);
        if (result.code !== 0) {
          const detail = /Access is denied|permission denied|unable to open.*database/i.test(result.err) ? "Codex was denied access to its local state. Start Application Composer from Start Application Composer.cmd in your normal Windows session, then retry." : /rate.?limit|usage.?limit|quota/i.test(result.err) ? "Your CLI usage limit was reached. Check the selected CLI and retry when capacity is available." : /not logged|unauthorized|authentication/i.test(result.err) ? "Your CLI login needs attention. Use the login command in CLI setup, then retry." : "The selected CLI could not finish the drafting/review pass. Check the terminal running Application Composer, verify codex login status, and retry.";
          throw new Error(detail);
        }
        return validateDraft(provider === "codex" ? JSON.parse(await readFile(output, "utf8")) : parseClaudeOutput(result.out), capture.fields);
      };
      const candidate = existingDraft || await pass(buildPrompt(profile, capture, options), false);
      job.stage = "reviewing";
      const draft = await pass(buildReviewPrompt(profile, capture, candidate, options), true);
      if (!draft.review) throw new Error("The review did not finish. Review the draft again before using it.");
      if (options.persist !== false) await addHistory({ id: job.id, createdAt: new Date().toISOString(), capture, draft });
      Object.assign(job, { state: "complete", draft });
    } catch (error) { Object.assign(job, { state: "failed", error: (error as Error).message }); }
    finally { const jobsRoot = path.resolve(localDir, "jobs") + path.sep; if (path.resolve(dir).startsWith(jobsRoot)) await rm(dir, { recursive: true, force: true }).catch(() => {}); }
  })();
  return job;
}
