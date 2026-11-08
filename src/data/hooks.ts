"use client";

import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { getRepo } from "./index";
import { RepoError } from "./repo";
import type { DocKind } from "@/domain/types";

/** Query keys. Mutations invalidate everything, which is cheap at SMB scale and avoids stale totals. */
export const keys = {
  business: ["business"] as const,
  products: ["products"] as const,
  warehouses: ["warehouses"] as const,
  parties: ["parties"] as const,
  accounts: ["accounts"] as const,
  movements: ["movements"] as const,
  docs: (kind: DocKind) => ["docs", kind] as const,
  doc: (id: string) => ["doc", id] as const,
  payments: ["payments"] as const,
  journal: ["journal"] as const,
  expenses: ["expenses"] as const,
  team: ["team"] as const,
  audit: ["audit"] as const,
};

function useRepoQuery<T>(key: QueryKey, fn: () => Promise<T>) {
  return useQuery({ queryKey: key, queryFn: fn, staleTime: 5_000, retry: 2 });
}

export const useBusiness = () => useRepoQuery(keys.business, () => getRepo().business.get());
export const useProducts = () => useRepoQuery(keys.products, () => getRepo().products.list());
export const useWarehouses = () => useRepoQuery(keys.warehouses, () => getRepo().warehouses.list());
export const useParties = () => useRepoQuery(keys.parties, () => getRepo().parties.list());
export const useAccounts = () => useRepoQuery(keys.accounts, () => getRepo().accounts.list());
export const useMovements = () => useRepoQuery(keys.movements, () => getRepo().stock.movements());
export const useDocs = (kind: DocKind) => useRepoQuery(keys.docs(kind), () => getRepo().docs.list(kind));
export const useDoc = (id: string) => useRepoQuery(keys.doc(id), () => getRepo().docs.get(id));
export const usePayments = () => useRepoQuery(keys.payments, () => getRepo().payments.list());
export const useJournal = () => useRepoQuery(keys.journal, () => getRepo().journal.list());
export const useExpenses = () => useRepoQuery(keys.expenses, () => getRepo().expenses.list());
export const useTeam = () => useRepoQuery(keys.team, () => getRepo().team.list());
export const useAudit = () => useRepoQuery(keys.audit, () => getRepo().audit.list());

/** Wraps a repo write. Invalidates all cached reads and surfaces RepoError messages. */
export function useRepoMutation<TIn, TOut>(fn: (input: TIn) => Promise<TOut>) {
  const qc = useQueryClient();
  return useMutation<TOut, Error, TIn>({
    mutationFn: fn,
    onSuccess: async () => {
      await qc.invalidateQueries();
    },
    retry: 0,
  });
}

export function errorMessage(e: unknown): { message: string; field?: string; blame: "ours" | "network" | "input" } {
  if (e instanceof RepoError) return { message: e.message, field: e.field, blame: e.blame };
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { message: "You are offline. Your changes are kept on this device.", blame: "network" };
  }
  if (e instanceof Error && /fetch|network|timeout/i.test(e.message)) {
    return { message: "The network request failed. Check your connection and try again.", blame: "network" };
  }
  return { message: e instanceof Error ? e.message : "Something went wrong on our side. Try again.", blame: "ours" };
}
