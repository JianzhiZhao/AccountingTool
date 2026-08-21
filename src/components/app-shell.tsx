"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Heart, List, LogOut, PlusCircle, Settings, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSqliteDevelopment } from "@/lib/backend";

const NAV = [
  { href: "/app", label: "記一筆", icon: PlusCircle },
  { href: "/app/expenses", label: "帳目", icon: List },
  { href: "/app/analytics", label: "統計", icon: BarChart3 },
  { href: "/app/favorites", label: "常用", icon: Heart },
  { href: "/app/settings", label: "設定", icon: Settings },
];

export function AppShell({ children, email }: { children: React.ReactNode; email: string }) {
  const pathname = usePathname(); const router = useRouter();
  async function logout() { if (isSqliteDevelopment()) return; await createClient().auth.signOut(); router.replace("/login"); router.refresh(); }
  return <div className="min-h-screen md:flex">
    <aside className="hidden w-64 shrink-0 flex-col border-r border-stone-200 bg-white/80 p-5 backdrop-blur md:fixed md:inset-y-0 md:flex">
      <Link href="/app" className="mb-8 flex items-center gap-3 px-2"><span className="rounded-xl bg-moss-700 p-2 text-white"><WalletCards size={22} /></span><span className="text-xl font-bold">小帳本</span></Link>
      <nav className="space-y-1">{NAV.map(({ href, label, icon: Icon }) => { const active = href === "/app" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} className={`flex items-center gap-3 rounded-2xl px-4 py-3 font-medium transition ${active ? "bg-moss-100 text-moss-700" : "text-stone-500 hover:bg-stone-50 hover:text-ink"}`}><Icon size={20} />{label}</Link>; })}</nav>
      <div className="mt-auto border-t border-stone-100 pt-4"><p className="truncate px-2 text-xs text-stone-400">{email}</p>{!isSqliteDevelopment() && <button onClick={logout} className="mt-2 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-stone-500 hover:bg-red-50 hover:text-red-700"><LogOut size={18} />登出</button>}</div>
    </aside>
    <main className="w-full pb-24 md:ml-64 md:pb-8"><div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-9">{isSqliteDevelopment() && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800">SQLite 本機開發模式 · 資料只保存在這台電腦</div>}{children}</div></main>
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-stone-200 bg-white/95 px-1 pb-[max(.4rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur md:hidden">{NAV.map(({ href, label, icon: Icon }) => { const active = href === "/app" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium ${active ? "text-moss-700" : "text-stone-400"}`}><Icon size={21} strokeWidth={active ? 2.5 : 2} />{label}</Link>; })}</nav>
  </div>;
}
