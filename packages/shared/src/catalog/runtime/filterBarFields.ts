/**
 * ADR-320 — a filter bar's fields (사용자 결정 8): read by its panel (the Builder, lazy) and by a
 * running bar (the Preview session) — not by the first screen's resolver, so it is a module of its
 * own.
 */
import type { CatalogEntry, NodeEntry } from "../document/types";
import { catalogFilterBarCollection } from "./filterBar";

/** A prop's authored value (a `set` write). */
const setValue = (node: NodeEntry, key: string): unknown => {
  const write = node.props[key];
  return write?.kind === "set" ? write.value : undefined;
};

/**
 * A bar's fields in its order (`fieldOrder` first, then the schema's), each marked when the author
 * hides it (`hiddenFields` — 사용자 결정 8: every field by default). The panel lists them all; the
 * running bar offers the shown ones.
 */
export function catalogFilterBarFieldList(
  bar: NodeEntry,
  read: (id: string) => CatalogEntry | undefined,
): {
  id: string;
  key: string;
  label: string;
  type?: string;
  reference?: string;
  hidden: boolean;
}[] {
  const collectionId = catalogFilterBarCollection(bar, read);
  const collection = collectionId ? read(collectionId) : undefined;
  if (collection?.kind !== "collection") return [];
  const list = (key: string): string[] => {
    const value = setValue(bar, key);
    return Array.isArray(value) ? (value as string[]) : [];
  };
  const order = list("fieldOrder");
  const hidden = new Set(list("hiddenFields"));
  const at = (id: string) => {
    const index = order.indexOf(id);
    return index === -1 ? order.length : index;
  };
  return collection.schema
    .flatMap((field) => (field.id ? [{ ...field, id: field.id }] : []))
    .map((field, index) => ({ field, index }))
    .sort((a, b) => at(a.field.id) - at(b.field.id) || a.index - b.index)
    .map(({ field }) => ({
      id: field.id,
      key: field.key,
      label: field.label ?? field.key,
      ...(field.type ? { type: field.type } : {}),
      ...(field.reference?.collectionId
        ? { reference: field.reference.collectionId }
        : {}),
      hidden: hidden.has(field.id),
    }));
}
