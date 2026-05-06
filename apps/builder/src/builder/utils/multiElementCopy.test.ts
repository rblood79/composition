import { describe, expect, it } from "vitest";
import type { Element } from "../../types/core/store.types";
import {
  copyMultipleElements,
  deserializeCopiedElements,
  pasteMultipleElements,
  serializeCopiedElements,
} from "./multiElementCopy";

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

describe("multiElementCopy", () => {
  it("pastes a copied reusable origin as a canonical ref instance", () => {
    const origin = makeElement("origin", {
      reusable: true,
      componentName: "Primary Button",
      parent_id: "body",
      props: {
        label: "Origin",
        style: { left: "20px", top: "30px", color: "red" },
      },
    });
    const child = makeElement("origin-label", {
      type: "Text",
      parent_id: "origin",
      props: { text: "Label" },
    });
    const copied = copyMultipleElements(
      ["origin"],
      new Map([
        ["origin", origin],
        ["origin-label", child],
      ]),
    );

    const pasted = pasteMultipleElements(copied, "page-1", { x: 10, y: 10 });

    expect(pasted).toHaveLength(1);
    expect(pasted[0]).toMatchObject({
      type: "ref",
      ref: "origin",
      componentRole: "instance",
      masterId: "origin",
      parent_id: "body",
      page_id: "page-1",
      componentName: "Primary Button",
      props: { style: { left: "30px", top: "40px" } },
    });
    expect(pasted[0].id).not.toBe("origin");
    expect(pasted.find((element) => element.type === "Text")).toBeUndefined();
  });

  it("keeps standard element paste as a subtree copy", () => {
    const box = makeElement("box", { type: "Box" });
    const label = makeElement("label", {
      type: "Text",
      parent_id: "box",
      props: { text: "Copied" },
    });
    const copied = copyMultipleElements(
      ["box"],
      new Map([
        ["box", box],
        ["label", label],
      ]),
    );

    const pasted = pasteMultipleElements(copied, "page-1");

    expect(pasted).toHaveLength(2);
    expect(pasted[0]).toMatchObject({ type: "Box" });
    expect(pasted[1]).toMatchObject({
      type: "Text",
      parent_id: pasted[0].id,
      props: { text: "Copied" },
    });
  });

  it("round-trips 50 canonical refs through copy, clipboard serialization, paste, and duplicate offset", () => {
    const refs = Array.from({ length: 50 }, (_, index) =>
      makeElement(`instance-${index}`, {
        type: "ref",
        ref: "origin",
        props: {
          label: `Instance ${index}`,
          style: { left: `${index}px`, top: `${index * 2}px` },
        },
      } as never),
    );
    const copied = copyMultipleElements(
      refs.map((element) => element.id),
      new Map(refs.map((element) => [element.id, element])),
    );
    const serialized = serializeCopiedElements(copied);
    const deserialized = deserializeCopiedElements(serialized);

    expect(deserialized).not.toBeNull();
    const pasted = pasteMultipleElements(deserialized!, "page-2", {
      x: 10,
      y: 10,
    });

    expect(pasted).toHaveLength(50);
    for (let index = 0; index < 50; index += 1) {
      expect(pasted[index]).toMatchObject({
        type: "ref",
        ref: "origin",
        page_id: "page-2",
        props: {
          label: `Instance ${index}`,
          style: {
            left: `${index + 10}px`,
            top: `${index * 2 + 10}px`,
          },
        },
      });
      expect(pasted[index].id).not.toBe(`instance-${index}`);
    }
  });
});
