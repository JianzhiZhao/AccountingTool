import { beforeEach, describe, expect, it, vi } from "vitest";

const { createBrowserClient, getSupabaseConfig } = vi.hoisted(() => ({
  createBrowserClient: vi.fn(() => ({ auth: {} })),
  getSupabaseConfig: vi.fn(() => ({ url: "https://example.supabase.co", anonKey: "test-key" })),
}));

vi.mock("@supabase/ssr", () => ({ createBrowserClient }));
vi.mock("../config", () => ({ getSupabaseConfig }));

describe("createClient", () => {
  beforeEach(() => {
    createBrowserClient.mockClear();
    getSupabaseConfig.mockClear();
  });

  it("reuses one browser client for all data requests", async () => {
    const { createClient } = await import("../client");

    const first = createClient();
    const second = createClient();

    expect(second).toBe(first);
    expect(createBrowserClient).toHaveBeenCalledTimes(1);
  });
});
