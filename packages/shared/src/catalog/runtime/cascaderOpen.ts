import {
  cascaderValueMatch,
  type CascaderEntry,
  type CascaderTable,
} from "./cascader";
import { useCatalogLocalized } from "./localizedStrings";

/**
 * ADR-322 Phase 5 — what the open contents (`cascaderMenu` · `cascaderPanel`, lazy) share: the
 * picked items, and a branch's own item while branches are pickable (사용자 결정 2).
 */

/** The id suffix of a branch's own item (「<branch> 전체」) — first in its level (columns · drill). */
export const CASCADER_LEVEL_ITEM = "\u001eall";

/** The items the keys name (each key's one pickable item — a refused key names none). */
export function cascaderPicked(
  table: CascaderTable,
  keys: readonly string[],
): CascaderEntry[] {
  return keys.flatMap((key) => {
    const match = cascaderValueMatch(table, key);
    return match.kind === "item" ? [match.entry] : [];
  });
}

const LEVEL_NAME: Readonly<Record<string, (name: string) => string>> = {
  en: (name) => `All of ${name}`,
  ko: (name) => `${name} 전체`,
  ja: (name) => `${name} すべて`,
  zh: (name) => `全部${name}`,
};

/** The name of a branch's own item, in the field's locale. */
export const useCascaderLevelName = () => useCatalogLocalized(LEVEL_NAME);
