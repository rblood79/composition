/**
 * @fileoverview Legacy → Canonical Adapter Input/Output Types — ADR-903 P1
 *
 * adapter는 read-through 변환만 수행. 저장 포맷 미변경 (Phase 5에서 전환).
 */

import type { Element, Page } from "@/types/builder/unified.types";
import type { RefNode } from "@composition/shared";
import type { ElementWithLegacyMirror } from "./legacyElementFields";

/**
 * Pre-canonical project import record.
 *
 * This shape is intentionally owned by the legacy-to-canonical adapter rather
 * than the Builder-wide type surface. Runtime UI and stores consume canonical
 * reusable FrameNode projections instead.
 */
export interface LegacyLayoutRecord {
  id: string;
  name: string;
  project_id: string;
  description?: string;
  slug?: string;
  notFoundPageId?: string;
  inheritNotFound?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LegacyAdapterInput {
  elements: Element[];
  pages: Page[];
  layouts: LegacyLayoutRecord[];
}

/**
 * Sibling 스트림이 producing할 transformation 함수의 시그니처.
 * 본 파일에는 type만 export, 실제 구현은 sibling 모듈이 담당.
 */
export type ConvertComponentRoleFn = (
  element: ElementWithLegacyMirror,
  options: { idPathMap: Map<string, string> },
) => {
  reusable?: boolean;
  /** "ref" 인스턴스인 경우 RefNode의 ref 필드값 (master의 stable id) */
  ref?: string;
  /** descendants UUID key를 stable id path로 remap한 결과 */
  descendantsRemapped?: Record<string, unknown>;
  /** instance overrides → RefNode.props patch */
  rootOverrides?: { props: Record<string, unknown> };
};

export type ConvertSlotElementFn = (slotElement: Element) => {
  /** pencil 공식 slot 타입: false 또는 추천 reusable component ID 배열 */
  slotMeta: false | string[];
  /** slot_name (canonical descendants[slotPath]의 path 키) */
  slotName: string;
};

export type ConvertPageLayoutFn = (
  page: Page,
  layouts: LegacyLayoutRecord[],
  pageElements: Element[],
  /**
   * layout shell 내 slot name → stable id path 매핑.
   * resolver mode C 매칭은 stable id path 기준이므로 caller 가
   * `buildSlotPathMap(layoutElements, layoutIdPathMap)` 로 사전 계산하여 전달.
   * 빈 Map 전달 시 slot name 그대로 fallback 사용 (단순 페이지에서 layout 없음 등).
   */
  slotPathMap: Map<string, string>,
) => RefNode | null;
