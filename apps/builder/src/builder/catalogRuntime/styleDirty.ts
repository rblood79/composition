import type { BreakpointName } from "@composition/shared";
import type { OwnFields } from "../../../../../packages/shared/src/catalog/resolution/fieldSource";
import {
  catalogStyleWrites,
  catalogStyleWritesOf,
  type CatalogStyleFieldWrites,
} from "./styleFields";

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
 * write of its own on that layer for a field the key maps to (Left/Top/position: its layout
 * `position` · `inset*` — ADR-275). The definition and template values are not "modified": resetting drops the
 * node's write and they show again. The section reset buttons, the Modified tab and the tab
 * dots read this one list.
 */
export function catalogDirtyStyleProps(
  own: OwnFields,
  breakpoint: BreakpointName,
  properties: readonly string[],
  /**
   * The node's own values that are its defaults (a Library · Local page node as the page makes
   * it — `catalogComponentPageBaseline`): a field holding its baseline value is not modified, a
   * baseline field the node dropped is.
   */
  baseline?: OwnFields,
): string[] {
  const layer = layerOf(own, breakpoint);
  const base = baseline ? layerOf(baseline, breakpoint) : undefined;
  const has = (fields: Record<string, unknown>, field: string) =>
    Object.prototype.hasOwnProperty.call(fields, field);
  const mapped = new Map(
    properties.map((key) => {
        const fields = fieldsOf(key);
        const all = (["visual", "layout", "sizing"] as const).flatMap((scope) =>
          Object.keys(fields[scope] ?? {}).map((field) => `${scope}.${field}`),
        );
        const dirty = all.filter((path) => {
          const [scope, field] = path.split(".") as [
            "visual" | "layout" | "sizing",
            string,
          ];
          if (!base) return has(layer[scope], field);
          return (
            has(layer[scope], field) !== has(base[scope], field) ||
            JSON.stringify(layer[scope][field as never]) !==
              JSON.stringify(base[scope][field as never])
          );
        });
        return [key, { all, dirty }] as const;
      }),
  );
  return properties.filter((key) => {
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
 * The reset of `properties` at a breakpoint: removal writes for the keys the node authors there.
 * `undefined` when nothing is authored (no step).
 */
export function catalogResetStyleWrites(
  own: OwnFields,
  breakpoint: BreakpointName,
  properties: readonly string[],
  /** The node's defaults (`catalogDirtyStyleProps`): a reset writes them back. */
  baseline?: OwnFields,
): { writes: CatalogStyleFieldWrites } | undefined {
  const dirty = catalogDirtyStyleProps(own, breakpoint, properties, baseline);
  if (!dirty.length) return undefined;
  const writes = catalogStyleWritesOf(
    Object.fromEntries(dirty.map((key) => [key, ""])),
  );
  if (!baseline) return { writes };
  // (A field the baseline holds goes back to its value, not away.)
  const base = layerOf(baseline, breakpoint);
  const restored: CatalogStyleFieldWrites = {};
  for (const scope of ["visual", "layout", "sizing"] as const)
    for (const field of Object.keys(writes[scope] ?? {})) {
      const value = (base[scope] as Record<string, unknown>)[field];
      (restored[scope] ??= {} as never)[field as never] = (
        value === undefined ? { kind: "remove" } : value
      ) as never;
    }
  return { writes: restored };
}
