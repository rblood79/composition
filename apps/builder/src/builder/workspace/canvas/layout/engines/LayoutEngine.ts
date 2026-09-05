/**
 * Layout Engine 인터페이스
 *
 * 각 display 타입별로 구현하는 레이아웃 엔진의 공통 인터페이스
 *
 * @since 2026-01-28 Phase 2 - 하이브리드 레이아웃 엔진
 */

import type { CanvasLayoutNode } from "../layoutNode";
import type { ComputedStyle } from "./cssResolver";

import type { TextRenderComputedInput } from "../../utils/textRenderStyle";

/**
 * 계산된 레이아웃 결과
 */
export interface ComputedLayout {
  /** 부모 기준 x 좌표 */
  x: number;
  /** 부모 기준 y 좌표 */
  y: number;
  /** 계산된 너비 */
  width: number;
  /** 계산된 높이 */
  height: number;
  /** 요소 ID (추적용) */
  elementId: string;
  /** 마진 정보 (collapse 계산용) */
  margin?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
    /** collapse된 상단 마진 */
    collapsedTop?: number;
    /** collapse된 하단 마진 */
    collapsedBottom?: number;
  };
  /**
   * W3-5: 자식 콘텐츠의 전체 크기 (overflow:scroll/auto의 maxScroll 계산용)
   *
   * 부모 요소에 대한 자식들의 총 콘텐츠 영역 크기.
   * containerSize - contentSize = maxScroll.
   * 이 값이 undefined이면 스크롤 불필요.
   */
  contentSize?: {
    contentWidth: number;
    contentHeight: number;
  };
  /**
   * ADR-205 Phase 5 — **조상이 선언한** 텍스트 축. Skia scene build 로 상속을 운반하는 채널.
   *
   * scene build 에는 `ComputedStyle` 이 없어서(F20) 상속 축이 캔버스에 도달하지 못했다.
   * 레이아웃은 순회하면서 이미 조상 체인을 지나므로, 그때 본 **선언값만** 여기 싣는다.
   *
   * CSS 초기값은 싣지 않는다 — `resolveStyle` 은 미선언과 초기값을 구별하지 못하는데,
   * 초기값까지 실으면 아무도 선언하지 않은 축이 catalog 기본값을 덮어쓴다 (D3 위반).
   * 필드가 없다는 것이 "조상 중 아무도 선언하지 않았다" 는 뜻이다.
   */
  textAxes?: TextRenderComputedInput;
}

/**
 * 레이아웃 컨텍스트 (BFC, 마진 collapse 등)
 */
export interface LayoutContext {
  /** Block Formatting Context ID */
  bfcId: string;
  /** 이전 형제의 하단 마진 (collapse 계산용) */
  prevSiblingMarginBottom?: number;
  /** 부모 요소의 마진 collapse 참여 여부 */
  parentMarginCollapse?: boolean;
  /** Viewport 너비 (vh/vw 계산용) */
  viewportWidth?: number;
  /** Viewport 높이 (vh/vw 계산용) */
  viewportHeight?: number;
  /** 부모 요소의 display 값 (CSS blockification 계산용) */
  parentDisplay?: string;
  /** 부모의 computed style (CSS 상속 해석용) */
  parentComputedStyle?: ComputedStyle;
  /** 요소의 자식 CanvasLayoutNode 배열을 반환하는 accessor (컨테이너 intrinsic size 계산용) */
  getChildElements?: (elementId: string) => CanvasLayoutNode[];
}

/**
 * 레이아웃 엔진 인터페이스
 *
 * 각 display 타입별로 구현
 */
export interface LayoutEngine {
  /**
   * 자식 요소들의 레이아웃 계산
   *
   * @param parent - 부모 요소
   * @param children - 자식 요소 배열
   * @param availableWidth - 사용 가능한 너비 (부모 content-box)
   * @param availableHeight - 사용 가능한 높이
   * @param context - 레이아웃 컨텍스트 (BFC 정보 등)
   * @returns 각 자식의 계산된 레이아웃
   */
  calculate(
    parent: CanvasLayoutNode,
    children: CanvasLayoutNode[],
    availableWidth: number,
    availableHeight: number,
    context?: LayoutContext,
  ): ComputedLayout[];

  /**
   * 엔진이 처리하는 display 타입
   */
  readonly displayTypes: string[];
}
