import Papa from "papaparse";
import { z } from "zod";
import { ISO_CURRENCIES } from "./constants";
import type { Expense } from "@/types/domain";

export const CSV_VERSION = "private-accounting-tool-v2";
const allowedCurrencies = new Set(ISO_CURRENCIES.map(([code]) => code));

export type CsvExpenseRow = {
  format_version: string; id: string; item_name: string; expense_date: string; amount: string; currency_code: string;
  category_name: string; tag_names: string; note: string; exchange_rate_to_twd: string; created_at: string; updated_at: string;
};

const tagNamesSchema = z.string().optional().default("[]").transform((value, context) => {
  try {
    const parsed = JSON.parse(value || "[]");
    if (!Array.isArray(parsed) || parsed.some((name) => typeof name !== "string" || !name.trim() || name.trim().length > 30)) throw new Error();
    return [...new Set(parsed.map((name) => name.trim()))];
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Tag 格式不正確" });
    return z.NEVER;
  }
});

const rowSchema = z.object({
  format_version: z.enum(["private-accounting-tool-v1", CSV_VERSION]), id: z.string().uuid(), item_name: z.string().trim().min(1).max(100),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => { const date = new Date(`${value}T00:00:00Z`); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value; }), amount: z.coerce.number().positive(),
  currency_code: z.string().refine((code) => allowedCurrencies.has(code as typeof ISO_CURRENCIES[number][0])),
  category_name: z.string().trim().min(1).max(40), tag_names: tagNamesSchema, note: z.string().trim().max(500),
  exchange_rate_to_twd: z.coerce.number().positive(), created_at: z.string().datetime({ offset: true }), updated_at: z.string().datetime({ offset: true }),
}).superRefine((row, context) => { if (row.currency_code === "TWD" && row.exchange_rate_to_twd !== 1) context.addIssue({ code: z.ZodIssueCode.custom, path: ["exchange_rate_to_twd"], message: "TWD 匯率必須為 1" }); });

export type ParsedCsvRow = z.infer<typeof rowSchema> & { sourceRow: number };
export type CsvPreview = { valid: ParsedCsvRow[]; duplicate: ParsedCsvRow[]; errors: { row: number; message: string }[] };

export function expensesToCsv(expenses: Expense[]) {
  const rows: CsvExpenseRow[] = expenses.map((expense) => ({ format_version: CSV_VERSION, id: expense.id, item_name: expense.item_name, expense_date: expense.expense_date, amount: String(expense.amount), currency_code: expense.currency_code, category_name: expense.categories?.name ?? "未命名分類", tag_names: JSON.stringify(expense.tags?.map((tag) => tag.name) ?? []), note: expense.note, exchange_rate_to_twd: String(expense.exchange_rate_to_twd), created_at: expense.created_at, updated_at: expense.updated_at }));
  return Papa.unparse(rows, { quotes: true, newline: "\r\n" });
}

export function parseExpenseCsv(text: string, existingIds: Set<string>): CsvPreview {
  const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: "greedy" });
  const valid: ParsedCsvRow[] = []; const duplicate: ParsedCsvRow[] = []; const errors: { row: number; message: string }[] = [];
  for (const error of parsed.errors) errors.push({ row: (error.row ?? 0) + 2, message: error.message });
  const seenIds = new Set(existingIds);
  parsed.data.forEach((raw, index) => { const result = rowSchema.safeParse(raw); if (!result.success) { errors.push({ row: index + 2, message: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("；") }); return; } const row = { ...result.data, sourceRow: index + 2 }; if (seenIds.has(row.id)) duplicate.push(row); else { valid.push(row); seenIds.add(row.id); } });
  return { valid, duplicate, errors };
}
