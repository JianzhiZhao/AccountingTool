export const CONNECTION_MESSAGE = "暫時無法連線，請確認網路後重試。登入狀態不會因此被清除。";

export function isSessionExpired(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const { name, code } = error as { name?: string; code?: string };
  return name === "AuthSessionMissingError" || [
    "refresh_token_not_found", "refresh_token_already_used", "session_not_found",
    "session_expired", "user_not_found", "user_banned", "bad_jwt",
  ].includes(code ?? "");
}

// Bounds the UI wait, including time spent waiting for the auth client's lock.
// The SDK can finish a refresh in the background without losing rotated tokens.
export async function withAuthTimeout<T>(operation: Promise<T>, timeoutMs = 12_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(CONNECTION_MESSAGE)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// Abort stalled HTTP requests; preserve retryable errors so the SDK keeps the session.
export const authFetch: typeof fetch = (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  if (!new URL(url).pathname.startsWith("/auth/v1/")) return fetch(input, init);
  const originalSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
  const timeout = AbortSignal.timeout(8_000);
  return fetch(input, {
    ...init,
    signal: originalSignal ? AbortSignal.any([originalSignal, timeout]) : timeout,
  });
};
