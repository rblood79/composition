import { afterEach, describe, expect, it } from "vitest";
import type { Page } from "../../../types/core/store.types";
import { useStore } from "..";
import { useViewportSyncStore } from "../../workspace/canvas/stores";
import { alignPagesToScreen } from "../../workspace/canvas/viewport/pageLayoutActions";

/**
 * ADR-231 — 시스템 페이지 (Components) 위치는 breakpoint 공통값 하나 (리뷰 round 2 m2).
 * 전환은 시스템 위치를 읽지도 쓰지도 않고, 드래그·align 은 세 breakpoint 에 같은 값을 쓴다.
 */
const makePage = (id: string, extra: Partial<Page> = {}): Page =>
  ({ id, project_id: "project-1", slug: id, title: id, ...extra }) as Page;
const components = makePage("page-components", {
  slug: "/__components",
  title: "Components",
});
const home = makePage("home", { slug: "/" });
const p2 = makePage("p2");

const reset = () =>
  useStore.setState({
    activeBreakpoint: "desktop",
    pageLayoutDirection: "vertical",
    pageGap: 80,
    pagePositions: {},
    pagePositionsByBreakpoint: {},
    pagePositionsVersion: 0,
    pages: [],
  } as never);

describe("시스템 페이지 위치 = breakpoint 공통값", () => {
  afterEach(() => {
    reset();
    useViewportSyncStore.getState().reset();
  });

  it("전환: 대상 스냅샷 · 첫 진입 배치는 사용자 페이지만 — Components 는 현재값 그대로 (드래그 (−2500,200) 보존)", () => {
    useStore.setState({
      pages: [components, home, p2],
      pagePositions: {
        "page-components": { x: -2500, y: 200 },
        home: { x: 0, y: 0 },
        p2: { x: 0, y: 1160 },
      },
      pagePositionsByBreakpoint: {
        desktop: {
          "page-components": { x: -2500, y: 200 },
          home: { x: 0, y: 0 },
          p2: { x: 0, y: 1160 },
        },
        // 기존 문서: mobile 스냅샷에 Components 가 (0,0) 으로 남아 있어도 읽지 않는다
        mobile: { "page-components": { x: 0, y: 0 }, home: { x: 0, y: 0 }, p2: { x: 0, y: 924 } },
      },
    } as never);
    const st = useStore.getState();
    // tablet 첫 진입 (스냅샷 없음)
    st.switchPagePositionsBreakpoint("desktop", "tablet", {
      pageWidth: 768,
      pageHeight: 1024,
      gap: 80,
      direction: "vertical",
      availableWidth: 2000,
      pageStartX: 0,
    });
    let positions = useStore.getState().pagePositions;
    expect(positions["page-components"]).toEqual({ x: -2500, y: 200 });
    expect(positions.home).toEqual({ x: 0, y: 0 });
    expect(positions.p2).toEqual({ x: 0, y: 1104 });
    // mobile — 저장된 스냅샷은 사용자 페이지에만
    useStore.getState().switchPagePositionsBreakpoint("tablet", "mobile");
    positions = useStore.getState().pagePositions;
    expect(positions["page-components"]).toEqual({ x: -2500, y: 200 });
    expect(positions.p2).toEqual({ x: 0, y: 924 });
    useStore.getState().switchPagePositionsBreakpoint("mobile", "desktop");
    expect(useStore.getState().pagePositions["page-components"]).toEqual({ x: -2500, y: 200 });
  });

  it("드래그 (updatePagePosition): 시스템 페이지는 세 breakpoint 스냅샷에 같은 값", () => {
    useStore.setState({
      pages: [components, home],
      pagePositions: { "page-components": { x: -2000, y: 0 }, home: { x: 0, y: 0 } },
      pagePositionsByBreakpoint: {
        desktop: { "page-components": { x: -2000, y: 0 }, home: { x: 0, y: 0 } },
        mobile: { "page-components": { x: -2000, y: 0 }, home: { x: 0, y: 0 } },
      },
    } as never);
    useStore.getState().updatePagePosition("page-components", -2600, 300);
    const by = useStore.getState().pagePositionsByBreakpoint;
    expect(by.desktop?.["page-components"]).toEqual({ x: -2600, y: 300 });
    expect(by.mobile?.["page-components"]).toEqual({ x: -2600, y: 300 });
    // 사용자 페이지는 활성 breakpoint 만
    useStore.getState().updatePagePosition("home", 10, 10);
    expect(useStore.getState().pagePositionsByBreakpoint.mobile?.home).toEqual({ x: 0, y: 0 });
  });

  it("hydration (initializePagePositions): breakpoint 별 값이 다른 기존 문서는 활성 breakpoint 값을 공통값으로", () => {
    useStore.setState({ activeBreakpoint: "mobile", pages: [components, home] } as never);
    useStore.getState().initializePagePositions(
      [components, home],
      390,
      844,
      80,
      "vertical",
      {
        "page-components": { desktop: { x: 0, y: 0 }, mobile: { x: 10, y: 10 } },
        home: { desktop: { x: 0, y: 0 }, mobile: { x: 0, y: 0 } },
      },
    );
    const st = useStore.getState();
    expect(st.pagePositions["page-components"]).toEqual({ x: 10, y: 10 });
    expect(st.pagePositionsByBreakpoint.desktop?.["page-components"]).toEqual({ x: 10, y: 10 });
    expect(st.pagePositionsByBreakpoint.mobile?.["page-components"]).toEqual({ x: 10, y: 10 });
  });

  it("align: Home (0,0) · Components 는 왼쪽 시스템 열 · 세 breakpoint 같은 값", () => {
    useStore.setState({
      pages: [components, home, p2],
      pagePositions: {
        "page-components": { x: 0, y: 0 },
        home: { x: 2000, y: 0 },
        p2: { x: 4000, y: 0 },
      },
      pagePositionsByBreakpoint: {
        desktop: { "page-components": { x: 0, y: 0 }, home: { x: 2000, y: 0 }, p2: { x: 4000, y: 0 } },
        tablet: { "page-components": { x: 0, y: 0 }, home: { x: 0, y: 0 } },
      },
    } as never);
    useViewportSyncStore.getState().setCanvasSize({ width: 1920, height: 1080 });
    alignPagesToScreen();
    const st = useStore.getState();
    expect(st.pagePositions.home).toEqual({ x: 0, y: 0 });
    expect(st.pagePositions.p2).toEqual({ x: 0, y: 1160 });
    expect(st.pagePositions["page-components"]).toEqual({ x: -2000, y: 0 });
    expect(st.pagePositionsByBreakpoint.tablet?.["page-components"]).toEqual({ x: -2000, y: 0 });
  });
});
