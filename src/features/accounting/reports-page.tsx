"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/amount";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel, Skeleton } from "@/components/ui/surface";
import { ErrorState } from "@/components/states/error-state";
import { useAccounts, useBusiness, useDocs, useJournal, useMovements, useParties, useProducts } from "@/data/hooks";
import { aging, balanceSheet, gstr1, gstr3b, itcReport, itemProfit, profitAndLoss, register, trialBalance } from "@/domain/reports";
import { useFy } from "@/lib/fy";
import { downloadText, toCsv } from "@/lib/csv";
import { formatDate } from "@/lib/format/date";
import { stateName } from "@/lib/gst/states";
import { cn } from "@/lib/utils";

type Csv = { headers: string[]; rows: (string | number)[][] };
type Out = { node: React.ReactNode; csv?: Csv };

const REPORTS: { id: string; label: string; group: string; range: "asof" | "period" }[] = [
  { id: "trial-balance", label: "Trial balance", group: "Books", range: "asof" },
  { id: "profit-loss", label: "Profit and loss", group: "Books", range: "period" },
  { id: "balance-sheet", label: "Balance sheet", group: "Books", range: "asof" },
  { id: "gstr1", label: "GSTR-1 summary", group: "GST", range: "period" },
  { id: "gstr3b", label: "GSTR-3B summary", group: "GST", range: "period" },
  { id: "itc", label: "Input tax credit", group: "GST", range: "period" },
  { id: "sales-register", label: "Sales register", group: "Registers", range: "period" },
  { id: "purchase-register", label: "Purchase register", group: "Registers", range: "period" },
  { id: "receivables", label: "Receivables aging", group: "Aging", range: "asof" },
  { id: "payables", label: "Payables aging", group: "Aging", range: "asof" },
  { id: "item-profit", label: "Item-wise profit", group: "Stock", range: "period" },
];

function T({ head, rows, right = [], foot }: { head: string[]; rows: React.ReactNode[][]; right?: number[]; foot?: React.ReactNode[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead><tr className="border-b border-line bg-surface-2 text-left text-xs text-muted">{head.map((h, i) => <th key={h + i} className={cn("px-3 py-2 font-medium", right.includes(i) && "text-right")}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.length === 0 ? <tr><td colSpan={head.length} className="px-3 py-8 text-center text-muted">Nothing to show for this period.</td></tr> : rows.map((r, i) => <tr key={i} className="border-b border-line last:border-0">{r.map((c, j) => <td key={j} className={cn("px-3 py-2", right.includes(j) && "num text-right")}>{c}</td>)}</tr>)}
        </tbody>
        {foot ? <tfoot><tr className="border-t border-line bg-surface-2 font-semibold">{foot.map((c, j) => <td key={j} className={cn("px-3 py-2", right.includes(j) && "num text-right")}>{c}</td>)}</tr></tfoot> : null}
      </table>
    </div>
  );
}
const M = (v: number) => <Money value={v} symbol={false} />;

export function ReportsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const fy = useFy();
  const id = params.get("r") ?? "";
  const def = REPORTS.find((r) => r.id === id);
  const [from, setFrom] = React.useState(fy.from);
  const [to, setTo] = React.useState(fy.to < fy.today ? fy.to : fy.today);
  const sales = useDocs("sales");
  const purchases = useDocs("purchase");
  const accounts = useAccounts();
  const journal = useJournal();
  const products = useProducts();
  const movements = useMovements();
  const parties = useParties();
  const business = useBusiness();
  void parties;

  const loading = [sales, purchases, accounts, journal, products, movements, business].some((q) => q.isPending);
  const error = [sales, purchases, accounts, journal, products, movements, business].find((q) => q.error)?.error;

  const out = React.useMemo<Out | undefined>(() => {
    if (!def || !sales.data || !purchases.data || !accounts.data || !journal.data || !products.data || !movements.data || !business.data) return undefined;
    const docs = [...sales.data, ...purchases.data];
    switch (def.id) {
      case "trial-balance": {
        const tb = trialBalance(accounts.data, journal.data, to);
        return {
          node: <T head={["Code", "Account", "Debit", "Credit"]} right={[2, 3]} rows={tb.rows.map((r) => [<span key="c" className="num text-muted">{r.account.code}</span>, r.account.name, r.debit ? M(r.debit) : "", r.credit ? M(r.credit) : ""])} foot={["", <span key="t">Total {tb.balanced ? <Badge tone="ok">Balanced</Badge> : <Badge tone="bad">Out of balance</Badge>}</span>, M(tb.debit), M(tb.credit)]} />,
          csv: { headers: ["Code", "Account", "Debit", "Credit"], rows: tb.rows.map((r) => [r.account.code, r.account.name, r.debit, r.credit]) },
        };
      }
      case "profit-loss": {
        const p = profitAndLoss(accounts.data, journal.data, from, to);
        const rows: [string, number, boolean?][] = [
          ["Sales", p.sales], ["Less: sales returns", -p.salesReturns], ["Net sales", p.netSales, true], ["Cost of goods sold", p.cogs],
          ...p.directExpenses.map((l) => [l.label, l.amount] as [string, number]), ["Gross profit", p.grossProfit, true],
          ...p.indirectIncome.map((l) => [`Add: ${l.label}`, l.amount] as [string, number]), ...p.indirectExpenses.map((l) => [`Less: ${l.label}`, l.amount] as [string, number]),
          ["Net profit", p.netProfit, true],
        ];
        return { node: <T head={["Particulars", "Amount"]} right={[1]} rows={rows.map(([l, v, b]) => [b ? <strong key="l">{l}</strong> : l, b ? <strong key="v">{M(v)}</strong> : M(v)])} />, csv: { headers: ["Particulars", "Amount"], rows: rows.map(([l, v]) => [l, v]) } };
      }
      case "balance-sheet": {
        const b = balanceSheet(accounts.data, journal.data, to, fy.from);
        const left = [...b.capital.map((l) => [l.label, l.amount] as const), ["Profit for the period", b.profit] as const, ...b.liabilities.map((l) => [l.label, l.amount] as const)];
        return {
          node: (
            <div className="grid gap-4 md:grid-cols-2">
              <T head={["Capital and liabilities", "Amount"]} right={[1]} rows={left.map(([l, v]) => [l, M(v)])} foot={["Total", M(b.capTotal + b.liabTotal)]} />
              <T head={["Assets", "Amount"]} right={[1]} rows={b.assets.map((l) => [l.label, M(l.amount)])} foot={["Total", M(b.assetTotal)]} />
              <p className="md:col-span-2">{b.balanced ? <Badge tone="ok">Assets equal capital plus liabilities</Badge> : <Badge tone="bad">Does not balance</Badge>}</p>
            </div>
          ),
          csv: { headers: ["Side", "Particulars", "Amount"], rows: [...left.map(([l, v]) => ["Capital and liabilities", l, v]), ...b.assets.map((l) => ["Assets", l.label, l.amount])] },
        };
      }
      case "gstr1": {
        const g = gstr1(docs, business.data.stateCode, from, to);
        return {
          node: (
            <div className="space-y-5">
              <p className="text-sm text-muted">{g.totals.invoices} invoices · taxable <Money value={g.totals.taxable} /> · tax <Money value={g.totals.tax} /></p>
              <section><h3 className="mb-1 text-sm font-semibold">4. B2B invoices (registered customers)</h3><T head={["GSTIN", "Customer", "Invoice", "Date", "Place of supply", "Taxable", "Tax"]} right={[5, 6]} rows={g.b2b.map((d) => [<span key="g" className="num">{d.partyGstin}</span>, d.partyName, <span key="n" className="num">{d.number}</span>, formatDate(d.date), `${d.placeOfSupply} ${stateName(d.placeOfSupply)}`, M(d.totals.taxable), M(d.totals.cgst + d.totals.sgst + d.totals.igst + d.totals.cess)])} /></section>
              <section><h3 className="mb-1 text-sm font-semibold">5. B2C large (inter-state, over Rs. 2,50,000)</h3><T head={["Invoice", "Date", "Place of supply", "Taxable", "IGST"]} right={[3, 4]} rows={g.b2cl.map((d) => [<span key="n" className="num">{d.number}</span>, formatDate(d.date), d.placeOfSupply, M(d.totals.taxable), M(d.totals.igst)])} /></section>
              <section><h3 className="mb-1 text-sm font-semibold">7. B2C small (state and rate wise)</h3><T head={["Place of supply", "Rate", "Taxable", "Tax"]} right={[1, 2, 3]} rows={g.b2cs.map((r) => [`${r.place} ${stateName(r.place)}`, `${r.rate}%`, M(r.taxable), M(r.tax)])} /></section>
              <section><h3 className="mb-1 text-sm font-semibold">9B. Credit notes</h3><T head={["Note", "Date", "Customer", "Taxable", "Tax"]} right={[3, 4]} rows={g.cdnr.map((d) => [<span key="n" className="num">{d.number}</span>, formatDate(d.date), d.partyName, M(d.totals.taxable), M(d.totals.cgst + d.totals.sgst + d.totals.igst)])} /></section>
              <section><h3 className="mb-1 text-sm font-semibold">12. HSN summary</h3><T head={["HSN", "Rate", "Taxable", "CGST", "SGST", "IGST"]} right={[1, 2, 3, 4, 5]} rows={g.hsn.map((h) => [<span key="h" className="num">{h.hsn || "-"}</span>, `${h.gstRate}%`, M(h.taxable), M(h.cgst), M(h.sgst), M(h.igst)])} /></section>
            </div>
          ),
          csv: { headers: ["Section", "Document", "Date", "Party", "GSTIN", "Taxable", "CGST", "SGST", "IGST"], rows: [...g.b2b.map((d) => ["B2B", d.number, d.date, d.partyName, d.partyGstin, d.totals.taxable, d.totals.cgst, d.totals.sgst, d.totals.igst]), ...g.b2cl.map((d) => ["B2CL", d.number, d.date, d.partyName, "", d.totals.taxable, d.totals.cgst, d.totals.sgst, d.totals.igst]), ...g.cdnr.map((d) => ["CDNR", d.number, d.date, d.partyName, d.partyGstin, d.totals.taxable, d.totals.cgst, d.totals.sgst, d.totals.igst]), ...g.hsn.map((h) => ["HSN " + h.hsn, "", "", "", "", h.taxable, h.cgst, h.sgst, h.igst])] },
        };
      }
      case "gstr3b": {
        const g = gstr3b(docs, from, to);
        const rows: [string, number, number, number, number, number][] = [
          ["3.1 Outward taxable supplies", g.outward.taxable, g.outward.igst, g.outward.cgst, g.outward.sgst, g.outward.cess],
          ["3.1 Exempt, nil rated and export", g.exemptOutward, 0, 0, 0, 0],
          ["4. Eligible input tax credit", g.itc.taxable, g.itc.igst, g.itc.cgst, g.itc.sgst, g.itc.cess],
          ["6. Tax payable after credit", 0, g.payable.igst, g.payable.cgst, g.payable.sgst, g.payable.cess],
        ];
        return {
          node: (<><T head={["Table", "Taxable value", "IGST", "CGST", "SGST", "Cess"]} right={[1, 2, 3, 4, 5]} rows={rows.map(([l, ...v]) => [l, ...v.map(M)])} /><p className="mt-3 text-sm">Total payable in cash: <strong><Money value={g.totalPayable} /></strong>. Input credit is applied against the same head only. Cross-head set-off and carry-forward balances are not modelled, so confirm with your accountant before filing.</p></>),
          csv: { headers: ["Table", "Taxable value", "IGST", "CGST", "SGST", "Cess"], rows },
        };
      }
      case "itc": {
        const rows = itcReport(docs, from, to);
        return { node: <T head={["Date", "Bill", "Supplier", "GSTIN", "Taxable", "IGST", "CGST", "SGST"]} right={[4, 5, 6, 7]} rows={rows.map((r) => [formatDate(r.date), <span key="n" className="num">{r.number}</span>, r.supplier, <span key="g" className="num">{r.gstin}</span>, M(r.taxable), M(r.igst), M(r.cgst), M(r.sgst)])} foot={["", "", "", "Total", M(rows.reduce((a, r) => a + r.taxable, 0)), M(rows.reduce((a, r) => a + r.igst, 0)), M(rows.reduce((a, r) => a + r.cgst, 0)), M(rows.reduce((a, r) => a + r.sgst, 0))]} />, csv: { headers: ["Date", "Bill", "Supplier", "GSTIN", "Taxable", "IGST", "CGST", "SGST", "Cess"], rows: rows.map((r) => [r.date, r.number, r.supplier, r.gstin, r.taxable, r.igst, r.cgst, r.sgst, r.cess]) } };
      }
      case "sales-register":
      case "purchase-register": {
        const kind = def.id === "sales-register" ? "sales" : "purchase";
        const rows = register(docs, kind, from, to);
        const sign = (t: string) => (t === "credit_note" || t === "debit_note" ? -1 : 1);
        return { node: <T head={["Date", "Number", kind === "sales" ? "Customer" : "Supplier", "GSTIN", "Taxable", "CGST", "SGST", "IGST", "Total"]} right={[4, 5, 6, 7, 8]} rows={rows.map((d) => [formatDate(d.date), <span key="n" className="num">{d.number}</span>, d.partyName, <span key="g" className="num">{d.partyGstin}</span>, M(sign(d.type) * d.totals.taxable), M(sign(d.type) * d.totals.cgst), M(sign(d.type) * d.totals.sgst), M(sign(d.type) * d.totals.igst), M(sign(d.type) * d.totals.grandTotal)])} foot={["", "", "", "Total", M(rows.reduce((a, d) => a + sign(d.type) * d.totals.taxable, 0)), M(rows.reduce((a, d) => a + sign(d.type) * d.totals.cgst, 0)), M(rows.reduce((a, d) => a + sign(d.type) * d.totals.sgst, 0)), M(rows.reduce((a, d) => a + sign(d.type) * d.totals.igst, 0)), M(rows.reduce((a, d) => a + sign(d.type) * d.totals.grandTotal, 0))]} />, csv: { headers: ["Date", "Number", "Party", "GSTIN", "Taxable", "CGST", "SGST", "IGST", "Total"], rows: rows.map((d) => [d.date, d.number, d.partyName, d.partyGstin, sign(d.type) * d.totals.taxable, sign(d.type) * d.totals.cgst, sign(d.type) * d.totals.sgst, sign(d.type) * d.totals.igst, sign(d.type) * d.totals.grandTotal]) } };
      }
      case "receivables":
      case "payables": {
        const rows = aging(docs, def.id === "receivables" ? "sales" : "purchase", to);
        const sum = (k: "current" | "d30" | "d60" | "d90" | "over90" | "total") => rows.reduce((a, r) => a + r[k], 0);
        return { node: <T head={[def.id === "receivables" ? "Customer" : "Supplier", "Not due", "1-30 days", "31-60 days", "61-90 days", "Over 90", "Total"]} right={[1, 2, 3, 4, 5, 6]} rows={rows.map((r) => [<Link key="p" className="hover:underline" href={`${def.id === "receivables" ? "/sales/customers" : "/purchases/suppliers"}/${r.partyId}`}>{r.partyName}</Link>, M(r.current), M(r.d30), M(r.d60), M(r.d90), M(r.over90), M(r.total)])} foot={["Total", M(sum("current")), M(sum("d30")), M(sum("d60")), M(sum("d90")), M(sum("over90")), M(sum("total"))]} />, csv: { headers: ["Party", "Not due", "1-30", "31-60", "61-90", "Over 90", "Total"], rows: rows.map((r) => [r.partyName, r.current, r.d30, r.d60, r.d90, r.over90, r.total]) } };
      }
      case "item-profit": {
        const rows = itemProfit(docs, movements.data, products.data, from, to);
        return { node: <T head={["Item", "Qty sold", "Revenue", "Cost", "Profit", "Margin"]} right={[1, 2, 3, 4, 5]} rows={rows.map((r) => [r.name, <span key="q" className="num">{r.qty}</span>, M(r.revenue), M(r.cost), M(r.profit), `${r.margin}%`])} foot={["Total", "", M(rows.reduce((a, r) => a + r.revenue, 0)), M(rows.reduce((a, r) => a + r.cost, 0)), M(rows.reduce((a, r) => a + r.profit, 0)), ""]} />, csv: { headers: ["Item", "Qty", "Revenue", "Cost", "Profit", "Margin %"], rows: rows.map((r) => [r.name, r.qty, r.revenue, r.cost, r.profit, r.margin]) } };
      }
    }
  }, [def, sales.data, purchases.data, accounts.data, journal.data, products.data, movements.data, business.data, from, to, fy.from]);

  const groups = [...new Set(REPORTS.map((r) => r.group))];
  return (
    <>
      <div className="no-print">
        <PageHeader title="Reports" description="Books, GST returns, registers and aging. Export to CSV for Excel, or print and save as PDF." />
        <div className="grid gap-5 md:grid-cols-[14rem_1fr]">
          <nav aria-label="Reports" className="space-y-4">
            {groups.map((g) => (
              <div key={g}>
                <p className="mb-1 text-xs font-medium text-muted">{g}</p>
                <ul>{REPORTS.filter((r) => r.group === g).map((r) => <li key={r.id}><Link href={`/accounting/reports?r=${r.id}`} aria-current={r.id === id ? "page" : undefined} className={cn("block rounded px-2.5 py-1.5 text-sm hover:bg-surface-2", r.id === id ? "bg-surface-2 font-medium" : "text-muted")}>{r.label}</Link></li>)}</ul>
              </div>
            ))}
            <Link href="/inventory/stock" className="block rounded px-2.5 py-1.5 text-sm text-muted hover:bg-surface-2">Stock summary</Link>
          </nav>
          <div>
            {!def ? (
              <Panel className="p-8 text-center text-sm text-muted">Choose a report from the list. The date range defaults to the financial year you picked at the top.</Panel>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-end gap-3">
                  {def.range === "period" ? <label className="text-xs text-muted">From<Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-40" /></label> : null}
                  <label className="text-xs text-muted">{def.range === "period" ? "To" : "As on"}<Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-40" /></label>
                  <Button onClick={() => window.print()} disabled={!out}>Print or save as PDF</Button>
                  <Button onClick={() => out?.csv && downloadText(`${def.id}.csv`, toCsv(out.csv.headers, out.csv.rows))} disabled={!out?.csv}>Export CSV</Button>
                  <Button onClick={() => router.push("/accounting/reports")}>Close</Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {def ? (
        <div className="md:ml-[14rem] print:ml-0">
          <h2 className="mb-2 text-base font-semibold">{def.label}<span className="ml-2 text-sm font-normal text-muted">{def.range === "period" ? `${formatDate(from)} to ${formatDate(to)}` : `as on ${formatDate(to)}`}</span></h2>
          {error ? <ErrorState what="This report could not be built" blame="network" /> : loading || !out ? <Skeleton className="h-72 w-full" /> : <Panel className="p-3">{out.node}</Panel>}
        </div>
      ) : null}
    </>
  );
}
