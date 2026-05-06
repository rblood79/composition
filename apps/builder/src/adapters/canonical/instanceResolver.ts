/**
 * G.1 Instance Resolver
 *
 * Master-Instance 관계에서 Instance의 최종 props를 해석하는 순수 함수.
 * 상태 비종속 — 모든 필요 데이터를 인자로 전달받는다.
 *
 * 우선순위: descendant override > instance override > master props > default
 *
 * @see docs/WASM_DOC_IMPACT_ANALYSIS.md §G.1
 */

import type { Element } from "../../types/builder/unified.types";
import type { ResolvedInstanceProps } from "../../types/builder/component.types";
import type {
  CanonicalNode,
  DescendantOverride,
  RefNode,
} from "@composition/shared";
import { getLegacyOverrides } from "./legacyElementFields";

// ─────────────────────────────────────────────
// Pure helper — ADR-903 P1 Stage 2
// ─────────────────────────────────────────────

/**
 * @internal Reusable props merger with deep-style merging.
 *
 * 기존 resolveInstanceProps / resolveDescendantOverrides의 공통 패턴 추출.
 * canonical resolver (Phase 2)도 동일 merge semantics 사용 — DRY.
 *
 * style 필드는 shallow spread가 아닌 심층 병합(base style + override style).
 * 나머지 필드는 override가 base를 완전히 덮어쓴다.
 *
 * **시각 대칭 보장**: legacy resolveInstanceProps와 resolveDescendantOverrides,
 * 그리고 canonical resolveCanonicalRefProps / resolveCanonicalDescendantOverride
 * 모두 이 함수를 경유하므로 style 심층 병합 semantics가 단일 구현으로 통일된다.
 */
export function mergePropsWithStyleDeep(
  baseProps: Record<string, unknown>,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...baseProps, ...overrides };
  if (baseProps.style || overrides.style) {
    merged.style = {
      ...((baseProps.style as Record<string, unknown> | undefined) ?? {}),
      ...((overrides.style as Record<string, unknown> | undefined) ?? {}),
    };
  }
  return merged;
}

// ─────────────────────────────────────────────
// Canonical helpers — ADR-903 P1 Stage 2 / P2 progress
// ─────────────────────────────────────────────

/**
 * @experimental ADR-903 P2 progress — canonical RefNode root merge.
 *
 * legacy resolveInstanceProps의 canonical 등가물.
 * master CanonicalNode와 RefNode의 루트 속성을 병합하여 resolved props 산출.
 * style은 심층 병합.
 *
 * P2 resolver가 ref → resolved tree 변환 시 호출.
 * legacy resolveInstanceProps와 동일한 mergePropsWithStyleDeep semantics 사용
 * — 시각 결과 대칭 보장.
 *
 * **props 계약**: ADR-116 direct cutover 이후 master/ref props source는
 * `CanonicalNode.props` 하나다. `metadata.legacyProps` 는 adapter/export 경계의
 * quarantine payload이며 resolver 입력으로 사용하지 않는다.
 */
export function resolveCanonicalRefProps(
  master: CanonicalNode,
  refNode: RefNode,
): Record<string, unknown> {
  const masterProps = master.props ?? {};
  const refOverrides = refNode.props ?? {};

  return mergePropsWithStyleDeep(masterProps, refOverrides);
}

/**
 * @experimental ADR-903 P2 progress — canonical descendants mode A 병합.
 *
 * descendants[path]가 mode A (속성 patch — id/type/children 모두 없음)일 때
 * 기존 child 노드 속성과 머지. mode B/C는 P2 resolver의 별도 분기 담당.
 *
 * legacy resolveDescendantOverrides와 동일 semantics — mergePropsWithStyleDeep 사용.
 * canonical 형태의 child 노드를 받으므로 CanonicalNode 반환.
 *
 * @throws 호출자가 mode B(type 존재) 또는 mode C(children 존재)를 잘못 전달한 경우 에러.
 */
export function resolveCanonicalDescendantOverride(
  child: CanonicalNode,
  descendants: Record<string, DescendantOverride> | undefined,
  pathKey: string,
): CanonicalNode {
  if (!descendants) return child;
  const override = descendants[pathKey];
  if (!override) return child;

  // mode 판정: type 또는 children 키가 있으면 patch 모드 아님 (caller 책임으로 에러)
  if ("type" in override || "children" in override) {
    throw new Error(
      `[ADR-903] resolveCanonicalDescendantOverride called with non-patch mode at path "${pathKey}" — caller must dispatch mode B/C separately`,
    );
  }

  const childProps = child.props ?? {};
  const mergedProps = mergePropsWithStyleDeep(
    childProps,
    override as Record<string, unknown>,
  );

  return {
    ...child,
    props: mergedProps,
  };
}

// ─────────────────────────────────────────────
// Legacy public API — 시그니처 무변경
// ─────────────────────────────────────────────

/**
 * Instance 요소의 props를 master와 병합하여 최종 props 반환
 *
 * @deprecated ADR-116 G5-B P5-B — read-through fallback only.
 * legacy `componentRole === "instance"` + instance overrides (Record) 경로
 * 전용 helper. 신규 canonical 경로는 `resolveInstanceWithSharedCache`
 * (`resolvers/canonical/storeBridge.ts`) 또는 `resolveCanonicalRefElement`
 * (`builder/utils/canonicalRefResolution.ts`) 사용. legacy 분기 자체는 ADR-111
 * P3 cleanup 영역이며, 본 함수 caller migration 도 ADR-111 P3 cleanup 과 동시 진행.
 *
 * @param instance componentRole === 'instance' 요소
 * @param master instance.masterId로 조회한 master 요소
 * @returns 병합된 props와 각 prop의 출처
 */
export function resolveInstanceProps(
  instance: Element,
  master: Element,
): ResolvedInstanceProps {
  const masterProps = master.props || {};
  const overrides = getLegacyOverrides(instance) || {};
  const sources: Record<
    string,
    "master" | "override" | "descendant" | "default"
  > = {};

  // sources 추적 (legacy API contract 보존)
  for (const key of Object.keys(masterProps)) sources[key] = "master";
  for (const key of Object.keys(overrides)) sources[key] = "override";

  const props = mergePropsWithStyleDeep(masterProps, overrides);
  return { props, sources };
}

/**
 * Instance 요소를 master 기반으로 해석하여 렌더링 가능한 Element 반환
 *
 * master가 없으면 원본 instance를 그대로 반환.
 *
 * @deprecated ADR-116 G5-B P5-B — read-through fallback only.
 * legacy `resolveInstanceProps` 의 thin wrapper. 신규 canonical 경로는
 * `resolveInstanceWithSharedCache` 또는 `resolveCanonicalRefElement` 사용.
 */
export function resolveInstanceElement(
  instance: Element,
  master: Element | undefined,
): Element {
  if (!master) return instance;

  const { props } = resolveInstanceProps(instance, master);

  return {
    ...instance,
    type: master.type,
    props,
  };
}

/**
 * Descendant overrides 적용
 *
 * Instance의 descendants 맵에서 childId에 해당하는 오버라이드를 child element에 적용.
 * 오버라이드가 없으면 원본 반환.
 *
 * @deprecated ADR-116 G5-B P5-B — read-through fallback only.
 * legacy `instance.descendants[childId]` (flat Record<childId, props>) 경로 전용.
 * 신규 canonical 경로는 `resolveCanonicalDescendantOverride`
 * (canonical RefNode.descendants[path] DescendantOverride 3-mode) 사용.
 */
export function resolveDescendantOverrides(
  childElement: Element,
  instanceDescendants: Record<string, Record<string, unknown>> | undefined,
): Element {
  if (!instanceDescendants) return childElement;

  const overrides = instanceDescendants[childElement.id];
  if (!overrides) return childElement;

  const mergedProps = mergePropsWithStyleDeep(childElement.props, overrides);

  return {
    ...childElement,
    props: mergedProps,
  };
}
