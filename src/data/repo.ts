import type {
  Account,
  AdjustInput,
  AuditEntry,
  Business,
  Doc,
  DocInput,
  DocKind,
  Expense,
  ExpenseInput,
  JournalEntry,
  Member,
  Party,
  Payment,
  PaymentInput,
  Product,
  Role,
  StockMovement,
  TransferInput,
  VoucherInput,
  Warehouse,
} from "@/domain/types";

export type WithOptionalId<T> = Omit<T, "id"> & { id?: string };

export interface Crud<T extends { id: string }> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  save(item: WithOptionalId<T>): Promise<T>;
  remove(id: string): Promise<void>;
}

/** Every data source (demo memory or Supabase) implements this. UI code only talks to Repo. */
export interface Repo {
  mode: "demo" | "supabase";
  business: { get(): Promise<Business>; save(b: Business): Promise<Business> };
  products: Crud<Product> & { bulkUpsert(rows: WithOptionalId<Product>[]): Promise<number> };
  warehouses: Crud<Warehouse>;
  parties: Crud<Party>;
  accounts: { list(): Promise<Account[]>; save(a: WithOptionalId<Account>): Promise<Account> };
  stock: {
    movements(): Promise<StockMovement[]>;
    adjust(input: AdjustInput): Promise<void>;
    transfer(input: TransferInput): Promise<void>;
  };
  docs: {
    list(kind: DocKind): Promise<Doc[]>;
    get(id: string): Promise<Doc | undefined>;
    create(input: DocInput): Promise<Doc>;
    convert(id: string, toType: string): Promise<Doc>;
    cancel(id: string): Promise<void>;
    setEinvoice(id: string, data: { irn?: string; ackNo?: string; ackDate?: string; ewayBillNo?: string }): Promise<void>;
  };
  payments: { list(): Promise<Payment[]>; record(input: PaymentInput): Promise<Payment> };
  journal: {
    list(): Promise<JournalEntry[]>;
    createVoucher(input: VoucherInput): Promise<JournalEntry>;
    /** Mark a bank entry as cleared on a statement date, or pass null to un-clear. */
    setCleared(entryId: string, accountId: string, date: string | null): Promise<void>;
  };
  expenses: { list(): Promise<Expense[]>; create(input: ExpenseInput): Promise<Expense> };
  team: {
    list(): Promise<Member[]>;
    setRole(id: string, role: Role): Promise<void>;
    setActive(id: string, active: boolean): Promise<void>;
    invite(email: string, name: string, role: Role): Promise<Member>;
  };
  audit: { list(): Promise<AuditEntry[]> };
}

/** Thrown with a user-facing message. `field` points at the form field when it is an input problem. */
export class RepoError extends Error {
  constructor(
    message: string,
    public blame: "ours" | "network" | "input" = "input",
    public field?: string,
  ) {
    super(message);
    this.name = "RepoError";
  }
}
