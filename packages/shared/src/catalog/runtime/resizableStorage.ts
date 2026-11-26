/**
 * ADR-318 Phase 5 (사용자 결정 5) — 「Remember sizes」: a Group's Panels' share · collapse kept in the
 * browser (the Preview session's storage — Publish only).
 */
// ── Phase 5 — 「Remember sizes」 (사용자 결정 5: a Group switch, Publish only) ──

/** A key-value store (the browser's `localStorage` in Publish — the session's `tableStateStorage`). */
export interface CatalogResizableStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const CATALOG_RESIZABLE_STORAGE_PREFIX = "composition:resizable:v1:";

/** The state a Panel keeps — its share and its collapse. */
export const RESIZABLE_REMEMBERED_PROPS = ["size", "isCollapsed"] as const;

type RememberedPanels = Record<string, Record<string, unknown>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** A project's remembered Panels (`{}` = none · no storage · unreadable). */
export function catalogStoredResizablePanels(
  storage: CatalogResizableStorage | null | undefined,
  projectId: string,
): RememberedPanels {
  if (!storage) return {};
  try {
    const raw = storage.getItem(
      `${CATALOG_RESIZABLE_STORAGE_PREFIX}${projectId}`,
    );
    const value: unknown = raw ? JSON.parse(raw) : undefined;
    if (!isRecord(value)) return {};
    const panels: RememberedPanels = {};
    for (const [id, entry] of Object.entries(value)) {
      if (!isRecord(entry)) continue;
      const kept = catalogResizableRemembered(entry);
      if (Object.keys(kept).length) panels[id] = kept;
    }
    return panels;
  } catch {
    return {};
  }
}

/** Stores a project's remembered Panels (none left = the key is removed). */
export function catalogStoreResizablePanels(
  storage: CatalogResizableStorage,
  projectId: string,
  panels: Readonly<RememberedPanels>,
): void {
  const key = `${CATALOG_RESIZABLE_STORAGE_PREFIX}${projectId}`;
  try {
    if (Object.keys(panels).length)
      storage.setItem(key, JSON.stringify(panels));
    else storage.removeItem(key);
  } catch {
    // (A full · blocked storage: the sizes stay the session's.)
  }
}

/** The remembered slice of a patch (a finite share 0 ~ 100 · a boolean collapse). */
export function catalogResizableRemembered(
  patch: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const kept: Record<string, unknown> = {};
  const size = patch.size;
  if (
    typeof size === "number" &&
    Number.isFinite(size) &&
    size >= 0 &&
    size <= 100
  )
    kept.size = size;
  if (typeof patch.isCollapsed === "boolean")
    kept.isCollapsed = patch.isCollapsed;
  return kept;
}
