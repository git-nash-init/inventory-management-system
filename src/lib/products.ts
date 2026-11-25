/** Helpers for a long product list: search, filter by group and group for pickers. */
type Item = { name: string; category: string };

/** Group names in A to Z order. Products without a group are not listed. */
export function groupNames(list: Item[]): string[] {
  return [...new Set(list.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/** Every typed word must appear in the name or the group, in any order. `group` "" means all groups. */
export function filterProducts<T extends Item>(list: T[], query: string, group: string): T[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter((p) => {
    if (group && p.category !== group) return false;
    const text = `${p.name} ${p.category}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

/** Products under their group, groups in A to Z order, ungrouped ones last under "". */
export function groupProducts<T extends Item>(list: T[]): { group: string; items: T[] }[] {
  const out = groupNames(list).map((group) => ({ group, items: list.filter((p) => p.category === group) }));
  const rest = list.filter((p) => !p.category);
  if (rest.length > 0) out.push({ group: "", items: rest });
  return out;
}
