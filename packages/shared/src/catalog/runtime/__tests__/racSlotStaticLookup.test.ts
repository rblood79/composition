/**
 * 2026-11-25 번들 재측정 — the Preview DOM reads RAC components and slot contexts from static tables,
 * never `RAC[name]`. A computed read of the `react-aria-components` namespace keeps every RAC export
 * in the shared chunk the Builder loads first (792815efc: Builder initial +34,637 B gzip). The tables
 * must still cover every name the catalog draws, or a part would silently lose its RAC component.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as RAC from "react-aria-components";
import { describe, expect, it } from "vitest";
import { componentCatalog } from "../../componentCatalog";
import { CATALOG_NATIVE_SLOT_CONTEXT_NAMES } from "../../racSlotContract";
import {
  CATALOG_RAC_COMPONENTS,
  ORPHAN_ITEM_HOST,
} from "../domBinding.runtime";
import { RAC_SLOT_CONTEXTS } from "../racSlotScope";

const RAC_EXPORTS = RAC as unknown as Record<string, unknown>;

describe("RAC lookups are static", () => {
  it("every slot context name reads the RAC context of that name", () => {
    const missing = Object.entries(CATALOG_NATIVE_SLOT_CONTEXT_NAMES).filter(
      ([key, name]) =>
        RAC_SLOT_CONTEXTS[key as keyof typeof RAC_SLOT_CONTEXTS] !==
        RAC_EXPORTS[name],
    );
    expect(missing).toEqual([]);
  });

  it("every RAC component a binding or an orphan host draws is in the table", () => {
    const names = new Set<string>(Object.values(ORPHAN_ITEM_HOST));
    for (const entry of componentCatalog)
      if (entry.kind === "primitive" && entry.binding.source.kind === "rac")
        names.add(entry.binding.source.component);
    // (`SelectBoxGroup` is no RAC export — the host lookup finds nothing and draws the item alone.)
    const missing = [...names].filter(
      (name) =>
        name in RAC_EXPORTS &&
        CATALOG_RAC_COMPONENTS[name] !== RAC_EXPORTS[name],
    );
    expect(missing).toEqual([]);
  });

  it("the runtime never reads the RAC namespace by a computed name", () => {
    const sources = ["../domBinding.runtime.ts", "../racSlotScope.tsx"].map(
      (path) =>
        readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8"),
    );
    for (const source of sources) {
      expect(source).not.toMatch(/\(RAC as [^)]*\)\s*\[/);
      expect(source).not.toMatch(/\bRAC\s*\[/);
    }
  });
});
