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
} from "./constraints";
import type {
  CatalogToastOptions,
  InteractionAction,
  InteractionRule,
} from "./interactionRule.types";
import { resolveRuleValue, type RuleValueEnv } from "./valueRef";

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
  /** toast 큐 추가 (S2 `ToastQueue.<variant>` · `timeout`) */
  showToast: (message: string, options?: CatalogToastOptions) => void;
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
  /** A variable's current value (`!var.<id>` in a rule value); undefined = no such variable. */
  readState?: (request: {
    variableId: string;
    instanceKeyFor?: (ownerElementId: string) => string;
  }) => { value: unknown } | undefined;
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
  /**
   * ADR-281 user decision 3, second step — append a record to a collection (`useListData.append` —
   * the session holds it).
   * Absent = the rule fails (never a silent no-op).
   */
  append?: (
    collectionId: string,
    value: Readonly<Record<string, unknown>>,
    /** `useTreeData.append(parentKey, …)` — under this parent item (absent = the top level). */
    parentKey?: string,
  ) => { ok: boolean; reason?: string };
  /**
   * `useListData.update(key, newValue)` — absent `key` = the value's `id`. With `fieldId` the value
   * is that one field's (`{...getItem(key), [field]: value}`).
   */
  update?: (
    collectionId: string,
    key: string | undefined,
    value: Readonly<Record<string, unknown>>,
    fieldId?: string,
  ) => { ok: boolean; reason?: string };
  /**
   * `useAsyncList.reload()` — run the collection's query endpoint again. Returns whether it
   * started; its failure is the caller's to report (it settles later). Absent = the rule fails.
   */
  reload?: (collectionId: string) => { ok: boolean; reason?: string };
  /** `useAsyncList.loadMore()` · `setFilterText(text)` — started (settle later) or refused. */
  loadMore?: (collectionId: string) => { ok: boolean; reason?: string };
  setFilterText?: (
    collectionId: string,
    filterText: string,
  ) => { ok: boolean; reason?: string };
  /**
   * `useListData.insert*` · `prepend` — the item at an index, next to a key, or first. An unknown
   * key is the session's to report.
   */
  insert?: (
    collectionId: string,
    position: CatalogListPosition,
    value: Readonly<Record<string, unknown>>,
    /** `useTreeData` — under this parent item (absent = the top level). */
    parentKey?: string,
  ) => { ok: boolean; reason?: string };
  /** `useListData.move(key, toIndex)` · `moveBefore` · `moveAfter` — the items to a position. */
  move?: (
    collectionId: string,
    keys: readonly string[],
    to: Exclude<CatalogListPosition, "start">,
    /** `useTreeData.move(key, toParentKey, index)` — the new parent (absent = the top level). */
    toParentKey?: string,
  ) => { ok: boolean; reason?: string };
  /** The list's selection — the keys selected in the components showing the collection. */
  selectedKeysOf?: (collectionId: string) => readonly string[] | "all";
  /**
   * ADR-284 Phase 6 — the selection after `removeSelectedItems` (`useListData` empties it): the
   * components showing the collection select nothing.
   */
  clearSelectionOf?: (collectionId: string) => void;
  /** `useListData.remove(...keys)` — `"all"` removes every item. */
  remove?: (
    collectionId: string,
    keys: readonly string[] | "all",
  ) => { ok: boolean; reason?: string };
  /**
   * ADR-294 — send a component's event to its instance (the value already read): the receiving
   * rules run; `listeners` is how many (0 = nobody receives it — React's absent callback, a
   * success).
   */
  emit?: (request: {
    propertyKey: string;
    value: unknown;
    elementId: string;
    definitionId: string;
  }) => { ok: boolean; reason?: string; listeners?: number };
}

/** 트리거 요소의 렌더 문맥 — `createElementHandlers` 가 규칙 실행에 실어 보낸다 */
export interface DispatchContext {
  instanceKeyFor?: (ownerElementId: string) => string;
  /**
   * ADR-280 Decision 6 — the RAC callback's arguments of the event that ran the rule, by name
   * (`!event.<name>` in a capability's value).
   */
  event?: Readonly<Record<string, unknown>>;
  /** The owner's bound items the keys name (`!item.<arg>` — `useListData.getItem`). */
  itemsOf?: RuleValueEnv["itemsOf"];
  /** The owner's `selectionMode` is `single` (`!item.keys` is one item). */
  singleSelection?: boolean;
}

/**
 * A rule value as the run reads it (`valueRef.ts` — `!event` · `!item` · `!var` references, else
 * the literal): every value slot (Set state · capability · body · list data) reads it so.
 */
function resolveEventValue(
  value: unknown,
  context: DispatchContext | undefined,
  deps?: Pick<DispatchDeps, "readState">,
): { ok: true; value: unknown } | { ok: false; reason: string } {
  return resolveRuleValue(value, {
    ...(context?.event ? { event: context.event } : {}),
    ...(context?.itemsOf ? { itemsOf: context.itemsOf } : {}),
    singleSelection: context?.singleSelection ?? false,
    ...(deps?.readState
      ? {
          readVariable: (variableId: string) =>
            deps.readState!({
              variableId,
              instanceKeyFor: context?.instanceKeyFor,
            }),
        }
      : {}),
  });
}

const isRecordValue = (value: unknown): value is Readonly<Record<string, unknown>> =>
  !!value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Set);

/** A key value (`!event.key` · a literal) as the string the bound items are keyed by. */
const keyOf = (value: unknown): string | undefined =>
  typeof value === "string" || typeof value === "number"
    ? String(value)
    : undefined;

/**
 * ADR-281 user decision 3, second step — `useListData`'s `append` · `update` · `remove` on a
 * collection (the session holds the result).
 */
function dispatchListData(
  action: Extract<
    InteractionAction,
    { kind: "append" | "update" | "remove" }
  >,
  deps: DispatchDeps,
  context: DispatchContext | undefined,
): DispatchOutcome {
  const run = deps[action.kind];
  if (!run)
    return {
      ok: false,
      reason: `${action.kind} 실행 경로 없음 (${action.kind} 미주입)`,
    };
  let result: { ok: boolean; reason?: string };
  if (action.kind === "remove") {
    const keys = resolveEventValue(action.keys, context, deps);
    if (!keys.ok) return keys;
    const list =
      keys.value === "all"
        ? ("all" as const)
        : keys.value instanceof Set || Array.isArray(keys.value)
          ? [...keys.value].map(keyOf).filter((key) => key !== undefined)
          : [keyOf(keys.value)].filter((key) => key !== undefined);
    result = deps.remove!(action.collectionId, list);
  } else {
    const value = resolveEventValue(action.value, context, deps);
    if (!value.ok) return value;
    if (action.kind === "update" && action.field)
      return dispatchFieldUpdate(action, value.value, deps, context);
    if (!isRecordValue(value.value))
      return { ok: false, reason: `${action.kind} 할 값이 record 가 아니다` };
    if (action.kind === "append") {
      const parent = optionalKey(action.parentKey, context);
      if (!parent.ok) return parent;
      result = deps.append!(action.collectionId, value.value, parent.key);
    }
    else {
      const key = resolveEventValue(action.key, context, deps);
      if (!key.ok) return key;
      if (key.value !== undefined && keyOf(key.value) === undefined)
        return { ok: false, reason: "수정할 항목의 key 가 scalar 가 아니다" };
      result = deps.update!(action.collectionId, keyOf(key.value), value.value);
    }
  }
  return result.ok
    ? { ok: true, kind: action.kind }
    : { ok: false, reason: result.reason ?? `${action.kind} 실패` };
}

/** Keys a value names: a set · list (each) or one scalar; non-scalar members dropped. */
const keysIn = (value: unknown): string[] =>
  (value instanceof Set || Array.isArray(value) ? [...value] : [value])
    .map(keyOf)
    .filter((key): key is string => key !== undefined);

/**
 * ADR-284 Phase 5 — `update` of one field (`field`): every key the rule names takes the value at
 * that field (the kanban's `for (let id of ids) list.update(id, {...list.getItem(id), status})`).
 * The first failing key stops the rest.
 */
function dispatchFieldUpdate(
  action: Extract<InteractionAction, { kind: "update" }>,
  value: unknown,
  deps: DispatchDeps,
  context: DispatchContext | undefined,
): DispatchOutcome {
  if (value !== null && typeof value === "object")
    return { ok: false, reason: "필드에 쓸 값이 scalar 가 아니다" };
  const key = resolveEventValue(action.key, context, deps);
  if (!key.ok) return key;
  const keys = keysIn(key.value);
  if (!keys.length) return { ok: false, reason: "수정할 항목의 key 가 없다" };
  for (const item of keys) {
    const result = deps.update!(
      action.collectionId,
      item,
      { [action.field!]: value },
      action.field,
    );
    if (!result.ok) return { ok: false, reason: result.reason ?? "update 실패" };
  }
  return { ok: true, kind: "update" };
}

/** Where `useListData` puts an item: an index, next to a key, or first (`prepend`). */
export type CatalogListPosition =
  | { index: number }
  | { before: string }
  | { after: string }
  | "start";

/** `useListData`'s positions (insert · move by index or key) and `removeSelectedItems`. */
function dispatchListPosition(
  action: Extract<
    InteractionAction,
    { kind: "insert" | "insertBefore" | "insertAfter" | "prepend" | "move" | "moveBefore" | "moveAfter" | "removeSelectedItems" }
  >,
  deps: DispatchDeps,
  context: DispatchContext | undefined,
): DispatchOutcome {
  const done = (result: { ok: boolean; reason?: string }): DispatchOutcome =>
    result.ok
      ? { ok: true, kind: action.kind }
      : { ok: false, reason: result.reason ?? `${action.kind} 실패` };
  const scalarKey = (raw: unknown, what: string) => {
    const value = resolveEventValue(raw, context, deps);
    if (!value.ok) return value;
    const key = keyOf(value.value);
    return key === undefined
      ? ({ ok: false, reason: `${what} 가 없다` } as const)
      : ({ ok: true, key } as const);
  };
  const index = (raw: unknown) => {
    const value = resolveEventValue(raw, context, deps);
    if (!value.ok) return value;
    const number = Number(value.value);
    return Number.isInteger(number) && number >= 0
      ? ({ ok: true, index: number } as const)
      : ({ ok: false, reason: "위치가 0 이상의 정수가 아니다" } as const);
  };
  if (action.kind === "removeSelectedItems") {
    if (!deps.selectedKeysOf || !deps.remove)
      return { ok: false, reason: "removeSelectedItems 실행 경로 없음" };
    const keys = deps.selectedKeysOf(action.collectionId);
    if (keys !== "all" && !keys.length)
      return { ok: false, reason: "선택한 항목이 없다" };
    const removed = done(deps.remove(action.collectionId, keys));
    if (removed.ok) deps.clearSelectionOf?.(action.collectionId);
    return removed;
  }
  if (action.kind === "move" || action.kind === "moveBefore" || action.kind === "moveAfter") {
    if (!deps.move) return { ok: false, reason: "move 실행 경로 없음 (move 미주입)" };
    if (action.kind === "move") {
      const key = scalarKey(action.key, "옮길 항목의 key");
      if (!key.ok) return key;
      const to = index(action.toIndex);
      if (!to.ok) return to;
      const parent = optionalKey(action.toParentKey, context);
      if (!parent.ok) return parent;
      return done(
        deps.move(action.collectionId, [key.key], { index: to.index }, parent.key),
      );
    }
    const target = scalarKey(action.key, "기준 항목의 key");
    if (!target.ok) return target;
    const moved = resolveEventValue(action.keys, context, deps);
    if (!moved.ok) return moved;
    const keys = keysIn(moved.value);
    if (!keys.length) return { ok: false, reason: "옮길 항목의 key 가 없다" };
    // ADR-284 Phase 5 — the drop's side picks the method (`dropPosition === 'before'` → moveBefore).
    let before = action.kind === "moveBefore";
    if (action.dropPosition !== undefined) {
      const side = resolveEventValue(action.dropPosition, context, deps);
      if (!side.ok) return side;
      if (side.value !== "before" && side.value !== "after")
        return { ok: false, reason: `놓은 쪽이 before · after 가 아니다: ${String(side.value)}` };
      before = side.value === "before";
    }
    return done(
      deps.move(
        action.collectionId,
        keys,
        before ? { before: target.key } : { after: target.key },
      ),
    );
  }
  if (!deps.insert) return { ok: false, reason: "insert 실행 경로 없음 (insert 미주입)" };
  const value = resolveEventValue(action.value, context, deps);
  if (!value.ok) return value;
  if (!isRecordValue(value.value))
    return { ok: false, reason: `${action.kind} 할 값이 record 가 아니다` };
  let position: CatalogListPosition = "start";
  if (action.kind === "insert") {
    const at = index(action.index);
    if (!at.ok) return at;
    position = { index: at.index };
  } else if (action.kind !== "prepend") {
    const key = scalarKey(action.key, "기준 항목의 key");
    if (!key.ok) return key;
    position = action.kind === "insertBefore" ? { before: key.key } : { after: key.key };
  }
  const parent = optionalKey(action.parentKey, context);
  if (!parent.ok) return parent;
  return done(deps.insert(action.collectionId, position, value.value, parent.key));
}

/** `useTreeData`'s optional parent key (`!event.<arg>` · a literal): none / empty = the top level. */
function optionalKey(
  raw: unknown,
  context: DispatchContext | undefined,
): { ok: true; key?: string } | { ok: false; reason: string } {
  if (raw === undefined || raw === "") return { ok: true };
  const value = resolveEventValue(raw, context);
  if (!value.ok) return value;
  if (value.value === undefined || value.value === null || value.value === "")
    return { ok: true };
  const key = keyOf(value.value);
  return key === undefined
    ? { ok: false, reason: "부모 항목의 key 가 scalar 가 아니다" }
    : { ok: true, key };
}

/** 실행 결과 — 실패를 삼키지 않고 호출부(및 테스트)가 볼 수 있게 돌려준다. */
export type DispatchOutcome =
  | {
      ok: true;
      kind:
        | "navigate"
        | "toast"
        | "capability"
        | "setState"
        | "callEndpoint"
        | "append"
        | "update"
        | "remove"
        | "reload"
        | "loadMore"
        | "setFilterText"
        | "insert"
        | "insertBefore"
        | "insertAfter"
        | "prepend"
        | "move"
        | "moveBefore"
        | "moveAfter"
        | "removeSelectedItems"
        | "emit";
      /** ADR-294 — `emit`: how many rules received it (0 = none — still a success). */
      listeners?: number;
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
  /** A rule value's reference (`!event` · `!item` · `!var`) as the run reads it. */
  resolveRef: (value: unknown) => { ok: true; value: unknown } | { ok: false; reason: string },
): { ok: true; value: unknown } | { ok: false; reason: string } {
  if (def.value === "!param") {
    if (paramValue === undefined) {
      return {
        ok: false,
        reason: "capability 가 값을 요구하나 params 가 없다",
      };
    }
    // (A RAC Selection — `"all"` or a Set — goes on as an array, ADR-214's normalization.)
    return resolveRef(paramValue);
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

/**
 * 규칙 하나를 실행한다 — Do 를 순서대로, 실패한 Do 에서 멈추고 그 결과를 돌려준다 (ADR-284
 * Decision 8: 뒤의 Do 는 앞의 Do 가 만든 상태를 전제한다 — kanban 의 `update` 뒤 `moveBefore`).
 */
export function executeInteractionRule(
  rule: InteractionRule,
  deps: DispatchDeps,
  context?: DispatchContext,
): DispatchOutcome {
  let outcome: DispatchOutcome = {
    ok: false,
    reason: "규칙에 Do 가 없다",
  };
  for (const [index, action] of rule.actions.entries()) {
    outcome = executeInteractionAction(action, deps, context);
    if (!outcome.ok)
      return rule.actions.length > 1
        ? { ...outcome, reason: `Do ${index + 1}: ${outcome.reason}` }
        : outcome;
  }
  return outcome;
}

/** Do 하나를 실행한다. */
function executeInteractionAction(
  action: InteractionAction,
  deps: DispatchDeps,
  context?: DispatchContext,
): DispatchOutcome {

  if (action.kind === "setState") {
    if (!action.variableId)
      return { ok: false, reason: "setState 에 variableId 가 없다" };
    if (!deps.writeState)
      return {
        ok: false,
        reason: "setState 실행 경로 없음 (writeState 미주입)",
      };
    // (A Set value · an increment reads its source when the rule runs — `!event` · `!item` · `!var`.)
    const value = resolveEventValue(action.value, context, deps);
    if (!value.ok) return value;
    const result = deps.writeState({
      variableId: action.variableId,
      op: action.op,
      value: value.value,
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
    const body = resolveEventValue(action.body, context, deps);
    if (!body.ok) return body;
    const result = deps.callEndpoint(action.endpointId, body.value);
    return result.ok
      ? { ok: true, kind: "callEndpoint" }
      : { ok: false, reason: result.reason ?? "callEndpoint 실패" };
  }

  if (
    action.kind === "append" ||
    action.kind === "update" ||
    action.kind === "remove"
  )
    return dispatchListData(action, deps, context);

  if (action.kind === "reload") {
    if (!deps.reload)
      return { ok: false, reason: "reload 실행 경로 없음 (reload 미주입)" };
    const result = deps.reload(action.collectionId);
    return result.ok
      ? { ok: true, kind: "reload" }
      : { ok: false, reason: result.reason ?? "reload 실패" };
  }

  if (
    action.kind === "insert" ||
    action.kind === "insertBefore" ||
    action.kind === "insertAfter" ||
    action.kind === "prepend" ||
    action.kind === "move" ||
    action.kind === "moveBefore" ||
    action.kind === "moveAfter" ||
    action.kind === "removeSelectedItems"
  )
    return dispatchListPosition(action, deps, context);

  if (action.kind === "loadMore") {
    if (!deps.loadMore)
      return { ok: false, reason: "loadMore 실행 경로 없음 (loadMore 미주입)" };
    const result = deps.loadMore(action.collectionId);
    return result.ok
      ? { ok: true, kind: "loadMore" }
      : { ok: false, reason: result.reason ?? "loadMore 실패" };
  }

  if (action.kind === "setFilterText") {
    if (!deps.setFilterText)
      return {
        ok: false,
        reason: "setFilterText 실행 경로 없음 (setFilterText 미주입)",
      };
    const value = resolveEventValue(action.value ?? "", context, deps);
    if (!value.ok) return value;
    if (
      value.value !== null &&
      value.value !== undefined &&
      typeof value.value === "object"
    )
      return { ok: false, reason: "setFilterText 값은 글자여야 한다" };
    const result = deps.setFilterText(
      action.collectionId,
      value.value === null || value.value === undefined
        ? ""
        : String(value.value),
    );
    return result.ok
      ? { ok: true, kind: "setFilterText" }
      : { ok: false, reason: result.reason ?? "setFilterText 실패" };
  }

  if (action.kind === "navigate") {
    const path = action.params?.path;
    if (!path) return { ok: false, reason: "navigate 에 path 가 없다" };
    deps.navigate(path);
    return { ok: true, kind: "navigate" };
  }

  if (action.kind === "emit") {
    if (!deps.emit)
      return { ok: false, reason: "emit 실행 경로 없음 (emit 미주입)" };
    // (The value reads in the firing record's context — `!event` · `!item` · `!var`.)
    const value = resolveEventValue(action.value, context, deps);
    if (!value.ok) return value;
    const result = deps.emit({
      propertyKey: action.propertyKey,
      value: value.value,
      elementId: action.elementId,
      definitionId: action.definitionId,
    });
    return result.ok
      ? { ok: true, kind: "emit", listeners: result.listeners ?? 0 }
      : { ok: false, reason: result.reason ?? "emit 실패" };
  }

  if (action.kind === "toast") {
    const message = action.params?.message;
    if (!message) return { ok: false, reason: "toast 에 message 가 없다" };
    const { variant, timeout } = action.params;
    deps.showToast(message, {
      ...(variant ? { variant } : {}),
      ...(timeout ? { timeout } : {}),
    });
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
    (value) => resolveEventValue(value, context, deps),
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
