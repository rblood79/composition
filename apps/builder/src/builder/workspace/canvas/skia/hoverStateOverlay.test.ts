import { describe, it, expect } from "vitest";
import { computeHoverStateNodes } from "./hoverStateOverlay";
import type { HoverStateNodeCache } from "./hoverStateOverlay";
import type { StoreRenderBridge } from "./StoreRenderBridge";
import type { SkiaNodeData } from "./nodeRendererTypes";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { BoundingBox } from "../selection/types";
import type { ElementHoverState } from "../hooks/useElementHoverInteraction";

/**
 * ADR-150 A1 — computeHoverStateNodes 회귀 테스트.
 *
 * 검증 축: (1) hover 대상 구성 = hoveredElementId(배경) 먼저 + hoveredLeafIds(텍스트),
 *   중복 제거 / (2) treeBoundsMap 절대좌표로 x/y 오버라이드 / (3) 동일 시그니처 캐시 재사용
 *   (매 RAF 재빌드 방지, R1 성능) / (4) bridge null·대상 0·bounds 부재 처리.
 */

function mockNode(width = 20, height = 30): SkiaNodeData {
  return { x: 0, y: 0, width, height } as SkiaNodeData;
}

function bounds(
  x: number,
  y: number,
  width: number,
  height: number,
): BoundingBox {
  return { x, y, width, height } as BoundingBox;
}

function hoverState(
  hoveredElementId: string | null,
  hoveredLeafIds: string[],
): ElementHoverState {
  return { hoveredElementId, hoveredLeafIds, isGroupHover: false };
}

const EMPTY_ELEMENTS = new Map<string, CanvasSceneNode>();

interface BridgeSpy {
  bridge: StoreRenderBridge;
  builtIds: string[];
  calls: () => number;
}

function makeBridgeSpy(): BridgeSpy {
  const builtIds: string[] = [];
  const bridge = {
    buildInteractionStateNode: (id: string): SkiaNodeData => {
      builtIds.push(id);
      return mockNode();
    },
  } as unknown as StoreRenderBridge;
  return { bridge, builtIds, calls: () => builtIds.length };
}

function baseParams(overrides: {
  bridge: StoreRenderBridge | null;
  hoverState: ElementHoverState;
  treeBoundsMap: Map<string, BoundingBox>;
  cacheRef: { current: HoverStateNodeCache | null };
  registryVersion?: number;
}) {
  return {
    bridge: overrides.bridge,
    hoverState: overrides.hoverState,
    treeBoundsMap: overrides.treeBoundsMap,
    elementsMap: EMPTY_ELEMENTS,
    layoutMap: null,
    theme: "light" as const,
    childrenMap: null,
    registryVersion: overrides.registryVersion ?? 1,
    racStateInput: { isHovered: true },
    cacheRef: overrides.cacheRef,
  };
}

describe("computeHoverStateNodes (ADR-150 A1)", () => {
  it("bridge null 이면 빈 배열 + 캐시 초기화", () => {
    const cacheRef: { current: HoverStateNodeCache | null } = {
      current: { key: "stale", nodes: [mockNode()] },
    };
    const nodes = computeHoverStateNodes(
      baseParams({
        bridge: null,
        hoverState: hoverState("btn", ["btn"]),
        treeBoundsMap: new Map(),
        cacheRef,
      }),
    );
    expect(nodes).toEqual([]);
    expect(cacheRef.current).toBeNull();
  });

  it("hover 대상 없음(element null + leaf 0)이면 빈 배열", () => {
    const spy = makeBridgeSpy();
    const nodes = computeHoverStateNodes(
      baseParams({
        bridge: spy.bridge,
        hoverState: hoverState(null, []),
        treeBoundsMap: new Map(),
        cacheRef: { current: null },
      }),
    );
    expect(nodes).toEqual([]);
    expect(spy.calls()).toBe(0);
  });

  it("hoveredElementId 를 leaf 앞에 두고 중복 제거", () => {
    const spy = makeBridgeSpy();
    computeHoverStateNodes(
      baseParams({
        bridge: spy.bridge,
        // element == 첫 leaf → 중복 제거되어 한 번만.
        hoverState: hoverState("btn", ["btn", "label", "icon"]),
        treeBoundsMap: new Map([
          ["btn", bounds(5, 6, 20, 30)],
          ["label", bounds(8, 9, 10, 12)],
          ["icon", bounds(2, 3, 8, 8)],
        ]),
        cacheRef: { current: null },
      }),
    );
    expect(spy.builtIds).toEqual(["btn", "label", "icon"]);
  });

  it("treeBoundsMap 절대좌표로 x/y 오버라이드", () => {
    const spy = makeBridgeSpy();
    const nodes = computeHoverStateNodes(
      baseParams({
        bridge: spy.bridge,
        hoverState: hoverState("btn", ["btn"]),
        treeBoundsMap: new Map([["btn", bounds(42, 99, 20, 30)]]),
        cacheRef: { current: null },
      }),
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0].x).toBe(42);
    expect(nodes[0].y).toBe(99);
  });

  it("bounds 없는 대상은 그리지 않음(절대좌표 부재)", () => {
    const spy = makeBridgeSpy();
    const nodes = computeHoverStateNodes(
      baseParams({
        bridge: spy.bridge,
        hoverState: hoverState("btn", ["btn", "ghost"]),
        treeBoundsMap: new Map([["btn", bounds(0, 0, 10, 10)]]),
        cacheRef: { current: null },
      }),
    );
    // ghost 는 bounds 없음 → buildInteractionStateNode 호출 전에 skip.
    expect(spy.builtIds).toEqual(["btn"]);
    expect(nodes).toHaveLength(1);
  });

  it("동일 시그니처 재호출 시 캐시 재사용(재빌드 skip)", () => {
    const spy = makeBridgeSpy();
    const cacheRef: { current: HoverStateNodeCache | null } = { current: null };
    const params = baseParams({
      bridge: spy.bridge,
      hoverState: hoverState("btn", ["btn"]),
      treeBoundsMap: new Map([["btn", bounds(0, 0, 10, 10)]]),
      cacheRef,
    });
    const first = computeHoverStateNodes(params);
    const second = computeHoverStateNodes(params);
    expect(spy.calls()).toBe(1); // 두 번째는 캐시 히트
    expect(second).toBe(first); // 동일 배열 참조
  });

  it("registryVersion 변경 시 캐시 무효화(재빌드)", () => {
    const spy = makeBridgeSpy();
    const cacheRef: { current: HoverStateNodeCache | null } = { current: null };
    const tree = new Map([["btn", bounds(0, 0, 10, 10)]]);
    const hs = hoverState("btn", ["btn"]);
    computeHoverStateNodes(
      baseParams({
        bridge: spy.bridge,
        hoverState: hs,
        treeBoundsMap: tree,
        cacheRef,
        registryVersion: 1,
      }),
    );
    computeHoverStateNodes(
      baseParams({
        bridge: spy.bridge,
        hoverState: hs,
        treeBoundsMap: tree,
        cacheRef,
        registryVersion: 2,
      }),
    );
    expect(spy.calls()).toBe(2); // 버전 변경 → 재빌드
  });
});
