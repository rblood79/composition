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
 * - apps/builder 영역 (workflowEdges 등): default `'props-first'`
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
  "legacy-first" | "props-first" | "legacy-only";

/**
 * Generic legacy element shape — packages/shared 의 다양한 caller (TableRenderer
 * `element` / SelectionRenderers `element`) 양쪽 호환. helper 가 schema
 * dependency 없이 read-through 만 수행.
 *
 * (`DataTableComponent` 도 caller 였으나 2026-08-17 삭제 — DataRenderers 주석 참조)
 */
interface LegacyElementWithExtension {
  props?: Record<string, unknown> | unknown;
  events?: unknown;
  dataBinding?: unknown;
  /**
   * canonical 노드의 extension namespace. legacy mirror 요소에는 없고 canonical
   * 노드에만 있다 — 아래 `readExtensionDataBinding` 주석 참조.
   */
  "x-composition"?: { dataBinding?: unknown } | unknown;
}

/**
 * canonical 노드의 `x-composition.dataBinding` — **세 번째 저장 위치**.
 *
 * `canonicalDocumentStore` 의 `PROPS_FORBIDDEN_KEYS` 가 `dataBinding` 을 props 에
 * 넣지 못하게 막으므로, 유일한 쓰기 경로인 `updateNodeExtension` 이 여기에 쓴다.
 * legacy mirror 요소는 그 값을 top-level `dataBinding` 으로 복제해 갖지만
 * **canonical 노드 자체를 읽는 소비처** (Skia scene 의 `sourceNode`) 에는 복제본이
 * 없어 binding 을 통째로 보지 못한다.
 *
 * 읽기 순서에서 **최종 fallback** 인 이유: 기존 두 위치를 가진 요소의 결과를
 * 하나도 바꾸지 않기 위해서다. mirror 의 top-level 값은 extension 에서 파생된
 * 복제본이라 둘이 어긋날 일이 없고, priority 계약 3종 (`legacy-first` /
 * `props-first` / `legacy-only`) 의 기존 동작도 그대로 남는다.
 */
function readExtensionDataBinding(
  element: LegacyElementWithExtension,
): DataBinding | undefined {
  const extension = element["x-composition"];
  if (!extension || typeof extension !== "object") return undefined;
  const binding = (extension as { dataBinding?: unknown }).dataBinding;
  return binding === undefined ? undefined : (binding as DataBinding);
}

// `getElementEvents` 는 삭제됐다 (2026-08-17) — ADR-158(Implemented 2026-08-16)이
// 인터랙션을 canonical **root** `events` 컬렉션(`InteractionRule[]`)으로 옮기면서
// 요소별 `props.events` / `element.events` 를 읽는 소비처가 전부 사라졌다.
// 그 필드는 읽는 쪽도 쓰는 쪽도 없는 legacy 저장 데이터로만 남아 있고 roundtrip
// 보존은 builder `legacyElementSanitizer` 담당. 아래 `dataBinding` 축은 renderer
// 30+ 곳이 계속 소비하므로 그대로다.

/**
 * legacy `Element.dataBinding` 영역 — read-through priority.
 *
 * default priority = `'legacy-first'` (packages/shared 영역 renderers 기존 패턴 보존).
 *
 * priority 3종은 legacy(`element.dataBinding`) 와 props(`element.props.dataBinding`)
 * 사이의 순서만 정한다. canonical 의 `x-composition.dataBinding` 은 세 모드 모두에서
 * **최종 fallback** 으로 읽는다 (2026-09-09) — 근거는 `readExtensionDataBinding` 주석.
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
    return readExtensionDataBinding(element);
  }
  const props = element.props as Record<string, unknown> | undefined;
  const propsBinding = props?.dataBinding;
  if (priority === "legacy-first") {
    if (element.dataBinding !== undefined)
      return element.dataBinding as DataBinding;
    if (propsBinding !== undefined) return propsBinding as DataBinding;
    return readExtensionDataBinding(element);
  }
  // props-first
  if (propsBinding !== undefined) return propsBinding as DataBinding;
  if (element.dataBinding !== undefined)
    return element.dataBinding as DataBinding;
  return readExtensionDataBinding(element);
}
