import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { isSqliteDevelopment } from "@/lib/backend";
import { authFetch } from "@/lib/supabase/auth-recovery";

export async function proxy(request: NextRequest) {
  if (isSqliteDevelopment()) return NextResponse.next({ request });
  const config = getSupabaseConfig();
  if (!config) return NextResponse.next({ request });

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.anonKey, {
    global: { fetch: authFetch },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Only refresh cookies here. Protected pages still verify identity with getUser,
  // and database access is independently protected by RLS.
  await supabase.auth.getSession();
  return response;
}

// Login restores the session in the browser so its UI never waits on the proxy.
export const config = { matcher: ["/app/:path*", "/update-password"] };
