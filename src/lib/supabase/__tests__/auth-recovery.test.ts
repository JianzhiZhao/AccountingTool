import { afterEach, describe, expect, it, vi } from "vitest";
import { authFetch, isSessionExpired, withAuthTimeout } from "../auth-recovery";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("auth failure handling", () => {
  it("only identifies confirmed invalid sessions as expired", () => {
    expect(isSessionExpired({ code: "refresh_token_not_found" })).toBe(true);
    expect(isSessionExpired({ name: "AuthSessionMissingError" })).toBe(true);
    expect(isSessionExpired({ status: 503 })).toBe(false);
    expect(isSessionExpired(new TypeError("Failed to fetch"))).toBe(false);
  });

  it("bounds waits without cancelling an in-flight token rotation", async () => {
    vi.useFakeTimers();
    let finish!: (value: string) => void;
    const refresh = new Promise<string>((resolve) => { finish = resolve; });
    const result = expect(withAuthTimeout(refresh)).rejects.toThrow("暫時無法連線");
    await vi.advanceTimersByTimeAsync(12_000);
    await result;
    finish("refreshed");
    expect(await refresh).toBe("refreshed");
  });

  it("adds an abort signal to auth requests while preserving caller cancellation", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    await authFetch("https://example.com/auth/v1/user", { signal: controller.signal });
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    controller.abort();
    expect(signal.aborted).toBe(true);
  });

  it("does not impose auth timeouts on database writes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetchMock);
    const options = { method: "POST", body: "{}" };
    await authFetch("https://example.com/rest/v1/expenses", options);
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/rest/v1/expenses", options);
  });
});
