import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center border-b border-line bg-surface px-4 md:px-8">
        <Link href="/" className="text-sm font-semibold">
          Khata Books
        </Link>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">{children}</main>
      <footer className="border-t border-line px-4 py-4 text-center text-xs text-muted">
        <Link href="/terms" className="link">Terms of Service</Link>
        {" · "}
        <Link href="/privacy" className="link">Privacy Policy</Link>
      </footer>
    </div>
  );
}
