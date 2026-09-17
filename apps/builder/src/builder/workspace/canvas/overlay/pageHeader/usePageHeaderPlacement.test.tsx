// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type TestStoreState = {
  currentPageId: string | null;
  selectedElementIds: string[];
  pagePositions: Record<string, { x: number; y: number }>;
};

vi.mock("../../../../stores", async () => {
  const { create } = await import("zustand");
  const useStore = create<TestStoreState>(() => ({
    currentPageId: "p2",
    selectedElementIds: [],
    pagePositions: {
      p1: { x: 0, y: 0 },
      p2: { x: 1000, y: 0 },
      p3: { x: 5000, y: 5000 },
    },
  }));
  return { useStore };
});

import { useStore as testStore } from "../../../../stores";

import {
  publishCanvasFramePresentation,
  resetCanvasFramePresentation,
} from "../../canvasFramePresentation";
import type { PagePositionPresentationSnapshot } from "../../interaction/pagePositionPresentation";
import { useViewportSyncStore } from "../../stores";
import { PageHeaderLayer } from "./PageHeaderLayer";

const frames = [
  { id: "p1", title: "One", x: 0, y: 0, width: 400, height: 800 },
  { id: "p2", title: "Two", x: 1000, y: 0, width: 400, height: 800 },
  { id: "p3", title: "Far", x: 5000, y: 5000, width: 400, height: 800 },
];

const idle: PagePositionPresentationSnapshot = {
  canonical: testStore.getState().pagePositions,
  activeOverrides: null,
  version: 0,
  isActive: false,
  startBreakpoint: null,
};

function camera(zoom: number, panX: number, panY: number) {
  return { zoom, panX, panY };
}

async function countStyleWrites(
  layer: HTMLElement,
  run: () => void,
): Promise<number> {
  // jsdom 은 record 를 microtask 로 전달한다 — 콜백 누적 + 잔여 takeRecords 합산.
  let count = 0;
  const observer = new MutationObserver((records) => {
    count += records.length;
  });
  observer.observe(layer, {
    attributes: true,
    subtree: true,
    attributeFilter: ["style", "data-hidden"],
  });
  run();
  await Promise.resolve();
  await Promise.resolve();
  count += observer.takeRecords().length;
  observer.disconnect();
  return count;
}

function headerOf(layer: HTMLElement, pageId: string): HTMLElement {
  const node = layer.querySelector<HTMLElement>(`[data-page-id="${pageId}"]`);
  if (!node) throw new Error(`header ${pageId} 없음`);
  return node;
}

describe("usePageHeaderPlacement — 게이트 · drag 추종 · settle 배치", () => {
  beforeEach(() => {
    resetCanvasFramePresentation();
    useViewportSyncStore.getState().reset();
    useViewportSyncStore.getState().setContainerSize({
      width: 1600,
      height: 900,
    });
    useViewportSyncStore.getState().setCameraGestureActive(false);
    publishCanvasFramePresentation(camera(1, 0, 100), idle);
  });
  afterEach(() => {
    cleanup();
    resetCanvasFramePresentation();
  });

  it("마운트 시 1회 배치 — transform · width · 뷰포트 밖 컬링", () => {
    const { container } = render(<PageHeaderLayer frames={frames} />);
    const layer = container.firstElementChild as HTMLElement;
    const p1 = headerOf(layer, "p1");
    expect(p1.style.transform).toBe("translate3d(0px, 64px, 0)");
    expect(p1.style.width).toBe("400px");
    expect(p1.style.display).toBe("");
    // (5000, 5000) 은 1600×900 밖
    expect(headerOf(layer, "p3").style.display).toBe("none");
  });

  it("게이트 ON 동안 프레임 콜백은 DOM 을 쓰지 않고, OFF 전환에 1회 배치한다", async () => {
    const { container } = render(<PageHeaderLayer frames={frames} />);
    const layer = container.firstElementChild as HTMLElement;
    const before = headerOf(layer, "p1").style.transform;

    const onWrites = await countStyleWrites(layer, () => {
      act(() => useViewportSyncStore.getState().setCameraGestureActive(true));
    });
    expect(onWrites).toBe(1); // data-hidden 1회
    expect(layer.hasAttribute("data-hidden")).toBe(true);

    const gestureWrites = await countStyleWrites(layer, () => {
      for (let i = 1; i <= 5; i += 1) {
        publishCanvasFramePresentation(camera(1, -20 * i, 100), idle);
      }
    });
    expect(gestureWrites).toBe(0);
    expect(headerOf(layer, "p1").style.transform).toBe(before);

    act(() => useViewportSyncStore.getState().setCameraGestureActive(false));
    expect(layer.hasAttribute("data-hidden")).toBe(false);
    expect(headerOf(layer, "p1").style.transform).toBe(
      "translate3d(-100px, 64px, 0)",
    );
  });

  it("프로그램 zoom (게이트 밖 카메라 변화) 은 프레임 콜백에서 1회 배치", async () => {
    const { container } = render(<PageHeaderLayer frames={frames} />);
    const layer = container.firstElementChild as HTMLElement;

    const writes = await countStyleWrites(layer, () => {
      publishCanvasFramePresentation(camera(2, 0, 100), idle);
      // 같은 카메라 재publish 는 쓰기 0
      publishCanvasFramePresentation(camera(2, 0, 100), idle);
    });
    expect(headerOf(layer, "p1").style.transform).toBe(
      "translate3d(0px, 64px, 0)",
    );
    expect(headerOf(layer, "p1").style.width).toBe("800px");
    // p2 는 2000 ≥ 1600 → 컬링 (display none, transform 은 안 쓴다)
    expect(headerOf(layer, "p2").style.display).toBe("none");
    // 두 번째 publish (같은 카메라) 는 쓰기 0 — p1 width + p2 display = 2
    expect(writes).toBe(2);
  });

  it("drag 중에는 override 대상 노드만 transform 을 바꾼다", async () => {
    const { container } = render(<PageHeaderLayer frames={frames} />);
    const layer = container.firstElementChild as HTMLElement;
    const p2Before = headerOf(layer, "p2").style.transform;

    const dragging: PagePositionPresentationSnapshot = {
      ...idle,
      activeOverrides: new Map([["p1", { x: 40, y: 10 }]]),
      version: 1,
      isActive: true,
    };
    const writes = await countStyleWrites(layer, () => {
      publishCanvasFramePresentation(camera(1, 0, 100), dragging);
    });
    expect(writes).toBe(1);
    expect(headerOf(layer, "p1").style.transform).toBe(
      "translate3d(40px, 74px, 0)",
    );
    expect(headerOf(layer, "p2").style.transform).toBe(p2Before);
  });

  it("drag 중 위 페이지가 겹치면 아래 페이지 헤더 clip 이 매 프레임 갱신된다 (회귀)", () => {
    // 회귀: transform 만 쓰던 fast path 는 겹친 아래 페이지 헤더의 clip 을 갱신하지
    // 않아, 선택(위) 페이지가 이동해 겹칠 때 아래 헤더가 위 페이지 위로 남았다.
    const { container } = render(<PageHeaderLayer frames={frames} />);
    const layer = container.firstElementChild as HTMLElement;
    expect(headerOf(layer, "p1").style.clipPath).toBe("");

    // p2 (배열 뒤 = 위 페이지) 를 절대 x=200 으로 드래그 → p1 오른쪽 절반과 겹침.
    const dragging: PagePositionPresentationSnapshot = {
      ...idle,
      activeOverrides: new Map([["p2", { x: 200, y: 0 }]]),
      version: 1,
      isActive: true,
    };
    publishCanvasFramePresentation(camera(1, 0, 100), dragging);
    expect(headerOf(layer, "p1").style.clipPath).toBe(
      "inset(0px 200px 0px 0px)",
    );
  });

  it("위 (활성) 페이지가 겹치면 아래 페이지 헤더는 clip-path inset 으로 잘린다", () => {
    // p2 (활성, 위) 를 p1 오른쪽 절반 위로 옮긴다
    testStore.setState({
      pagePositions: {
        p1: { x: 0, y: 0 },
        p2: { x: 200, y: 0 },
        p3: { x: 5000, y: 5000 },
      },
    });
    const { container } = render(<PageHeaderLayer frames={frames} />);
    const layer = container.firstElementChild as HTMLElement;
    expect(headerOf(layer, "p1").style.clipPath).toBe(
      "inset(0px 200px 0px 0px)",
    );
    expect(headerOf(layer, "p2").style.clipPath).toBe("");
    testStore.setState({
      pagePositions: {
        p1: { x: 0, y: 0 },
        p2: { x: 1000, y: 0 },
        p3: { x: 5000, y: 5000 },
      },
    });
  });
});
