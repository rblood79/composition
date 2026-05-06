import { describe, expect, it } from "vitest";
import { resolveClickTarget } from "./hierarchicalSelection";

describe("resolveClickTarget", () => {
  it("supports projected instance descendants inside an instance editing context", () => {
    const elementsMap = new Map([
      ["body", { id: "body", type: "body", parent_id: null }],
      ["instance", { id: "instance", type: "NumberField", parent_id: "body" }],
      [
        "instance/label",
        { id: "instance/label", type: "Label", parent_id: "instance" },
      ],
    ]);

    expect(resolveClickTarget("instance/label", null, elementsMap)).toBe(
      "instance",
    );
    expect(resolveClickTarget("instance/label", "instance", elementsMap)).toBe(
      "instance/label",
    );
  });

  it("selects page-frame slot children through hidden slot chrome at the root level", () => {
    const elementsMap = new Map([
      ["body", { id: "body", type: "body", parent_id: null }],
      [
        "page::slot-content",
        {
          id: "page::slot-content",
          type: "Slot",
          parent_id: "body",
          props: { _slotChrome: "hidden" },
        },
      ],
      [
        "page-card",
        { id: "page-card", type: "Card", parent_id: "page::slot-content" },
      ],
    ]);

    expect(resolveClickTarget("page-card", null, elementsMap)).toBe(
      "page-card",
    );
  });

  it("keeps visible slots as the root-level selection boundary", () => {
    const elementsMap = new Map([
      ["body", { id: "body", type: "body", parent_id: null }],
      [
        "slot-content",
        {
          id: "slot-content",
          type: "Slot",
          parent_id: "body",
          props: {},
        },
      ],
      [
        "slot-card",
        { id: "slot-card", type: "Card", parent_id: "slot-content" },
      ],
    ]);

    expect(resolveClickTarget("slot-card", null, elementsMap)).toBe(
      "slot-content",
    );
  });
});
