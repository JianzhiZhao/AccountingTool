import Link from "next/link";
import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isSqliteDevelopment } from "@/lib/backend";
export const metadata = { title: "重設密碼" };
export default function ForgotPasswordPage() {
  if (isSqliteDevelopment()) redirect("/app");
  if (!isSupabaseConfigured()) redirect("/setup");
  return <main className="mx-auto flex min-h-screen max-w-md items-center px-5 py-10"><section className="card w-full p-7 md:p-9"><h1 className="page-title mb-2">忘記密碼</h1><p className="mb-7 text-stone-500">輸入帳號 Email，我們會寄送安全的重設連結。</p><ForgotPasswordForm /><Link href="/login" className="mt-5 block text-center text-sm font-medium text-moss-700">返回登入</Link></section></main>;
}
