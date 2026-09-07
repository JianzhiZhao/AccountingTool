import { z } from "zod";
import { amountToScaledUnits, amountToWholeUnits, MAX_DAILY_PERIODS, MAX_MONTHLY_PERIODS } from "@/lib/amortization";

export const tagIdsSchema = z.array(z.string().uuid("Tag 格式不正確")).default([]);
export const orderedIdsSchema = z.array(z.string().uuid("排序資料格式不正確")).max(500, "排序項目過多");
export const exchangeRateSchema = z.coerce.number().positive("匯率必須大於 0");

export const expenseInputSchema = z.object({
  item_name: z.string().trim().min(1, "請輸入項目名稱").max(100, "項目名稱最多 100 字"),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "請選擇有效日期").refine(isRealDate, "請選擇有效日期"),
  amount: z.coerce.number().positive("金額必須大於 0"),
  currency_code: z.string().regex(/^[A-Z]{3}$/, "請選擇有效幣別"),
  category_id: z.string().uuid("請選擇分類"),
  note: z.string().trim().max(500, "備註最多 500 字"),
  exchange_rate_to_twd: exchangeRateSchema,
  tag_ids: tagIdsSchema,
  expense_type: z.enum(["general", "prepaid"]).default("general"),
  amortization_unit: z.enum(["month", "day"]).nullable().optional(),
  amortization_periods: z.coerce.number().int("期數必須是整數").nullable().optional(),
  amortization_start_date: z.string().nullable().optional(),
}).superRefine((value, context) => {
  if (value.currency_code === "TWD" && value.exchange_rate_to_twd !== 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["exchange_rate_to_twd"], message: "TWD 匯率固定為 1" });
  }
  try { amountToScaledUnits(value.amount); }
  catch (error) { context.addIssue({ code: z.ZodIssueCode.custom, path: ["amount"], message: error instanceof Error ? error.message : "金額格式不正確" }); }
  if (value.expense_type === "general") {
    if (value.amortization_unit || value.amortization_periods || value.amortization_start_date) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["expense_type"], message: "一般帳目不可包含攤提設定" });
    }
    return;
  }
  try { amountToWholeUnits(value.amount); }
  catch (error) { context.addIssue({ code: z.ZodIssueCode.custom, path: ["amount"], message: error instanceof Error ? error.message : "預付金額必須是整數" }); }
  if (!value.amortization_unit) context.addIssue({ code: z.ZodIssueCode.custom, path: ["amortization_unit"], message: "請選擇攤提單位" });
  if (!value.amortization_start_date || !isRealDate(value.amortization_start_date)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["amortization_start_date"], message: "請選擇有效的攤提開始日期" });
  else if (value.amortization_start_date < value.expense_date) context.addIssue({ code: z.ZodIssueCode.custom, path: ["amortization_start_date"], message: "攤提開始日期不得早於付款日期" });
  if (value.amortization_periods == null) context.addIssue({ code: z.ZodIssueCode.custom, path: ["amortization_periods"], message: "請輸入攤提期數" });
  else if (value.amortization_unit) {
    const maximum = value.amortization_unit === "month" ? MAX_MONTHLY_PERIODS : MAX_DAILY_PERIODS;
    if (value.amortization_periods < 1 || value.amortization_periods > maximum) context.addIssue({ code: z.ZodIssueCode.custom, path: ["amortization_periods"], message: `期數必須介於 1 至 ${maximum}` });
    else {
      try { if (value.amortization_periods > amountToWholeUnits(value.amount)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["amortization_periods"], message: "期數過多，會產生金額為零的攤提" }); }
      catch { /* amount issue is reported above */ }
    }
  }
});

function isRealDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const categoryNameSchema = z.string().trim().min(1, "請輸入分類名稱").max(40, "分類名稱最多 40 字");
export const tagNameSchema = z.string().trim().min(1, "請輸入 Tag 名稱").max(30, "Tag 名稱最多 30 字");

export function normalizeExpenseInput(input: unknown) {
  const parsed = expenseInputSchema.parse(input);
  const prepaid = parsed.expense_type === "prepaid";
  return {
    ...parsed,
    exchange_rate_to_twd: parsed.currency_code === "TWD" ? 1 : parsed.exchange_rate_to_twd,
    amortization_unit: prepaid ? parsed.amortization_unit! : null,
    amortization_periods: prepaid ? parsed.amortization_periods! : null,
    amortization_start_date: prepaid ? parsed.amortization_start_date! : null,
  };
}
