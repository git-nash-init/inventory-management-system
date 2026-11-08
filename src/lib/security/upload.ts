/**
 * File upload checks: extension allowlist, MIME allowlist, size cap and magic-byte sniffing.
 * The same rules are enforced again by the Supabase bucket configuration (allowed_mime_types, file_size_limit).
 */
export type UploadKind = "image" | "document";

const RULES: Record<UploadKind, { ext: string[]; mime: string[]; maxBytes: number }> = {
  image: { ext: ["png", "jpg", "jpeg", "webp"], mime: ["image/png", "image/jpeg", "image/webp"], maxBytes: 2 * 1024 * 1024 },
  document: { ext: ["pdf", "png", "jpg", "jpeg"], mime: ["application/pdf", "image/png", "image/jpeg"], maxBytes: 5 * 1024 * 1024 },
};

function sniff(bytes: Uint8Array): string | null {
  const b = (...v: number[]) => v.every((x, i) => bytes[i] === x);
  if (b(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (b(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (b(0x25, 0x50, 0x44, 0x46)) return "application/pdf";
  if (b(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return null;
}

export type UploadCheck = { ok: true; mime: string } | { ok: false; message: string };

export function checkUploadBytes(name: string, size: number, claimedMime: string, head: Uint8Array, kind: UploadKind): UploadCheck {
  const rule = RULES[kind];
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (!rule.ext.includes(ext)) return { ok: false, message: `This file type is not allowed. Use ${rule.ext.join(", ").toUpperCase()}.` };
  if (size > rule.maxBytes) return { ok: false, message: `File is too large. The limit is ${Math.round(rule.maxBytes / 1024 / 1024)} MB.` };
  if (size === 0) return { ok: false, message: "The file is empty." };
  if (!rule.mime.includes(claimedMime)) return { ok: false, message: "The file type reported by your browser is not allowed." };
  const real = sniff(head);
  if (!real || !rule.mime.includes(real)) return { ok: false, message: "The file contents do not match its extension. Upload a real image or PDF." };
  return { ok: true, mime: real };
}

/** Browser helper: validates and returns a data URL. */
export async function readCheckedFile(file: File, kind: UploadKind): Promise<{ ok: true; dataUrl: string; name: string } | { ok: false; message: string }> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const res = checkUploadBytes(file.name, file.size, file.type, head, kind);
  if (!res.ok) return res;
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Could not read the file."));
    r.readAsDataURL(file);
  });
  return { ok: true, dataUrl, name: file.name.replace(/[^\w.\- ]/g, "_") };
}
