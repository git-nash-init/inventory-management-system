"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Role } from "@/domain/types";
import { can, type Action, type Module } from "@/domain/permissions";
import { isDemo } from "@/lib/env";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { signOutAction } from "./actions";
import {
  demoSignOut,
  getDemoRoleRaw,
  getDemoSessionRaw,
  parseDemoUser,
  setDemoRole,
  subscribeDemo,
} from "./demo-session";

export type AuthUser = { id: string; email: string; name: string };

type AuthState = {
  status: "loading" | "signedIn" | "signedOut" | "noBusiness";
  user: AuthUser | null;
  role: Role;
  demo: boolean;
  signOut: () => Promise<void>;
  switchDemoRole: (r: Role) => void;
  can: (module: Module, action: Action) => boolean;
  refresh: () => void;
};

const Ctx = React.createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}

const ROLES: Role[] = ["owner", "manager", "accountant", "sales", "storekeeper"];

function DemoAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const sessionRaw = React.useSyncExternalStore(subscribeDemo, getDemoSessionRaw, () => null);
  const roleRaw = React.useSyncExternalStore(subscribeDemo, getDemoRoleRaw, () => null);
  const [hydrated, setHydrated] = React.useState(false);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setHydrated(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const user = parseDemoUser(sessionRaw);
  const role: Role = ROLES.includes(roleRaw as Role) ? (roleRaw as Role) : "owner";

  const value: AuthState = {
    status: !hydrated ? "loading" : user ? "signedIn" : "signedOut",
    user,
    role,
    demo: true,
    signOut: async () => {
      demoSignOut();
      router.push("/login");
    },
    switchDemoRole: setDemoRole,
    can: (m, a) => can(role, m, a),
    refresh: () => {},
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<Pick<AuthState, "status" | "user" | "role">>({ status: "loading", user: null, role: "sales" });
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    const supabase = getBrowserSupabase();
    let cancelled = false;

    async function load() {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!data.user) {
        setState({ status: "signedOut", user: null, role: "sales" });
        return;
      }
      const { data: m } = await supabase.from("memberships").select("role").eq("user_id", data.user.id).eq("active", true).limit(1).maybeSingle();
      if (cancelled) return;
      const user: AuthUser = {
        id: data.user.id,
        email: data.user.email ?? "",
        name: (data.user.user_metadata?.full_name as string | undefined) ?? data.user.email ?? "You",
      };
      setState(m ? { status: "signedIn", user, role: m.role as Role } : { status: "noBusiness", user, role: "sales" });
    }
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") setState({ status: "signedOut", user: null, role: "sales" });
      else void load();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [tick]);

  const value: AuthState = {
    ...state,
    demo: false,
    signOut: async () => {
      await signOutAction();
    },
    switchDemoRole: () => {},
    can: (m, a) => can(state.role, m, a),
    refresh: () => setTick((t) => t + 1),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return isDemo ? <DemoAuthProvider>{children}</DemoAuthProvider> : <SupabaseAuthProvider>{children}</SupabaseAuthProvider>;
}
