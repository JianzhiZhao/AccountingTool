import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const globalSqlite = globalThis as typeof globalThis & { accountingSqlite?: DatabaseSync };

export const LOCAL_USER_ID = "local-dev-user";

export function getSqliteDatabase() {
  if (process.env.NODE_ENV !== "development") throw new Error("SQLite 僅能在開發模式使用");
  if (globalSqlite.accountingSqlite) return globalSqlite.accountingSqlite;

  const dataDirectory = path.join(process.cwd(), ".data");
  mkdirSync(dataDirectory, { recursive: true });
  const database = new DatabaseSync(path.join(dataDirectory, "accounting.db"));
  database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  database.exec(`
    create table if not exists enabled_currencies (
      user_id text not null default '${LOCAL_USER_ID}',
      code text primary key,
      is_active integer not null default 1,
      created_at text not null,
      updated_at text not null,
      check (code glob '[A-Z][A-Z][A-Z]'),
      check (code <> 'TWD' or is_active = 1)
    );
    create table if not exists categories (
      id text primary key,
      user_id text not null default '${LOCAL_USER_ID}',
      name text not null collate nocase unique,
      is_active integer not null default 1,
      created_at text not null,
      updated_at text not null
    );
    create table if not exists expenses (
      id text primary key,
      user_id text not null default '${LOCAL_USER_ID}',
      item_name text not null,
      expense_date text not null,
      amount text not null,
      currency_code text not null references enabled_currencies(code) on delete restrict,
      category_id text not null references categories(id) on delete restrict,
      note text not null,
      exchange_rate_to_twd text not null,
      created_at text not null,
      updated_at text not null
    );
    create index if not exists expenses_date_idx on expenses(expense_date desc, created_at desc);
    create table if not exists favorite_templates (
      id text primary key,
      user_id text not null default '${LOCAL_USER_ID}',
      item_name text not null collate nocase unique,
      default_amount text not null,
      currency_code text not null references enabled_currencies(code) on delete restrict,
      category_id text not null references categories(id) on delete restrict,
      note text not null,
      default_exchange_rate_to_twd text not null,
      sort_order integer not null default 0,
      created_at text not null,
      updated_at text not null
    );
  `);
  const favoriteColumns = database.prepare("pragma table_info(favorite_templates)").all() as { name: string }[];
  if (favoriteColumns.some((column) => column.name === "name")) {
    database.exec(`
      drop table if exists favorite_templates_new;
      create table favorite_templates_new (
        id text primary key,
        user_id text not null default '${LOCAL_USER_ID}',
        item_name text not null collate nocase unique,
        default_amount text not null,
        currency_code text not null references enabled_currencies(code) on delete restrict,
        category_id text not null references categories(id) on delete restrict,
        note text not null,
        default_exchange_rate_to_twd text not null,
        sort_order integer not null default 0,
        created_at text not null,
        updated_at text not null
      );
      insert or ignore into favorite_templates_new
        (id,user_id,item_name,default_amount,currency_code,category_id,note,default_exchange_rate_to_twd,sort_order,created_at,updated_at)
      select id,user_id,item_name,default_amount,currency_code,category_id,note,default_exchange_rate_to_twd,sort_order,created_at,updated_at
      from favorite_templates order by created_at;
      drop table favorite_templates;
      alter table favorite_templates_new rename to favorite_templates;
    `);
  }
  const now = new Date().toISOString();
  database.prepare("insert or ignore into enabled_currencies (user_id, code, is_active, created_at, updated_at) values (?, 'TWD', 1, ?, ?)").run(LOCAL_USER_ID, now, now);
  globalSqlite.accountingSqlite = database;
  return database;
}
