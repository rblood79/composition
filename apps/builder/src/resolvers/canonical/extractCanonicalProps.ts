/**
 * @fileoverview ResolvedNode → canonical props helper — ADR-116 direct cutover.
 *
 * Resolver output consumers must read component payload from `ResolvedNode.props`
 * only. Metadata is reserved for page/import/debug annotations and adapter/export
 * quarantine payloads.
 *
 * 예외는 `dataBinding` 하나다 — 아래 주석 참조.
 */

import type { ResolvedNode } from "@composition/shared";

import { getElementDataBinding } from "../../adapters/canonical/compositionExtensionFields";

export function extractCanonicalPropsFromResolved(
  resolved: ResolvedNode,
): Record<string, unknown> {
  const props: Record<string, unknown> = resolved.props
    ? { ...resolved.props }
    : {};

  // `dataBinding` 은 두 형태로 저장된다 — 현재 authoring 은 `props.dataBinding`
  // (`replaceNodeProps` 경로; `PROPS_FORBIDDEN_KEYS` 는 `updateNodeProps` 만 막는다),
  // legacy/import 변환은 `x-composition` extension (`updateNodeExtension`) —
  // ADR-209 후속 §4.3, 2026-09-10 정정. 반면 DOM collection
  // wrapper 의 공개 계약은 `dataBinding` **prop** 이다
  // (`useCollectionData({ dataBinding })` — ADR-132). 그 사이를 잇는 자리가
  // 여기다. Skia 축은 같은 일을 `getElementDataBinding(sourceNode)` 로 한다.
  //
  // Why: 다리가 없으면 preview 는 binding 을 통째로 무시하고 정적 `props.items`
  //   만 그린다. DI provider 를 붙여도 wrapper 가 binding 자체를 못 받으므로
  //   증상이 그대로다 (2026-09-09 live 실측 — ADR-152 격차 7 위의 두 번째 격차).
  //
  // 읽기 자체는 정본 helper 하나가 한다 (`getElementDataBinding` — builder 기본
  // props-first, ADR-116 breakdown §10.2.4). 여기서는 그 결과를 prop 자리에
  // 올려놓기만 한다.
  if (props.dataBinding === undefined) {
    const binding = getElementDataBinding(resolved);
    if (binding !== undefined) props.dataBinding = binding;
  }

  return props;
}
