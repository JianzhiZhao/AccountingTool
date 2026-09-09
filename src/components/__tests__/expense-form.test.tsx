// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExpenseForm } from "../expense-form";
import { listCategories, listCurrencies } from "@/lib/data";

vi.mock("@/lib/backend", () => ({ isSqliteDevelopment: () => true }));

const { categoryId, listFavorites, listTags, saveExpense } = vi.hoisted(() => ({
  categoryId: "11111111-1111-4111-8111-111111111111",
  listFavorites: vi.fn().mockResolvedValue([
    {
      id: "favorite-bus-home",
      user_id: "dev-user",
      item_name: "下班公車費",
      is_active: true,
      default_amount: 20,
      currency_code: "TWD",
      category_id: "11111111-1111-4111-8111-111111111111",
      note: "",
      default_exchange_rate_to_twd: 1,
      sort_order: 0,
      created_at: "2026-08-21",
      updated_at: "2026-08-21",
      tags: [
        { id: "22222222-2222-4222-8222-222222222222", name: "通勤" },
        { id: "33333333-3333-4333-8333-333333333333", name: "停用標籤" },
      ],
    },
  ]),
  listTags: vi.fn((includeInactive = false) => Promise.resolve([
    { id: "22222222-2222-4222-8222-222222222222", user_id: "dev-user", name: "通勤", is_active: true, sort_order: 0, created_at: "2026-08-21", updated_at: "2026-08-21" },
    ...(includeInactive ? [{ id: "33333333-3333-4333-8333-333333333333", user_id: "dev-user", name: "停用標籤", is_active: false, sort_order: 1, created_at: "2026-08-21", updated_at: "2026-08-21" }] : []),
  ])),
  saveExpense: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/data", () => ({
  listCategories: vi.fn().mockResolvedValue([
    { id: categoryId, user_id: "dev-user", name: "交通", is_active: true, created_at: "2026-08-21", updated_at: "2026-08-21" },
  ]),
  listCurrencies: vi.fn().mockResolvedValue([
    { user_id: "dev-user", code: "JPY", is_active: true, default_exchange_rate_to_twd: 0.22, created_at: "2026-08-21", updated_at: "2026-08-21" },
    { user_id: "dev-user", code: "TWD", is_active: true, default_exchange_rate_to_twd: 1, created_at: "2026-08-21", updated_at: "2026-08-21" },
  ]),
  listFavorites,
  listTags,
  saveExpense,
}));

describe("ExpenseForm", () => {
  afterEach(cleanup);
  beforeEach(() => { vi.clearAllMocks(); sessionStorage.clear(); });

  it.each([
    ["categories", listCategories], ["currencies", listCurrencies],
    ["favorites", listFavorites], ["tags", listTags],
  ])("shows a retryable error when %s fails, rather than claiming categories are missing", async (_name, request) => {
    vi.mocked(request).mockRejectedValueOnce({ code: "42501", message: "Permission denied" });
    render(<ExpenseForm />);

    expect((await screen.findByRole("alert")).textContent).toContain("無法載入記帳設定");
    expect(screen.queryByText("先建立第一個分類")).toBeNull();
    expect(screen.queryByRole("button", { name: "完成記帳" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "重新載入" }));
    expect(screen.getByRole("status")).toBeTruthy();
    expect(await screen.findByRole("option", { name: "交通" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows category setup only after a successful empty response", async () => {
    vi.mocked(listCategories).mockResolvedValueOnce([]);
    render(<ExpenseForm />);

    expect(await screen.findByText("先建立第一個分類")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reloads failed settings when the network comes back online", async () => {
    vi.mocked(listCategories).mockRejectedValueOnce({ code: "42501" });
    render(<ExpenseForm />);
    await screen.findByRole("alert");
    fireEvent(window, new Event("online"));
    expect(await screen.findByRole("option", { name: "交通" })).toBeTruthy();
  });

  it("does not show category setup while settings are still loading", async () => {
    let finish!: (tags: []) => void;
    listTags.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<ExpenseForm />);

    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.queryByText("先建立第一個分類")).toBeNull();
    finish([]);
    expect(await screen.findByRole("option", { name: "交通" })).toBeTruthy();
  });

  it("hides inactive tags when creating a new expense", async () => {
    render(<ExpenseForm />);
    expect(await screen.findByRole("button", { name: "#通勤" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "#停用標籤" })).toBeNull();
    expect(listTags).toHaveBeenCalledWith(false);
  });

  it("requests only active favorites when creating an expense", async () => {
    render(<ExpenseForm />);

    await screen.findByRole("button", { name: /下班公車費/ });
    expect(listFavorites).toHaveBeenCalledWith(false);
  });

  it("keeps an assigned inactive tag visible while editing an existing expense", async () => {
    render(<ExpenseForm initialExpense={{
      id: "expense-existing",
      user_id: "dev-user",
      item_name: "舊帳目",
      expense_date: "2026-08-21",
      amount: 20,
      currency_code: "TWD",
      category_id: categoryId,
      note: "",
      exchange_rate_to_twd: 1,
      amount_twd: 20,
      expense_type: "general",
      parent_expense_id: null,
      amortization_unit: null,
      amortization_periods: null,
      amortization_start_date: null,
      amortization_sequence: null,
      created_at: "2026-08-21",
      updated_at: "2026-08-21",
      tags: [{ id: "33333333-3333-4333-8333-333333333333", name: "停用標籤" }],
    }} />);

    const inactiveTag = await screen.findByRole("button", { name: "#停用標籤" });
    expect(inactiveTag.getAttribute("aria-pressed")).toBe("true");
    expect(listTags).toHaveBeenCalledWith(true);
  });

  it("fills the configured default exchange rate when a currency is selected", async () => {
    render(<ExpenseForm />);

    fireEvent.change(await screen.findByLabelText("幣別 *"), { target: { value: "JPY" } });

    expect((screen.getByLabelText(/1 JPY 可換多少 TWD/) as HTMLInputElement).value).toBe("0.22");
  });

  it("does not submit or clear the favorite item when Enter is pressed in the exchange-rate field", async () => {
    render(<ExpenseForm />);

    fireEvent.click(await screen.findByRole("button", { name: /下班公車費/ }));
    fireEvent.change(screen.getByLabelText("幣別 *"), { target: { value: "JPY" } });

    const rate = screen.getByLabelText(/1 JPY 可換多少 TWD/);
    fireEvent.change(rate, { target: { value: "0.22" } });

    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    const shouldRunBrowserDefault = rate.dispatchEvent(enter);
    if (shouldRunBrowserDefault) fireEvent.submit(rate.closest("form")!);

    await waitFor(() => expect((screen.getByLabelText("項目名稱 *") as HTMLInputElement).value).toBe("下班公車費"));
    expect(saveExpense).not.toHaveBeenCalled();
  });

  it("loads and saves the tags configured on a favorite", async () => {
    render(<ExpenseForm />);
    fireEvent.click(await screen.findByRole("button", { name: /下班公車費/ }));
    fireEvent.click(screen.getByRole("button", { name: "完成記帳" }));

    await waitFor(() => expect(saveExpense).toHaveBeenCalledWith(expect.objectContaining({ tag_ids: ["22222222-2222-4222-8222-222222222222"] }), undefined));
  });

  it("allows removing a favorite's default tag before saving", async () => {
    render(<ExpenseForm />);
    fireEvent.click(await screen.findByRole("button", { name: /下班公車費/ }));
    fireEvent.click(screen.getByRole("button", { name: "#通勤" }));
    fireEvent.click(screen.getByRole("button", { name: "完成記帳" }));

    await waitFor(() => expect(saveExpense).toHaveBeenCalledWith(expect.objectContaining({ tag_ids: [] }), undefined));
  });

  it("previews and saves a complete prepaid schedule", async () => {
    render(<ExpenseForm />);

    fireEvent.click(await screen.findByRole("button", { name: /預付支出/ }));
    fireEvent.change(screen.getByLabelText("項目名稱 *"), { target: { value: "年度保險" } });
    fireEvent.change(screen.getByLabelText("金額 *"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("期數 *"), { target: { value: "3" } });

    expect(screen.getByText("查看完整 3 期預覽")).toBeTruthy();
    expect(screen.getAllByText("33 TWD").length).toBeGreaterThan(0);
    expect(screen.getAllByText("34 TWD").length).toBeGreaterThan(0);
    expect(screen.queryByText(/33\.333/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "建立預付與攤提" }));

    await waitFor(() => expect(saveExpense).toHaveBeenCalledWith(expect.objectContaining({
      item_name: "年度保險",
      expense_type: "prepaid",
      amortization_unit: "month",
      amortization_periods: 3,
      amortization_start_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    }), undefined));
  });
});
