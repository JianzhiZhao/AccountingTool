"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const router = useRouter(); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError("");
    if (password.length < 8) { setError("密碼至少需要 8 個字元。"); setLoading(false); return; }
    const { error } = await createClient().auth.updateUser({ password });
    if (error) { setError("無法更新密碼，請重新開啟重設連結。"); setLoading(false); return; }
    router.replace("/app"); router.refresh();
  }
  return <form onSubmit={submit} className="space-y-5"><div><label className="label" htmlFor="password">新密碼</label><input className="field" id="password" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>{error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button className="btn-primary w-full" disabled={loading}>更新密碼</button></form>;
}
