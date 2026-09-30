import type { BreakpointName } from "@composition/shared";
import type { OwnFields } from "../../../../../packages/shared/src/catalog/resolution/fieldSource";
import {
  catalogStyleWrites,
  catalogStyleWritesOf,
  type CatalogStyleFieldWrites,
} from "./styleFields";

/** CSS keys the absolute placement answers (a node's own `placement`, base layer only). */
const PLACEMENT_KEYS = new Set(["position", "left", "top"]);

/** The authored layer a breakpoint edits: the base, or that tablet/mobile layer. */
function layerOf(own: OwnFields, breakpoint: BreakpointName) {
  if (breakpoint === "desktop")
    return { visual: own.visual, layout: own.layout, sizing: own.sizing };
  const layer = own.responsive?.[breakpoint];
  return {
    visual: layer?.visual ?? {},
    layout: layer?.layout ?? {},
    sizing: layer?.sizing ?? {},
  };
}

/** The typed fields one CSS key maps to (its removal writes); none for an unsupported key. */
function fieldsOf(key: string): CatalogStyleFieldWrites {
  try {
    return catalogStyleWrites(key, "");
  } catch {
    return {};
  }
}

/**
 * ADR-248 Phase 4e-4d-3: which of `properties` (CSS keys) the node authors at a breakpoint — a
 * write of its own on that layer for a field the key maps to (Left/Top/position: its placement,
 * on the base). The definition and template values are not "modified": resetting drops the
 * node's write and they show again. The section reset buttons, the Modified tab and the tab
 * dots read this one list.
 */
export function catalogDirtyStyleProps(
  own: OwnFields,
  breakpoint: BreakpointName,
  properties: readonly string[],
): string[] {
  const layer = layerOf(own, breakpoint);
  const mapped = new Map(
    properties
      .filter((key) => !PLACEMENT_KEYS.has(key))
      .map((key) => {
        const fields = fieldsOf(key);
        const all = (["visual", "layout", "sizing"] as const).flatMap((scope) =>
          Object.keys(fields[scope] ?? {}).map((field) => `${scope}.${field}`),
        );
        const dirty = all.filter((path) => {
          const [scope, field] = path.split(".") as [
            "visual" | "layout" | "sizing",
            string,
          ];
          return Object.prototype.hasOwnProperty.call(layer[scope], field);
        });
        return [key, { all, dirty }] as const;
      }),
  );
  return properties.filter((key) => {
    if (PLACEMENT_KEYS.has(key))
      return breakpoint === "desktop" && own.placement !== undefined;
    const self = mapped.get(key)!;
    if (!self.dirty.length) return false;
    // A shorthand whose authored fields listed longhands already report is not counted twice
    // (`padding` next to `paddingTop` — one edit, one modified key).
    return !self.dirty.every((path) =>
      [...mapped].some(
        ([other, entry]) =>
          other !== key &&
          entry.all.length < self.all.length &&
          entry.all.includes(path),
      ),
    );
  });
}

/**
 * The reset of `properties` at a breakpoint: removal writes for the keys the node authors there,
 * and whether its placement goes. `undefined` when nothing is authored (no step).
 */
export function catalogResetStyleWrites(
  own: OwnFields,
  breakpoint: BreakpointName,
  properties: readonly string[],
): { writes: CatalogStyleFieldWrites; placement: boolean } | undefined {
  const dirty = catalogDirtyStyleProps(own, breakpoint, properties);
  if (!dirty.length) return undefined;
  const placement = dirty.some((key) => PLACEMENT_KEYS.has(key));
  const writes = catalogStyleWritesOf(
    Object.fromEntries(
      dirty.filter((key) => !PLACEMENT_KEYS.has(key)).map((key) => [key, ""]),
    ),
  );
  return { writes, placement };
}
