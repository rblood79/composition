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

  it("describes catalog ColorField placement with primitive default props", () => {
    const creation = resolveCatalogElementCreation("ColorField");

    expect(creation).toMatchObject({
      elementType: "ColorField",
      props: {
        label: "Color",
        value: "#000000",
        placeholder: "#000000",
        colorSpace: "rgb",
        size: "md",
        labelPosition: "top",
      },
    });
    expect(creation?.children).toBeUndefined();
  });

  it("describes catalog FileTrigger placement with a trigger child template", () => {
    const creation = resolveCatalogElementCreation("FileTrigger");

    expect(creation).toMatchObject({
      elementType: "FileTrigger",
      props: {
        acceptedFileTypes: ["image/*"],
        allowsMultiple: false,
        acceptDirectory: false,
      },
    });
    expect(creation?.children?.map((child) => child.elementType)).toEqual([
      "Button",
    ]);
    expect(creation?.children?.[0]?.props).toMatchObject({
      children: "Upload",
      type: "button",
    });
  });

  it("describes catalog Switch placement with primitive default props", () => {
    const creation = resolveCatalogElementCreation("Switch");

    expect(creation).toMatchObject({
      elementType: "Switch",
      props: {
        children: "Switch",
        size: "md",
        isSelected: false,
        isEmphasized: false,
      },
    });
    expect(creation?.children).toBeUndefined();
  });

  it("describes catalog Checkbox placement with primitive default props", () => {
    const creation = resolveCatalogElementCreation("Checkbox");

    expect(creation).toMatchObject({
      elementType: "Checkbox",
      props: {
        children: "Checkbox",
        size: "md",
        isSelected: false,
        isIndeterminate: false,
        isEmphasized: false,
      },
    });
    expect(creation?.children).toBeUndefined();
  });

  it("describes catalog CheckboxGroup placement with Checkbox child templates", () => {
    const creation = resolveCatalogElementCreation("CheckboxGroup");

    expect(creation).toMatchObject({
      elementType: "CheckboxGroup",
      props: {
        label: "Checkbox Group",
        size: "md",
        orientation: "vertical",
        labelPosition: "top",
        isEmphasized: false,
      },
    });
    expect(creation?.children?.map((child) => child.elementType)).toEqual([
      "Checkbox",
      "Checkbox",
    ]);
    expect(creation?.children?.[0]?.props).toMatchObject({
      children: "Option 1",
      value: "option-1",
      isSelected: false,
    });
  });

  it("describes catalog RadioGroup placement with Radio child templates", () => {
    const creation = resolveCatalogElementCreation("RadioGroup");

    expect(creation).toMatchObject({
      elementType: "RadioGroup",
      props: {
        label: "Radio Group",
        value: "option-1",
        size: "md",
        orientation: "vertical",
        labelPosition: "top",
        isEmphasized: false,
      },
    });
    expect(creation?.children?.map((child) => child.elementType)).toEqual([
      "Radio",
      "Radio",
    ]);
    expect(creation?.children?.[0]?.props).toMatchObject({
      children: "Option 1",
      value: "option-1",
      isSelected: true,
    });
  });

  it("describes catalog Slider placement with primitive default props", () => {
    const creation = resolveCatalogElementCreation("Slider");

    expect(creation).toMatchObject({
      elementType: "Slider",
      props: {
        label: "Slider",
        value: 50,
        minValue: 0,
        maxValue: 100,
        step: 1,
        size: "md",
      },
    });
    expect(creation?.children).toBeUndefined();
  });

  it("describes catalog ListBox placement with canonical items", () => {
    const creation = resolveCatalogElementCreation("ListBox");

    expect(creation).toMatchObject({
      elementType: "ListBox",
      props: {
        variant: "default",
        orientation: "vertical",
        selectionMode: "single",
        items: [
          { id: "item-1", label: "Aardvark", value: "aardvark" },
          { id: "item-2", label: "Cat", value: "cat" },
          { id: "item-3", label: "Kangaroo", value: "kangaroo" },
        ],
      },
    });
    expect(creation?.children).toBeUndefined();
  });

  it("describes catalog GridList placement with canonical items", () => {
    const creation = resolveCatalogElementCreation("GridList");

    expect(creation).toMatchObject({
      elementType: "GridList",
      props: {
        variant: "default",
        layout: "stack",
        columns: 2,
        selectionMode: "none",
        items: [
          {
            id: "item-1",
            label: "Desert Sunset",
            textValue: "Desert Sunset",
            description: "PNG - 2/3/2024",
          },
          {
            id: "item-2",
            label: "Hiking Trail",
            textValue: "Hiking Trail",
            description: "JPEG - 1/10/2022",
          },
          {
            id: "item-3",
            label: "Mountain Sunrise",
            textValue: "Mountain Sunrise",
            description: "PNG - 3/15/2015",
          },
        ],
      },
    });
    expect(creation?.children).toBeUndefined();
  });

  it("describes catalog TagGroup placement with canonical items", () => {
    const creation = resolveCatalogElementCreation("TagGroup");

    expect(creation).toMatchObject({
      elementType: "TagGroup",
      props: {
        label: "Tag Group",
        variant: "default",
        size: "md",
        labelPosition: "top",
        selectionMode: "multiple",
        allowsRemoving: false,
        items: [
          { id: "tag-1", label: "Chocolate" },
          { id: "tag-2", label: "Mint" },
          { id: "tag-3", label: "Strawberry" },
          { id: "tag-4", label: "Vanilla" },
        ],
      },
    });
    expect(creation?.children).toBeUndefined();
  });

  it("describes catalog Menu placement with canonical items", () => {
    const creation = resolveCatalogElementCreation("Menu");

    expect(creation).toMatchObject({
      elementType: "Menu",
      props: {
        label: "Menu",
        children: "Menu",
        variant: "primary",
        size: "md",
        align: "start",
        direction: "bottom",
        selectionMode: "none",
        items: [
          { id: "item-1", label: "Menu Item 1" },
          { id: "item-2", label: "Menu Item 2" },
          { id: "item-3", label: "Menu Item 3" },
        ],
      },
    });
    expect(creation?.children).toBeUndefined();
  });

  it("describes catalog ComboBox placement with canonical items", () => {
    const creation = resolveCatalogElementCreation("ComboBox");

    expect(creation).toMatchObject({
      elementType: "ComboBox",
      props: {
        label: "Combo Box",
        placeholder: "Type or select...",
        inputValue: "",
        allowsCustomValue: true,
        labelPosition: "top",
        isDisabled: false,
        isInvalid: false,
        isReadOnly: false,
        isRequired: false,
        items: [
          { id: "item-1", label: "Aardvark", value: "aardvark" },
          { id: "item-2", label: "Cat", value: "cat" },
          { id: "item-3", label: "Dog", value: "dog" },
          { id: "item-4", label: "Kangaroo", value: "kangaroo" },
        ],
      },
    });
    expect(creation?.children).toBeUndefined();
  });

  it("describes catalog Select placement with canonical items", () => {
    const creation = resolveCatalogElementCreation("Select");

    expect(creation).toMatchObject({
      elementType: "Select",
      props: {
        label: "Select",
        placeholder: "Choose an option...",
        selectedKey: undefined,
        labelPosition: "top",
        isDisabled: false,
        isInvalid: false,
        isReadOnly: false,
        isRequired: false,
        items: [
          { id: "item-1", label: "Aardvark", value: "aardvark" },
          { id: "item-2", label: "Cat", value: "cat" },
          { id: "item-3", label: "Dog", value: "dog" },
          { id: "item-4", label: "Kangaroo", value: "kangaroo" },
        ],
      },
    });
    expect(creation?.children).toBeUndefined();
  });

  it("describes catalog Tabs placement with canonical items", () => {
    const creation = resolveCatalogElementCreation("Tabs");

    expect(creation).toMatchObject({
      elementType: "Tabs",
      props: {
        "aria-label": "Tabs",
        density: "regular",
        size: "md",
        orientation: "horizontal",
        selectedKey: "overview",
        showIndicator: true,
        items: [
          {
            id: "overview",
            label: "Overview",
            content: "Overview content",
          },
          {
            id: "details",
            label: "Details",
            content: "Details content",
          },
          {
            id: "settings",
            label: "Settings",
            content: "Settings content",
          },
        ],
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
