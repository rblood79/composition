/**
 * ADR-214 Phase 3 — preview DOM 의 `{{ }}` 해석 (런타임 값 환경).
 *
 * - env 는 shared `runtimeState.createEnv` (가시성 사슬: 요소 → 조상 → 페이지 → 프로젝트).
 * - 요소 변수의 instanceKey: origin 렌더는 `node.id`, ref 인스턴스 안은 `${instanceScope}/${id}`
 *   (instanceScope = 가장 가까운 ref root 의 키 — Phase 0 evidence §3 R3 규약의 DOM leg).
 *   `StateInstanceContext` 가 조상 origin id → instanceKey 맵을 내려 준다. Phase 4 의 setState
 *   dispatcher 도 같은 맵으로 같은 키를 만든다.
 * - 구독은 **의존 인덱스** (`subscribeVariable`) — 이 노드가 참조하는 변수만 (R5). 정의 색인
 *   재구성 (`runtimeDefinitionsRevision`) 은 env 를 다시 만든다.
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  collectPropsStateRefs,
  hasStateTemplateSyntax,
  resolveStateTemplateProps,
  type ResolvedNode,
} from "@composition/shared";
import { useRuntimeStore } from "../store";

export interface StateInstanceScope {
  /** 가장 가까운 ref 인스턴스 root 의 instanceKey (origin 렌더는 null) */
  scope: string | null;
  /** 조상 (자기 포함) origin id → 이 렌더 문맥의 instanceKey */
  ancestorKeys: ReadonlyMap<string, string>;
}

export const EMPTY_STATE_INSTANCE_SCOPE: StateInstanceScope = {
  scope: null,
  ancestorKeys: new Map(),
};

export const StateInstanceContext = createContext<StateInstanceScope>(
  EMPTY_STATE_INSTANCE_SCOPE,
);

function isPageNode(node: ResolvedNode): boolean {
  const type = (node.metadata as { type?: unknown } | undefined)?.type;
  return type === "page" || type === "legacy-page";
}

/** 이 노드가 자식에게 내려 줄 scope — ref root (페이지 제외) 면 자기 키가 새 scope */
export function useChildStateInstanceScope(node: ResolvedNode): StateInstanceScope {
  const parent = useContext(StateInstanceContext);
  return useMemo(() => {
    const ownKey = parent.scope ? `${parent.scope}/${node.id}` : node.id;
    const ancestorKeys = new Map(parent.ancestorKeys);
    ancestorKeys.set(node.id, ownKey);
    const isInstanceRoot = Boolean(node._resolvedFrom) && !isPageNode(node);
    // ref root: 가시성 사슬은 canonical 문서 (master id) 로 소유자를 말하므로 master id 도 같은
    // 키로 잇는다 — 인스턴스 A/B 가 master 의 요소 변수를 각자 격리해 읽는다 (R3).
    if (isInstanceRoot && node._resolvedFrom)
      ancestorKeys.set(node._resolvedFrom, ownKey);
    return { scope: isInstanceRoot ? ownKey : parent.scope, ancestorKeys };
  }, [parent, node]);
}

/**
 * canonical props 의 `{{ }}` 를 런타임 값으로 해석한다. 참조가 없으면 같은 참조 (빠른 경로).
 * `scope` 는 자기 자신을 포함한 맵 (`useChildStateInstanceScope` 결과).
 */
export function useStateTemplateProps<T extends Record<string, unknown>>(
  props: T,
  node: ResolvedNode,
  scope: StateInstanceScope,
): T {
  const runtimeState = useRuntimeStore((s) => s.runtimeState);
  const currentPageId = useRuntimeStore((s) => s.currentPageId);
  const definitionsRevision = useRuntimeStore(
    (s) => s.runtimeDefinitionsRevision,
  );
  // 자기 props + 직계 자식 props 의 참조 — collection 소유자 (ListBox 등) 는 행 템플릿이
  //   자식 (template anchor) 에 있어 그 변수 변경에도 다시 렌더해야 한다 (renderContext.resolveStateText 경로).
  const refs = useMemo(() => {
    const own = collectPropsStateRefs(props);
    const seen = new Set(own);
    for (const child of node.children ?? []) {
      for (const name of collectPropsStateRefs(
        child.props as Record<string, unknown> | undefined,
      )) {
        if (!seen.has(name)) {
          seen.add(name);
          own.push(name);
        }
      }
    }
    return own;
  }, [props, node]);
  const needsResolve = useMemo(
    () => refs.length > 0 || hasStateTemplateSyntax(props),
    [refs, props],
  );
  const [tick, setTick] = useState(0);
  const env = useMemo(() => {
    if (!needsResolve) return null;
    void definitionsRevision;
    void tick;
    return runtimeState.createEnv({
      pageId: currentPageId,
      elementId: node.id,
      instanceKeyFor: (ownerId) => scope.ancestorKeys.get(ownerId) ?? ownerId,
    });
  }, [needsResolve, runtimeState, currentPageId, node.id, scope, definitionsRevision, tick]);
  useEffect(() => {
    if (!env) return;
    const ids = refs
      .map((name) => env.lookup(name)?.def.id)
      .filter((id): id is string => typeof id === "string");
    const unsubscribe = ids.map((id) =>
      runtimeState.subscribeVariable(id, () => setTick((t) => t + 1)),
    );
    return () => {
      for (const fn of unsubscribe) fn();
    };
  }, [env, refs, runtimeState]);
  return useMemo(
    () => (env ? resolveStateTemplateProps(props, env) : props),
    [props, env],
  );
}
