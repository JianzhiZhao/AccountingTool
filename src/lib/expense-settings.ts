import { isSqliteDevelopment } from "./backend";
import { listCategories, listCurrencies, listFavorites, listTags } from "./data";
import { createClient } from "./supabase/client";
import { reportExpenseError, type ErrorReport } from "./error-report";

export class ExpenseSettingsError extends Error {
  constructor(public readonly requiresLogin: boolean) {
    super(requiresLogin ? "登入已失效，請重新登入後繼續記帳。" : "無法載入記帳設定，請檢查網路連線後重試。");
  }
}

function details(cause: unknown) {
  const value = cause as { code?: unknown; status?: unknown; message?: unknown } | null;
  return {
    code: typeof value?.code === "string" ? value.code : "",
    status: typeof value?.status === "number" ? value.status : 0,
    message: typeof value?.message === "string" ? value.message : "",
  };
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

// Retry reads only. Retrying a write could create a duplicate expense.
async function read<T>(resource: ErrorReport["resource"], request: () => Promise<T>, signal: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted();
    try {
      return await request();
    } catch (cause) {
      signal.throwIfAborted();
      const { code, status, message } = details(cause);
      const requiresLogin = status === 401 || ["SESSION_MISSING", "refresh_token_not_found", "refresh_token_already_used", "session_not_found", "PGRST301", "PGRST303"].includes(code);
      const transient = !requiresLogin && (
        status === 408 || status === 429 || status >= 500 || code === "57014" ||
        /failed to fetch|fetch failed|network|load failed|timeout|timed out|aborterror/i.test(message)
      );
      if (!transient || attempt >= 2) {
        // Keep diagnostics useful without logging tokens, URLs, or account data.
        const report = {
          resource, attempts: attempt + 1, status,
          code: /^[a-zA-Z0-9_]{1,48}$/.test(code) ? code : "unknown",
        };
        reportExpenseError(report);
        throw new ExpenseSettingsError(requiresLogin);
      }
      await wait(attempt === 0 ? 350 : 1000, signal);
    }
  }
}

export async function loadExpenseSettings(includeInactive: boolean, signal: AbortSignal) {
  if (!isSqliteDevelopment()) {
    await read("session", async () => {
      // getSession waits for SDK initialization and refreshes an expired token.
      // Check its error before querying, rather than falling back to anonymous RLS results.
      const { data, error } = await createClient().auth.getSession();
      if (error) throw error;
      if (!data.session) throw { code: "SESSION_MISSING" };
    }, signal);
  }
  return Promise.all([
    read("categories", () => listCategories(includeInactive), signal),
    read("currencies", () => listCurrencies(includeInactive), signal),
    read("favorites", () => listFavorites(false), signal),
    read("tags", () => listTags(includeInactive), signal),
  ]);
}
