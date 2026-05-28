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

  it("renders selected projected rows with row background", () => {
    const size = ListBoxItemSpec.sizes![ListBoxItemSpec.defaultSize!]!;
    const shapes = ListBoxItemSpec.render!.shapes!(
      { children: "Cat", _isSelected: true },
      size,
      "default",
    );

    expect(shapes.map((shape) => shape.type)).toEqual(["roundRect", "text"]);
  });
});
