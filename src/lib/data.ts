import { createClient } from "@/lib/supabase/client";
import { isSqliteDevelopment } from "@/lib/backend";
import { normalizeExpenseInput } from "@/lib/validation";
import { todayInTaipei } from "@/lib/date";
import type { Category, EnabledCurrency, Expense, ExpenseFilters, ExpenseInput, FavoriteInput, FavoriteTemplate, ImportedExpenseRecord, Tag } from "@/types/domain";

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
  let query = createClient().from("categories").select("*").order("sort_order").order("name");
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
  return (data ?? []).map(numericCurrency);
}

export async function listTags(includeInactive = false) {
  if (isSqliteDevelopment()) return devGet<Tag[]>("tags", { includeInactive });
  let query = createClient().from("tags").select("*").order("sort_order").order("name");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data as Tag[];
}

export async function listFavorites(includeInactive = false) {
  if (isSqliteDevelopment()) return devGet<FavoriteTemplate[]>("favorites", { includeInactive });
  let query = createClient().from("favorite_templates").select("*, categories(id,name,is_active), favorite_template_tags(tags(id,name))").order("sort_order").order("created_at");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(numericFavorite) as FavoriteTemplate[];
}

export async function listExpenses(filters?: Partial<ExpenseFilters>) {
  if (isSqliteDevelopment()) return devGet<Expense[]>("expenses", { query: filters?.query, from: filters?.from, to: filters?.to, categoryId: filters?.categoryId, currencyCode: filters?.currencyCode, tagId: filters?.tagId, expenseTypes: filters?.expenseTypes?.join(","), includeFutureAmortized: filters?.includeFutureAmortized });
  const client = createClient();
  let taggedExpenseIds: string[] | null = null;
  if (filters?.tagId) {
    const { data: tagged, error: tagError } = await client.from("expense_tags").select("expense_id").eq("tag_id", filters.tagId);
    if (tagError) throw tagError;
    taggedExpenseIds = (tagged ?? []).map((row) => row.expense_id);
    if (!taggedExpenseIds.length) return [];
  }
  let query = client.from("expenses").select("*, categories(id,name,is_active), expense_tags(tags(id,name))").order("expense_date", { ascending: false }).order("created_at", { ascending: false });
  if (filters?.from) query = query.gte("expense_date", filters.from);
  if (filters?.to) query = query.lte("expense_date", filters.to);
  if (filters?.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters?.currencyCode) query = query.eq("currency_code", filters.currencyCode);
  if (filters?.expenseTypes?.length) query = query.in("expense_type", filters.expenseTypes);
  if (filters?.includeFutureAmortized === false) query = query.or(`expense_type.neq.amortized,expense_date.lte.${todayInTaipei()}`);
  if (taggedExpenseIds) query = query.in("id", taggedExpenseIds);
  if (filters?.query) {
    const safe = filters.query.replace(/[^\p{L}\p{N}\s_-]/gu, " ").trim();
    if (safe) query = query.or(`item_name.ilike.%${safe}%,note.ilike.%${safe}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(numericExpense);
}

export async function listExpenseFamily(id: string) {
  if (isSqliteDevelopment()) return devGet<Expense[]>("expenseFamily", { id });
  const client = createClient();
  const { data: selected, error: selectedError } = await client.from("expenses").select("id,parent_expense_id").eq("id", id).single();
  if (selectedError) throw selectedError;
  const rootId = selected.parent_expense_id ?? selected.id;
  const { data, error } = await client.from("expenses").select("*, categories(id,name,is_active), expense_tags(tags(id,name))").or(`id.eq.${rootId},parent_expense_id.eq.${rootId}`).order("amortization_sequence", { ascending: true, nullsFirst: true });
  if (error) throw error;
  return (data ?? []).map(numericExpense);
}

export async function saveExpense(input: ExpenseInput, id?: string) {
  const normalized = normalizeExpenseInput(input);
  if (isSqliteDevelopment()) { await devPost({ action: "saveExpense", input: normalized, id }); return; }
  const client = createClient(); const uid = await userId();
  if (!id && normalized.expense_type === "prepaid") {
    const { error } = await client.rpc("create_prepaid_expense", {
      p_item_name: normalized.item_name,
      p_expense_date: normalized.expense_date,
      p_amount: normalized.amount,
      p_currency_code: normalized.currency_code,
      p_category_id: normalized.category_id,
      p_note: normalized.note,
      p_exchange_rate_to_twd: normalized.exchange_rate_to_twd,
      p_tag_ids: normalized.tag_ids,
      p_amortization_unit: normalized.amortization_unit,
      p_amortization_periods: normalized.amortization_periods,
      p_amortization_start_date: normalized.amortization_start_date,
    });
    if (error) throw error;
    return;
  }
  if (normalized.expense_type !== "general") throw new Error("預付與攤提帳目不可修改");
  const { tag_ids, amortization_unit: _unit, amortization_periods: _periods, amortization_start_date: _start, ...expenseInput } = normalized;
  void _unit; void _periods; void _start;
  const payload = { ...expenseInput, expense_type: "general", user_id: uid, exchange_rate_to_twd: normalized.currency_code === "TWD" ? 1 : normalized.exchange_rate_to_twd };
  const { data, error } = id
    ? await client.from("expenses").update(payload).eq("id", id).select("id").single()
    : await client.from("expenses").insert(payload).select("id").single();
  if (error) throw error;
  const expenseId = data.id;
  const { error: deleteError } = await client.from("expense_tags").delete().eq("expense_id", expenseId);
  if (deleteError) throw deleteError;
  if (tag_ids.length) {
    const { error: tagError } = await client.from("expense_tags").insert(tag_ids.map((tagId) => ({ expense_id: expenseId, tag_id: tagId, user_id: uid })));
    if (tagError) throw tagError;
  }
}

export async function deleteExpense(id: string) {
  if (isSqliteDevelopment()) { await devPost({ action: "deleteExpense", id }); return; }
  const { error } = await createClient().from("expenses").delete().eq("id", id);
  if (error) throw error;
}

export async function saveCategory(name: string, id?: string) {
  if (isSqliteDevelopment()) { await devPost({ action: "saveCategory", name, id }); return; }
  const client = createClient();
  let error;
  if (id) ({ error } = await client.from("categories").update({ name: name.trim() }).eq("id", id));
  else {
    const { data: last, error: orderError } = await client.from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
    if (orderError) throw orderError;
    ({ error } = await client.from("categories").insert({ name: name.trim(), user_id: await userId(), sort_order: Number(last?.sort_order ?? -1) + 1 }));
  }
  if (error) throw error;
}

export async function reorderCategories(ids: string[]) {
  if (isSqliteDevelopment()) { await devPost({ action: "reorderCategories", ids }); return; }
  const client = createClient();
  const results = await Promise.all(ids.map((id, sort_order) => client.from("categories").update({ sort_order }).eq("id", id)));
  const failed = results.find((result) => result.error); if (failed?.error) throw failed.error;
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

export async function saveTag(name: string) {
  if (isSqliteDevelopment()) { await devPost({ action: "saveTag", name }); return; }
  const client = createClient();
  const { data: last, error: orderError } = await client.from("tags").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
  if (orderError) throw orderError;
  const { error } = await client.from("tags").insert({ name: name.trim(), user_id: await userId(), sort_order: Number(last?.sort_order ?? -1) + 1 });
  if (error) throw error;
}

export async function reorderTags(ids: string[]) {
  if (isSqliteDevelopment()) { await devPost({ action: "reorderTags", ids }); return; }
  const client = createClient();
  const results = await Promise.all(ids.map((id, sort_order) => client.from("tags").update({ sort_order }).eq("id", id)));
  const failed = results.find((result) => result.error); if (failed?.error) throw failed.error;
}

export async function toggleTag(id: string, isActive: boolean) {
  if (isSqliteDevelopment()) { await devPost({ action: "toggleTag", id, isActive }); return; }
  const { error } = await createClient().from("tags").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function deleteTag(id: string) {
  if (isSqliteDevelopment()) { await devPost({ action: "deleteTag", id }); return; }
  const { error } = await createClient().from("tags").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleCurrency(code: string, isActive: boolean, defaultExchangeRateToTwd?: number) {
  if (isSqliteDevelopment()) { await devPost({ action: "toggleCurrency", code, isActive, defaultExchangeRateToTwd }); return; }
  const uid = await userId();
  const payload = {
    user_id: uid,
    code,
    is_active: code === "TWD" ? true : isActive,
    ...(defaultExchangeRateToTwd === undefined ? {} : { default_exchange_rate_to_twd: code === "TWD" ? 1 : defaultExchangeRateToTwd }),
  };
  const { error } = await createClient().from("enabled_currencies").upsert(payload, { onConflict: "user_id,code" });
  if (error) throw error;
}

export async function saveFavorite(input: FavoriteInput, id?: string) {
  if (isSqliteDevelopment()) { await devPost({ action: "saveFavorite", input, id }); return; }
  const client = createClient(); const uid = await userId(); const { tag_ids, ...favoriteInput } = input;
  const payload = { ...favoriteInput, user_id: uid, default_exchange_rate_to_twd: input.currency_code === "TWD" ? 1 : input.default_exchange_rate_to_twd };
  const { data, error } = id
    ? await client.from("favorite_templates").update(payload).eq("id", id).select("id").single()
    : await client.from("favorite_templates").insert(payload).select("id").single();
  if (error) throw error;
  const favoriteId = data.id;
  const { error: deleteError } = await client.from("favorite_template_tags").delete().eq("favorite_template_id", favoriteId);
  if (deleteError) throw deleteError;
  if (tag_ids.length) {
    const { error: tagError } = await client.from("favorite_template_tags").insert(tag_ids.map((tagId) => ({ favorite_template_id: favoriteId, tag_id: tagId, user_id: uid })));
    if (tagError) throw tagError;
  }
}

export async function deleteFavorite(id: string) {
  if (isSqliteDevelopment()) { await devPost({ action: "deleteFavorite", id }); return; }
  const { error } = await createClient().from("favorite_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function toggleFavorite(id: string, isActive: boolean) {
  if (isSqliteDevelopment()) { await devPost({ action: "toggleFavorite", id, isActive }); return; }
  const { error } = await createClient().from("favorite_templates").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

export async function currentUserId() { return userId(); }

export async function insertImportedExpense(id: string, input: ExpenseInput, createdAt: string, updatedAt: string) {
  const normalized = normalizeExpenseInput(input);
  if (normalized.expense_type !== "general") throw new Error("關聯帳目必須使用群組匯入");
  if (isSqliteDevelopment()) { await devPost({ action: "insertImportedExpense", id, input: normalized, createdAt, updatedAt }); return; }
  const client = createClient(); const uid = await userId(); const { tag_ids, amortization_unit: _unit, amortization_periods: _periods, amortization_start_date: _start, ...expenseInput } = normalized;
  void _unit; void _periods; void _start;
  const { error } = await client.from("expenses").insert({ id, user_id: uid, ...expenseInput, exchange_rate_to_twd: normalized.currency_code === "TWD" ? 1 : normalized.exchange_rate_to_twd, created_at: createdAt, updated_at: updatedAt });
  if (error) throw error;
  if (tag_ids.length) {
    const { error: tagError } = await client.from("expense_tags").insert(tag_ids.map((tagId) => ({ expense_id: id, tag_id: tagId, user_id: uid, created_at: createdAt })));
    if (tagError) throw tagError;
  }
}

function numericExpense(row: Record<string, unknown>): Expense {
  const links = Array.isArray(row.expense_tags) ? row.expense_tags as { tags?: { id: string; name: string } | null }[] : [];
  return { ...row, expense_type: row.expense_type ?? "general", parent_expense_id: row.parent_expense_id ?? null, amortization_unit: row.amortization_unit ?? null, amortization_periods: row.amortization_periods == null ? null : Number(row.amortization_periods), amortization_start_date: row.amortization_start_date ?? null, amortization_sequence: row.amortization_sequence == null ? null : Number(row.amortization_sequence), expense_tags: undefined, tags: links.flatMap((link) => link.tags ? [link.tags] : []), amount: Number(row.amount), exchange_rate_to_twd: Number(row.exchange_rate_to_twd), amount_twd: Number(row.amount_twd) } as unknown as Expense;
}

export async function insertImportedExpenseGroup(rows: ImportedExpenseRecord[]) {
  if (isSqliteDevelopment()) { await devPost({ action: "insertImportedExpenseGroup", rows }); return; }
  const { error } = await createClient().rpc("import_prepaid_expense_group", { p_rows: rows });
  if (error) throw error;
}
function numericFavorite(row: Record<string, unknown>): FavoriteTemplate {
  const links = Array.isArray(row.favorite_template_tags) ? row.favorite_template_tags as { tags?: { id: string; name: string } | null }[] : [];
  return { ...row, favorite_template_tags: undefined, tags: links.flatMap((link) => link.tags ? [link.tags] : []), default_amount: Number(row.default_amount), default_exchange_rate_to_twd: Number(row.default_exchange_rate_to_twd) } as unknown as FavoriteTemplate;
}
function numericCurrency(row: Record<string, unknown>): EnabledCurrency {
  return { ...row, default_exchange_rate_to_twd: Number(row.default_exchange_rate_to_twd) } as EnabledCurrency;
}
