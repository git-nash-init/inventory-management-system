import { describe, expect, it } from "vitest";
import { code128Bars, code128Widths } from "./barcode";

describe("code128", () => {
  it("encodes with start, checksum and stop (11 modules per symbol, stop is 13)", () => {
    const widths = code128Widths("PJJ123C");
    const modules = widths.reduce((a, b) => a + b, 0);
    // start + 7 chars + checksum = 9 symbols * 11 + stop 13
    expect(modules).toBe(9 * 11 + 13);
  });
  it("produces bars inside the quiet zone", () => {
    const { rects, width } = code128Bars("12345");
    expect(rects[0].x).toBe(10);
    expect(width).toBeGreaterThan(rects[rects.length - 1].x);
  });
  it("rejects characters outside subset B", () => {
    expect(() => code128Widths("नमस्ते")).toThrow();
  });
});
