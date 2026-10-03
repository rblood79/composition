/**
 * The copied selection on the system clipboard (the old `serializeCopiedElements`): copy writes
 * the catalog clipboard as prefixed JSON next to the in-app copy, so a paste works in another tab,
 * another project and after a reload. Paste reads the system clipboard first; text that is not
 * ours (the user copied something else since) pastes nothing, as before. A denied or missing
 * clipboard API falls back to the in-app copy.
 */
import type { CatalogClipboard } from "../../../../../packages/shared/src/catalog/commands/structure";

export const CATALOG_CLIPBOARD_PREFIX = "composition-catalog-clipboard/1\n";

export function serializeCatalogClipboard(clipboard: CatalogClipboard): string {
  return (
    CATALOG_CLIPBOARD_PREFIX +
    JSON.stringify({ rootIds: clipboard.rootIds, entries: clipboard.entries })
  );
}

/** The clipboard in a text, or undefined when the text is not one (or is malformed). */
export function parseCatalogClipboard(
  text: string | null | undefined,
): CatalogClipboard | undefined {
  if (!text?.startsWith(CATALOG_CLIPBOARD_PREFIX)) return undefined;
  try {
    const parsed: unknown = JSON.parse(
      text.slice(CATALOG_CLIPBOARD_PREFIX.length),
    );
    if (!parsed || typeof parsed !== "object") return undefined;
    const { rootIds, entries } = parsed as Record<string, unknown>;
    if (
      !Array.isArray(rootIds) ||
      !rootIds.every((id) => typeof id === "string") ||
      !Array.isArray(entries) ||
      !entries.every(
        (entry) =>
          !!entry &&
          typeof entry === "object" &&
          typeof (entry as { id?: unknown }).id === "string" &&
          typeof (entry as { kind?: unknown }).kind === "string",
      )
    )
      return undefined;
    return { rootIds, entries } as CatalogClipboard;
  } catch {
    return undefined;
  }
}

/** Write the copy to the system clipboard (best effort — a denied clipboard keeps the in-app copy). */
export function writeCatalogClipboardToSystem(
  clipboard: CatalogClipboard,
): void {
  const api = globalThis.navigator?.clipboard;
  if (!api?.writeText) return;
  void api.writeText(serializeCatalogClipboard(clipboard)).catch(() => {});
}

/**
 * The system clipboard's catalog copy: `undefined` = the API is missing or denied (use the in-app
 * copy), `null` = readable but not ours (paste nothing).
 */
export async function readCatalogClipboardFromSystem(): Promise<
  CatalogClipboard | null | undefined
> {
  const api = globalThis.navigator?.clipboard;
  if (!api?.readText) return undefined;
  try {
    return parseCatalogClipboard(await api.readText()) ?? null;
  } catch {
    return undefined;
  }
}
