import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isSqliteDevelopment } from "@/lib/backend";

export const metadata = { title: "登入" };
export default async function LoginPage() {
  if (isSqliteDevelopment()) redirect("/app");
  if (!isSupabaseConfigured()) redirect("/setup");
  return <main className="mx-auto flex min-h-screen max-w-md items-center px-5 py-10"><section className="card w-full p-7 md:p-9"><LoginForm /></section></main>;
}
