import { describe, expect, it } from "vitest";
import { translate } from "./i18n/dictionary";
import { friendlyError } from "./errors";

const en = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate("en", key, vars);
const hi = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) => translate("hi", key, vars);

describe("friendlyError", () => {
  it("turns the stock message into a sentence in the chosen language", () => {
    const err = { message: "Only 75 kg of Test Rice left", code: "P0001" };
    expect(friendlyError(err, en)).toBe("Only 75 kg of Test Rice left.");
    expect(friendlyError(err, hi, (u) => (u === "kg" ? "kilo" : u))).toBe("Test Rice sirf 75 kilo bacha hai.");
  });
  it("explains a duplicate product name", () => {
    expect(friendlyError({ code: "23505", message: 'duplicate key value violates unique constraint "products_name_active_uq"' }, en)).toBe(
      "A product with this name already exists.",
    );
  });
  it("maps known database messages", () => {
    expect(friendlyError({ message: "Add at least one item" }, hi)).toBe("Kam se kam ek maal jodo.");
    expect(friendlyError({ message: "Bill not found or already cancelled" }, en)).toBe("Bill not found or already cancelled.");
  });
  it("never shows a raw database message", () => {
    expect(friendlyError({ message: 'relation "x" does not exist' }, en)).toBe("Something went wrong. Please try again.");
  });
  it("recognises a network failure", () => {
    expect(friendlyError(new TypeError("Failed to fetch"), en)).toBe("No internet connection. Check your internet and try again.");
  });
});
