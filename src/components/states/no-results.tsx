"use client";

import * as React from "react";
import Fuse from "fuse.js";
import { Button } from "@/components/ui/button";

/** Fuzzy "did you mean" suggestions from a list of known names. */
export function suggestFor(query: string, candidates: string[], limit = 3): string[] {
  const q = query.trim();
  if (!q || candidates.length === 0) return [];
  const fuse = new Fuse(candidates, { threshold: 0.45, ignoreLocation: true, includeScore: true });
  return fuse
    .search(q)
    .slice(0, limit)
    .map((r) => r.item);
}

/** State 6: no search results. Suggests a correction, clearing filters and creating the thing. */
export function NoResults({
  query,
  candidates = [],
  activeFilters = 0,
  noun,
  onClearFilters,
  onPickSuggestion,
  onCreate,
}: {
  query: string;
  candidates?: string[];
  activeFilters?: number;
  noun: string;
  onClearFilters?: () => void;
  onPickSuggestion?: (s: string) => void;
  onCreate?: (q: string) => void;
}) {
  const suggestions = React.useMemo(() => suggestFor(query, candidates), [query, candidates]);
  return (
    <div role="status" className="px-6 py-12 text-center">
      <h3 className="text-base font-semibold">
        {query ? `No ${noun} match "${query}"` : `No ${noun} match these filters`}
      </h3>
      {suggestions.length > 0 ? (
        <p className="mt-2 text-sm text-muted">
          Did you mean{" "}
          {suggestions.map((s, i) => (
            <React.Fragment key={s}>
              {i > 0 ? ", " : ""}
              <button className="link" onClick={() => onPickSuggestion?.(s)}>
                {s}
              </button>
            </React.Fragment>
          ))}
          ?
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted">Check the spelling or try a shorter word, a SKU or a barcode.</p>
      )}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {activeFilters > 0 && onClearFilters ? (
          <Button onClick={onClearFilters}>Clear {activeFilters} filter{activeFilters > 1 ? "s" : ""}</Button>
        ) : null}
        {query && onCreate ? (
          <Button variant="primary" onClick={() => onCreate(query)}>
            Create &quot;{query}&quot;
          </Button>
        ) : null}
      </div>
    </div>
  );
}
