import { describe, expect, it } from "vitest";
import { expensesToCsv, parseExpenseCsv } from "../csv";
import type { Expense } from "@/types/domain";

const expense: Expense = { id: "11111111-1111-4111-8111-111111111111", user_id: "u", item_name: "午餐", expense_date: "2026-08-21", amount: 120, currency_code: "TWD", category_id: "c", note: "現金", exchange_rate_to_twd: 1, amount_twd: 120, created_at: "2026-08-21T01:00:00.000Z", updated_at: "2026-08-21T01:00:00.000Z", categories: { id: "c", name: "餐飲", is_active: true } };
describe("CSV backup", () => {
  it("round trips the app export format", () => { const parsed = parseExpenseCsv(expensesToCsv([expense]), new Set()); expect(parsed.errors).toHaveLength(0); expect(parsed.valid[0]).toMatchObject({ id: expense.id, item_name: "午餐", category_name: "餐飲", amount: 120 }); });
  it("skips existing IDs", () => { const parsed = parseExpenseCsv(expensesToCsv([expense]), new Set([expense.id])); expect(parsed.valid).toHaveLength(0); expect(parsed.duplicate).toHaveLength(1); });
  it("flags a changed version", () => { const csv = expensesToCsv([expense]).replace("private-accounting-tool-v1", "unknown-v2"); expect(parseExpenseCsv(csv, new Set()).errors).toHaveLength(1); });
  it("identifies duplicate IDs inside one file", () => { const csv = expensesToCsv([expense, expense]); const result = parseExpenseCsv(csv, new Set()); expect(result.valid).toHaveLength(1); expect(result.duplicate).toHaveLength(1); });
  it("accepts Supabase timestamps with explicit offsets", () => { const csv = expensesToCsv([{ ...expense, created_at: "2026-08-21T09:00:00+08:00", updated_at: "2026-08-21T09:00:00+08:00" }]); expect(parseExpenseCsv(csv, new Set()).valid).toHaveLength(1); });
});
