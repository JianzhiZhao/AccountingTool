"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Check, FileSpreadsheet, LoaderCircle, X } from "lucide-react";
import { insertImportedExpense, listCategories, listExpenses, listTags, saveCategory, saveTag, toggleCurrency } from "@/lib/data";
import { expensesToCsv, parseExpenseCsv, type CsvPreview } from "@/lib/csv";
import { todayInTaipei } from "@/lib/date";
import type { Expense } from "@/types/domain";

export function CsvTools({ expenses, onImported, exportButton, importButton }: { expenses: Expense[]; onImported: () => void; exportButton: React.ReactNode; importButton: React.ReactNode }) {
  const inputRef = useRef<HTMLInputElement>(null); const [preview, setPreview] = useState<CsvPreview | null>(null); const [loading, setLoading] = useState(false); const [result, setResult] = useState("");
  function download() { const blob = new Blob(["\uFEFF", expensesToCsv(expenses)], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `expenses-${todayInTaipei()}.csv`; link.click(); URL.revokeObjectURL(url); }
  async function choose(event: React.ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; setLoading(true); setResult(""); try { const [text, existing] = await Promise.all([file.text(), listExpenses()]); setPreview(parseExpenseCsv(text.replace(/^\uFEFF/, ""), new Set(existing.map((e) => e.id)))); } catch { setResult("無法讀取 CSV，請確認檔案來自本站匯出。" ); } finally { setLoading(false); } }
  async function runImport() {
    if (!preview) return; setLoading(true); let success = 0; let failed = 0;
    try {
      const [categories, tags] = await Promise.all([listCategories(true), listTags(true)]); const categoryMap = new Map(categories.map((c) => [c.name.trim().toLocaleLowerCase("zh-TW"), c.id])); const tagMap = new Map(tags.map((tag) => [tag.name.trim().toLocaleLowerCase("zh-TW"), tag.id]));
      for (const row of preview.valid) {
        try {
          const key = row.category_name.trim().toLocaleLowerCase("zh-TW"); let categoryId = categoryMap.get(key);
          if (!categoryId) { await saveCategory(row.category_name.trim()); const created = (await listCategories(true)).find((category) => category.name.trim().toLocaleLowerCase("zh-TW") === key); if (!created) throw new Error("分類建立失敗"); categoryId = created.id; categoryMap.set(key, created.id); }
          const tagIds: string[] = [];
          for (const tagName of row.tag_names) { const tagKey = tagName.toLocaleLowerCase("zh-TW"); let tagId = tagMap.get(tagKey); if (!tagId) { await saveTag(tagName); const created = (await listTags(true)).find((tag) => tag.name.trim().toLocaleLowerCase("zh-TW") === tagKey); if (!created) throw new Error("Tag 建立失敗"); tagId = created.id; tagMap.set(tagKey, tagId); } tagIds.push(tagId); }
          await toggleCurrency(row.currency_code, true);
          await insertImportedExpense(row.id, { item_name: row.item_name, expense_date: row.expense_date, amount: row.amount, currency_code: row.currency_code, category_id: categoryId, note: row.note, exchange_rate_to_twd: row.currency_code === "TWD" ? 1 : row.exchange_rate_to_twd, tag_ids: tagIds }, row.created_at, row.updated_at); success++;
        } catch { failed++; }
      }
      setResult(`匯入完成：成功 ${success} 筆、重複跳過 ${preview.duplicate.length} 筆、格式錯誤 ${preview.errors.length} 筆、寫入失敗 ${failed} 筆。`); setPreview(null); onImported();
    } finally { setLoading(false); }
  }
  return <><button className="btn-secondary" type="button" onClick={download} disabled={!expenses.length}>{exportButton}</button><button className="btn-secondary" type="button" onClick={() => inputRef.current?.click()} disabled={loading}>{loading ? <LoaderCircle className="animate-spin" size={17} /> : importButton}</button><input ref={inputRef} className="hidden" type="file" accept=".csv,text/csv" onChange={choose} />{result && <span className="self-center text-sm text-moss-700">{result}</span>}{preview && <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm"><section className="card mx-auto my-10 max-w-lg"><div className="flex items-start justify-between"><div><div className="mb-3 inline-flex rounded-2xl bg-moss-100 p-3 text-moss-700"><FileSpreadsheet /></div><h2 className="text-xl font-bold">CSV 匯入預覽</h2><p className="mt-1 text-sm text-stone-500">確認後只會寫入有效且尚不存在的帳目。</p></div><button className="rounded-xl p-2 hover:bg-stone-100" onClick={() => setPreview(null)}><X /></button></div><div className="mt-6 grid grid-cols-3 gap-3 text-center"><div className="rounded-2xl bg-moss-50 p-4"><p className="text-2xl font-bold text-moss-700">{preview.valid.length}</p><p className="text-xs text-stone-500">有效</p></div><div className="rounded-2xl bg-stone-100 p-4"><p className="text-2xl font-bold">{preview.duplicate.length}</p><p className="text-xs text-stone-500">重複跳過</p></div><div className="rounded-2xl bg-red-50 p-4"><p className="text-2xl font-bold text-red-700">{preview.errors.length}</p><p className="text-xs text-stone-500">格式錯誤</p></div></div>{preview.errors.length > 0 && <div className="mt-5 max-h-40 overflow-y-auto rounded-2xl bg-red-50 p-4 text-sm text-red-700"><p className="mb-2 flex items-center gap-2 font-semibold"><AlertTriangle size={17} />錯誤列不會匯入</p>{preview.errors.slice(0, 20).map((error, index) => <p key={`${error.row}-${index}`} className="mt-1">第 {error.row} 列：{error.message}</p>)}</div>}<div className="mt-6 flex gap-3"><button className="btn-secondary flex-1" onClick={() => setPreview(null)}>取消</button><button className="btn-primary flex-1" onClick={runImport} disabled={!preview.valid.length || loading}>{loading ? <LoaderCircle className="animate-spin" size={18} /> : <Check size={18} />}確認匯入</button></div></section></div>}</>;
}
