/**
 * @fileoverview ADR-116 Phase 5 G7 Extension Boundary — composition extension
 * namespace (`x-composition.events` / `x-composition.dataBinding`) read-through
 * helper.
 *
 * **의도된 architectural boundary** (ADR-116 본문 §5 + Gate G7):
 *   canonical core 에는 문서 구조 문법과 component props 만 두고, Composition
 *   app behavior (`events`, `actions`, `dataBinding`, editor state) 는
 *   `x-composition` extension namespace 로 분리한다. 이는 Pencil format 과
 *   composition vocabulary 의 동시 호환을 위한 design choice — events /
 *   dataBinding 은 Pencil format 에 없는 composition 만의 확장이므로
 *   canonical core 에 흡수 금지.
 *
 * **저장 위치**: canonical primary = `CompositionNode.extension['x-composition']`
 *   (canonical store mutation 시 `updateNodeExtension` API 사용). 본 helper 는
 *   `Element.events` / `Element.dataBinding` field 를 통한 read-through fallback
 *   path 도 제공해 priority option 으로 양쪽 storage 를 지원한다.
 *
 * **읽기 로직의 정본은 `packages/shared/src/utils/compositionExtensionFields.ts`**
 * 단일 소스다. 본 파일은 **apps/builder 영역의 기본 priority(`props-first`) 를
 * 고정하는 wrapper** 로만 남는다 — 두 영역의 기본값이 다른 것은 사고가 아니라
 * ADR-116 breakdown §10.2.4 의 명시 결정이다 (builder = UI 편집이 inline 수정한
 * `props.*` 가 canonical primary / shared renderers = 기존 legacy-first 패턴 보존).
 * 종전에는 그 기본값 차이 때문에 **우선순위 로직 본문까지 두 벌**이었다.
 *
 * **`Element.actions` 영역 명시 제외**: Element type 에 top-level `actions?` field
 * 자체 미정의. `actions` 는 처음부터 nested (`events[].actions` 또는 canonical
 * `CompositionExtension.actions`) 로만 존재 — 본 helper scope 외.
 *
 * @see docs/adr/completed/116-canonical-document-ssot-transition.md §G7 Extension Boundary
 * @see docs/adr/design/116-canonical-document-ssot-transition-breakdown.md §10.2 G6-1
 */

import type { DataBinding } from "@composition/shared";
import {
  getElementEvents as readElementEvents,
  getElementDataBinding as readElementDataBinding,
  type ExtensionReadPriority,
} from "@composition/shared";

export type { ExtensionReadPriority };

/**
 * Generic legacy element shape — `Element` (apps/builder unified.types) 와
 * 다른 local input interface (예: workflowEdges 의 `WorkflowElementInput`) 양쪽
 * 호환. helper 가 schema dependency 없이 read-through 만 수행.
 *
 * shared 의 동명 input shape 와 구조 동일 — shared 쪽이 미export 라 재선언한다.
 */
interface LegacyElementWithExtension {
  props?: Record<string, unknown> | unknown;
  events?: unknown;
  dataBinding?: unknown;
}

/**
 * legacy `Element.events` 영역 — **apps/builder 기본값 `props-first` 고정**.
 *
 * 1. `props.events` — UI canonical primary 저장 (workflow editor 가 inline 수정).
 * 2. `element.events` — legacy fallback (ADR-113 P5 schema 영역, ADR-116 G7 cleanup target).
 * 3. `[]` — 미지정 default.
 *
 * **priority 파라미터를 의도적으로 노출하지 않는다.** 호출부가 `legacy-first` 로
 * 뒤집으면 ADR-149 Phase 3-c 가 확정한 undo 정합이 깨진다 — canonical root 에
 * undo 통합이 없어 `props.events` 가 undo-정합 read source 다.
 *
 * **현재 런타임 호출처 0건** (2026-08-17). 유일 소비자였던
 * `canvasDeltaMessenger.ts` 의 Preview delta 가 삭제됐다 (send 메서드 4종 호출처
 * 0건 + 게이트 상시 차단으로 이중 사망 상태였음). 그럼에도 이 reader 를
 * 남기는 것은 **ADR-149 가 이벤트 발화 bridge 신설을 별도 ADR 로 이연**했고,
 * 그 bridge 가 붙을 때 읽어야 할 위치와 우선순위를 이 함수가 고정하고 있기
 * 때문이다 (형제 `getElementDataBinding` 은 30+ 곳에서 계속 소비 중).
 * 정합은 `compositionExtensionFields.priority.test.ts` 가 잠근다.
 *
 * Phase 5 G7 closure 시 helper 내부 reverse — `node.extension['x-composition'].events`
 * 우선 read 후 props/legacy fallback 으로 변경.
 */
export function getElementEvents(
  element: LegacyElementWithExtension,
): unknown[] {
  return readElementEvents(element, "props-first");
}

/**
 * legacy `Element.dataBinding` 영역 — read-through priority.
 *
 * default priority = `'props-first'` (apps/builder 영역 — UI workflow editor 가
 * inline 수정한 `props.dataBinding` 가 canonical primary). packages/shared 영역
 * renderers 는 `legacy-first` 기본 — ADR-116 breakdown §10.2.4.
 *
 * Phase 5 G7 closure 시 helper 내부 reverse —
 * `node.extension['x-composition'].dataBinding` 우선 read.
 */
export function getElementDataBinding(
  element: LegacyElementWithExtension,
  priority: ExtensionReadPriority = "props-first",
): DataBinding | undefined {
  return readElementDataBinding(element, priority);
}
