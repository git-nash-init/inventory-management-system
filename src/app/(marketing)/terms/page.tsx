import type { Metadata } from "next";
import { LegalPage, Sec } from "@/components/layout/legal";

export const metadata: Metadata = { title: "Terms of Service" };

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="8 November 2026">
      <p>
        These terms govern your use of Khata Books, a web application for inventory, sales, purchases, GST invoicing and accounting. By creating an account or using the service you agree to them. If you use the service for a business, you confirm you can bind that business.
      </p>
      <Sec title="1. The service">
        <p>Khata Books helps you record stock, issue invoices, track payments and prepare books and GST summaries. It is a record keeping and calculation tool. It does not file returns, submit e-invoices or generate e-way bills unless a feature says so.</p>
      </Sec>
      <Sec title="2. Your account">
        <ul>
          <li>You must give accurate information and keep your password confidential.</li>
          <li>The person who creates a business is its owner and decides who else has access and with which role.</li>
          <li>You are responsible for activity under your account and for turning on two-factor authentication for owners and accountants.</li>
        </ul>
      </Sec>
      <Sec title="3. Your data">
        <p>You own the business data you enter, including products, parties, invoices and ledgers. You give us permission to store and process it only to provide the service. You can export your data at any time and ask us to delete it as described in the Privacy Policy.</p>
      </Sec>
      <Sec title="4. Tax and accounting responsibility">
        <p>Tax rates, HSN codes, place of supply and report formats are set by you and by law, and the law changes. You are responsible for checking invoices, returns and books with your chartered accountant before you file or rely on them. We do not give tax, legal or accounting advice.</p>
      </Sec>
      <Sec title="5. Acceptable use">
        <ul>
          <li>Do not attempt to access another business&apos;s data, probe or disrupt the service, or bypass limits.</li>
          <li>Do not upload malware or content you have no right to upload.</li>
          <li>Do not use the service for unlawful activity, including issuing false invoices.</li>
        </ul>
      </Sec>
      <Sec title="6. Availability and backups">
        <p>We work to keep the service available and to back up data, but we do not promise uninterrupted service. Keep your own periodic exports of important records.</p>
      </Sec>
      <Sec title="7. Fees">
        <p>Any fees will be shown clearly before you are charged. Changes to fees apply after notice to the account owner.</p>
      </Sec>
      <Sec title="8. Suspension and ending">
        <p>You may stop using the service and close your account at any time. We may suspend an account that breaks these terms or puts others at risk, and we will tell the owner why where the law allows.</p>
      </Sec>
      <Sec title="9. Liability">
        <p>To the extent the law allows, the service is provided as is, and our total liability for any claim is limited to the fees you paid in the three months before the claim. We are not liable for indirect or consequential loss, or for loss caused by incorrect data entered by users.</p>
      </Sec>
      <Sec title="10. Governing law">
        <p>These terms are governed by the laws of India. Courts at the location of our registered office have jurisdiction, subject to any mandatory consumer rights.</p>
      </Sec>
      <Sec title="11. Changes and contact">
        <p>We may update these terms and will tell the account owner of material changes. Questions go to support@example.com.</p>
      </Sec>
      <p className="text-xs text-muted">
        This text is a starting template for a software service. Have a lawyer review it and replace the contact details and governing court before you launch.
      </p>
    </LegalPage>
  );
}
