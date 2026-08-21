import { describe, expect, it } from "vitest";
import { expensesToCsv, parseExpenseCsv } from "../csv";
import type { Expense } from "@/types/domain";

const expense: Expense = { id: "11111111-1111-4111-8111-111111111111", user_id: "u", item_name: "午餐", expense_date: "2026-08-21", amount: 120, currency_code: "TWD", category_id: "c", note: "現金", exchange_rate_to_twd: 1, amount_twd: 120, created_at: "2026-08-21T01:00:00.000Z", updated_at: "2026-08-21T01:00:00.000Z", categories: { id: "c", name: "餐飲", is_active: true }, tags: [{ id: "t1", name: "公司" }, { id: "t2", name: "聚餐" }] };
describe("CSV backup", () => {
  it("round trips the app export format with tags", () => { const parsed = parseExpenseCsv(expensesToCsv([expense]), new Set()); expect(parsed.errors).toHaveLength(0); expect(parsed.valid[0]).toMatchObject({ id: expense.id, item_name: "午餐", category_name: "餐飲", amount: 120, tag_names: ["公司", "聚餐"] }); });
  it("skips existing IDs", () => { const parsed = parseExpenseCsv(expensesToCsv([expense]), new Set([expense.id])); expect(parsed.valid).toHaveLength(0); expect(parsed.duplicate).toHaveLength(1); });
  it("flags a changed version", () => { const csv = expensesToCsv([expense]).replace("private-accounting-tool-v2", "unknown-v3"); expect(parseExpenseCsv(csv, new Set()).errors).toHaveLength(1); });
  it("keeps old v1 backups compatible when the tag_names column is absent", () => {
    const csv = [
      '"format_version","id","item_name","expense_date","amount","currency_code","category_name","note","exchange_rate_to_twd","created_at","updated_at"',
      `"private-accounting-tool-v1","${expense.id}","午餐","2026-08-21","120","TWD","餐飲","現金","1","2026-08-21T01:00:00.000Z","2026-08-21T01:00:00.000Z"`,
    ].join("\r\n");
    const parsed = parseExpenseCsv(csv, new Set());
    expect(parsed.errors).toHaveLength(0);
    expect(parsed.valid[0].tag_names).toEqual([]);
  });
  it("identifies duplicate IDs inside one file", () => { const csv = expensesToCsv([expense, expense]); const result = parseExpenseCsv(csv, new Set()); expect(result.valid).toHaveLength(1); expect(result.duplicate).toHaveLength(1); });
  it("accepts Supabase timestamps with explicit offsets", () => { const csv = expensesToCsv([{ ...expense, created_at: "2026-08-21T09:00:00+08:00", updated_at: "2026-08-21T09:00:00+08:00" }]); expect(parseExpenseCsv(csv, new Set()).valid).toHaveLength(1); });
});
