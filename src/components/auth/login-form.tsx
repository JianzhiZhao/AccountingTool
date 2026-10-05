"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogIn, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CONNECTION_MESSAGE, isSessionExpired, withAuthTimeout } from "@/lib/supabase/auth-recovery";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [connectionError, setConnectionError] = useState(false);
  const [loginRequired, setLoginRequired] = useState(false);
  const [navigating, setNavigating] = useState(false);

  function retryRestore() {
    setRestoring(true); setConnectionError(false); setError("");
    setAttempt((value) => value + 1);
  }

  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const result = await withAuthTimeout(createClient().auth.getUser());
        if (!active) return;
        if (result.error && !isSessionExpired(result.error)) throw result.error;
        if (result.data.user && !result.error) {
          setNavigating(true);
          router.replace("/app"); router.refresh();
        } else {
          setLoginRequired(true);
        }
      } catch {
        if (active) { setError(CONNECTION_MESSAGE); setConnectionError(true); }
      } finally {
        if (active) setRestoring(false);
      }
    }
    void restore();
    return () => { active = false; };
  }, [router, attempt]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (loading || restoring) return;
    setLoading(true); setError(""); setConnectionError(false);
    try {
      const { error } = await withAuthTimeout(createClient().auth.signInWithPassword({ email, password }));
      if (error) {
        if (error.code === "invalid_credentials") { setError("登入失敗，請確認 Email 與密碼。"); return; }
        throw error;
      }
      setNavigating(true);
      router.replace("/app"); router.refresh();
    } catch {
      setError(CONNECTION_MESSAGE); setConnectionError(true);
    } finally {
      setLoading(false);
    }
  }

  if (restoring || navigating) return <div role="status" className="flex min-h-40 flex-col items-center justify-center gap-4 text-moss-700">
    <LoaderCircle className="animate-spin" size={24} />
    <p>正在開啟快速記一筆…</p>
  </div>;

  if (!loginRequired) return <div className="space-y-4">
    <p role="alert" className="text-sm text-stone-600">{error}</p>
    <button type="button" className="btn-primary w-full" onClick={retryRestore}>重試連線並恢復登入</button>
  </div>;

  return <>
    <div className="mb-6 inline-flex rounded-2xl bg-moss-100 p-3 text-moss-700"><WalletCards size={28} /></div>
    <p className="mb-1 text-sm font-medium text-moss-700">私人雲端帳本</p>
    <h1 className="page-title mb-2">歡迎回來</h1>
    <p className="mb-7 text-stone-500">登入後繼續記錄今天的每一筆支出。</p>
    <form onSubmit={submit} className="space-y-5">
      <div><label className="label" htmlFor="email">Email</label><input className="field" id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><label className="label" htmlFor="password">密碼</label><input className="field" id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      {error && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {connectionError && <button type="button" className="btn-secondary w-full" disabled={loading || restoring} onClick={retryRestore}>重試連線並恢復登入</button>}
      <button className="btn-primary w-full" disabled={loading || restoring}>{loading ? <LoaderCircle className="animate-spin" size={18} /> : <LogIn size={18} />}登入</button>
      <div className="text-center"><Link className="text-sm font-medium text-moss-700 hover:underline" href="/forgot-password">忘記密碼？</Link></div>
    </form>
  </>;
}
