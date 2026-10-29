import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { emptyProfile, type Capture, type Draft, type Profile } from "./contracts";
export const localDir = path.join(process.cwd(), ".local");
const queueGlobal = globalThis as typeof globalThis & { composerWriteQueues?: Map<string, Promise<unknown>> };
const writeQueues = queueGlobal.composerWriteQueues ??= new Map<string, Promise<unknown>>();
function queued(directory: string, operation: () => Promise<void>): Promise<void> {
  const key = path.resolve(directory);
  const job = (writeQueues.get(key) ?? Promise.resolve()).then(operation);
  writeQueues.set(key, job.catch(() => {}));
  return job;
}
async function writeAt(directory: string, name: string, value: unknown): Promise<void> {
  await mkdir(directory, { recursive: true });
  const target = path.join(directory, name + ".json"), temp = target + ".tmp";
  await writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(temp, target);
}
export async function readLocal<T>(name: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(path.join(localDir, name + ".json"), "utf8")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback; throw error; }
}
export function writeLocal(name: string, value: unknown): Promise<void> {
  return queued(localDir, () => writeAt(localDir, name, value));
}
export async function getProfile(): Promise<Profile> { return readLocal("profile", emptyProfile); }
const pairingGlobal = globalThis as typeof globalThis & { composerPairing?: Promise<string> };
export function getPairingKey(): Promise<string> {
  return pairingGlobal.composerPairing ??= (async () => {
    const state = await readLocal<{ key: string } | null>("pairing", null);
    if (state?.key) return state.key;
    const key = randomBytes(32).toString("hex");
    await writeLocal("pairing", { key }); return key;
  })().catch(error => { pairingGlobal.composerPairing = undefined; throw error; });
}
export type HistoryEntry = { id: string; createdAt: string; capture: Capture; draft: Draft };
export function updateHistoryFile(directory: string, entry: HistoryEntry): Promise<void> {
  return queued(directory, async () => {
    let history: HistoryEntry[] = [];
    try { history = JSON.parse(await readFile(path.join(directory, "history.json"), "utf8")); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    await writeAt(directory, "history", [entry, ...history.filter(h => h.id !== entry.id)].slice(0, 50));
  });
}
export function addHistory(entry: HistoryEntry): Promise<void> { return updateHistoryFile(localDir, entry); }
export type FillCommand = { id: string; captureId: string; url: string; tabId: number; answers: { fieldId: string; value: string }[]; overwrite: boolean; createdAt: number };
export type FillResult = { commandId: string; filled: string[]; skipped: { fieldId: string; reason: string }[]; error?: string; completedAt: string };
export type RuntimeState = { capture: Capture | null; captures: Record<string, Capture>; command: FillCommand | null; fillResult: FillResult | null; extensionSeen: number };
const globalState = globalThis as typeof globalThis & { composerRuntime?: RuntimeState };
export const runtimeState = globalState.composerRuntime ??= { capture: null, captures: {}, command: null, fillResult: null, extensionSeen: 0 };
runtimeState.captures ??= {};
