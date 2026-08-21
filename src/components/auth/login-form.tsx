"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    const { error } = await createClient().auth.signInWithPassword({ email, password });
    if (error) { setError("登入失敗，請確認 Email 與密碼。"); setLoading(false); return; }
    router.replace("/app"); router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div><label className="label" htmlFor="email">Email</label><input className="field" id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><label className="label" htmlFor="password">密碼</label><input className="field" id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      {error && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button className="btn-primary w-full" disabled={loading}>{loading ? <LoaderCircle className="animate-spin" size={18} /> : <LogIn size={18} />}登入</button>
      <div className="text-center"><Link className="text-sm font-medium text-moss-700 hover:underline" href="/forgot-password">忘記密碼？</Link></div>
    </form>
  );
}
