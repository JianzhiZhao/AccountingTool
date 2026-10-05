import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";
import { authFetch } from "./auth-recovery";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (browserClient) return browserClient;
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase 尚未設定");
  browserClient = createBrowserClient(config.url, config.anonKey, { global: { fetch: authFetch } });
  return browserClient;
}
