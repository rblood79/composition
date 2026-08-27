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

// `getElementEvents` 는 삭제됐다 (2026-08-17).
//
// ADR-158(Implemented 2026-08-16)이 인터랙션을 canonical **root** `events`
// 컬렉션(`InteractionRule[]`)으로 옮기면서 원 소비처 2곳이 모두 사라졌다 —
// `workflowEdges.ts` 는 root collection 으로 전환했고(같은 파일 §규칙 출처
// 주석 참조), `canvasDeltaMessenger.ts` 는 삭제됐다. 요소별 `props.events` /
// `element.events` 는 **읽는 쪽도 쓰는 쪽도 없는** legacy 저장 데이터로만
// 남았고, roundtrip 보존은 `legacyElementSanitizer` 가 담당한다.
//
// ADR-149 가 "이벤트 실행 bridge 는 별도 ADR" 로 이연했던 그 bridge 가 곧
// ADR-158 이며, **다른 위치를 읽는다** — 이 reader 를 그 자리 표시로 남겨 둘
// 근거가 없다. events 를 요소별로 다시 읽어야 하는 상황이 오면 그때의 저장
// 위치부터 새로 정해야 한다.

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
