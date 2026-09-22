import { afterEach, describe, expect, it } from "vitest";
import type { Page } from "../../../types/core/store.types";
import { useStore } from "..";
import { useCanonicalDocumentStore } from "../canonical/canonicalDocumentStore";

/**
 * 사용자 보고 (2026-09-22): 새 프로젝트에서 페이지를 여럿 추가한 뒤 breakpoint 를 바꾸면 한 곳이
 * 맞으면 다른 곳이 어긋난다. 원인 — 새 페이지 위치는 활성 breakpoint 스냅샷에만 쓰이고, 전환 시
 * 대상 스냅샷에 없는 페이지는 **현재 breakpoint 좌표를 그대로** 가져와 다른 격자 (1920 ↔ 768/390)
 * 에 섞어 저장했다. 대상 스냅샷에 없는 사용자 페이지는 대상 breakpoint 격자에서 다음 칸을 새로
 * 계산해야 한다.
 */
const makePage = (id: string): Page =>
  ({ id, project_id: "project-1", slug: `/${id}`, title: id }) as Page;
const home = makePage("home");
const p2 = makePage("p2");
const p3 = makePage("p3");

const reset = () =>
  useStore.setState({
    activeBreakpoint: "desktop",
    pageLayoutDirection: "auto",
    pageGap: 80,
    pagePositions: {},
    pagePositionsByBreakpoint: {},
    pagePositionsVersion: 0,
    pages: [],
  } as never);

describe("breakpoint 전환 — 대상 스냅샷에 없는 페이지는 대상 격자에서 배치한다", () => {
  afterEach(reset);

  it("desktop 에서 추가한 p3 (4000,0) 은 tablet 스냅샷에 없다 → tablet 격자 다음 칸 (첫 행 2열 → (0,1104)), desktop 좌표 그대로가 아니다", () => {
    useStore.setState({
      pages: [home, p2, p3],
      pagePositions: {
        home: { x: 0, y: 0 },
        p2: { x: 2000, y: 0 },
        p3: { x: 4000, y: 0 },
      },
      pagePositionsByBreakpoint: {
        desktop: {
          home: { x: 0, y: 0 },
          p2: { x: 2000, y: 0 },
          p3: { x: 4000, y: 0 },
        },
        // tablet 은 p3 추가 전에 만들어진 스냅샷
        tablet: { home: { x: 0, y: 0 }, p2: { x: 848, y: 0 } },
      },
    } as never);
    useStore.getState().switchPagePositionsBreakpoint("desktop", "tablet", {
      pageWidth: 768,
      pageHeight: 1024,
      gap: 80,
      direction: "auto",
      availableWidth: 4000,
      pageStartX: 0,
    });
    const st = useStore.getState();
    expect(st.pagePositions).toEqual({
      home: { x: 0, y: 0 },
      p2: { x: 848, y: 0 },
      p3: { x: 0, y: 1104 },
    });
    // 저장된 tablet 스냅샷도 같은 값 (다음 전환에서 다시 계산하지 않는다)
    expect(st.pagePositionsByBreakpoint.tablet?.p3).toEqual({ x: 0, y: 1104 });
    // desktop 스냅샷은 손대지 않는다
    expect(st.pagePositionsByBreakpoint.desktop?.p3).toEqual({ x: 4000, y: 0 });
  });

  it("역방향: tablet 에서 추가한 p3 (1696,0) 은 desktop 격자 다음 칸 (0,1160) — 1920 격자에 768 좌표가 섞이지 않고 겹침 0", () => {
    useStore.setState({
      activeBreakpoint: "tablet",
      pages: [home, p2, p3],
      pagePositions: {
        home: { x: 0, y: 0 },
        p2: { x: 848, y: 0 },
        p3: { x: 1696, y: 0 },
      },
      pagePositionsByBreakpoint: {
        tablet: {
          home: { x: 0, y: 0 },
          p2: { x: 848, y: 0 },
          p3: { x: 1696, y: 0 },
        },
        desktop: { home: { x: 0, y: 0 }, p2: { x: 2000, y: 0 } },
      },
    } as never);
    useStore.getState().switchPagePositionsBreakpoint("tablet", "desktop", {
      pageWidth: 1920,
      pageHeight: 1080,
      gap: 80,
      direction: "auto",
      availableWidth: 8000,
      pageStartX: 0,
    });
    const positions = useStore.getState().pagePositions;
    expect(positions.p3).toEqual({ x: 0, y: 1160 });
    // 두 페이지가 같은 칸에 있지 않다
    const keys = Object.values(positions).map((p) => `${p.x},${p.y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("여러 페이지가 빠져 있어도 순서대로 격자에 채운다 (vertical: 누적 y)", () => {
    useStore.setState({
      pageLayoutDirection: "vertical",
      pages: [home, p2, p3],
      pagePositions: {
        home: { x: 0, y: 0 },
        p2: { x: 0, y: 1160 },
        p3: { x: 0, y: 2320 },
      },
      pagePositionsByBreakpoint: {
        desktop: {
          home: { x: 0, y: 0 },
          p2: { x: 0, y: 1160 },
          p3: { x: 0, y: 2320 },
        },
        mobile: { home: { x: 0, y: 0 } },
      },
    } as never);
    useStore.getState().switchPagePositionsBreakpoint("desktop", "mobile", {
      pageWidth: 390,
      pageHeight: 844,
      gap: 80,
      direction: "vertical",
      availableWidth: 2000,
      pageStartX: 0,
    });
    expect(useStore.getState().pagePositions).toEqual({
      home: { x: 0, y: 0 },
      p2: { x: 0, y: 924 },
      p3: { x: 0, y: 1848 },
    });
  });

  it("hydration (initializePagePositions): persisted 에 없는 페이지는 전체 격자 재계산 값이 아니라 persisted 옆 다음 칸", () => {
    useStore.setState({ pages: [home, p2, p3] } as never);
    useStore.getState().initializePagePositions(
      [home, p2, p3],
      1920,
      1080,
      80,
      "auto",
      // desktop 에서 세로로 쌓인 home·p2 만 저장돼 있고 p3 는 tablet 에서 추가돼 desktop 값이 없다
      { home: { desktop: { x: 0, y: 0 } }, p2: { desktop: { x: 0, y: 1160 } } },
      // 전체 재계산이면 3열 격자 (0 · 2000 · 4000) 로 p3 가 (4000,0) 에 놓이고 p2 와 열이 어긋난다
      6200,
      0,
    );
    expect(useStore.getState().pagePositions).toEqual({
      home: { x: 0, y: 0 },
      p2: { x: 0, y: 1160 },
      p3: { x: 0, y: 2320 },
    });
  });

  it("전환 시 놓인 위치는 canonical pagePositions 에도 그 breakpoint 로 기록된다", () => {
    const canonical = useCanonicalDocumentStore.getState();
    const calls: unknown[] = [];
    useCanonicalDocumentStore.setState({
      setPagePositions: (entries: unknown) => calls.push(entries),
    } as never);
    try {
      useStore.setState({
        pages: [home, p2],
        pagePositions: { home: { x: 0, y: 0 }, p2: { x: 0, y: 1160 } },
        pagePositionsByBreakpoint: {
          desktop: { home: { x: 0, y: 0 }, p2: { x: 0, y: 1160 } },
          tablet: { home: { x: 0, y: 0 } },
        },
      } as never);
      useStore.getState().switchPagePositionsBreakpoint("desktop", "tablet", {
        pageWidth: 768,
        pageHeight: 1024,
        gap: 80,
        direction: "auto",
        availableWidth: 4000,
        pageStartX: 0,
      });
      expect(calls).toEqual([
        [{ pageId: "p2", breakpoint: "tablet", position: { x: 0, y: 1104 } }],
      ]);
    } finally {
      useCanonicalDocumentStore.setState({
        setPagePositions: canonical.setPagePositions,
      } as never);
    }
  });
});
