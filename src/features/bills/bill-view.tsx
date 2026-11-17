"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Printer } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Money } from "@/components/ui/amount";
import { Panel } from "@/components/ui/surface";
import { EmptyState } from "@/components/states/empty-state";
import { LoadError } from "@/components/states/load-error";
import { PageSkeleton } from "@/components/states/skeletons";
import { cancelBill, useAction } from "@/data/actions";
import { useBill, useShop } from "@/data/queries";
import { billNumber } from "@/lib/bill";
import { formatDate } from "@/lib/format/date";
import { amountInWords, formatQty } from "@/lib/format/money";
import { useI18n } from "@/lib/i18n";

const linkButton = "inline-flex h-11 items-center gap-2 rounded border px-4 text-base font-medium";

export function BillView({ id }: { id: string }) {
  const { t, unit } = useI18n();
  const bill = useBill(id);
  const shop = useShop();
  const [confirming, setConfirming] = React.useState(false);
  const cancel = useAction(cancelBill, { success: t("view.cancelDone"), onDone: () => setConfirming(false) });

  if (bill.isPending) return <PageSkeleton />;
  if (bill.isError) return <LoadError error={bill.error} onRetry={() => void bill.refetch()} />;
  if (!bill.data) {
    return (
      <Panel>
        <EmptyState title={t("view.notFound")} reason="" actionLabel={t("bills.title")} actionHref="/bills" />
      </Panel>
    );
  }

  const b = bill.data;
  const s = shop.data;
  const cancelled = b.status === "cancelled";
  const hasBank = Boolean(s && (s.bankName || s.accountNo || s.ifsc || s.upiId));

  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <Link href="/bills" className={`${linkButton} border-line bg-surface hover:bg-surface-2`}>
          <ArrowLeft size={18} /> {t("common.back")}
        </Link>
        <Button variant="primary" size="lg" onClick={() => window.print()}>
          <Printer size={18} /> {t("view.print")}
        </Button>
        <Link href="/bills/new" className={`${linkButton} border-line bg-surface hover:bg-surface-2`}>
          <Plus size={18} /> {t("view.newBill")}
        </Link>
        {cancelled ? null : (
          <Button variant="ghost" size="lg" className="ml-auto text-bad" onClick={() => setConfirming(true)}>
            {t("view.cancel")}
          </Button>
        )}
      </div>

      <article className="relative mx-auto max-w-3xl overflow-hidden rounded border border-line bg-surface p-5 md:p-8 print:max-w-none print:rounded-none print:border-0 print:bg-white print:p-0 print:text-black">
        {cancelled ? (
          <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="-rotate-12 rounded border-4 border-bad px-6 py-2 text-5xl font-bold tracking-widest text-bad opacity-25">{t("view.stamp")}</span>
          </div>
        ) : null}

        <header className="border-b border-line pb-4 text-center print:border-black">
          <h1 className="text-2xl font-bold">{s?.name || t("app.name")}</h1>
          {s?.address ? <p className="mt-1 whitespace-pre-line text-sm">{s.address}</p> : null}
          {s?.phone ? <p className="num mt-0.5 text-sm">{s.phone}</p> : null}
        </header>

        <div className="mt-4 flex flex-wrap justify-between gap-4 text-sm">
          <div>
            <div className="text-xs text-muted print:text-black">{t("view.customer")}</div>
            <div className="text-base font-medium">{b.customerName || t("bills.walkIn")}</div>
            {b.customerMobile ? <div className="num">{b.customerMobile}</div> : null}
          </div>
          <div className="text-right">
            <div className="text-xs text-muted print:text-black">{t("view.bill")}</div>
            <div className="num text-base font-semibold">{billNumber(b.number)}</div>
            <div className="num">{formatDate(b.date)}</div>
          </div>
        </div>

        <div className="mt-4">
          <table className="w-full text-[13px] sm:text-sm">
            <thead>
              <tr className="border-y border-line text-left text-xs text-muted print:border-black print:text-black">
                <th className="hidden w-8 py-2 pr-2 font-medium sm:table-cell">#</th>
                <th className="py-2 pr-2 font-medium">{t("common.item")}</th>
                <th className="py-2 pr-2 text-right font-medium">{t("common.qty")}</th>
                <th className="py-2 pr-2 text-right font-medium">{t("view.rate")}</th>
                <th className="py-2 text-right font-medium">{t("common.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {b.items.map((i, n) => (
                <tr key={i.id} className="border-b border-line print:border-gray-400">
                  <td className="num hidden py-2 pr-2 sm:table-cell">{n + 1}</td>
                  <td className="py-2 pr-2 break-words">{i.name}</td>
                  <td className="num py-2 pr-2 text-right whitespace-nowrap">
                    {formatQty(i.qty)} {unit(i.unit)}
                  </td>
                  <td className="py-2 pr-2 text-right">
                    <Money value={i.price} symbol={false} />
                  </td>
                  <td className="py-2 text-right">
                    <Money value={i.amount} symbol={false} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="mt-3 ml-auto w-full max-w-xs space-y-1 text-sm">
          {b.gstPercent ? (
            <>
              <div className="flex justify-between">
                <dt>{t("view.subtotal")}</dt>
                <dd>
                  <Money value={b.subtotal} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>{t("view.gstLine", { pct: b.gstPercent })}</dt>
                <dd>
                  <Money value={b.gstAmount} />
                </dd>
              </div>
            </>
          ) : null}
          <div className="flex justify-between border-t border-line pt-2 text-lg font-bold print:border-black">
            <dt>{t("common.total")}</dt>
            <dd>
              <Money value={b.total} />
            </dd>
          </div>
        </dl>

        <p className="mt-3 text-sm">
          <span className="text-muted print:text-black">{t("view.words")}: </span>
          {amountInWords(b.total)}
        </p>

        {hasBank && s ? (
          <section className="mt-6 border-t border-line pt-3 text-sm print:border-black">
            <h2 className="mb-1 text-xs font-semibold text-muted print:text-black">{t("view.bank")}</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
              {s.bankName ? (
                <>
                  <dt className="text-muted print:text-black">{t("view.bankName")}</dt>
                  <dd>{s.bankName}</dd>
                </>
              ) : null}
              {s.accountNo ? (
                <>
                  <dt className="text-muted print:text-black">{t("view.accountNo")}</dt>
                  <dd className="num">{s.accountNo}</dd>
                </>
              ) : null}
              {s.ifsc ? (
                <>
                  <dt className="text-muted print:text-black">{t("view.ifsc")}</dt>
                  <dd className="num">{s.ifsc}</dd>
                </>
              ) : null}
              {s.upiId ? (
                <>
                  <dt className="text-muted print:text-black">{t("view.upi")}</dt>
                  <dd className="num">{s.upiId}</dd>
                </>
              ) : null}
            </dl>
          </section>
        ) : null}

        <p className="mt-6 text-center text-sm text-muted print:text-black">{t("view.thanks")}</p>
      </article>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent title={t("view.cancelTitle")} description={t("view.cancelText")}>
          <div className="flex justify-end gap-2">
            <Button size="lg" onClick={() => setConfirming(false)}>
              {t("view.cancelNo")}
            </Button>
            <Button variant="danger" size="lg" disabled={cancel.isPending} onClick={() => cancel.mutate(id)}>
              {t("view.cancelYes")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
