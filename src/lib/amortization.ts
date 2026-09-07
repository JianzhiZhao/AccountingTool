import type { AmortizationUnit } from "@/types/domain";

export const AMOUNT_SCALE = 4;
export const MAX_MONTHLY_PERIODS = 120;
export const MAX_DAILY_PERIODS = 366;

export type AmortizationScheduleItem = {
  sequence: number;
  expense_date: string;
  amount: number;
  amount_text: string;
};

export function amountToScaledUnits(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("金額必須大於 0");
  const fixed = amount.toFixed(AMOUNT_SCALE);
  if (Math.abs(Number(fixed) - amount) > 1e-9) throw new Error("金額最多只能有 4 位小數");
  const units = Number(fixed.replace(".", ""));
  if (!Number.isSafeInteger(units)) throw new Error("金額超出可安全分配的範圍");
  return units;
}

export function amountToWholeUnits(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("金額必須大於 0");
  if (!Number.isInteger(amount)) throw new Error("預付金額必須是整數，攤提每期金額才會是整數");
  if (!Number.isSafeInteger(amount)) throw new Error("金額超出可安全分配的範圍");
  return amount;
}

export function amortizationDate(startDate: string, unit: AmortizationUnit, sequence: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || sequence < 1 || !Number.isInteger(sequence)) throw new Error("攤提日期資料不正確");
  const [year, month, day] = startDate.split("-").map(Number);
  if (unit === "day") {
    const date = new Date(Date.UTC(year, month - 1, day + sequence - 1));
    return formatDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  const monthIndex = year * 12 + month - 1 + sequence - 1;
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = monthIndex % 12 + 1;
  const startWasMonthEnd = day === daysInMonth(year, month);
  const targetDay = startWasMonthEnd ? daysInMonth(targetYear, targetMonth) : Math.min(day, daysInMonth(targetYear, targetMonth));
  return formatDate(targetYear, targetMonth, targetDay);
}

export function generateAmortizationSchedule(input: { amount: number; startDate: string; unit: AmortizationUnit; periods: number }) {
  const maximum = input.unit === "month" ? MAX_MONTHLY_PERIODS : MAX_DAILY_PERIODS;
  if (!Number.isInteger(input.periods) || input.periods < 1 || input.periods > maximum) {
    throw new Error(input.unit === "month" ? `月攤提期數必須介於 1 至 ${MAX_MONTHLY_PERIODS}` : `日攤提期數必須介於 1 至 ${MAX_DAILY_PERIODS}`);
  }
  const totalUnits = amountToWholeUnits(input.amount);
  if (input.periods > totalUnits) throw new Error("期數過多，會產生金額為零的攤提");
  const regularUnits = Math.floor(totalUnits / input.periods);

  return Array.from({ length: input.periods }, (_, index): AmortizationScheduleItem => {
    const sequence = index + 1;
    const units = sequence === input.periods ? totalUnits - regularUnits * (input.periods - 1) : regularUnits;
    const amountText = String(units);
    return {
      sequence,
      expense_date: amortizationDate(input.startDate, input.unit, sequence),
      amount: Number(amountText),
      amount_text: amountText,
    };
  });
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
