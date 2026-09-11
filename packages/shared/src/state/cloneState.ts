/**
 * ADR-214 Phase 1 — 복제 범위의 상태 재매핑 (HC2 · R9).
 *
 * 복제 · 붙여넣기 · 복사는 canonical clone 을 먼저 하고, **같은 pass** 에서
 * (1) 복제된 노드의 `state[].id` 를 새로 발급하고 (2) 같은 복제 범위에 실린
 * `setState.variableId` 참조를 새 id 로 바꾼 뒤, 그 결과를 legacy view 로 투영한다.
 * legacy copy fallback (Element 형상에서 state 를 따로 복사하는 두 번째 경로) 은 두지 않는다.
 *
 * 이 모듈은 노드 형상에 무관하다 — `{ state?: VariableDef[] }` 를 가진 것이면
 * canonical `CanonicalNode` 든 legacy `Element` mirror 든 같은 함수를 지난다.
 * `SetStateAction` 타입 자체는 Phase 4 가 `InteractionAction` union 에 더한다 — 여기서는
 * `{ kind: "setState", variableId: string }` 구조만 본다 (rule 복제 경로가 Phase 4 에서
 * 열릴 때 같은 지점을 지나도록 rule 배열을 입력으로 받는다).
 */
import { isVariableDef, type VariableDef } from "./variable.types";

export interface StateBearing {
  state?: VariableDef[];
}

export type VariableIdMap = ReadonlyMap<string, string>;

function defaultGenerateId(): string {
  return crypto.randomUUID();
}

/**
 * `state` 를 가진 항목마다 VariableDef id 를 새로 발급한다. state 가 없는 항목은 같은 참조로
 * 돌려준다. VariableDef 가 아닌 원소는 버리고, 빈 배열이 되면 필드를 제거한다 (canonical 규약 —
 * 빈 배열 대신 필드 생략).
 */
export function reissueVariableDefIds<T extends StateBearing>(
  items: readonly T[],
  generateId: () => string = defaultGenerateId,
): { nodes: T[]; idMap: Map<string, string> } {
  const idMap = new Map<string, string>();
  const nodes = items.map((item) => {
    if (!Array.isArray(item.state)) return item;
    const next: VariableDef[] = [];
    for (const def of item.state) {
      if (!isVariableDef(def)) continue;
      const fresh = generateId();
      idMap.set(def.id, fresh);
      next.push({ ...def, id: fresh });
    }
    if (next.length === 0) {
      const { state: _omit, ...rest } = item;
      return rest as T;
    }
    return { ...item, state: next };
  });
  return { nodes, idMap };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSetStateRef(value: Record<string, unknown>): value is Record<
  string,
  unknown
> & {
  kind: "setState";
  variableId: string;
} {
  return value.kind === "setState" && typeof value.variableId === "string";
}

/**
 * 값 안의 `{ kind: "setState", variableId }` 를 찾아 `idMap` 으로 바꾼다. 맵에 없는 id 는
 * 그대로 (복제 범위 밖 변수 — 예: 프로젝트 변수 — 를 가리키는 참조는 유지). 바뀐 것이 없으면
 * 같은 참조를 돌려준다 (structural sharing).
 */
export function rewriteVariableRefs<T>(value: T, idMap: VariableIdMap): T {
  if (idMap.size === 0) return value;
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((item) => {
      const next = rewriteVariableRefs(item, idMap);
      if (next !== item) changed = true;
      return next;
    });
    return (changed ? out : value) as T;
  }
  if (!isRecord(value)) return value;

  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    const next = rewriteVariableRefs(entry, idMap);
    if (next !== entry) changed = true;
    out[key] = next;
  }
  if (isSetStateRef(value)) {
    const mapped = idMap.get(value.variableId);
    if (mapped !== undefined && mapped !== value.variableId) {
      out.variableId = mapped;
      changed = true;
    }
  }
  return (changed ? out : value) as T;
}

export interface RemapClonedStateInput<N extends StateBearing, R> {
  nodes: readonly N[];
  /** 같은 복제 범위의 interaction rule (또는 액션을 품은 어떤 값) — 없으면 빈 배열 */
  rules?: readonly R[];
  generateId?: () => string;
}

export interface RemapClonedStateResult<N, R> {
  nodes: readonly N[];
  rules: readonly R[];
  idMap: Map<string, string>;
}

/** 한 pass: 노드 state id 재발급 → 같은 범위 rule 의 setState 참조 rewrite */
export function remapClonedState<N extends StateBearing, R>(
  input: RemapClonedStateInput<N, R>,
): RemapClonedStateResult<N, R> {
  const rules = input.rules ?? [];
  const hasState = input.nodes.some(
    (node) => Array.isArray(node.state) && node.state.length > 0,
  );
  if (!hasState) return { nodes: input.nodes, rules, idMap: new Map() };

  const { nodes, idMap } = reissueVariableDefIds(input.nodes, input.generateId);
  return { nodes, rules: rewriteVariableRefs(rules, idMap), idMap };
}
