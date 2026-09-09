// @vitest-environment jsdom
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const report = { resource: "categories" as const, attempts: 3, status: 503, code: "unknown" };
beforeEach(() => {
  vi.resetModules(); localStorage.clear();
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-09T00:00:00Z"));
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("deduplicates across reloads and allows another report after 30 minutes", async () => {
  (await import("../error-report")).reportExpenseError(report);
  vi.resetModules();
  const { reportExpenseError } = await import("../error-report");
  reportExpenseError(report);
  expect(fetch).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(30 * 60 * 1000);
  reportExpenseError(report);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("caps reports at ten in 24 hours and replaces expired history", async () => {
  const { reportExpenseError } = await import("../error-report");
  for (let i = 0; i < 15; i++) reportExpenseError({ ...report, code: `code_${i}` });
  expect(fetch).toHaveBeenCalledTimes(10);
  vi.advanceTimersByTime(24 * 60 * 60 * 1000);
  reportExpenseError(report);
  expect(fetch).toHaveBeenCalledTimes(11);
  expect(JSON.parse(localStorage.getItem("accounting-error-reports-v1")!)).toHaveLength(1);
});

it("never retries a failed upload", async () => {
  vi.mocked(fetch).mockRejectedValue(new Error("offline"));
  const { reportExpenseError } = await import("../error-report");
  expect(() => reportExpenseError(report)).not.toThrow();
  await vi.advanceTimersByTimeAsync(5000);
  reportExpenseError(report);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("keeps an in-memory limit when storage is blocked", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  const { reportExpenseError } = await import("../error-report");
  reportExpenseError(report); reportExpenseError(report);
  expect(fetch).toHaveBeenCalledTimes(1);
});
