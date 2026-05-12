import { beforeEach, describe, expect, it } from "vitest";
import type { Element } from "@/types/core/store.types";
import { useCanonicalDocumentStore } from "@/builder/stores/canonical/canonicalDocumentStore";
import {
  collectHydratedFrameElements,
  hasHydratedFrameElements,
  isFrameElementForFrame,
  isLegacyFrameElementForFrame,
  loadFrameElements,
} from "../frameElementLoader";
import type { CanonicalFrameElementScope } from "../frameElementScope";

function makeElement(id: string, overrides: Partial<Element> = {}): Element {
  return {
    id,
    type: "Slot",
    page_id: null,
    parent_id: "frame-body",
    layout_id: "frame-1",
    order_num: 1,
    props: {},
    ...overrides,
  } as Element;
}

function makeScope(
  frameId: string,
  elementIds: string[],
): CanonicalFrameElementScope {
  return {
    bodyElementId: null,
    elementIds: new Set(elementIds),
    frameId,
  };
}

function setFrameDocument(children: Array<Record<string, unknown>>) {
  useCanonicalDocumentStore.setState({
    currentProjectId: "project-1",
    documents: new Map([
      [
        "project-1",
        {
          version: "composition-1.0",
          children: [
            {
              id: "layout-frame-1",
              type: "frame",
              reusable: true,
              metadata: { type: "legacy-layout", layoutId: "frame-1" },
              children,
            },
          ],
        },
      ],
    ]),
    documentVersion: 0,
  });
}

describe("frameElementLoader canonical adapter", () => {
  beforeEach(() => {
    useCanonicalDocumentStore.setState({
      currentProjectId: null,
      documents: new Map(),
      documentVersion: 0,
    });
  });

  it("uses canonical descendants when they include the frame body", async () => {
    setFrameDocument([
      {
        id: "body-1",
        type: "body",
        props: {},
        children: [{ id: "slot-1", type: "Slot", props: {} }],
      },
    ]);

    await expect(loadFrameElements("frame-1")).resolves.toEqual([
      expect.objectContaining({ id: "body-1", type: "body" }),
      expect.objectContaining({ id: "slot-1", type: "Slot" }),
    ]);
  });

  it("returns canonical frame scope elements without reading legacy DB mirrors", async () => {
    setFrameDocument([
      { id: "body-1", type: "body", props: {} },
      { id: "slot-1", type: "Slot", props: {} },
    ]);

    await expect(loadFrameElements("frame-1")).resolves.toEqual([
      expect.objectContaining({ id: "body-1" }),
      expect.objectContaining({ id: "slot-1" }),
    ]);
  });

  it("returns an empty list when the active canonical document is missing", async () => {
    await expect(loadFrameElements("frame-1")).resolves.toEqual([]);
  });

  it("reports hydrated frame elements from canonical frame scope", () => {
    const elementsMap = new Map<string, Element>([
      ["page-button", makeElement("page-button", { page_id: "page-1" })],
      ["deleted", makeElement("deleted", { deleted: true })],
      ["frame-slot", makeElement("frame-slot")],
    ]);
    const scope = makeScope("frame-1", ["frame-slot"]);

    expect(hasHydratedFrameElements(elementsMap, scope)).toBe(true);
    expect(
      hasHydratedFrameElements(elementsMap, makeScope("frame-2", ["missing"])),
    ).toBe(false);
    expect(collectHydratedFrameElements(elementsMap, scope)).toEqual([
      expect.objectContaining({ id: "frame-slot" }),
    ]);
    expect(
      isFrameElementForFrame(
        makeElement("deleted", { deleted: true }),
        makeScope("frame-1", ["deleted"]),
      ),
    ).toBe(false);
    expect(isFrameElementForFrame(makeElement("frame-slot"), scope)).toBe(true);
  });

  it("keeps legacy layout_id matching behind explicit fallback naming", () => {
    expect(
      isLegacyFrameElementForFrame(makeElement("frame-slot"), "frame-1"),
    ).toBe(true);
    expect(
      isLegacyFrameElementForFrame(
        makeElement("page-button", { layout_id: null, page_id: "page-1" }),
        "frame-1",
      ),
    ).toBe(false);
  });

  it("accepts canonical layoutId when legacy layout_id is absent", () => {
    expect(
      isLegacyFrameElementForFrame(
        makeElement("frame-slot", {
          layout_id: undefined,
          // @ts-expect-error 테스트: canonical 필드 시뮬레이션
          layoutId: "frame-1",
        }),
        "frame-1",
      ),
    ).toBe(true);
  });
});
