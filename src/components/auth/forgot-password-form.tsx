"use client";

import { useState } from "react";
import { LoaderCircle, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState(""); const [message, setMessage] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setMessage("");
    const redirectTo = `${window.location.origin}/update-password`;
    await createClient().auth.resetPasswordForEmail(email, { redirectTo });
    setMessage("如果帳號存在，重設密碼連結已寄到信箱。"); setLoading(false);
  }
  return <form onSubmit={submit} className="space-y-5"><div><label className="label" htmlFor="email">帳號 Email</label><input className="field" id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>{message && <p className="rounded-2xl bg-moss-50 p-3 text-sm text-moss-700">{message}</p>}<button className="btn-primary w-full" disabled={loading}>{loading ? <LoaderCircle className="animate-spin" size={18} /> : <Mail size={18} />}寄送重設連結</button></form>;
}
