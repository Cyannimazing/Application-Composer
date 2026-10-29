import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

test("create anyway is an explicit per-generation option and normal regenerate resets it", async () => {
  const capture = { id: "gap", platform: "other" };
  const storage: Record<string, any> = { "application-draft:other": { capture, jobId: "skipped", job: { state: "complete", draft: { review: { eligibility: "skip" } } } } };
  const bodies: any[] = [];
  const sandbox = { AbortSignal, fetch: async (_url: string, options: any) => { bodies.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ id: "new-job", state: "running" }) }; }, chrome: { storage: { local: { get: async () => ({ pairingKey: "0".repeat(64) }) }, session: { get: async (key: string) => ({ [key]: storage[key] }), set: async (values: any) => { Object.assign(storage, values); } } }, runtime: { onMessage: { addListener() {} } } } };
  vm.createContext(sandbox);
  vm.runInContext(await readFile("extension/background.js", "utf8"), sandbox);
  await (sandbox as any).regenerate("other", true);
  assert.deepEqual(bodies[0], { captureId: "gap", createAnyway: true });
  await (sandbox as any).regenerate("other");
  assert.equal(bodies[1].createAnyway, false);
});

test("the extension captures and starts generation without switching away from the job, and resumes after popup closure", async () => {
  const storage: Record<string, unknown> = {};
  let switched = 0;
  const capture = { id: "job-capture", title: "Next.js CMS", url: "https://www.onlinejobs.ph/jobseekers/job/cms-123", context: "Build a Next.js CMS. Include PARTNER.", platform: "onlinejobs", manual: true, jobListing: true, fields: [{ id: "message", label: "Application message", type: "textarea", maxLength: 10000, options: [] }] };
  let job = { id: "generation-job", captureId: capture.id, state: "running", stage: "drafting" } as Record<string, unknown>;
  const requests: string[] = [];
  const sandbox = { crypto, AbortSignal, fetch: async (url: string) => { requests.push(url); return { ok: true, json: async () => url.endsWith("/capture") ? { captureId: capture.id, capture } : url.includes("/jobs/") || url.endsWith("/generate") ? job : { ok: true } }; }, chrome: { storage: { local: { get: async () => ({ pairingKey: "0".repeat(64) }) }, session: { get: async (key: string) => ({ [key]: storage[key] }), set: async (values: Record<string, unknown>) => { Object.assign(storage, values); } } }, tabs: { query: async (query: { active?: boolean }) => query.active ? [{ id: 7, url: capture.url }] : [], update: async () => { switched++; }, create: async () => { switched++; } }, scripting: { executeScript: async (request: { files?: unknown }) => request.files ? [] : [{ result: { ...capture, fields: [] } }] }, runtime: { onMessage: { addListener() {} }, getURL: () => "chrome-extension://test/" } } };
  vm.createContext(sandbox);
  vm.runInContext(await readFile("extension/background.js", "utf8"), sandbox);
  const worker = sandbox as typeof sandbox & { captureAndGenerate?: (mode: string, platform: string) => Promise<any>; draftStatus?: (platform: string) => Promise<any> };
  assert.equal(typeof worker.captureAndGenerate, "function");
  const session = await worker.captureAndGenerate!("job", "onlinejobs");
  assert.equal(session.job.id, job.id);
  assert.equal(switched, 0);
  assert.ok(requests.some(url => url.endsWith("/generate")));
  job = { ...job, state: "complete", draft: { answers: [{ fieldId: "message", value: "PARTNER — I can build your Next.js CMS.", reason: "", needsInput: false }], notes: [], review: { eligibility: "fit" } } };
  const restored = await worker.draftStatus!("onlinejobs");
  assert.equal(restored.job.state, "complete");
  assert.equal(restored.capture.id, capture.id);
  assert.equal(restored.job.draft.answers[0].value, "PARTNER — I can build your Next.js CMS.");
});

test("a late status response cannot replace a newer captured job", async () => {
  const key = "application-draft:onlinejobs";
  const oldCapture = { id: "old", platform: "onlinejobs" }, newCapture = { id: "new", platform: "onlinejobs" };
  const storage: Record<string, any> = { [key]: { capture: oldCapture, jobId: "old-job" } };
  let resolveOld: (response: unknown) => void;
  let markStarted: () => void;
  const started = new Promise<void>(resolve => { markStarted = resolve; });
  const sandbox = { crypto, AbortSignal, fetch: async (url: string) => {
    if (url.endsWith("old-job")) { markStarted(); return new Promise(resolve => { resolveOld = resolve; }); }
    return { ok: true, json: async () => ({ id: "new-job", captureId: "new", state: "complete" }) };
  }, chrome: { storage: { local: { get: async () => ({ pairingKey: "0".repeat(64) }) }, session: { get: async (key: string) => ({ [key]: storage[key] }), set: async (values: Record<string, unknown>) => { Object.assign(storage, values); } } }, runtime: { onMessage: { addListener() {} }, getURL: () => "chrome-extension://test/" } } };
  vm.createContext(sandbox);
  vm.runInContext(await readFile("extension/background.js", "utf8"), sandbox);
  const pending = (sandbox as any).draftStatus("onlinejobs");
  await started;
  storage[key] = { capture: newCapture, jobId: "new-job" };
  resolveOld!({ ok: true, json: async () => ({ id: "old-job", captureId: "old", state: "complete" }) });
  const response = await pending;
  assert.equal(storage[key].jobId, "new-job");
  assert.equal(response.capture.id, "new");
});
