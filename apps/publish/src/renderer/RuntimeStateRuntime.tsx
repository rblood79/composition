/**
 * ADR-214 Phase 2 — publish 의 런타임 상태 (shared `createRuntimeState` 를 그대로 감싼다).
 *
 * preview 는 zustand store 안에 같은 handle 을 들고, publish 는 React context 로 든다 —
 * 값 store · 스코프 · persist namespace · 페이지 진입 리셋은 전부 shared 모듈 한 벌이다
 * (정책이 두 벌이면 preview↔publish 동작이 갈린다 — InteractionRuntime 과 같은 이유).
 * 방침상 live 검증은 preview 까지 (ADR-214 Soft Constraint).
 */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  collectPropsStateRefs,
  createRuntimeState,
  resolveStateTemplateProps,
  type CompositionDocument,
  type RuntimeStateHandle,
  type VariableDef,
} from "@composition/shared";

interface RuntimeStateValue {
  runtimeState: RuntimeStateHandle;
  /**
   * 정의 (projectVariables · document) 를 세울 때마다 새 객체 — `createEnv` 가 정의 색인을
   * 잡는 시점이라 그때만 env 를 다시 만든다. 값 변경은 변수별 `subscribeVariable` 이
   * 알리므로 여기 싣지 않는다 (싣으면 쓰기 1회 = 페이지의 모든 ElementRenderer 재렌더).
   */
  definitions: object;
}

const RuntimeStateContext = createContext<RuntimeStateValue | null>(null);

export interface RuntimeStateProviderProps {
  projectId: string;
  variables: readonly VariableDef[];
  document: CompositionDocument | null;
  currentPageId: string | null;
  children: ReactNode;
}

export function RuntimeStateProvider({
  projectId,
  variables,
  document,
  currentPageId,
  children,
}: RuntimeStateProviderProps) {
  const runtimeState = useMemo(
    () => createRuntimeState({ projectId }),
    // 프로젝트가 바뀌면 새 handle (namespace 전환은 switchProject 로도 되지만 게시본은 1 프로젝트)
    [projectId],
  );
  // 정의는 렌더 중 동기로 세운다 — effect 로 미루면 첫 렌더의 env 가 정의 0 으로 만들어지고,
  //   `rebuildDefinitions` 는 값이 안 바뀌면 notify 하지 않아 그 env 가 stale 로 남는다.
  const definitions = useMemo<object>(() => {
    runtimeState.setDefinitions({ projectVariables: variables, document });
    return {};
  }, [runtimeState, variables, document]);
  useEffect(() => {
    runtimeState.enterPage(currentPageId);
  }, [runtimeState, currentPageId]);
  const value = useMemo(
    () => ({ runtimeState, definitions }),
    [runtimeState, definitions],
  );
  return (
    <RuntimeStateContext.Provider value={value}>
      {children}
    </RuntimeStateContext.Provider>
  );
}

/** provider 밖 (테스트 · 단독 렌더) 에서는 null — 소비처는 원문 유지로 degrade 한다 */
export function useRuntimeState(): RuntimeStateValue | null {
  return useContext(RuntimeStateContext);
}

/**
 * Phase 3 — 요소 props 의 `{{ }}` 를 런타임 값으로 해석 (preview `useStateTemplateProps` 와 같은
 * 해석기). 게시본 render model 은 legacy Element 라 instanceKey 는 origin id 규약만 (인스턴스
 * 자손 격리는 preview 까지 live — 방침).
 */
export function useResolvedStateProps<T extends Record<string, unknown>>(
  props: T,
  elementId: string,
  pageId: string | null,
): T {
  const value = useRuntimeState();
  const [tick, setTick] = useState(0);
  const refs = useMemo(() => collectPropsStateRefs(props), [props]);
  const env = useMemo(() => {
    if (!value || refs.length === 0) return null;
    void tick;
    return value.runtimeState.createEnv({ pageId, elementId });
  }, [value, refs, pageId, elementId, tick]);
  useEffect(() => {
    if (!env || !value) return;
    const ids = refs
      .map((name) => env.lookup(name)?.def.id)
      .filter((id): id is string => typeof id === "string");
    const unsubscribe = ids.map((id) =>
      value.runtimeState.subscribeVariable(id, () => setTick((t) => t + 1)),
    );
    return () => {
      for (const fn of unsubscribe) fn();
    };
  }, [env, refs, value]);
  return useMemo(
    () => (env ? resolveStateTemplateProps(props, env) : props),
    [props, env],
  );
}
