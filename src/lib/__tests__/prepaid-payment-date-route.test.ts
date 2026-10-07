import { DatabaseSync } from "node:sqlite";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "@/app/api/dev-data/route";

const state = vi.hoisted(() => ({ db: null as DatabaseSync | null }));
vi.mock("@/lib/backend", () => ({ isSqliteDevelopment: () => true }));
vi.mock("@/lib/sqlite/database", () => ({ getSqliteDatabase: () => state.db!, LOCAL_USER_ID: "local" }));

beforeEach(() => {
  state.db = new DatabaseSync(":memory:");
  state.db.exec(`
    create table expenses (id text primary key, expense_type text, expense_date text,
      amortization_start_date text, parent_expense_id text, amortization_sequence integer,
      amount integer, updated_at text);
    insert into expenses values ('parent','prepaid','2026-08-01','2026-08-10',null,null,1200,'original');
    insert into expenses values ('child','amortized','2026-08-10',null,'parent',1,100,'original');
    insert into expenses values ('general','general','2026-08-01',null,null,null,100,'original');
  `);
});
afterEach(() => { state.db?.close(); });

function update(date: string, id = "parent") {
  return POST(new NextRequest("http://localhost/api/dev-data", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "updatePrepaidPaymentDate", id, expense_date: date }),
  }));
}

it.each(["2026-07-31", "2026-08-10"])("updates only the parent's payment date for %s", async (date) => {
  const child = state.db!.prepare("select * from expenses where id='child'").get();
  const parent = state.db!.prepare("select * from expenses where id='parent'").get();
  expect((await update(date)).status).toBe(200);
  expect(state.db!.prepare("select * from expenses where id='parent'").get()).toEqual({ ...parent, expense_date: date, updated_at: expect.any(String) });
  expect(state.db!.prepare("select * from expenses where id='child'").get()).toEqual(child);
});

it.each(["2026-08-11", "2026-02-30", "", "invalid"])("rejects invalid date %s without changing data", async (date) => {
  const before = state.db!.prepare("select * from expenses").all();
  expect((await update(date)).status).toBe(400);
  expect(state.db!.prepare("select * from expenses").all()).toEqual(before);
});

it.each(["child", "general", "missing"])("rejects a non-prepaid target %s", async (id) => {
  expect((await update("2026-08-01", id)).status).toBe(400);
});

it("rejects missing first installment", async () => {
  state.db!.exec("delete from expenses where id='child'");
  expect((await update("2026-08-01")).status).toBe(400);
});
