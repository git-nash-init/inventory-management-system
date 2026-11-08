import Link from "next/link";

const MODULES: { name: string; text: string }[] = [
  { name: "Inventory", text: "Products with HSN and GST rate, variants, batches and expiry, many godowns, transfers, adjustments with reasons, low stock alerts and barcode scanning." },
  { name: "Sales", text: "Quotation to order to challan to tax invoice in one click. Counter billing by barcode. Credit notes, receipts against many invoices, receivables aging." },
  { name: "Purchases", text: "Purchase orders, goods received, supplier bills with the scanned copy attached, debit notes, payables aging and input tax credit by bill." },
  { name: "GST invoices", text: "CGST and SGST or IGST worked out from the place of supply. A4, A5 and 80 mm thermal formats with UPI QR, amount in words and HSN summary." },
  { name: "Accounting", text: "Double entry books that post themselves. Cash book, bank book, day book, trial balance, profit and loss, balance sheet, GSTR-1 and GSTR-3B summaries." },
  { name: "Team", text: "Owner, manager, accountant, sales and store keeper roles. Every change is written to an activity log." },
];

export default function Landing() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 md:px-8 md:py-20">
      <h1 className="max-w-2xl text-3xl font-semibold leading-tight md:text-4xl">
        Stock, bills and books for your business, in one place.
      </h1>
      <p className="mt-4 max-w-2xl text-base text-muted">
        Khata Books keeps your inventory, sales, purchases, GST invoices and accounts together, so what is on the shelf, what customers owe and what you owe always agree.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/signup" className="inline-flex h-11 items-center rounded border border-accent bg-accent px-5 text-base font-medium text-accent-ink hover:bg-ink hover:border-ink">
          Create your account
        </Link>
        <Link href="/login" className="inline-flex h-11 items-center rounded border border-line bg-surface px-5 text-base font-medium hover:bg-surface-2">
          Sign in
        </Link>
      </div>

      <h2 className="mt-16 text-lg font-semibold">What it covers</h2>
      <dl className="mt-4 divide-y divide-line border-y border-line">
        {MODULES.map((m) => (
          <div key={m.name} className="grid gap-1 py-4 md:grid-cols-[10rem_1fr] md:gap-6">
            <dt className="font-medium">{m.name}</dt>
            <dd className="text-sm text-muted">{m.text}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-16 text-lg font-semibold">How your data is handled</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Each business sees only its own records, enforced inside the database. Sign in supports an authenticator app for two-factor authentication. Read the{" "}
        <Link href="/privacy" className="link">Privacy Policy</Link> and{" "}
        <Link href="/terms" className="link">Terms of Service</Link>.
      </p>
    </div>
  );
}
