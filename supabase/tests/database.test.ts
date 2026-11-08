// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildPayload, stateFromRows } from "@/data/supabase/mapping";
import { adjustStock, createDoc, recordPayment, type State } from "@/domain/engine";
import { ROLES, can, type Action, type Module } from "@/domain/permissions";
import { partyBalances, trialBalance } from "@/domain/reports";
import type { DocInput, Role } from "@/domain/types";

// Minimal stand-ins for the Supabase-managed schemas and roles.
const PRELUDE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz default now(), raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:greatest(array_length(string_to_array(name, '/'), 1) - 1, 0)]
  $$;
  grant usage on schema auth, storage, public to anon, authenticated;
  grant all on all tables in schema storage to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
`;

let db: PGlite;

const U = {
  owner: "00000000-0000-4000-8000-000000000001",
  other: "00000000-0000-4000-8000-000000000002",
  manager: "00000000-0000-4000-8000-000000000011",
  accountant: "00000000-0000-4000-8000-000000000012",
  sales: "00000000-0000-4000-8000-000000000013",
  storekeeper: "00000000-0000-4000-8000-000000000014",
};

async function asUser(id: string | null) {
  await db.exec("reset role");
  if (id) {
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
    await db.exec("set role authenticated");
  } else {
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
    await db.exec("set role anon");
  }
}
const rows = async (sql: string, params: unknown[] = []) => (await db.query<Record<string, unknown>>(sql, params)).rows;
const one = async <T = unknown>(sql: string, params: unknown[] = []) => Object.values((await rows(sql, params))[0] ?? {})[0] as T;
const fails = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (e) {
    return e as { message: string; code?: string };
  }
  throw new Error("expected the statement to fail");
};

async function loadState(biz: string, productIds?: string[]): Promise<State> {
  const j = async (table: string, where = "business_id = $1", order = "") =>
    (await rows(`select coalesce(jsonb_agg(to_jsonb(t) ${order}), '[]'::jsonb) as r from public.${table} t where ${where}`, [biz]))[0].r as Record<string, unknown>[];
  void productIds;
  return stateFromRows({
    business: (await rows("select to_jsonb(b) as r from public.businesses b where id = $1", [biz]))[0].r as Record<string, unknown>,
    sequences: await j("doc_sequences") as never,
    products: await j("products"),
    variants: await j("product_variants"),
    warehouses: await j("warehouses"),
    parties: await j("parties"),
    accounts: await j("accounts"),
    movements: await j("stock_movements", "business_id = $1", "order by t.seq"),
    salesDocs: await j("sales_documents"),
    salesItems: await j("sales_items"),
    purchaseDocs: await j("purchase_documents"),
    purchaseItems: await j("purchase_items"),
    journal: await j("journal_entries", "business_id = $1", "order by t.seq"),
    lines: await j("journal_lines"),
    payments: await j("payments"),
    allocations: await j("payment_allocations"),
    audit: await j("audit_log"),
  });
}

const commit = async (biz: string, payload: unknown) => rows("select public.commit_changes($1::uuid, $2::jsonb)", [biz, JSON.stringify(payload)]);

async function run(biz: string, module: "sales" | "purchases" | "inventory" | "accounting", fn: (s: State) => void) {
  const before = await loadState(biz);
  const after = structuredClone(before);
  fn(after);
  await commit(biz, buildPayload(before, after, { module, action: "create" }));
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(PRELUDE);
  const dir = path.resolve(import.meta.dirname, "../migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) await db.exec(readFileSync(path.join(dir, f), "utf8"));
  for (const [name, id] of Object.entries(U)) await db.query("insert into auth.users (id, email) values ($1, $2)", [id, `${name}@example.com`]);
}, 120_000);

afterAll(async () => {
  await db.close();
});

describe("migrations", () => {
  it("apply cleanly and every public table has row level security on", async () => {
    const t = await rows(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(t).toEqual([]);
  });
  it("anonymous users cannot read anything", async () => {
    await asUser(null);
    const e = await fails(() => rows("select * from public.products"));
    expect(e.message).toMatch(/permission denied/i);
    await asUser(null);
  });
});

let bizA = "";
let bizB = "";

describe("business setup", () => {
  it("create_business seeds the chart of accounts, a warehouse and an owner", async () => {
    await asUser(U.owner);
    bizA = await one<string>("select public.create_business('Acme Traders', '', '27')");
    await asUser(U.other);
    bizB = await one<string>("select public.create_business('Other Co', '', '29')");
    await asUser(U.owner);
    expect(Number(await one("select count(*) from public.accounts where business_id = $1", [bizA]))).toBe(31);
    expect(await one("select role from public.memberships where business_id = $1", [bizA])).toBe("owner");
    expect(await one("select name from public.warehouses where business_id = $1", [bizA])).toBe("Main godown");
  });
  it("requires a signed in user", async () => {
    await asUser(null);
    const e = await fails(() => rows("select public.create_business('x', '', '27')"));
    expect(e.message).toMatch(/permission denied|Sign in/i);
  });
});

describe("permissions", () => {
  it("SQL has_permission matches the TypeScript matrix for every role, module and action", async () => {
    await asUser(null);
    await db.exec("reset role");
    for (const role of ROLES.filter((r) => r !== "owner")) {
      await db.query("insert into public.memberships (user_id, business_id, role, email) values ($1, $2, $3, $4)", [U[role as keyof typeof U], bizA, role, `${role}@example.com`]);
    }
    const modules: Module[] = ["dashboard", "inventory", "sales", "purchases", "accounting", "reports", "settings", "users"];
    const actions: Action[] = ["view", "create", "edit", "delete"];
    const mismatches: string[] = [];
    for (const role of ROLES) {
      await asUser(U[role as keyof typeof U]);
      for (const m of modules) {
        for (const a of actions) {
          const sql = await one<boolean>("select public.has_permission($1, $2, $3)", [bizA, m, a]);
          if (sql !== can(role as Role, m, a)) mismatches.push(`${role} ${m} ${a}: sql=${sql} ts=${can(role as Role, m, a)}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe("tenant isolation", () => {
  it("a member cannot read, change or write into another business", async () => {
    await asUser(U.owner);
    await rows("insert into public.products (business_id, name, sku) values ($1, 'A widget', 'A1')", [bizA]);
    await asUser(U.other);
    expect(Number(await one("select count(*) from public.products"))).toBe(0);
    expect(Number(await one("select count(*) from public.accounts where business_id = $1", [bizA]))).toBe(0);
    const upd = await db.query("update public.products set name = 'hacked' where business_id = $1", [bizA]);
    expect(upd.affectedRows).toBe(0);
    const ins = await fails(() => rows("insert into public.products (business_id, name) values ($1, 'planted')", [bizA]));
    expect(ins.message).toMatch(/row-level security/i);
    const rpc = await fails(() => commit(bizA, { module: "sales", action: "create" }));
    expect(rpc.message).toMatch(/do not have access/i);
  });
  it("a record from one business cannot be referenced from another (composite foreign keys)", async () => {
    await asUser(U.owner);
    const productA = await one<string>("select id from public.products where business_id = $1", [bizA]);
    await asUser(U.other);
    const whB = await one<string>("select id from public.warehouses where business_id = $1", [bizB]);
    const e = await fails(() => commit(bizB, { module: "inventory", action: "create", movements: [{ id: crypto.randomUUID(), date: "2026-11-01", product_id: productA, warehouse_id: whB, qty: 5, rate: 1, type: "opening" }] }));
    expect(e.message).toMatch(/foreign key|violates/i);
  });
  it("ledger tables reject direct writes even from an owner", async () => {
    await asUser(U.owner);
    const e = await fails(() => rows("insert into public.journal_entries (id, business_id, date, voucher_type, number) values (gen_random_uuid(), $1, '2026-11-01', 'journal', 'X1')", [bizA]));
    expect(e.message).toMatch(/permission denied/i);
    const e2 = await fails(() => rows("update public.audit_log set detail = 'edited' where business_id = $1", [bizA]));
    expect(e2.message).toMatch(/permission denied/i);
  });
});

describe("the accounting engine committing through commit_changes", () => {
  let productId = "";
  let supplierId = "";
  let customerId = "";
  let whId = "";
  const doc = (over: Partial<DocInput>): DocInput => ({
    kind: "sales", type: "invoice", date: "2026-11-01", partyGstin: "", placeOfSupply: "27", reverseCharge: false, tcsPct: 0, notes: "", terms: "", warehouseId: whId,
    partyName: "", items: [], ...over,
  });
  const item = (qty: number, rate: number) => ({ productId, name: "A widget", hsn: "", qty, unit: "PCS", rate, discountPct: 0, gstRate: 18, cessPct: 0 });

  it("a purchase bill adds stock and posts a balanced entry in one transaction", async () => {
    await asUser(U.owner);
    productId = await one<string>("select id from public.products where business_id = $1", [bizA]);
    whId = await one<string>("select id from public.warehouses where business_id = $1", [bizA]);
    supplierId = await one<string>("insert into public.parties (business_id, type, name, state_code) values ($1, 'supplier', 'Supp', '27') returning id", [bizA]);
    customerId = await one<string>("insert into public.parties (business_id, type, name, state_code) values ($1, 'customer', 'Cust', '27') returning id", [bizA]);
    await run(bizA, "purchases", (s) => {
      createDoc(s, doc({ kind: "purchase", type: "bill", partyId: supplierId, partyName: "Supp", supplierInvoiceNo: "S-1", items: [item(50, 100)] }), "test");
    });
    expect(Number(await one("select sum(qty) from public.stock_movements where business_id = $1", [bizA]))).toBe(50);
    expect(Number(await one("select sum(debit) - sum(credit) from public.journal_lines where business_id = $1", [bizA]))).toBe(0);
    expect(String(await one("select number from public.purchase_documents where business_id = $1", [bizA]))).toMatch(/^PB\/\d\d-\d\d\/0001$/);
    expect(Number(await one("select last from public.doc_sequences where business_id = $1 and series = 'p:bill'", [bizA]))).toBe(1);
    expect((await rows("select actor from public.audit_log where business_id = $1 and action = 'created' and entity = 'purchase:bill'", [bizA]))[0].actor).toBe("owner@example.com");
  });

  it("a sales invoice reduces stock and the books agree with the engine", async () => {
    await run(bizA, "sales", (s) => {
      createDoc(s, doc({ partyId: customerId, partyName: "Cust", items: [item(10, 200)] }), "test");
    });
    expect(Number(await one("select sum(qty) from public.stock_movements where business_id = $1", [bizA]))).toBe(40);
    const state = await loadState(bizA);
    expect(trialBalance(state.accounts, state.journal).balanced).toBe(true);
    expect(partyBalances(state.parties, state.journal).get(customerId)).toBe(2360);
    expect(state.docs.find((d) => d.type === "invoice")?.totals.grandTotal).toBe(2360);
  });

  it("a payment updates the invoice and the ledger", async () => {
    await run(bizA, "sales", (s) => {
      const inv = s.docs.find((d) => d.type === "invoice")!;
      recordPayment(s, { direction: "in", date: "2026-11-02", partyId: customerId, amount: 1000, mode: "upi", reference: "", accountId: "acc-bank", allocations: [{ docId: inv.id, amount: 1000 }], notes: "" }, "test");
    });
    const state = await loadState(bizA);
    expect(state.docs.find((d) => d.type === "invoice")?.paid).toBe(1000);
    expect(partyBalances(state.parties, state.journal).get(customerId)).toBe(1360);
    expect(trialBalance(state.accounts, state.journal).balanced).toBe(true);
  });

  it("an adjustment posts a stock loss", async () => {
    await run(bizA, "inventory", (s) => adjustStock(s, { date: "2026-11-03", productId, warehouseId: whId, qty: -2, reason: "damage", note: "" }, "test"));
    expect(Number(await one("select sum(qty) from public.stock_movements where business_id = $1", [bizA]))).toBe(38);
  });

  it("two clients racing for the same number: the second is rejected, nothing half-saved", async () => {
    const stale = await loadState(bizA);
    await run(bizA, "sales", (s) => createDoc(s, doc({ partyId: customerId, partyName: "Cust", items: [item(1, 200)] }), "t1"));
    const countBefore = Number(await one("select count(*) from public.stock_movements where business_id = $1", [bizA]));
    const after = structuredClone(stale);
    createDoc(after, doc({ partyId: customerId, partyName: "Cust", items: [item(1, 200)] }), "t2");
    const e = await fails(() => commit(bizA, buildPayload(stale, after, { module: "sales", action: "create" })));
    expect(e.message).toMatch(/duplicate key|unique/i);
    expect(Number(await one("select count(*) from public.stock_movements where business_id = $1", [bizA]))).toBe(countBefore);
  });
});

describe("database-level guards", () => {
  it("negative stock is rejected and the whole commit rolls back", async () => {
    const productId = await one<string>("select id from public.products where business_id = $1", [bizA]);
    const whId = await one<string>("select id from public.warehouses where business_id = $1", [bizA]);
    const before = Number(await one("select count(*) from public.stock_movements where business_id = $1", [bizA]));
    const e = await fails(() => commit(bizA, { module: "inventory", action: "create", movements: [{ id: crypto.randomUUID(), date: "2026-11-04", product_id: productId, warehouse_id: whId, qty: -9999, rate: 1, type: "adjustment" }] }));
    expect(e.message).toMatch(/Not enough stock/);
    expect(Number(await one("select count(*) from public.stock_movements where business_id = $1", [bizA]))).toBe(before);
  });
  it("an unbalanced journal entry is rejected at commit", async () => {
    const before = Number(await one("select count(*) from public.journal_entries where business_id = $1", [bizA]));
    const e = await fails(() => commit(bizA, { module: "accounting", action: "create", journal: [{ id: crypto.randomUUID(), date: "2026-11-04", voucher_type: "journal", number: "JV-BAD", narration: "bad", lines: [{ account_id: "acc-cash", debit: 100, credit: 0 }, { account_id: "acc-capital", debit: 0, credit: 99 }] }] }));
    expect(e.message).toMatch(/does not balance/);
    expect(Number(await one("select count(*) from public.journal_entries where business_id = $1", [bizA]))).toBe(before);
  });
  it("a role without the permission cannot commit, even with a valid payload", async () => {
    await asUser(U.storekeeper);
    const e = await fails(() => commit(bizA, { module: "accounting", action: "create", journal: [] }));
    expect(e.message).toMatch(/cannot do this/);
    await asUser(U.sales);
    const e2 = await fails(() => commit(bizA, { module: "purchases", action: "create" }));
    expect(e2.message).toMatch(/cannot do this/);
    await asUser(U.owner);
  });
  it("an unknown module or action is rejected", async () => {
    const e = await fails(() => commit(bizA, { module: "everything", action: "create" }));
    expect(e.message).toMatch(/cannot do this/);
  });
});

describe("team management", () => {
  it("only an owner can change roles, and the last owner cannot be demoted", async () => {
    await asUser(U.manager);
    const memberId = await one<string>("select id from public.memberships where business_id = $1 and role = 'sales'", [bizA]);
    const e = await fails(() => rows("select public.set_member_role($1, $2, 'owner')", [bizA, memberId]));
    expect(e.message).toMatch(/Only an owner/);
    await asUser(U.owner);
    const ownerRow = await one<string>("select id from public.memberships where business_id = $1 and role = 'owner'", [bizA]);
    const e2 = await fails(() => rows("select public.set_member_role($1, $2, 'sales')", [bizA, ownerRow]));
    expect(e2.message).toMatch(/at least one owner/);
    await rows("select public.set_member_role($1, $2, 'manager')", [bizA, memberId]);
    expect(await one("select role from public.memberships where id = $1", [memberId])).toBe("manager");
  });
  it("invites link to a user when they sign up with the same confirmed email", async () => {
    await asUser(U.owner);
    await rows("select public.invite_member($1, 'newbie@example.com', 'Newbie', 'sales')", [bizA]);
    await db.exec("reset role");
    const id = "00000000-0000-4000-8000-0000000000aa";
    await db.query("insert into auth.users (id, email) values ($1, 'newbie@example.com')", [id]);
    await asUser(id);
    await rows("select public.claim_invites()");
    expect(await one("select role from public.memberships where user_id = $1 and business_id = $2", [id, bizA])).toBe("sales");
  });
});
