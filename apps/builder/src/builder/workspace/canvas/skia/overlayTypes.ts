/**
 * ADR-248 G6: Canvas overlay inputs (data badges · page guides · overflow · page frames) without
 * the old overlay builders that read the old store — the catalog Canvas fills them from records.
 */
import type { BoundingBox } from "../selection/types";

/** ADR-212 Phase 6 — data-bound 요소 위 바인딩 배지 (아이콘 + 테이블명 + 상태색) */
export interface BindingBadgeInfo {
  collectionId: string;
  name: string;
  /** "normal" | "empty" | "error" — collectionBadgeStatus SSOT */
  state: string;
}

export interface BindingBadgeTarget extends BindingBadgeInfo {
  /** 요소 원본 박스 (clip·page delta 반영) — 배지는 좌상단에 앵커 */
  bounds: BoundingBox;
  pageId: string | null;
}

/** ADR-181 — 한 페이지의 수동 가이드 렌더 입력 (scene 좌표) */
export interface PageGuideRenderTarget {
  pageId: string;
  /** 페이지 rect (드래그 delta 반영) — 선 길이이자 클립 영역 */
  pageRect: BoundingBox;
  /** axis "x" = x 좌표를 고정하는 세로선 (snapGuides 와 같은 어법) */
  lines: ReadonlyArray<{ id: string; axis: "x" | "y"; position: number }>;
}

/** overflow 컨테이너의 자식 전체 + 개별 bounds */
export interface OverflowContentInfo {
  containerBounds: BoundingBox;
  contentBounds: BoundingBox;
  overflowChildren: Array<{ id: string; bounds: BoundingBox }>;
  /** overflow 타입 — scroll/auto 시 선택 상태에서 해칭 패턴 표시 */
  overflowType: "hidden" | "clip" | "scroll" | "auto";
}

/** 자식 요소가 속한 overflow 부모 정보 */
export interface ChildOverflowContext {
  /** 부모 컨테이너 bounds (클리핑 영역) */
  containerBounds: BoundingBox;
  /** 자식 요소의 bounds (원본) */
  childBounds: BoundingBox;
  /** 부모의 overflow 타입 */
  overflowType: "hidden" | "clip" | "scroll" | "auto";
}

export interface PageFrame {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title?: string;
  elementCount?: number;
}

/** A workflow edge's sampled bezier (hit test cache). */
export interface BezierSamplePoint {
  x: number;
  y: number;
  t: number;
}

export interface CachedEdgeGeometry {
  edgeId: string;
  samples: BezierSamplePoint[];
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  cpx1: number;
  cpy1: number;
  cpx2: number;
  cpy2: number;
}
