"use client";

import type { Role } from "@/domain/types";

/** Tiny external store over localStorage for the demo session and demo role. */
const SESSION = "ims-demo-session";
const ROLE = "ims-demo-role";
const EVENT = "ims-demo-auth";

export type DemoUser = { id: string; email: string; name: string };

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function subscribeDemo(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export const getDemoSessionRaw = () => read(SESSION);
export const getDemoRoleRaw = () => read(ROLE);

export function parseDemoUser(raw: string | null): DemoUser | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DemoUser;
  } catch {
    return null;
  }
}

export function demoSignIn(email: string, name = "Demo Owner") {
  try {
    localStorage.setItem(SESSION, JSON.stringify({ id: "demo-user", email, name } satisfies DemoUser));
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function demoSignOut() {
  try {
    localStorage.removeItem(SESSION);
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function setDemoRole(role: Role) {
  try {
    localStorage.setItem(ROLE, role);
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event(EVENT));
}
