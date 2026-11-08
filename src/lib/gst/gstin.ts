import { STATES } from "./states";

const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** GSTIN check character (mod 36 weighted algorithm used by GSTN). */
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(first14[i]);
    const product = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36];
}

export type GstinResult = { valid: true; stateCode: string } | { valid: false; reason: string };

export function validateGstin(input: string): GstinResult {
  const g = input.trim().toUpperCase();
  if (g.length !== 15) {
    return { valid: false, reason: "GSTIN must be 15 characters like 27ABCDE1234F1Z5" };
  }
  if (!SHAPE.test(g)) {
    return {
      valid: false,
      reason:
        "GSTIN format is wrong. Expected 2 digits, 5 letters, 4 digits, 1 letter, 1 digit or letter, Z, then 1 check character",
    };
  }
  const stateCode = g.slice(0, 2);
  if (!STATES.some((s) => s.code === stateCode)) {
    return { valid: false, reason: `State code ${stateCode} is not a valid GST state code` };
  }
  if (gstinCheckChar(g.slice(0, 14)) !== g[14]) {
    return { valid: false, reason: "GSTIN check character does not match. Re-check the number" };
  }
  return { valid: true, stateCode };
}

export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
