/**
 * Event and Action Types — **legacy read shape 전용**
 *
 * ADR-158 Phase 4 (2026-08-16) 로 구 이벤트 시스템이 은퇴한 뒤, 이 파일은
 * 구 문서/DB row (`element.events`) 를 **읽기 위한** 형태 선언으로만 남는다.
 * 신규 인터랙션 어휘는 `CAPABILITY_REGISTRY` (`@composition/shared`) 소유.
 *
 * ADR-158 Phase 4 후속 (2026-08-17): `EVENT_REGISTRY` re-export 계열 은퇴 —
 * 마지막 소비자(ItemsManager `event-id` 드롭다운)가 채널 제거로 사라졌다.
 * `event_type` 은 불투명 문자열이다: 구 데이터에는 은퇴한 DOM 별칭
 * (`onClick` 등)이 그대로 저장돼 있어 좁은 union 은 실데이터를 표현하지 못한다.
 */

// 액션별 특화된 값 타입들
export interface NavigateActionValue {
  path: string;
  openInNewTab?: boolean;
  replace?: boolean;
}

export interface ToggleVisibilityActionValue {
  show?: boolean; // undefined면 토글, true/false면 명시적 제어
  duration?: number; // 애니메이션 지속시간 (ms)
  easing?: "ease" | "ease-in" | "ease-out" | "ease-in-out" | "linear";
}

export interface UpdateStateActionValue {
  key: string;
  value: unknown;
  merge?: boolean; // 객체 병합 여부
}

export interface ShowModalActionValue {
  modalId: string;
  data?: unknown;
  backdrop?: boolean;
  closable?: boolean;
}

export interface HideModalActionValue {
  modalId?: string; // undefined면 모든 모달 닫기
}

export interface ScrollToActionValue {
  elementId?: string;
  position?: "top" | "center" | "bottom";
  smooth?: boolean;
  offset?: number;
}

export interface CustomFunctionActionValue {
  code: string;
  params?: Record<string, unknown>;
  async?: boolean;
}

export interface CopyToClipboardActionValue {
  text: string;
  source?: "static" | "element" | "state";
  elementId?: string;
  stateKey?: string;
  fallback?: string;
}

export interface UpdatePropsActionValue {
  elementId: string;
  props: Record<string, unknown>;
  merge?: boolean;
}

export interface TriggerAnimationActionValue {
  elementId: string;
  animation: string;
  duration?: number;
  delay?: number;
  iterations?: number | "infinite";
}

export interface PlaySoundActionValue {
  url: string;
  volume?: number;
  loop?: boolean;
  preload?: boolean;
}

export interface SendAnalyticsActionValue {
  event: string;
  category?: string;
  label?: string;
  value?: number;
  customData?: Record<string, unknown>;
}

// Data Panel Integration Action Values
export interface FetchDataTableActionValue {
  dataTableName: string;
  params?: Record<string, unknown>;
  targetVariable?: string; // 결과를 저장할 변수
}

export interface RefreshDataTableActionValue {
  dataTableName: string;
  forceRefresh?: boolean;
}

export interface ExecuteApiActionValue {
  apiEndpointName: string;
  params?: Record<string, unknown>;
  targetCollection?: string; // 결과를 저장할 DataTable
  targetVariable?: string; // 결과를 저장할 Variable
  onSuccess?: string; // 성공 시 실행할 액션 ID
  onError?: string; // 실패 시 실행할 액션 ID
}

export interface SetVariableActionValue {
  variableName: string;
  value: unknown;
  scope?: "global" | "page" | "component";
}

export interface GetVariableActionValue {
  variableName: string;
  targetVariable?: string; // 가져온 값을 저장할 다른 변수
}

// 모든 액션 값 타입의 유니온
export type ActionValue =
  | NavigateActionValue
  | ToggleVisibilityActionValue
  | UpdateStateActionValue
  | ShowModalActionValue
  | HideModalActionValue
  | ScrollToActionValue
  | CustomFunctionActionValue
  | CopyToClipboardActionValue
  | UpdatePropsActionValue
  | TriggerAnimationActionValue
  | PlaySoundActionValue
  | SendAnalyticsActionValue
  | FetchDataTableActionValue
  | RefreshDataTableActionValue
  | ExecuteApiActionValue
  | SetVariableActionValue
  | GetVariableActionValue;

// 개별 액션 정의
export interface EventAction {
  id: string;
  /**
   * ADR-158 Phase 4 — 구 `ActionType` 47종 union 이 은퇴해 불투명 문자열이다.
   * 본 타입은 구 문서/DB row 를 읽기 위한 legacy shape 로만 남는다.
   */
  type: string;
  target?: string; // 대상 요소 ID
  value?: ActionValue;
  delay?: number; // 지연 시간 (ms)
  condition?: string; // 실행 조건 (JavaScript 표현식)
  enabled?: boolean; // 액션 활성화 여부
  description?: string; // 액션 설명
}

// 요소의 이벤트 정의
export interface ElementEvent {
  id: string;
  /** 구 데이터의 원문 그대로 — 은퇴한 DOM 별칭(onClick 등) 포함 가능 */
  event_type: string;
  actions: EventAction[];
  enabled: boolean;
  description?: string; // 이벤트 설명
  preventDefault?: boolean; // 기본 동작 방지 여부
  stopPropagation?: boolean; // 이벤트 전파 중단 여부
  debounce?: number; // 디바운스 시간 (ms)
  throttle?: number; // 스로틀 시간 (ms)
}

// 이벤트 실행 컨텍스트
export interface EventContext {
  event: Event;
  element: HTMLElement;
  elementId: string;
  pageId: string;
  projectId: string;
  state: Record<string, unknown>;
}

// 이벤트 실행 결과
export interface EventExecutionResult {
  success: boolean;
  actionResults: Array<{
    actionId: string;
    success: boolean;
    error?: string;
    data?: unknown;
  }>;
  totalExecutionTime: number;
}

// 이벤트 템플릿 (재사용 가능한 이벤트 패턴)
export interface EventTemplate {
  id: string;
  name: string;
  description: string;
  category: "navigation" | "interaction" | "animation" | "data" | "custom";
  event_type: string;
  actions: Omit<EventAction, "id">[];
  tags: string[];
  preview?: string; // 미리보기 설명
}

// 이벤트 설정
export interface EventSettings {
  globalDebounce?: number;
  globalThrottle?: number;
  enableAnalytics?: boolean;
  enableDebugMode?: boolean;
  maxExecutionTime?: number;
  errorHandling?: "ignore" | "log" | "stop";
}

// 타입 가드 함수들
export function isNavigateAction(
  action: EventAction,
): action is EventAction & { value: NavigateActionValue } {
  return action.type === "navigate";
}

export function isToggleVisibilityAction(
  action: EventAction,
): action is EventAction & { value: ToggleVisibilityActionValue } {
  return action.type === "toggle_visibility";
}

export function isUpdateStateAction(
  action: EventAction,
): action is EventAction & { value: UpdateStateActionValue } {
  return action.type === "update_state";
}

export function isShowModalAction(
  action: EventAction,
): action is EventAction & { value: ShowModalActionValue } {
  return action.type === "show_modal";
}

export function isCustomFunctionAction(
  action: EventAction,
): action is EventAction & { value: CustomFunctionActionValue } {
  return action.type === "custom_function";
}

// 이벤트 유틸리티 타입들
export type EventHandlerMap = Record<
  string,
  (context: EventContext) => Promise<EventExecutionResult>
>;


// 이벤트 상수들
export const DEFAULT_DEBOUNCE_TIME = 300;
export const DEFAULT_THROTTLE_TIME = 100;
export const MAX_EXECUTION_TIME = 5000;
