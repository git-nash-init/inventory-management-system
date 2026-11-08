import Link from "next/link";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b border-line bg-surface px-4 md:px-8">
        <Link href="/" className="text-sm font-semibold">
          Khata Books
        </Link>
        <nav aria-label="Account" className="flex items-center gap-4 text-sm">
          <Link href="/help" className="text-muted hover:text-ink">Help</Link>
          <Link href="/login" className="text-muted hover:text-ink">Sign in</Link>
          <Link href="/signup" className="inline-flex h-8 items-center rounded border border-accent bg-accent px-3 text-accent-ink hover:bg-ink hover:border-ink">
            Create account
          </Link>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line px-4 py-6 text-sm text-muted md:px-8">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <span>Khata Books. Built for Indian businesses.</span>
          <span className="flex gap-4">
            <Link href="/terms" className="link">Terms of Service</Link>
            <Link href="/privacy" className="link">Privacy Policy</Link>
            <Link href="/help" className="link">Help</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
