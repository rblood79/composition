import { describe, it, expect } from "vitest";
import { TAG_SPEC_MAP, getElementForTag } from "../runtime/tagToElement";
import { FrameSpec } from "../components/Frame.spec";

// ADR-130 Phase 1 — Gate G1
describe("FrameSpec (ADR-130)", () => {
  it("getSpecForTag('frame') !== undefined", () => {
    expect(TAG_SPEC_MAP["frame"]).toBeDefined();
    expect(TAG_SPEC_MAP["frame"]).toBe(FrameSpec);
  });

  it("getElementForTag('frame') === 'div'", () => {
    expect(getElementForTag("frame")).toBe("div");
  });

  it("FrameSpec.skipCSSGeneration === true", () => {
    expect(FrameSpec.skipCSSGeneration).toBe(true);
  });

  it("FrameSpec.name === 'frame'", () => {
    expect(FrameSpec.name).toBe("frame");
  });
});
