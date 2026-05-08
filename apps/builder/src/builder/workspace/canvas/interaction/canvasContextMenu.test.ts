import { afterEach, describe, expect, it } from "vitest";
import { withComponentInstanceMirror } from "@/adapters/canonical/componentSemanticsMirror";
import type { Element } from "../../../../types/core/store.types";
import { clearRegistry, updateElementBounds } from "../elementRegistry";
import { resolveCanvasDetachContextTarget } from "./canvasContextMenu";

function makeElement(id: string, overrides: Partial<Element> = {}): Element {
  return {
    id,
    type: "Button",
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    props: {},
    ...overrides,
  } as Element;
}

describe("resolveCanvasDetachContextTarget", () => {
  afterEach(() => {
    clearRegistry();
  });

  it("returns a canonical ref instance hit target", () => {
    clearRegistry();
    updateElementBounds("instance", { x: 0, y: 0, width: 100, height: 40 });
    const instance = makeElement("instance", {
      ref: "origin",
      type: "ref",
    });

    expect(
      resolveCanvasDetachContextTarget(
        ["instance"],
        new Map([["instance", instance]]),
      ),
    ).toBe("instance");
  });

  it("returns a legacy instance hit target", () => {
    clearRegistry();
    updateElementBounds("instance", { x: 0, y: 0, width: 100, height: 40 });
    const instance = withComponentInstanceMirror(
      makeElement("instance"),
      "origin",
    );

    expect(
      resolveCanvasDetachContextTarget(
        ["instance"],
        new Map([["instance", instance]]),
      ),
    ).toBe("instance");
  });

  it("ignores non-detachable origin and plain elements", () => {
    clearRegistry();
    updateElementBounds("origin", { x: 0, y: 0, width: 100, height: 40 });
    updateElementBounds("plain", { x: 0, y: 0, width: 100, height: 40 });
    const origin = makeElement("origin", { reusable: true });
    const plain = makeElement("plain");

    expect(
      resolveCanvasDetachContextTarget(
        ["origin"],
        new Map([["origin", origin]]),
      ),
    ).toBeNull();
    expect(
      resolveCanvasDetachContextTarget(["plain"], new Map([["plain", plain]])),
    ).toBeNull();
  });
});
