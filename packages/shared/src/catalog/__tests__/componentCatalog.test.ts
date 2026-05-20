import { describe, expect, it } from "vitest";

import { breadcrumbPrimitiveBinding } from "../primitives/breadcrumb";
import { breadcrumbsPrimitiveBinding } from "../primitives/breadcrumbs";
import { buttonPrimitiveBinding } from "../primitives/button";
import { colorFieldPrimitiveBinding } from "../primitives/colorField";
import { dateFieldPrimitiveBinding } from "../primitives/dateField";
import { fileTriggerPrimitiveBinding } from "../primitives/fileTrigger";
import { formPrimitiveBinding } from "../primitives/form";
import { numberFieldPrimitiveBinding } from "../primitives/numberField";
import { searchFieldPrimitiveBinding } from "../primitives/searchField";
import { switchPrimitiveBinding } from "../primitives/switch";
import { textFieldPrimitiveBinding } from "../primitives/textField";
import { timeFieldPrimitiveBinding } from "../primitives/timeField";
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

  it("registers Breadcrumbs as an active primitive catalog entry with Breadcrumb child templates", () => {
    const breadcrumbEntry = getComponentCatalogEntry("Breadcrumb");
    const breadcrumbsEntry = getComponentCatalogEntry("Breadcrumbs");

    expect(breadcrumbEntry?.kind).toBe("primitive");
    if (breadcrumbEntry?.kind !== "primitive") return;
    expect(breadcrumbEntry.binding).toBe(breadcrumbPrimitiveBinding);
    expect(breadcrumbEntry.cutover).toBe("catalog");
    expect(breadcrumbEntry.panel.placeable).toBe(false);

    expect(breadcrumbsEntry?.kind).toBe("primitive");
    if (breadcrumbsEntry?.kind !== "primitive") return;
    expect(breadcrumbsEntry.binding).toBe(breadcrumbsPrimitiveBinding);
    expect(breadcrumbsEntry.family).toBe("primitives/actions");
    expect(breadcrumbsEntry.cutover).toBe("catalog");
    expect(breadcrumbsEntry.binding.runtime.exportName).toBe("Breadcrumbs");
    const placement = breadcrumbsEntry.binding.placement;
    expect(placement?.kind).toBe("node-with-children");
    if (placement?.kind !== "node-with-children") return;
    expect(placement.children.map((child) => child.type)).toEqual([
      "Breadcrumb",
      "Breadcrumb",
      "Breadcrumb",
    ]);
    expect(breadcrumbsEntry.panel.category).toBe("layout");
  });

  it("registers TextField as an active fields primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("TextField");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(textFieldPrimitiveBinding);
    expect(entry.family).toBe("fields");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("TextField");
    expect(entry.binding.skiaPrimitive?.kind).toBe("text-field");
    expect(entry.panel.category).toBe("forms");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers NumberField as an active fields primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("NumberField");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(numberFieldPrimitiveBinding);
    expect(entry.family).toBe("fields");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("NumberField");
    expect(entry.binding.skiaPrimitive?.kind).toBe("number-field");
    expect(entry.panel.category).toBe("forms");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers SearchField as an active fields primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("SearchField");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(searchFieldPrimitiveBinding);
    expect(entry.family).toBe("fields");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("SearchField");
    expect(entry.binding.skiaPrimitive?.kind).toBe("search-field");
    expect(entry.panel.category).toBe("forms");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers DateField as an active fields primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("DateField");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(dateFieldPrimitiveBinding);
    expect(entry.family).toBe("fields");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("DateField");
    expect(entry.binding.skiaPrimitive?.kind).toBe("date-field");
    expect(entry.panel.category).toBe("dateTime");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers TimeField as an active fields primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("TimeField");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(timeFieldPrimitiveBinding);
    expect(entry.family).toBe("fields");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("TimeField");
    expect(entry.binding.skiaPrimitive?.kind).toBe("time-field");
    expect(entry.panel.category).toBe("dateTime");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers ColorField as an active fields primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("ColorField");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(colorFieldPrimitiveBinding);
    expect(entry.family).toBe("fields");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("ColorField");
    expect(entry.binding.skiaPrimitive?.kind).toBe("color-field");
    expect(entry.panel.category).toBe("forms");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers Form as an active fields primitive catalog entry with child templates", () => {
    const entry = getComponentCatalogEntry("Form");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(formPrimitiveBinding);
    expect(entry.family).toBe("fields");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("Form");
    const placement = entry.binding.placement;
    expect(placement?.kind).toBe("node-with-children");
    if (placement?.kind !== "node-with-children") return;
    expect(placement.children.map((child) => child.type)).toEqual([
      "TextField",
      "TextField",
      "Button",
    ]);
    expect(entry.panel.category).toBe("forms");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers FileTrigger as an active fields primitive catalog entry with a trigger child template", () => {
    const entry = getComponentCatalogEntry("FileTrigger");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(fileTriggerPrimitiveBinding);
    expect(entry.family).toBe("fields");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("FileTrigger");
    const placement = entry.binding.placement;
    expect(placement?.kind).toBe("node-with-children");
    if (placement?.kind !== "node-with-children") return;
    expect(placement.children.map((child) => child.type)).toEqual(["Button"]);
    expect(entry.panel.category).toBe("forms");
    expect(entry.panel.label).toBe("file trigger");
    expect(entry.panel.placeable).toBe(true);
  });

  it("registers Switch as an active selection primitive catalog entry", () => {
    const entry = getComponentCatalogEntry("Switch");

    expect(entry?.kind).toBe("primitive");
    if (entry?.kind !== "primitive") return;

    expect(entry.binding).toBe(switchPrimitiveBinding);
    expect(entry.family).toBe("selection");
    expect(entry.cutover).toBe("catalog");
    expect(entry.binding.runtime.exportName).toBe("Switch");
    expect(entry.binding.skiaPrimitive?.kind).toBe("switch");
    expect(entry.panel.category).toBe("forms");
    expect(entry.panel.label).toBe("switch");
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
    expect(activeTypes).toContain("Separator");
    expect(activeTypes).toContain("Link");
    expect(activeTypes).toContain("ToggleButton");
    expect(activeTypes).toContain("ToggleButtonGroup");
    expect(activeTypes).toContain("Toolbar");
    expect(activeTypes).toContain("Breadcrumbs");
    expect(activeTypes).toContain("TextField");
    expect(activeTypes).toContain("NumberField");
    expect(activeTypes).toContain("SearchField");
    expect(activeTypes).toContain("DateField");
    expect(activeTypes).toContain("TimeField");
    expect(activeTypes).toContain("ColorField");
    expect(activeTypes).toContain("Form");
    expect(activeTypes).toContain("FileTrigger");
    expect(activeTypes).toContain("Switch");
    expect(activeTypes).not.toContain("Breadcrumb");
    expect(activeTypes).not.toContain("Card");
  });
});
