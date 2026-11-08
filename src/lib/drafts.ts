"use client";

import { del, get, keys, set } from "idb-keyval";

const PREFIX = "draft:";

export type Draft<T> = { data: T; savedAt: number; queued?: boolean };

/** Forms are saved locally so nothing is lost on offline or expired sessions. */
export async function saveDraft<T>(key: string, data: T, opts: { queued?: boolean } = {}): Promise<void> {
  try {
    await set(PREFIX + key, { data, savedAt: Date.now(), queued: opts.queued } satisfies Draft<T>);
  } catch {
    // IndexedDB can be unavailable (private mode). Failing to save a draft must never break the form.
  }
}

export async function loadDraft<T>(key: string): Promise<Draft<T> | undefined> {
  try {
    return await get<Draft<T>>(PREFIX + key);
  } catch {
    return undefined;
  }
}

export async function clearDraft(key: string): Promise<void> {
  try {
    await del(PREFIX + key);
  } catch {
    /* ignore */
  }
}

export async function listQueuedDrafts(): Promise<{ key: string; draft: Draft<unknown> }[]> {
  try {
    const all = await keys();
    const out: { key: string; draft: Draft<unknown> }[] = [];
    for (const k of all) {
      if (typeof k === "string" && k.startsWith(PREFIX)) {
        const draft = await get<Draft<unknown>>(k);
        if (draft?.queued) out.push({ key: k.slice(PREFIX.length), draft });
      }
    }
    return out;
  } catch {
    return [];
  }
}
