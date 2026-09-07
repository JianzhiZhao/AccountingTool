"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Hash, Heart, LoaderCircle, Save } from "lucide-react";
import { listCategories, listCurrencies, listFavorites, listTags, saveExpense } from "@/lib/data";
import { generateAmortizationSchedule } from "@/lib/amortization";
import { todayInTaipei } from "@/lib/date";
import { normalizeExpenseInput } from "@/lib/validation";
import type { Category, EnabledCurrency, Expense, ExpenseInput, FavoriteTemplate, Tag } from "@/types/domain";
import { StatusMessage } from "./status-message";

const blank = (): ExpenseInput => ({ item_name: "", expense_date: todayInTaipei(), amount: 0, currency_code: "TWD", category_id: "", note: "", exchange_rate_to_twd: 1, tag_ids: [], expense_type: "general", amortization_unit: null, amortization_periods: null, amortization_start_date: null });

export function ExpenseForm({ initialExpense, onSaved }: { initialExpense?: Expense; onSaved?: () => void }) {
  const [form, setForm] = useState<ExpenseInput>(() => initialExpense ? {
    item_name: initialExpense.item_name, expense_date: initialExpense.expense_date, amount: initialExpense.amount,
    currency_code: initialExpense.currency_code, category_id: initialExpense.category_id, note: initialExpense.note,
    exchange_rate_to_twd: initialExpense.exchange_rate_to_twd, tag_ids: initialExpense.tags?.map((tag) => tag.id) ?? [],
    expense_type: "general", amortization_unit: null, amortization_periods: null, amortization_start_date: null,
  } : blank());
  const [categories, setCategories] = useState<Category[]>([]); const [currencies, setCurrencies] = useState<EnabledCurrency[]>([]); const [favorites, setFavorites] = useState<FavoriteTemplate[]>([]); const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");

  useEffect(() => { Promise.all([listCategories(Boolean(initialExpense)), listCurrencies(Boolean(initialExpense)), listFavorites(false), listTags(Boolean(initialExpense))]).then(([allCategories, allCurrencies, favoriteRows, allTags]) => {
    const activeCategories = initialExpense ? allCategories.filter((item) => item.is_active || item.id === initialExpense.category_id) : allCategories;
    const activeCurrencies = initialExpense ? allCurrencies.filter((item) => item.is_active || item.code === initialExpense.currency_code) : allCurrencies;
    const assignedTagIds = new Set(initialExpense?.tags?.map((tag) => tag.id) ?? []);
    const visibleTags = initialExpense ? allTags.filter((tag) => tag.is_active || assignedTagIds.has(tag.id)) : allTags;
    setCategories(activeCategories); setCurrencies(activeCurrencies); setFavorites(favoriteRows); setTags(visibleTags);
    if (!initialExpense && activeCategories.length) setForm((old) => ({ ...old, category_id: old.category_id || activeCategories[0].id }));
    const requested = !initialExpense ? sessionStorage.getItem("favoriteToLoad") : null; const favorite = favoriteRows.find((item) => item.id === requested);
    if (favorite) { const visibleTagIds = new Set(visibleTags.map((tag) => tag.id)); setForm((old) => favoriteForm(old, { ...favorite, tags: favorite.tags?.filter((tag) => visibleTagIds.has(tag.id)) })); setMessage(`已載入「${favorite.item_name}」，確認後即可儲存。`); sessionStorage.removeItem("favoriteToLoad"); }
  }).catch(() => setError("無法載入記帳設定，請重新整理。")).finally(() => setLoading(false)); }, [initialExpense]);

  const selectedFavorite = useMemo(() => favorites.find((favorite) => favorite.item_name === form.item_name && favorite.category_id === form.category_id), [favorites, form.item_name, form.category_id]);
  const schedule = useMemo(() => {
    if (form.expense_type !== "prepaid" || !form.amount || !form.amortization_unit || !form.amortization_periods || !form.amortization_start_date) return [];
    try { return generateAmortizationSchedule({ amount: form.amount, startDate: form.amortization_start_date, unit: form.amortization_unit, periods: form.amortization_periods }); }
    catch { return []; }
  }, [form.expense_type, form.amount, form.amortization_unit, form.amortization_periods, form.amortization_start_date]);

  function update<K extends keyof ExpenseInput>(key: K, value: ExpenseInput[K]) {
    setForm((old) => ({ ...old, [key]: value, ...(key === "currency_code" && value === "TWD" ? { exchange_rate_to_twd: 1 } : {}), ...(key === "expense_date" && old.expense_type === "prepaid" && (!old.amortization_start_date || String(value) > old.amortization_start_date) ? { amortization_start_date: String(value) } : {}) }));
  }
  function changeType(type: "general" | "prepaid") { setForm((old) => type === "general" ? { ...old, expense_type: type, amortization_unit: null, amortization_periods: null, amortization_start_date: null } : { ...old, expense_type: type, amortization_unit: "month", amortization_periods: 12, amortization_start_date: old.expense_date }); }
  function defaultRateFor(code: string) { return code === "TWD" ? 1 : currencies.find((currency) => currency.code === code)?.default_exchange_rate_to_twd ?? 1; }
  function changeCurrency(code: string) { setForm((old) => ({ ...old, currency_code: code, exchange_rate_to_twd: defaultRateFor(code) })); }
  function loadFavorite(favorite: FavoriteTemplate) { const visibleTagIds = new Set(tags.map((tag) => tag.id)); setForm((old) => favoriteForm(old, { ...favorite, tags: favorite.tags?.filter((tag) => visibleTagIds.has(tag.id)) })); setMessage(`已載入「${favorite.item_name}」，確認後即可儲存。`); setError(""); }
  function toggleTag(tagId: string) { setForm((old) => ({ ...old, tag_ids: old.tag_ids.includes(tagId) ? old.tag_ids.filter((id) => id !== tagId) : [...old.tag_ids, tagId] })); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage(""); setError("");
    try { const valid = normalizeExpenseInput(form); await saveExpense(valid, initialExpense?.id); setMessage(initialExpense ? "帳目已更新。" : valid.expense_type === "prepaid" ? `預付帳目與 ${valid.amortization_periods} 筆攤提已建立。` : "記帳完成！"); if (!initialExpense) setForm({ ...blank(), category_id: form.category_id, currency_code: form.currency_code, exchange_rate_to_twd: defaultRateFor(form.currency_code) }); onSaved?.(); }
    catch (cause) { setError(cause instanceof Error && !cause.message.includes("invalid input syntax") ? cause.message : "資料格式不正確，請檢查必填欄位。"); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="card flex min-h-48 items-center justify-center"><LoaderCircle className="animate-spin text-moss-600" /></div>;
  if (!categories.length) return <div className="card text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-moss-100 text-moss-700"><Heart /></div><h2 className="text-xl font-bold">先建立第一個分類</h2><p className="mx-auto mt-2 max-w-sm text-stone-500">分類是每筆帳目的必填資料。建立完成後，就能開始記帳。</p><Link className="btn-primary mt-6" href="/app/settings">前往建立分類</Link></div>;

  return <div className="space-y-5">
    {!initialExpense && favorites.length > 0 && <section><div className="mb-3 flex items-center gap-2"><Heart size={18} className="text-coral" /><h2 className="font-semibold">從常用項目開始</h2></div><div className="flex gap-2 overflow-x-auto pb-2">{favorites.map((favorite) => <button type="button" key={favorite.id} onClick={() => loadFavorite(favorite)} className={`shrink-0 rounded-2xl border px-4 py-3 text-left transition ${selectedFavorite?.id === favorite.id ? "border-moss-500 bg-moss-50" : "border-stone-200 bg-white hover:border-moss-100"}`}><span className="block font-medium">{favorite.item_name}</span><span className="text-xs text-stone-400">{favorite.currency_code} {favorite.default_amount}</span></button>)}</div></section>}
    <form onSubmit={submit} className="card space-y-5">
      {!initialExpense && <div><p className="label">帳目類型 *</p><div className="grid grid-cols-2 gap-2"><button type="button" aria-pressed={form.expense_type === "general"} onClick={() => changeType("general")} className={`rounded-2xl border p-4 text-left ${form.expense_type === "general" ? "border-moss-500 bg-moss-50" : "border-stone-200"}`}><span className="font-semibold">一般支出</span><span className="mt-1 block text-xs text-stone-500">付款與費用同時發生</span></button><button type="button" aria-pressed={form.expense_type === "prepaid"} onClick={() => changeType("prepaid")} className={`rounded-2xl border p-4 text-left ${form.expense_type === "prepaid" ? "border-moss-500 bg-moss-50" : "border-stone-200"}`}><span className="font-semibold">預付支出</span><span className="mt-1 block text-xs text-stone-500">一次付款，分期認列費用</span></button></div></div>}
      <div className="grid gap-5 sm:grid-cols-2"><div className="sm:col-span-2"><label className="label" htmlFor="item_name">項目名稱 *</label><input className="field" id="item_name" maxLength={100} required value={form.item_name} onChange={(event) => update("item_name", event.target.value)} placeholder="例如：午餐" /></div><div><label className="label" htmlFor="expense_date">{form.expense_type === "prepaid" ? "付款日期 *" : "日期 *"}</label><input className="field" id="expense_date" type="date" required value={form.expense_date} onChange={(event) => update("expense_date", event.target.value)} /></div><div><label className="label" htmlFor="category">分類 *</label><select className="field" id="category" required value={form.category_id} onChange={(event) => update("category_id", event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div><div><label className="label" htmlFor="amount">金額 *</label><input className="field" id="amount" type="number" min="0.0001" step="0.0001" inputMode="decimal" required value={form.amount || ""} onChange={(event) => update("amount", Number(event.target.value))} placeholder="0" /></div><div><label className="label" htmlFor="currency">幣別 *</label><select className="field" id="currency" value={form.currency_code} onChange={(event) => changeCurrency(event.target.value)}>{currencies.map((currency) => <option key={currency.code} value={currency.code}>{currency.code}</option>)}</select></div>{form.currency_code !== "TWD" && <div className="sm:col-span-2"><label className="label" htmlFor="rate">1 {form.currency_code} 可換多少 TWD *</label><input className="field" id="rate" type="number" min="0.00000001" step="0.00000001" inputMode="decimal" required value={form.exchange_rate_to_twd || ""} onChange={(event) => update("exchange_rate_to_twd", Number(event.target.value))} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} /><p className="mt-1.5 text-xs text-stone-400">已帶入此幣別的預設匯率；修改只會保存於本筆帳目。</p></div>}</div>
      {form.expense_type === "prepaid" && <section className="rounded-2xl bg-moss-50 p-4"><h3 className="font-semibold text-moss-800">攤提設定</h3><div className="mt-4 grid gap-4 sm:grid-cols-3"><div><label className="label" htmlFor="amortization_unit">攤提單位 *</label><select className="field" id="amortization_unit" value={form.amortization_unit ?? "month"} onChange={(event) => update("amortization_unit", event.target.value as "month" | "day")}><option value="month">每月</option><option value="day">每日</option></select></div><div><label className="label" htmlFor="amortization_periods">期數 *</label><input className="field" id="amortization_periods" type="number" min="1" max={form.amortization_unit === "day" ? 366 : 120} required value={form.amortization_periods ?? ""} onChange={(event) => update("amortization_periods", Number(event.target.value))} /></div><div><label className="label" htmlFor="amortization_start_date">開始日期 *</label><input className="field" id="amortization_start_date" type="date" min={form.expense_date} required value={form.amortization_start_date ?? ""} onChange={(event) => update("amortization_start_date", event.target.value)} /></div></div>
        {schedule.length > 0 && <div className="mt-4 rounded-2xl bg-white p-4"><div className="grid gap-2 text-sm sm:grid-cols-2"><p>第一期：<strong>{schedule[0].expense_date}</strong></p><p>最後一期：<strong>{schedule.at(-1)?.expense_date}</strong></p><p>一般期金額：<strong>{schedule[0].amount_text} {form.currency_code}</strong></p><p>最後一期：<strong>{schedule.at(-1)?.amount_text} {form.currency_code}</strong></p></div><details className="mt-3"><summary className="cursor-pointer text-sm font-medium text-moss-700">查看完整 {schedule.length} 期預覽</summary><div className="mt-2 max-h-56 overflow-y-auto divide-y divide-stone-100 text-sm">{schedule.map((item) => <div key={item.sequence} className="flex justify-between py-2"><span>第 {item.sequence} 期 · {item.expense_date}</span><span>{item.amount_text} {form.currency_code}</span></div>)}</div></details></div>}
      </section>}
      <div><label className="label" htmlFor="note">備註（選填）</label><textarea className="field min-h-24 resize-y" id="note" maxLength={500} value={form.note} onChange={(event) => update("note", event.target.value)} placeholder="可記下用途或付款方式" /></div>
      <div><div className="mb-2 flex items-center gap-2"><Hash size={16} className="text-coral" /><span className="label mb-0">Tag（選填，可複選）</span></div>{tags.length ? <div className="flex flex-wrap gap-2">{tags.map((tag) => { const selected = form.tag_ids.includes(tag.id); return <button key={tag.id} type="button" aria-pressed={selected} onClick={() => toggleTag(tag.id)} className={`rounded-full border px-3 py-1.5 text-sm transition ${selected ? "border-moss-500 bg-moss-100 text-moss-700" : "border-stone-200 bg-stone-50 text-stone-500 hover:border-moss-500"}`}>#{tag.name}</button>; })}</div> : <p className="text-sm text-stone-400">尚未建立 Tag，可到設定頁新增。</p>}</div>
      <StatusMessage message={error || message} error={Boolean(error)} />
      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>{saving ? <LoaderCircle className="animate-spin" size={18} /> : initialExpense ? <Save size={18} /> : <Check size={18} />}{initialExpense ? "儲存變更" : form.expense_type === "prepaid" ? "建立預付與攤提" : "完成記帳"}</button>
    </form>
  </div>;
}

function favoriteForm(old: ExpenseInput, favorite: FavoriteTemplate): ExpenseInput {
  return { ...old, item_name: favorite.item_name, expense_date: todayInTaipei(), amount: favorite.default_amount, currency_code: favorite.currency_code, category_id: favorite.category_id, note: favorite.note, exchange_rate_to_twd: favorite.currency_code === "TWD" ? 1 : favorite.default_exchange_rate_to_twd, tag_ids: favorite.tags?.map((tag) => tag.id) ?? [], ...(old.expense_type === "prepaid" ? { amortization_start_date: todayInTaipei() } : {}) };
}
