import { afterEach, describe, expect, it } from "vitest";
import type { Page } from "../../../../types/core/store.types";
import { useStore } from "../../../stores";
import { useViewportSyncStore } from "../stores";
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
      pagePositions: {},
      pagePositionsByBreakpoint: {},
      pagePositionsVersion: 0,
      pages: [],
    } as never);
    useViewportSyncStore.getState().reset();
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
