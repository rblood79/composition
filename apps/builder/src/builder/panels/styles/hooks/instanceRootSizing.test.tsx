import { describe, expect, it } from "vitest";
import { openStylesFixture } from "../__tests__/support/catalogStylesFixture";

/**
 * 2026-11-11 — an instance's own px size beats its user component's template size (as its visual
 * and layout do). The resolver spread the instance's sizing first and the template node's over it,
 * so an instance of a component made from a 120px Button stayed 120 on the Canvas after Width 240
 * (the panel showed 240 — it reads the authored value).
 */
describe("instance root sizing", () => {
  it("the instance's width wins over its component's template width", async () => {
    const fixture = await openStylesFixture([
      { id: "button", type: "Button", style: { width: "120px" } },
    ]);
    const instance = fixture.componentize("button", "PrimaryAction");
    fixture.workspace.selectRecords([instance]);
    fixture.host.updateStyle("width", "240px");
    expect(fixture.workspace.root.domInputs.get(instance)!.sizing.width).toBe(
      240,
    );
    expect(
      [...fixture.workspace.root.getGeometry([instance]).values()][0]!.width,
    ).toBe(240);
  });
});
