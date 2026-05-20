import { describe, expect, it } from "vitest";

import {
  resolveCatalogElementCreation,
  resolveDefaultPropsForCreation,
} from "./useElementCreator";

describe("ADR-142 element creator catalog bridge", () => {
  it("uses catalog primitive default props before legacy getDefaultProps", () => {
    expect(resolveDefaultPropsForCreation("Button")).toMatchObject({
      children: "Button",
      variant: "primary",
      fillStyle: "fill",
      size: "md",
      type: "button",
    });
  });

  it("describes catalog primitive group placement with default child templates", () => {
    const creation = resolveCatalogElementCreation("ToggleButtonGroup");

    expect(creation).toMatchObject({
      elementType: "ToggleButtonGroup",
      props: {
        size: "md",
        orientation: "horizontal",
        selectionMode: "single",
      },
    });
    expect(creation?.children?.map((child) => child.elementType)).toEqual([
      "ToggleButton",
      "ToggleButton",
    ]);
    expect(creation?.children?.[0]?.props).toMatchObject({
      children: "Toggle 1",
      isSelected: false,
    });
  });

  it("describes catalog toolbar placement with action child templates", () => {
    const creation = resolveCatalogElementCreation("Toolbar");

    expect(creation).toMatchObject({
      elementType: "Toolbar",
      props: {
        "aria-label": "Toolbar",
        orientation: "horizontal",
      },
    });
    expect(creation?.children?.map((child) => child.elementType)).toEqual([
      "Button",
      "Button",
      "Separator",
      "Button",
    ]);
  });

  it("describes reusable catalog placement as a canonical ref insertion payload", () => {
    const creation = resolveCatalogElementCreation({
      kind: "reusable",
      type: "Card",
      family: "composition-native",
      cutover: "catalog",
      reusableId: "catalog-reusable-card",
      panel: {
        category: "layout",
        label: "card",
        icon: "AppWindowMac",
        placeable: true,
      },
    });

    expect(creation).toEqual({
      elementType: "ref",
      props: {},
      ref: "catalog-reusable-card",
      componentRole: "instance",
      masterId: "catalog-reusable-card",
      componentName: "Card",
    });
  });
});
