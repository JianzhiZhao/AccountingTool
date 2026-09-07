"use client";

import { useEffect, useState } from "react";
import { Download, Eye, Filter, LoaderCircle, Pencil, Search, Trash2, Upload, X } from "lucide-react";
import { deleteExpense, listCategories, listCurrencies, listExpenseFamily, listExpenses, listTags } from "@/lib/data";
import { generateAmortizationSchedule } from "@/lib/amortization";
import { EMPTY_FILTERS } from "@/lib/constants";
import { formatDateZh, todayInTaipei } from "@/lib/date";
import { formatMoney } from "@/lib/analytics";
import type { Category, EnabledCurrency, Expense, ExpenseFilters, ExpenseType, Tag } from "@/types/domain";
import { ExpenseForm } from "./expense-form";
import { CsvTools } from "./csv-tools";
import { StatusMessage } from "./status-message";

const typeLabels: Record<ExpenseType, string> = { general: "一般", prepaid: "預付", amortized: "攤提" };
const typeStyles: Record<ExpenseType, string> = { general: "bg-stone-100 text-stone-600", prepaid: "bg-amber-100 text-amber-800", amortized: "bg-moss-100 text-moss-800" };

export function ExpensesManager() {
  const emptyFilters = (): ExpenseFilters => ({ ...EMPTY_FILTERS, expenseTypes: [...EMPTY_FILTERS.expenseTypes] });
  const [filters, setFilters] = useState<ExpenseFilters>(emptyFilters); const [applied, setApplied] = useState<ExpenseFilters>(emptyFilters);
  const [expenses, setExpenses] = useState<Expense[]>([]); const [categories, setCategories] = useState<Category[]>([]); const [currencies, setCurrencies] = useState<EnabledCurrency[]>([]); const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true); const [editing, setEditing] = useState<Expense | null>(null); const [family, setFamily] = useState<Expense[] | null>(null); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function fetchData(next: ExpenseFilters) { return Promise.all([listExpenses(next), listCategories(true), listCurrencies(true), listTags(true)]); }
  async function load(next = applied) { setLoading(true); setError(""); try { const [expenseRows, categoryRows, currencyRows, tagRows] = await fetchData(next); setExpenses(expenseRows); setCategories(categoryRows); setCurrencies(currencyRows); setTags(tagRows); } catch { setError("無法載入帳目，請稍後再試。"); } finally { setLoading(false); } }
  useEffect(() => {
    let cancelled = false;
    fetchData(applied).then(([expenseRows, categoryRows, currencyRows, tagRows]) => {
      if (cancelled) return;
      setExpenses(expenseRows); setCategories(categoryRows); setCurrencies(currencyRows); setTags(tagRows); setError("");
    }).catch(() => {
      if (!cancelled) setError("無法載入帳目，請稍後再試。");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [applied]);
  async function remove(expense: Expense) { const detail = expense.expense_type === "prepaid" ? `並一併刪除 ${expense.amortization_periods ?? 0} 筆攤提` : ""; if (!window.confirm(`確定永久刪除「${expense.item_name}」${detail}？此動作無法復原。`)) return; try { await deleteExpense(expense.id); setMessage(expense.expense_type === "prepaid" ? "預付及其攤提已永久刪除。" : "帳目已永久刪除。"); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : "刪除失敗，請稍後再試。"); } }
  async function openFamily(expense: Expense) { setError(""); try { setFamily(await listExpenseFamily(expense.id)); } catch { setError("無法載入預付與攤提明細。"); } }
  function apply(event: React.FormEvent) { event.preventDefault(); if (!filters.expenseTypes.length) { setError("請至少選擇一種帳目類型。"); return; } setError(""); setLoading(true); setApplied({ ...filters, expenseTypes: [...filters.expenseTypes] }); }
  function clear() { const empty = emptyFilters(); setFilters(empty); setError(""); setLoading(true); setApplied(empty); }
  function toggleType(type: ExpenseType) { setFilters((current) => ({ ...current, expenseTypes: current.expenseTypes.includes(type) ? current.expenseTypes.filter((item) => item !== type) : [...current.expenseTypes, type] })); }

  return <div className="space-y-5">
    <form onSubmit={apply} className="card grid gap-3 md:grid-cols-7">
      <div className="relative md:col-span-2"><Search className="absolute left-4 top-3.5 text-stone-400" size={19} /><input aria-label="搜尋名稱或備註" className="field pl-11" placeholder="搜尋名稱或備註" value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} /></div>
      <input aria-label="開始日期" className="field" type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
      <input aria-label="結束日期" className="field" type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
      <select aria-label="分類" className="field" value={filters.categoryId} onChange={(event) => setFilters({ ...filters, categoryId: event.target.value })}><option value="">所有分類</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}{!category.is_active ? "（停用）" : ""}</option>)}</select>
      <select aria-label="幣別" className="field" value={filters.currencyCode} onChange={(event) => setFilters({ ...filters, currencyCode: event.target.value })}><option value="">所有幣別</option>{currencies.map((currency) => <option key={currency.code} value={currency.code}>{currency.code}{!currency.is_active ? "（停用）" : ""}</option>)}</select>
      <select aria-label="Tag" className="field" value={filters.tagId} onChange={(event) => setFilters({ ...filters, tagId: event.target.value })}><option value="">所有 Tag</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>#{tag.name}</option>)}</select>
      <div className="md:col-span-7"><p className="label">帳目類型</p><div className="flex flex-wrap gap-2">{(["general", "prepaid", "amortized"] as ExpenseType[]).map((type) => <button key={type} type="button" aria-pressed={filters.expenseTypes.includes(type)} onClick={() => toggleType(type)} className={`rounded-full border px-3 py-1.5 text-sm ${filters.expenseTypes.includes(type) ? "border-moss-500 bg-moss-100 text-moss-800" : "border-stone-200 text-stone-500"}`}>{typeLabels[type]}</button>)}<label className="ml-1 flex items-center gap-2 text-sm text-stone-600"><input type="checkbox" checked={filters.includeFutureAmortized} onChange={(event) => setFilters({ ...filters, includeFutureAmortized: event.target.checked })} />顯示未到期攤提</label></div></div>
      <div className="flex flex-wrap gap-2 md:col-span-7"><button className="btn-primary" type="submit"><Filter size={17} />套用篩選</button><button className="btn-secondary" type="button" onClick={clear}><X size={17} />清除</button><CsvTools expenses={expenses} onImported={() => load()} exportButton={<><Download size={17} />匯出</>} importButton={<><Upload size={17} />匯入</>} /></div>
    </form>
    <StatusMessage message={error || message} error={Boolean(error)} />
    <section className="card overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4"><h2 className="font-semibold">共 {expenses.length} 筆</h2><span className="text-xs text-stone-400">新到舊排列</span></div>
      {loading ? <div className="flex min-h-48 items-center justify-center"><LoaderCircle className="animate-spin text-moss-600" /></div> : expenses.length === 0 ? <div className="px-5 py-16 text-center text-stone-400">找不到符合條件的帳目</div> : <div className="divide-y divide-stone-100">{expenses.map((expense) => <ExpenseRow key={expense.id} expense={expense} onEdit={() => setEditing(expense)} onRemove={() => remove(expense)} onFamily={() => openFamily(expense)} />)}</div>}
    </section>
    {editing && <Modal onClose={() => setEditing(null)}><ExpenseForm initialExpense={editing} onSaved={() => { setEditing(null); void load(); }} /></Modal>}
    {family && <Modal onClose={() => setFamily(null)}><FamilyDetails family={family} /></Modal>}
  </div>;
}

function ExpenseRow({ expense, onEdit, onRemove, onFamily }: { expense: Expense; onEdit: () => void; onRemove: () => void; onFamily: () => void }) {
  const isConverted = expense.currency_code !== "TWD"; const progress = expense.expense_type === "prepaid" ? prepaidProgress(expense) : null;
  return <article className="flex gap-3 px-5 py-4 hover:bg-stone-50/70"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><h3 className="truncate font-semibold">{expense.item_name}</h3><span className={`rounded-full px-2 py-0.5 text-xs ${typeStyles[expense.expense_type]}`}>{typeLabels[expense.expense_type]}</span><span className="rounded-full bg-moss-50 px-2 py-0.5 text-xs text-moss-700">{expense.categories?.name ?? "分類已移除"}</span></div>{expense.note && <p className="mt-1 truncate text-sm text-stone-500">{expense.note}</p>}{Boolean(expense.tags?.length) && <div className="mt-1.5 flex flex-wrap gap-1.5">{expense.tags?.map((tag) => <span key={tag.id} className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-500">#{tag.name}</span>)}</div>}<p className="mt-1 text-xs text-stone-400"><span>{formatDateZh(expense.expense_date)}</span>{expense.expense_type === "amortized" && <span> · 第 {expense.amortization_sequence} 期</span>}{isConverted && <><span> · </span><span>{formatMoney(expense.amount, expense.currency_code)}</span></>}</p>{progress && <p className="mt-2 text-xs text-amber-700">已完成 {progress.completed}/{expense.amortization_periods} 期 · 剩餘 {progress.remaining.toFixed(4)} {expense.currency_code}（約 {formatMoney(progress.remaining * expense.exchange_rate_to_twd)}）</p>}</div><div className="shrink-0 text-right"><div className="flex items-center justify-end gap-2">{isConverted && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">換算</span>}<p className="font-bold">{formatMoney(expense.amount_twd, "TWD")}</p></div><div className="mt-2 flex justify-end">{expense.expense_type === "general" ? <><button aria-label="編輯帳目" className="rounded-xl p-2 text-stone-400 hover:bg-moss-50 hover:text-moss-700" onClick={onEdit}><Pencil size={17} /></button><button aria-label="永久刪除帳目" className="rounded-xl p-2 text-stone-400 hover:bg-red-50 hover:text-red-700" onClick={onRemove}><Trash2 size={17} /></button></> : <><button aria-label="查看預付攤提明細" className="rounded-xl p-2 text-stone-400 hover:bg-moss-50 hover:text-moss-700" onClick={onFamily}><Eye size={17} /></button>{expense.expense_type === "prepaid" && <button aria-label="永久刪除預付與攤提" className="rounded-xl p-2 text-stone-400 hover:bg-red-50 hover:text-red-700" onClick={onRemove}><Trash2 size={17} /></button>}</>}</div></div></article>;
}

function FamilyDetails({ family }: { family: Expense[] }) {
  const parent = family.find((expense) => expense.expense_type === "prepaid"); const children = family.filter((expense) => expense.expense_type === "amortized").sort((a, b) => Number(a.amortization_sequence) - Number(b.amortization_sequence));
  if (!parent) return <section className="card">找不到來源預付帳目。</section>;
  const completed = children.filter((child) => child.expense_date <= todayInTaipei()).length;
  return <section className="card"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">預付</span><h2 className="mt-2 text-xl font-bold">{parent.item_name}</h2><p className="mt-1 text-sm text-stone-500">付款 {formatDateZh(parent.expense_date)} · {parent.amortization_unit === "month" ? "每月" : "每日"}攤提 · 已完成 {completed}/{parent.amortization_periods} 期</p></div><p className="text-xl font-bold">{parent.amount} {parent.currency_code}</p></div><div className="mt-5 max-h-[60vh] divide-y divide-stone-100 overflow-y-auto rounded-2xl border border-stone-100">{children.map((child) => <div key={child.id} className="flex items-center justify-between gap-3 px-4 py-3"><div><p className="font-medium">第 {child.amortization_sequence} 期</p><p className="text-xs text-stone-400">{formatDateZh(child.expense_date)}{child.expense_date > todayInTaipei() ? " · 未到期" : " · 已完成"}</p></div><div className="text-right"><p>{child.amount} {child.currency_code}</p><p className="text-xs text-stone-400">{formatMoney(child.amount_twd)}</p></div></div>)}</div></section>;
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"><div className="mx-auto my-4 max-w-2xl"><div className="mb-3 flex justify-end"><button className="rounded-full border border-stone-200 bg-white p-2 shadow" aria-label="關閉" onClick={onClose}><X /></button></div>{children}</div></div>; }

function prepaidProgress(expense: Expense) {
  if (!expense.amortization_unit || !expense.amortization_periods || !expense.amortization_start_date) return { completed: 0, remaining: expense.amount };
  const schedule = generateAmortizationSchedule({ amount: expense.amount, startDate: expense.amortization_start_date, unit: expense.amortization_unit, periods: expense.amortization_periods }); const today = todayInTaipei();
  return { completed: schedule.filter((item) => item.expense_date <= today).length, remaining: schedule.filter((item) => item.expense_date > today).reduce((total, item) => total + item.amount, 0) };
}
