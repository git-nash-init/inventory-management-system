import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-xl font-semibold">Page not found / Page nahi mila</h1>
      <p className="mt-2 text-sm text-muted">The address may be mistyped. / Address galat likha ho sakta hai.</p>
      <Link href="/dashboard" className="link mt-4 inline-block text-base">
        Home
      </Link>
    </main>
  );
}
