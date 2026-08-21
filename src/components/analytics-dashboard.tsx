"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarRange, LoaderCircle, TrendingUp, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { listExpenses } from "@/lib/data";
import { currentMonthRange } from "@/lib/date";
import { formatMoney, summarizeExpenses } from "@/lib/analytics";
import type { Expense } from "@/types/domain";
import { StatusMessage } from "./status-message";

const axisStyle = { fontSize: 11, fill: "#a4aea7" };
const tooltipStyle = { backgroundColor: "#121815", border: "1px solid #2d3830", borderRadius: 14, color: "#edf4ef" };

export function AnalyticsDashboard() {
  const initial = currentMonthRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [range, setRange] = useState(initial);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listExpenses({ from: range.from, to: range.to })
      .then(setExpenses)
      .catch(() => setError("無法載入統計資料。"))
      .finally(() => setLoading(false));
  }, [range]);

  const summary = useMemo(() => summarizeExpenses(expenses), [expenses]);
  const trendData = useMemo(() => {
    const days = Math.ceil((new Date(`${range.to}T00:00:00`).getTime() - new Date(`${range.from}T00:00:00`).getTime()) / 86400000);
    return days > 90 ? summary.byMonth : summary.byDate;
  }, [range, summary]);

  function apply(event: React.FormEvent) {
    event.preventDefault();
    if (from && to && from > to) { setError("開始日期不能晚於結束日期。"); return; }
    setLoading(true); setError(""); setRange({ from, to });
  }

  return <div className="space-y-5">
    <form onSubmit={apply} className="card flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1"><label className="label">開始日期</label><input className="field" type="date" required value={from} onChange={(event) => setFrom(event.target.value)} /></div>
      <div className="min-w-0 flex-1"><label className="label">結束日期</label><input className="field" type="date" required value={to} onChange={(event) => setTo(event.target.value)} /></div>
      <button className="btn-primary"><CalendarRange size={18} />更新統計</button>
    </form>
    <StatusMessage message={error} error />
    {loading ? <div className="card flex min-h-48 items-center justify-center"><LoaderCircle className="animate-spin text-moss-600" /></div> : <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="card sm:col-span-2"><div className="flex items-center gap-2 text-sm font-medium text-stone-500"><Wallet size={18} />換算後總支出</div><p className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{formatMoney(summary.totalTwd)}</p><p className="mt-2 text-xs text-stone-400">依每筆保存的匯率換算</p></article>
        {summary.byCurrency.length ? summary.byCurrency.slice(0, 2).map((item) => <article key={item.name} className="card"><p className="text-sm font-medium text-stone-500">{item.name} 原幣總額</p><p className="mt-3 text-2xl font-bold">{formatMoney(item.value, item.name)}</p></article>) : <article className="card sm:col-span-2"><p className="text-stone-400">此期間尚無支出</p></article>}
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        <article className="card"><div className="mb-5 flex items-center gap-2"><TrendingUp className="text-moss-600" size={20} /><h2 className="font-bold">{trendData === summary.byMonth ? "每月" : "每日"}支出趨勢</h2></div><div className="h-72">{trendData.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={trendData} margin={{ left: 4, right: 8 }}><CartesianGrid strokeDasharray="3 3" stroke="#2d3830" /><XAxis dataKey="date" tick={axisStyle} axisLine={{ stroke: "#465448" }} tickLine={{ stroke: "#465448" }} tickFormatter={(value) => value.slice(5)} /><YAxis tick={axisStyle} axisLine={false} tickLine={false} width={56} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => formatMoney(Number(value))} /><Line type="monotone" dataKey="value" stroke="#82d39b" strokeWidth={3} dot={{ r: 3, fill: "#82d39b", stroke: "#102018", strokeWidth: 2 }} /></LineChart></ResponsiveContainer> : <EmptyChart />}</div></article>
        <article className="card"><div className="mb-5 flex items-center gap-2"><BarChart3 className="text-coral" size={20} /><h2 className="font-bold">分類支出分布</h2></div><div className="h-72">{summary.byCategory.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={summary.byCategory.slice(0, 8)} layout="vertical" margin={{ left: 8, right: 12 }}><CartesianGrid strokeDasharray="3 3" stroke="#2d3830" /><XAxis type="number" tick={axisStyle} axisLine={{ stroke: "#465448" }} tickLine={{ stroke: "#465448" }} /><YAxis dataKey="name" type="category" tick={{ ...axisStyle, fontSize: 12 }} axisLine={false} tickLine={false} width={72} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => formatMoney(Number(value))} /><Bar dataKey="value" fill="#ff8a68" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart />}</div></article>
      </section>
      <section className="card"><h2 className="font-bold">花費最高的項目</h2><div className="mt-4 divide-y divide-stone-100">{summary.byItem.length ? summary.byItem.slice(0, 10).map((item, index) => <div key={item.name} className="flex items-center gap-4 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-moss-50 text-sm font-bold text-moss-700">{index + 1}</span><span className="min-w-0 flex-1 truncate font-medium">{item.name}</span><span className="font-bold">{formatMoney(item.value)}</span></div>) : <p className="py-8 text-center text-stone-400">此期間尚無資料</p>}</div></section>
    </>}
  </div>;
}

function EmptyChart() { return <div className="flex h-full items-center justify-center text-sm text-stone-400">此期間尚無資料</div>; }
