import { describe, expect, it } from "vitest";
import { amortizationDate, generateAmortizationSchedule } from "../amortization";

describe("amortization schedule", () => {
  it("includes the start date and advances daily", () => {
    expect(generateAmortizationSchedule({ amount: 3, startDate: "2026-01-31", unit: "day", periods: 3 }).map((item) => item.expense_date)).toEqual(["2026-01-31", "2026-02-01", "2026-02-02"]);
  });

  it("anchors monthly dates to the original day", () => {
    expect([1, 2, 3, 4].map((sequence) => amortizationDate("2025-01-30", "month", sequence))).toEqual(["2025-01-30", "2025-02-28", "2025-03-30", "2025-04-30"]);
  });

  it("keeps month-end schedules at month end across a leap year", () => {
    expect([1, 2, 3].map((sequence) => amortizationDate("2024-01-31", "month", sequence))).toEqual(["2024-01-31", "2024-02-29", "2024-03-31"]);
  });

  it("puts the integer remainder in the final installment", () => {
    const schedule = generateAmortizationSchedule({ amount: 100, startDate: "2026-01-01", unit: "month", periods: 3 });
    expect(schedule.map((item) => item.amount_text)).toEqual(["33", "33", "34"]);
    expect(schedule.every((item) => Number.isInteger(item.amount))).toBe(true);
    expect(schedule.reduce((total, item) => total + item.amount, 0)).toBe(100);
  });

  it("rejects a prepaid amount with decimals", () => {
    expect(() => generateAmortizationSchedule({ amount: 100.5, startDate: "2026-01-01", unit: "month", periods: 3 })).toThrow(/整數/);
  });

  it("rejects schedules that would contain zero installments", () => {
    expect(() => generateAmortizationSchedule({ amount: 1, startDate: "2026-01-01", unit: "day", periods: 2 })).toThrow(/期數過多/);
  });
});
