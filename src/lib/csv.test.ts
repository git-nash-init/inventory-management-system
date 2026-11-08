import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "./csv";

describe("csv", () => {
  it("round-trips quotes, commas and newlines", () => {
    const text = toCsv(["a", "b"], [["x,y", 'he said "hi"'], ["line1\nline2", 5]]);
    const rows = parseCsv(text);
    expect(rows).toEqual([["a", "b"], ["x,y", 'he said "hi"'], ["line1\nline2", "5"]]);
  });
  it("neutralises formula injection but leaves numbers", () => {
    const text = toCsv(["v"], [["=SUM(A1:A9)"], ["-12.5"], ["+91 98"]]);
    const rows = parseCsv(text);
    expect(rows[1][0]).toBe("'=SUM(A1:A9)");
    expect(rows[2][0]).toBe("-12.5");
    expect(rows[3][0]).toBe("'+91 98");
  });
  it("skips blank lines and handles CRLF", () => {
    expect(parseCsv("a,b\r\n\r\n1,2\r\n")).toEqual([["a", "b"], ["1", "2"]]);
  });
});
