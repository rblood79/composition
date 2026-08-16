/**
 * @fileoverview ADR-158 Phase 1 — `InteractionRule` canonical entry 스키마.
 *
 * `CompositionDocument.events` root collection (ADR-131) 의 entry 형태.
 * 메커니즘(root collection) 은 유지하고 entry 스키마만 교체한다 — 구
 * `SerializedEvent` + `SerializedAction` chain (actionRef/fallbackActionRef/
 * condition/next DAG) 은 은퇴.
 *
 * 규칙 1개 = 한 줄: `When(RAC callback) → Do(앱 액션 | 대상 capability)`.
 * 조건부 실행 / debounce / throttle / 다중 actions[] / 템플릿은 스키마에서
 * 원천 제거됐다 (ADR-158 §Decision — 필요 실증 시 후속 ADR).
 *
 * @see docs/adr/completed/158-interactions-rules-capability-registry.md
 * @see docs/adr/design/158-interactions-rules-capability-registry-breakdown.md §2
 */

/** 앱 액션 1 — preview router 페이지 전환 */
export interface NavigateAction {
  kind: "navigate";
  params: { path: string };
}

/** 앱 액션 2 — RAC ToastQueue.add() (ADR-158 R2: `UNSTABLE_` 접두 API 격리 지점) */
export interface ToastAction {
  kind: "toast";
  params: { message: string };
}

/**
 * 대상 요소의 고유 기능 구동. `capability` 는
 * `CAPABILITY_REGISTRY[targetType].capabilities` 또는 공통 capability 의 키.
 *
 * `params` 는 값이 필요한 capability (selectItem / setValue / selectTab 등) 전용 —
 * 해당 `CapabilityDef.param` 이 선언된 경우에만 유효하다. 무인자 capability
 * (clearSelection / expand / hide 등) 에서는 생략한다.
 */
export interface CapabilityAction {
  kind: "capability";
  /** 구동 대상 요소 id */
  targetId: string;
  /** capability 키 */
  capability: string;
  /** 값이 필요한 capability 의 인자 */
  params?: { value: unknown };
}

export type InteractionAction = NavigateAction | ToastAction | CapabilityAction;

/** canonical `events` root collection 의 entry */
export interface InteractionRule {
  /** stable id */
  id: string;
  /**
   * discriminator — root collection 정체성 명시 (구 `SerializedEvent.type:"event"`
   * 자리를 계승). 역직렬화 시 구 entry 와의 구분점.
   */
  type: "interaction";
  /** 트리거 요소 id */
  elementId: string;
  /**
   * RAC callback 이름 — `CAPABILITY_REGISTRY[elementType].events` 에 실존해야 한다.
   * DOM 별칭(onClick / onMouseEnter / onKeyDown …) 은 은퇴 어휘라 허용되지 않는다.
   */
  trigger: string;
  /** 수행할 동작 */
  action: InteractionAction;
}

/** entry 가 신규 스키마인지 판정 (구 `SerializedEvent` 잔존 데이터 배제) */
export function isInteractionRule(value: unknown): value is InteractionRule {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.type === "interaction" &&
    typeof v.id === "string" &&
    typeof v.elementId === "string" &&
    typeof v.trigger === "string" &&
    typeof v.action === "object" &&
    v.action !== null
  );
}
