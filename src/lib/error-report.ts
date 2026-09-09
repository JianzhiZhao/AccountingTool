import { z } from "zod";

export const errorReportSchema = z.object({
  resource: z.enum(["session", "categories", "currencies", "favorites", "tags"]),
  attempts: z.number().int().min(1).max(3),
  status: z.number().int().min(0).max(599),
  code: z.string().regex(/^[a-zA-Z0-9_]{1,48}$/),
}).strict();

export type ErrorReport = z.infer<typeof errorReportSchema>;
const STORAGE_KEY = "accounting-error-reports-v1";
const DAY = 24 * 60 * 60 * 1000;
const DEDUP_WINDOW = 30 * 60 * 1000;
const historySchema = z.array(z.object({ key: z.string().max(100), time: z.number().finite() })).max(10);
let recent: z.infer<typeof historySchema> = [];

export function reportExpenseError(report: ErrorReport) {
  if (typeof window === "undefined") return;
  const parsed = errorReportSchema.safeParse(report);
  if (!parsed.success) return;
  const now = Date.now();
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && saved.length <= 4096) {
      const history = historySchema.safeParse(JSON.parse(saved));
      if (history.success) recent = [...recent, ...history.data];
    }
  } catch { /* Private browsing may block storage; retain an in-memory limit. */ }
  recent = recent.filter((entry, index, entries) => entry.time > now - DAY &&
    entries.findIndex((item) => item.key === entry.key && item.time === entry.time) === index).slice(-10);
  const key = `${report.resource}:${report.status}:${report.code}`;
  if (recent.length >= 10 || recent.some((entry) => entry.key === key && entry.time > now - DEDUP_WINDOW)) return;
  // Reserve quota before sending, even if the request fails. Never queue or retry telemetry.
  recent.push({ key, time: now });
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(recent)); } catch { /* Best effort. */ }
  try {
    void fetch("/api/client-errors", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data), signal: AbortSignal.timeout(3000),
    }).catch(() => {});
  } catch { /* Reporting must never affect accounting or recursively report itself. */ }
}
