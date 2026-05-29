import { describe, expect, it } from "vitest";
import type { Element } from "@/types/builder/unified.types";
import {
  COMPONENT_DESCENDANTS_MIRROR_FIELD,
  COMPONENT_MASTER_ID_MIRROR_FIELD,
  COMPONENT_OVERRIDES_MIRROR_FIELD,
  COMPONENT_ROLE_MIRROR_FIELD,
  getComponentDescendantsMirror,
  getComponentMasterReference,
  getComponentOverridesMirror,
  isComponentInstanceMirrorElement,
  isComponentOriginMirrorElement,
} from "../componentSemanticsMirror";

describe("componentSemanticsMirror adapter helpers", () => {
  it("reads component role and master reference mirrors", () => {
    const origin = {
      id: "origin",
      [COMPONENT_ROLE_MIRROR_FIELD]: "master",
    } as unknown as Element;
    const instance = {
      id: "instance",
      [COMPONENT_ROLE_MIRROR_FIELD]: "instance",
      [COMPONENT_MASTER_ID_MIRROR_FIELD]: "origin",
    } as unknown as Element;

    expect(isComponentOriginMirrorElement(origin)).toBe(true);
    expect(isComponentInstanceMirrorElement(instance)).toBe(true);
    expect(getComponentMasterReference(instance)).toBe("origin");
  });

  it("reads overrides and descendants mirrors", () => {
    const element = {
      id: "instance",
      [COMPONENT_OVERRIDES_MIRROR_FIELD]: { label: "Custom" },
      [COMPONENT_DESCENDANTS_MIRROR_FIELD]: { icon: { name: "check" } },
    } as unknown as Element;

    expect(getComponentOverridesMirror(element)).toEqual({ label: "Custom" });
    expect(getComponentDescendantsMirror(element)).toEqual({
      icon: { name: "check" },
    });
  });
});
