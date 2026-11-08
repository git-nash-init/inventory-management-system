import type { Metadata } from "next";
import { LegalPage, Sec } from "@/components/layout/legal";

export const metadata: Metadata = { title: "Help" };

export default function Help() {
  return (
    <LegalPage title="Help" updated="8 November 2026">
      <Sec title="Getting started">
        <ul>
          <li>Open Settings, Business and fill in your name, GSTIN, state, address, bank and UPI details. The state decides CGST and SGST versus IGST.</li>
          <li>Add products with their HSN code and GST rate. Opening stock goes in when you create the product.</li>
          <li>Add customers and suppliers. Choose the right state so tax splits correctly.</li>
          <li>Record purchases as bills so stock goes up, then create sales invoices so stock goes down.</li>
        </ul>
      </Sec>
      <Sec title="Keyboard">
        <ul>
          <li>Ctrl K (Cmd K on Mac) opens search for products, customers, documents and pages.</li>
          <li>On the quick bill screen, scan a barcode or type a SKU and press Enter to add it.</li>
        </ul>
      </Sec>
      <Sec title="Common questions">
        <p><strong>Why can I not sell more than I have?</strong> The invoice checks stock in the chosen warehouse. Record the purchase, or use Inventory, Adjustments to correct a count.</p>
        <p><strong>Why can I not cancel an invoice?</strong> An invoice with payments cannot be cancelled. Issue a credit note and, if needed, refund the payment.</p>
        <p><strong>Where is my GST summary?</strong> Accounting, Reports shows GSTR-1 and GSTR-3B summaries for the financial year you picked at the top.</p>
        <p><strong>I am offline.</strong> You can read lists you opened before and keep drafting. Drafts are saved on this device. Saving to the server needs a connection.</p>
      </Sec>
      <Sec title="Contact">
        <p>Write to support@example.com with what you were doing and the reference shown on any error message.</p>
      </Sec>
    </LegalPage>
  );
}
