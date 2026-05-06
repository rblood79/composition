/**
 * useResolvedElement Hook
 *
 * Element의 Master-Instance resolution을 수행.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ADR-903 P2 D-B / D-C / fallback 제거 (2026-04-25 세션 26)
 *
 * canonical 단일 경로 — `resolveInstanceWithSharedCache` (storeBridge.ts) 가
 * shared `ResolverCache` singleton (Preview / Skia 공통) 을 통과하여 Element
 * 를 재구성. 같은 (instance, master) pair 의 반복 호출은 cache hit.
 *
 * legacy fallback (`resolveInstanceElement`) + dev compare 로깅은 D-B/D-C 진입
 * 후 안전망 vitest (storeBridge.test.ts TC9 + TC14~21) 로 정합 등가성을
 * 보장한 후 본 단계에서 제거.
 *
 * 기존 요소 (componentRole 없음) 는 원본 element 참조 그대로 반환 — 성능
 * 영향 제로.
 *
 * @see docs/adr/903-ref-descendants-slot-composition-format-migration-plan.md
 * @see resolvers/canonical/storeBridge.ts (`resolveInstanceWithSharedCache`)
 */

import { useMemo } from "react";
import type { Element } from "../../../../types/builder/unified.types";
import {
  getComponentMasterReference as getInstanceMasterRef,
  isComponentInstanceMirrorElement as isInstanceElement,
} from "../../../../adapters/canonical/componentSemanticsMirror";
import { useStore } from "../../../stores";
import { resolveInstanceWithSharedCache } from "../../../../resolvers/canonical/storeBridge";
import { resolveCanonicalRefElement } from "../../../utils/canonicalRefResolution";

/**
 * Element의 instance resolution을 수행
 *
 * 반환값이 useMemo로 안정화되어 있어 하위 렌더링 최적화에 유리.
 * 변경이 없으면 원본 element 참조를 그대로 반환.
 */
export function useResolvedElement(element: Element): Element {
  // Instance resolution: master 조회 (instance인 경우만)
  // ADR-116 G5-B P5-D: component master reference 는 mirror adapter 를
  // 경유한다 (canonical RefNode ref 자동 호환).
  const masterElement = useStore((state) => {
    if (!isInstanceElement(element)) return undefined;
    const masterRef = getInstanceMasterRef(element);
    if (!masterRef) return undefined;
    return state.elementsMap.get(masterRef);
  });
  const elementsMap = useStore((state) => state.elementsMap);

  return useMemo(() => {
    const canonicalResolved = resolveCanonicalRefElement(
      element,
      elementsMap.values(),
    );
    if (canonicalResolved !== element) return canonicalResolved;

    if (isInstanceElement(element) && masterElement) {
      // canonical 은 isInstanceElement(element) && master 정상 시 항상 결과
      // 반환. 본 분기 안에서는 두 가드 모두 충족하므로 null 도달 불가 —
      // defensive fallback 으로 element 유지 (broken edge case 안전망).
      return resolveInstanceWithSharedCache(element, masterElement) ?? element;
    }
    return element;
  }, [element, elementsMap, masterElement]);
}
