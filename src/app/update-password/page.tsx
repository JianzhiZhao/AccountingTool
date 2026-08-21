import { redirect } from "next/navigation";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isSqliteDevelopment } from "@/lib/backend";
export const metadata = { title: "設定新密碼" };
export default function UpdatePasswordPage() {
  if (isSqliteDevelopment()) redirect("/app");
  if (!isSupabaseConfigured()) redirect("/setup");
  return <main className="mx-auto flex min-h-screen max-w-md items-center px-5 py-10"><section className="card w-full p-7 md:p-9"><h1 className="page-title mb-2">設定新密碼</h1><p className="mb-7 text-stone-500">請使用至少 8 個字元的新密碼。</p><UpdatePasswordForm /></section></main>;
}
