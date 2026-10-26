/**
 * @fileoverview ADR-158 Phase 1 — `InteractionRule` canonical entry 스키마.
 *
 * interaction entry 형태 (ADR-131 root collection 에서 시작, ADR-248 부터 catalog graph entry).
 * 메커니즘(root collection) 은 유지하고 entry 스키마만 교체한다 — 구
 * `SerializedEvent` + `SerializedAction` chain (actionRef/fallbackActionRef/
 * condition/next DAG) 은 은퇴.
 *
 * 규칙 1개 = 한 줄: `When(RAC callback) → Do(앱 액션 | 대상 capability)` 의 순서 목록.
 * ADR-284 Decision 8 — 다중 Do (`actions[]`, 순서 실행 · 실패 시 중단) 는 kanban drop
 * (`update` + `moveBefore`) 이 실증해 열었다. 조건부 실행 / debounce / throttle / 템플릿은
 * 여전히 스키마에 없다 (ADR-158 §Decision).
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

/** ADR-214 Phase 4 — 상태 쓰기 op 4 (shared runtimeState 의 write 와 같은 어휘) */
export const SET_STATE_OPS = ["set", "toggle", "increment", "reset"] as const;
export type SetStateOp = (typeof SET_STATE_OPS)[number];

/**
 * ADR-214 — 앱 액션 3: 변수 값 쓰기. `variableId` 는 가시성 사슬 (프로젝트 / 이 페이지 / 이
 * 컴포넌트와 조상) 안 `VariableDef.id`. 요소 변수의 스코프 (instanceKey) 는 실행 시점에
 * 트리거 요소의 렌더 문맥이 정한다 — 규칙은 origin id 만 안다 (R3).
 */
export interface SetStateAction {
  kind: "setState";
  variableId: string;
  op: SetStateOp;
  /** set 의 값 · increment 의 증분 (생략 = 1). toggle / reset 은 없음 */
  value?: unknown;
}

/** ADR-281 Decision 5 — send `body` to an API endpoint (the project's endpoint id, no prefix). */
export interface CallEndpointAction {
  kind: "callEndpoint";
  endpointId: string;
  /** A literal or `"!event.<arg>"` (the Form's `"!event.formData"`). */
  body?: unknown;
}

/**
 * ADR-281 user decision 3, second step — append to a collection (`useListData.append` — the project's
 * collection id, no prefix). The running Preview / Publish session holds the item; the author's data is untouched.
 */
export interface AppendAction {
  kind: "append";
  collectionId: string;
  /** `"!event.<arg>"` resolving to a record (the Form's `"!event.formData"`). */
  value?: unknown;
  /** `useTreeData.append(parentKey, …)` — the parent item's key; absent = the top level. */
  parentKey?: unknown;
}

/** `useListData.update(key, newValue)` — absent `key` = the value's `id`. */
export interface UpdateAction {
  kind: "update";
  collectionId: string;
  /** `"!event.key"` or a literal key; keys (`"!event.keys"`) update each item. */
  key?: unknown;
  /** `"!event.<arg>"` resolving to a record (the Form's `"!event.formData"`). */
  value?: unknown;
  /** ADR-284 Phase 5 — the one field (data field id, no prefix) the value writes. */
  field?: string;
}

/** `useListData.remove(...keys)`. */
export interface RemoveAction {
  kind: "remove";
  collectionId: string;
  /** `"!event.key"` · `"!event.keys"` (a selection — a set, or `"all"`) · a literal key. */
  keys?: unknown;
}

/** `useAsyncList.reload()` — the collection's query endpoint runs again. */
export interface ReloadAction {
  kind: "reload";
  collectionId: string;
}

/**
 * `useListData.insert(index, …)` · `insertBefore(key, …)` · `insertAfter(key, …)` · `prepend(…)` —
 * `value` resolves to a record (`"!event.formData"`), `index` · `key` to a scalar.
 */
export type InsertAction = {
  [K in "insert" | "insertBefore" | "insertAfter" | "prepend"]: {
    kind: K;
    collectionId: string;
    index?: unknown;
    key?: unknown;
    value?: unknown;
    /** `useTreeData` — `insert` · `prepend` under this parent item; absent = the top level. */
    parentKey?: unknown;
  };
}["insert" | "insertBefore" | "insertAfter" | "prepend"];

/** `useListData.move(key, toIndex)` · `moveBefore(key, keys)` · `moveAfter(key, keys)`. */
export type MoveAction = {
  [K in "move" | "moveBefore" | "moveAfter"]: {
    kind: K;
    collectionId: string;
    key?: unknown;
    toIndex?: unknown;
    /** `useTreeData.move(key, toParentKey, index)` — the new parent's key; absent = the top. */
    toParentKey?: unknown;
    /** The items moved next to `key` (`"!event.keys"` · a literal key). */
    keys?: unknown;
    /** ADR-284 Phase 5 — `moveBefore` · `moveAfter` by the drop's side (`"!event.target.dropPosition"`). */
    dropPosition?: unknown;
  };
}["move" | "moveBefore" | "moveAfter"];

/** `useListData.removeSelectedItems()` — the selection of the components showing the list. */
export interface RemoveSelectedItemsAction {
  kind: "removeSelectedItems";
  collectionId: string;
}

/** `useAsyncList.loadMore()` — the next page. */
export interface LoadMoreAction {
  kind: "loadMore";
  collectionId: string;
}

/** `useAsyncList.setFilterText(text)` — `"!event.value"` · a literal text. */
export interface SetFilterTextAction {
  kind: "setFilterText";
  collectionId: string;
  value?: unknown;
}

export type InteractionAction =
  | NavigateAction
  | ToastAction
  | CapabilityAction
  | SetStateAction
  | CallEndpointAction
  | AppendAction
  | UpdateAction
  | RemoveAction
  | ReloadAction
  | LoadMoreAction
  | SetFilterTextAction
  | InsertAction
  | MoveAction
  | RemoveSelectedItemsAction;

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
  /** 수행할 동작 — 순서대로, 앞의 것이 실패하면 멈춘다 (ADR-284) */
  actions: readonly InteractionAction[];
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
    Array.isArray(v.actions) &&
    v.actions.length > 0 &&
    v.actions.every((action) => typeof action === "object" && action !== null)
  );
}
