import * as React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatAmount, formatQty } from "@/lib/format/money";
import { formatDate } from "@/lib/format/date";
import type { InvoiceModel } from "./invoice-model";

// The built-in PDF fonts have no rupee glyph, so amounts are prefixed "Rs." in PDF files.
const s = StyleSheet.create({
  page: { padding: 28, fontSize: 9, fontFamily: "Helvetica", color: "#000" },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between" },
  h1: { fontSize: 15, fontFamily: "Helvetica-Bold" },
  bold: { fontFamily: "Helvetica-Bold" },
  title: { fontSize: 13, fontFamily: "Helvetica-Bold", textTransform: "uppercase", textAlign: "right" },
  th: { backgroundColor: "#eeeeee", padding: 3, fontFamily: "Helvetica-Bold", borderWidth: 0.5, borderColor: "#999" },
  td: { padding: 3, borderWidth: 0.5, borderColor: "#999" },
  right: { textAlign: "right" },
  muted: { color: "#555" },
});

const W = { no: 18, item: 190, hsn: 46, qty: 52, rate: 56, taxable: 62, gst: 62, amount: 66 };

export function InvoicePdf({ m, size }: { m: InvoiceModel; size: "A4" | "A5" | [number, number] }) {
  const { doc, biz } = m;
  const cols = m.isTax ? ["no", "item", "hsn", "qty", "rate", "taxable", "gst", "amount"] : ["no", "item", "hsn", "qty", "rate", "taxable", "amount"];
  const cell = (key: string, children: React.ReactNode, head = false, right = false) => (
    <Text key={key} style={[head ? s.th : s.td, right ? s.right : {}, { width: W[key as keyof typeof W] }]}>{children}</Text>
  );
  return (
    <Document title={`${m.title} ${doc.number}`} author={biz.name}>
      <Page size={size} style={s.page}>
        <View style={s.between}>
          <View>
            <Text style={s.h1}>{biz.name}</Text>
            <Text>{[biz.address, biz.city, biz.pincode].filter(Boolean).join(", ")}</Text>
            {biz.gstin ? <Text>GSTIN: {biz.gstin}</Text> : null}
            {biz.phone ? <Text>Phone: {biz.phone}</Text> : null}
          </View>
          <View>
            <Text style={s.title}>{m.title}</Text>
            <Text style={s.right}>{doc.number}</Text>
            <Text style={s.right}>Date: {formatDate(doc.date)}</Text>
            {doc.dueDate ? <Text style={s.right}>Due: {formatDate(doc.dueDate)}</Text> : null}
          </View>
        </View>
        <View style={{ marginTop: 10 }}>
          <Text style={[s.muted, { fontSize: 8 }]}>BILL TO</Text>
          <Text style={s.bold}>{doc.partyName}</Text>
          {m.party?.address ? <Text>{m.party.address}</Text> : null}
          {doc.partyGstin ? <Text>GSTIN: {doc.partyGstin}</Text> : null}
          <Text>Place of supply: {m.placeName}</Text>
          <Text>Reverse charge: {doc.reverseCharge ? "Yes" : "No"}</Text>
        </View>
        <View style={{ marginTop: 10 }}>
          <View style={s.row}>
            {cols.map((c) => cell(c, { no: "#", item: "Item", hsn: "HSN", qty: "Qty", rate: "Rate", taxable: "Taxable", gst: "GST", amount: "Amount" }[c], true, !["no", "item", "hsn"].includes(c)))}
          </View>
          {m.lines.map((l) => (
            <View key={l.no} style={s.row} wrap={false}>
              {cols.map((c) =>
                cell(
                  c,
                  {
                    no: String(l.no), item: l.name, hsn: l.hsn, qty: `${formatQty(l.qty)} ${l.unit}`, rate: formatAmount(l.rate), taxable: formatAmount(l.taxable),
                    gst: `${formatAmount(l.tax)} (${l.gstRate}%)`, amount: formatAmount(l.total),
                  }[c],
                  false,
                  !["no", "item", "hsn"].includes(c),
                ),
              )}
            </View>
          ))}
        </View>
        <View style={[s.between, { marginTop: 10 }]} wrap={false}>
          <View style={{ width: "55%" }}>
            <Text style={s.bold}>{m.words}</Text>
            {biz.bankAccount ? <Text style={{ marginTop: 6 }}>Bank: {biz.bankName}, A/c {biz.bankAccount}, IFSC {biz.ifsc}</Text> : null}
            {biz.upiId ? <Text>UPI: {biz.upiId}</Text> : null}
            {doc.einvoice.irn ? <Text style={{ marginTop: 4 }}>IRN: {doc.einvoice.irn}</Text> : null}
            {doc.terms ? <Text style={[s.muted, { marginTop: 6 }]}>Terms: {doc.terms}</Text> : null}
          </View>
          <View style={{ width: "40%" }}>
            {[
              ["Taxable value", doc.totals.taxable],
              ...(m.isTax && m.intra ? [["CGST", doc.totals.cgst], ["SGST", doc.totals.sgst]] : []),
              ...(m.isTax && !m.intra ? [["IGST", doc.totals.igst]] : []),
              ...(doc.totals.cess ? [["Cess", doc.totals.cess]] : []),
              ...(doc.totals.tcs ? [["TCS", doc.totals.tcs]] : []),
              ["Round off", doc.totals.roundOff],
            ].map(([k, v]) => (
              <View key={String(k)} style={s.between}><Text>{k}</Text><Text>{formatAmount(Number(v))}</Text></View>
            ))}
            <View style={[s.between, { borderTopWidth: 0.5, marginTop: 3, paddingTop: 3 }]}>
              <Text style={s.bold}>Total</Text><Text style={s.bold}>Rs. {formatAmount(doc.totals.grandTotal)}</Text>
            </View>
            {doc.paid > 0 ? <View style={s.between}><Text>Paid</Text><Text>{formatAmount(doc.paid)}</Text></View> : null}
            {m.due > 0 && doc.paid > 0 ? <View style={s.between}><Text style={s.bold}>Balance due</Text><Text style={s.bold}>Rs. {formatAmount(m.due)}</Text></View> : null}
          </View>
        </View>
        <View style={{ marginTop: 30, alignItems: "flex-end" }}>
          <Text>For {biz.name}</Text>
          <Text style={[s.muted, { fontSize: 8 }]}>Authorised signatory</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function downloadInvoicePdf(m: InvoiceModel, template: "a4" | "a5" | "thermal") {
  const { pdf } = await import("@react-pdf/renderer");
  const size: "A4" | "A5" | [number, number] = template === "a4" ? "A4" : template === "a5" ? "A5" : [227, Math.max(400, 180 + m.lines.length * 28)];
  const blob = await pdf(<InvoicePdf m={m} size={size} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${m.doc.number.replace(/[^\w-]+/g, "-")}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
