"use client";

import { WifiSlash } from "@phosphor-icons/react";
import { useOnlineStatus } from "@/hooks/use-online-status";

/** State 4: no internet. Tells the user exactly what still works. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="status" className="no-print flex items-start gap-3 border-b border-warn/40 bg-warn-bg px-4 py-2 text-sm text-warn">
      <WifiSlash size={18} className="mt-0.5 shrink-0" />
      <div>
        <strong className="font-semibold">You are offline.</strong>{" "}
        You can still view lists you opened earlier and draft invoices and bills. Drafts are saved on this device and
        will be ready to submit when the connection returns. Saving to the server, payments and reports need internet.
      </div>
    </div>
  );
}
