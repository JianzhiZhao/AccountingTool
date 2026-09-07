import { describe, expect, it } from "vitest";
import { monthlyAccountingTrend, summarizeAccounting, summarizeExpenses } from "../analytics";
import type { Expense } from "@/types/domain";

const base: Expense = { id: "1", user_id: "u", item_name: "午餐", expense_date: "2026-08-21", amount: 100, currency_code: "TWD", category_id: "c", note: "n", exchange_rate_to_twd: 1, amount_twd: 100, expense_type: "general", parent_expense_id: null, amortization_unit: null, amortization_periods: null, amortization_start_date: null, amortization_sequence: null, created_at: "", updated_at: "", categories: { id: "c", name: "餐飲", is_active: true } };
describe("expense summaries", () => {
  it("preserves original currency totals and converts TWD totals", () => { const result = summarizeExpenses([base, { ...base, id: "2", amount: 1000, currency_code: "JPY", exchange_rate_to_twd: 0.22, amount_twd: 220 }]); expect(result.totalTwd).toBe(320); expect(result.byCurrency).toEqual(expect.arrayContaining([{ name: "TWD", value: 100 }, { name: "JPY", value: 1000 }])); });
  it("groups by date, month, category and item", () => { const result = summarizeExpenses([base]); expect(result.byDate[0]).toEqual({ date: "2026-08-21", value: 100 }); expect(result.byMonth[0]).toEqual({ date: "2026-08", value: 100 }); expect(result.byCategory[0]).toEqual({ name: "餐飲", value: 100 }); });
  it("separates cash flow, expense recognition and closing prepaid balance", () => {
    const prepaid = { ...base, id: "p", expense_type: "prepaid" as const, amount: 1200, amount_twd: 1200, amortization_unit: "month" as const, amortization_periods: 12, amortization_start_date: "2026-08-01" };
    const amortized = { ...base, id: "a", expense_type: "amortized" as const, parent_expense_id: "p", amount: 100, amount_twd: 100, amortization_sequence: 1 };
    const result = summarizeAccounting([base, prepaid, amortized], [prepaid, amortized]);
    expect(result).toEqual({ cashFlowTwd: 1300, recognizedExpenseTwd: 200, differenceTwd: 1100, prepaidBalanceTwd: 1100 });
  });
  it("builds monthly accounting trend series", () => {
    const prepaid = { ...base, id: "p", expense_type: "prepaid" as const };
    const amortized = { ...base, id: "a", expense_type: "amortized" as const, parent_expense_id: "p" };
    expect(monthlyAccountingTrend([prepaid, amortized])[0]).toEqual({ date: "2026-08", cashFlow: 100, recognized: 100, difference: 0 });
  });
});
