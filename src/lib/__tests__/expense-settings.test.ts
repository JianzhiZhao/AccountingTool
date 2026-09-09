import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExpenseSettingsError, loadExpenseSettings } from "../expense-settings";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), categories: vi.fn(), currencies: vi.fn(), favorites: vi.fn(), tags: vi.fn(), report: vi.fn(),
}));
vi.mock("../backend", () => ({ isSqliteDevelopment: () => false }));
vi.mock("../error-report", () => ({ reportExpenseError: mocks.report }));
vi.mock("../supabase/client", () => ({ createClient: () => ({ auth: { getSession: mocks.getSession } }) }));
vi.mock("../data", () => ({
  listCategories: mocks.categories, listCurrencies: mocks.currencies,
  listFavorites: mocks.favorites, listTags: mocks.tags,
}));

describe("expense settings recovery", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    mocks.getSession.mockResolvedValue({ data: { session: {} }, error: null });
    mocks.categories.mockResolvedValue([{ id: "category" }]);
    mocks.currencies.mockResolvedValue([]);
    mocks.favorites.mockResolvedValue([]);
    mocks.tags.mockResolvedValue([]);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("retries only the failed read and recovers without a page change", async () => {
    mocks.categories.mockRejectedValueOnce(new TypeError("Load failed"));
    const result = loadExpenseSettings(false, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(350);
    expect((await result)[0]).toEqual([{ id: "category" }]);
    expect(mocks.categories).toHaveBeenCalledTimes(2);
    expect(mocks.tags).toHaveBeenCalledTimes(1);
    expect(console.warn).not.toHaveBeenCalled();
    expect(mocks.report).not.toHaveBeenCalled();
  });

  it("recovers a transient session refresh failure before querying data", async () => {
    mocks.getSession.mockResolvedValueOnce({ data: { session: null }, error: { status: 503 } });
    const result = loadExpenseSettings(false, new AbortController().signal);
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.categories).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(350);
    await result;
    expect(mocks.getSession).toHaveBeenCalledTimes(2);
    expect(mocks.categories).toHaveBeenCalledTimes(1);
  });

  it("reports only safe fields after three failures without writing to the browser console", async () => {
    mocks.categories.mockRejectedValue({ status: 503, message: "private payload", details: "secret" });
    const result = expect(loadExpenseSettings(false, new AbortController().signal)).rejects.toBeInstanceOf(ExpenseSettingsError);
    await vi.advanceTimersByTimeAsync(1350);
    await result;
    expect(mocks.categories).toHaveBeenCalledTimes(3);
    expect(console.warn).not.toHaveBeenCalled();
    expect(mocks.report).toHaveBeenCalledTimes(1);
    expect(mocks.report).toHaveBeenCalledWith({
      resource: "categories", attempts: 3, status: 503, code: "unknown",
    });
  });

  it("does not interpret a missing session as empty categories", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(loadExpenseSettings(false, new AbortController().signal)).rejects.toMatchObject({ requiresLogin: true });
    expect(mocks.categories).not.toHaveBeenCalled();
    expect(mocks.getSession).toHaveBeenCalledTimes(1);
  });

  it("does not retry permanent permission errors", async () => {
    mocks.categories.mockRejectedValue({ code: "42501" });
    await expect(loadExpenseSettings(false, new AbortController().signal)).rejects.toMatchObject({ requiresLogin: false });
    expect(mocks.categories).toHaveBeenCalledTimes(1);
  });

  it("cancels delayed retries when the page is left", async () => {
    const controller = new AbortController();
    mocks.categories.mockRejectedValue(new TypeError("Failed to fetch"));
    const result = expect(loadExpenseSettings(false, controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await vi.advanceTimersByTimeAsync(2000);
    await result;
    expect(mocks.categories).toHaveBeenCalledTimes(1);
  });
});
