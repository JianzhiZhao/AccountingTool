import { afterEach, beforeEach, expect, it, vi } from "vitest";
const body = { resource: "session", status: 401, attempts: 1, code: "SESSION_MISSING" };
const request = (payload: unknown = body, origin = "https://example.com") => new Request("https://example.com/api/client-errors", {
  method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(payload),
});
beforeEach(() => { vi.resetModules(); vi.spyOn(console, "warn").mockImplementation(() => {}); });
afterEach(() => { vi.restoreAllMocks(); });

it("logs without depending on an active session", async () => {
  const { POST } = await import("../../app/api/client-errors/route");
  expect((await POST(request())).status).toBe(204);
  expect(console.warn).toHaveBeenCalledTimes(1);
  expect(JSON.parse(vi.mocked(console.warn).mock.calls[0][0])).toEqual({ event: "expense_settings_load_failed", source: "client_report", ...body });
});

it("rejects foreign origins, oversized input and account fields without logging", async () => {
  const { POST } = await import("../../app/api/client-errors/route");
  expect((await POST(request(body, "https://other.com"))).status).toBe(403);
  expect((await POST(request({ ...body, email: "private@example.com" }))).status).toBe(400);
  expect((await POST(request({ ...body, code: "x".repeat(600) }))).status).toBe(413);
  expect(console.warn).not.toHaveBeenCalled();
});

it("deduplicates and caps concurrent logs within the server instance", async () => {
  const { POST } = await import("../../app/api/client-errors/route");
  await Promise.all(Array.from({ length: 10 }, () => POST(request())));
  expect(console.warn).toHaveBeenCalledTimes(1);
  await Promise.all(Array.from({ length: 70 }, (_, i) => POST(request({ ...body, code: `code_${i}` }))));
  expect(console.warn).toHaveBeenCalledTimes(60);
  expect((await POST(request())).status).toBe(429);
});
