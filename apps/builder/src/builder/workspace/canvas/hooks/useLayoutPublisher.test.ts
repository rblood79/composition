import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LayoutPublisherInput } from "../renderers";
import { useLayoutPublisher } from "./useLayoutPublisher";
import { createPageLayoutSignature } from "../scene/layoutCache";
import { publishLayoutMapsBatch } from "../layout";

vi.mock("../layout", () => ({
  publishLayoutMapsBatch: vi.fn(),
  publishFilteredChildrenMap: vi.fn(),
  publishSyntheticElementsMap: vi.fn(),
}));
vi.mock("../../../stores", () => ({
  useStore: { getState: () => ({ activeBreakpoint: "desktop" }) },
}));
vi.mock("../scene/layoutCache", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../scene/layoutCache")>();
  return {
    ...actual,
    createPageLayoutSignature: vi.fn(actual.createPageLayoutSignature),
    getCachedPageLayout: vi.fn(() => new Map()),
  };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const makePages = (width = "100px", ready = false) => {
  const body = {
    id: "body",
    type: "Body",
    page_id: "page",
    parent_id: null,
    props: { style: { width } },
  };
  return [
    {
      pageId: "page",
      input: {
        bodyElement: body,
        pageElements: [],
        elementById: new Map([[body.id, body]]),
        projectionVersion: 1,
        pageWidth: 800,
        pageHeight: 600,
        wasmLayoutReady: ready,
      } as unknown as LayoutPublisherInput,
    },
  ];
};
const frames: ReturnType<typeof makePages> = [];

describe("layout publisher memo lifetime", () => {
  it("reuses unchanged inputs but republishes changed inputs without a layout version bump", () => {
    const pages = makePages();
    const { rerender } = renderHook(
      ({ pages, version }) => useLayoutPublisher(pages, frames, version),
      {
        initialProps: { pages, version: 1 },
      },
    );
    expect(createPageLayoutSignature).toHaveBeenCalledTimes(1);
    expect(publishLayoutMapsBatch).toHaveBeenCalledTimes(1);
    rerender({ pages, version: 1 });
    expect(createPageLayoutSignature).toHaveBeenCalledTimes(1);
    expect(publishLayoutMapsBatch).toHaveBeenCalledTimes(1);
    rerender({ pages: makePages("200px"), version: 1 });
    expect(createPageLayoutSignature).toHaveBeenCalledTimes(2);
    expect(publishLayoutMapsBatch).toHaveBeenCalledTimes(2);
  });

  it("recomputes a layout invalidation and publishes pending inputs once WASM is ready", () => {
    const pages = makePages();
    const { rerender } = renderHook(
      ({ version }) => useLayoutPublisher(pages, frames, version),
      {
        initialProps: { version: 1 },
      },
    );
    pages[0].input.bodyElement!.props.style = { width: "200px" };
    rerender({ version: 2 });
    expect(createPageLayoutSignature).toHaveBeenCalledTimes(2);
    pages[0].input.wasmLayoutReady = true;
    rerender({ version: 2 });
    expect(publishLayoutMapsBatch).toHaveBeenLastCalledWith(
      [{ key: "page", map: new Map() }],
      [],
    );
  });
});
