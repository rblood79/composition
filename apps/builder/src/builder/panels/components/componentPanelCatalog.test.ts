import { describe, expect, it } from "vitest";
import { Menu, MousePointer } from "lucide-react";

import {
  getCatalogPanelComponents,
  mergeCatalogPanelComponents,
  type ComponentPanelDefinition,
} from "./componentPanelCatalog";

describe("ADR-142 Component Panel catalog bridge", () => {
  it("maps active componentCatalog entries into panel definitions", () => {
    const catalogItems = getCatalogPanelComponents();
    const button = catalogItems.find((item) => item.type === "Button");

    expect(button?.source).toBe("catalog");
    expect(button?.categoryKey).toBe("buttons");
    expect(button?.label).toBe("button");
    expect(button?.icon).toBe(MousePointer);
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
