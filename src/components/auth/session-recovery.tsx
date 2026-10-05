"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSqliteDevelopment } from "@/lib/backend";
import { CONNECTION_MESSAGE, isSessionExpired, withAuthTimeout } from "@/lib/supabase/auth-recovery";

export function SessionRecovery() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (isSqliteDevelopment()) return;
    let active = true;
    let pending = false;
    const client = createClient();
    const login = () => { if (active) { router.replace("/login"); router.refresh(); } };
    const { data: { subscription } } = client.auth.onAuthStateChange((event) => {
      // Do not await auth calls inside this callback: the SDK holds its auth lock.
      if (event === "SIGNED_OUT") login();
      if (event === "TOKEN_REFRESHED" && active) setFailed(false);
    });
    async function recover() {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        // getSession refreshes only when needed, avoiding unnecessary rotations.
        const { data, error } = await withAuthTimeout(client.auth.getSession());
        if (!active) return;
        if (error) {
          if (isSessionExpired(error)) { login(); return; }
          throw error;
        }
        if (!data.session) { login(); return; }
        setFailed(false);
      } catch {
        if (active) setFailed(true);
      } finally {
        pending = false;
      }
    }
    void recover();
    window.addEventListener("focus", recover);
    window.addEventListener("online", recover);
    window.addEventListener("pageshow", recover);
    document.addEventListener("visibilitychange", recover);
    return () => {
      active = false; subscription.unsubscribe();
      window.removeEventListener("focus", recover);
      window.removeEventListener("online", recover);
      window.removeEventListener("pageshow", recover);
      document.removeEventListener("visibilitychange", recover);
    };
  }, [router, attempt]);

  if (!failed) return null;
  return <div role="alert" className="mb-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
    <p>{CONNECTION_MESSAGE}</p>
    <button className="mt-2 font-semibold underline" onClick={() => setAttempt((value) => value + 1)}>重新連線</button>
  </div>;
}
