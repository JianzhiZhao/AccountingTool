import { Database, ExternalLink, KeyRound, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { isSqliteDevelopment } from "@/lib/backend";

export const metadata = { title: "設定網站" };

export default function SetupPage() {
  if (isSqliteDevelopment()) redirect("/app");
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-5 py-12">
      <section className="card w-full p-7 md:p-10">
        <div className="mb-6 inline-flex rounded-2xl bg-moss-100 p-3 text-moss-700"><Database size={28} /></div>
        <p className="mb-2 font-medium text-moss-700">只差最後三個步驟</p>
        <h1 className="page-title mb-3">連接你的私人資料庫</h1>
        <p className="mb-8 text-stone-600">網站已經準備好。完成 Supabase 設定後，就能安全登入並開始記帳。</p>
        <ol className="space-y-5">
          <li className="flex gap-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-moss-700 text-white">1</span><div className="min-w-0"><h2 className="font-semibold">建立 Supabase 專案</h2><p className="muted mt-1 [overflow-wrap:anywhere]">在 Supabase 建立免費專案，執行 supabase/migrations/001_initial_schema.sql。</p></div></li>
          <li className="flex gap-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-moss-700 text-white">2</span><div className="min-w-0"><h2 className="font-semibold">設定環境變數</h2><p className="muted mt-1 [overflow-wrap:anywhere]">複製 .env.example 為 .env.local，填入 Project URL 與 anon public key。</p></div></li>
          <li className="flex gap-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-moss-700 text-white">3</span><div className="min-w-0"><h2 className="font-semibold">建立私人帳號</h2><p className="muted mt-1 [overflow-wrap:anywhere]">在 Authentication 建立你的 Email 帳號並關閉 Allow new users to sign up。</p></div></li>
        </ol>
        <div className="mt-8 grid gap-3 rounded-2xl bg-moss-50 p-4 text-sm text-moss-700 sm:grid-cols-2">
          <span className="flex items-center gap-2"><ShieldCheck size={18} />資料列權限已包含</span>
          <span className="flex items-center gap-2"><KeyRound size={18} />管理金鑰不會放在前端</span>
        </div>
        <a className="btn-primary mt-7" href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">開啟 Supabase <ExternalLink size={17} /></a>
      </section>
    </main>
  );
}
