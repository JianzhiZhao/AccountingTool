import { errorReportSchema } from "@/lib/error-report";

export const runtime = "nodejs";
const HOUR = 60 * 60 * 1000;
let windowStart = Date.now();
let count = 0;
const seen = new Map<string, number>();

// Best-effort instance guard, not a distributed rate limiter. Expired login
// reports must work without Supabase, so this accepts only tiny same-origin reports.
export async function POST(request: Request) {
  const reply = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply(403);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return reply(415);
  const now = Date.now();
  if (now - windowStart >= HOUR) { windowStart = now; count = 0; seen.clear(); }
  if (count >= 60) return reply(429);
  if (Number(request.headers.get("content-length")) > 512) return reply(413);
  const reader = request.body?.getReader();
  if (!reader) return reply(400);
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 512) { await reader.cancel(); return reply(413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const parsed = errorReportSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    if (!parsed.success) return reply(400);
    // Recheck after awaits so concurrent requests cannot overrun the instance quota.
    if (count >= 60) return reply(429);
    const { resource, status, code } = parsed.data;
    const key = `${resource}:${status}:${code}`;
    if ((seen.get(key) ?? 0) > now - 30 * 60 * 1000) return reply(204);
    seen.set(key, now);
    count++;
    console.warn(JSON.stringify({ event: "expense_settings_load_failed", source: "client_report", ...parsed.data }));
    return reply(204);
  } catch { return reply(400); }
  finally { reader.releaseLock(); }
}
