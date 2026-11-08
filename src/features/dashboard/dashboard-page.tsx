"use client";

import * as React from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Money } from "@/components/ui/amount";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/surface";
import { ChartSkeleton, StatSkeleton } from "@/components/states/skeletons";
import { ErrorState } from "@/components/states/error-state";
import { EmptyState } from "@/components/states/empty-state";
import { useLiteMode } from "@/components/states/lite-mode";
import { useAccounts, useAudit, useDocs, useJournal, useMovements, useParties, useProducts } from "@/data/hooks";
import { dashboardStats } from "@/domain/reports";
import { outstanding } from "@/domain/engine";
import { useAuth } from "@/lib/auth/context";
import { useFy } from "@/lib/fy";
import { formatDate } from "@/lib/format/date";
import { formatINR, formatQty } from "@/lib/format/money";
import { docHref } from "@/features/documents/config";

const compact = (v: number) => (Math.abs(v) >= 10000000 ? `${(v / 10000000).toFixed(1)} Cr` : Math.abs(v) >= 100000 ? `${(v / 100000).toFixed(1)} L` : Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)} K` : String(v));

function Stat({ label, children, hint, href }: { label: string; children: React.ReactNode; hint?: string; href?: string }) {
  const body = (
    <Panel className="h-full p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold">{children}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Panel>
  );
  return href ? <Link href={href} className="block hover:opacity-90">{body}</Link> : body;
}

function BarList({ rows, empty }: { rows: { name: string; value: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="px-4 py-8 text-center text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-2.5 p-4">
      {rows.map((r) => (
        <li key={r.name} className="text-sm">
          <div className="flex justify-between gap-3"><span className="truncate">{r.name}</span><span className="num shrink-0">{formatINR(r.value)}</span></div>
          <div className="mt-1 h-1.5 bg-surface-2" role="presentation"><div className="h-1.5 bg-accent" style={{ width: `${(r.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function DashboardPage() {
  const { user, can } = useAuth();
  const { lite } = useLiteMode();
  const fy = useFy();
  const sales = useDocs("sales");
  const purchases = useDocs("purchase");
  const accounts = useAccounts();
  const journal = useJournal();
  const products = useProducts();
  const movements = useMovements();
  const parties = useParties();
  const audit = useAudit();
  const qs = [sales, purchases, accounts, journal, products, movements, parties];
  const loading = qs.some((q) => q.isPending);
  const error = qs.find((q) => q.error)?.error;

  const s = React.useMemo(() => {
    if (!sales.data || !purchases.data || !accounts.data || !journal.data || !products.data || !movements.data || !parties.data) return undefined;
    const asOf = fy.today < fy.to ? fy.today : fy.to;
    return dashboardStats({ docs: [...sales.data, ...purchases.data], accounts: accounts.data, journal: journal.data, products: products.data, movements: movements.data, parties: parties.data, asOf, fyFrom: fy.from, fyTo: fy.to });
  }, [sales.data, purchases.data, accounts.data, journal.data, products.data, movements.data, parties.data, fy]);

  const empty = s && sales.data?.length === 0 && purchases.data?.length === 0;
  const showMoney = can("accounting", "view") || can("sales", "view");

  return (
    <>
      <PageHeader title={`Welcome${user?.name ? `, ${user.name.split(" ")[0]}` : ""}`} description={`Here is where the business stands. Figures are for FY ${fy.label}.`} />
      {error ? (
        <ErrorState what="The dashboard could not be loaded" blame="network" onRetry={() => qs.forEach((q) => void q.refetch())} />
      ) : loading || !s ? (
        <div className="space-y-4"><StatSkeleton count={4} /><StatSkeleton count={4} />{lite ? null : <Panel><ChartSkeleton /></Panel>}</div>
      ) : empty ? (
        <Panel><EmptyState title="No activity yet" reason="Add products, record a purchase, then make your first sale. The numbers and charts fill in as you go." actionLabel="Add your first product" actionHref="/inventory/products?new=1" /></Panel>
      ) : (
        <div className="space-y-5">
          {showMoney ? (
            <>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Today's sales" href="/sales/invoices"><Money value={s.todaySales} /></Stat>
                <Stat label="This month's sales" href="/sales/invoices"><Money value={s.monthSales} /></Stat>
                <Stat label="Receivables" hint="Customers owe you" href="/accounting/reports?r=receivables"><Money value={s.receivables} /></Stat>
                <Stat label="Payables" hint="You owe suppliers" href="/accounting/reports?r=payables"><Money value={s.payables} /></Stat>
              </div>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Cash and bank" href="/accounting/bank-book"><Money value={s.cashBank} /></Stat>
                <Stat label="Stock value" href="/inventory/stock"><Money value={s.stockValue} /></Stat>
                <Stat label="Low stock items" hint="At or below reorder level" href="/inventory/stock"><span className={s.lowStockCount ? "num text-warn" : "num"}>{s.lowStockCount}</span></Stat>
                <Stat label="GST payable (estimate)" hint="After input credit, FY to date" href="/accounting/reports?r=gstr3b"><Money value={s.gstPayable} /></Stat>
              </div>
            </>
          ) : null}

          {showMoney && !lite ? (
            <Panel>
              <PanelHeader title="Sales and purchases by month (before tax)" />
              <div className="h-72 p-3" role="img" aria-label="Bar chart of monthly sales and purchases for the financial year">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={s.months} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="var(--line)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 12 }} stroke="var(--line)" />
                    <YAxis tickFormatter={compact} tick={{ fill: "var(--muted)", fontSize: 12 }} stroke="var(--line)" width={48} />
                    <Tooltip formatter={(v) => formatINR(Number(v))} contentStyle={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 3, boxShadow: "none", color: "var(--ink)" }} cursor={{ fill: "var(--surface-2)" }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="sales" name="Sales" fill="var(--accent)" radius={0} isAnimationActive={false} />
                    <Bar dataKey="purchases" name="Purchases" fill="var(--muted)" radius={0} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          ) : null}

          {showMoney ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <Panel><PanelHeader title="Top products" /><BarList rows={s.topProducts} empty="Sell something to see your best products." /></Panel>
              <Panel><PanelHeader title="Top customers" /><BarList rows={s.topCustomers} empty="No customer sales yet." /></Panel>
              <Panel><PanelHeader title="Sales by category" /><BarList rows={s.categoryMix.slice(0, 6)} empty="No category data yet." /></Panel>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {showMoney ? (
              <Panel>
                <PanelHeader title="Overdue invoices" action={<Link className="link text-xs" href="/sales/invoices">All invoices</Link>} />
                {s.overdue.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted">Nothing is overdue. Good.</p> : (
                  <ul className="divide-y divide-line text-sm">
                    {s.overdue.map((d) => (
                      <li key={d.id}><Link href={docHref(d.kind, d.type, d.id)} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-2"><span className="min-w-0"><span className="num">{d.number}</span> <span className="text-muted">{d.partyName}</span><br /><span className="text-xs text-bad">Due {formatDate(d.dueDate ?? d.date)}</span></span><Money value={outstanding(d)} /></Link></li>
                    ))}
                  </ul>
                )}
              </Panel>
            ) : null}
            <Panel>
              <PanelHeader title="Low stock" action={<Link className="link text-xs" href="/inventory/stock">Stock report</Link>} />
              {s.lowStock.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted">Every item is above its reorder level.</p> : (
                <ul className="divide-y divide-line text-sm">
                  {s.lowStock.map((r) => (
                    <li key={r.product.id + (r.variantId ?? "")} className="flex items-center justify-between px-4 py-2.5"><Link className="hover:underline" href={`/inventory/products/${r.product.id}`}>{r.product.name}</Link><span className="num"><Badge tone={r.qty <= 0 ? "bad" : "warn"}>{r.qty <= 0 ? "Out" : "Low"}</Badge> {formatQty(r.qty)} / {formatQty(r.product.reorderLevel)} {r.product.unit}</span></li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel>
              <PanelHeader title="Expiring within 30 days" />
              {s.expiring.length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted">No batches are close to expiry.</p> : (
                <ul className="divide-y divide-line text-sm">
                  {s.expiring.map((b) => <li key={b.productId + b.batchNo + b.warehouseId} className="flex items-center justify-between px-4 py-2.5"><span>{b.name} <span className="num text-xs text-muted">{b.batchNo}</span></span><span className="num"><Badge tone={b.daysLeft < 0 ? "bad" : "warn"}>{b.daysLeft < 0 ? "Expired" : `${b.daysLeft} days`}</Badge> {formatQty(b.qty)}</span></li>)}
                </ul>
              )}
            </Panel>
            <Panel>
              <PanelHeader title="Recent activity" action={can("users", "view") ? <Link className="link text-xs" href="/settings/activity">Full log</Link> : undefined} />
              {audit.isPending ? <p className="px-4 py-8 text-center text-sm text-muted">Loading</p> : (audit.data ?? []).length === 0 ? <p className="px-4 py-8 text-center text-sm text-muted">Activity will appear here.</p> : (
                <ul className="divide-y divide-line text-sm">
                  {(audit.data ?? []).slice(0, 6).map((a) => <li key={a.id} className="px-4 py-2.5"><span className="font-medium">{a.actor}</span> {a.action} <span className="text-muted">{a.detail}</span></li>)}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}
