import { describe, expect, it } from "vitest";
import { checkUploadBytes } from "./upload";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

describe("upload validation", () => {
  it("accepts a real PNG", () => {
    expect(checkUploadBytes("a.png", 1000, "image/png", png, "image").ok).toBe(true);
  });
  it("rejects a disallowed extension", () => {
    expect(checkUploadBytes("a.svg", 1000, "image/svg+xml", png, "image").ok).toBe(false);
  });
  it("rejects an executable renamed to .png", () => {
    expect(checkUploadBytes("a.png", 1000, "image/png", exe, "image").ok).toBe(false);
  });
  it("rejects oversize and empty files", () => {
    expect(checkUploadBytes("a.png", 3 * 1024 * 1024, "image/png", png, "image").ok).toBe(false);
    expect(checkUploadBytes("a.png", 0, "image/png", png, "image").ok).toBe(false);
  });
});
