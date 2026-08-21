import type { Expense } from "@/types/domain";

export function summarizeExpenses(expenses: Expense[]) {
  const byCurrency: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byItem: Record<string, number> = {};
  const byDate: Record<string, number> = {};
  const byMonth: Record<string, number> = {};
  let totalTwd = 0;

  for (const expense of expenses) {
    const twd = Number(expense.amount) * Number(expense.exchange_rate_to_twd);
    totalTwd += twd;
    byCurrency[expense.currency_code] = (byCurrency[expense.currency_code] ?? 0) + Number(expense.amount);
    const category = expense.categories?.name ?? "未命名分類";
    byCategory[category] = (byCategory[category] ?? 0) + twd;
    byItem[expense.item_name] = (byItem[expense.item_name] ?? 0) + twd;
    byDate[expense.expense_date] = (byDate[expense.expense_date] ?? 0) + twd;
    const month = expense.expense_date.slice(0, 7);
    byMonth[month] = (byMonth[month] ?? 0) + twd;
  }

  const ranked = (values: Record<string, number>) => Object.entries(values)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return {
    totalTwd,
    byCurrency: ranked(byCurrency),
    byCategory: ranked(byCategory),
    byItem: ranked(byItem),
    byDate: Object.entries(byDate).map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date)),
    byMonth: Object.entries(byMonth).map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export const formatMoney = (amount: number, currency = "TWD") => new Intl.NumberFormat("zh-TW", {
  style: "currency", currency, maximumFractionDigits: currency === "TWD" || currency === "JPY" ? 0 : 2,
}).format(amount);
