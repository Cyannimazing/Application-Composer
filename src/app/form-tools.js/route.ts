import { readFile } from "node:fs/promises";
import path from "node:path";
export const runtime = "nodejs";
export async function GET() { return new Response(await readFile(path.join(process.cwd(), "extension/form-tools.js"), "utf8"), { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" } }); }
