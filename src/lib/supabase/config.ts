export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey || url.includes("your-project") || anonKey === "your-anon-key") return null;
  return { url, anonKey };
}

export const isSupabaseConfigured = () => getSupabaseConfig() !== null;
