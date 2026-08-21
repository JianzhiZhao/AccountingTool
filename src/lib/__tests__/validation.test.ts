import { describe, expect, it } from "vitest";
import { normalizeExpenseInput } from "../validation";

const valid = { item_name: "午餐", expense_date: "2026-08-21", amount: 120, currency_code: "TWD", category_id: "11111111-1111-4111-8111-111111111111", note: "公司附近", exchange_rate_to_twd: 1 };

describe("expense validation", () => {
  it("accepts a complete TWD expense", () => { expect(normalizeExpenseInput(valid)).toEqual(valid); });
  it("rejects zero amount", () => { expect(() => normalizeExpenseInput({ ...valid, amount: 0 })).toThrow(); });
  it("accepts an empty optional note", () => { expect(normalizeExpenseInput({ ...valid, note: "" }).note).toBe(""); });
  it("requires TWD rate to be one", () => { expect(() => normalizeExpenseInput({ ...valid, exchange_rate_to_twd: 0.9 })).toThrow(); });
  it("rejects a calendar date that does not exist", () => { expect(() => normalizeExpenseInput({ ...valid, expense_date: "2026-02-30" })).toThrow(); });
  it("accepts a positive foreign exchange rate", () => { expect(normalizeExpenseInput({ ...valid, currency_code: "JPY", exchange_rate_to_twd: 0.22 }).exchange_rate_to_twd).toBe(0.22); });
});
