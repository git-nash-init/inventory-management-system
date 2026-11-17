import { describe, expect, it } from "vitest";
import { checkRange, formatRange, isoDay, parseDay, rangeFor } from "./range";

const day = (y: number, m: number, d: number, hour = 12) => new Date(y, m - 1, d, hour, 30);

describe("rangeFor", () => {
  it("today and yesterday are single days", () => {
    expect(rangeFor("today", day(2026, 11, 17))).toEqual({ from: "2026-11-17", to: "2026-11-17" });
    expect(rangeFor("yesterday", day(2026, 11, 17))).toEqual({ from: "2026-11-16", to: "2026-11-16" });
  });
  it("ignores the time of day", () => {
    expect(rangeFor("today", day(2026, 11, 17, 0))).toEqual(rangeFor("today", day(2026, 11, 17, 23)));
  });
  it("yesterday crosses month, year and leap day", () => {
    expect(rangeFor("yesterday", day(2026, 12, 1)).from).toBe("2026-11-30");
    expect(rangeFor("yesterday", day(2026, 1, 1)).from).toBe("2025-12-31");
    expect(rangeFor("yesterday", day(2028, 3, 1)).from).toBe("2028-02-29");
    expect(rangeFor("yesterday", day(2027, 3, 1)).from).toBe("2027-02-28");
  });
  it("a week runs Monday to Sunday", () => {
    // 17 Nov 2026 is a Tuesday
    expect(rangeFor("week", day(2026, 11, 17))).toEqual({ from: "2026-11-16", to: "2026-11-22" });
    // Monday itself
    expect(rangeFor("week", day(2026, 11, 16))).toEqual({ from: "2026-11-16", to: "2026-11-22" });
    // Sunday belongs to the week that started the Monday before
    expect(rangeFor("week", day(2026, 11, 22))).toEqual({ from: "2026-11-16", to: "2026-11-22" });
    // The next Monday starts a new week
    expect(rangeFor("week", day(2026, 11, 23))).toEqual({ from: "2026-11-23", to: "2026-11-29" });
  });
  it("a week can cross a month and a year", () => {
    expect(rangeFor("week", day(2026, 12, 31))).toEqual({ from: "2026-12-28", to: "2027-01-03" });
    expect(rangeFor("week", day(2026, 1, 1))).toEqual({ from: "2025-12-29", to: "2026-01-04" });
  });
  it("a month is the whole calendar month", () => {
    expect(rangeFor("month", day(2026, 11, 17))).toEqual({ from: "2026-11-01", to: "2026-11-30" });
    expect(rangeFor("month", day(2026, 12, 31))).toEqual({ from: "2026-12-01", to: "2026-12-31" });
    expect(rangeFor("month", day(2028, 2, 10))).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(rangeFor("month", day(2027, 2, 10))).toEqual({ from: "2027-02-01", to: "2027-02-28" });
  });
  it("a year is 1 January to 31 December", () => {
    expect(rangeFor("year", day(2026, 11, 17))).toEqual({ from: "2026-01-01", to: "2026-12-31" });
    expect(rangeFor("year", day(2026, 1, 1))).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });
  it("custom returns the chosen dates", () => {
    expect(rangeFor("custom", day(2026, 11, 17), { from: "2026-10-05", to: "2026-10-09" })).toEqual({ from: "2026-10-05", to: "2026-10-09" });
  });
});

describe("parseDay and checkRange", () => {
  it("accepts only real calendar days", () => {
    expect(parseDay("2026-11-17")).toEqual({ y: 2026, m: 11, d: 17 });
    expect(parseDay("2028-02-29")).not.toBeNull();
    expect(parseDay("2027-02-29")).toBeNull();
    expect(parseDay("2026-13-01")).toBeNull();
    expect(parseDay("2026-11-31")).toBeNull();
    expect(parseDay("17-11-2026")).toBeNull();
    expect(parseDay("")).toBeNull();
  });
  it("flags missing and reversed dates", () => {
    expect(checkRange("", "2026-11-17")).toBe("missing");
    expect(checkRange("2026-11-17", "")).toBe("missing");
    expect(checkRange("2026-11-18", "2026-11-17")).toBe("order");
    expect(checkRange("2026-11-17", "2026-11-17")).toBeNull();
    expect(checkRange("2026-11-01", "2026-11-30")).toBeNull();
  });
});

describe("formatRange", () => {
  it("shows one day on its own", () => {
    expect(formatRange({ from: "2026-11-17", to: "2026-11-17" })).toBe("17 Nov 2026");
  });
  it("shares the month and year when it can", () => {
    expect(formatRange({ from: "2026-11-01", to: "2026-11-30" })).toBe("1 – 30 Nov 2026");
    expect(formatRange({ from: "2026-11-16", to: "2026-11-22" })).toBe("16 – 22 Nov 2026");
  });
  it("shares only the year when the months differ", () => {
    expect(formatRange({ from: "2026-01-01", to: "2026-12-31" })).toBe("1 Jan – 31 Dec 2026");
    expect(formatRange({ from: "2026-11-28", to: "2026-12-04" })).toBe("28 Nov – 4 Dec 2026");
  });
  it("spells out both years when they differ", () => {
    expect(formatRange({ from: "2025-12-29", to: "2026-01-04" })).toBe("29 Dec 2025 – 4 Jan 2026");
  });
  it("is empty for invalid dates rather than showing nonsense", () => {
    expect(formatRange({ from: "", to: "2026-11-17" })).toBe("");
    expect(formatRange({ from: "2026-02-30", to: "2026-03-01" })).toBe("");
  });
  it("matches what the presets produce", () => {
    const t = day(2026, 11, 17);
    expect(formatRange(rangeFor("today", t))).toBe("17 Nov 2026");
    expect(formatRange(rangeFor("yesterday", t))).toBe("16 Nov 2026");
    expect(formatRange(rangeFor("week", t))).toBe("16 – 22 Nov 2026");
    expect(formatRange(rangeFor("month", t))).toBe("1 – 30 Nov 2026");
    expect(formatRange(rangeFor("year", t))).toBe("1 Jan – 31 Dec 2026");
  });
});

describe("isoDay", () => {
  it("writes the local day", () => {
    expect(isoDay(day(2026, 1, 5, 23))).toBe("2026-01-05");
  });
});
