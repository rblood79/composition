import { afterEach, describe, expect, it } from "vitest";
import type { Page } from "../../../../types/core/store.types";
import { useStore } from "../../../stores";
import { normalizePageLayoutDirection } from "../../../stores/canvasSettings";
import { useViewportSyncStore } from "../stores";
import { PAGE_STACK_GAP } from "../pageLayoutConstants";
import { alignPagesToScreen } from "./pageLayoutActions";

const makePage = (id: string): Page =>
  ({
    id,
    project_id: "project-1",
    slug: id,
    title: id,
  }) as Page;

describe("alignPagesToScreen", () => {
  afterEach(() => {
    useStore.setState({
      activeBreakpoint: "desktop",
      pageLayoutDirection: "horizontal",
      pageGap: PAGE_STACK_GAP,
      pagePositions: {},
      pagePositionsByBreakpoint: {},
      pagePositionsVersion: 0,
      pages: [],
    } as never);
    useViewportSyncStore.getState().reset();
  });

  it("legacy zigzag 값은 auto로 정규화한다", () => {
    expect(normalizePageLayoutDirection("zigzag")).toBe("auto");
  });

  it("Page Layout 기본값은 auto다", () => {
    expect(useStore.getInitialState().pageLayoutDirection).toBe("auto");
    expect(useStore.getInitialState().pageGap).toBe(PAGE_STACK_GAP);
  });

  it("Page Gap 설정은 음수를 기본값으로 되돌리고 유효한 값을 저장한다", () => {
    useStore.getState().setPageGap(120);
    expect(useStore.getState().pageGap).toBe(120);

    useStore.getState().setPageGap(-1);
    expect(useStore.getState().pageGap).toBe(PAGE_STACK_GAP);
  });

  it("uses the Settings direction and current breakpoint canvas size", () => {
    useStore.setState({
      pageLayoutDirection: "vertical",
      pages: [makePage("page-1"), makePage("page-2")],
      pagePositions: {
        "page-1": { x: 320, y: 240 },
        "page-2": { x: 960, y: 480 },
      },
    } as never);
    useViewportSyncStore.getState().setCanvasSize({
      width: 640,
      height: 480,
    });

    alignPagesToScreen();

    expect(useStore.getState().pagePositions).toEqual({
      "page-1": { x: 0, y: 0 },
      "page-2": { x: 0, y: 560 },
    });
    expect(useStore.getState().pagePositionsByBreakpoint.desktop).toEqual(
      useStore.getState().pagePositions,
    );
    expect(useStore.getState().pagePositionsVersion).toBe(1);
  });

  it("auto 배치는 zoom을 반영한 화면 폭 안에 최대 page를 한 줄로 둔다", () => {
    const pages = [
      makePage("page-1"),
      makePage("page-2"),
      makePage("page-3"),
      makePage("page-4"),
    ];
    useStore.setState({
      pageLayoutDirection: "auto",
      pages,
      pagePositions: Object.fromEntries(
        pages.map((page, index) => [page.id, { x: index * 2000, y: 0 }]),
      ),
    } as never);
    useViewportSyncStore.getState().setCanvasSize({
      width: 1920,
      height: 1080,
    });
    useViewportSyncStore.getState().setContainerSize({
      width: 2200,
      height: 900,
    });
    useViewportSyncStore.getState().setViewportSnapshot({
      panOffset: { x: 0, y: 0 },
      zoom: 0.5,
    });

    alignPagesToScreen();

    expect(useStore.getState().pagePositions).toEqual({
      "page-1": { x: 0, y: 0 },
      "page-2": { x: 2000, y: 0 },
      "page-3": { x: 0, y: 1160 },
      "page-4": { x: 2000, y: 1160 },
    });
  });

  it("auto 배치는 좌·우 panel 폭과 side gap을 browser 폭에 포함한다", () => {
    const pages = [makePage("page-1"), makePage("page-2")];
    useStore.setState({
      pageLayoutDirection: "auto",
      pageGap: 100,
      pages,
      pagePositions: {
        "page-1": { x: 0, y: 0 },
        "page-2": { x: 2000, y: 0 },
      },
    } as never);
    useViewportSyncStore.getState().setCanvasSize({
      width: 600,
      height: 400,
    });
    useViewportSyncStore.getState().setContainerSize({
      width: 700,
      height: 900,
    });
    useViewportSyncStore.getState().setPageLayoutPanelMetrics({
      leftWidth: 300,
      rightWidth: 300,
      gap: 4,
    });
    useViewportSyncStore.getState().setViewportSnapshot({
      panOffset: { x: 0, y: 0 },
      zoom: 1,
    });

    alignPagesToScreen();

    expect(useStore.getState().pagePositions).toEqual({
      "page-1": { x: 0, y: 0 },
      "page-2": { x: 700, y: 0 },
    });
  });

  it("does not change manually positioned pages when canvas size is unavailable", () => {
    const pagePositions = { "page-1": { x: 320, y: 240 } };
    useStore.setState({
      pages: [makePage("page-1")],
      pagePositions,
    } as never);
    useViewportSyncStore.getState().setCanvasSize({
      width: 0,
      height: 0,
    });

    alignPagesToScreen();

    expect(useStore.getState().pagePositions).toBe(pagePositions);
  });

  it("keeps alignment isolated between active breakpoint snapshots", () => {
    const pages = [makePage("page-1"), makePage("page-2")];
    useStore.setState({
      activeBreakpoint: "desktop",
      pageLayoutDirection: "horizontal",
      pages,
      pagePositions: {
        "page-1": { x: 120, y: 40 },
        "page-2": { x: 960, y: 80 },
      },
      pagePositionsByBreakpoint: {},
    } as never);
    useViewportSyncStore.getState().setCanvasSize({
      width: 640,
      height: 480,
    });

    alignPagesToScreen();
    const desktopPositions = useStore.getState().pagePositions;

    useStore.getState().switchPagePositionsBreakpoint("desktop", "tablet");
    useStore.setState({
      activeBreakpoint: "tablet",
      pageLayoutDirection: "vertical",
    } as never);
    alignPagesToScreen();

    expect(useStore.getState().pagePositions).toEqual({
      "page-1": { x: 0, y: 0 },
      "page-2": { x: 0, y: 560 },
    });

    useStore.getState().switchPagePositionsBreakpoint("tablet", "desktop");

    expect(useStore.getState().pagePositions).toEqual(desktopPositions);
  });

  it("does not capture an empty breakpoint snapshot before project pages hydrate", () => {
    useStore.setState({
      activeBreakpoint: "desktop",
      pages: [],
      pagePositions: {},
      pagePositionsByBreakpoint: {},
    } as never);

    useStore.getState().switchPagePositionsBreakpoint("desktop", "tablet");

    expect(useStore.getState().pagePositionsByBreakpoint).toEqual({});
  });

  it("initializes a first-entry breakpoint with that breakpoint canvas size", () => {
    const pages = [makePage("page-1"), makePage("page-2")];
    useStore.setState({
      activeBreakpoint: "mobile",
      pages,
      pagePositions: {
        "page-1": { x: 0, y: 0 },
        "page-2": { x: 470, y: 0 },
      },
      pagePositionsByBreakpoint: {
        mobile: {
          "page-1": { x: 0, y: 0 },
          "page-2": { x: 470, y: 0 },
        },
      },
    } as never);

    useStore.getState().switchPagePositionsBreakpoint("mobile", "desktop", {
      pageWidth: 1920,
      pageHeight: 1080,
      gap: 80,
      direction: "horizontal",
    });

    expect(useStore.getState().pagePositions).toEqual({
      "page-1": { x: 0, y: 0 },
      "page-2": { x: 2000, y: 0 },
    });
  });

  it("clears stale breakpoint snapshots when a different project page set initializes", () => {
    useStore.setState({
      activeBreakpoint: "desktop",
      pages: [makePage("old-page")],
      pagePositions: { "old-page": { x: 0, y: 0 } },
      pagePositionsByBreakpoint: {
        desktop: { "old-page": { x: 0, y: 0 } },
        tablet: { "old-page": { x: 470, y: 0 } },
      },
    } as never);

    useStore
      .getState()
      .initializePagePositions(
        [makePage("new-page")],
        390,
        844,
        80,
        "horizontal",
      );

    expect(useStore.getState().pagePositionsByBreakpoint).toEqual({
      desktop: { "new-page": { x: 0, y: 0 } },
    });
  });

  it("preserves a manually moved page when returning to its breakpoint", () => {
    const pages = [makePage("page-1"), makePage("page-2")];
    useStore.setState({
      activeBreakpoint: "desktop",
      pages,
      pagePositions: {
        "page-1": { x: 0, y: 0 },
        "page-2": { x: 720, y: 0 },
      },
      pagePositionsByBreakpoint: {},
    } as never);

    useStore.getState().updatePagePosition("page-2", 120, 240);
    useStore.getState().switchPagePositionsBreakpoint("desktop", "tablet");
    useStore.getState().switchPagePositionsBreakpoint("tablet", "desktop");

    expect(useStore.getState().pagePositions["page-2"]).toEqual({
      x: 120,
      y: 240,
    });
  });
});
