import { describe, expect, it } from "vitest";
import { dictionaries, translate, unitLabel, UNITS } from "./dictionary";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("English and Hinglish dictionaries", () => {
  const en = dictionaries.en;
  const hi = dictionaries.hi;

  it("have exactly the same keys", () => {
    expect(Object.keys(hi).sort()).toEqual(Object.keys(en).sort());
  });
  it("have no empty text", () => {
    for (const [k, v] of Object.entries(en)) expect(v.trim(), `en ${k}`).not.toBe("");
    for (const [k, v] of Object.entries(hi)) expect(v.trim(), `hi ${k}`).not.toBe("");
  });
  it("use the same {placeholders} in both languages", () => {
    for (const k of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(hi[k]), k).toEqual(placeholders(en[k]));
    }
  });
  it("show Hinglish text different from English for the main screens", () => {
    expect(hi["nav.newBill"]).not.toBe(en["nav.newBill"]);
    expect(hi["stock.addStock"]).toBe("Maal jodo");
    expect(hi["nav.newBill"]).toBe("Bill banao");
  });
});

describe("translate", () => {
  it("fills placeholders", () => {
    expect(translate("en", "err.onlyLeft", { qty: 6, unit: "kg", name: "Rice" })).toBe("Only 6 kg of Rice left.");
    expect(translate("hi", "dash.bills", { n: 3 })).toBe("3 bill");
  });
  it("labels every unit in both languages and leaves unknown units alone", () => {
    for (const u of UNITS) {
      expect(unitLabel("en", u)).not.toBe("");
      expect(unitLabel("hi", u)).not.toBe("");
    }
    expect(unitLabel("hi", "kg")).toBe("kilo");
    expect(unitLabel("hi", "tray")).toBe("tray");
  });
});
