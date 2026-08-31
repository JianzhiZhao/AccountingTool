"use client";

import { useEffect, useState } from "react";
import { Download, Filter, LoaderCircle, Pencil, Search, Trash2, Upload, X } from "lucide-react";
import { deleteExpense, listCategories, listCurrencies, listExpenses, listTags } from "@/lib/data";
import { EMPTY_FILTERS } from "@/lib/constants";
import { formatDateZh } from "@/lib/date";
import { formatMoney } from "@/lib/analytics";
import type { Category, EnabledCurrency, Expense, ExpenseFilters, Tag } from "@/types/domain";
import { ExpenseForm } from "./expense-form";
import { CsvTools } from "./csv-tools";
import { StatusMessage } from "./status-message";

export function ExpensesManager() {
  const [filters, setFilters] = useState<ExpenseFilters>({ ...EMPTY_FILTERS }); const [applied, setApplied] = useState<ExpenseFilters>({ ...EMPTY_FILTERS });
  const [expenses, setExpenses] = useState<Expense[]>([]); const [categories, setCategories] = useState<Category[]>([]); const [currencies, setCurrencies] = useState<EnabledCurrency[]>([]); const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true); const [editing, setEditing] = useState<Expense | null>(null); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function load(next = applied) { setLoading(true); setError(""); try { const [e, c, u, t] = await Promise.all([listExpenses(next), listCategories(true), listCurrencies(true), listTags(true)]); setExpenses(e); setCategories(c); setCurrencies(u); setTags(t); } catch { setError("無法載入帳目，請稍後再試。" ); } finally { setLoading(false); } }
  useEffect(() => { Promise.all([listExpenses(applied), listCategories(true), listCurrencies(true), listTags(true)]).then(([e, c, u, t]) => { setExpenses(e); setCategories(c); setCurrencies(u); setTags(t); }).catch(() => setError("無法載入帳目，請稍後再試。" )).finally(() => setLoading(false)); }, [applied]);
  async function remove(expense: Expense) { if (!window.confirm(`確定永久刪除「${expense.item_name}」？此動作無法復原。`)) return; try { await deleteExpense(expense.id); setMessage("帳目已永久刪除。" ); await load(); } catch { setError("刪除失敗，請稍後再試。" ); } }
  function apply(event: React.FormEvent) { event.preventDefault(); setLoading(true); setError(""); setApplied({ ...filters }); }
  function clear() { const empty = { ...EMPTY_FILTERS }; setFilters(empty); setLoading(true); setError(""); setApplied(empty); }
  return <div className="space-y-5">
    <form onSubmit={apply} className="card grid gap-3 md:grid-cols-7">
      <div className="relative md:col-span-2"><Search className="absolute left-4 top-3.5 text-stone-400" size={19} /><input aria-label="搜尋名稱或備註" className="field pl-11" placeholder="搜尋名稱或備註" value={filters.query} onChange={(e) => setFilters({ ...filters, query: e.target.value })} /></div>
      <input aria-label="開始日期" className="field" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
      <input aria-label="結束日期" className="field" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
      <select aria-label="分類" className="field" value={filters.categoryId} onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}><option value="">所有分類</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}{!c.is_active ? "（停用）" : ""}</option>)}</select>
      <select aria-label="幣別" className="field" value={filters.currencyCode} onChange={(e) => setFilters({ ...filters, currencyCode: e.target.value })}><option value="">所有幣別</option>{currencies.map((c) => <option key={c.code} value={c.code}>{c.code}{!c.is_active ? "（停用）" : ""}</option>)}</select>
      <select aria-label="Tag" className="field" value={filters.tagId} onChange={(e) => setFilters({ ...filters, tagId: e.target.value })}><option value="">所有 Tag</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>#{tag.name}</option>)}</select>
      <div className="flex gap-2 md:col-span-7"><button className="btn-primary" type="submit"><Filter size={17} />套用篩選</button><button className="btn-secondary" type="button" onClick={clear}><X size={17} />清除</button><CsvTools expenses={expenses} onImported={() => load()} exportButton={<><Download size={17} />匯出</>} importButton={<><Upload size={17} />匯入</>} /></div>
    </form>
    <StatusMessage message={error || message} error={Boolean(error)} />
    <section className="card overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4"><h2 className="font-semibold">共 {expenses.length} 筆</h2><span className="text-xs text-stone-400">新到舊排列</span></div>
      {loading ? <div className="flex min-h-48 items-center justify-center"><LoaderCircle className="animate-spin text-moss-600" /></div> : expenses.length === 0 ? <div className="px-5 py-16 text-center text-stone-400">找不到符合條件的帳目</div> : <div className="divide-y divide-stone-100">{expenses.map((expense) => {
        const isConverted = expense.currency_code !== "TWD";
        return <article key={expense.id} className="flex gap-3 px-5 py-4 hover:bg-stone-50/70">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h3 className="truncate font-semibold">{expense.item_name}</h3><span className="rounded-full bg-moss-50 px-2 py-0.5 text-xs text-moss-700">{expense.categories?.name ?? "分類已移除"}</span></div>
            {expense.note && <p className="mt-1 truncate text-sm text-stone-500">{expense.note}</p>}
            {Boolean(expense.tags?.length) && <div className="mt-1.5 flex flex-wrap gap-1.5">{expense.tags?.map((tag) => <span key={tag.id} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-500">#{tag.name}</span>)}</div>}
            <p className="mt-1 text-xs text-stone-400"><span>{formatDateZh(expense.expense_date)}</span>{isConverted && <><span> · </span><span>{formatMoney(expense.amount, expense.currency_code)}</span></>}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="flex items-center justify-end gap-2">{isConverted && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">換算</span>}<p className="font-bold">{formatMoney(expense.amount_twd, "TWD")}</p></div>
            <div className="mt-2 flex justify-end"><button aria-label="編輯帳目" className="rounded-xl p-2 text-stone-400 hover:bg-moss-50 hover:text-moss-700" onClick={() => setEditing(expense)}><Pencil size={17} /></button><button aria-label="永久刪除帳目" className="rounded-xl p-2 text-stone-400 hover:bg-red-50 hover:text-red-700" onClick={() => remove(expense)}><Trash2 size={17} /></button></div>
          </div>
        </article>;
      })}</div>}
    </section>
    {editing && <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"><div className="mx-auto my-4 max-w-2xl"><div className="mb-3 flex justify-end"><button className="rounded-full border border-stone-200 bg-white p-2 shadow" aria-label="關閉" onClick={() => setEditing(null)}><X /></button></div><ExpenseForm initialExpense={editing} onSaved={() => { setEditing(null); void load(); }} /></div></div>}
  </div>;
}
