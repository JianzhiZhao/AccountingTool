// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "../auth/login-form";
import { SessionRecovery } from "../auth/session-recovery";

const mocks = vi.hoisted(() => ({
  router: { replace: vi.fn(), refresh: vi.fn() },
  getUser: vi.fn(), getSession: vi.fn(), signInWithPassword: vi.fn(), unsubscribe: vi.fn(),
  listener: null as null | ((event: string) => void),
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("@/lib/backend", () => ({ isSqliteDevelopment: () => false }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: {
  getUser: mocks.getUser, getSession: mocks.getSession, signInWithPassword: mocks.signInWithPassword,
  onAuthStateChange: (listener: (event: string) => void) => {
    mocks.listener = listener;
    return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
  },
} }) }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthSessionMissingError" } });
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "user" } } }, error: null });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("login recovery", () => {
  it("restores an existing login without a button click", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
    render(<LoginForm />);
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/app"));
  });

  it("allows login when there is no session", async () => {
    render(<LoginForm />);
    await waitFor(() => expect((screen.getByRole("button", { name: "登入" }) as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it("shows network recovery and retries without requiring credentials", async () => {
    mocks.getUser.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<LoginForm />);
    expect((await screen.findByRole("alert")).textContent).toContain("暫時無法連線");
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user" } }, error: null });
    fireEvent.click(screen.getByRole("button", { name: "重試連線並恢復登入" }));
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/app"));
  });

  it("stops the recovery spinner after 12 seconds", async () => {
    vi.useFakeTimers();
    mocks.getUser.mockReturnValue(new Promise(() => {}));
    render(<LoginForm />);
    await act(() => vi.advanceTimersByTimeAsync(12_000));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("暫時無法連線");
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it.each([
    ["network", () => Promise.reject(new TypeError("Failed to fetch")), "暫時無法連線"],
    ["credentials", () => Promise.resolve({ error: { code: "invalid_credentials" } }), "請確認 Email 與密碼"],
  ])("releases the submit button on %s failure", async (_name, response, message) => {
    mocks.signInWithPassword.mockImplementation(response);
    render(<LoginForm />);
    const button = screen.getByRole("button", { name: "登入" }) as HTMLButtonElement;
    await waitFor(() => expect(button.disabled).toBe(false));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "test@example.com" } });
    fireEvent.change(screen.getByLabelText("密碼"), { target: { value: "password" } });
    fireEvent.submit(button.closest("form")!);
    expect((await screen.findByRole("alert")).textContent).toContain(message);
    expect(button.disabled).toBe(false);
  });
});

describe("returning to the app", () => {
  it("refreshes on focus and automatically redirects if the session is gone", async () => {
    render(<SessionRecovery />);
    await waitFor(() => expect(mocks.getSession).toHaveBeenCalledTimes(1));
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    fireEvent(window, new Event("focus"));
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledWith("/login"));
  });

  it("keeps the page on network errors and recovers when back online", async () => {
    mocks.getSession.mockResolvedValueOnce({ data: { session: null }, error: { status: 503 } });
    render(<SessionRecovery />);
    await screen.findByRole("alert");
    expect(mocks.router.replace).not.toHaveBeenCalled();
    fireEvent(window, new Event("online"));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("handles sign-out events and cleans up its subscription", async () => {
    const { unmount } = render(<SessionRecovery />);
    await act(async () => { mocks.listener?.("SIGNED_OUT"); });
    expect(mocks.router.replace).toHaveBeenCalledWith("/login");
    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
