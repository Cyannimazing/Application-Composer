import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { readLocal, writeLocal } from "./store";

export type Provider = "codex" | "claude";
export const providerDetails = {
  codex: { name: "Codex CLI", label: "Codex CLI (ChatGPT)", login: "codex login", install: "npm install -g @openai/codex", docs: "https://learn.chatgpt.com/docs/codex-cli" },
  claude: { name: "Claude CLI", label: "Claude CLI (Anthropic)", login: "claude auth login", install: "npm install -g @anthropic-ai/claude-code", docs: "https://code.claude.com/docs/en/setup" },
} as const;
export function isProvider(value: unknown): value is Provider { return value === "codex" || value === "claude"; }
export async function getProviderSetting(): Promise<Provider | null> { const saved = await readLocal<{ provider?: unknown }>("settings", {}); return isProvider(saved.provider) ? saved.provider : null; }
export async function saveProviderSetting(provider: Provider): Promise<void> { await writeLocal("settings", { provider }); }
async function exists(file: string) { try { await access(file); return true; } catch { return false; } }
export async function resolveCli(provider: Provider): Promise<{ command: string; prefix: string[] }> {
  const custom = provider === "codex" ? process.env.COMPOSER_CODEX_PATH : process.env.COMPOSER_CLAUDE_PATH;
  const directories = (process.env.PATH || "").split(path.delimiter).map(dir => dir.replace(/^"|"$/g, "")).filter(Boolean);
  const files = custom ? [custom] : directories.flatMap(dir => process.platform === "win32" ? [path.join(dir, provider + ".exe"), path.join(dir, provider + ".cmd")] : [path.join(dir, provider)]);
  for (const file of files) {
    if (!await exists(file)) continue;
    if (/\.cmd$/i.test(file)) {
      const entry = path.join(path.dirname(file), "node_modules", provider === "claude" ? "@anthropic-ai/claude-code/cli.js" : "@openai/codex/bin/codex.js");
      if (await exists(entry)) return { command: process.execPath, prefix: [entry] };
      continue;
    }
    return { command: file, prefix: [] };
  }
  throw new Error(`${providerDetails[provider].name} was not found on PATH. Install it, sign in, and restart Application Composer so it can detect the updated PATH.`);
}
export async function runCli(provider: Provider, args: string[], input = "", timeout = 15000, cwd?: string): Promise<{ code: number; out: string; err: string }> {
  const executable = await resolveCli(provider);
  return new Promise((resolve, reject) => {
    const child = spawn(/*turbopackIgnore: true*/ executable.command, [...executable.prefix, ...args], { shell: false, windowsHide: true, cwd, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "", settled = false;
    const end = (error?: Error, code = 0) => { if (settled) return; settled = true; clearTimeout(timer); if (error) reject(error); else resolve({ code, out, err }); };
    const timer = setTimeout(() => {
      if (process.platform === "win32" && child.pid) { const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" }); killer.on("error", () => child.kill()); }
      else child.kill("SIGTERM");
      end(new Error(`${providerDetails[provider].name} took too long. Check its login and usage allowance, then try again.`));
    }, timeout);
    child.on("error", () => end(new Error(`${providerDetails[provider].name} could not start. Reopen the app after installing or updating the CLI.`)));
    child.stdout.on("data", chunk => { out = (out + chunk.toString()).slice(-300000); });
    child.stderr.on("data", chunk => { err = (err + chunk.toString()).slice(-40000); });
    child.stdin.on("error", () => {});
    child.on("close", code => end(undefined, code ?? 1));
    child.stdin.end(input);
  });
}
export type CliStatus = { provider: Provider; available: boolean; loggedIn: boolean; version: string; detail: string; solution?: string; command?: string; docs: string };
export async function cliStatus(provider: Provider): Promise<CliStatus> {
  const meta = providerDetails[provider];
  try {
    const version = await runCli(provider, ["--version"]);
    if (version.code !== 0) return { provider, available: false, loggedIn: false, version: "", detail: "The CLI was found, but its version check failed.", solution: "Update or reinstall the CLI, then restart this app.", command: meta.install, docs: meta.docs };
    const auth = await runCli(provider, provider === "codex" ? ["login", "status"] : ["auth", "status"]);
    let loggedIn = auth.code === 0;
    if (provider === "claude") { try { const data = JSON.parse(auth.out); if (typeof data.loggedIn === "boolean") loggedIn = data.loggedIn; } catch {} }
    return { provider, available: true, loggedIn, version: version.out.trim().split("\n").at(-1) || meta.name, detail: loggedIn ? `Using your existing ${provider === "codex" ? "ChatGPT/Codex" : "Claude"} login` : `${meta.name} is installed, but it needs a login.`, ...(loggedIn ? {} : { solution: "Run the login command in a normal terminal, then check again.", command: meta.login }), docs: meta.docs };
  } catch (error) { return { provider, available: false, loggedIn: false, version: "", detail: (error as Error).message, solution: "Install the CLI, sign in, then restart Application Composer and verify again.", command: meta.install, docs: meta.docs }; }
}
export function claudeArgs(schema: unknown): string[] {
  return ["--print", "--safe-mode", "--no-session-persistence", "--no-chrome", "--tools", "", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}', "--output-format", "json", "--json-schema", JSON.stringify(schema), "--permission-mode", "dontAsk", "--max-turns", "3"];
}
export function parseClaudeOutput(text: string): unknown {
  const envelope = JSON.parse(text);
  if (envelope.is_error) throw new Error("Claude could not complete the request. Check the CLI login and usage allowance.");
  if (!envelope.structured_output || typeof envelope.structured_output !== "object") throw new Error("Claude did not return structured output. Update Claude Code and retry.");
  return envelope.structured_output;
}
