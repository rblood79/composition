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
 * **`Element.actions` 영역 명시 제외**: Element type 에 top-level `actions?` field
 * 자체 미정의. `actions` 는 처음부터 nested (`events[].actions` 또는 canonical
 * `CompositionExtension.actions`) 로만 존재 — 본 helper scope 외.
 *
 * @see docs/adr/completed/116-canonical-document-ssot-transition.md §G7 Extension Boundary
 * @see docs/adr/design/116-canonical-document-ssot-transition-breakdown.md §10.2 G6-1
 */

import type { DataBinding } from "@composition/shared";

export type ExtensionReadPriority =
  | "legacy-first"
  | "props-first"
  | "legacy-only";

/**
 * Generic legacy element shape — `Element` (apps/builder unified.types) 와
 * 다른 local input interface (예: workflowEdges 의 `WorkflowElementInput`) 양쪽
 * 호환. helper 가 schema dependency 없이 read-through 만 수행.
 */
interface LegacyElementWithExtension {
  props?: Record<string, unknown> | unknown;
  events?: unknown;
  dataBinding?: unknown;
}

/**
 * legacy `Element.events` 영역 — read-through priority.
 *
 * 1. `props.events` — UI canonical primary 저장 (workflow editor 가 inline 수정).
 * 2. `element.events` — legacy fallback (ADR-113 P5 schema 영역, ADR-116 G7 cleanup target).
 * 3. `[]` — 미지정 default.
 *
 * Phase 5 G7 closure 시 helper 내부 reverse — `node.extension['x-composition'].events`
 * 우선 read 후 props/legacy fallback 으로 변경.
 */
export function getElementEvents(
  element: LegacyElementWithExtension,
): unknown[] {
  const props = element.props as Record<string, unknown> | undefined;
  const propsEvents = props?.events;
  if (Array.isArray(propsEvents)) return propsEvents;
  if (Array.isArray(element.events)) return element.events;
  return [];
}

/**
 * legacy `Element.dataBinding` 영역 — read-through priority.
 *
 * default priority = `'props-first'` (apps/builder 영역 — UI workflow editor 가
 * inline 수정한 `props.dataBinding` 가 canonical primary).
 *
 * Phase 5 G7 closure 시 helper 내부 reverse —
 * `node.extension['x-composition'].dataBinding` 우선 read.
 */
export function getElementDataBinding(
  element: LegacyElementWithExtension,
  priority: ExtensionReadPriority = "props-first",
): DataBinding | undefined {
  if (priority === "legacy-only") {
    if (element.dataBinding !== undefined)
      return element.dataBinding as DataBinding;
    return undefined;
  }
  const props = element.props as Record<string, unknown> | undefined;
  const propsBinding = props?.dataBinding;
  if (priority === "legacy-first") {
    if (element.dataBinding !== undefined)
      return element.dataBinding as DataBinding;
    if (propsBinding !== undefined) return propsBinding as DataBinding;
    return undefined;
  }
  // props-first
  if (propsBinding !== undefined) return propsBinding as DataBinding;
  if (element.dataBinding !== undefined)
    return element.dataBinding as DataBinding;
  return undefined;
}
