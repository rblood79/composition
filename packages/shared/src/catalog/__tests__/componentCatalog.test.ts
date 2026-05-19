import { describe, expect, it } from "vitest";

import { buttonPrimitiveBinding } from "../primitives/button";
import {
  componentCatalog,
  getComponentCatalogEntry,
  getReusableCatalogDocument,
  getReusableCatalogPropsSchema,
  getReusableCatalogRoot,
  listPlaceableCatalogEntries,
} from "../componentCatalog";

describe("ADR-142 component catalog", () => {
  it("registers primitive entries with their PrimitiveBinding", () => {
    const entry = getComponentCatalogEntry("Button");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(buttonPrimitiveBinding);
    expect(entry.family).toBe("primitives/actions");
    expect(entry.cutover).toBe("catalog");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers reusable entries that resolve to reusable canonical documents", () => {
    const entry = getComponentCatalogEntry("Card");

    expect(entry?.kind).toBe("reusable");
    if (entry?.kind !== "reusable") return;

    const document = getReusableCatalogDocument(entry.reusableId);
    const root = getReusableCatalogRoot(entry.reusableId);
    const propsSchema = getReusableCatalogPropsSchema(entry.reusableId);

    expect(document?.children).toHaveLength(1);
    expect(root?.id).toBe(entry.reusableId);
    expect(root?.type).toBe("Card");
    expect(root?.reusable).toBe(true);
    expect(propsSchema?.title?.kind).toBe("string");
  });

  it("keeps family cutover states atomic", () => {
    const byFamily = new Map<string, Set<string>>();

    for (const entry of componentCatalog) {
      const states = byFamily.get(entry.family) ?? new Set<string>();
      states.add(entry.cutover);
      byFamily.set(entry.family, states);
    }

    expect(
      [...byFamily.entries()].filter(([, states]) => states.size > 1),
    ).toEqual([]);
  });

  it("excludes legacy entries from the active placeable catalog", () => {
    const activeTypes = listPlaceableCatalogEntries().map(
      (entry) => entry.type,
    );

    expect(activeTypes).toContain("Button");
    expect(activeTypes).not.toContain("Card");
  });
});
