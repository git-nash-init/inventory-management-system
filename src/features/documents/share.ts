import { formatINR } from "@/lib/format/money";
import { formatDate } from "@/lib/format/date";
import type { Business, Doc } from "@/domain/types";
import { TYPE_LABEL } from "./config";

/** UPI deep link that opens any UPI app with the amount filled in. */
export function upiLink(biz: Pick<Business, "upiId" | "name">, amount: number, note: string): string | undefined {
  if (!biz.upiId) return undefined;
  const q = new URLSearchParams({ pa: biz.upiId, pn: biz.name, am: amount.toFixed(2), cu: "INR", tn: note });
  return `upi://pay?${q.toString()}`;
}

/** wa.me link with a ready message. Opens WhatsApp on the customer's number. */
export function whatsappLink(doc: Doc, biz: Business, phone: string): string {
  const due = Math.max(0, doc.totals.grandTotal - doc.paid);
  const lines = [
    `${TYPE_LABEL[doc.type]} ${doc.number} from ${biz.name}`,
    `Date: ${formatDate(doc.date)}`,
    `Amount: ${formatINR(doc.totals.grandTotal)}`,
    due > 0 && doc.dueDate ? `Please pay ${formatINR(due)} by ${formatDate(doc.dueDate)}.` : undefined,
    due > 0 ? upiLink(biz, due, doc.number) : undefined,
    "Thank you.",
  ].filter(Boolean);
  const num = phone.replace(/\D/g, "");
  return `https://wa.me/${num.length === 10 ? "91" + num : num}?text=${encodeURIComponent(lines.join("\n"))}`;
}

export function reminderLink(partyName: string, phone: string, due: number, biz: Business): string {
  const text = `Hello ${partyName}, this is a reminder from ${biz.name}. ${formatINR(due)} is pending. ${biz.upiId ? `You can pay by UPI to ${biz.upiId}. ` : ""}Please ignore if already paid. Thank you.`;
  const num = phone.replace(/\D/g, "");
  return `https://wa.me/${num.length === 10 ? "91" + num : num}?text=${encodeURIComponent(text)}`;
}
