import { describe, expect, it } from "vitest";

import { ListBoxSpec } from "../components/ListBox.spec";

describe("ListBoxSpec render.shapes ADR-146", () => {
  it("does not composite item rows in the parent ListBox shapes path", () => {
    const size = ListBoxSpec.sizes![ListBoxSpec.defaultSize!]!;
    const shapes = ListBoxSpec.render!.shapes!(
      {
        items: [
          { id: "aardvark", label: "Aardvark" },
          { id: "cat", label: "Cat" },
        ],
        selectionMode: "single",
        style: { width: 200 },
      },
      size,
      "default",
    );

    expect(shapes.map((shape) => shape.type)).toEqual(["roundRect", "border"]);
    expect(
      shapes.some(
        (shape) =>
          shape.type === "text" && "text" in shape && shape.text === "Aardvark",
      ),
    ).toBe(false);
  });
});
