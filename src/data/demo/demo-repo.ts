import {
  adjustStock,
  cancelDoc,
  convertDoc,
  createDoc,
  createExpense,
  createVoucher,
  logAudit,
  recordPayment,
  saveParty,
  saveProduct,
  setCleared,
  transferStock,
  uid,
  type State,
} from "@/domain/engine";
import { RepoError, type Repo } from "../repo";
import { seedState } from "./seed";
import type { Account, Member, Role, Warehouse } from "@/domain/types";

const KEY = "ims-demo-v1";
const ACTOR = "Demo Owner";

const clone = <T,>(v: T): T => structuredClone(v);

/** In-memory repository persisted to localStorage so the whole UI can be reviewed before Supabase is connected. */
export class DemoRepo implements Repo {
  mode = "demo" as const;
  private state: State | null = null;

  private s(): State {
    if (this.state) return this.state;
    let loaded: State | null = null;
    try {
      const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
      if (raw) loaded = JSON.parse(raw) as State;
    } catch {
      loaded = null;
    }
    this.state = loaded ?? seedState();
    this.persist();
    return this.state;
  }

  private persist() {
    try {
      if (typeof localStorage !== "undefined" && this.state) localStorage.setItem(KEY, JSON.stringify(this.state));
    } catch {
      /* quota or blocked storage: keep working in memory */
    }
  }

  /** Runs a mutation atomically: on failure the previous state is restored. */
  private tx<T>(fn: (s: State) => T): T {
    const s = this.s();
    const backup = structuredClone(s);
    try {
      const out = fn(s);
      this.persist();
      return clone(out);
    } catch (e) {
      this.state = backup;
      throw e;
    }
  }

  reset() {
    this.state = seedState();
    this.persist();
  }

  business: Repo["business"] = {
    get: async () => clone(this.s().business),
    save: async (b) =>
      this.tx((s) => {
        s.business = { ...s.business, ...b, sequences: s.business.sequences };
        logAudit(s, ACTOR, "updated", "business", s.business.name);
        return s.business;
      }),
  };

  products: Repo["products"] = {
    list: async () => clone(this.s().products),
    get: async (id) => clone(this.s().products.find((p) => p.id === id)),
    save: async (item) =>
      this.tx((s) => saveProduct(s, item, ACTOR)),
    remove: async (id) =>
      this.tx((s) => {
        if (s.movements.some((m) => m.productId === id && m.type !== "opening") || s.docs.some((d) => d.items.some((i) => i.productId === id))) {
          throw new RepoError("This product is used in documents or stock history. Mark it inactive instead of deleting.", "input");
        }
        s.products = s.products.filter((p) => p.id !== id);
        s.movements = s.movements.filter((m) => m.productId !== id);
        s.journal = s.journal.filter((j) => !(j.refType === "product" && j.refId === id));
      }),
    bulkUpsert: async (rows) =>
      this.tx((s) => {
        let n = 0;
        for (const r of rows) {
          const existing = s.products.find((p) => (r.sku && p.sku === r.sku) || (r.id && p.id === r.id));
          saveProduct(s, existing ? { ...existing, ...r, id: existing.id, openingStock: existing.openingStock } : r, ACTOR);
          n++;
        }
        return n;
      }),
  };

  warehouses: Repo["warehouses"] = {
    list: async () => clone(this.s().warehouses),
    get: async (id) => clone(this.s().warehouses.find((w) => w.id === id)),
    save: async (item) =>
      this.tx((s) => {
        if (!item.name.trim()) throw new RepoError("Enter a warehouse name.", "input", "name");
        const w: Warehouse = { ...item, id: item.id ?? uid() };
        if (w.isDefault) s.warehouses.forEach((x) => (x.isDefault = false));
        const i = s.warehouses.findIndex((x) => x.id === w.id);
        if (i >= 0) s.warehouses[i] = w;
        else s.warehouses.push(w);
        if (!s.warehouses.some((x) => x.isDefault)) s.warehouses[0].isDefault = true;
        return w;
      }),
    remove: async (id) =>
      this.tx((s) => {
        if (s.movements.some((m) => m.warehouseId === id)) throw new RepoError("This warehouse has stock history. Move the stock out and keep the warehouse for records.", "input");
        if (s.warehouses.length === 1) throw new RepoError("You need at least one warehouse.", "input");
        s.warehouses = s.warehouses.filter((w) => w.id !== id);
        if (!s.warehouses.some((x) => x.isDefault)) s.warehouses[0].isDefault = true;
      }),
  };

  parties: Repo["parties"] = {
    list: async () => clone(this.s().parties),
    get: async (id) => clone(this.s().parties.find((p) => p.id === id)),
    save: async (item) => this.tx((s) => saveParty(s, item, ACTOR)),
    remove: async (id) =>
      this.tx((s) => {
        if (s.docs.some((d) => d.partyId === id) || s.payments.some((p) => p.partyId === id)) {
          throw new RepoError("This party has documents or payments. Mark it inactive instead of deleting.", "input");
        }
        s.parties = s.parties.filter((p) => p.id !== id);
        s.journal = s.journal.filter((j) => !(j.refType === "party" && j.refId === id));
      }),
  };

  accounts: Repo["accounts"] = {
    list: async () => clone(this.s().accounts),
    save: async (item) =>
      this.tx((s) => {
        if (!item.name.trim()) throw new RepoError("Enter an account name.", "input", "name");
        const a: Account = { ...item, id: item.id ?? uid() };
        const i = s.accounts.findIndex((x) => x.id === a.id);
        if (i >= 0) {
          if (s.accounts[i].system) throw new RepoError("System accounts cannot be edited.", "input");
          s.accounts[i] = a;
        } else {
          if (s.accounts.some((x) => x.code === a.code)) throw new RepoError(`Code ${a.code} is already used.`, "input", "code");
          s.accounts.push(a);
        }
        return a;
      }),
  };

  stock: Repo["stock"] = {
    movements: async () => clone(this.s().movements),
    adjust: async (input) => this.tx((s) => adjustStock(s, input, ACTOR)),
    transfer: async (input) => this.tx((s) => transferStock(s, input, ACTOR)),
  };

  docs: Repo["docs"] = {
    list: async (kind) => clone(this.s().docs.filter((d) => d.kind === kind)),
    get: async (id) => clone(this.s().docs.find((d) => d.id === id)),
    create: async (input) => this.tx((s) => createDoc(s, input, ACTOR)),
    convert: async (id, toType) => this.tx((s) => convertDoc(s, id, toType, ACTOR)),
    cancel: async (id) => this.tx((s) => cancelDoc(s, id, ACTOR)),
    setEinvoice: async (id, data) =>
      this.tx((s) => {
        const d = s.docs.find((x) => x.id === id);
        if (!d) throw new RepoError("Document not found.", "ours");
        d.einvoice = { ...d.einvoice, irn: data.irn ?? d.einvoice.irn, ackNo: data.ackNo ?? d.einvoice.ackNo, ackDate: data.ackDate ?? d.einvoice.ackDate };
        if (data.ewayBillNo !== undefined) d.ewayBillNo = data.ewayBillNo;
      }),
  };

  payments: Repo["payments"] = {
    list: async () => clone(this.s().payments),
    record: async (input) => this.tx((s) => recordPayment(s, input, ACTOR)),
  };

  journal: Repo["journal"] = {
    list: async () => clone(this.s().journal),
    createVoucher: async (input) => this.tx((s) => createVoucher(s, input, ACTOR)),
    setCleared: async (entryId, accountId, date) => this.tx((s) => setCleared(s, entryId, accountId, date)),
  };

  expenses: Repo["expenses"] = {
    list: async () => clone(this.s().expenses),
    create: async (input) => this.tx((s) => createExpense(s, input, ACTOR)),
  };

  team: Repo["team"] = {
    list: async () => clone(this.s().members),
    setRole: async (id, role: Role) =>
      this.tx((s) => {
        const m = s.members.find((x) => x.id === id);
        if (!m) throw new RepoError("User not found.", "ours");
        if (m.role === "owner" && role !== "owner" && s.members.filter((x) => x.role === "owner" && x.active).length === 1) {
          throw new RepoError("The business needs at least one owner.", "input");
        }
        m.role = role;
        logAudit(s, ACTOR, "role changed", "user", `${m.email} is now ${role}`, id);
      }),
    setActive: async (id, active) =>
      this.tx((s) => {
        const m = s.members.find((x) => x.id === id);
        if (!m) throw new RepoError("User not found.", "ours");
        if (!active && m.role === "owner") throw new RepoError("Owners cannot be deactivated.", "input");
        m.active = active;
        logAudit(s, ACTOR, active ? "activated" : "deactivated", "user", m.email, id);
      }),
    invite: async (email, name, role) =>
      this.tx((s) => {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new RepoError("Enter a valid email like name@example.com.", "input", "email");
        if (s.members.some((m) => m.email.toLowerCase() === email.toLowerCase())) throw new RepoError("This email already has access.", "input", "email");
        const m: Member = { id: uid(), email, name: name || email.split("@")[0], role, active: true, createdAt: new Date().toISOString() };
        s.members.push(m);
        logAudit(s, ACTOR, "invited", "user", `${email} as ${role}`, m.id);
        return m;
      }),
  };

  audit: Repo["audit"] = { list: async () => clone(this.s().audit) };
}
