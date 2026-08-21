import { redirect } from "next/navigation";
import { WalletCards } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isSqliteDevelopment } from "@/lib/backend";

export const metadata = { title: "登入" };
export default async function LoginPage() {
  if (isSqliteDevelopment()) redirect("/app");
  if (!isSupabaseConfigured()) redirect("/setup");
  const { data: { user } } = await (await createClient()).auth.getUser();
  if (user) redirect("/app");
  return <main className="mx-auto flex min-h-screen max-w-md items-center px-5 py-10"><section className="card w-full p-7 md:p-9"><div className="mb-6 inline-flex rounded-2xl bg-moss-100 p-3 text-moss-700"><WalletCards size={28} /></div><p className="mb-1 text-sm font-medium text-moss-700">私人雲端帳本</p><h1 className="page-title mb-2">歡迎回來</h1><p className="mb-7 text-stone-500">登入後繼續記錄今天的每一筆支出。</p><LoginForm /></section></main>;
}
