/**
 * @fileoverview ADR-158 Phase 3 — InteractionRule 실행 dispatcher.
 *
 * 규칙 하나를 실제 동작으로 바꾸는 **순수 함수**다. React·store·router 를 직접
 * 참조하지 않고 전부 `DispatchDeps` 로 받는다 — 그래야 실행 규칙 자체를 DOM 없이
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
 * 컴포넌트 종류를 알 필요가 없다. ADR-280 — 값은 현재 유효 상태에서 계산하고
 * (`op` 집합 연산), RAC 제약 (`guards`) 이 막는 쓰기는 하지 않는다 (`constraints.ts`).
 *
 * @see docs/adr/design/158-interactions-rules-capability-registry-breakdown.md §4
 */
import {
  COMMON_CAPABILITIES,
  CAPABILITY_REGISTRY,
  type CapabilityDef,
} from "./capabilityRegistry";
import {
  applyCapabilityOp,
  checkCapabilityConstraints,
  toKeySet,
} from "./constraints";
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
  /**
   * ADR-214 Phase 4 — 변수 값 쓰기 (shared runtimeState). `instanceKeyFor` 는 트리거 요소의
   * 렌더 문맥 (조상 origin id → instanceKey) — 요소 변수의 스코프를 정한다. 미주입 환경
   * (구 preview 경로 · 테스트) 에서는 규칙이 실패로 돌아온다 (조용한 no-op 금지).
   */
  writeState?: (request: {
    variableId: string;
    op: "set" | "toggle" | "increment" | "reset";
    value?: unknown;
    instanceKeyFor?: (ownerElementId: string) => string;
  }) => { ok: boolean; reason?: string };
  /**
   * ADR-280 Decision 8 — the target's current RAC state for a prop: the runtime override, else
   * what it starts with (a collection's Selected items …) — the Preview render reads the same
   * (`catalogRuntimeStateOf`). Absent = the prop as `getElement` gives it.
   */
  getRuntimeState?: (id: string, prop: string) => unknown;
  /**
   * Restrictions an enclosing RAC group passes the target (CheckboxGroup · RadioGroup ·
   * ToggleButtonGroup · DisclosureGroup `isDisabled` · `isReadOnly`), and a collection's item keys
   * (all · disabled ones).
   */
  getConstraintContext?: (id: string) => {
    inherited?: { isDisabled?: boolean; isReadOnly?: boolean };
    itemKeys?: readonly string[];
    disabledKeys?: readonly string[];
  };
  /**
   * ADR-280 Decision 3 — the record that receives a state write: an overlay body's open state is
   * its trigger's (`string`), `null` when RAC lets no one control it, `undefined` = the target.
   */
  stateOwnerOf?: (id: string, prop: string) => string | null | undefined;
  /**
   * ADR-280 Decision 9 — a DOM-ref capability (Form `submit` · `reset`). Absent = it fails
   * (never a silent no-op).
   */
  invokeImperative?: (
    id: string,
    capability: string,
  ) => { ok: boolean; reason?: string };
  /**
   * ADR-281 Decision 5 — send a body to an API endpoint. Returns whether the request started; the
   * response's failure is the caller's to report (report + toast — it settles later). Absent = the
   * rule fails (never a silent no-op).
   */
  callEndpoint?: (
    endpointId: string,
    body: unknown,
  ) => { ok: boolean; reason?: string };
}

/** 트리거 요소의 렌더 문맥 — `createElementHandlers` 가 규칙 실행에 실어 보낸다 */
export interface DispatchContext {
  instanceKeyFor?: (ownerElementId: string) => string;
  /**
   * ADR-280 Decision 6 — the RAC callback's arguments of the event that ran the rule, by name
   * (`!event.<name>` in a capability's value).
   */
  event?: Readonly<Record<string, unknown>>;
}

/** 실행 결과 — 실패를 삼키지 않고 호출부(및 테스트)가 볼 수 있게 돌려준다. */
export type DispatchOutcome =
  | {
      ok: true;
      kind: "navigate" | "toast" | "capability" | "setState" | "callEndpoint";
    }
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
  event?: Readonly<Record<string, unknown>>,
): { ok: true; value: unknown } | { ok: false; reason: string } {
  if (def.value === "!param") {
    if (paramValue === undefined) {
      return {
        ok: false,
        reason: "capability 가 값을 요구하나 params 가 없다",
      };
    }
    if (typeof paramValue === "string" && paramValue.startsWith("!event.")) {
      const name = paramValue.slice("!event.".length);
      if (!event || !(name in event))
        return { ok: false, reason: `이벤트 인자 없음: ${paramValue}` };
      // (A RAC Selection — `"all"` or a Set — goes on as an array, ADR-214's normalization.)
      const raw = event[name];
      return { ok: true, value: raw instanceof Set ? toKeySet(raw) : raw };
    }
    return { ok: true, value: paramValue };
  }

  if (def.value === "!self") {
    if (typeof currentValue === "boolean") {
      return { ok: true, value: !currentValue };
    }
    // A prop's toggle is a boolean state: unwritten = off (ADR-281 — a page root's or frame's
    //   `isReadOnly` has no value until a rule sets it; the display channel below wrote "none").
    if (!def.prop.startsWith("style."))
      return { ok: true, value: !currentValue };
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

/** 규칙 하나를 실행한다. */
export function executeInteractionRule(
  rule: InteractionRule,
  deps: DispatchDeps,
  context?: DispatchContext,
): DispatchOutcome {
  const { action } = rule;

  if (action.kind === "setState") {
    if (!action.variableId)
      return { ok: false, reason: "setState 에 variableId 가 없다" };
    if (!deps.writeState)
      return {
        ok: false,
        reason: "setState 실행 경로 없음 (writeState 미주입)",
      };
    const result = deps.writeState({
      variableId: action.variableId,
      op: action.op,
      value: action.value,
      instanceKeyFor: context?.instanceKeyFor,
    });
    return result.ok
      ? { ok: true, kind: "setState" }
      : { ok: false, reason: result.reason ?? "setState 실패" };
  }

  if (action.kind === "callEndpoint") {
    if (!deps.callEndpoint)
      return {
        ok: false,
        reason: "callEndpoint 실행 경로 없음 (callEndpoint 미주입)",
      };
    // ADR-280 Decision 8 ① — the value resolves as a capability's does (`!event.<arg>` · literal).
    let body = action.body;
    if (typeof body === "string" && body.startsWith("!event.")) {
      const name = body.slice("!event.".length);
      const event = context?.event;
      if (!event || !(name in event))
        return { ok: false, reason: `이벤트 인자 없음: ${body}` };
      body = event[name];
    }
    const result = deps.callEndpoint(action.endpointId, body);
    return result.ok
      ? { ok: true, kind: "callEndpoint" }
      : { ok: false, reason: result.reason ?? "callEndpoint 실패" };
  }

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
    // ADR-280 Decision 9 — prop patch 로 환원되지 않는 DOM ref 특례 (Form submit · reset).
    // 실행 경로가 없으면 실패를 돌려준다 — 조용한 no-op 은 "눌렀는데 아무 일도 없다" 가 된다.
    if (!deps.invokeImperative)
      return {
        ok: false,
        reason: `imperative capability 미지원: ${target.type}.${action.capability}`,
      };
    const result = deps.invokeImperative(action.targetId, action.capability);
    return result.ok
      ? { ok: true, kind: "capability" }
      : {
          ok: false,
          reason:
            result.reason ??
            `imperative capability 실패: ${target.type}.${action.capability}`,
        };
  }

  // ADR-280 Decision 3 — 상태의 수신자 (overlay 본체의 open 은 trigger 의 것).
  const owner = deps.stateOwnerOf?.(action.targetId, def.prop);
  if (owner === null)
    return {
      ok: false,
      reason: `RAC 가 ${target.type} 의 ${def.prop} 를 밖에서 제어하게 하지 않는다 (${action.capability})`,
    };
  const receiverId = owner ?? action.targetId;
  const receiver =
    receiverId === action.targetId ? target : deps.getElement(receiverId);
  if (!receiver) return { ok: false, reason: `대상 요소 없음: ${receiverId}` };

  // ADR-280 Decision 8 — 값 해소 → 현재 유효 상태 → 결과 계산 → RAC 제약 검사 → 결과 전체 쓰기.
  const current =
    def.prop && !def.prop.startsWith("style.") && deps.getRuntimeState
      ? deps.getRuntimeState(receiverId, def.prop)
      : readCurrent(def.prop, receiver.props);
  const resolved = resolveValue(
    def,
    current,
    action.params?.value,
    context?.event,
  );
  if (!resolved.ok) return resolved;
  const constraintContext = {
    props: receiver.props,
    current,
    ...deps.getConstraintContext?.(receiverId),
  };
  const next = applyCapabilityOp(def, resolved.value, constraintContext);
  const refused = checkCapabilityConstraints(
    def,
    resolved.value,
    next,
    constraintContext,
  );
  if (refused)
    return {
      ok: false,
      reason: `RAC 제약 (${refused}) — ${target.type}.${action.capability} 을 쓰지 않는다`,
    };

  deps.updateElementProps(
    receiverId,
    buildPatch(def.prop, next, receiver.props),
  );
  return { ok: true, kind: "capability" };
}
