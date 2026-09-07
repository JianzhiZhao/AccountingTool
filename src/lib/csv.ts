import Papa from "papaparse";
import { z } from "zod";
import { generateAmortizationSchedule } from "./amortization";
import { ISO_CURRENCIES } from "./constants";
import type { AmortizationUnit, Expense, ExpenseType } from "@/types/domain";

export const CSV_VERSION = "private-accounting-tool-v3";
const allowedCurrencies = new Set(ISO_CURRENCIES.map(([code]) => code));
const oldVersions = new Set(["private-accounting-tool-v1", "private-accounting-tool-v2"]);

export type CsvExpenseRow = {
  format_version: string;
  id: string;
  item_name: string;
  expense_date: string;
  amount: string;
  currency_code: string;
  category_name: string;
  tag_names: string;
  note: string;
  exchange_rate_to_twd: string;
  expense_type: string;
  parent_expense_id: string;
  amortization_unit: string;
  amortization_periods: string;
  amortization_start_date: string;
  amortization_sequence: string;
  created_at: string;
  updated_at: string;
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

const baseSchema = z.object({
  format_version: z.enum(["private-accounting-tool-v1", "private-accounting-tool-v2", CSV_VERSION]),
  id: z.string().uuid(),
  item_name: z.string().trim().min(1).max(100),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isRealDate),
  amount: z.coerce.number().positive(),
  currency_code: z.string().refine((code) => allowedCurrencies.has(code as typeof ISO_CURRENCIES[number][0])),
  category_name: z.string().trim().min(1).max(40),
  tag_names: tagNamesSchema,
  note: z.string().trim().max(500),
  exchange_rate_to_twd: z.coerce.number().positive(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
}).superRefine((row, context) => {
  if (row.currency_code === "TWD" && row.exchange_rate_to_twd !== 1) context.addIssue({ code: z.ZodIssueCode.custom, path: ["exchange_rate_to_twd"], message: "TWD 匯率必須為 1" });
});

const v3Schema = z.object({
  expense_type: z.enum(["general", "prepaid", "amortized"]),
  parent_expense_id: z.string().optional().default("").refine((value) => !value || z.string().uuid().safeParse(value).success, "父帳目 ID 格式不正確"),
  amortization_unit: z.string().optional().default("").refine((value) => !value || value === "month" || value === "day", "攤提單位不正確"),
  amortization_periods: z.string().optional().default("").refine((value) => !value || /^\d+$/.test(value), "攤提期數不正確"),
  amortization_start_date: z.string().optional().default("").refine((value) => !value || isRealDate(value), "攤提開始日期不正確"),
  amortization_sequence: z.string().optional().default("").refine((value) => !value || /^\d+$/.test(value), "攤提序號不正確"),
});

export type ParsedCsvRow = {
  format_version: string;
  id: string;
  item_name: string;
  expense_date: string;
  amount: number;
  currency_code: string;
  category_name: string;
  tag_names: string[];
  note: string;
  exchange_rate_to_twd: number;
  expense_type: ExpenseType;
  parent_expense_id: string | null;
  amortization_unit: AmortizationUnit | null;
  amortization_periods: number | null;
  amortization_start_date: string | null;
  amortization_sequence: number | null;
  created_at: string;
  updated_at: string;
  sourceRow: number;
};

export type CsvPreview = { valid: ParsedCsvRow[]; duplicate: ParsedCsvRow[]; errors: { row: number; message: string }[] };

export function expensesToCsv(expenses: Expense[]) {
  const rows: CsvExpenseRow[] = expenses.map((expense) => ({
    format_version: CSV_VERSION,
    id: expense.id,
    item_name: expense.item_name,
    expense_date: expense.expense_date,
    amount: String(expense.amount),
    currency_code: expense.currency_code,
    category_name: expense.categories?.name ?? "未命名分類",
    tag_names: JSON.stringify(expense.tags?.map((tag) => tag.name) ?? []),
    note: expense.note,
    exchange_rate_to_twd: String(expense.exchange_rate_to_twd),
    expense_type: expense.expense_type ?? "general",
    parent_expense_id: expense.parent_expense_id ?? "",
    amortization_unit: expense.amortization_unit ?? "",
    amortization_periods: expense.amortization_periods == null ? "" : String(expense.amortization_periods),
    amortization_start_date: expense.amortization_start_date ?? "",
    amortization_sequence: expense.amortization_sequence == null ? "" : String(expense.amortization_sequence),
    created_at: expense.created_at,
    updated_at: expense.updated_at,
  }));
  return Papa.unparse(rows, { quotes: true, newline: "\r\n" });
}

export function parseExpenseCsv(text: string, existingIds: Set<string>): CsvPreview {
  const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: "greedy" });
  const valid: ParsedCsvRow[] = []; const duplicate: ParsedCsvRow[] = []; const errors: { row: number; message: string }[] = [];
  for (const error of parsed.errors) errors.push({ row: (error.row ?? 0) + 2, message: error.message });
  const seenIds = new Set(existingIds);
  parsed.data.forEach((raw, index) => {
    const sourceRow = index + 2;
    const base = baseSchema.safeParse(raw);
    if (!base.success) { errors.push({ row: sourceRow, message: issueMessage(base.error) }); return; }
    let relationship: Pick<ParsedCsvRow, "expense_type" | "parent_expense_id" | "amortization_unit" | "amortization_periods" | "amortization_start_date" | "amortization_sequence">;
    if (oldVersions.has(base.data.format_version)) {
      relationship = { expense_type: "general", parent_expense_id: null, amortization_unit: null, amortization_periods: null, amortization_start_date: null, amortization_sequence: null };
    } else {
      const v3 = v3Schema.safeParse(raw);
      if (!v3.success) { errors.push({ row: sourceRow, message: issueMessage(v3.error) }); return; }
      relationship = {
        expense_type: v3.data.expense_type,
        parent_expense_id: v3.data.parent_expense_id || null,
        amortization_unit: (v3.data.amortization_unit || null) as AmortizationUnit | null,
        amortization_periods: v3.data.amortization_periods ? Number(v3.data.amortization_periods) : null,
        amortization_start_date: v3.data.amortization_start_date || null,
        amortization_sequence: v3.data.amortization_sequence ? Number(v3.data.amortization_sequence) : null,
      };
      const relationshipError = validateRelationship(base.data, relationship);
      if (relationshipError) { errors.push({ row: sourceRow, message: relationshipError }); return; }
    }
    const row = { ...base.data, ...relationship, sourceRow } as ParsedCsvRow;
    if (seenIds.has(row.id)) duplicate.push(row); else { valid.push(row); seenIds.add(row.id); }
  });
  return { valid, duplicate, errors };
}

export function validatePrepaidCsvGroup(rows: ParsedCsvRow[]) {
  const parents = rows.filter((row) => row.expense_type === "prepaid");
  if (parents.length !== 1) return "每個預付群組必須包含一筆父帳";
  if (new Set(rows.map((row) => row.id)).size !== rows.length) return "預付群組包含重複的帳目 ID";
  const parent = parents[0];
  if (!parent.amortization_unit || !parent.amortization_periods || !parent.amortization_start_date) return "預付父帳缺少攤提設定";
  const children = rows.filter((row) => row.expense_type === "amortized").sort((a, b) => Number(a.amortization_sequence) - Number(b.amortization_sequence));
  let schedule;
  try { schedule = generateAmortizationSchedule({ amount: parent.amount, startDate: parent.amortization_start_date, unit: parent.amortization_unit, periods: parent.amortization_periods }); }
  catch (error) { return error instanceof Error ? error.message : "預付排程不正確"; }
  if (children.length !== schedule.length || rows.length !== children.length + 1) return "攤提子帳數量與父帳期數不一致";
  const parentTags = [...parent.tag_names].sort().join("\u0000");
  for (let index = 0; index < children.length; index++) {
    const child = children[index]; const expected = schedule[index];
    if (child.parent_expense_id !== parent.id || child.amortization_sequence !== expected.sequence) return "攤提父子關聯或期別序號不正確";
    if (child.expense_date !== expected.expense_date || String(child.amount) !== expected.amount_text) return "攤提日期或金額與父帳排程不一致";
    if (child.item_name !== parent.item_name || child.currency_code !== parent.currency_code || child.category_name !== parent.category_name || child.note !== parent.note || child.exchange_rate_to_twd !== parent.exchange_rate_to_twd) return "攤提子帳未完整繼承父帳資料";
    if ([...child.tag_names].sort().join("\u0000") !== parentTags) return "攤提子帳 Tag 與父帳不一致";
  }
  return "";
}

function validateRelationship(base: z.infer<typeof baseSchema>, relationship: Pick<ParsedCsvRow, "expense_type" | "parent_expense_id" | "amortization_unit" | "amortization_periods" | "amortization_start_date" | "amortization_sequence">) {
  if (relationship.expense_type === "general") {
    if (relationship.parent_expense_id || relationship.amortization_unit || relationship.amortization_periods || relationship.amortization_start_date || relationship.amortization_sequence) return "一般帳目不可包含攤提欄位";
    return "";
  }
  if (relationship.expense_type === "prepaid") {
    if (relationship.parent_expense_id || relationship.amortization_sequence) return "預付帳目不可包含父帳或期別序號";
    if (!Number.isInteger(base.amount)) return "預付金額必須是整數，攤提每期金額才會是整數";
    if (!relationship.amortization_unit || !relationship.amortization_periods || !relationship.amortization_start_date) return "預付帳目缺少攤提設定";
    if (relationship.amortization_start_date < base.expense_date) return "攤提開始日期不得早於付款日期";
    try { generateAmortizationSchedule({ amount: base.amount, startDate: relationship.amortization_start_date, unit: relationship.amortization_unit, periods: relationship.amortization_periods }); }
    catch (error) { return error instanceof Error ? error.message : "攤提設定不正確"; }
    return "";
  }
  if (!relationship.parent_expense_id || !relationship.amortization_sequence) return "攤提帳目缺少父帳或期別序號";
  if (relationship.amortization_unit || relationship.amortization_periods || relationship.amortization_start_date) return "攤提設定只能保存在預付父帳";
  return "";
}

function isRealDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function issueMessage(error: z.ZodError) {
  return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("；");
}
