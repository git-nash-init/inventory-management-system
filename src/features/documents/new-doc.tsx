"use client";

import { useSearchParams } from "next/navigation";
import { Skeleton } from "@/components/ui/surface";
import { ErrorState } from "@/components/states/error-state";
import { useDoc } from "@/data/hooks";
import type { DocType } from "@/domain/types";
import { useAuth } from "@/lib/auth/context";
import { AccessDenied } from "@/components/states/permission-denied";
import { ROLE_LABEL, rolesFor } from "@/domain/permissions";
import { DocumentEditor } from "./document-editor";
import { TYPE_LABEL, type DocRoute } from "./config";

/** Reads ?type=, ?from= (new document based on another, e.g. a credit note from an invoice) and ?draft= (continue editing). */
export function NewDoc({ route }: { route: DocRoute }) {
  const params = useSearchParams();
  const { can, role } = useAuth();
  const mod = route.kind === "sales" ? "sales" : "purchases";
  const sourceId = params.get("from") ?? params.get("draft") ?? "";
  const source = useDoc(sourceId);
  const wanted = params.get("type") as DocType | null;
  const type: DocType = wanted && route.types.includes(wanted) ? wanted : route.defaultType;

  if (!can(mod, "create")) return <AccessDenied yourRole={ROLE_LABEL[role]} needed={rolesFor(mod, "create").map((r) => ROLE_LABEL[r])} />;
  if (sourceId && source.isPending) return <Skeleton className="h-96 w-full" />;
  if (sourceId && source.error) return <ErrorState what="The source document could not be loaded" blame="network" onRetry={() => void source.refetch()} />;
  if (sourceId && !source.data) return <ErrorState what="The source document does not exist" blame="input" />;

  const isDraft = params.get("draft") && source.data?.status === "draft";
  return (
    <DocumentEditor
      key={`${type}-${sourceId}`}
      route={route}
      type={isDraft ? source.data!.type : type}
      initial={source.data}
      defaultPartyId={params.get("party") ?? undefined}
      title={isDraft ? `Edit draft ${TYPE_LABEL[source.data!.type].toLowerCase()}` : sourceId ? `New ${TYPE_LABEL[type].toLowerCase()} from ${source.data?.number}` : undefined}
    />
  );
}
