"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CalendarRange, LoaderCircle, TrendingUp, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { listExpenses } from "@/lib/data";
import { currentMonthToToday, todayInTaipei } from "@/lib/date";
import { formatMoney, monthlyAccountingTrend, summarizeAccounting, summarizeExpenses } from "@/lib/analytics";
import type { Expense, ExpenseType } from "@/types/domain";
import { StatusMessage } from "./status-message";

const axisStyle = { fontSize: 11, fill: "#656c52" };
const tooltipStyle = { backgroundColor: "#f4f3e6", border: "1px solid #ced2b5", borderRadius: 14, color: "#252a1f" };
const typeOptions: { value: ExpenseType; label: string }[] = [{ value: "general", label: "一般" }, { value: "prepaid", label: "預付" }, { value: "amortized", label: "攤提" }];

export function AnalyticsDashboard() {
  const initial = currentMonthToToday();
  const [from, setFrom] = useState(initial.from); const [to, setTo] = useState(initial.to); const [range, setRange] = useState(initial);
  const [selectedTypes, setSelectedTypes] = useState<ExpenseType[]>(["general", "amortized"]);
  const [periodExpenses, setPeriodExpenses] = useState<Expense[]>([]); const [throughEndExpenses, setThroughEndExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listExpenses({ from: range.from, to: range.to, includeFutureAmortized: true }),
      listExpenses({ to: range.to, expenseTypes: ["prepaid", "amortized"], includeFutureAmortized: true }),
    ]).then(([period, throughEnd]) => {
      if (cancelled) return;
      setPeriodExpenses(period); setThroughEndExpenses(throughEnd); setError("");
    }).catch(() => {
      if (!cancelled) setError("無法載入統計資料。");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [range]);

  const filtered = useMemo(() => periodExpenses.filter((expense) => selectedTypes.includes(expense.expense_type)), [periodExpenses, selectedTypes]);
  const summary = useMemo(() => summarizeExpenses(filtered), [filtered]);
  const accounting = useMemo(() => summarizeAccounting(periodExpenses, throughEndExpenses), [periodExpenses, throughEndExpenses]);
  const trendData = useMemo(() => monthlyAccountingTrend(periodExpenses), [periodExpenses]);
  const includesDoubleCount = selectedTypes.includes("prepaid") && selectedTypes.includes("amortized");
  const includesFuture = range.to > todayInTaipei();

  function toggleType(type: ExpenseType) { setSelectedTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]); }
  function apply(event: React.FormEvent) {
    event.preventDefault();
    if (from && to && from > to) { setError("開始日期不能晚於結束日期。"); return; }
    setError(""); setLoading(true); setRange({ from, to });
  }

  return <div className="space-y-5">
    <form onSubmit={apply} className="card space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="min-w-0 flex-1"><label className="label">開始日期</label><input className="field" type="date" required value={from} onChange={(event) => setFrom(event.target.value)} /></div><div className="min-w-0 flex-1"><label className="label">結束日期</label><input className="field" type="date" required value={to} onChange={(event) => setTo(event.target.value)} /></div><button className="btn-primary"><CalendarRange size={18} />更新統計</button></div>
      <div><p className="label">篩選合計包含</p><div className="flex flex-wrap gap-2">{typeOptions.map((option) => { const selected = selectedTypes.includes(option.value); return <button type="button" key={option.value} aria-pressed={selected} onClick={() => toggleType(option.value)} className={`rounded-full border px-4 py-2 text-sm transition ${selected ? "border-moss-500 bg-moss-100 text-moss-700" : "border-stone-200 bg-white text-stone-500"}`}>{option.label}</button>; })}</div></div>
    </form>
    <StatusMessage message={error} error />
    {includesDoubleCount && <div className="flex items-start gap-2 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800"><AlertTriangle className="mt-0.5 shrink-0" size={18} />此合計同時包含付款與費用認列，可能重複計算同一筆預付支出。</div>}
    {includesFuture && <div className="rounded-2xl bg-sky-50 p-4 text-sm text-sky-800">所選期間包含未來日期，統計數字包含已建立的未來攤提排程。</div>}
    {loading ? <div className="card flex min-h-48 items-center justify-center"><LoaderCircle className="animate-spin text-moss-600" /></div> : <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="實際現金流" value={accounting.cashFlowTwd} note="一般 + 預付" />
        <Metric label="費用認列" value={accounting.recognizedExpenseTwd} note="一般 + 攤提" />
        <Metric label="本期差異" value={accounting.differenceTwd} note="現金流 − 費用認列" />
        <Metric label="期末預付餘額" value={accounting.prepaidBalanceTwd} note={`截至 ${range.to}`} />
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="card sm:col-span-2"><div className="flex items-center gap-2 text-sm font-medium text-stone-500"><Wallet size={18} />篩選合計</div><p className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{formatMoney(summary.totalTwd)}</p><p className="mt-2 text-xs text-stone-400">依所選帳目類型及每筆保存匯率換算</p></article>
        {summary.byCurrency.length ? summary.byCurrency.slice(0, 2).map((item) => <article key={item.name} className="card"><p className="text-sm font-medium text-stone-500">{item.name} 原幣總額</p><p className="mt-3 text-2xl font-bold">{formatMoney(item.value, item.name)}</p></article>) : <article className="card sm:col-span-2"><p className="text-stone-400">此期間尚無符合類型的帳目</p></article>}
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        <article className="card"><div className="mb-5 flex items-center gap-2"><TrendingUp className="text-moss-600" size={20} /><h2 className="font-bold">每月現金流與費用認列</h2></div><div className="h-72">{trendData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trendData} margin={{ left: 4, right: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="#ced2b5" /><XAxis dataKey="date" tick={axisStyle} axisLine={{ stroke: "#b8be9c" }} tickLine={{ stroke: "#b8be9c" }} /><YAxis tick={axisStyle} axisLine={false} tickLine={false} width={56} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => formatMoney(Number(value))} /><Legend /><Line type="monotone" name="現金流" dataKey="cashFlow" stroke="#ef8354" strokeWidth={3} /><Line type="monotone" name="費用認列" dataKey="recognized" stroke="#7ec151" strokeWidth={3} /><Line type="monotone" name="差異" dataKey="difference" stroke="#64748b" strokeWidth={2} strokeDasharray="5 4" /></LineChart></ResponsiveContainer> : <EmptyChart />}</div></article>
        <article className="card"><div className="mb-5 flex items-center gap-2"><BarChart3 className="text-coral" size={20} /><h2 className="font-bold">篩選分類分布</h2></div><div className="h-72">{summary.byCategory.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={summary.byCategory.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 12 }}><CartesianGrid strokeDasharray="3 3" stroke="#ced2b5" /><XAxis type="number" tick={axisStyle} axisLine={{ stroke: "#b8be9c" }} tickLine={{ stroke: "#b8be9c" }} /><YAxis dataKey="name" type="category" tick={{ ...axisStyle, fontSize: 12 }} axisLine={false} tickLine={false} width={72} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => formatMoney(Number(value))} /><Bar dataKey="value" fill="#fed24f" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart />}</div></article>
      </section>
      <section className="card"><h2 className="font-bold">篩選後花費最高的項目</h2><div className="mt-4 divide-y divide-stone-100">{summary.byItem.length ? summary.byItem.slice(0, 10).map((item, index) => <div key={item.name} className="flex items-center gap-4 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-moss-50 text-sm font-bold text-moss-700">{index + 1}</span><span className="min-w-0 flex-1 truncate font-medium">{item.name}</span><span className="font-bold">{formatMoney(item.value)}</span></div>) : <p className="py-8 text-center text-stone-400">此期間尚無資料</p>}</div></section>
    </>}
  </div>;
}

function Metric({ label, value, note }: { label: string; value: number; note: string }) { return <article className="card"><p className="text-sm font-medium text-stone-500">{label}</p><p className="mt-3 text-2xl font-bold">{formatMoney(value)}</p><p className="mt-2 text-xs text-stone-400">{note}</p></article>; }
function EmptyChart() { return <div className="flex h-full items-center justify-center text-sm text-stone-400">此期間尚無資料</div>; }
