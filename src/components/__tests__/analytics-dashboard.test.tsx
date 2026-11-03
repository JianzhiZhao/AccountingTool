// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnalyticsDashboard } from "../analytics-dashboard";
import { listExpenses } from "@/lib/data";
import type { Expense } from "@/types/domain";

vi.mock("@/lib/data", () => ({ listExpenses: vi.fn() }));
vi.mock("recharts", () => {
  const Component = () => null;
  return { Bar: Component, BarChart: Component, CartesianGrid: Component, Legend: Component, Line: Component, LineChart: Component, ResponsiveContainer: Component, Tooltip: Component, XAxis: Component, YAxis: Component };
});

const base: Expense = {
  id: "expense-1", user_id: "user-1", item_name: "午餐", expense_date: "2026-08-21", amount: 100,
  currency_code: "TWD", category_id: "category-1", note: "", exchange_rate_to_twd: 1, amount_twd: 100,
  expense_type: "general", parent_expense_id: null, amortization_unit: null, amortization_periods: null,
  amortization_start_date: null, amortization_sequence: null, created_at: "2026-08-21", updated_at: "2026-08-21",
  categories: { id: "category-1", name: "餐飲", is_active: true },
};

function renderDashboard(rows: Expense[]) {
  vi.mocked(listExpenses).mockResolvedValue(rows);
  return render(<AnalyticsDashboard />);
}

function visibleExpenseIds() {
  return screen.getAllByRole("link").map((link) => new URL(link.getAttribute("href")!, "http://localhost").searchParams.get("expense"));
}

describe("AnalyticsDashboard expense list", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("fills the start and end dates for the selected year and month", async () => {
    renderDashboard([base]);
    await screen.findByRole("link", { name: /午餐/ });

    fireEvent.change(screen.getByLabelText("選擇月份"), { target: { value: "2024-02" } });

    expect((screen.getByLabelText("開始日期") as HTMLInputElement).value).toBe("2024-02-01");
    expect((screen.getByLabelText("結束日期") as HTMLInputElement).value).toBe("2024-02-29");

    fireEvent.change(screen.getByLabelText("選擇月份"), { target: { value: "2026-11" } });
    expect((screen.getByLabelText("開始日期") as HTMLInputElement).value).toBe("2026-11-01");
    expect((screen.getByLabelText("結束日期") as HTMLInputElement).value).toBe("2026-11-30");
  });

  it("keeps duplicate item names separate and paginates every 20 expenses", async () => {
    const rows = Array.from({ length: 21 }, (_, index) => ({
      ...base,
      id: `expense-${index + 1}`,
      item_name: index < 2 ? "同名項目" : `帳目 ${index + 1}`,
      amount: index < 2 ? 100 : 21 - index,
      amount_twd: index < 2 ? 100 : 21 - index,
    }));
    renderDashboard(rows);

    expect(await screen.findAllByText("同名項目")).toHaveLength(2);
    expect(screen.getAllByRole("link")).toHaveLength(20);
    expect(visibleExpenseIds()).not.toContain("expense-21");
    expect(screen.getByText("第 1 / 2 頁")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "下一頁" }));
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(visibleExpenseIds()).toEqual(["expense-21"]);
  });

  it("sorts by amount or date in either direction and links to the original expense", async () => {
    const rows = [
      { ...base, id: "a", item_name: "A", amount: 100, amount_twd: 100, expense_date: "2026-08-03" },
      { ...base, id: "b", item_name: "B", amount: 300, amount_twd: 300, expense_date: "2026-08-01" },
      { ...base, id: "c", item_name: "C", amount: 200, amount_twd: 200, expense_date: "2026-08-02" },
    ];
    renderDashboard(rows);

    await screen.findByRole("link", { name: /B/ });
    expect(visibleExpenseIds()).toEqual(["b", "c", "a"]);
    expect(screen.getByRole("link", { name: /B/ }).getAttribute("href")).toBe("/app/expenses?expense=b");

    fireEvent.change(screen.getByLabelText("項目排序方式"), { target: { value: "date" } });
    expect(visibleExpenseIds()).toEqual(["a", "c", "b"]);
    fireEvent.change(screen.getByLabelText("項目排序順序"), { target: { value: "asc" } });
    expect(visibleExpenseIds()).toEqual(["b", "c", "a"]);

    fireEvent.change(screen.getByLabelText("項目排序方式"), { target: { value: "amount" } });
    expect(visibleExpenseIds()).toEqual(["a", "c", "b"]);
  });
});


