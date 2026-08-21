import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { isSqliteDevelopment } from "@/lib/backend";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  if (isSqliteDevelopment()) return <AppShell email="SQLite 本機開發模式">{children}</AppShell>;
  if (!isSupabaseConfigured()) redirect("/setup");
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (!user) redirect("/login");
  return <AppShell email={user.email ?? "私人帳號"}>{children}</AppShell>;
}
