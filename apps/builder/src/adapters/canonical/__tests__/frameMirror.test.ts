import { describe, expect, it } from "vitest";
import type { FrameNode } from "@composition/shared";
import type { Element, Page } from "@/types/builder/unified.types";
import {
  getFrameElementMirrorId,
  getNullablePageFrameBindingId,
  getPageFrameBindingId,
  getReusableFrameMirrorId,
  hasFrameElementMirrorId,
  withFrameElementMirrorId,
  withPageFrameBinding,
} from "../frameMirror";

describe("frameMirror adapter helpers", () => {
  it("reads and writes page frame binding mirror payloads", () => {
    const page = { id: "page-1", layout_id: "frame-1" } as Page;

    expect(getNullablePageFrameBindingId(page)).toBe("frame-1");
    expect(getPageFrameBindingId(page)).toBe("frame-1");
    expect(getPageFrameBindingId(null)).toBe("");
    expect(
      getNullablePageFrameBindingId({
        id: "page-2",
        layoutId: "frame-2",
      } as Page),
    ).toBe("frame-2");
    expect(withPageFrameBinding({ id: "page-2" }, null)).toEqual({
      id: "page-2",
      layout_id: null,
    });
  });

  it("normalizes canonical reusable frame ids to mirror frame ids", () => {
    expect(
      getReusableFrameMirrorId({
        id: "layout-frame-1",
        type: "frame",
        reusable: true,
      } as FrameNode),
    ).toBe("frame-1");
    expect(
      getReusableFrameMirrorId({
        id: "canonical-frame",
        type: "frame",
        reusable: true,
        metadata: { layoutId: "frame-2" },
      } as FrameNode),
    ).toBe("frame-2");
    expect(
      getReusableFrameMirrorId({
        id: "native-frame",
        type: "frame",
        reusable: true,
      } as FrameNode),
    ).toBe("native-frame");
  });

  it("reads frame element mirror id", () => {
    expect(
      getFrameElementMirrorId({ id: "body", layout_id: "frame-1" } as Element),
    ).toBe("frame-1");
    expect(
      getFrameElementMirrorId({ id: "body", layoutId: "frame-3" } as Element),
    ).toBe("frame-3");
    expect(hasFrameElementMirrorId({ id: "body", layout_id: "frame-1" })).toBe(
      true,
    );
    expect(hasFrameElementMirrorId({ id: "body", layoutId: "frame-3" })).toBe(
      true,
    );
    expect(getFrameElementMirrorId({ id: "body" } as Element)).toBeNull();
    expect(hasFrameElementMirrorId({ id: "body" })).toBe(false);
    expect(withFrameElementMirrorId({ id: "body" }, "frame-2")).toEqual({
      id: "body",
      layout_id: "frame-2",
    });
  });

  it("normalizes layout-id alias values while reading mirror ids", () => {
    expect(
      getFrameElementMirrorId({
        id: "body",
        layout_id: "layout-frame-1",
      } as Element),
    ).toBe("frame-1");
    expect(
      getNullablePageFrameBindingId({
        id: "page-3",
        layout_id: "layout-frame-7",
      } as Page),
    ).toBe("frame-7");
  });
});
