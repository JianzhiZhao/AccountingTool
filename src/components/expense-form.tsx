"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Hash, Heart, LoaderCircle, Save } from "lucide-react";
import { listCategories, listCurrencies, listFavorites, listTags, saveExpense } from "@/lib/data";
import { todayInTaipei } from "@/lib/date";
import { normalizeExpenseInput } from "@/lib/validation";
import type { Category, EnabledCurrency, Expense, ExpenseInput, FavoriteTemplate, Tag } from "@/types/domain";
import { StatusMessage } from "./status-message";

const blank = (): ExpenseInput => ({ item_name: "", expense_date: todayInTaipei(), amount: 0, currency_code: "TWD", category_id: "", note: "", exchange_rate_to_twd: 1, tag_ids: [] });

export function ExpenseForm({ initialExpense, onSaved }: { initialExpense?: Expense; onSaved?: () => void }) {
  const [form, setForm] = useState<ExpenseInput>(() => initialExpense ? {
    item_name: initialExpense.item_name, expense_date: initialExpense.expense_date, amount: initialExpense.amount,
    currency_code: initialExpense.currency_code, category_id: initialExpense.category_id, note: initialExpense.note,
    exchange_rate_to_twd: initialExpense.exchange_rate_to_twd, tag_ids: initialExpense.tags?.map((tag) => tag.id) ?? [],
  } : blank());
  const [categories, setCategories] = useState<Category[]>([]); const [currencies, setCurrencies] = useState<EnabledCurrency[]>([]); const [favorites, setFavorites] = useState<FavoriteTemplate[]>([]); const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");

  useEffect(() => { Promise.all([listCategories(Boolean(initialExpense)), listCurrencies(Boolean(initialExpense)), listFavorites(), listTags()]).then(([allCategories, allCurrencies, f, allTags]) => { const c = initialExpense ? allCategories.filter((item) => item.is_active || item.id === initialExpense.category_id) : allCategories; const u = initialExpense ? allCurrencies.filter((item) => item.is_active || item.code === initialExpense.currency_code) : allCurrencies; setCategories(c); setCurrencies(u); setFavorites(f); setTags(allTags); if (!initialExpense && c.length) setForm((old) => ({ ...old, category_id: old.category_id || c[0].id })); const requested = !initialExpense ? sessionStorage.getItem("favoriteToLoad") : null; const favorite = f.find((item) => item.id === requested); if (favorite) { setForm({ item_name: favorite.item_name, expense_date: todayInTaipei(), amount: favorite.default_amount, currency_code: favorite.currency_code, category_id: favorite.category_id, note: favorite.note, exchange_rate_to_twd: favorite.currency_code === "TWD" ? 1 : favorite.default_exchange_rate_to_twd, tag_ids: [] }); setMessage(`已載入「${favorite.item_name}」，確認後即可儲存。`); sessionStorage.removeItem("favoriteToLoad"); } }).catch(() => setError("無法載入記帳設定，請重新整理。" )).finally(() => setLoading(false)); }, [initialExpense]);

  const selectedFavorite = useMemo(() => favorites.find((f) => f.item_name === form.item_name && f.category_id === form.category_id), [favorites, form.item_name, form.category_id]);
  function update<K extends keyof ExpenseInput>(key: K, value: ExpenseInput[K]) { setForm((old) => ({ ...old, [key]: value, ...(key === "currency_code" && value === "TWD" ? { exchange_rate_to_twd: 1 } : {}) })); }
  function loadFavorite(favorite: FavoriteTemplate) { setForm({ item_name: favorite.item_name, expense_date: todayInTaipei(), amount: favorite.default_amount, currency_code: favorite.currency_code, category_id: favorite.category_id, note: favorite.note, exchange_rate_to_twd: favorite.currency_code === "TWD" ? 1 : favorite.default_exchange_rate_to_twd, tag_ids: [] }); setMessage(`已載入「${favorite.item_name}」，確認後即可儲存。`); setError(""); }
  function toggleTag(tagId: string) { setForm((old) => ({ ...old, tag_ids: old.tag_ids.includes(tagId) ? old.tag_ids.filter((id) => id !== tagId) : [...old.tag_ids, tagId] })); }
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage(""); setError("");
    try { const valid = normalizeExpenseInput(form); await saveExpense(valid, initialExpense?.id); setMessage(initialExpense ? "帳目已更新。" : "記帳完成！"); if (!initialExpense) setForm({ ...blank(), category_id: form.category_id, currency_code: form.currency_code, exchange_rate_to_twd: form.currency_code === "TWD" ? 1 : form.exchange_rate_to_twd }); onSaved?.(); }
    catch (cause) { setError(cause instanceof Error && !cause.message.includes("invalid input syntax") ? cause.message : "資料格式不正確，請檢查必填欄位。" ); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="card flex min-h-48 items-center justify-center"><LoaderCircle className="animate-spin text-moss-600" /></div>;
  if (!categories.length) return <div className="card text-center"><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-moss-100 text-moss-700"><Heart /></div><h2 className="text-xl font-bold">先建立第一個分類</h2><p className="mx-auto mt-2 max-w-sm text-stone-500">分類是每筆帳目的必填資料。建立完成後，就能開始記帳。</p><Link className="btn-primary mt-6" href="/app/settings">前往建立分類</Link></div>;

  return <div className="space-y-5">
    {!initialExpense && favorites.length > 0 && <section><div className="mb-3 flex items-center gap-2"><Heart size={18} className="text-coral" /><h2 className="font-semibold">從常用項目開始</h2></div><div className="flex gap-2 overflow-x-auto pb-2">{favorites.map((favorite) => <button type="button" key={favorite.id} onClick={() => loadFavorite(favorite)} className={`shrink-0 rounded-2xl border px-4 py-3 text-left transition ${selectedFavorite?.id === favorite.id ? "border-moss-500 bg-moss-50" : "border-stone-200 bg-white hover:border-moss-100"}`}><span className="block font-medium">{favorite.item_name}</span><span className="text-xs text-stone-400">{favorite.currency_code} {favorite.default_amount}</span></button>)}</div></section>}
    <form onSubmit={submit} className="card space-y-5">
      <div className="grid gap-5 sm:grid-cols-2"><div className="sm:col-span-2"><label className="label" htmlFor="item_name">項目名稱 *</label><input className="field" id="item_name" maxLength={100} required value={form.item_name} onChange={(e) => update("item_name", e.target.value)} placeholder="例如：午餐" /></div><div><label className="label" htmlFor="expense_date">日期 *</label><input className="field" id="expense_date" type="date" required value={form.expense_date} onChange={(e) => update("expense_date", e.target.value)} /></div><div><label className="label" htmlFor="category">分類 *</label><select className="field" id="category" required value={form.category_id} onChange={(e) => update("category_id", e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div><label className="label" htmlFor="amount">金額 *</label><input className="field" id="amount" type="number" min="0.0001" step="0.0001" inputMode="decimal" required value={form.amount || ""} onChange={(e) => update("amount", Number(e.target.value))} placeholder="0" /></div><div><label className="label" htmlFor="currency">幣別 *</label><select className="field" id="currency" value={form.currency_code} onChange={(e) => update("currency_code", e.target.value)}>{currencies.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select></div>{form.currency_code !== "TWD" && <div className="sm:col-span-2"><label className="label" htmlFor="rate">1 {form.currency_code} 可換多少 TWD *</label><input className="field" id="rate" type="number" min="0.00000001" step="0.00000001" inputMode="decimal" required value={form.exchange_rate_to_twd || ""} onChange={(e) => update("exchange_rate_to_twd", Number(e.target.value))} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} /><p className="mt-1.5 text-xs text-stone-400">這個匯率會固定保存於本筆帳目。</p></div>}<div className="sm:col-span-2"><label className="label" htmlFor="note">備註（選填）</label><textarea className="field min-h-24 resize-y" id="note" maxLength={500} value={form.note} onChange={(e) => update("note", e.target.value)} placeholder="可記下用途或付款方式" /></div><div className="sm:col-span-2"><div className="mb-2 flex items-center gap-2"><Hash size={16} className="text-coral" /><span className="label mb-0">Tag（選填，可複選）</span></div>{tags.length ? <div className="flex flex-wrap gap-2">{tags.map((tag) => { const selected = form.tag_ids.includes(tag.id); return <button key={tag.id} type="button" aria-pressed={selected} onClick={() => toggleTag(tag.id)} className={`rounded-full border px-3 py-1.5 text-sm transition ${selected ? "border-moss-500 bg-moss-100 text-moss-700" : "border-stone-200 bg-stone-50 text-stone-500 hover:border-moss-500"}`}>#{tag.name}</button>; })}</div> : <p className="text-sm text-stone-400">尚未建立 Tag，可到設定頁新增。</p>}</div></div>
      <StatusMessage message={error || message} error={Boolean(error)} />
      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={saving}>{saving ? <LoaderCircle className="animate-spin" size={18} /> : initialExpense ? <Save size={18} /> : <Check size={18} />}{initialExpense ? "儲存變更" : "完成記帳"}</button>
    </form>
  </div>;
}
