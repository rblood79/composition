import { describe, expect, it } from "vitest";
import {
  withComponentInstanceMirror,
  withComponentOriginMirror,
} from "../../adapters/canonical/componentSemanticsMirror";
import {
  canDetachInstance,
  canDetachLegacyInstance,
  getEditingSemanticsLabel,
  getEditingSemanticsInstanceIds,
  getEditingSemanticsImpactInstanceIds,
  getEditingSemanticsOriginId,
  getEditingSemanticsOverrideFields,
  getEditingSemanticsOverrideItems,
  getEditingSemanticsRole,
  getEditingSlotMarkerRole,
  hasEditingSlotMarker,
} from "./editingSemantics";

describe("editingSemantics", () => {
  it("canonical reusable node is an origin", () => {
    expect(getEditingSemanticsRole({ type: "frame", reusable: true })).toBe(
      "origin",
    );
  });

  it("canonical ref node is an instance", () => {
    expect(getEditingSemanticsRole({ type: "ref", ref: "frame-1" })).toBe(
      "instance",
    );
  });

  it("legacy component roles stay visible during migration", () => {
    expect(getEditingSemanticsRole(withComponentOriginMirror({}))).toBe(
      "origin",
    );
    expect(
      getEditingSemanticsRole(withComponentInstanceMirror({}, "master-1")),
    ).toBe("instance");
  });

  it("plain elements do not show a semantics marker", () => {
    expect(getEditingSemanticsRole({ type: "Button", props: {} })).toBeNull();
    expect(getEditingSemanticsLabel(null)).toBeNull();
  });

  it("detects Pencil-style slot declarations and separates hidden spec chrome from editor markers", () => {
    expect(hasEditingSlotMarker({ type: "frame", slot: ["Text"] })).toBe(true);
    expect(
      hasEditingSlotMarker({
        type: "CardFooter",
        metadata: { slot: ["Button"] },
      }),
    ).toBe(true);
    expect(hasEditingSlotMarker({ type: "Slot", props: {} })).toBe(true);
    expect(
      hasEditingSlotMarker({ type: "Slot", props: { _slotChrome: "hidden" } }),
    ).toBe(false);
    expect(
      hasEditingSlotMarker({
        type: "Slot",
        props: { _slotChrome: "hidden", _slotMarkerChrome: "visible" },
      }),
    ).toBe(true);
  });

  it("colors slot markers by origin or instance context", () => {
    const origin = { id: "origin", type: "frame", reusable: true };
    const originSlot = {
      id: "footer",
      type: "CardFooter",
      parent_id: "origin",
      slot: ["text-origin"],
    };
    const instance = { id: "instance", type: "ref", ref: "origin" };
    const instanceSlot = {
      id: "instance/footer",
      type: "CardFooter",
      parent_id: "instance",
      slot: ["text-origin"],
    };
    const elementsById = new Map<string, unknown>([
      ["origin", origin],
      ["footer", originSlot],
      ["instance", instance],
      ["instance/footer", instanceSlot],
    ]);

    expect(getEditingSlotMarkerRole(originSlot, elementsById)).toBe("origin");
    expect(getEditingSlotMarkerRole(instanceSlot, elementsById)).toBe(
      "instance",
    );
  });

  it("treats visible legacy slots without component ancestry as origin authoring chrome", () => {
    expect(getEditingSlotMarkerRole({ type: "Slot", props: {} })).toBe(
      "origin",
    );
    expect(
      getEditingSlotMarkerRole({
        type: "Slot",
        props: { _slotChrome: "hidden" },
      }),
    ).toBeNull();
    expect(
      getEditingSlotMarkerRole({
        type: "Slot",
        props: { _slotChrome: "hidden", _slotMarkerChrome: "visible" },
      }),
    ).toBe("origin");
  });

  it("resolves canonical and legacy instance origin ids", () => {
    expect(getEditingSemanticsOriginId({ type: "ref", ref: "origin" })).toBe(
      "origin",
    );
    expect(
      getEditingSemanticsOriginId(
        withComponentInstanceMirror({}, "legacy-origin"),
      ),
    ).toBe("legacy-origin");
    expect(getEditingSemanticsOriginId({ reusable: true })).toBeNull();
  });

  it("collects instance ids for an origin", () => {
    expect(
      getEditingSemanticsInstanceIds("origin", [
        { id: "i1", type: "ref", ref: "origin" },
        withComponentInstanceMirror({ id: "i2" }, "origin"),
        { id: "i3", type: "ref", ref: "other-origin" },
        { id: "plain", type: "Button" },
      ]),
    ).toEqual(["i1", "i2"]);
  });

  it("collects impacted instances by id, customId, and componentName", () => {
    expect(
      getEditingSemanticsImpactInstanceIds(
        {
          id: "origin-id",
          customId: "origin-custom",
          componentName: "OriginName",
          reusable: true,
        },
        [
          { id: "i1", type: "ref", ref: "origin-id" },
          { id: "i2", type: "ref", ref: "origin-custom" },
          { id: "i3", type: "ref", ref: "OriginName" },
          { id: "i4", type: "ref", ref: "other" },
        ],
      ),
    ).toEqual(["i1", "i2", "i3"]);
  });

  it("collects impacted instances by canonical name and metadata aliases", () => {
    expect(
      getEditingSemanticsImpactInstanceIds(
        {
          id: "origin-id",
          name: "OriginName",
          metadata: {
            customId: "origin-custom",
            componentName: "OriginComponent",
          },
          reusable: true,
        },
        [
          { id: "i1", type: "ref", ref: "OriginName" },
          { id: "i2", type: "ref", ref: "origin-custom" },
          { id: "i3", type: "ref", ref: "OriginComponent" },
          { id: "i4", type: "ref", ref: "other" },
        ],
      ),
    ).toEqual(["i1", "i2", "i3"]);
  });

  it("counts 1000 impacted instances within the ADR-112 100ms budget", () => {
    const elements = Array.from({ length: 1000 }, (_, index) => ({
      id: `instance-${index}`,
      type: "ref",
      ref: index % 2 === 0 ? "origin-id" : "OriginName",
    }));
    const startedAt = performance.now();
    const impacted = getEditingSemanticsImpactInstanceIds(
      {
        id: "origin-id",
        componentName: "OriginName",
        reusable: true,
      },
      elements,
    );
    const durationMs = performance.now() - startedAt;

    expect(impacted).toHaveLength(1000);
    expect(durationMs).toBeLessThan(100);
  });

  it("allows detach only for legacy instances", () => {
    expect(
      canDetachLegacyInstance(withComponentInstanceMirror({}, "origin")),
    ).toBe(true);
    expect(canDetachLegacyInstance({ type: "ref", ref: "origin" })).toBe(false);
    expect(canDetachLegacyInstance(withComponentOriginMirror({}))).toBe(false);
  });

  it("allows detach for canonical refs with an origin ref", () => {
    expect(canDetachInstance({ type: "ref", ref: "origin" })).toBe(true);
    expect(canDetachInstance(withComponentInstanceMirror({}, "origin"))).toBe(
      true,
    );
    expect(canDetachInstance({ type: "ref" })).toBe(false);
    expect(canDetachInstance({ reusable: true })).toBe(false);
  });

  it("collects legacy instance override fields", () => {
    expect(
      getEditingSemanticsOverrideFields(
        withComponentInstanceMirror({}, "origin", {
          overrideProps: { label: "Override", style: { color: "blue" } },
        }),
      ),
    ).toEqual(["label", "style"]);
  });

  it("collects canonical ref root override fields", () => {
    expect(
      getEditingSemanticsOverrideFields({
        type: "ref",
        props: { label: "Override" },
      }),
    ).toEqual(["label"]);
  });

  it("prefers canonical props for override fields", () => {
    expect(
      getEditingSemanticsOverrideFields({
        type: "ref",
        props: { label: "Override" },
      }),
    ).toEqual(["label"]);
  });

  it("collects canonical descendant override items", () => {
    expect(
      getEditingSemanticsOverrideItems({
        type: "ref",
        props: { label: "Root override" },
        descendants: {
          "slot/label": { text: "Descendant override" },
          icon: {
            props: { name: "check" },
          },
          structure: { children: [{ type: "Text", text: "Ignored" }] },
        },
      }),
    ).toEqual([
      {
        fieldKey: "label",
        id: "root:label",
        label: "label",
      },
      {
        descendantPath: "slot/label",
        fieldKey: "text",
        id: "descendant:slot/label:text",
        label: "slot/label.text",
      },
      {
        descendantPath: "icon",
        fieldKey: "name",
        id: "descendant:icon:name",
        label: "icon.name",
      },
    ]);
  });
});
