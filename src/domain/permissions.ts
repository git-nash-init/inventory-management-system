import type { Role } from "./types";

export type Module =
  | "dashboard"
  | "inventory"
  | "sales"
  | "purchases"
  | "accounting"
  | "reports"
  | "settings"
  | "users";
export type Action = "view" | "create" | "edit" | "delete";

const ALL: Action[] = ["view", "create", "edit", "delete"];
const VIEW: Action[] = ["view"];
const VIEW_CREATE: Action[] = ["view", "create"];

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  manager: "Manager",
  accountant: "Accountant",
  sales: "Sales",
  storekeeper: "Store keeper",
};

export const ROLES: Role[] = ["owner", "manager", "accountant", "sales", "storekeeper"];

const MATRIX: Record<Role, Partial<Record<Module, Action[]>>> = {
  owner: {
    dashboard: ALL, inventory: ALL, sales: ALL, purchases: ALL, accounting: ALL, reports: ALL, settings: ALL, users: ALL,
  },
  manager: {
    dashboard: ALL, inventory: ALL, sales: ALL, purchases: ALL, accounting: VIEW_CREATE, reports: VIEW, settings: VIEW,
  },
  accountant: {
    dashboard: VIEW, inventory: VIEW, sales: ["view", "create"], purchases: ["view", "create"], accounting: ALL, reports: ALL, settings: VIEW,
  },
  sales: {
    dashboard: VIEW, inventory: VIEW, sales: ["view", "create", "edit"],
  },
  storekeeper: {
    dashboard: VIEW, inventory: ALL, purchases: VIEW_CREATE,
  },
};

export function can(role: Role, module: Module, action: Action): boolean {
  return MATRIX[role][module]?.includes(action) ?? false;
}

/** Roles that can perform the action, for the "who to ask" message. */
export function rolesFor(module: Module, action: Action): Role[] {
  return ROLES.filter((r) => can(r, module, action));
}

export class PermissionError extends Error {
  constructor(public module: Module, public action: Action) {
    super(`Not allowed: ${action} on ${module}`);
    this.name = "PermissionError";
  }
}

/** Server-side guard. Throws PermissionError. RLS in Postgres is the backstop. */
export function requirePermission(role: Role | undefined, module: Module, action: Action): void {
  if (!role || !can(role, module, action)) throw new PermissionError(module, action);
}

export const NAV_MODULE: Record<string, Module> = {
  "/dashboard": "dashboard",
  "/inventory": "inventory",
  "/sales": "sales",
  "/purchases": "purchases",
  "/accounting": "accounting",
  "/settings": "settings",
};

export function moduleForPath(pathname: string): Module | undefined {
  if (pathname.startsWith("/accounting/reports")) return "reports";
  if (pathname.startsWith("/settings/users")) return "users";
  const seg = "/" + pathname.split("/")[1];
  return NAV_MODULE[seg];
}
