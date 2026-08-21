import { describe, expect, it } from "vitest";
import { summarizeExpenses } from "../analytics";
import type { Expense } from "@/types/domain";

const base: Expense = { id: "1", user_id: "u", item_name: "午餐", expense_date: "2026-08-21", amount: 100, currency_code: "TWD", category_id: "c", note: "n", exchange_rate_to_twd: 1, amount_twd: 100, created_at: "", updated_at: "", categories: { id: "c", name: "餐飲", is_active: true } };
describe("expense summaries", () => {
  it("preserves original currency totals and converts TWD totals", () => { const result = summarizeExpenses([base, { ...base, id: "2", amount: 1000, currency_code: "JPY", exchange_rate_to_twd: 0.22, amount_twd: 220 }]); expect(result.totalTwd).toBe(320); expect(result.byCurrency).toEqual(expect.arrayContaining([{ name: "TWD", value: 100 }, { name: "JPY", value: 1000 }])); });
  it("groups by date, month, category and item", () => { const result = summarizeExpenses([base]); expect(result.byDate[0]).toEqual({ date: "2026-08-21", value: 100 }); expect(result.byMonth[0]).toEqual({ date: "2026-08", value: 100 }); expect(result.byCategory[0]).toEqual({ name: "餐飲", value: 100 }); });
});
