"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f6f5f1", color: "#1c1b19", padding: "4rem 1.5rem" }}>
        <div role="alert" style={{ maxWidth: 480, margin: "0 auto" }}>
          <h1 style={{ fontSize: 20 }}>Something went wrong on our side</h1>
          <p>The app hit an unexpected error. This is not caused by anything you did. Try again; if it keeps happening, contact support.</p>
          {error.digest ? <p style={{ fontFamily: "monospace", fontSize: 12 }}>Reference: {error.digest}</p> : null}
          <button onClick={reset} style={{ padding: "8px 14px", border: "1px solid #0f5c55", background: "#0f5c55", color: "#f6f5f1", borderRadius: 3 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
