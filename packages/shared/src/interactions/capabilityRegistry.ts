/**
 * @fileoverview ADR-158 Phase 1 — Capability Registry (어휘 SSOT 단일 파일).
 *
 * 두 축을 한 곳에서 선언한다:
 * - **When** (`events`): 그 컴포넌트가 낼 수 있는 RAC/RSP 실존 callback
 * - **Do** (`capabilities`): 그 컴포넌트가 "당할 수 있는" 고유 기능 =
 *   RAC controlled prop 1개를 patch 하는 선언
 *
 * 구 `EVENT_REGISTRY` (DOM 별칭 10종 혼재) + `IMPLEMENTED_ACTION_TYPES`
 * (camelCase 28 + snake_case 별칭 19) + `metadata.ts` supportedEvents 를 대체·흡수한다.
 *
 * ## G1 게이트
 * 모든 capability 는 `racRef` (RAC controlled prop 근거) 를 가져야 한다 — 근거 없는
 * 항목은 등재 금지. `capabilityRegistry.test.ts` 가 정적으로 집행한다.
 *
 * ## 등재 vs 보류
 * ADR-280 (2026-10-22) — Preview/Publish 는 상태 prop 을 첫 render 부터 controlled 로 넘긴다
 * (`catalog/runtime/runtimeStateProps.ts`). 등록표는 RAC 개념 표에서 유도하고
 * (`componentInteractionSpecs.ts`), Preview 가 아직 전달하지 못하는 capability 만 `deferred`
 * 에 키로 남긴다 (G1 — 사용자에게 노출되지 않는다).
 *
 * @see docs/adr/completed/158-interactions-rules-capability-registry.md
 * @see docs/adr/completed/280-interactions-rac-surface-registry-controlled-runtime.md
 */

import { COMPONENT_INTERACTION_SPECS } from "./componentInteractionSpecs";
import { deriveRegistry } from "./deriveRegistry";
import {
  catalogAccepts,
  deriveReferenceCapabilities,
} from "./referenceCapabilities";

/**
 * ADR-201 Phase 3 — 파일 입력 2종의 When 축 (정의는 `concepts/files.ts` — `satisfies` 로 RAC prop
 * 실존을 컴파일 시 증명).
 */
export { DROP_ZONE_EVENTS, FILE_TRIGGER_EVENTS } from "./concepts/files";

/** capability 가 값을 요구할 때 패널이 물어볼 입력의 종류 */
export interface CapabilityParam {
  /**
   * ADR-287 — `choice` (one of the prop's catalog choices — `deriveOptions`, read where the panel
   * shows them) · `icon` (an icon name).
   */
  kind: "itemKey" | "value" | "text" | "number" | "choice" | "icon";
  /** 입력 레이블의 카탈로그 키 (`labelKey` 와 같은 이유로 문구가 아니다) */
  labelKey: string;
}

export interface CapabilityDef {
  /**
   * 표시 문구의 **카탈로그 키** — 문구 자체가 아니다.
   *
   * shared 는 빌더의 i18n provider 에 닿을 수 없고 (앱 경계), 규칙은 저장돼 뒤에 다시
   * 읽히므로 문구를 여기 굳히면 언어를 바꿔도 예전 언어가 남는다. 키만 싣고 패널이
   * 렌더 시점에 푼다 (ADR-200 후속).
   */
  labelKey: string;
  /**
   * patch 대상 prop 경로. `style.` 접두는 `props.style` 하위를 뜻한다.
   * `imperative: true` 인 특례는 prop 이 아니라 DOM ref 호출이라 빈 문자열.
   */
  prop: string;
  /**
   * 설정값.
   * - 리터럴: 그 값으로 patch
   * - `"!self"`: 현재값 토글
   * - `"!param"`: 규칙의 `action.params.value` 사용 (`param` 선언 필수)
   * - `null`: 해제 (prop 제거)
   */
  value: unknown;
  /** RAC controlled prop 근거 — G1 증빙 (필수) */
  racRef: string;
  /**
   * ADR-287 — the reference API prop when the catalog stores it under another (`prop`): a Button's
   * `children` is its `label` (ADR-276). Absent = `prop` is the reference's name.
   */
  referenceProp?: string;
  /** 값이 필요한 capability 의 입력 사양 (`value: "!param"` 과 쌍) */
  param?: CapabilityParam;
  /** generic prop patch 로 환원 불가 — DOM ref 경유 특례 */
  imperative?: boolean;
  /**
   * ADR-280 Decision 8 — 이 쓰기를 막는 RAC 제약 prop (개념의 conditions 에서 유도).
   * dispatcher 가 쓰기 전에 읽는다.
   */
  guards?: readonly string[];
  /**
   * ADR-280 Decision 8 — a key-set operation over the current state (`add` · `remove` a key —
   * `selectionMode: "single"` replaces); absent = the resolved value is written as is.
   */
  op?: "add" | "remove";
  /** The selection mode RAC uses when `selectionMode` is unset (a Select's `"single"`). */
  selectionDefault?: "single";
}

export interface ComponentCapability {
  /** When 축 — RAC/RSP 레퍼런스 실존 callback 만 */
  events: readonly string[];
  /** Do 축 — 등재 완료된 고유 기능 */
  capabilities: Readonly<Record<string, CapabilityDef>>;
  /**
   * G1 보류 — RAC 에는 controlled prop 이 있으나 Preview 렌더러가 미배선/무반응
   * (분류 (c)) 이라 등재를 보류한 capability 키. 사용자에게 노출되지 않는다.
   */
  deferred?: readonly string[];
  /**
   * ADR-280 — 유도했지만 패널에 내놓지 않는 RAC callback (keyboard — 사용자 결정 Q3 · hover ·
   * focus · press 보조 이벤트 · 항목 노드의 이벤트). 패널 정책은 ADR B.
   */
  hiddenEvents?: readonly string[];
  /**
   * ADR-281 Decision 2 — each event's argument names (`!event.<name>`), from the concepts' `args`.
   */
  eventArgs?: Readonly<Record<string, readonly string[]>>;
  /** ADR-284 Phase 5 — events whose `eventArgs` name the fields of their one event object. */
  eventArgFields?: readonly string[];
  /**
   * ADR-281 Decision 1 — the panel's When groups: one per concept (RAC documentation section) in
   * spec order, with the props that stop RAC firing its events. An `item` owner's concepts are not
   * here (the item node offers them).
   */
  groups?: readonly TriggerGroup[];
}

/** ADR-281 — one When group (a RAC documentation section) of a component. */
export interface TriggerGroup {
  id: string;
  events: readonly string[];
  hiddenEvents: readonly string[];
  conditions: readonly string[];
}

/**
 * 모든 시각 요소가 공통으로 갖는 capability — `props.style.display` 단일 채널.
 *
 * RAC controlled prop 이 아니라 CSS 표시 제어라 `racRef` 는 CSS 근거를 적는다.
 * (G1 의 취지는 "근거 없는 등재 금지" — 공통 3종은 렌더 경로가 D3 style 을 그대로
 * 소비하므로 컴포넌트 종류와 무관하게 동작이 보장된다.)
 */
export const COMMON_CAPABILITIES: Readonly<Record<string, CapabilityDef>> = {
  show: {
    labelKey: "capabilities.show",
    prop: "style.display",
    value: null,
    racRef:
      "CSS display — props.style 은 전 렌더러가 root 에 전달 (ADR-907 Layer C)",
  },
  hide: {
    labelKey: "capabilities.hide",
    prop: "style.display",
    value: "none",
    racRef:
      "CSS display — props.style 은 전 렌더러가 root 에 전달 (ADR-907 Layer C)",
  },
  toggle: {
    labelKey: "capabilities.toggleVisibility",
    prop: "style.display",
    value: "!self",
    racRef:
      "CSS display — props.style 은 전 렌더러가 root 에 전달 (ADR-907 Layer C)",
  },
} as const;

/**
 * 컴포넌트별 선언. 키는 canonical 컴포넌트 `type` (composition-vocabulary.ts).
 *
 * `capabilities` 에는 공통 3종을 중복 선언하지 않는다 — `resolveCapabilities()` 가
 * 조회 시점에 병합한다.
 */
/**
 * 컴포넌트별 선언. 키는 canonical 컴포넌트 `type` (composition-vocabulary.ts).
 *
 * ADR-280 Phase 1 — 손으로 쓰지 않는다. RAC 개념 파일 (`concepts/*.ts`, 설치 d.ts `satisfies`)
 * 과 컴포넌트 spec (`componentInteractionSpecs.ts`) 에서 모듈 로드 때 한 번 유도한다.
 * `capabilities` 에는 공통 3종을 중복 선언하지 않는다 — `resolveCapabilities()` 가 조회 시점에
 * 병합한다.
 */
export const CAPABILITY_REGISTRY: Readonly<
  Record<string, ComponentCapability>
> = withReferenceCapabilities(deriveRegistry(COMPONENT_INTERACTION_SPECS));

/**
 * ADR-287 — each type's reference API Do (`referenceCapabilities.ts`, from the binding `accepts`)
 * after its concepts' (a concept's prop and id win). A type with no concept gets an entry of Do only.
 */
function withReferenceCapabilities(
  concepts: Readonly<Record<string, ComponentCapability>>,
): Readonly<Record<string, ComponentCapability>> {
  const out: Record<string, ComponentCapability> = { ...concepts };
  for (const [type, accepts] of catalogAccepts()) {
    const entry = concepts[type];
    const own = entry?.capabilities ?? {};
    const derived = deriveReferenceCapabilities(
      type,
      accepts,
      new Set(Object.values(own).map((def) => def.prop)),
      new Set([...Object.keys(own), ...(entry?.deferred ?? [])]),
    );
    if (!Object.keys(derived).length) continue;
    out[type] = Object.freeze({
      ...(entry ?? { events: Object.freeze([]) }),
      capabilities: Object.freeze({ ...own, ...derived }),
    });
  }
  return Object.freeze(out);
}

/**
 * 앱 액션 — 대상 요소가 없는 전역 동작.
 *
 * `labelKey` 는 패널 Do 축 선택지(`ACTION_CHOICE_LABEL_KEYS`)와 **같은 키**를 가리킨다 —
 * 같은 동작을 두 문장으로 갈라 두면 한쪽만 고쳐지는 순간 어휘가 어긋난다.
 */
export const APP_ACTIONS = {
  navigate: {
    labelKey: "interactions.actionNavigate",
    param: { kind: "text", labelKey: "capabilities.paramPath" },
  },
  toast: {
    labelKey: "interactions.actionToast",
    param: { kind: "text", labelKey: "capabilities.paramMessage" },
  },
} as const satisfies Record<
  string,
  { labelKey: string; param: CapabilityParam }
>;

export type AppActionKind = keyof typeof APP_ACTIONS;

/**
 * 대상 요소 type 의 전체 capability (공통 3종 + 고유). 미등록 type 도 공통 3종은 갖는다.
 */
export function resolveCapabilities(
  componentType: string,
): Readonly<Record<string, CapabilityDef>> {
  const own = CAPABILITY_REGISTRY[componentType]?.capabilities;
  return own ? { ...COMMON_CAPABILITIES, ...own } : COMMON_CAPABILITIES;
}

/** 트리거로 쓸 수 있는 callback 목록. 미등록 type 은 빈 배열 (트리거 불가). */
export function resolveTriggers(componentType: string): readonly string[] {
  return CAPABILITY_REGISTRY[componentType]?.events ?? [];
}

const EVENT_ARG_NAMES = (() => {
  const lists = new Map<string, (readonly string[])[]>();
  for (const entry of Object.values(CAPABILITY_REGISTRY))
    for (const [event, names] of Object.entries(entry.eventArgs ?? {})) {
      const known = lists.get(event) ?? [];
      if (!known.some((list) => list.join() === names.join()))
        known.push(names);
      lists.set(event, known);
    }
  return lists;
})();

/**
 * ADR-281 Decision 2 — the argument name lists a callback has across the registry (the concepts'
 * `args`); `bindings.ts` names a fired callback's arguments by every list.
 */
export function eventArgNames(event: string): readonly (readonly string[])[] {
  return EVENT_ARG_NAMES.get(event) ?? [];
}

const EVENT_ARG_FIELDS: ReadonlySet<string> = new Set(
  Object.values(CAPABILITY_REGISTRY).flatMap(
    (entry) => entry.eventArgFields ?? [],
  ),
);

/** ADR-284 Phase 5 — whether a callback's argument names are its one event object's fields. */
export const eventArgsAreFields = (event: string): boolean =>
  EVENT_ARG_FIELDS.has(event);

/** 해당 type 이 Do 축 대상이 될 수 있는지 (공통 3종만 있어도 true) */
export function isCapabilityTarget(componentType: string): boolean {
  return Object.keys(resolveCapabilities(componentType)).length > 0;
}
