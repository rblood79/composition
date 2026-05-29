import { describe, expect, it } from "vitest";

import { ListBoxItemSpec } from "../components/ListBoxItem.spec";

describe("ListBoxItemSpec render.shapes ADR-146", () => {
  it("renders projected row text through the ListBoxItem renderer", () => {
    const size = ListBoxItemSpec.sizes![ListBoxItemSpec.defaultSize!]!;
    const shapes = ListBoxItemSpec.render!.shapes!(
      { children: "Aardvark", textValue: "Aardvark" },
      size,
      "default",
    );

    expect(shapes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "text",
          text: "Aardvark",
        }),
      ]),
    );
    expect(shapes.some((shape) => shape.type === "roundRect")).toBe(false);
  });

  it("renders selected projected rows with row background and a check indicator (ADR-147)", () => {
    const size = ListBoxItemSpec.sizes![ListBoxItemSpec.defaultSize!]!;
    const shapes = ListBoxItemSpec.render!.shapes!(
      { children: "Cat", _isSelected: true },
      size,
      "default",
    );

    // ADR-147: selection-indicator slot = 우측 체크마크(icon_font "check").
    expect(shapes.map((shape) => shape.type)).toEqual([
      "roundRect",
      "text",
      "icon_font",
    ]);
    expect(
      shapes.some(
        (shape) => shape.type === "icon_font" && shape.iconName === "check",
      ),
    ).toBe(true);
  });

  it("renders an icon slot when props.icon is a resolved icon name (ADR-147)", () => {
    const size = ListBoxItemSpec.sizes![ListBoxItemSpec.defaultSize!]!;
    const shapes = ListBoxItemSpec.render!.shapes!(
      { children: "Dog", icon: "star" },
      size,
      "default",
    );

    expect(
      shapes.some(
        (shape) => shape.type === "icon_font" && shape.iconName === "star",
      ),
    ).toBe(true);
  });

  it("does not render the icon slot for unresolved template placeholders (ADR-147)", () => {
    const size = ListBoxItemSpec.sizes![ListBoxItemSpec.defaultSize!]!;
    const shapes = ListBoxItemSpec.render!.shapes!(
      { children: "Dog", icon: "{icon}" },
      size,
      "default",
    );

    expect(shapes.some((shape) => shape.type === "icon_font")).toBe(false);
  });

  it("does not render unresolved row template placeholders as visible text", () => {
    const size = ListBoxItemSpec.sizes![ListBoxItemSpec.defaultSize!]!;
    const shapes = ListBoxItemSpec.render!.shapes!(
      { children: "Aardvark", description: "{description}" },
      size,
      "default",
    );

    expect(
      shapes.some(
        (shape) => shape.type === "text" && shape.text === "{description}",
      ),
    ).toBe(false);
  });
});
