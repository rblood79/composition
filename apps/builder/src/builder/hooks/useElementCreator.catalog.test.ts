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

  it("describes catalog breadcrumbs placement with breadcrumb child templates", () => {
    const creation = resolveCatalogElementCreation("Breadcrumbs");

    expect(creation).toMatchObject({
      elementType: "Breadcrumbs",
      props: {
        "aria-label": "Breadcrumbs",
        size: "M",
        isDisabled: false,
      },
    });
    expect(creation?.children?.map((child) => child.elementType)).toEqual([
      "Breadcrumb",
      "Breadcrumb",
      "Breadcrumb",
    ]);
    expect(creation?.children?.[0]?.props).toMatchObject({
      children: "Home",
      href: "/",
    });
  });

  it("describes catalog TextField placement with primitive default props", () => {
    const creation = resolveCatalogElementCreation("TextField");

    expect(creation).toMatchObject({
      elementType: "TextField",
      props: {
        label: "Text Field",
        placeholder: "Enter text...",
        type: "text",
        size: "md",
        labelPosition: "top",
      },
    });
    expect(creation?.children).toBeUndefined();
  });

  it("describes catalog NumberField placement with primitive default props", () => {
    const creation = resolveCatalogElementCreation("NumberField");

    expect(creation).toMatchObject({
      elementType: "NumberField",
      props: {
        label: "Number",
        value: 0,
        minValue: 0,
        maxValue: 100,
        step: 1,
        size: "md",
        labelPosition: "top",
      },
    });
    expect(creation?.children).toBeUndefined();
  });

  it("describes catalog SearchField placement with primitive default props", () => {
    const creation = resolveCatalogElementCreation("SearchField");

    expect(creation).toMatchObject({
      elementType: "SearchField",
      props: {
        label: "Search",
        value: "",
        placeholder: "Search...",
        type: "search",
        inputMode: "search",
        size: "md",
        labelPosition: "top",
      },
    });
    expect(creation?.children).toBeUndefined();
  });

  it("describes catalog DateField placement with primitive default props", () => {
    const creation = resolveCatalogElementCreation("DateField");

    expect(creation).toMatchObject({
      elementType: "DateField",
      props: {
        label: "Date",
        value: "",
        placeholderValue: "2026-01-01",
        granularity: "day",
        size: "md",
        labelPosition: "top",
      },
    });
    expect(creation?.children).toBeUndefined();
  });

  it("describes catalog TimeField placement with primitive default props", () => {
    const creation = resolveCatalogElementCreation("TimeField");

    expect(creation).toMatchObject({
      elementType: "TimeField",
      props: {
        label: "Time",
        value: "",
        placeholderValue: "09:00",
        granularity: "minute",
        hourCycle: 24,
        size: "md",
        labelPosition: "top",
      },
    });
    expect(creation?.children).toBeUndefined();
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
