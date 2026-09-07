import { describe, expect, it } from "vitest";
import { normalizeExpenseInput } from "../validation";

const valid = { item_name: "午餐", expense_date: "2026-08-21", amount: 120, currency_code: "TWD", category_id: "11111111-1111-4111-8111-111111111111", note: "公司附近", exchange_rate_to_twd: 1 };

describe("expense validation", () => {
  it("accepts a complete TWD expense with optional tags omitted", () => { expect(normalizeExpenseInput(valid)).toEqual({ ...valid, tag_ids: [], expense_type: "general", amortization_unit: null, amortization_periods: null, amortization_start_date: null }); });
  it("accepts multiple optional tags", () => { const tagIds = ["22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"]; expect(normalizeExpenseInput({ ...valid, tag_ids: tagIds }).tag_ids).toEqual(tagIds); });
  it("rejects zero amount", () => { expect(() => normalizeExpenseInput({ ...valid, amount: 0 })).toThrow(); });
  it("accepts an empty optional note", () => { expect(normalizeExpenseInput({ ...valid, note: "" }).note).toBe(""); });
  it("requires TWD rate to be one", () => { expect(() => normalizeExpenseInput({ ...valid, exchange_rate_to_twd: 0.9 })).toThrow(); });
  it("rejects a calendar date that does not exist", () => { expect(() => normalizeExpenseInput({ ...valid, expense_date: "2026-02-30" })).toThrow(); });
  it("accepts a positive foreign exchange rate", () => { expect(normalizeExpenseInput({ ...valid, currency_code: "JPY", exchange_rate_to_twd: 0.22 }).exchange_rate_to_twd).toBe(0.22); });
  it("accepts a valid prepaid schedule", () => { expect(normalizeExpenseInput({ ...valid, expense_type: "prepaid", amortization_unit: "month", amortization_periods: 12, amortization_start_date: "2026-08-21" }).expense_type).toBe("prepaid"); });
  it("requires prepaid amounts to be integers", () => { expect(() => normalizeExpenseInput({ ...valid, amount: 120.5, expense_type: "prepaid", amortization_unit: "month", amortization_periods: 12, amortization_start_date: "2026-08-21" })).toThrow(/整數/); });
  it("rejects a prepaid start date before payment", () => { expect(() => normalizeExpenseInput({ ...valid, expense_type: "prepaid", amortization_unit: "month", amortization_periods: 12, amortization_start_date: "2026-08-20" })).toThrow(/不得早於/); });
  it("rejects more than four amount decimals", () => { expect(() => normalizeExpenseInput({ ...valid, amount: 1.00001 })).toThrow(/4 位小數/); });
});
