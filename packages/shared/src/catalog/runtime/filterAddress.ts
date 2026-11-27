/**
 * ADR-320 Phase 5 (사용자 결정 5) — a filter scope's tree in the published app's address: one query
 * value per bar after the hash path (`#/orders?f.<bar>=<tree>`). The value is the tree in a short
 * form (field ids without their `data:field:` prefix, one-letter keys, the root's id left out) as
 * base64url JSON — what a link carries. Reading gives the tree's raw shape back: the scope's one
 * assignment reads and judges it as any tree (`CatalogFilterScopes.assign` — nothing is dropped
 * here, §5.8). An empty value = 「no condition」 (the viewer cleared a bar that starts with some).
 */
import type { ViewCondition, ViewConditionGroup } from "../document/types";
import { CATALOG_FILTER_TREE_ID } from "./filterScope";

const FIELD = "data:field:";
/** The query key of a bar's tree (`f.` + its node id without the `project:node:` prefix). */
export const catalogFilterAddressKey = (barId: string): string =>
  `f.${barId.replace(/^project:node:/, "")}`;

type Short = Record<string, unknown>;

function shortOf(item: ViewCondition | ViewConditionGroup): Short {
  if ("items" in item)
    return { i: item.id, o: item.op, g: item.items.map(shortOf) };
  return {
    i: item.id,
    f: item.fields.map((path) =>
      path.map((step) =>
        step.startsWith(FIELD) ? step.slice(FIELD.length) : step,
      ),
    ),
    o: item.op,
    ...(item.value !== undefined ? { v: item.value } : {}),
    ...(item.enabled !== undefined ? { e: item.enabled } : {}),
    ...(item.skip !== undefined ? { k: item.skip } : {}),
    ...(item.sensitivity ? { s: item.sensitivity } : {}),
    ...(item.unit ? { u: item.unit } : {}),
  };
}

function longOf(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const { i, o, g, f, v, e, k, s, u } = value as Short;
  if (Array.isArray(g)) return { id: i, op: o, items: g.map(longOf) };
  return {
    id: i,
    fields: Array.isArray(f)
      ? f.map((path) =>
          Array.isArray(path)
            ? path.map((step) =>
                typeof step === "string" ? FIELD + step : step,
              )
            : path,
        )
      : f,
    op: o,
    ...(v !== undefined ? { value: v } : {}),
    ...(e !== undefined ? { enabled: e } : {}),
    ...(k !== undefined ? { skip: k } : {}),
    ...(s !== undefined ? { sensitivity: s } : {}),
    ...(u !== undefined ? { unit: u } : {}),
  };
}

const toBase64Url = (text: string): string => {
  let binary = "";
  for (const byte of new TextEncoder().encode(text))
    binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};
const fromBase64Url = (text: string): string => {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(
    Uint8Array.from(binary, (char) => char.charCodeAt(0)),
  );
};

/** A tree as its address value (`""` = no condition). */
export function catalogFilterTreeAddress(
  tree: ViewConditionGroup | null | undefined,
): string {
  if (!tree?.items.length) return "";
  return toBase64Url(JSON.stringify(tree.items.map(shortOf)));
}

/**
 * An address value as a tree's raw shape — `null` = no condition, `undefined` = not a value this
 * writes (the scope reads its next source).
 */
export function catalogFilterTreeFromAddress(text: string): unknown {
  if (text === "") return null;
  try {
    const items: unknown = JSON.parse(fromBase64Url(text));
    if (!Array.isArray(items)) return undefined;
    return { id: CATALOG_FILTER_TREE_ID, op: "and", items: items.map(longOf) };
  } catch {
    return undefined;
  }
}

/** The path with a query value set (`undefined` = removed); the hash path itself stays. */
export function catalogPathWithQuery(
  path: string,
  key: string,
  value: string | undefined,
): string {
  const at = path.indexOf("?");
  const base = at < 0 ? path : path.slice(0, at);
  const query = new URLSearchParams(at < 0 ? "" : path.slice(at + 1));
  if (value === undefined) query.delete(key);
  else query.set(key, value);
  const text = query.toString();
  return text ? `${base}?${text}` : base;
}

/** A query value of a path (`undefined` = none). */
export function catalogPathQuery(
  path: string,
  key: string,
): string | undefined {
  const at = path.indexOf("?");
  if (at < 0) return undefined;
  return new URLSearchParams(path.slice(at + 1)).get(key) ?? undefined;
}
