import type { FontMgr } from "canvaskit-wasm";

let editingElementId: string | null = null;

export function setEditingElementId(id: string | null): void {
  if (editingElementId === id) return;
  editingElementId = id;
}

export function getEditingElementId(): string | null {
  return editingElementId;
}

const MAX_PARAGRAPH_CACHE_SIZE = (() => {
  const env = import.meta.env.VITE_PARAGRAPH_CACHE_SIZE;
  if (env) {
    const parsed = parseInt(env, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 1000;
})();

let lastParagraphFontMgr: FontMgr | null = null;

export function getLastParagraphFontMgr(): FontMgr | null {
  return lastParagraphFontMgr;
}

export function setLastParagraphFontMgr(fontMgr: FontMgr | null): void {
  lastParagraphFontMgr = fontMgr;
}

export function getMaxParagraphCacheSize(): number {
  return MAX_PARAGRAPH_CACHE_SIZE;
}
