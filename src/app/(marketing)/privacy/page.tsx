import type { Metadata } from "next";
import { LegalPage, Sec } from "@/components/layout/legal";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="8 November 2026">
      <p>
        This policy explains what personal data Khata Books processes, why, and the rights you have under the Digital Personal Data Protection Act, 2023 (DPDP Act). For the account holder&apos;s own details we act as the Data Fiduciary. For customer and supplier details a business enters, the business is the Data Fiduciary and we process that data on its behalf.
      </p>
      <Sec title="1. What we collect">
        <ul>
          <li>Account data: name, email address, and a password stored only as a salted hash by our authentication provider.</li>
          <li>Business data you enter: business details, GSTIN, PAN, bank and UPI details, products, customers and suppliers (names, phone, email, address, GSTIN), invoices, payments and ledgers.</li>
          <li>Files you upload: product images, scanned bills, logos and signatures.</li>
          <li>Technical data: IP address and device details in security logs, used to prevent abuse. We redact tokens and personal data from application logs.</li>
        </ul>
      </Sec>
      <Sec title="2. Why we use it">
        <ul>
          <li>To provide the service you asked for: storing records, generating invoices and reports, and showing them to your team.</li>
          <li>To keep the service secure, prevent fraud and meet legal obligations.</li>
          <li>To contact you about your account, security and important changes.</li>
        </ul>
        <p>We do not sell personal data and we do not use your business data for advertising.</p>
      </Sec>
      <Sec title="3. Consent and notice">
        <p>We ask for your consent at sign up for the account data we need. Businesses are responsible for having a lawful basis, such as the customer&apos;s consent or a legitimate use permitted by the Act, for the customer and supplier details they enter. You can withdraw consent by closing your account, which may limit what we can provide.</p>
      </Sec>
      <Sec title="4. Where data is stored and who can see it">
        <p>Data is stored with Supabase, our database and authentication provider, and delivered through our hosting provider. Each business can read only its own records, enforced by row level security in the database. Within a business, your owner decides who has access and with which role. Access by our staff is limited to what is needed for support and security.</p>
      </Sec>
      <Sec title="5. How long we keep it">
        <p>We keep data while your account is active. Indian law requires businesses to keep books and invoices for several years, so we keep accounting records until the owner deletes them, and we advise owners to check retention duties before deleting. After account closure we delete or anonymise data within 90 days, except what the law requires us to retain.</p>
      </Sec>
      <Sec title="6. Your rights">
        <p>Under the DPDP Act you may:</p>
        <ul>
          <li>ask for a summary of the personal data we process about you and who it is shared with;</li>
          <li>ask us to correct, complete or update data;</li>
          <li>ask us to erase data that is no longer needed;</li>
          <li>nominate someone to exercise your rights if you die or cannot act;</li>
          <li>make a complaint to our grievance officer, and then to the Data Protection Board of India.</li>
        </ul>
        <p>Write to the contact below. We aim to reply within 30 days.</p>
      </Sec>
      <Sec title="7. Security">
        <p>We use encrypted connections, row level security, role based access, optional two-factor authentication, rate limiting and an activity log. No system is perfectly secure. If a personal data breach affects you we will tell you and the Data Protection Board as the law requires.</p>
      </Sec>
      <Sec title="8. Children">
        <p>The service is for businesses and is not directed at anyone under 18. Do not enter personal data of children without a verifiable parent or guardian&apos;s consent.</p>
      </Sec>
      <Sec title="9. Cookies and local storage">
        <p>We use cookies only to keep you signed in. Your browser may also keep a cache of recently viewed lists and unsent drafts so the app keeps working offline. Signing out clears the cache.</p>
      </Sec>
      <Sec title="10. Grievance officer and contact">
        <p>Grievance officer: the account of the service operator, reachable at support@example.com. Replace this with the named officer and postal address before launch.</p>
      </Sec>
      <p className="text-xs text-muted">
        This text is a starting template. Have a lawyer review it against your actual data flows and fill in the operator&apos;s legal name, address and grievance officer before you launch.
      </p>
    </LegalPage>
  );
}
