const hosts = new Set(["127.0.0.1:32187", "localhost:32187"]);
export function checkLocalRequest(request: Request): boolean {
  const host = request.headers.get("host") ?? new URL(request.url).host;
  if (!hosts.has(host)) return false;
  const origin = request.headers.get("origin");
  if (origin && !["http://127.0.0.1:32187", "http://localhost:32187"].includes(origin)) return false;
  return !["cross-site"].includes(request.headers.get("sec-fetch-site") ?? "");
}
export function extensionOrigin(origin: string): boolean {
  return /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
}
export function localGuard(request: Request): Response | null {
  return checkLocalRequest(request) ? null : Response.json({ error: "This application is available only from its local browser window." }, { status: 403 });
}
export async function jsonBody(request: Request, max = 200000): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new Error("Send JSON data.");
  if (Number(request.headers.get("content-length") || 0) > max) throw new Error("The request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("The request body is missing.");
  const chunks: Uint8Array[] = []; let size = 0;
  for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > max) { await reader.cancel(); throw new Error("The request is too large."); } chunks.push(value); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function errorResponse(error: unknown, status = 400): Response {
  return Response.json({ error: error instanceof Error ? error.message : "The request could not be completed. Try again." }, { status });
}
