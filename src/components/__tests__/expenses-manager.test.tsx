// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatMoney } from "@/lib/analytics";
import { ExpensesManager } from "../expenses-manager";

const { expenses, listExpenses } = vi.hoisted(() => ({
  listExpenses: vi.fn(),
  expenses: [
    {
      id: "expense-twd",
      user_id: "dev-user",
      item_name: "午餐",
      expense_date: "2026-08-21",
      amount: 100,
      currency_code: "TWD",
      category_id: "category-food",
      note: "",
      exchange_rate_to_twd: 1,
      amount_twd: 100,
      expense_type: "general",
      parent_expense_id: null,
      amortization_unit: null,
      amortization_periods: null,
      amortization_start_date: null,
      amortization_sequence: null,
      created_at: "2026-08-21",
      updated_at: "2026-08-21",
      categories: { id: "category-food", name: "飲食", is_active: true },
    },
    {
      id: "expense-jpy",
      user_id: "dev-user",
      item_name: "日本車票",
      expense_date: "2026-08-20",
      amount: 1000,
      currency_code: "JPY",
      category_id: "category-transit",
      note: "",
      exchange_rate_to_twd: 0.22,
      amount_twd: 220,
      expense_type: "general",
      parent_expense_id: null,
      amortization_unit: null,
      amortization_periods: null,
      amortization_start_date: null,
      amortization_sequence: null,
      created_at: "2026-08-20",
      updated_at: "2026-08-20",
      categories: { id: "category-transit", name: "交通", is_active: true },
      tags: [{ id: "tag-travel", name: "旅遊" }],
    },
    {
      id: "expense-prepaid",
      user_id: "dev-user",
      item_name: "年度保險",
      expense_date: "2026-08-01",
      amount: 1200,
      currency_code: "TWD",
      category_id: "category-insurance",
      note: "",
      exchange_rate_to_twd: 1,
      amount_twd: 1200,
      expense_type: "prepaid",
      parent_expense_id: null,
      amortization_unit: "month",
      amortization_periods: 12,
      amortization_start_date: "2026-08-01",
      amortization_sequence: null,
      created_at: "2026-08-01",
      updated_at: "2026-08-01",
      categories: { id: "category-insurance", name: "保險", is_active: true },
    },
    {
      id: "expense-amortized",
      user_id: "dev-user",
      item_name: "年度保險攤提",
      expense_date: "2026-08-01",
      amount: 100,
      currency_code: "TWD",
      category_id: "category-insurance",
      note: "",
      exchange_rate_to_twd: 1,
      amount_twd: 100,
      expense_type: "amortized",
      parent_expense_id: "expense-prepaid",
      amortization_unit: null,
      amortization_periods: null,
      amortization_start_date: null,
      amortization_sequence: 1,
      created_at: "2026-08-01",
      updated_at: "2026-08-01",
      categories: { id: "category-insurance", name: "保險", is_active: true },
    },
  ],
}));

vi.mock("@/lib/data", () => ({
  listExpenses: listExpenses.mockResolvedValue(expenses),
  listCategories: vi.fn().mockResolvedValue([]),
  listCurrencies: vi.fn().mockResolvedValue([]),
  listTags: vi.fn().mockResolvedValue([{ id: "tag-travel", user_id: "dev-user", name: "旅遊", is_active: false, sort_order: 0, created_at: "2026-08-21", updated_at: "2026-08-21" }]),
  listExpenseFamily: vi.fn().mockResolvedValue([]),
  deleteExpense: vi.fn(),
}));

vi.mock("../csv-tools", () => ({ CsvTools: () => null }));
vi.mock("../expense-form", () => ({ ExpenseForm: () => null }));

describe("ExpensesManager", () => {
  afterEach(cleanup);
  it("shows TWD on the right and only labels converted foreign-currency expenses", async () => {
    render(<ExpensesManager />);

    const twdArticle = (await screen.findByText("午餐")).closest("article")!;
    const jpyArticle = (await screen.findByText("日本車票")).closest("article")!;

    expect(within(twdArticle).getByText(formatMoney(100, "TWD"))).toBeTruthy();
    expect(within(twdArticle).queryByText(/換算/)).toBeNull();

    expect(within(jpyArticle).getByText(formatMoney(1000, "JPY"))).toBeTruthy();
    expect(within(jpyArticle).getByText(formatMoney(220, "TWD"))).toBeTruthy();
    expect(within(jpyArticle).getByText("換算")).toBeTruthy();
    expect(within(jpyArticle).getByText("#旅遊")).toBeTruthy();
  });

  it("applies the selected optional tag filter", async () => {
    render(<ExpensesManager />);
    await screen.findByText("日本車票");
    fireEvent.change(screen.getByLabelText("Tag"), { target: { value: "tag-travel" } });
    fireEvent.click(screen.getByRole("button", { name: /套用篩選/ }));
    await waitFor(() => expect(listExpenses).toHaveBeenLastCalledWith(expect.objectContaining({ tagId: "tag-travel" })));
  });

  it("shows related expenses as immutable and only lets the prepaid parent be deleted", async () => {
    render(<ExpensesManager />);

    const parent = (await screen.findByText("年度保險")).closest("article")!;
    const child = (await screen.findByText("年度保險攤提")).closest("article")!;

    expect(within(parent).queryByLabelText("編輯帳目")).toBeNull();
    expect(within(parent).getByLabelText("查看預付攤提明細")).toBeTruthy();
    expect(within(parent).getByLabelText("永久刪除預付與攤提")).toBeTruthy();
    expect(within(child).queryByLabelText("編輯帳目")).toBeNull();
    expect(within(child).queryByLabelText(/永久刪除/)).toBeNull();
  });
});
