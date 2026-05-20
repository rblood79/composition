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
