"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Check, FileSpreadsheet, LoaderCircle, X } from "lucide-react";
import { insertImportedExpense, insertImportedExpenseGroup, listCategories, listExpenseFamily, listExpenses, listTags, saveCategory, saveTag, toggleCurrency } from "@/lib/data";
import { expensesToCsv, parseExpenseCsv, validatePrepaidCsvGroup, type CsvPreview, type ParsedCsvRow } from "@/lib/csv";
import { todayInTaipei } from "@/lib/date";
import type { Expense, ImportedExpenseRecord } from "@/types/domain";

export function CsvTools({ expenses, onImported, exportButton, importButton }: { expenses: Expense[]; onImported: () => void; exportButton: React.ReactNode; importButton: React.ReactNode }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [existingIds, setExistingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");

  async function download() {
    setLoading(true); setResult("");
    try {
      const output = new Map<string, Expense>();
      const loadedRoots = new Set<string>();
      for (const expense of expenses) {
        if (expense.expense_type === "general") { output.set(expense.id, expense); continue; }
        const rootId = expense.parent_expense_id ?? expense.id;
        if (loadedRoots.has(rootId)) continue;
        loadedRoots.add(rootId);
        const family = await listExpenseFamily(rootId);
        family.forEach((row) => output.set(row.id, row));
      }
      const rows = [...output.values()];
      const blob = new Blob(["\uFEFF", expensesToCsv(rows)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = `expenses-${todayInTaipei()}.csv`; link.click(); URL.revokeObjectURL(url);
      const related = rows.length - expenses.length;
      setResult(related > 0 ? `已匯出 ${rows.length} 筆，另加入 ${related} 筆關聯帳目。` : `已匯出 ${rows.length} 筆帳目。`);
    } catch { setResult("匯出失敗，請稍後再試。"); }
    finally { setLoading(false); }
  }

  async function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    setLoading(true); setResult("");
    try {
      const [text, existing] = await Promise.all([file.text(), listExpenses({ includeFutureAmortized: true })]);
      const ids = existing.map((expense) => expense.id); setExistingIds(ids);
      setPreview(parseExpenseCsv(text.replace(/^\uFEFF/, ""), new Set(ids)));
    } catch { setResult("無法讀取 CSV，請確認檔案來自本站匯出。"); }
    finally { setLoading(false); }
  }

  async function runImport() {
    if (!preview) return;
    setLoading(true); let success = 0; let failed = 0; let skipped = 0; const groupMessages: string[] = [];
    try {
      const [categories, tags] = await Promise.all([listCategories(true), listTags(true)]);
      const categoryMap = new Map(categories.map((category) => [keyOf(category.name), category.id]));
      const tagMap = new Map(tags.map((tag) => [keyOf(tag.name), tag.id]));

      const resolveRow = async (row: ParsedCsvRow): Promise<ImportedExpenseRecord> => {
        const categoryKey = keyOf(row.category_name); let categoryId = categoryMap.get(categoryKey);
        if (!categoryId) { await saveCategory(row.category_name); const created = (await listCategories(true)).find((category) => keyOf(category.name) === categoryKey); if (!created) throw new Error("分類建立失敗"); categoryId = created.id; categoryMap.set(categoryKey, created.id); }
        const tagIds: string[] = [];
        for (const tagName of row.tag_names) {
          const tagKey = keyOf(tagName); let tagId = tagMap.get(tagKey);
          if (!tagId) { await saveTag(tagName); const created = (await listTags(true)).find((tag) => keyOf(tag.name) === tagKey); if (!created) throw new Error("Tag 建立失敗"); tagId = created.id; tagMap.set(tagKey, created.id); }
          tagIds.push(tagId);
        }
        await toggleCurrency(row.currency_code, true);
        return { ...row, category_id: categoryId, tag_ids: tagIds };
      };

      for (const row of preview.valid.filter((item) => item.expense_type === "general")) {
        try {
          const resolved = await resolveRow(row);
          await insertImportedExpense(row.id, { item_name: row.item_name, expense_date: row.expense_date, amount: row.amount, currency_code: row.currency_code, category_id: resolved.category_id, note: row.note, exchange_rate_to_twd: row.currency_code === "TWD" ? 1 : row.exchange_rate_to_twd, tag_ids: resolved.tag_ids, expense_type: "general" }, row.created_at, row.updated_at);
          success++;
        } catch { failed++; }
      }
      skipped += preview.duplicate.filter((row) => row.expense_type === "general").length;

      const relatedRows = [...preview.valid, ...preview.duplicate].filter((row) => row.expense_type !== "general");
      const groups = new Map<string, ParsedCsvRow[]>();
      for (const row of relatedRows) { const rootId = row.expense_type === "prepaid" ? row.id : row.parent_expense_id ?? `missing-${row.id}`; groups.set(rootId, [...(groups.get(rootId) ?? []), row]); }
      const existing = new Set(existingIds);
      for (const [rootId, rows] of groups) {
        const ids = new Set(rows.map((row) => row.id)); const existingCount = [...ids].filter((id) => existing.has(id)).length;
        if (ids.size !== rows.length) { failed += rows.length; groupMessages.push(`${rootId}：群組內 ID 重複`); continue; }
        if (existingCount === ids.size) { skipped += rows.length; continue; }
        if (existingCount > 0) { failed += rows.length; groupMessages.push(`${rootId}：只有部分帳目已存在`); continue; }
        const validationError = validatePrepaidCsvGroup(rows);
        if (validationError) { failed += rows.length; groupMessages.push(`${rootId}：${validationError}`); continue; }
        try { await insertImportedExpenseGroup(await Promise.all(rows.map(resolveRow))); success += rows.length; }
        catch { failed += rows.length; groupMessages.push(`${rootId}：寫入失敗`); }
      }

      setResult(`匯入完成：成功 ${success} 筆、重複跳過 ${skipped} 筆、格式錯誤 ${preview.errors.length} 筆、寫入失敗 ${failed} 筆。${groupMessages.length ? ` ${groupMessages.slice(0, 2).join("；")}` : ""}`);
      setPreview(null); onImported();
    } finally { setLoading(false); }
  }

  return <>
    <button className="btn-secondary" type="button" onClick={download} disabled={!expenses.length || loading}>{loading ? <LoaderCircle className="animate-spin" size={17} /> : exportButton}</button>
    <button className="btn-secondary" type="button" onClick={() => inputRef.current?.click()} disabled={loading}>{importButton}</button>
    <input ref={inputRef} className="hidden" type="file" accept=".csv,text/csv" onChange={choose} />
    {result && <span className="self-center text-sm text-moss-700">{result}</span>}
    {preview && <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm"><section className="card mx-auto my-10 max-w-lg">
      <div className="flex items-start justify-between"><div><div className="mb-3 inline-flex rounded-2xl bg-moss-100 p-3 text-moss-700"><FileSpreadsheet /></div><h2 className="text-xl font-bold">CSV 匯入預覽</h2><p className="mt-1 text-sm text-stone-500">預付與攤提會以完整群組驗證及寫入。</p></div><button className="rounded-xl p-2 hover:bg-stone-100" onClick={() => setPreview(null)}><X /></button></div>
      <div className="mt-6 grid grid-cols-3 gap-3 text-center"><div className="rounded-2xl bg-moss-50 p-4"><p className="text-2xl font-bold text-moss-700">{preview.valid.length}</p><p className="text-xs text-stone-500">有效</p></div><div className="rounded-2xl bg-stone-100 p-4"><p className="text-2xl font-bold">{preview.duplicate.length}</p><p className="text-xs text-stone-500">重複</p></div><div className="rounded-2xl bg-red-50 p-4"><p className="text-2xl font-bold text-red-700">{preview.errors.length}</p><p className="text-xs text-stone-500">格式錯誤</p></div></div>
      {preview.errors.length > 0 && <div className="mt-5 max-h-40 overflow-y-auto rounded-2xl bg-red-50 p-4 text-sm text-red-700"><p className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle size={17} />錯誤列不會匯入</p>{preview.errors.slice(0, 20).map((error, index) => <p key={`${error.row}-${index}`} className="mt-1">第 {error.row} 列：{error.message}</p>)}</div>}
      <div className="mt-6 flex gap-3"><button className="btn-secondary flex-1" onClick={() => setPreview(null)}>取消</button><button className="btn-primary flex-1" onClick={runImport} disabled={!preview.valid.length || loading}>{loading ? <LoaderCircle className="animate-spin" size={18} /> : <Check size={18} />}確認匯入</button></div>
    </section></div>}
  </>;
}

function keyOf(value: string) { return value.trim().toLocaleLowerCase("zh-TW"); }
