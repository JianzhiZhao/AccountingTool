"use client";

import { CONNECTION_MESSAGE } from "@/lib/supabase/auth-recovery";

export function ConnectionRetry() {
  return <main className="mx-auto max-w-md px-5 py-10"><section className="card space-y-4 p-7" role="alert">
    <h1 className="text-xl font-bold">目前無法確認登入狀態</h1>
    <p>{CONNECTION_MESSAGE}</p>
    <button className="btn-primary" onClick={() => window.location.reload()}>重新連線</button>
  </section></main>;
}
