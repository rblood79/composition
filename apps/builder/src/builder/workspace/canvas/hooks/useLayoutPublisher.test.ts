import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LayoutPublisherInput } from "../renderers";
import { useLayoutPublisher } from "./useLayoutPublisher";
import { createPageLayoutSignature, getCachedPageLayout } from "../scene/layoutCache";
import { publishLayoutMapsBatch } from "../layout";
import { useViewportSyncStore } from "../stores";

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
    getCachedPageLayout: vi.fn(
      (input: { bodyElement?: { id: string } | null; breakpointNeutralRoot?: boolean }) =>
        input.breakpointNeutralRoot && input.bodyElement
          ? new Map([[input.bodyElement.id, { x: 0, y: 0, width: 1920, height: 2600 }]])
          : new Map(),
    ),
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

describe("ADR-231 — breakpoint 중립 페이지의 body 높이 발행 (R1 루프 차단)", () => {
  const makeNeutralPage = (projectionVersion = 1) => {
    const body = {
      id: "body-c",
      type: "Body",
      page_id: "page-components",
      parent_id: null,
      props: { style: { overflow: "auto" } },
    };
    return [
      {
        pageId: "page-components",
        input: {
          bodyElement: body,
          pageElements: [],
          elementById: new Map([[body.id, body]]),
          projectionVersion,
          pageWidth: 1920,
          pageHeight: 1080,
          wasmLayoutReady: true,
          breakpointNeutralRoot: true,
        } as unknown as LayoutPublisherInput,
      },
    ];
  };

  it("발행된 body 높이를 viewport store 에 싣고, 엔진 입력 (pageWidth/pageHeight) 은 상수 그대로", () => {
    useViewportSyncStore.getState().reset();
    renderHook(() => useLayoutPublisher(makeNeutralPage(), frames, 1));
    expect(useViewportSyncStore.getState().pageContentHeights.get("page-components")).toBe(2600);
    const call = vi.mocked(getCachedPageLayout).mock.calls.at(-1)?.[0];
    expect(call?.pageWidth).toBe(1920);
    expect(call?.pageHeight).toBe(1080);
    expect(call?.breakpointNeutralRoot).toBe(true);
  });

  it("frame 높이 갱신으로 projectionVersion 이 올라 effect 가 재실행돼도 같은 높이는 store no-op (참조 유지)", () => {
    useViewportSyncStore.getState().reset();
    const { rerender } = renderHook(
      ({ pages }) => useLayoutPublisher(pages, frames, 1),
      { initialProps: { pages: makeNeutralPage(1) } },
    );
    const first = useViewportSyncStore.getState().pageContentHeights;
    expect(first.get("page-components")).toBe(2600);
    rerender({ pages: makeNeutralPage(2) });
    expect(useViewportSyncStore.getState().pageContentHeights).toBe(first);
  });
});
