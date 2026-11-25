import { describe, expect, it } from "vitest";
import { filterProducts, groupNames, groupProducts } from "./products";

const list = [
  { name: "Polo Long Body", category: "Taps and cocks" },
  { name: 'Water Gold Pipe 1"', category: "Pipe" },
  { name: "Basin Bolt", category: "" },
  { name: "Polo Flower Long Body", category: "Taps and cocks" },
];

describe("product list helpers", () => {
  it("lists each group once, A to Z, without the empty one", () => {
    expect(groupNames(list)).toEqual(["Pipe", "Taps and cocks"]);
  });
  it("matches every word in any order, in the name or the group", () => {
    expect(filterProducts(list, "long polo", "").map((p) => p.name)).toEqual(["Polo Long Body", "Polo Flower Long Body"]);
    expect(filterProducts(list, "taps flower", "")).toHaveLength(1);
    expect(filterProducts(list, "  ", "")).toHaveLength(4);
    expect(filterProducts(list, "tank", "")).toHaveLength(0);
  });
  it("narrows to one group", () => {
    expect(filterProducts(list, "", "Pipe")).toHaveLength(1);
    expect(filterProducts(list, "polo", "Pipe")).toHaveLength(0);
  });
  it("puts ungrouped products last", () => {
    expect(groupProducts(list).map((g) => g.group)).toEqual(["Pipe", "Taps and cocks", ""]);
    expect(groupProducts([])).toHaveLength(0);
  });
});
