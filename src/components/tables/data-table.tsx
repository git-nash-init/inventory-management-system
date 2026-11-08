"use client";

import * as React from "react";
import Fuse from "fuse.js";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { CaretDown, CaretUp, MagnifyingGlass } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/surface";
import { TableSkeleton } from "@/components/states/skeletons";
import { ErrorState } from "@/components/states/error-state";
import { EmptyState } from "@/components/states/empty-state";
import { NoResults } from "@/components/states/no-results";
import { pageSizeFor, useLiteMode } from "@/components/states/lite-mode";
import { errorMessage } from "@/data/hooks";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    align?: "right" | "center";
    className?: string;
  }
}

export type EmptyConfig = {
  title: string;
  reason: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondary?: React.ReactNode;
  icon?: React.ReactNode;
};

export function DataTable<T extends object>({
  columns,
  data,
  isLoading,
  error,
  onRetry,
  empty,
  noun,
  searchKeys,
  searchLabel,
  filters,
  activeFilters = 0,
  onClearFilters,
  toolbar,
  onRowClick,
  rowKey,
  initialSort,
  initialQuery = "",
  onCreateFromQuery,
  footer,
}: {
  columns: ColumnDef<T, unknown>[];
  data: T[] | undefined;
  isLoading: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty: EmptyConfig;
  noun: string;
  searchKeys?: string[];
  searchLabel?: string;
  filters?: React.ReactNode;
  activeFilters?: number;
  onClearFilters?: () => void;
  toolbar?: React.ReactNode;
  onRowClick?: (row: T) => void;
  rowKey?: (row: T) => string;
  initialSort?: SortingState;
  initialQuery?: string;
  onCreateFromQuery?: (q: string) => void;
  footer?: React.ReactNode;
}) {
  const { lite } = useLiteMode();
  const [query, setQuery] = React.useState(initialQuery);
  const [sorting, setSorting] = React.useState<SortingState>(initialSort ?? []);
  const rows = React.useMemo(() => data ?? [], [data]);

  const fuse = React.useMemo(
    () => (searchKeys?.length ? new Fuse(rows, { keys: searchKeys, threshold: 0.3, ignoreLocation: true }) : null),
    [rows, searchKeys],
  );
  const shown = React.useMemo(() => (query.trim() && fuse ? fuse.search(query.trim()).map((r) => r.item) : rows), [query, fuse, rows]);
  const candidates = React.useMemo(() => {
    const k = searchKeys?.[0];
    return k ? rows.map((r) => String((r as Record<string, unknown>)[k] ?? "")).filter(Boolean) : [];
  }, [rows, searchKeys]);

  const table = useReactTable({
    data: shown,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: pageSizeFor(lite) } },
    autoResetPageIndex: true,
  });
  const pageSize = pageSizeFor(lite);
  React.useEffect(() => {
    table.setPageSize(pageSize);
  }, [pageSize, table]);

  const toolbarEl = (
    <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
      {searchKeys?.length ? (
        <div className="relative w-full max-w-xs">
          <MagnifyingGlass size={15} className="pointer-events-none absolute left-2.5 top-2.5 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchLabel ?? `Search ${noun}`}
            aria-label={searchLabel ?? `Search ${noun}`}
            className="h-9 w-full rounded border border-line bg-paper pl-8 pr-3 text-sm"
          />
        </div>
      ) : null}
      {filters}
      <div className="ml-auto flex items-center gap-2">{toolbar}</div>
    </div>
  );

  let body: React.ReactNode;
  if (isLoading) body = <TableSkeleton rows={8} cols={Math.max(3, columns.length)} />;
  else if (error) {
    const m = errorMessage(error);
    body = <ErrorState what={`${noun[0].toUpperCase()}${noun.slice(1)} could not be loaded`} blame={m.blame} detail={m.message} onRetry={onRetry} />;
  } else if (rows.length === 0) body = <EmptyState {...empty} />;
  else if (shown.length === 0)
    body = (
      <NoResults
        query={query}
        noun={noun}
        candidates={candidates}
        activeFilters={activeFilters}
        onClearFilters={() => {
          setQuery("");
          onClearFilters?.();
        }}
        onPickSuggestion={setQuery}
        onCreate={onCreateFromQuery}
      />
    );
  else {
    const pageRows = table.getRowModel().rows;
    body = (
      <>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-line bg-surface-2 text-left text-xs text-muted">
                  {hg.headers.map((h) => {
                    const sortable = h.column.getCanSort();
                    const dir = h.column.getIsSorted();
                    return (
                      <th
                        key={h.id}
                        scope="col"
                        aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}
                        className={cn("px-3 py-2 font-medium", h.column.columnDef.meta?.align === "right" && "text-right", h.column.columnDef.meta?.align === "center" && "text-center")}
                      >
                        {sortable ? (
                          <button onClick={h.column.getToggleSortingHandler()} className="inline-flex items-center gap-1 hover:text-ink">
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {dir === "asc" ? <CaretUp size={11} /> : dir === "desc" ? <CaretDown size={11} /> : null}
                          </button>
                        ) : (
                          flexRender(h.column.columnDef.header, h.getContext())
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr
                  key={rowKey ? rowKey(r.original) : r.id}
                  onClick={onRowClick ? () => onRowClick(r.original) : undefined}
                  onKeyDown={onRowClick ? (e) => (e.key === "Enter" ? onRowClick(r.original) : undefined) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  className={cn("border-b border-line last:border-b-0", onRowClick && "cursor-pointer hover:bg-surface-2")}
                >
                  {r.getVisibleCells().map((c) => (
                    <td
                      key={c.id}
                      className={cn(
                        "px-3 py-2.5 align-middle",
                        c.column.columnDef.meta?.align === "right" && "num text-right",
                        c.column.columnDef.meta?.align === "center" && "text-center",
                        c.column.columnDef.meta?.className,
                      )}
                    >
                      {flexRender(c.column.columnDef.cell, c.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {footer ? <tfoot>{footer}</tfoot> : null}
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-xs text-muted">
          <span>
            {shown.length} {shown.length === 1 ? noun.replace(/s$/, "") : noun}
            {query ? ` matching "${query}"` : ""}
          </span>
          {table.getPageCount() > 1 ? (
            <span className="flex items-center gap-2">
              <Button size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                Previous
              </Button>
              <span className="num">
                {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
              </span>
              <Button size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                Next
              </Button>
            </span>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <Panel>
      {toolbarEl}
      {body}
    </Panel>
  );
}
