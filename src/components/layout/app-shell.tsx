"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/surface";
import { OfflineBanner } from "@/components/states/offline-banner";
import { NetworkActivity } from "@/components/states/network-activity";
import { SessionExpiredDialog } from "@/components/states/session-expired";
import { AccessDenied } from "@/components/states/permission-denied";
import { PageSkeleton } from "@/components/states/skeletons";
import { useAuth } from "@/lib/auth/context";
import { createBusinessAction, reauthAction } from "@/lib/auth/actions";
import { useBusiness } from "@/data/hooks";
import { moduleForPath, rolesFor, ROLE_LABEL } from "@/domain/permissions";
import { STATES } from "@/lib/gst/states";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { CommandPalette } from "./command-palette";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "ims:sidebar-collapsed";

function useCollapsed() {
  const subscribe = React.useCallback((cb: () => void) => {
    window.addEventListener("ims:sidebar", cb);
    return () => window.removeEventListener("ims:sidebar", cb);
  }, []);
  const collapsed = React.useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(COLLAPSE_KEY) === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );
  const toggle = () => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "0" : "1");
    } catch {
      /* storage blocked */
    }
    window.dispatchEvent(new Event("ims:sidebar"));
  };
  return { collapsed, toggle };
}

function CreateBusiness({ onDone }: { onDone: () => void }) {
  const [name, setName] = React.useState("");
  const [state, setState] = React.useState("27");
  const [error, setError] = React.useState<string>();
  const [busy, setBusy] = React.useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createBusinessAction({ name, stateCode: state });
    setBusy(false);
    if (res.ok) onDone();
    else setError(res.fields?.name ?? res.message);
  }
  return (
    <div className="mx-auto mt-24 max-w-md rounded border border-line bg-surface p-6">
      <h1 className="text-lg font-semibold">Set up your business</h1>
      <p className="mt-1 text-sm text-muted">Your account is ready. Create the business these books belong to. You can add GSTIN and address next.</p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <Field label="Business name" htmlFor="biz-name" error={error} required>
          <Input id="biz-name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={Boolean(error)} />
        </Field>
        <Field label="State" htmlFor="biz-state" hint="Decides CGST and SGST versus IGST on your invoices.">
          <NativeSelect id="biz-state" value={state} onChange={(e) => setState(e.target.value)}>
            {STATES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} {s.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Button type="submit" variant="primary" disabled={busy} className="w-full">
          {busy ? "Creating" : "Create business"}
        </Button>
      </form>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { status, user, role, demo, can, refresh } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const business = useBusiness();
  const { collapsed, toggle } = useCollapsed();
  const [drawer, setDrawer] = React.useState(false);
  const [search, setSearch] = React.useState(false);

  React.useEffect(() => {
    if (status === "signedOut") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    // Close the mobile drawer after navigation.
    const id = requestAnimationFrame(() => setDrawer(false));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  if (status === "loading" || status === "signedOut") {
    return (
      <div className="flex min-h-screen" aria-busy="true">
        <div className="hidden w-60 border-r border-line bg-surface p-3 md:block">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-6 h-8 w-full" />
          <Skeleton className="mt-2 h-8 w-full" />
          <Skeleton className="mt-2 h-8 w-full" />
        </div>
        <div className="flex-1 p-6">
          <PageSkeleton />
        </div>
      </div>
    );
  }
  if (status === "noBusiness") return <CreateBusiness onDone={refresh} />;

  const businessName = business.data?.name ?? "Your business";
  const mod = moduleForPath(pathname);
  const allowed = !mod || can(mod, "view");

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-ink">
        Skip to content
      </a>
      <aside className={cn("no-print sticky top-0 hidden h-screen shrink-0 md:block", collapsed ? "w-14" : "w-60")}>
        <Sidebar collapsed={collapsed} onToggle={toggle} businessName={businessName} />
      </aside>
      <Dialog open={drawer} onOpenChange={setDrawer}>
        <DialogContent title="Menu" className="left-0 top-0 h-full max-h-none w-72 max-w-[85vw] translate-x-0 translate-y-0 p-0">
          <div className="h-[calc(100vh-4rem)]">
            <Sidebar collapsed={false} businessName={businessName} onNavigate={() => setDrawer(false)} />
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <NetworkActivity />
        <OfflineBanner />
        <Topbar businessName={businessName} onMenu={() => setDrawer(true)} onSearch={() => setSearch(true)} />
        {demo ? (
          <div className="no-print border-b border-line bg-surface-2 px-4 py-1.5 text-xs text-muted">
            Demo data is stored in this browser only. Connect Supabase to use real data.
          </div>
        ) : null}
        <main id="main" className="min-w-0 flex-1 p-4 md:p-6">
          {allowed ? (
            children
          ) : (
            <AccessDenied
              yourRole={ROLE_LABEL[role]}
              needed={rolesFor(mod!, "view").map((r) => ROLE_LABEL[r])}
              ownerHint={user?.email ? "your business owner" : "the owner"}
            />
          )}
        </main>
      </div>
      <CommandPalette open={search} onOpenChange={setSearch} />
      <SessionExpiredDialog
        email={user?.email}
        onReauth={async (email, password) => {
          if (demo) return { ok: true };
          const res = await reauthAction({ email, password });
          return res.ok ? { ok: true } : { ok: false, message: res.message };
        }}
      />
    </div>
  );
}
