import { describe, expect, it } from "vitest";
import { seedState } from "@/data/demo/seed";
import { buildInvoiceModel } from "./invoice-model";
import { upiLink, whatsappLink } from "./share";

describe("invoice model", () => {
  const s = seedState();
  const inv = s.docs.find((d) => d.kind === "sales" && d.type === "invoice" && d.partyId && d.totals.igst > 0)!;
  const party = s.parties.find((p) => p.id === inv.partyId);

  it("totals reconcile with the document and split tax by supply type", () => {
    const m = buildInvoiceModel(inv, s.business, party);
    expect(m.intra).toBe(false);
    const sum = m.lines.reduce((a, l) => a + l.total, 0);
    expect(Math.abs(sum - (inv.totals.grandTotal - inv.totals.roundOff - inv.totals.tcs))).toBeLessThan(0.05);
    const hsnTotal = m.hsn.reduce((a, h) => a + h.taxable, 0);
    expect(Math.abs(hsnTotal - inv.totals.taxable)).toBeLessThan(0.05);
    expect(m.words.startsWith("Rupees ")).toBe(true);
  });
  it("builds a UPI link only when something is due", () => {
    const m = buildInvoiceModel(inv, s.business, party);
    if (m.due > 0) expect(m.upi).toContain("upi://pay?pa=");
    expect(upiLink({ upiId: "", name: "x" }, 100, "n")).toBeUndefined();
  });
  it("makes a WhatsApp link with an Indian country code", () => {
    const link = whatsappLink(inv, s.business, "9811111111");
    expect(link.startsWith("https://wa.me/919811111111?text=")).toBe(true);
    expect(decodeURIComponent(link)).toContain(inv.number);
  });
});
