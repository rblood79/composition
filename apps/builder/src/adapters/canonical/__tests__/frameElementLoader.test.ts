import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { CanonicalFrameElementScope } from "../frameElementScope";
import {
  isFrameElementForFrame,
  isLegacyFrameElementForFrame,
} from "../frameElementLoader";

type TestFrameElement = {
  id: string;
  type: string;
  props: Record<string, unknown>;
  deleted?: boolean;
  parent_id?: string | null;
  page_id?: string | null;
  layout_id?: string | null;
};

function makeElement(
  id: string,
  overrides: Partial<TestFrameElement> = {},
): TestFrameElement {
  return {
    id,
    type: "Slot",
    props: {},
    parent_id: "frame-body",
    page_id: null,
    layout_id: "frame-1",
    ...overrides,
  };
}

function makeScope(elementIds: string[]): CanonicalFrameElementScope {
  return {
    bodyElementId: "frame-body",
    elementIds: new Set(elementIds),
    frameId: "frame-1",
  };
}

describe("frame element predicates", () => {
  it("canonical frame scope의 element id를 판별한다", () => {
    const element = makeElement("slot-1");
    expect(isFrameElementForFrame(element, makeScope([element.id]))).toBe(true);
    expect(isFrameElementForFrame(element, makeScope(["other"]))).toBe(false);
  });

  it("legacy frame mirror는 삭제·page element를 제외한다", () => {
    expect(isLegacyFrameElementForFrame(makeElement("slot-1"), "frame-1")).toBe(
      true,
    );
    expect(
      isLegacyFrameElementForFrame(
        makeElement("slot-1", { deleted: true }),
        "frame-1",
      ),
    ).toBe(false);
    expect(
      isLegacyFrameElementForFrame(
        makeElement("slot-1", { page_id: "page-1" }),
        "frame-1",
      ),
    ).toBe(false);
  });

  it("zero-caller hydration/load API를 다시 노출하지 않는다", async () => {
    const source = await readFile(
      resolve(__dirname, "../frameElementLoader.ts"),
      "utf8",
    );
    expect(source).not.toContain("loadFrameElements");
    expect(source).not.toContain("collectHydratedFrameElements");
    expect(source).not.toContain("hasHydratedFrameElements");
  });
});
