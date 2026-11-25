"use client";

import * as React from "react";
import { Package, Plus } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Money } from "@/components/ui/amount";
import { PageHeader, Panel } from "@/components/ui/surface";
import { EmptyState } from "@/components/states/empty-state";
import { LoadError } from "@/components/states/load-error";
import { TableSkeleton } from "@/components/states/skeletons";
import { useProducts } from "@/data/queries";
import type { Product } from "@/data/types";
import { formatQty } from "@/lib/format/money";
import { useI18n } from "@/lib/i18n";
import { filterProducts, groupNames } from "@/lib/products";
import { cn } from "@/lib/utils";
import { AddStockDialog, FixQuantityDialog, ProductDialog } from "./product-dialogs";

const ROW = "md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_21rem]";

export function StockPage() {
  const { t, unit } = useI18n();
  const products = useProducts();
  const [query, setQuery] = React.useState("");
  const [group, setGroup] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<Product | null>(null);
  const [adding, setAdding] = React.useState<Product | null>(null);
  const [fixing, setFixing] = React.useState<Product | null>(null);

  const all = products.data ?? [];
  const groups = groupNames(all);
  // A group can disappear when its last product is changed or removed: show everything again.
  const activeGroup = groups.includes(group) ? group : "";
  const shown = filterProducts(all, query, activeGroup);
  const totalWorth = all.reduce((sum, p) => sum + p.stockValue, 0);

  return (
    <>
      <PageHeader
        title={t("stock.title")}
        description={all.length > 0 ? t("stock.totalWorth", { amount: new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(totalWorth) }) : undefined}
        actions={
          <Button variant="primary" size="lg" onClick={() => setCreating(true)}>
            <Plus size={18} /> {t("stock.addProduct")}
          </Button>
        }
      />

      {products.isPending ? (
        <Panel>
          <TableSkeleton rows={6} cols={4} />
        </Panel>
      ) : products.isError ? (
        <LoadError error={products.error} onRetry={() => void products.refetch()} />
      ) : all.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Package size={36} />}
            title={t("stock.emptyTitle")}
            reason={t("stock.emptyText")}
            actionLabel={t("stock.addProduct")}
            onAction={() => setCreating(true)}
          />
        </Panel>
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("stock.search")}
              aria-label={t("stock.search")}
              className="h-11 text-base sm:max-w-md"
            />
            {groups.length > 0 ? (
              <NativeSelect value={activeGroup} onChange={(e) => setGroup(e.target.value)} aria-label={t("stock.group")} className="h-11 text-base sm:w-56">
                <option value="">{t("stock.allGroups")}</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </NativeSelect>
            ) : null}
            <p role="status" className="text-sm text-muted sm:ml-auto">
              {t("stock.count", { n: shown.length, total: all.length })}
            </p>
          </div>
          <Panel className="overflow-hidden">
            <div className={cn("hidden gap-3 border-b border-line bg-surface-2 px-4 py-2 text-xs font-medium text-muted md:grid", ROW)}>
              <span>{t("stock.colProduct")}</span>
              <span>{t("stock.colLeft")}</span>
              <span>{t("stock.colBuy")}</span>
              <span>{t("stock.colSell")}</span>
              <span>{t("stock.colValue")}</span>
              <span />
            </div>
            {shown.length === 0 ? (
              <p role="status" className="px-4 py-10 text-center text-sm text-muted">
                {t("stock.noMatch", { q: query.trim() || activeGroup })}
              </p>
            ) : (
              <ul>
                {shown.map((p) => {
                  const low = p.lowStockAt !== null && p.quantity <= p.lowStockAt;
                  return (
                    <li key={p.id} className={cn("grid items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 last:border-b-0", ROW)}>
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0">
                          <span className="block break-words text-base font-medium">{p.name}</span>
                          {p.category ? <span className="block text-xs text-muted">{p.category}</span> : null}
                        </span>
                        {low ? <Badge tone="warn">{t("stock.low")}</Badge> : null}
                      </div>
                      <div className="flex justify-between md:block">
                        <span className="text-xs text-muted md:hidden">{t("stock.colLeft")}</span>
                        <span className={cn("num text-base font-medium", p.quantity <= 0 && "text-bad")}>
                          {formatQty(p.quantity)} {unit(p.unit)}
                        </span>
                      </div>
                      <div className="flex justify-between md:block">
                        <span className="text-xs text-muted md:hidden">{t("stock.colBuy")}</span>
                        <Money value={p.buyPrice} />
                      </div>
                      <div className="flex justify-between md:block">
                        <span className="text-xs text-muted md:hidden">{t("stock.colSell")}</span>
                        <Money value={p.sellPrice} />
                      </div>
                      <div className="flex justify-between md:block">
                        <span className="text-xs text-muted md:hidden">{t("stock.colValue")}</span>
                        <Money value={p.stockValue} />
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        <Button variant="primary" onClick={() => setAdding(p)}>
                          {t("stock.addStock")}
                        </Button>
                        <Button onClick={() => setFixing(p)}>{t("stock.fixQty")}</Button>
                        <Button variant="ghost" onClick={() => setEditing(p)}>
                          {t("common.edit")}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </>
      )}

      <ProductDialog open={creating} onOpenChange={setCreating} />
      <ProductDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} product={editing ?? undefined} />
      <AddStockDialog product={adding} onClose={() => setAdding(null)} />
      <FixQuantityDialog product={fixing} onClose={() => setFixing(null)} />
    </>
  );
}
