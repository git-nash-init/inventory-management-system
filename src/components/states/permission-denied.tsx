import * as React from "react";
import Link from "next/link";
import { Camera, FolderOpen, LockKey } from "@phosphor-icons/react/dist/ssr";

/** State 7a: a browser permission (camera, file access) was denied. Explains why and offers manual entry. */
export function BrowserPermissionDenied({
  kind,
  children,
}: {
  kind: "camera" | "files";
  children?: React.ReactNode; // the manual entry control
}) {
  const camera = kind === "camera";
  return (
    <div role="alert" className="rounded border border-line bg-surface p-4">
      <div className="flex items-start gap-3">
        {camera ? <Camera size={22} className="mt-0.5 text-warn" /> : <FolderOpen size={22} className="mt-0.5 text-warn" />}
        <div className="text-sm">
          <p className="font-semibold">{camera ? "Camera access is blocked" : "File access is blocked"}</p>
          <p className="mt-1 text-muted">
            {camera
              ? "We use the camera only to read a product barcode while you are on this screen. Nothing is recorded or uploaded."
              : "We need to read the file you choose so we can import it. We cannot see any other files."}
          </p>
          <p className="mt-1 text-muted">
            {camera
              ? "To allow it, click the lock icon next to the address bar, set Camera to Allow, then reload."
              : "Choose the file again, or drag it onto the page."}
          </p>
          {children ? <div className="mt-3">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

/** State 7b: the user's role cannot open this page. Says which role is needed and who to ask. */
export function AccessDenied({
  needed,
  yourRole,
  ownerHint = "your business owner",
}: {
  needed: string[];
  yourRole: string;
  ownerHint?: string;
}) {
  return (
    <div role="alert" className="mx-auto max-w-md px-6 py-16 text-center">
      <LockKey size={28} className="mx-auto mb-3 text-muted" />
      <h1 className="text-lg font-semibold">You do not have access to this page</h1>
      <p className="mt-2 text-sm text-muted">
        You are signed in as <strong className="text-ink">{yourRole}</strong>. This page needs one of these roles:{" "}
        <strong className="text-ink">{needed.join(", ")}</strong>.
      </p>
      <p className="mt-2 text-sm text-muted">
        Ask {ownerHint} to change your role under Settings, Users and roles.
      </p>
      <Link href="/dashboard" className="link mt-4 inline-block text-sm">
        Back to dashboard
      </Link>
    </div>
  );
}
