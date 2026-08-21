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
      created_at: "2026-08-20",
      updated_at: "2026-08-20",
      categories: { id: "category-transit", name: "交通", is_active: true },
      tags: [{ id: "tag-travel", name: "旅遊" }],
    },
  ],
}));

vi.mock("@/lib/data", () => ({
  listExpenses: listExpenses.mockResolvedValue(expenses),
  listCategories: vi.fn().mockResolvedValue([]),
  listCurrencies: vi.fn().mockResolvedValue([]),
  listTags: vi.fn().mockResolvedValue([{ id: "tag-travel", user_id: "dev-user", name: "旅遊", created_at: "2026-08-21", updated_at: "2026-08-21" }]),
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
});
