import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const globalSqlite = globalThis as typeof globalThis & {
  accountingSqlite?: DatabaseSync;
  accountingSqliteSchemaVersion?: number;
};

export const LOCAL_USER_ID = "local-dev-user";
const LOCAL_SCHEMA_VERSION = 7;

export function getSqliteDatabase() {
  if (process.env.NODE_ENV !== "development") throw new Error("SQLite 僅能在開發模式使用");
  if (globalSqlite.accountingSqlite && globalSqlite.accountingSqliteSchemaVersion === LOCAL_SCHEMA_VERSION) return globalSqlite.accountingSqlite;

  const dataDirectory = path.join(process.cwd(), ".data");
  mkdirSync(dataDirectory, { recursive: true });
  const database = globalSqlite.accountingSqlite ?? new DatabaseSync(path.join(dataDirectory, "accounting.db"));
  database.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  database.exec(`
    create table if not exists enabled_currencies (
      user_id text not null default '${LOCAL_USER_ID}',
      code text primary key,
      is_active integer not null default 1,
      default_exchange_rate_to_twd text not null default '1',
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
      sort_order integer not null default 0,
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
    create table if not exists tags (
      id text primary key,
      user_id text not null default '${LOCAL_USER_ID}',
      name text not null collate nocase unique,
      is_active integer not null default 1,
      sort_order integer not null default 0,
      created_at text not null,
      updated_at text not null
    );
    create table if not exists expense_tags (
      expense_id text not null references expenses(id) on delete cascade,
      tag_id text not null references tags(id) on delete cascade,
      user_id text not null default '${LOCAL_USER_ID}',
      created_at text not null,
      primary key (expense_id, tag_id)
    );
    create index if not exists expense_tags_tag_idx on expense_tags(tag_id, expense_id);
    create table if not exists favorite_templates (
      id text primary key,
      user_id text not null default '${LOCAL_USER_ID}',
      item_name text not null collate nocase unique,
      is_active integer not null default 1,
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
  const currencyColumns = database.prepare("pragma table_info(enabled_currencies)").all() as { name: string }[];
  if (!currencyColumns.some((column) => column.name === "default_exchange_rate_to_twd")) {
    database.exec("alter table enabled_currencies add column default_exchange_rate_to_twd text not null default '1'");
  }
  const categoryColumns = database.prepare("pragma table_info(categories)").all() as { name: string }[];
  if (!categoryColumns.some((column) => column.name === "sort_order")) {
    database.exec(`
      alter table categories add column sort_order integer not null default 0;
      update categories set sort_order = (
        select count(*) from categories ranked
        where ranked.is_active > categories.is_active
          or (ranked.is_active = categories.is_active and lower(ranked.name) < lower(categories.name))
      );
    `);
  }
  const tagColumns = database.prepare("pragma table_info(tags)").all() as { name: string }[];
  if (!tagColumns.some((column) => column.name === "is_active")) {
    database.exec("alter table tags add column is_active integer not null default 1");
  }
  if (!tagColumns.some((column) => column.name === "sort_order")) {
    database.exec(`
      alter table tags add column sort_order integer not null default 0;
      update tags set sort_order = (
        select count(*) from tags ranked where lower(ranked.name) < lower(tags.name)
      );
    `);
  }
  database.exec(`
    create index if not exists categories_sort_idx on categories(sort_order, name);
    drop index if exists tags_sort_idx;
    create index tags_sort_idx on tags(is_active desc, sort_order, name);
  `);
  const favoriteColumns = database.prepare("pragma table_info(favorite_templates)").all() as { name: string }[];
  if (favoriteColumns.some((column) => column.name === "name")) {
    database.exec(`
      drop table if exists favorite_templates_new;
      create table favorite_templates_new (
        id text primary key,
        user_id text not null default '${LOCAL_USER_ID}',
        item_name text not null collate nocase unique,
        is_active integer not null default 1,
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
        (id,user_id,item_name,is_active,default_amount,currency_code,category_id,note,default_exchange_rate_to_twd,sort_order,created_at,updated_at)
      select id,user_id,item_name,1,default_amount,currency_code,category_id,note,default_exchange_rate_to_twd,sort_order,created_at,updated_at
      from favorite_templates order by created_at;
      drop table favorite_templates;
      alter table favorite_templates_new rename to favorite_templates;
    `);
  }
  const currentFavoriteColumns = database.prepare("pragma table_info(favorite_templates)").all() as { name: string }[];
  if (!currentFavoriteColumns.some((column) => column.name === "is_active")) {
    database.exec("alter table favorite_templates add column is_active integer not null default 1");
  }
  database.exec(`
    create table if not exists favorite_template_tags (
      favorite_template_id text not null references favorite_templates(id) on delete cascade,
      tag_id text not null references tags(id) on delete cascade,
      user_id text not null default '${LOCAL_USER_ID}',
      created_at text not null,
      primary key (favorite_template_id, tag_id)
    );
    create index if not exists favorite_template_tags_tag_idx on favorite_template_tags(tag_id, favorite_template_id);
  `);
  const now = new Date().toISOString();
  database.prepare("insert or ignore into enabled_currencies (user_id, code, is_active, default_exchange_rate_to_twd, created_at, updated_at) values (?, 'TWD', 1, '1', ?, ?)").run(LOCAL_USER_ID, now, now);
  database.prepare("update enabled_currencies set is_active=1, default_exchange_rate_to_twd='1' where code='TWD'").run();
  globalSqlite.accountingSqlite = database;
  globalSqlite.accountingSqliteSchemaVersion = LOCAL_SCHEMA_VERSION;
  return database;
}
