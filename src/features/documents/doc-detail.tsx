"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Money } from "@/components/ui/amount";
import { Panel, PanelHeader, Skeleton } from "@/components/ui/surface";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/states/error-state";
import { getRepo } from "@/data";
import { errorMessage, useBusiness, useDoc, useParties, usePayments, useRepoMutation } from "@/data/hooks";
import { convertTargets, isInvoiceLike, outstanding, payStatus } from "@/domain/engine";
import { useAuth } from "@/lib/auth/context";
import { useFy } from "@/lib/fy";
import { formatDate } from "@/lib/format/date";
import { TYPE_LABEL, basePath, docHref, routeForDoc } from "./config";
import { buildInvoiceModel } from "./invoice-model";
import { InvoiceView } from "./invoice-view";
import { downloadInvoicePdf } from "./invoice-pdf";
import { whatsappLink } from "./share";

export function DocDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const fy = useFy();
  const docQ = useDoc(id);
  const business = useBusiness();
  const parties = useParties();
  const payments = usePayments();
  const [template, setTemplate] = React.useState<"a4" | "a5" | "thermal" | undefined>();
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const [einv, setEinv] = React.useState(false);
  const [busyPdf, setBusyPdf] = React.useState(false);
  const cancel = useRepoMutation((docId: string) => getRepo().docs.cancel(docId));
  const convert = useRepoMutation((a: { id: string; to: string }) => getRepo().docs.convert(a.id, a.to));
  const setE = useRepoMutation((a: { id: string; irn?: string; ackNo?: string; ackDate?: string; ewayBillNo?: string }) => getRepo().docs.setEinvoice(a.id, a));

  if (docQ.isPending || business.isPending) return <div aria-busy="true"><Skeleton className="mb-3 h-8 w-64" /><Skeleton className="h-[480px] w-full" /></div>;
  if (docQ.error) return <ErrorState what="This document could not be loaded" blame="network" onRetry={() => void docQ.refetch()} />;
  const doc = docQ.data;
  if (!doc || !business.data) return <ErrorState what="This document does not exist" blame="input" detail="It may have been deleted, or the link is wrong." />;

  const route = routeForDoc(doc.kind, doc.type)!;
  const party = parties.data?.find((p) => p.id === doc.partyId);
  const m = buildInvoiceModel(doc, business.data, party);
  const tpl = template ?? business.data.invoiceTemplate;
  const status = payStatus(doc, fy.today);
  const mod = doc.kind === "sales" ? "sales" : "purchases";
  const due = isInvoiceLike(doc.kind, doc.type) && doc.status === "final" ? outstanding(doc) : 0;
  const targets = doc.status === "final" ? convertTargets(doc.kind, doc.type) : [];
  const myPayments = (payments.data ?? []).filter((p) => p.allocations.some((a) => a.docId === doc.id));
  const canReturn = doc.status === "final" && ((doc.kind === "sales" && ["invoice", "bill_of_supply"].includes(doc.type)) || (doc.kind === "purchase" && doc.type === "bill"));
  const wa = party?.phone && doc.status !== "draft" ? whatsappLink(doc, business.data, party.phone) : undefined;

  async function doConvert(to: string) {
    try {
      const created = await convert.mutateAsync({ id: doc!.id, to });
      toast.success(`${TYPE_LABEL[to]} ${created.number} created`);
      router.push(docHref(created.kind, created.type, created.id));
    } catch (e) {
      toast.error(errorMessage(e).message);
    }
  }

  async function doCancel() {
    try {
      await cancel.mutateAsync(doc!.id);
      toast.success(`${doc!.number} cancelled`);
      setConfirmCancel(false);
    } catch (e) {
      toast.error(errorMessage(e).message);
      setConfirmCancel(false);
    }
  }

  async function pdf() {
    setBusyPdf(true);
    try {
      await downloadInvoicePdf(m, tpl);
    } catch {
      toast.error("The PDF could not be created. Use Print and choose Save as PDF instead.");
    } finally {
      setBusyPdf(false);
    }
  }

  return (
    <>
      <div className="no-print">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted"><Link className="link" href={`${basePath(doc.kind)}/${route.segment}`}>{route.title}</Link></p>
            <h1 className="num text-xl font-semibold">{doc.number} <StatusBadge status={status} /></h1>
            <p className="text-sm text-muted">{TYPE_LABEL[doc.type]} · {doc.partyName} · {formatDate(doc.date)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {doc.status === "draft" && can(mod, "create") ? <Link href={`${basePath(doc.kind)}/${route.segment}/new?draft=${doc.id}`} className="inline-flex h-9 items-center rounded border border-accent bg-accent px-3.5 text-sm font-medium text-accent-ink hover:bg-ink hover:border-ink">Continue editing</Link> : null}
            {doc.status !== "draft" ? <Button onClick={() => window.print()}>Print</Button> : null}
            {doc.status !== "draft" ? <Button onClick={() => void pdf()} disabled={busyPdf}>{busyPdf ? "Preparing" : "Download PDF"}</Button> : null}
            {wa ? <Button onClick={() => window.open(wa, "_blank", "noopener,noreferrer")}>Share on WhatsApp</Button> : null}
            {due > 0 && can(mod, "create") ? <Link href={`${basePath(doc.kind)}/payments?new=1&party=${doc.partyId}&doc=${doc.id}`} className="inline-flex h-9 items-center rounded border border-accent bg-accent px-3.5 text-sm font-medium text-accent-ink hover:bg-ink hover:border-ink">Record payment</Link> : null}
            {targets.map((t) => can(mod, "create") ? <Button key={t} onClick={() => void doConvert(t)} disabled={convert.isPending}>Convert to {TYPE_LABEL[t].toLowerCase()}</Button> : null)}
            {canReturn && can(mod, "create") ? <Link href={`${basePath(doc.kind)}/returns/new?from=${doc.id}`} className="inline-flex h-9 items-center rounded border border-line bg-surface px-3.5 text-sm font-medium hover:bg-surface-2">{doc.kind === "sales" ? "Create credit note" : "Create debit note"}</Link> : null}
            {["draft", "final"].includes(doc.status) && can(mod, "delete") ? <Button variant="danger" onClick={() => setConfirmCancel(true)}>{doc.status === "draft" ? "Discard" : "Cancel"}</Button> : null}
          </div>
        </div>

        <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_20rem]">
          <Panel className="p-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
              <div><dt className="text-xs text-muted">Total</dt><dd className="text-lg font-semibold"><Money value={doc.totals.grandTotal} /></dd></div>
              <div><dt className="text-xs text-muted">Paid</dt><dd className="text-lg"><Money value={doc.paid} /></dd></div>
              <div><dt className="text-xs text-muted">Balance</dt><dd className="text-lg"><Money value={due} /></dd></div>
              <div><dt className="text-xs text-muted">Due on</dt><dd className="num text-lg">{doc.dueDate ? formatDate(doc.dueDate) : "-"}</dd></div>
            </dl>
            {doc.attachmentDataUrl ? <p className="mt-3"><a className="link" href={doc.attachmentDataUrl} download={doc.attachmentName}>Download scanned bill ({doc.attachmentName})</a></p> : null}
            {doc.refDocId ? <p className="mt-2 text-xs text-muted">Created from <Link className="link" href={docHref(doc.kind, doc.type, doc.refDocId)}>an earlier document</Link>.</p> : null}
          </Panel>
          <Panel className="p-4 text-sm">
            <label className="text-xs text-muted" htmlFor="tpl">Print format</label>
            <NativeSelect id="tpl" value={tpl} onChange={(e) => setTemplate(e.target.value as "a4" | "a5" | "thermal")} className="mt-1">
              <option value="a4">A4</option><option value="a5">A5</option><option value="thermal">80 mm thermal receipt</option>
            </NativeSelect>
            {doc.kind === "sales" && doc.status === "final" && can("sales", "edit") ? <button className="link mt-3 text-xs" onClick={() => setEinv(true)}>E-invoice and e-way bill details</button> : null}
          </Panel>
        </div>

        {myPayments.length ? (
          <Panel className="mb-4">
            <PanelHeader title="Payments" />
            <table className="w-full text-sm"><tbody>
              {myPayments.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0"><td className="num px-4 py-2">{p.number}</td><td className="num px-4 py-2">{formatDate(p.date)}</td><td className="px-4 py-2">{p.mode}</td><td className="px-4 py-2 text-right"><Money value={p.allocations.find((a) => a.docId === doc.id)?.amount ?? 0} /></td></tr>
              ))}
            </tbody></table>
          </Panel>
        ) : null}
      </div>

      <div className="overflow-x-auto border border-line bg-white p-0 print:border-0">
        <InvoiceView m={m} template={tpl} />
      </div>

      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent title={doc.status === "draft" ? `Discard this draft?` : `Cancel ${doc.number}?`} description={doc.status === "draft" ? "The draft will be marked cancelled." : "Stock and ledger entries are reversed. The number stays used and the document is kept as cancelled for your records."}>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setConfirmCancel(false)}>Keep it</Button>
            <Button variant="danger" onClick={() => void doCancel()} disabled={cancel.isPending}>{cancel.isPending ? "Working" : "Yes, cancel it"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={einv} onOpenChange={setEinv}>
        <DialogContent title="E-invoice and e-way bill" description="Record the IRN and acknowledgement from the government portal, and the e-way bill number. Direct portal submission needs a GSP and is not connected yet.">
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await setE.mutateAsync({ id: doc.id, irn: String(f.get("irn") || ""), ackNo: String(f.get("ackNo") || ""), ackDate: String(f.get("ackDate") || ""), ewayBillNo: String(f.get("eway") || "") });
                toast.success("Details saved");
                setEinv(false);
              } catch (err) {
                toast.error(errorMessage(err).message);
              }
            }}
          >
            <Field label="IRN (64 characters)" htmlFor="irn"><Input id="irn" name="irn" defaultValue={doc.einvoice.irn} maxLength={64} className="num" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ack number" htmlFor="ackNo"><Input id="ackNo" name="ackNo" defaultValue={doc.einvoice.ackNo} className="num" /></Field>
              <Field label="Ack date" htmlFor="ackDate"><Input id="ackDate" name="ackDate" type="date" defaultValue={doc.einvoice.ackDate} /></Field>
            </div>
            <Field label="E-way bill number" htmlFor="eway"><Input id="eway" name="eway" defaultValue={doc.ewayBillNo} maxLength={12} className="num" /></Field>
            <div className="flex justify-end gap-2"><Button onClick={() => setEinv(false)}>Cancel</Button><Button type="submit" variant="primary">Save</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
