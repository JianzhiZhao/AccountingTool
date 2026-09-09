import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { isSqliteDevelopment } from "@/lib/backend";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center px-4"><div className="card w-full max-w-sm text-center" role="status"><p className="text-xl font-bold text-moss-700">小帳本</p><p className="mt-2 text-sm text-stone-500">正在開啟帳本…</p></div></div>}><AuthenticatedLayout>{children}</AuthenticatedLayout></Suspense>;
}

async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  if (isSqliteDevelopment()) return <AppShell email="SQLite 本機開發模式">{children}</AppShell>;
  if (!isSupabaseConfigured()) redirect("/setup");
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) redirect("/login");
  return <AppShell email={user.email ?? "私人帳號"}>{children}</AppShell>;
}
