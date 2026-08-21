import { createClient } from "@/lib/supabase/client";
import { isSqliteDevelopment } from "@/lib/backend";
import type { Category, EnabledCurrency, Expense, ExpenseFilters, ExpenseInput, FavoriteTemplate } from "@/types/domain";

const LOCAL_USER_ID = "local-dev-user";

async function devGet<T>(resource: string, params: Record<string, string | boolean | undefined> = {}) {
  const search = new URLSearchParams({ resource });
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined && value !== "") search.set(key, String(value)); });
  const response = await fetch(`/api/dev-data?${search}`, { cache: "no-store" });
  const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "本機資料讀取失敗"); return data as T;
}

async function devPost<T = { ok: true }>(body: Record<string, unknown>) {
  const response = await fetch("/api/dev-data", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "本機資料寫入失敗"); return data as T;
}

async function userId() {
  if (isSqliteDevelopment()) return LOCAL_USER_ID;
  const { data: { user }, error } = await createClient().auth.getUser();
  if (error || !user) throw new Error("登入已逾時，請重新登入");
  return user.id;
}

export async function listCategories(includeInactive = false) {
  if (isSqliteDevelopment()) return devGet<Category[]>("categories", { includeInactive });
  let query = createClient().from("categories").select("*").order("is_active", { ascending: false }).order("name");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data as Category[];
}

export async function listCurrencies(includeInactive = false) {
  if (isSqliteDevelopment()) return devGet<EnabledCurrency[]>("currencies", { includeInactive });
  let query = createClient().from("enabled_currencies").select("*").order("code");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data as EnabledCurrency[];
}

export async function listFavorites() {
  if (isSqliteDevelopment()) return devGet<FavoriteTemplate[]>("favorites");
  const { data, error } = await createClient().from("favorite_templates").select("*, categories(id,name,is_active)").order("sort_order").order("created_at");
  if (error) throw error;
  return (data ?? []).map(numericFavorite) as FavoriteTemplate[];
}

export async function listExpenses(filters?: Partial<ExpenseFilters>) {
  if (isSqliteDevelopment()) return devGet<Expense[]>("expenses", { query: filters?.query, from: filters?.from, to: filters?.to, categoryId: filters?.categoryId, currencyCode: filters?.currencyCode });
  let query = createClient().from("expenses").select("*, categories(id,name,is_active)").order("expense_date", { ascending: false }).order("created_at", { ascending: false });
  if (filters?.from) query = query.gte("expense_date", filters.from);
  if (filters?.to) query = query.lte("expense_date", filters.to);
  if (filters?.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters?.currencyCode) query = query.eq("currency_code", filters.currencyCode);
  if (filters?.query) {
    const safe = filters.query.replace(/[^\p{L}\p{N}\s_-]/gu, " ").trim();
    if (safe) query = query.or(`item_name.ilike.%${safe}%,note.ilike.%${safe}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(numericExpense) as Expense[];
}

export async function saveExpense(input: ExpenseInput, id?: string) {
  if (isSqliteDevelopment()) { await devPost({ action: "saveExpense", input, id }); return; }
  const payload = { ...input, user_id: await userId(), exchange_rate_to_twd: input.currency_code === "TWD" ? 1 : input.exchange_rate_to_twd };
  const query = id ? createClient().from("expenses").update(payload).eq("id", id) : createClient().from("expenses").insert(payload);
  const { error } = await query;
  if (error) throw error;
}

export async function deleteExpense(id: string) {
  if (isSqliteDevelopment()) { await devPost({ action: "deleteExpense", id }); return; }
  const { error } = await createClient().from("expenses").delete().eq("id", id);
  if (error) throw error;
}

export async function saveCategory(name: string, id?: string) {
  if (isSqliteDevelopment()) { await devPost({ action: "saveCategory", name, id }); return; }
  const { error } = id
    ? await createClient().from("categories").update({ name: name.trim() }).eq("id", id)
    : await createClient().from("categories").insert({ name: name.trim(), user_id: await userId() });
  if (error) throw error;
}

export async function toggleCategory(id: string, isActive: boolean) {
  if (isSqliteDevelopment()) { await devPost({ action: "toggleCategory", id, isActive }); return; }
  const { error } = await createClient().from("categories").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function deleteCategory(id: string) {
  if (isSqliteDevelopment()) { await devPost({ action: "deleteCategory", id }); return; }
  const { error } = await createClient().from("categories").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleCurrency(code: string, isActive: boolean) {
  if (isSqliteDevelopment()) { await devPost({ action: "toggleCurrency", code, isActive }); return; }
  const uid = await userId();
  const { error } = await createClient().from("enabled_currencies").upsert({ user_id: uid, code, is_active: isActive }, { onConflict: "user_id,code" });
  if (error) throw error;
}

export async function saveFavorite(input: Omit<FavoriteTemplate, "id" | "user_id" | "created_at" | "updated_at" | "categories">, id?: string) {
  if (isSqliteDevelopment()) { await devPost({ action: "saveFavorite", input, id }); return; }
  const payload = { ...input, user_id: await userId(), default_exchange_rate_to_twd: input.currency_code === "TWD" ? 1 : input.default_exchange_rate_to_twd };
  const query = id ? createClient().from("favorite_templates").update(payload).eq("id", id) : createClient().from("favorite_templates").insert(payload);
  const { error } = await query;
  if (error) throw error;
}

export async function deleteFavorite(id: string) {
  if (isSqliteDevelopment()) { await devPost({ action: "deleteFavorite", id }); return; }
  const { error } = await createClient().from("favorite_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function currentUserId() { return userId(); }

export async function insertImportedExpense(id: string, input: ExpenseInput, createdAt: string, updatedAt: string) {
  if (isSqliteDevelopment()) { await devPost({ action: "insertImportedExpense", id, input, createdAt, updatedAt }); return; }
  const { error } = await createClient().from("expenses").insert({ id, user_id: await userId(), ...input, exchange_rate_to_twd: input.currency_code === "TWD" ? 1 : input.exchange_rate_to_twd, created_at: createdAt, updated_at: updatedAt });
  if (error) throw error;
}

function numericExpense(row: Record<string, unknown>) {
  return { ...row, amount: Number(row.amount), exchange_rate_to_twd: Number(row.exchange_rate_to_twd), amount_twd: Number(row.amount_twd) };
}
function numericFavorite(row: Record<string, unknown>) {
  return { ...row, default_amount: Number(row.default_amount), default_exchange_rate_to_twd: Number(row.default_exchange_rate_to_twd) };
}
