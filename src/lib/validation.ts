import { z } from "zod";

export const tagIdsSchema = z.array(z.string().uuid("Tag 格式不正確")).default([]);
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
}).superRefine((value, context) => {
  if (value.currency_code === "TWD" && value.exchange_rate_to_twd !== 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["exchange_rate_to_twd"], message: "TWD 匯率固定為 1" });
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
  return { ...parsed, exchange_rate_to_twd: parsed.currency_code === "TWD" ? 1 : parsed.exchange_rate_to_twd };
}
