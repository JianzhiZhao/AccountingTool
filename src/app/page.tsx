import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isSqliteDevelopment } from "@/lib/backend";

export default function Home() {
  redirect(isSqliteDevelopment() || isSupabaseConfigured() ? "/app" : "/setup");
}
