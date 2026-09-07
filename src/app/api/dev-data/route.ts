import { randomUUID } from "node:crypto";
import type { StatementSync } from "node:sqlite";
import { NextRequest, NextResponse } from "next/server";
import { isSqliteDevelopment } from "@/lib/backend";
import { getSqliteDatabase, LOCAL_USER_ID } from "@/lib/sqlite/database";
import { normalizeExpenseInput, categoryNameSchema, exchangeRateSchema, orderedIdsSchema, tagIdsSchema, tagNameSchema } from "@/lib/validation";
import { generateAmortizationSchedule } from "@/lib/amortization";
import type { ImportedExpenseRecord } from "@/types/domain";

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
      const rows = db.prepare(`select * from tags ${includeInactive ? "" : "where is_active = 1"} order by sort_order, name collate nocase`).all();
      return NextResponse.json(rows.map((row) => booleanRow(row as Record<string, unknown>)));
    }
    if (resource === "favorites") {
      const rows = db.prepare(`select f.*, c.name as category_name, c.is_active as category_active from favorite_templates f join categories c on c.id = f.category_id ${includeInactive ? "" : "where f.is_active = 1"} order by f.sort_order, f.created_at`).all();
      const tagQuery = db.prepare("select t.id, t.name from tags t join favorite_template_tags ft on ft.tag_id=t.id where ft.favorite_template_id=? order by t.name collate nocase");
      return NextResponse.json(rows.map((raw) => { const row = booleanRow(raw as Record<string, unknown>); return { ...row, default_amount: Number(row.default_amount), default_exchange_rate_to_twd: Number(row.default_exchange_rate_to_twd), tags: tagQuery.all(String(row.id)), categories: { id: row.category_id, name: row.category_name, is_active: Boolean(row.category_active) }, category_name: undefined, category_active: undefined }; }));
    }
    if (resource === "expenses") {
      const where: string[] = []; const values: string[] = [];
      const add = (clause: string, value: string | null) => { if (value) { where.push(clause); values.push(value); } };
      add("e.expense_date >= ?", request.nextUrl.searchParams.get("from")); add("e.expense_date <= ?", request.nextUrl.searchParams.get("to"));
      add("e.category_id = ?", request.nextUrl.searchParams.get("categoryId")); add("e.currency_code = ?", request.nextUrl.searchParams.get("currencyCode"));
      add("exists (select 1 from expense_tags et where et.expense_id = e.id and et.tag_id = ?)", request.nextUrl.searchParams.get("tagId"));
      const expenseTypes = request.nextUrl.searchParams.get("expenseTypes")?.split(",").filter((type) => ["general", "prepaid", "amortized"].includes(type));
      if (expenseTypes?.length) { where.push(`e.expense_type in (${expenseTypes.map(() => "?").join(",")})`); values.push(...expenseTypes); }
      if (request.nextUrl.searchParams.get("includeFutureAmortized") === "false") { where.push("(e.expense_type <> 'amortized' or e.expense_date <= ?)"); values.push(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date())); }
      const query = request.nextUrl.searchParams.get("query")?.trim(); if (query) { where.push("(e.item_name like ? escape '\\' or e.note like ? escape '\\')"); const safe = `%${query.replace(/[\\%_]/g, "\\$&")}%`; values.push(safe, safe); }
      const rows = db.prepare(`select e.*, c.name as category_name, c.is_active as category_active from expenses e join categories c on c.id = e.category_id ${where.length ? `where ${where.join(" and ")}` : ""} order by e.expense_date desc, e.created_at desc`).all(...values);
      const tagQuery = db.prepare("select t.id, t.name from tags t join expense_tags et on et.tag_id=t.id where et.expense_id=? order by t.name collate nocase");
      return NextResponse.json(rows.map((raw) => expenseJson(raw as Record<string, unknown>, tagQuery)));
    }
    if (resource === "expenseFamily") {
      const id = String(request.nextUrl.searchParams.get("id") ?? "");
      const selected = db.prepare("select id,parent_expense_id from expenses where id=?").get(id) as { id: string; parent_expense_id: string | null } | undefined;
      if (!selected) return NextResponse.json([]);
      const rootId = selected.parent_expense_id ?? selected.id;
      const rows = db.prepare("select e.*, c.name as category_name, c.is_active as category_active from expenses e join categories c on c.id=e.category_id where e.id=? or e.parent_expense_id=? order by case when e.expense_type='prepaid' then 0 else 1 end, e.amortization_sequence").all(rootId, rootId);
      const tagQuery = db.prepare("select t.id, t.name from tags t join expense_tags et on et.tag_id=t.id where et.expense_id=? order by t.name collate nocase");
      return NextResponse.json(rows.map((raw) => expenseJson(raw as Record<string, unknown>, tagQuery)));
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
        const addTag = db.prepare("insert into expense_tags (expense_id,tag_id,user_id,created_at) values (?,?,?,?)");
        if (body.id) {
          const existing = db.prepare("select expense_type from expenses where id=?").get(id) as { expense_type: string } | undefined;
          if (!existing) throw new Error("找不到帳目");
          if (existing.expense_type !== "general" || input.expense_type !== "general") throw new Error("預付與攤提帳目不可修改");
          db.prepare("update expenses set item_name=?, expense_date=?, amount=?, currency_code=?, category_id=?, note=?, exchange_rate_to_twd=?, updated_at=? where id=?").run(input.item_name, input.expense_date, String(input.amount), input.currency_code, input.category_id, input.note, String(input.exchange_rate_to_twd), now, id);
          db.prepare("delete from expense_tags where expense_id=?").run(id);
          for (const tagId of input.tag_ids) addTag.run(id, tagId, LOCAL_USER_ID, now);
        } else if (input.expense_type === "prepaid") {
          const schedule = generateAmortizationSchedule({ amount: input.amount, startDate: input.amortization_start_date!, unit: input.amortization_unit!, periods: input.amortization_periods! });
          db.prepare(`insert into expenses (id,user_id,item_name,expense_date,amount,currency_code,category_id,note,exchange_rate_to_twd,expense_type,parent_expense_id,amortization_unit,amortization_periods,amortization_start_date,amortization_sequence,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,'prepaid',null,?,?,?,null,?,?)`).run(id, LOCAL_USER_ID, input.item_name, input.expense_date, String(input.amount), input.currency_code, input.category_id, input.note, String(input.exchange_rate_to_twd), input.amortization_unit, input.amortization_periods, input.amortization_start_date, now, now);
          for (const tagId of input.tag_ids) addTag.run(id, tagId, LOCAL_USER_ID, now);
          for (const installment of schedule) {
            const childId = randomUUID();
            db.prepare(`insert into expenses (id,user_id,item_name,expense_date,amount,currency_code,category_id,note,exchange_rate_to_twd,expense_type,parent_expense_id,amortization_unit,amortization_periods,amortization_start_date,amortization_sequence,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,'amortized',?,null,null,null,?,?,?)`).run(childId, LOCAL_USER_ID, input.item_name, installment.expense_date, installment.amount_text, input.currency_code, input.category_id, input.note, String(input.exchange_rate_to_twd), id, installment.sequence, now, now);
            for (const tagId of input.tag_ids) addTag.run(childId, tagId, LOCAL_USER_ID, now);
          }
        } else {
          db.prepare(`insert into expenses (id,user_id,item_name,expense_date,amount,currency_code,category_id,note,exchange_rate_to_twd,expense_type,parent_expense_id,amortization_unit,amortization_periods,amortization_start_date,amortization_sequence,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,'general',null,null,null,null,null,?,?)`).run(id, LOCAL_USER_ID, input.item_name, input.expense_date, String(input.amount), input.currency_code, input.category_id, input.note, String(input.exchange_rate_to_twd), now, now);
          for (const tagId of input.tag_ids) addTag.run(id, tagId, LOCAL_USER_ID, now);
        }
        db.exec("commit");
      } catch (error) { db.exec("rollback"); throw error; }
      return NextResponse.json({ id });
    }
    if (action === "deleteExpense") { const id = String(body.id); const row = db.prepare("select expense_type from expenses where id=?").get(id) as { expense_type: string } | undefined; if (row?.expense_type === "amortized") throw new Error("攤提帳目不可單獨刪除"); db.prepare("delete from expenses where id=?").run(id); return NextResponse.json({ ok: true }); }
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
      db.prepare("insert into tags (id,user_id,name,is_active,sort_order,created_at,updated_at) values (?,?,?,1,?,?,?)").run(id, LOCAL_USER_ID, name, next.value, now, now);
      return NextResponse.json({ id });
    }
    if (action === "reorderTags") {
      const ids = orderedIdsSchema.parse(body.ids); const update = db.prepare("update tags set sort_order=?, updated_at=? where id=?");
      db.exec("begin"); try { ids.forEach((id, index) => update.run(index, now, id)); db.exec("commit"); } catch (error) { db.exec("rollback"); throw error; }
      return NextResponse.json({ ok: true });
    }
    if (action === "toggleTag") { db.prepare("update tags set is_active=?, updated_at=? where id=?").run(body.isActive ? 1 : 0, now, String(body.id)); return NextResponse.json({ ok: true }); }
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
        else db.prepare("insert into favorite_templates (id,user_id,item_name,default_amount,currency_code,category_id,note,default_exchange_rate_to_twd,sort_order,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?,?)").run(id, LOCAL_USER_ID, ...values.slice(0, 7), now, now);
        db.prepare("delete from favorite_template_tags where favorite_template_id=?").run(id);
        const addTag = db.prepare("insert into favorite_template_tags (favorite_template_id,tag_id,user_id,created_at) values (?,?,?,?)");
        for (const tagId of tagIds) addTag.run(id, tagId, LOCAL_USER_ID, now);
        db.exec("commit");
      } catch (error) { db.exec("rollback"); throw error; }
      return NextResponse.json({ id });
    }
    if (action === "toggleFavorite") { db.prepare("update favorite_templates set is_active=?, updated_at=? where id=?").run(body.isActive ? 1 : 0, now, String(body.id)); return NextResponse.json({ ok: true }); }
    if (action === "deleteFavorite") { db.prepare("delete from favorite_templates where id=?").run(String(body.id)); return NextResponse.json({ ok: true }); }
    if (action === "insertImportedExpense") {
      const input = normalizeExpenseInput(body.input); const id = String(body.id); const createdAt = String(body.createdAt); const updatedAt = String(body.updatedAt);
      if (input.expense_type !== "general") throw new Error("關聯帳目必須使用群組匯入");
      db.exec("begin");
      try {
        db.prepare(`insert into expenses (id,user_id,item_name,expense_date,amount,currency_code,category_id,note,exchange_rate_to_twd,expense_type,parent_expense_id,amortization_unit,amortization_periods,amortization_start_date,amortization_sequence,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,'general',null,null,null,null,null,?,?)`).run(id, LOCAL_USER_ID, input.item_name, input.expense_date, String(input.amount), input.currency_code, input.category_id, input.note, String(input.exchange_rate_to_twd), createdAt, updatedAt);
        const addTag = db.prepare("insert into expense_tags (expense_id,tag_id,user_id,created_at) values (?,?,?,?)");
        for (const tagId of input.tag_ids) addTag.run(id, tagId, LOCAL_USER_ID, createdAt);
        db.exec("commit");
      } catch (error) { db.exec("rollback"); throw error; }
      return NextResponse.json({ id });
    }
    if (action === "insertImportedExpenseGroup") {
      const rows = body.rows as ImportedExpenseRecord[];
      if (!Array.isArray(rows) || rows.length < 2) throw new Error("預付匯入群組不完整");
      const parents = rows.filter((row) => row.expense_type === "prepaid");
      if (parents.length !== 1) throw new Error("預付匯入群組必須只有一筆父帳");
      const parent = parents[0];
      const normalizedParent = normalizeExpenseInput({ ...parent, tag_ids: parent.tag_ids });
      const schedule = generateAmortizationSchedule({ amount: normalizedParent.amount, startDate: normalizedParent.amortization_start_date!, unit: normalizedParent.amortization_unit!, periods: normalizedParent.amortization_periods! });
      const children = rows.filter((row) => row.expense_type === "amortized").sort((a, b) => Number(a.amortization_sequence) - Number(b.amortization_sequence));
      if (children.length !== schedule.length) throw new Error("攤提子帳數量與期數不一致");
      if (rows.some((row) => db.prepare("select 1 from expenses where id=?").get(row.id))) throw new Error("匯入帳目 ID 已存在");
      const parentTags = [...new Set(parent.tag_ids)].sort().join(",");
      children.forEach((child, index) => {
        const expected = schedule[index];
        if (child.parent_expense_id !== parent.id || child.amortization_sequence !== expected.sequence || child.expense_date !== expected.expense_date || String(child.amount) !== expected.amount_text) throw new Error("攤提子帳與父帳排程不一致");
        if (child.item_name !== parent.item_name || child.currency_code !== parent.currency_code || child.category_id !== parent.category_id || child.note !== parent.note || child.exchange_rate_to_twd !== parent.exchange_rate_to_twd) throw new Error("攤提子帳未完整繼承父帳資料");
        if ([...new Set(child.tag_ids)].sort().join(",") !== parentTags) throw new Error("攤提子帳 Tag 與父帳不一致");
      });
      db.exec("begin");
      try {
        const insert = db.prepare(`insert into expenses (id,user_id,item_name,expense_date,amount,currency_code,category_id,note,exchange_rate_to_twd,expense_type,parent_expense_id,amortization_unit,amortization_periods,amortization_start_date,amortization_sequence,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
        const addTag = db.prepare("insert into expense_tags (expense_id,tag_id,user_id,created_at) values (?,?,?,?)");
        insert.run(parent.id, LOCAL_USER_ID, normalizedParent.item_name, normalizedParent.expense_date, String(normalizedParent.amount), normalizedParent.currency_code, normalizedParent.category_id, normalizedParent.note, String(normalizedParent.exchange_rate_to_twd), "prepaid", null, normalizedParent.amortization_unit, normalizedParent.amortization_periods, normalizedParent.amortization_start_date, null, parent.created_at, parent.updated_at);
        for (const tagId of normalizedParent.tag_ids) addTag.run(parent.id, tagId, LOCAL_USER_ID, parent.created_at);
        for (const child of children) {
          insert.run(child.id, LOCAL_USER_ID, child.item_name, child.expense_date, String(child.amount), child.currency_code, child.category_id, child.note, String(child.exchange_rate_to_twd), "amortized", parent.id, null, null, null, child.amortization_sequence, child.created_at, child.updated_at);
          for (const tagId of child.tag_ids) addTag.run(child.id, tagId, LOCAL_USER_ID, child.created_at);
        }
        db.exec("commit");
      } catch (error) { db.exec("rollback"); throw error; }
      return NextResponse.json({ id: parent.id });
    }
    return fail("未知的資料操作");
  } catch (error) { return fail(error); }
}

function expenseJson(raw: Record<string, unknown>, tagQuery: StatementSync) {
  const amount = Number(raw.amount); const rate = Number(raw.exchange_rate_to_twd);
  return { ...raw, amount, exchange_rate_to_twd: rate, amount_twd: amount * rate, amortization_periods: raw.amortization_periods == null ? null : Number(raw.amortization_periods), amortization_sequence: raw.amortization_sequence == null ? null : Number(raw.amortization_sequence), tags: tagQuery.all(String(raw.id)), categories: { id: raw.category_id, name: raw.category_name, is_active: Boolean(raw.category_active) }, category_name: undefined, category_active: undefined };
}
