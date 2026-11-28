import {
  CASCADER_LEVEL_NAME,
  cascaderValueMatch,
  type CascaderEntry,
  type CascaderTable,
} from "./cascader";
import { useSyncExternalStore } from "react";
import type { CatalogCascaderLevels } from "./cascaderLevels";
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

/** The name of a branch's own item, in the field's locale (`CASCADER_LEVEL_NAME`). */
export const useCascaderLevelName = () => useCatalogLocalized(CASCADER_LEVEL_NAME);

/**
 * ADR-322 Phase 6 (사용자 결정 4) — a branch whose level loads one by one shows one status item
 * while it is not here: 「Loading…」 (disabled), or after a failure 「Retry」 (asks again). Its id is
 * the branch's path id + the suffix.
 */
export const CASCADER_LEVEL_STATUS = "\u001estatus";

const LEVEL_STATUS: Readonly<
  Record<string, { readonly loading: string; readonly retry: string }>
> = {
  en: { loading: "Loading…", retry: "Couldn't load — Retry" },
  ko: { loading: "불러오는 중…", retry: "불러오지 못함 — 다시 시도" },
};

/** The status item's words, in the field's locale. */
export const useCascaderLevelStatus = () => useCatalogLocalized(LEVEL_STATUS);

const noSubscribe = () => () => {};
const noVersion = () => 0;

/** The open content redraws as a level loads · fails (the session's levels — Phase 6). */
export function useCascaderLevels(levels: CatalogCascaderLevels | undefined) {
  useSyncExternalStore(
    levels?.subscribe ?? noSubscribe,
    levels?.version ?? noVersion,
    levels?.version ?? noVersion,
  );
}
