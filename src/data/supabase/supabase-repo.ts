import type { SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase/client";
import {
  adjustStock,
  cancelDoc,
  convertDoc,
  createDoc,
  createExpense,
  createVoucher,
  recordPayment,
  saveParty,
  saveProduct,
  setCleared,
  transferStock,
  type State,
} from "@/domain/engine";
import type { Account, Business, Doc, Expense, JournalEntry, Member, Party, Payment, Product, Role, Warehouse } from "@/domain/types";
import { RepoError, type Repo, type WithOptionalId } from "../repo";
import { inviteMemberAction } from "@/lib/auth/actions";
import {
  accountFromRow,
  auditFromRow,
  buildPayload,
  businessFromRow,
  docFromRow,
  expenseFromRow,
  journalFromRow,
  memberFromRow,
  movementFromRow,
  partyFromRow,
  paymentFromRow,
  productFromRow,
  snake,
  stateFromRows,
  warehouseFromRow,
  type PayloadOptions,
  type RawRows,
} from "./mapping";

type Row = Record<string, unknown>;
type Err = { message: string; code?: string; status?: number } | null;
const PAGE = 1000;

/** What a mutation needs to read before running the engine. */
type Scope = {
  products?: boolean;
  parties?: boolean;
  warehouses?: boolean;
  accounts?: boolean;
  /** Movements for these products, or all movements when true. */
  movementsFor?: string[] | true;
  movementRefs?: string[];
  docIds?: string[];
  journalRefs?: string[];
  journalIds?: string[];
};

function translate(error: NonNullable<Err>): RepoError {
  if (error.status === 401 || error.code === "PGRST301" || /jwt/i.test(error.message)) {
    if (typeof window !== "undefined") window.dispatchEvent(new Event("session-expired"));
    return new RepoError("Your session expired. Sign in again to continue.", "input");
  }
  if (error.code === "42501") return new RepoError("Your role does not allow this action. Ask your owner to change your role.", "input");
  if (error.code === "23505") return new RepoError("That number, SKU or barcode is already in use. Try again.", "input");
  if (error.code === "23503") return new RepoError("This record is used elsewhere. Mark it inactive instead of deleting it.", "input");
  if (error.code === "23514" || error.code === "P0001" || error.code === "22023") return new RepoError(error.message, "input");
  if (/failed to fetch|networkerror|load failed/i.test(error.message)) return new RepoError("The network request failed. Check your connection and try again.", "network");
  return new RepoError(`Something went wrong on our side. ${error.message}`, "ours");
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string } {
  const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new RepoError("The attached file could not be read.", "input");
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const ext = m[1] === "application/pdf" ? "pdf" : m[1] === "image/png" ? "png" : m[1] === "image/webp" ? "webp" : "jpg";
  return { blob: new Blob([bytes], { type: m[1] }), ext };
}

export class SupabaseRepo implements Repo {
  mode = "supabase" as const;
  private sb: SupabaseClient = getBrowserSupabase() as unknown as SupabaseClient;
  private bizId?: string;
  private claimed = false;

  // ---------- plumbing ----------

  private ok<T>(res: { data: T | null; error: Err }): T {
    if (res.error) throw translate(res.error);
    return res.data as T;
  }

  private async biz(): Promise<string> {
    if (this.bizId) return this.bizId;
    if (!this.claimed) {
      this.claimed = true;
      await this.sb.rpc("claim_invites");
    }
    const { data: u } = await this.sb.auth.getUser();
    if (!u.user) throw translate({ message: "jwt expired", status: 401 });
    const res = await this.sb.from("memberships").select("business_id").eq("user_id", u.user.id).eq("active", true).order("created_at").limit(1).maybeSingle();
    const row = this.ok(res as { data: Row | null; error: Err });
    if (!row) throw new RepoError("You are not a member of any business yet.", "input");
    this.bizId = String(row.business_id);
    return this.bizId;
  }

  private async actor(): Promise<string> {
    const { data } = await this.sb.auth.getUser();
    return data.user?.email ?? "user";
  }

  /** Reads every row, paging past PostgREST's 1000 row default. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async all(table: string, select = "*", build?: (q: any) => unknown, order = "id"): Promise<Row[]> {
    const biz = await this.biz();
    const out: Row[] = [];
    for (let from = 0; ; from += PAGE) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = this.sb.from(table).select(select).eq(table === "businesses" ? "id" : "business_id", biz);
      if (build) q = build(q) ?? q;
      const res = await q.order(order, { ascending: true }).range(from, from + PAGE - 1);
      const rows = this.ok(res as { data: Row[] | null; error: Err }) ?? [];
      out.push(...rows);
      if (rows.length < PAGE) break;
    }
    return out;
  }

  private async load(scope: Scope): Promise<State> {
    const biz = await this.biz();
    const raw: RawRows = { business: (await this.all("businesses"))[0], sequences: (await this.all("doc_sequences", "*", undefined, "series")) as never };
    const [products, variants, parties, warehouses, accounts] = await Promise.all([
      scope.products ? this.all("products") : [],
      scope.products ? this.all("product_variants") : [],
      scope.parties ? this.all("parties") : [],
      scope.warehouses ? this.all("warehouses") : [],
      scope.accounts ? this.all("accounts", "*", undefined, "code") : [],
    ]);
    Object.assign(raw, { products, variants, parties, warehouses, accounts });
    if (scope.movementsFor === true) raw.movements = await this.all("stock_movements", "*", undefined, "seq");
    else if (scope.movementsFor?.length) raw.movements = await this.all("stock_movements", "*", (q) => (q as { in: (c: string, v: string[]) => unknown }).in("product_id", scope.movementsFor as string[]), "seq");
    if (scope.movementRefs?.length) {
      const extra = await this.all("stock_movements", "*", (q) => (q as { in: (c: string, v: string[]) => unknown }).in("ref_id", scope.movementRefs as string[]), "seq");
      const have = new Set((raw.movements ?? []).map((m) => m.id));
      raw.movements = [...(raw.movements ?? []), ...extra.filter((m) => !have.has(m.id))];
    }
    if (scope.docIds?.length) {
      const ids = scope.docIds;
      const inIds = (q: unknown) => (q as { in: (c: string, v: string[]) => unknown }).in("id", ids);
      const [sd, pd] = await Promise.all([this.all("sales_documents", "*, sales_items(*)", inIds), this.all("purchase_documents", "*, purchase_items(*)", inIds)]);
      raw.salesDocs = sd;
      raw.purchaseDocs = pd;
      raw.salesItems = sd.flatMap((d) => (d.sales_items as Row[]) ?? []);
      raw.purchaseItems = pd.flatMap((d) => (d.purchase_items as Row[]) ?? []);
    }
    const refs = [...(scope.journalRefs ?? [])];
    if (refs.length || scope.journalIds?.length) {
      const j = await this.all("journal_entries", "*, journal_lines(*)", (q) => (q as { in: (c: string, v: string[]) => unknown }).in(scope.journalIds?.length ? "id" : "ref_id", scope.journalIds?.length ? scope.journalIds : refs), "seq");
      raw.journal = j;
      raw.lines = j.flatMap((e) => (e.journal_lines as Row[]) ?? []);
    }
    void biz;
    return stateFromRows(raw);
  }

  /** Runs an engine function on freshly loaded state and commits the result atomically. Retries once on a number collision. */
  private async mutate<T>(opts: PayloadOptions, scope: Scope, fn: (s: State, actor: string) => T, beforeCommit?: (s: State) => Promise<Record<string, string>>): Promise<T> {
    const biz = await this.biz();
    const actor = await this.actor();
    for (let attempt = 0; ; attempt++) {
      const before = await this.load(scope);
      const after = structuredClone(before);
      const result = fn(after, actor);
      const attachmentPaths = beforeCommit ? await beforeCommit(after) : {};
      const payload = buildPayload(before, after, { ...opts, attachmentPaths });
      const { error } = await this.sb.rpc("commit_changes", { p_business: biz, p_payload: payload });
      if (!error) return structuredClone(result);
      if (error.code === "23505" && attempt === 0) continue; // another device took the number: reload sequences and retry
      throw translate(error as Err & { message: string });
    }
  }

  private async upload(bucket: "documents" | "product-images", folder: string, id: string, dataUrl: string): Promise<string> {
    const biz = await this.biz();
    const { blob, ext } = dataUrlToBlob(dataUrl);
    const path = `${biz}/${folder}/${id}.${ext}`;
    const { error } = await this.sb.storage.from(bucket).upload(path, blob, { contentType: blob.type, upsert: true });
    if (error) throw new RepoError(`The file could not be uploaded. ${error.message}`, "network");
    return path;
  }

  private async signed(path?: string | null): Promise<string | undefined> {
    if (!path) return undefined;
    const { data } = await this.sb.storage.from("documents").createSignedUrl(path, 3600);
    return data?.signedUrl;
  }

  // ---------- business ----------

  business: Repo["business"] = {
    get: async () => {
      const s = await this.load({});
      return s.business;
    },
    save: async (b: Business) => {
      const biz = await this.biz();
      const { id, sequences, ...rest } = b;
      void id;
      void sequences;
      const res = await this.sb.from("businesses").update(snake(rest as unknown as Row)).eq("id", biz).select().single();
      const row = this.ok(res as { data: Row | null; error: Err })!;
      return businessFromRow(row, (await this.all("doc_sequences", "*", undefined, "series")) as never);
    },
  };

  // ---------- products ----------

  products: Repo["products"] = {
    list: async () => {
      const [p, v] = await Promise.all([this.all("products"), this.all("product_variants")]);
      return p.map((r) => productFromRow(r, v.filter((x) => x.product_id === r.id)));
    },
    get: async (id) => (await this.products.list()).find((p) => p.id === id),
    save: async (item) => {
      const editing = Boolean(item.id);
      const toSave = { ...item };
      return this.mutate(
        { module: "inventory", action: editing ? "edit" : "create" },
        { products: true, warehouses: true, accounts: true },
        (s, actor) => saveProduct(s, toSave, actor),
        async (s) => {
          const p = s.products.find((x) => x.imageUrl?.startsWith("data:"));
          if (p?.imageUrl) {
            const path = await this.upload("product-images", "products", p.id, p.imageUrl);
            const { data } = this.sb.storage.from("product-images").getPublicUrl(path);
            p.imageUrl = data.publicUrl;
          }
          return {};
        },
      );
    },
    remove: async (id) => {
      const biz = await this.biz();
      const { error } = await this.sb.from("products").delete().eq("business_id", biz).eq("id", id);
      if (error) throw translate(error as NonNullable<Err>);
    },
    bulkUpsert: async (rows: WithOptionalId<Product>[]) => {
      let n = 0;
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        n += await this.mutate({ module: "inventory", action: "create" }, { products: true, warehouses: true, accounts: true }, (s, actor) => {
          for (const r of chunk) {
            const existing = s.products.find((p) => r.sku && p.sku === r.sku);
            saveProduct(s, existing ? { ...existing, ...r, id: existing.id, openingStock: existing.openingStock } : r, actor);
          }
          return chunk.length;
        });
      }
      return n;
    },
  };

  // ---------- warehouses ----------

  warehouses: Repo["warehouses"] = {
    list: async () => (await this.all("warehouses")).map(warehouseFromRow),
    get: async (id) => (await this.warehouses.list()).find((w) => w.id === id),
    save: async (item) => {
      const biz = await this.biz();
      if (!item.name.trim()) throw new RepoError("Enter a warehouse name.", "input", "name");
      if (item.isDefault) await this.sb.from("warehouses").update({ is_default: false }).eq("business_id", biz).neq("id", item.id ?? "00000000-0000-0000-0000-000000000000");
      const row = { business_id: biz, name: item.name, address: item.address, is_default: item.isDefault };
      const res = item.id
        ? await this.sb.from("warehouses").update(row).eq("business_id", biz).eq("id", item.id).select().single()
        : await this.sb.from("warehouses").insert(row).select().single();
      return warehouseFromRow(this.ok(res as { data: Row | null; error: Err })!) as Warehouse;
    },
    remove: async (id) => {
      const biz = await this.biz();
      const { error } = await this.sb.from("warehouses").delete().eq("business_id", biz).eq("id", id);
      if (error) throw translate(error as NonNullable<Err>);
    },
  };

  // ---------- parties ----------

  parties: Repo["parties"] = {
    list: async () => (await this.all("parties")).map(partyFromRow),
    get: async (id) => (await this.parties.list()).find((p) => p.id === id),
    save: async (item: WithOptionalId<Party>) =>
      this.mutate({ module: item.type === "customer" ? "sales" : "purchases", action: item.id ? "edit" : "create" }, { parties: true, accounts: true }, (s, actor) => saveParty(s, item, actor)),
    remove: async (id) => {
      const biz = await this.biz();
      const { error } = await this.sb.from("parties").delete().eq("business_id", biz).eq("id", id);
      if (error) throw translate(error as NonNullable<Err>);
    },
  };

  // ---------- accounts ----------

  accounts: Repo["accounts"] = {
    list: async () => (await this.all("accounts", "*", undefined, "code")).map(accountFromRow),
    save: async (item) => {
      const biz = await this.biz();
      if (!item.name.trim()) throw new RepoError("Enter an account name.", "input", "name");
      if (item.id) throw new RepoError("Existing accounts cannot be edited.", "input");
      const res = await this.sb.from("accounts").insert({ business_id: biz, id: crypto.randomUUID(), code: item.code, name: item.name, group: item.group, nature: item.nature, system: false }).select().single();
      return accountFromRow(this.ok(res as { data: Row | null; error: Err })!) as Account;
    },
  };

  // ---------- stock ----------

  stock: Repo["stock"] = {
    movements: async () => (await this.all("stock_movements", "*", undefined, "seq")).map(movementFromRow),
    adjust: async (input) =>
      this.mutate({ module: "inventory", action: "create" }, { products: true, accounts: true, warehouses: true, movementsFor: [input.productId] }, (s, actor) => adjustStock(s, input, actor)),
    transfer: async (input) =>
      this.mutate({ module: "inventory", action: "create" }, { products: true, accounts: true, warehouses: true, movementsFor: [input.productId] }, (s, actor) => transferStock(s, input, actor)),
  };

  // ---------- documents ----------

  private async fetchDocs(kind: "sales" | "purchase", ids?: string[]): Promise<Doc[]> {
    const table = kind === "sales" ? "sales_documents" : "purchase_documents";
    const items = kind === "sales" ? "sales_items(*)" : "purchase_items(*)";
    const rows = await this.all(table, `*, ${items}`, ids ? (q) => (q as { in: (c: string, v: string[]) => unknown }).in("id", ids) : undefined);
    return rows.map((r) => docFromRow(kind, r, ((kind === "sales" ? r.sales_items : r.purchase_items) as Row[]) ?? []));
  }

  docs: Repo["docs"] = {
    list: (kind) => this.fetchDocs(kind),
    get: async (id) => {
      const found = (await this.fetchDocs("sales", [id]))[0] ?? (await this.fetchDocs("purchase", [id]))[0];
      if (!found) return undefined;
      const table = found.kind === "sales" ? "sales_documents" : "purchase_documents";
      const biz = await this.biz();
      const { data } = await this.sb.from(table).select("attachment_path").eq("business_id", biz).eq("id", id).maybeSingle();
      return { ...found, attachmentDataUrl: await this.signed((data as Row | null)?.attachment_path as string | undefined) };
    },
    create: async (input) => {
      const productIds = [...new Set(input.items.map((i) => i.productId))];
      const kind = input.kind;
      return this.mutate(
        { module: kind === "sales" ? "sales" : "purchases", action: "create" },
        { products: true, warehouses: true, accounts: true, parties: true, movementsFor: productIds, docIds: input.id ? [input.id] : undefined },
        (s, actor) => createDoc(s, input, actor),
        async (s) => {
          const out: Record<string, string> = {};
          for (const d of s.docs) {
            if (d.attachmentDataUrl?.startsWith("data:")) {
              out[d.id] = await this.upload("documents", kind === "sales" ? "sales" : "bills", d.id, d.attachmentDataUrl);
              d.attachmentDataUrl = undefined;
            }
          }
          return out;
        },
      );
    },
    convert: async (id, toType) => {
      const src = await this.docs.get(id);
      if (!src) throw new RepoError("Document not found.", "ours");
      const ids = [...new Set(src.items.map((i) => i.productId))];
      return this.mutate({ module: src.kind === "sales" ? "sales" : "purchases", action: "create" }, { products: true, warehouses: true, accounts: true, parties: true, movementsFor: ids, docIds: [id] }, (s, actor) => convertDoc(s, id, toType, actor));
    },
    cancel: async (id) => {
      const src = await this.docs.get(id);
      if (!src) throw new RepoError("Document not found.", "ours");
      await this.mutate({ module: src.kind === "sales" ? "sales" : "purchases", action: "delete" }, { accounts: true, docIds: [id], movementRefs: [id], journalRefs: [id] }, (s, actor) => cancelDoc(s, id, actor));
    },
    setEinvoice: async (id, data) => {
      const src = await this.docs.get(id);
      if (!src) throw new RepoError("Document not found.", "ours");
      await this.mutate({ module: "sales", action: "edit" }, { docIds: [id] }, (s) => {
        const d = s.docs.find((x) => x.id === id);
        if (!d) throw new RepoError("Document not found.", "ours");
        d.einvoice = { ...d.einvoice, irn: data.irn ?? d.einvoice.irn, ackNo: data.ackNo ?? d.einvoice.ackNo, ackDate: data.ackDate ?? d.einvoice.ackDate };
        if (data.ewayBillNo !== undefined) d.ewayBillNo = data.ewayBillNo;
      });
    },
  };

  // ---------- payments, journal, expenses ----------

  payments: Repo["payments"] = {
    list: async () => (await this.all("payments", "*, payment_allocations(*)")).map((r) => paymentFromRow(r, (r.payment_allocations as Row[]) ?? [])),
    record: async (input) =>
      this.mutate(
        { module: input.direction === "in" ? "sales" : "purchases", action: "create" },
        { parties: true, accounts: true, docIds: input.allocations.map((a) => a.docId) },
        (s, actor) => recordPayment(s, input, actor),
      ) as Promise<Payment>,
  };

  journal: Repo["journal"] = {
    list: async () => (await this.all("journal_entries", "*, journal_lines(*)", undefined, "seq")).map((r) => journalFromRow(r, (r.journal_lines as Row[]) ?? [])),
    createVoucher: async (input) => this.mutate({ module: "accounting", action: "create" }, { accounts: true }, (s, actor) => createVoucher(s, input, actor)) as Promise<JournalEntry>,
    setCleared: async (entryId, accountId, date) => {
      await this.mutate({ module: "accounting", action: "edit" }, { journalIds: [entryId] }, (s) => setCleared(s, entryId, accountId, date));
    },
  };

  expenses: Repo["expenses"] = {
    list: async () => {
      const rows = await this.all("expenses");
      const paths = rows.map((r) => r.attachment_path as string | null).filter((p): p is string => Boolean(p));
      const urls = new Map<string, string>();
      if (paths.length) {
        const { data } = await this.sb.storage.from("documents").createSignedUrls(paths, 3600);
        for (const d of data ?? []) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl);
      }
      return rows.map((r) => expenseFromRow(r, urls.get(String(r.attachment_path)))).reverse();
    },
    create: async (input) =>
      this.mutate(
        { module: "accounting", action: "create" },
        { accounts: true },
        (s, actor) => createExpense(s, input, actor),
        async (s) => {
          const out: Record<string, string> = {};
          for (const e of s.expenses) {
            if (e.attachmentDataUrl?.startsWith("data:")) {
              out[e.id] = await this.upload("documents", "expenses", e.id, e.attachmentDataUrl);
              e.attachmentDataUrl = undefined;
            }
          }
          return out;
        },
      ) as Promise<Expense>,
  };

  // ---------- team and audit ----------

  team: Repo["team"] = {
    list: async () => (await this.all("memberships", "*", undefined, "created_at")).map(memberFromRow),
    setRole: async (id: string, role: Role) => {
      const biz = await this.biz();
      const { error } = await this.sb.rpc("set_member_role", { p_business: biz, p_member: id, p_role: role });
      if (error) throw translate(error as NonNullable<Err>);
    },
    setActive: async (id, active) => {
      const biz = await this.biz();
      const { error } = await this.sb.rpc("set_member_active", { p_business: biz, p_member: id, p_active: active });
      if (error) throw translate(error as NonNullable<Err>);
    },
    invite: async (email, name, role) => {
      const biz = await this.biz();
      const res = await inviteMemberAction({ businessId: biz, email, name, role });
      if (!res.ok) throw new RepoError(res.message, "input", res.fields?.email ? "email" : undefined);
      const list = await this.team.list();
      return list.find((m) => m.email.toLowerCase() === email.toLowerCase()) as Member;
    },
  };

  audit: Repo["audit"] = {
    list: async () => {
      const biz = await this.biz();
      const res = await this.sb.from("audit_log").select("*").eq("business_id", biz).order("at", { ascending: false }).limit(500);
      return (this.ok(res as { data: Row[] | null; error: Err }) ?? []).map(auditFromRow);
    },
  };
}
