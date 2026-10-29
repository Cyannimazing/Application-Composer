import { timingSafeEqual } from "node:crypto";
import { localGuard, jsonBody, errorResponse, extensionOrigin } from "@/lib/local-auth";
import { validateProfile, validateCapture, validateDraft, type Answer, type Capture, type Draft } from "@/lib/contracts";
import { readLocal, writeLocal, getProfile, getPairingKey, runtimeState as liveRuntimeState, type RuntimeState, type HistoryEntry, type FillResult } from "@/lib/store";
import { codexStatus, jobs, startDraft } from "@/lib/codex";
import { cliStatus, getProviderSetting, saveProviderSetting, isProvider } from "@/lib/providers";
import { prepareBrowserCapture } from "@/lib/platforms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function route(request: Request) { return new URL(request.url).pathname.replace(/^\/api\//, ""); }
const qaGlobal = globalThis as typeof globalThis & { composerQaRuntime?: RuntimeState };
function stateFor(request: Request): RuntimeState {
  if (request.headers.get("x-composer-test") === "1") return qaGlobal.composerQaRuntime ??= { capture: null, captures: {}, command: null, fillResult: null, extensionSeen: 0 };
  // Remove only the development fixture that predates isolated test sessions.
  if (liveRuntimeState.capture?.url.startsWith("http://127.0.0.1:32188/")) { delete liveRuntimeState.captures[liveRuntimeState.capture.id]; liveRuntimeState.capture = null; liveRuntimeState.command = null; liveRuntimeState.fillResult = null; }
  return liveRuntimeState;
}
function cors(request: Request): HeadersInit {
  const origin = request.headers.get("origin") || "";
  return extensionOrigin(origin) ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-Composer-Key, X-Composer-Test", "Vary": "Origin", "Cache-Control": "no-store" } : { "Cache-Control": "no-store" };
}
async function bridgeGuard(request: Request): Promise<Response | null> {
  const host = request.headers.get("host") || new URL(request.url).host;
  if (!["127.0.0.1:32187", "localhost:32187"].includes(host)) return Response.json({ error: "Invalid local host." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (origin && !extensionOrigin(origin)) return Response.json({ error: "Only the paired browser companion may use this endpoint." }, { status: 403 });
  const key = request.headers.get("x-composer-key") || "";
  const expected = await getPairingKey();
  if (key.length !== expected.length || !timingSafeEqual(Buffer.from(key), Buffer.from(expected))) return Response.json({ error: "Pairing key not accepted. Copy the key from Browser setup and save it in the companion." }, { status: 401, headers: cors(request) });
  return null;
}
async function generateForCapture(capture: Capture, request: Request, draft?: Draft) {
  if (!capture.fields.length) throw new Error("Capture job details or an application form before generating.");
  const profile = await getProfile();
  if (!profile.name.trim() || !profile.experience.trim()) throw new Error("Add your name and project experience in My profile before drafting.");
  const provider = await getProviderSetting();
  if (!provider) throw new Error("Choose and verify your drafting CLI in Browser setup before generating.");
  return startDraft(profile, capture, draft, { provider, persist: request.headers.get("x-composer-test") !== "1" });
}
export async function OPTIONS(request: Request) {
  return new Response(null, { status: extensionOrigin(request.headers.get("origin") || "") ? 204 : 403, headers: cors(request) });
}
export async function GET(request: Request) {
  try {
    const endpoint = route(request);
    const runtimeState = stateFor(request);
    if (endpoint.startsWith("bridge")) {
      const denied = await bridgeGuard(request); if (denied) return denied;
      runtimeState.extensionSeen = Date.now();
      if (endpoint.startsWith("bridge/captures/")) {
        const capture = runtimeState.captures[endpoint.slice("bridge/captures/".length)];
        return capture ? Response.json(capture, { headers: cors(request) }) : Response.json({ error: "This capture is no longer available. Capture the job again." }, { status: 404, headers: cors(request) });
      }
      if (endpoint.startsWith("bridge/jobs/")) {
        const job = jobs.get(endpoint.slice("bridge/jobs/".length));
        if (!job || !runtimeState.captures[job.captureId]) return Response.json({ error: "This draft session ended. Capture and generate again." }, { status: 404, headers: cors(request) });
        return Response.json(job, { headers: cors(request) });
      }
      if (endpoint === "bridge/command") {
        const id = new URL(request.url).searchParams.get("id");
        const command = runtimeState.command as (typeof runtimeState.command & { claimedAt?: number });
        if (!command || command.id !== id || command.claimedAt || Date.now() - command.createdAt > 60000) return Response.json({ command: null }, { headers: cors(request) });
        command.claimedAt = Date.now();
        return Response.json({ command }, { headers: cors(request) });
      }
      return Response.json({ ok: true }, { headers: cors(request) });
    }
    const denied = localGuard(request); if (denied) return denied;
    if (endpoint === "profile") return Response.json(await getProfile());
    if (endpoint === "state") return Response.json(runtimeState, { headers: { "Cache-Control": "no-store" } });
    if (endpoint === "settings") return Response.json({ provider: await getProviderSetting() });
    if (endpoint === "setup") return Response.json({ key: await getPairingKey(), url: "http://127.0.0.1:32187", extensionPath: process.cwd() + "\\extension", codex: await cliStatus(await getProviderSetting() || "codex") });
    if (endpoint === "health") return Response.json(await cliStatus(await getProviderSetting() || "codex"));
    if (endpoint === "history") return Response.json(await readLocal<HistoryEntry[]>("history", []));
    if (endpoint.startsWith("jobs/")) {
      const job = jobs.get(endpoint.slice(5));
      return job ? Response.json(job) : Response.json({ error: "This draft session ended. Generate a new draft." }, { status: 404 });
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (error) { return errorResponse(error, 500); }
}
export async function POST(request: Request) {
  const endpoint = route(request);
  const runtimeState = stateFor(request);
  try {
    if (endpoint.startsWith("bridge")) {
      const denied = await bridgeGuard(request); if (denied) return denied;
      const body = await jsonBody(request) as Record<string, unknown>;
      runtimeState.extensionSeen = Date.now();
      if (endpoint === "bridge/capture") {
        runtimeState.capture = prepareBrowserCapture(validateCapture(body), Object.values(runtimeState.captures));
        runtimeState.captures[runtimeState.capture.id] = runtimeState.capture;
        runtimeState.fillResult = null; runtimeState.command = null;
        return Response.json({ ok: true, captureId: runtimeState.capture.id, capture: runtimeState.capture }, { headers: cors(request) });
      }
      if (endpoint === "bridge/generate") {
        const capture = runtimeState.captures[String(body.captureId)];
        if (!capture) throw new Error("This capture is no longer available. Capture the job again before generating.");
        return Response.json(await generateForCapture(capture, request), { status: 202, headers: cors(request) });
      }
      if (endpoint === "bridge/result") {
        const command = runtimeState.command;
        if (!command || body.commandId !== command.id) throw new Error("This fill request is no longer current. Review the latest capture.");
        const ids = new Set(command.answers.map(a => a.fieldId));
        const filled = Array.isArray(body.filled) ? body.filled.filter(id => typeof id === "string" && ids.has(id)) : [];
        const skipped = Array.isArray(body.skipped) ? body.skipped.filter(item => item && typeof item.fieldId === "string" && ids.has(item.fieldId)).map(item => ({ fieldId: String(item.fieldId), reason: String(item.reason || "Not filled").slice(0, 500) })) : [];
        runtimeState.fillResult = { commandId: command.id, filled, skipped, error: typeof body.error === "string" ? body.error.slice(0, 1000) : undefined, completedAt: new Date().toISOString() } satisfies FillResult;
        runtimeState.command = null;
        return Response.json({ ok: true }, { headers: cors(request) });
      }
      return Response.json({ error: "Not found" }, { status: 404, headers: cors(request) });
    }
    const denied = localGuard(request); if (denied) return denied;
    const body = await jsonBody(request) as Record<string, unknown>;
    if (endpoint === "providers/check" || endpoint === "settings") {
      if (!isProvider(body.provider)) throw new Error("Choose Codex CLI or Claude CLI.");
      const status = await cliStatus(body.provider);
      if (endpoint === "settings") {
        if (!status.available || !status.loggedIn) throw new Error("The selected CLI must be installed and signed in before continuing. Use the suggested setup steps, then check again.");
        await saveProviderSetting(body.provider);
        return Response.json({ provider: body.provider });
      }
      return Response.json(status);
    }
    if (endpoint === "reset") {
      if (typeof body.captureId === "string") delete runtimeState.captures[body.captureId];
      if (!body.captureId || runtimeState.capture?.id === body.captureId) runtimeState.capture = null;
      runtimeState.command = null; runtimeState.fillResult = null;
      return Response.json({ ok: true });
    }
    if (endpoint === "profile") {
      const profile = validateProfile(body); await writeLocal("profile", profile); return Response.json(profile);
    }
    if (endpoint === "capture") {
      const capture = validateCapture(body);
      if (!capture.practice && !capture.manual) throw new Error("Capture website forms with the browser companion.");
      runtimeState.capture = capture; runtimeState.command = null; runtimeState.fillResult = null;
      runtimeState.captures[capture.id] = capture;
      return Response.json(capture);
    }
    if (endpoint === "generate" || endpoint === "review") {
      const capture = validateCapture(body.capture);
      runtimeState.captures[capture.id] = capture;
      return Response.json(await generateForCapture(capture, request, endpoint === "review" ? validateDraft(body.draft, capture.fields) : undefined), { status: 202 });
    }
    if (endpoint === "fill") {
      const capture = runtimeState.captures[String(body.captureId)];
      if (!capture || capture.id !== body.captureId) throw new Error("The captured page changed. Capture it again before filling.");
      if (capture.practice || capture.manual) throw new Error("Use the practice controls or copy the answers for a manually pasted job.");
      if (!Array.isArray(body.answers) || !body.answers.length || body.answers.length > 100) throw new Error("Select at least one answer to fill.");
      const requested = body.answers as Answer[];
      const validated = validateDraft({ answers: requested, notes: [] }, capture.fields);
      const selected = new Set(requested.map(a => a.fieldId));
      runtimeState.command = { id: crypto.randomUUID(), captureId: capture.id, url: capture.url, tabId: capture.tabId, answers: validated.answers.filter(a => selected.has(a.fieldId) && a.value.trim()).map(a => ({ fieldId: a.fieldId, value: a.value })), overwrite: body.overwrite === true, createdAt: Date.now() };
      if (!runtimeState.command.answers.length) throw new Error("The selected answers are empty.");
      runtimeState.fillResult = null;
      return Response.json({ commandId: runtimeState.command.id });
    }
    if (endpoint === "history") {
      const capture = validateCapture(body.capture), draft = validateDraft(body.draft, capture.fields);
      const { addHistory } = await import("@/lib/store");
      await addHistory({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), capture, draft });
      return Response.json({ ok: true });
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    const response = errorResponse(error);
    if (endpoint.startsWith("bridge")) for (const [key, value] of new Headers(cors(request))) response.headers.set(key, value);
    return response;
  }
}
