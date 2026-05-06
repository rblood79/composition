import { describe, expect, it } from "vitest";
import type { Element } from "../../types/core/store.types";
import { withComponentInstanceMirror } from "@/adapters/canonical/componentSemanticsMirror";
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
      customId: "button_1",
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

    const pasted = pasteMultipleElements(copied, "page-1", { x: 10, y: 10 }, [
      origin,
      child,
    ]);

    expect(pasted).toHaveLength(1);
    expect(pasted[0]).toMatchObject(
      withComponentInstanceMirror(
        {
          type: "ref",
          ref: "origin",
          parent_id: "body",
          page_id: "page-1",
          componentName: "Primary Button",
          props: { style: { left: "30px", top: "40px" } },
        },
        "origin",
      ),
    );
    expect(pasted[0].id).not.toBe("origin");
    expect(pasted[0].customId).toBe("button_2");
    expect(pasted.find((element) => element.type === "Text")).toBeUndefined();
  });

  it("keeps standard element paste as a subtree copy", () => {
    const box = makeElement("box", { type: "Box", customId: "box_1" });
    const label = makeElement("label", {
      type: "Text",
      customId: "text_1",
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

    const pasted = pasteMultipleElements(copied, "page-1", { x: 10, y: 10 }, [
      box,
      label,
    ]);

    expect(pasted).toHaveLength(2);
    expect(pasted[0]).toMatchObject({ type: "Box", customId: "box_2" });
    expect(pasted[1]).toMatchObject({
      type: "Text",
      customId: "text_2",
      parent_id: pasted[0].id,
      props: { text: "Copied" },
    });
    expect(new Set(pasted.map((element) => element.customId)).size).toBe(2);
  });

  it("round-trips 50 canonical refs through copy, clipboard serialization, paste, and duplicate offset", () => {
    const refs = Array.from({ length: 50 }, (_, index) =>
      makeElement(`instance-${index}`, {
        type: "ref",
        customId: `button_${index + 1}`,
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
    const pasted = pasteMultipleElements(
      deserialized!,
      "page-2",
      {
        x: 10,
        y: 10,
      },
      refs,
    );

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
      expect(pasted[index].customId).toBe(`button_${index + 51}`);
    }
  });
});
