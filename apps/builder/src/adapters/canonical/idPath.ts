/**
 * @fileoverview Stable ID Path Generator — ADR-903 P1.
 *
 * canonical descendants 키는 runtime UUID가 아닌 stable id path 사용
 * (예: "label", "ok-button/label", "header/title").
 *
 * P1 단계: parent_id 기반 트리 순회로 임시 path map 생성. UUID → "<parent-name>/<child-name>"
 * 형태. canonical id 정책 (slash 금지) 충족을 위해 child name에서 slash 치환.
 *
 * 향후 Phase 3 (frameset 흡수) 단계에서 사용자 정의 stable id (예: "ok-button")
 * 도입 시 본 helper 폐기.
 */

import type { Element } from "@/types/builder/unified.types";

export interface IdPathContext {
  /**
   * UUID → stable full path 매핑 (e.g., "uuid-abc" → "header/title").
   *
   * **descendants key 용도** (root ref 기준 full path).
   * canonical node id 로는 사용 금지 — resolver path traverse 가 parent/child id
   * 누적이라 full path 를 노드 id 로 쓰면 중복 (`Box/Box/Slot`) 발생.
   */
  idPathMap: Map<string, string>;
  /**
   * UUID → segment-only stable id 매핑 (e.g., "uuid-abc" → "title").
   *
   * **canonical node id 용도**. resolver applyDescendantsToTree 가
   * `parentPath/segId` 로 누적하므로 segment-only 가 정합.
   */
  idSegmentMap: Map<string, string>;
  /** 역방향 매핑 (full path → UUID) */
  pathIdMap: Map<string, string>;
}

/**
 * 트리 순회로 모든 element의 stable path 계산.
 * 우선순위:
 *  1. element.customId가 있으면 사용 (slash 치환 후)
 *  2. componentName이 있으면 사용 (slash 치환 후)
 *  3. type 값 기반 fallback (예: "Button-3" — index suffix)
 * 형제간 이름 충돌 시 "-N" suffix.
 */
export function buildIdPathContext(
  elements: readonly Element[],
): IdPathContext {
  const idPathMap = new Map<string, string>();
  const idSegmentMap = new Map<string, string>();
  const pathIdMap = new Map<string, string>();

  // children index (parent_id → Element[])
  const childrenByParent = new Map<string | null, Element[]>();
  for (const el of elements) {
    const parent = el.parent_id ?? null;
    const arr = childrenByParent.get(parent) ?? [];
    arr.push(el);
    childrenByParent.set(parent, arr);
  }

  function visit(parentPath: string, parentId: string | null): void {
    const children = childrenByParent.get(parentId) ?? [];
    const nameCount = new Map<string, number>();
    for (const child of children) {
      const baseName = sanitizeIdSegment(
        child.customId ?? child.componentName ?? child.type,
      );
      const seq = (nameCount.get(baseName) ?? 0) + 1;
      nameCount.set(baseName, seq);
      const segName = seq === 1 ? baseName : `${baseName}-${seq}`;
      const fullPath = parentPath ? `${parentPath}/${segName}` : segName;
      idPathMap.set(child.id, fullPath);
      idSegmentMap.set(child.id, segName);
      pathIdMap.set(fullPath, child.id);
      visit(fullPath, child.id);
    }
  }

  visit("", null);
  return { idPathMap, idSegmentMap, pathIdMap };
}

/**
 * canonical id 정책: slash 금지. underscore로 치환 + 빈 문자열 fallback.
 */
function sanitizeIdSegment(raw: string | undefined): string {
  if (!raw) return "node";
  return raw.replace(/\//g, "_") || "node";
}

/**
 * UUID → segment-only stable id 조회 (없으면 UUID 자체로 fallback).
 *
 * canonical node id 빌더 (`buildNode` / `convertElementToCanonical` /
 * `convertElementWithSlotHoisting`) 가 공통 사용하는 1라인 패턴을
 * 명시적 함수로 추출. 6 사용처 boilerplate 제거.
 */
export function segId(
  elementId: string,
  idSegmentMap: Map<string, string>,
): string {
  return idSegmentMap.get(elementId) ?? elementId;
}
