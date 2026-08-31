import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isSqliteDevelopment } from "@/lib/backend";
import { getSqliteDatabase, LOCAL_USER_ID } from "@/lib/sqlite/database";
import { normalizeExpenseInput, categoryNameSchema, exchangeRateSchema, orderedIdsSchema, tagIdsSchema, tagNameSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailable() { return NextResponse.json({ error: "SQLite API 僅供本機開發模式使用" }, { status: 404 }); }
function fail(error: unknown) { return NextResponse.json({ error: error instanceof Error ? error.message : "資料操作失敗" }, { status: 400 }); }
const booleanRow = <T extends Record<string, unknown>>(row: T) => ({ ...row, is_active: Boolean(row.is_active) });

export async function GET(request: NextRequest) {
  if (!isSqliteDevelopment()) return unavailable();
  try {
    const db = getSqliteDatabase(); const resource = request.nextUrl.searchParams.get("resource");
    const includeInactive = request.nextUrl.searchParams.get("includeInactive") === "true";
    if (resource === "categories") {
      const rows = db.prepare(`select * from categories ${includeInactive ? "" : "where is_active = 1"} order by sort_order, name collate nocase`).all();
      return NextResponse.json(rows.map((row) => booleanRow(row as Record<string, unknown>)));
    }
    if (resource === "currencies") {
      const rows = db.prepare(`select * from enabled_currencies ${includeInactive ? "" : "where is_active = 1"} order by code`).all();
      return NextResponse.json(rows.map((raw) => { const row = booleanRow(raw as Record<string, unknown>); return { ...row, default_exchange_rate_to_twd: Number(row.default_exchange_rate_to_twd) }; }));
    }
    if (resource === "tags") {
      return NextResponse.json(db.prepare("select * from tags order by sort_order, name collate nocase").all());
    }
    if (resource === "favorites") {
      const rows = db.prepare(`select f.*, c.name as category_name, c.is_active as category_active from favorite_templates f join categories c on c.id = f.category_id order by f.sort_order, f.created_at`).all();
      const tagQuery = db.prepare("select t.id, t.name from tags t join favorite_template_tags ft on ft.tag_id=t.id where ft.favorite_template_id=? order by t.name collate nocase");
      return NextResponse.json(rows.map((raw) => { const row = raw as Record<string, unknown>; return { ...row, default_amount: Number(row.default_amount), default_exchange_rate_to_twd: Number(row.default_exchange_rate_to_twd), tags: tagQuery.all(String(row.id)), categories: { id: row.category_id, name: row.category_name, is_active: Boolean(row.category_active) }, category_name: undefined, category_active: undefined }; }));
    }
    if (resource === "expenses") {
      const where: string[] = []; const values: string[] = [];
      const add = (clause: string, value: string | null) => { if (value) { where.push(clause); values.push(value); } };
      add("e.expense_date >= ?", request.nextUrl.searchParams.get("from")); add("e.expense_date <= ?", request.nextUrl.searchParams.get("to"));
      add("e.category_id = ?", request.nextUrl.searchParams.get("categoryId")); add("e.currency_code = ?", request.nextUrl.searchParams.get("currencyCode"));
      add("exists (select 1 from expense_tags et where et.expense_id = e.id and et.tag_id = ?)", request.nextUrl.searchParams.get("tagId"));
      const query = request.nextUrl.searchParams.get("query")?.trim(); if (query) { where.push("(e.item_name like ? escape '\\' or e.note like ? escape '\\')"); const safe = `%${query.replace(/[\\%_]/g, "\\$&")}%`; values.push(safe, safe); }
      const rows = db.prepare(`select e.*, c.name as category_name, c.is_active as category_active from expenses e join categories c on c.id = e.category_id ${where.length ? `where ${where.join(" and ")}` : ""} order by e.expense_date desc, e.created_at desc`).all(...values);
      const tagQuery = db.prepare("select t.id, t.name from tags t join expense_tags et on et.tag_id=t.id where et.expense_id=? order by t.name collate nocase");
      return NextResponse.json(rows.map((raw) => { const row = raw as Record<string, unknown>; const amount = Number(row.amount); const rate = Number(row.exchange_rate_to_twd); return { ...row, amount, exchange_rate_to_twd: rate, amount_twd: amount * rate, tags: tagQuery.all(String(row.id)), categories: { id: row.category_id, name: row.category_name, is_active: Boolean(row.category_active) }, category_name: undefined, category_active: undefined }; }));
    }
    return fail("未知的資料類型");
  } catch (error) { return fail(error); }
}

export async function POST(request: NextRequest) {
  if (!isSqliteDevelopment()) return unavailable();
  try {
    const db = getSqliteDatabase(); const body = await request.json() as Record<string, unknown>; const action = String(body.action ?? ""); const now = new Date().toISOString();
    if (action === "saveExpense") {
      const input = normalizeExpenseInput(body.input); const id = typeof body.id === "string" ? body.id : randomUUID();
      db.exec("begin");
      try {
        if (body.id) db.prepare("update expenses set item_name=?, expense_date=?, amount=?, currency_code=?, category_id=?, note=?, exchange_rate_to_twd=?, updated_at=? where id=?").run(input.item_name, input.expense_date, String(input.amount), input.currency_code, input.category_id, input.note, String(input.exchange_rate_to_twd), now, id);
        else db.prepare("insert into expenses values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, LOCAL_USER_ID, input.item_name, input.expense_date, String(input.amount), input.currency_code, input.category_id, input.note, String(input.exchange_rate_to_twd), now, now);
        db.prepare("delete from expense_tags where expense_id=?").run(id);
        const addTag = db.prepare("insert into expense_tags (expense_id,tag_id,user_id,created_at) values (?,?,?,?)");
        for (const tagId of input.tag_ids) addTag.run(id, tagId, LOCAL_USER_ID, now);
        db.exec("commit");
      } catch (error) { db.exec("rollback"); throw error; }
      return NextResponse.json({ id });
    }
    if (action === "deleteExpense") { db.prepare("delete from expenses where id=?").run(String(body.id)); return NextResponse.json({ ok: true }); }
    if (action === "saveCategory") {
      const name = categoryNameSchema.parse(body.name); const id = typeof body.id === "string" ? body.id : randomUUID();
      if (body.id) db.prepare("update categories set name=?, updated_at=? where id=?").run(name, now, id);
      else {
        const next = db.prepare("select coalesce(max(sort_order), -1) + 1 as value from categories").get() as { value: number };
        db.prepare("insert into categories (id,user_id,name,is_active,sort_order,created_at,updated_at) values (?, ?, ?, 1, ?, ?, ?)").run(id, LOCAL_USER_ID, name, next.value, now, now);
      }
      return NextResponse.json({ id });
    }
    if (action === "reorderCategories") {
      const ids = orderedIdsSchema.parse(body.ids); const update = db.prepare("update categories set sort_order=?, updated_at=? where id=?");
      db.exec("begin"); try { ids.forEach((id, index) => update.run(index, now, id)); db.exec("commit"); } catch (error) { db.exec("rollback"); throw error; }
      return NextResponse.json({ ok: true });
    }
    if (action === "toggleCategory") { db.prepare("update categories set is_active=?, updated_at=? where id=?").run(body.isActive ? 1 : 0, now, String(body.id)); return NextResponse.json({ ok: true }); }
    if (action === "deleteCategory") { db.prepare("delete from categories where id=?").run(String(body.id)); return NextResponse.json({ ok: true }); }
    if (action === "saveTag") {
      const name = tagNameSchema.parse(body.name); const id = randomUUID();
      const next = db.prepare("select coalesce(max(sort_order), -1) + 1 as value from tags").get() as { value: number };
      db.prepare("insert into tags (id,user_id,name,sort_order,created_at,updated_at) values (?,?,?,?,?,?)").run(id, LOCAL_USER_ID, name, next.value, now, now);
      return NextResponse.json({ id });
    }
    if (action === "reorderTags") {
      const ids = orderedIdsSchema.parse(body.ids); const update = db.prepare("update tags set sort_order=?, updated_at=? where id=?");
      db.exec("begin"); try { ids.forEach((id, index) => update.run(index, now, id)); db.exec("commit"); } catch (error) { db.exec("rollback"); throw error; }
      return NextResponse.json({ ok: true });
    }
    if (action === "deleteTag") { db.prepare("delete from tags where id=?").run(String(body.id)); return NextResponse.json({ ok: true }); }
    if (action === "toggleCurrency") {
      const code = String(body.code); const active = code === "TWD" ? true : Boolean(body.isActive);
      const existing = db.prepare("select default_exchange_rate_to_twd from enabled_currencies where code=?").get(code) as { default_exchange_rate_to_twd?: string } | undefined;
      const requestedRate = body.defaultExchangeRateToTwd === undefined ? Number(existing?.default_exchange_rate_to_twd ?? 1) : exchangeRateSchema.parse(body.defaultExchangeRateToTwd);
      const rate = code === "TWD" ? 1 : requestedRate;
      db.prepare("insert into enabled_currencies (user_id,code,is_active,default_exchange_rate_to_twd,created_at,updated_at) values (?,?,?,?,?,?) on conflict(code) do update set is_active=excluded.is_active, default_exchange_rate_to_twd=excluded.default_exchange_rate_to_twd, updated_at=excluded.updated_at").run(LOCAL_USER_ID, code, active ? 1 : 0, String(rate), now, now);
      return NextResponse.json({ ok: true });
    }
    if (action === "saveFavorite") {
      const input = body.input as Record<string, unknown>; const id = typeof body.id === "string" ? body.id : randomUUID(); const rate = input.currency_code === "TWD" ? 1 : Number(input.default_exchange_rate_to_twd);
      const tagIds = tagIdsSchema.parse(input.tag_ids);
      if (!String(input.item_name ?? "").trim() || Number(input.default_amount) <= 0 || rate <= 0) throw new Error("常用項目資料不完整");
      const values = [String(input.item_name).trim(), String(input.default_amount), String(input.currency_code), String(input.category_id), String(input.note ?? "").trim(), String(rate), Number(input.sort_order ?? 0), now];
      db.exec("begin");
      try {
        if (body.id) db.prepare("update favorite_templates set item_name=?,default_amount=?,currency_code=?,category_id=?,note=?,default_exchange_rate_to_twd=?,sort_order=?,updated_at=? where id=?").run(...values, id);
        else db.prepare("insert into favorite_templates values (?,?,?,?,?,?,?,?,?,?,?)").run(id, LOCAL_USER_ID, ...values.slice(0, 7), now, now);
        db.prepare("delete from favorite_template_tags where favorite_template_id=?").run(id);
        const addTag = db.prepare("insert into favorite_template_tags (favorite_template_id,tag_id,user_id,created_at) values (?,?,?,?)");
        for (const tagId of tagIds) addTag.run(id, tagId, LOCAL_USER_ID, now);
        db.exec("commit");
      } catch (error) { db.exec("rollback"); throw error; }
      return NextResponse.json({ id });
    }
    if (action === "deleteFavorite") { db.prepare("delete from favorite_templates where id=?").run(String(body.id)); return NextResponse.json({ ok: true }); }
    if (action === "insertImportedExpense") {
      const input = normalizeExpenseInput(body.input); const id = String(body.id); const createdAt = String(body.createdAt); const updatedAt = String(body.updatedAt);
      db.exec("begin");
      try {
        db.prepare("insert into expenses values (?,?,?,?,?,?,?,?,?,?,?)").run(id, LOCAL_USER_ID, input.item_name, input.expense_date, String(input.amount), input.currency_code, input.category_id, input.note, String(input.exchange_rate_to_twd), createdAt, updatedAt);
        const addTag = db.prepare("insert into expense_tags (expense_id,tag_id,user_id,created_at) values (?,?,?,?)");
        for (const tagId of input.tag_ids) addTag.run(id, tagId, LOCAL_USER_ID, createdAt);
        db.exec("commit");
      } catch (error) { db.exec("rollback"); throw error; }
      return NextResponse.json({ id });
    }
    return fail("未知的資料操作");
  } catch (error) { return fail(error); }
}
