import { describe, expect, it } from "vitest";
import { Menu, MousePointer } from "lucide-react";

import {
  getComponentPanelGroups,
  getCatalogPanelComponents,
  mergeCatalogPanelComponents,
  type ComponentPanelDefinition,
} from "./componentPanelCatalog";

describe("ADR-142 Component Panel catalog bridge", () => {
  it("maps active componentCatalog entries into panel definitions", () => {
    const catalogItems = getCatalogPanelComponents();
    const button = catalogItems.find((item) => item.type === "Button");
    const numberField = catalogItems.find(
      (item) => item.type === "NumberField",
    );
    const searchField = catalogItems.find(
      (item) => item.type === "SearchField",
    );
    const dateField = catalogItems.find((item) => item.type === "DateField");
    const timeField = catalogItems.find((item) => item.type === "TimeField");
    const colorField = catalogItems.find((item) => item.type === "ColorField");
    const fileTrigger = catalogItems.find(
      (item) => item.type === "FileTrigger",
    );
    const switchControl = catalogItems.find((item) => item.type === "Switch");

    expect(button?.source).toBe("catalog");
    expect(button?.categoryKey).toBe("buttons");
    expect(button?.label).toBe("button");
    expect(button?.icon).toBe(MousePointer);
    expect(numberField?.source).toBe("catalog");
    expect(numberField?.categoryKey).toBe("forms");
    expect(numberField?.label).toBe("number field");
    expect(searchField?.source).toBe("catalog");
    expect(searchField?.categoryKey).toBe("forms");
    expect(searchField?.label).toBe("search field");
    expect(dateField?.source).toBe("catalog");
    expect(dateField?.categoryKey).toBe("dateTime");
    expect(dateField?.label).toBe("date field");
    expect(timeField?.source).toBe("catalog");
    expect(timeField?.categoryKey).toBe("dateTime");
    expect(timeField?.label).toBe("time field");
    expect(colorField?.source).toBe("catalog");
    expect(colorField?.categoryKey).toBe("forms");
    expect(colorField?.label).toBe("color field");
    expect(fileTrigger?.source).toBe("catalog");
    expect(fileTrigger?.categoryKey).toBe("forms");
    expect(fileTrigger?.label).toBe("file trigger");
    expect(switchControl?.source).toBe("catalog");
    expect(switchControl?.categoryKey).toBe("forms");
    expect(switchControl?.label).toBe("switch");
  });

  it("builds panel groups from shared catalog inventory", () => {
    const normalGroups = getComponentPanelGroups({ isLayoutMode: false });
    const layoutGroups = getComponentPanelGroups({ isLayoutMode: true });

    expect(
      normalGroups.buttons.find((item) => item.type === "Button")?.source,
    ).toBe("catalog");
    expect(normalGroups.layout.some((item) => item.type === "Slot")).toBe(
      false,
    );
    expect(layoutGroups.layout.some((item) => item.type === "Slot")).toBe(true);
    expect(normalGroups.content.length).toBeGreaterThan(5);
    expect(normalGroups.forms.length).toBeGreaterThan(5);
  });

  it("lets catalog entries replace matching legacy panel definitions", () => {
    const legacyButton: ComponentPanelDefinition = {
      type: "Button",
      label: "legacy button",
      icon: Menu,
      source: "legacy",
    };
    const catalogButton: ComponentPanelDefinition = {
      type: "Button",
      label: "button",
      icon: MousePointer,
      source: "catalog",
      categoryKey: "buttons",
    };

    const merged = mergeCatalogPanelComponents(
      {
        buttons: [
          legacyButton,
          { type: "Menu", label: "menu", icon: Menu, source: "legacy" },
        ],
      },
      [catalogButton],
    );

    expect(merged.buttons.map((item) => item.type)).toEqual(["Button", "Menu"]);
    expect(merged.buttons[0].source).toBe("catalog");
    expect(merged.buttons[0].label).toBe("button");
  });
});
