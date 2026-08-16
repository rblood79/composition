/**
 * @fileoverview ADR-158 Phase 3 — InteractionRule 발화 dispatcher.
 *
 * 규칙 하나를 실제 동작으로 바꾸는 **순수 함수**다. React·store·router 를 직접
 * 참조하지 않고 전부 `DispatchDeps` 로 받는다 — 그래야 발화 규칙 자체를 DOM 없이
 * 단위 테스트할 수 있고, preview 와 publish 가 같은 dispatcher 를 소비한다.
 *
 * 2026-08-17 — breakdown §7 의 후속 이관 실행: `apps/builder/src/preview/interactions/`
 * 에서 shared 로 승격. preview 쪽 파일은 re-export 포워더로 남는다.
 *
 * 분기는 셋뿐이다 (§4):
 *   navigate   → preview router 페이지 전환
 *   toast      → toast 큐에 추가
 *   capability → 대상 요소 prop patch (generic)
 *
 * `capability` 가 generic 한 이유는 `CapabilityDef` 가 "어떤 prop 을 무엇으로
 * 바꾸는가" 를 이미 데이터로 들고 있기 때문이다 (`prop` / `value`). dispatcher 는
 * 컴포넌트 종류를 알 필요가 없고, (a) controlled 와 (b) remount 를 구분할 필요도
 * 없다 — 둘 다 "prop 을 patch" 로 동일하다 (breakdown §6 Phase 3 선행 확인).
 *
 * @see docs/adr/design/158-interactions-rules-capability-registry-breakdown.md §4
 */
import {
  COMMON_CAPABILITIES,
  CAPABILITY_REGISTRY,
  type CapabilityDef,
} from "./capabilityRegistry";
import type { InteractionRule } from "./interactionRule.types";

/** dispatcher 가 바깥 세계에 닿는 유일한 통로. */
export interface DispatchDeps {
  /** 대상 요소의 현재 상태 — `"!self"` 토글의 현재값 조회용 */
  getElement: (
    id: string,
  ) => { type: string; props: Record<string, unknown> } | undefined;
  /** 대상 요소 prop patch (preview runtime store) */
  updateElementProps: (id: string, props: Record<string, unknown>) => void;
  /** preview router 페이지 전환 */
  navigate: (path: string) => void;
  /** toast 큐 추가 */
  showToast: (message: string) => void;
}

/** 발화 결과 — 실패를 삼키지 않고 호출부(및 테스트)가 볼 수 있게 돌려준다. */
export type DispatchOutcome =
  | { ok: true; kind: "navigate" | "toast" | "capability" }
  | { ok: false; reason: string };

/**
 * `CapabilityDef` 를 찾는다. 공통 3종(show/hide/toggle)은 모든 type 이 갖고,
 * 컴포넌트 고유 capability 가 같은 키를 덮는다 (`resolveCapabilities` 와 동일 순서).
 */
function findCapability(
  componentType: string,
  capability: string,
): CapabilityDef | undefined {
  const own = CAPABILITY_REGISTRY[componentType]?.capabilities;
  return own?.[capability] ?? COMMON_CAPABILITIES[capability];
}

/**
 * `CapabilityDef.value` 를 실제 patch 값으로 해소한다.
 *
 * - `"!self"` — 현재값 토글. `style.display` 처럼 "값이 있으면 숨김" 인 채널은
 *   현재값이 설정돼 있으면 해제(null), 없으면 설정한다. boolean prop 은 반전.
 * - `"!param"` — 규칙이 실어 보낸 `action.params.value`
 * - 그 외 — 리터럴 그대로 (`null` 은 prop 제거를 뜻한다)
 */
function resolveValue(
  def: CapabilityDef,
  currentValue: unknown,
  paramValue: unknown,
): { ok: true; value: unknown } | { ok: false; reason: string } {
  if (def.value === "!param") {
    if (paramValue === undefined) {
      return {
        ok: false,
        reason: "capability 가 값을 요구하나 params 가 없다",
      };
    }
    return { ok: true, value: paramValue };
  }

  if (def.value === "!self") {
    if (typeof currentValue === "boolean") {
      return { ok: true, value: !currentValue };
    }
    // 값 유무로 토글하는 채널 (style.display 등) — 설정돼 있으면 해제
    return { ok: true, value: currentValue == null ? "none" : null };
  }

  return { ok: true, value: def.value };
}

/**
 * `prop` 경로를 patch 객체로 만든다.
 *
 * `style.` 접두는 `props.style` 하위를 뜻한다 (`CapabilityDef.prop` 계약). style
 * 은 **기존 값을 보존한 병합**이어야 한다 — 통째로 갈아치우면 요소가 갖고 있던
 * 나머지 스타일이 사라진다.
 */
function buildPatch(
  propPath: string,
  value: unknown,
  currentProps: Record<string, unknown>,
): Record<string, unknown> {
  if (!propPath.startsWith("style.")) {
    return { [propPath]: value };
  }

  const styleKey = propPath.slice("style.".length);
  const currentStyle = {
    ...((currentProps.style as Record<string, unknown> | undefined) ?? {}),
  };
  if (value === null) {
    delete currentStyle[styleKey];
  } else {
    currentStyle[styleKey] = value;
  }
  return { style: currentStyle };
}

/** `prop` 경로의 현재값을 읽는다 (`"!self"` 토글 판정용). */
function readCurrent(
  propPath: string,
  props: Record<string, unknown>,
): unknown {
  if (!propPath.startsWith("style.")) return props[propPath];
  const style = props.style as Record<string, unknown> | undefined;
  return style?.[propPath.slice("style.".length)];
}

/** 규칙 하나를 발화한다. */
export function executeInteractionRule(
  rule: InteractionRule,
  deps: DispatchDeps,
): DispatchOutcome {
  const { action } = rule;

  if (action.kind === "navigate") {
    const path = action.params?.path;
    if (!path) return { ok: false, reason: "navigate 에 path 가 없다" };
    deps.navigate(path);
    return { ok: true, kind: "navigate" };
  }

  if (action.kind === "toast") {
    const message = action.params?.message;
    if (!message) return { ok: false, reason: "toast 에 message 가 없다" };
    deps.showToast(message);
    return { ok: true, kind: "toast" };
  }

  const target = deps.getElement(action.targetId);
  if (!target) {
    return { ok: false, reason: `대상 요소 없음: ${action.targetId}` };
  }

  const def = findCapability(target.type, action.capability);
  if (!def) {
    return {
      ok: false,
      reason: `capability 미등재: ${target.type}.${action.capability}`,
    };
  }
  if (def.imperative) {
    // registry 에 `imperative: true` 로 표시된 특례는 prop patch 로 환원 불가라
    // dispatcher 가 다루지 않는다. 등재 자체가 보류(c) 이므로 정상 경로에서는
    // 도달하지 않지만, 조용히 no-op 하면 "눌렀는데 아무 일도 없다" 가 된다.
    return { ok: false, reason: `imperative capability 미지원: ${def.label}` };
  }

  const resolved = resolveValue(
    def,
    readCurrent(def.prop, target.props),
    action.params?.value,
  );
  if (!resolved.ok) return resolved;

  deps.updateElementProps(
    action.targetId,
    buildPatch(def.prop, resolved.value, target.props),
  );
  return { ok: true, kind: "capability" };
}
