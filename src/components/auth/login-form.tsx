"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogIn } from "lucide-react";
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

  useEffect(() => {
    let active = true;
    async function restore() {
      try {
        const result = await withAuthTimeout(createClient().auth.getUser());
        if (!active) return;
        if (result.error && !isSessionExpired(result.error)) throw result.error;
        if (result.data.user && !result.error) {
          router.replace("/app"); router.refresh();
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
      router.replace("/app"); router.refresh();
    } catch {
      setError(CONNECTION_MESSAGE); setConnectionError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {restoring && <p role="status" className="text-sm text-stone-500">正在恢復登入狀態…</p>}
      <div><label className="label" htmlFor="email">Email</label><input className="field" id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><label className="label" htmlFor="password">密碼</label><input className="field" id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      {error && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {connectionError && <button type="button" className="btn-secondary w-full" disabled={loading || restoring} onClick={() => { setRestoring(true); setConnectionError(false); setError(""); setAttempt((value) => value + 1); }}>重試連線並恢復登入</button>}
      <button className="btn-primary w-full" disabled={loading || restoring}>{loading ? <LoaderCircle className="animate-spin" size={18} /> : <LogIn size={18} />}登入</button>
      <div className="text-center"><Link className="text-sm font-medium text-moss-700 hover:underline" href="/forgot-password">忘記密碼？</Link></div>
    </form>
  );
}
