"use client";

import * as React from "react";
import QRCode from "qrcode";
import { formatAmount, formatQty } from "@/lib/format/money";
import { formatDate } from "@/lib/format/date";
import type { InvoiceModel } from "./invoice-model";

export function UpiQr({ link, size = 96 }: { link: string; size?: number }) {
  const [src, setSrc] = React.useState<string>();
  React.useEffect(() => {
    let alive = true;
    QRCode.toDataURL(link, { margin: 1, width: size * 2 }).then((u) => alive && setSrc(u)).catch(() => alive && setSrc(undefined));
    return () => {
      alive = false;
    };
  }, [link, size]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="UPI QR code with the amount due" width={size} height={size} /> : <div style={{ width: size, height: size }} aria-hidden />;
}

const PAGE: Record<string, { css: string; width: string; font: string }> = {
  a4: { css: "A4", width: "210mm", font: "11px" },
  a5: { css: "A5", width: "148mm", font: "9.5px" },
  thermal: { css: "80mm auto", width: "80mm", font: "10px" },
};

/** Paper invoice. Always black on white so it prints correctly in dark mode. */
export function InvoiceView({ m, template }: { m: InvoiceModel; template: "a4" | "a5" | "thermal" }) {
  const { doc, biz, party } = m;
  const page = PAGE[template];
  const thermal = template === "thermal";
  const cell = "border border-black/30 px-1.5 py-1";
  return (
    <div className="invoice-sheet bg-white text-black" style={{ width: page.width, maxWidth: "100%", fontSize: page.font, lineHeight: 1.35 }}>
      <style>{`@media print { @page { size: ${page.css}; margin: ${thermal ? "3mm" : "8mm"}; } body * { visibility: hidden; } .invoice-sheet, .invoice-sheet * { visibility: visible; } .invoice-sheet { position: absolute; left: 0; top: 0; } }`}</style>
      <div className="p-3">
        <div className="flex items-start justify-between gap-3 border-b border-black/40 pb-2">
          <div className="flex items-start gap-2">
            {biz.logoDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={biz.logoDataUrl} alt="" width={thermal ? 36 : 56} height={thermal ? 36 : 56} style={{ objectFit: "contain" }} />
            ) : null}
            <div>
              <div className="text-[1.5em] font-semibold">{biz.name}</div>
              <div>{[biz.address, biz.city, biz.pincode].filter(Boolean).join(", ")}</div>
              {biz.gstin ? <div>GSTIN: <span className="num">{biz.gstin}</span></div> : null}
              {biz.phone ? <div>Phone: {biz.phone}</div> : null}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[1.4em] font-semibold uppercase">{m.title}</div>
            <div className="num">{doc.number}</div>
            {doc.status === "cancelled" ? <div className="font-semibold">CANCELLED</div> : null}
          </div>
        </div>

        <div className={`mt-2 grid gap-2 ${thermal ? "" : "grid-cols-2"}`}>
          <div>
            <div className="text-[0.9em] uppercase opacity-70">Bill to</div>
            <div className="font-semibold">{doc.partyName}</div>
            {party?.address ? <div>{party.address}</div> : null}
            {doc.partyGstin ? <div>GSTIN: <span className="num">{doc.partyGstin}</span></div> : null}
            <div>Place of supply: {m.placeName}</div>
          </div>
          <div className={thermal ? "" : "text-right"}>
            <div>Date: <span className="num">{formatDate(doc.date)}</span></div>
            {doc.dueDate ? <div>Due: <span className="num">{formatDate(doc.dueDate)}</span></div> : null}
            <div>Reverse charge: {doc.reverseCharge ? "Yes" : "No"}</div>
            {doc.supplierInvoiceNo ? <div>Supplier invoice: <span className="num">{doc.supplierInvoiceNo}</span></div> : null}
            {doc.ewayBillNo ? <div>E-way bill: <span className="num">{doc.ewayBillNo}</span></div> : null}
          </div>
        </div>

        <table className="mt-2 w-full border-collapse" style={{ fontSize: "inherit" }}>
          <thead>
            <tr className="bg-black/5 text-left">
              <th className={cell}>#</th><th className={cell}>Item</th>{thermal ? null : <th className={cell}>HSN</th>}
              <th className={`${cell} text-right`}>Qty</th><th className={`${cell} text-right`}>Rate</th>
              {thermal ? null : <th className={`${cell} text-right`}>Taxable</th>}
              {m.isTax && !thermal ? <th className={`${cell} text-right`}>GST</th> : null}
              <th className={`${cell} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {m.lines.map((l) => (
              <tr key={l.no} className="align-top">
                <td className={cell}>{l.no}</td>
                <td className={cell}>{l.name}</td>
                {thermal ? null : <td className={`${cell} num`}>{l.hsn}</td>}
                <td className={`${cell} num text-right`}>{formatQty(l.qty)} {l.unit}</td>
                <td className={`${cell} num text-right`}>{formatAmount(l.rate)}</td>
                {thermal ? null : <td className={`${cell} num text-right`}>{formatAmount(l.taxable)}</td>}
                {m.isTax && !thermal ? <td className={`${cell} num text-right`}>{formatAmount(l.tax)} ({l.gstRate}%)</td> : null}
                <td className={`${cell} num text-right`}>{formatAmount(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={`mt-2 grid gap-3 ${thermal ? "" : "grid-cols-[1fr_auto]"}`}>
          <div>
            {m.isTax && !thermal ? (
              <table className="w-full border-collapse" style={{ fontSize: "0.9em" }}>
                <thead>
                  <tr className="bg-black/5 text-left"><th className={cell}>HSN</th><th className={`${cell} text-right`}>Taxable</th><th className={`${cell} text-right`}>Rate</th>{m.intra ? <><th className={`${cell} text-right`}>CGST</th><th className={`${cell} text-right`}>SGST</th></> : <th className={`${cell} text-right`}>IGST</th>}</tr>
                </thead>
                <tbody>
                  {m.hsn.map((h) => (
                    <tr key={h.hsn + h.gstRate}>
                      <td className={`${cell} num`}>{h.hsn || "-"}</td><td className={`${cell} num text-right`}>{formatAmount(h.taxable)}</td><td className={`${cell} num text-right`}>{h.gstRate}%</td>
                      {m.intra ? <><td className={`${cell} num text-right`}>{formatAmount(h.cgst)}</td><td className={`${cell} num text-right`}>{formatAmount(h.sgst)}</td></> : <td className={`${cell} num text-right`}>{formatAmount(h.igst)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
            <div className="mt-2 font-semibold">{m.words}</div>
          </div>
          <dl className="min-w-[45%] space-y-0.5">
            <div className="flex justify-between gap-6"><dt>Taxable value</dt><dd className="num">{formatAmount(doc.totals.taxable)}</dd></div>
            {m.isTax && m.intra ? <><div className="flex justify-between gap-6"><dt>CGST</dt><dd className="num">{formatAmount(doc.totals.cgst)}</dd></div><div className="flex justify-between gap-6"><dt>SGST</dt><dd className="num">{formatAmount(doc.totals.sgst)}</dd></div></> : null}
            {m.isTax && !m.intra ? <div className="flex justify-between gap-6"><dt>IGST</dt><dd className="num">{formatAmount(doc.totals.igst)}</dd></div> : null}
            {doc.totals.cess ? <div className="flex justify-between gap-6"><dt>Cess</dt><dd className="num">{formatAmount(doc.totals.cess)}</dd></div> : null}
            {doc.totals.tcs ? <div className="flex justify-between gap-6"><dt>TCS</dt><dd className="num">{formatAmount(doc.totals.tcs)}</dd></div> : null}
            <div className="flex justify-between gap-6"><dt>Round off</dt><dd className="num">{formatAmount(doc.totals.roundOff)}</dd></div>
            <div className="flex justify-between gap-6 border-t border-black/40 pt-1 text-[1.15em] font-semibold"><dt>Total</dt><dd className="num">₹{formatAmount(doc.totals.grandTotal)}</dd></div>
            {doc.paid > 0 ? <div className="flex justify-between gap-6"><dt>Paid</dt><dd className="num">{formatAmount(doc.paid)}</dd></div> : null}
            {m.due > 0 && doc.paid > 0 ? <div className="flex justify-between gap-6 font-semibold"><dt>Balance due</dt><dd className="num">₹{formatAmount(m.due)}</dd></div> : null}
          </dl>
        </div>

        <div className="mt-3 flex items-start justify-between gap-3 border-t border-black/30 pt-2">
          <div className="max-w-[60%]">
            {biz.bankAccount ? <div><strong>Bank:</strong> {biz.bankName}, A/c <span className="num">{biz.bankAccount}</span>, IFSC <span className="num">{biz.ifsc}</span></div> : null}
            {biz.upiId ? <div><strong>UPI:</strong> <span className="num">{biz.upiId}</span></div> : null}
            {doc.einvoice.irn ? <div className="mt-1"><strong>IRN:</strong> <span className="num break-all">{doc.einvoice.irn}</span><br />Ack no. {doc.einvoice.ackNo} dated {doc.einvoice.ackDate}</div> : null}
            {doc.terms ? <div className="mt-1 opacity-80"><strong>Terms:</strong> {doc.terms}</div> : null}
            {doc.notes ? <div className="mt-1">{doc.notes}</div> : null}
          </div>
          <div className="text-center">
            {m.upi ? <><UpiQr link={m.upi} size={thermal ? 72 : 88} /><div className="text-[0.85em]">Scan to pay</div></> : null}
          </div>
        </div>
        <div className="mt-3 flex justify-end text-center">
          <div>
            {biz.signatureDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={biz.signatureDataUrl} alt="Authorised signature" height={36} style={{ maxHeight: 36, margin: "0 auto" }} />
            ) : <div style={{ height: 28 }} />}
            <div className="border-t border-black/40 pt-0.5">For {biz.name}</div>
            <div className="text-[0.85em] opacity-70">Authorised signatory</div>
          </div>
        </div>
      </div>
    </div>
  );
}
