/**
 * @fileoverview ADR-116 Phase 5 G7 Extension Boundary — packages/shared 영역
 * composition extension namespace (`x-composition.events` /
 * `x-composition.dataBinding`) read-through helper.
 *
 * **의도된 architectural boundary** (ADR-116 본문 §5 + Gate G7):
 *   canonical core 에는 문서 구조 문법과 component props 만 두고, Composition
 *   app behavior 는 `x-composition` extension namespace 로 분리. events /
 *   dataBinding 은 Pencil format 에 없는 composition 만의 확장이므로 canonical
 *   core 에 흡수 금지.
 *
 * **별 helper 분리 이유**: monorepo dependency 정합 — packages/shared 가
 * apps/builder import 불가하므로, apps/builder 영역의 동명 helper
 * (`apps/builder/src/adapters/canonical/compositionExtensionFields.ts`) 와 분리.
 *
 * **priority 차이 framing note** (design §10.2.4 후속 결정):
 * - apps/builder 영역 (canvasDeltaMessenger / workflowEdges): default `'props-first'`
 *   — UI workflow editor 가 inline 수정한 `props.<field>` 가 canonical primary.
 * - packages/shared 영역 (renderers): default `'legacy-first'` — renderers 기존 패턴
 *   `element.<field> || element.props.<field>` 보존 (legacy persistent storage 우선).
 *
 * 두 영역의 priority 차이는 framing 의문이며, Phase 5 G7 closure 시점의
 * canonical primary 저장 진입과 함께 통일 결정 사항. 본 helper 는 priority
 * option 으로 양쪽 caller 를 동일 API 로 수용.
 *
 * @see docs/adr/completed/116-canonical-document-ssot-transition.md §G7 Extension Boundary
 * @see docs/adr/design/116-canonical-document-ssot-transition-breakdown.md §10.2 G6-1
 */

import type { DataBinding } from "../types/element.types";

export type ExtensionReadPriority =
  | "legacy-first"
  | "props-first"
  | "legacy-only";

/**
 * Generic legacy element shape — packages/shared 의 다양한 caller (TableRenderer
 * `element` / SelectionRenderers `element` / DataTableComponent `element`) 양쪽
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
 * default priority = `'legacy-first'` (packages/shared 영역 renderers 기존 패턴 보존).
 * Phase 5 G7 closure 시 helper 내부 reverse — `node.extension['x-composition'].events`
 * 우선 read 후 props/legacy fallback 으로 변경.
 */
export function getElementEvents(
  element: LegacyElementWithExtension,
  priority: ExtensionReadPriority = "legacy-first",
): unknown[] {
  const props = element.props as Record<string, unknown> | undefined;
  const propsEvents = props?.events;
  if (priority === "legacy-first") {
    if (Array.isArray(element.events)) return element.events;
    if (Array.isArray(propsEvents)) return propsEvents;
    return [];
  }
  // props-first
  if (Array.isArray(propsEvents)) return propsEvents;
  if (Array.isArray(element.events)) return element.events;
  return [];
}

/**
 * legacy `Element.dataBinding` 영역 — read-through priority.
 *
 * default priority = `'legacy-first'` (packages/shared 영역 renderers 기존 패턴 보존).
 * Phase 5 G7 closure 시 helper 내부 reverse —
 * `node.extension['x-composition'].dataBinding` 우선 read.
 *
 * return type `DataBinding | undefined` — caller 가 `?.type / ?.source / ?.config`
 * direct access 시 type-narrow 안전. 단 legacy/props 의 raw 값이 `DataBinding`
 * shape 와 불일치할 경우 type assertion (cast) 책임은 helper 가 부담 — caller 는
 * 기존 cast 를 제거 가능.
 */
export function getElementDataBinding(
  element: LegacyElementWithExtension,
  priority: ExtensionReadPriority = "legacy-first",
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
