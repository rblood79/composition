import { describe, expect, it } from "vitest";

import { buttonPrimitiveBinding } from "../primitives/button";
import { toolbarPrimitiveBinding } from "../primitives/toolbar";
import { toggleButtonGroupPrimitiveBinding } from "../primitives/toggleButtonGroup";
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

  it("registers Separator as an active primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("Separator");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.family).toBe("primitives/actions");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("Separator");
    expect(entry.binding.skiaPrimitive?.kind).toBe("separator");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers Link as an active primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("Link");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.family).toBe("primitives/actions");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("Link");
    expect(entry.binding.skiaPrimitive?.kind).toBe("link");
    expect(entry.panel.category).toBe("layout");
  });

  it("registers ToggleButton as an active primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("ToggleButton");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.family).toBe("primitives/actions");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("ToggleButton");
    expect(entry.binding.skiaPrimitive?.kind).toBe("toggle-button");
    expect(entry.panel.category).toBe("buttons");
  });

  it("registers ToggleButtonGroup as an active primitive catalog entry with child templates", () => {
    const entry = getComponentCatalogEntry("ToggleButtonGroup");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(toggleButtonGroupPrimitiveBinding);
    expect(entry.family).toBe("primitives/actions");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("ToggleButtonGroup");
    const placement = entry.binding.placement;
    expect(placement?.kind).toBe("node-with-children");
    if (placement?.kind !== "node-with-children") return;
    expect(placement.children.map((child) => child.type)).toEqual([
      "ToggleButton",
      "ToggleButton",
    ]);
    expect(entry.panel.category).toBe("buttons");
  });

  it("registers Toolbar as an active primitive catalog entry with child templates", () => {
    const entry = getComponentCatalogEntry("Toolbar");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(toolbarPrimitiveBinding);
    expect(entry.family).toBe("primitives/actions");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("Toolbar");
    const placement = entry.binding.placement;
    expect(placement?.kind).toBe("node-with-children");
    if (placement?.kind !== "node-with-children") return;
    expect(placement.children.map((child) => child.type)).toEqual([
      "Button",
      "Button",
      "Separator",
      "Button",
    ]);
    expect(entry.panel.category).toBe("buttons");
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
    expect(activeTypes).toContain("Separator");
    expect(activeTypes).toContain("Link");
    expect(activeTypes).toContain("ToggleButton");
    expect(activeTypes).toContain("ToggleButtonGroup");
    expect(activeTypes).toContain("Toolbar");
    expect(activeTypes).not.toContain("Card");
  });
});
