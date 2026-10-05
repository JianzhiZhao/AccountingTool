import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { config, proxy } from "@/proxy";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), getUser: vi.fn(), setCookies: null as null | ((cookies: { name: string; value: string; options: object }[]) => void) }));
vi.mock("@/lib/backend", () => ({ isSqliteDevelopment: () => false }));
vi.mock("@/lib/supabase/config", () => ({ getSupabaseConfig: () => ({ url: "https://example.com", anonKey: "test" }) }));
vi.mock("@supabase/ssr", () => ({ createServerClient: (_url: string, _key: string, options: { cookies: { setAll: typeof mocks.setCookies } }) => {
  mocks.setCookies = options.cookies.setAll;
  return { auth: { getSession: mocks.getSession, getUser: mocks.getUser } };
} }));

beforeEach(() => { vi.resetAllMocks(); });

describe("session cookie refresh", () => {
  it("forwards rotated cookies to both the server page and browser without duplicate identity checks", async () => {
    mocks.getSession.mockImplementation(async () => {
      mocks.setCookies?.([{ name: "session", value: "rotated", options: { httpOnly: true } }]);
      return { data: { session: {} }, error: null };
    });
    const request = new NextRequest("https://example.com/app", { headers: { cookie: "session=old" } });
    const response = await proxy(request);
    expect(request.cookies.get("session")?.value).toBe("rotated");
    expect(response.cookies.get("session")?.value).toBe("rotated");
    expect(response.cookies.get("session")?.httpOnly).toBe(true);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("does not delay login behind server-side token refresh", () => {
    expect(config.matcher).not.toContain("/login");
    expect(config.matcher).toContain("/app/:path*");
  });
});
