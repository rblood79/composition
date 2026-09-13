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
  createRuntimeState,
  type CompositionDocument,
  type RuntimeStateHandle,
  type VariableDef,
} from "@composition/shared";

interface RuntimeStateValue {
  runtimeState: RuntimeStateHandle;
  /** 값 변경마다 증가 — 구독 컴포넌트가 다시 읽는 신호 */
  revision: number;
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
  const [revision, setRevision] = useState(0);
  useEffect(
    () => runtimeState.subscribe(() => setRevision((r) => r + 1)),
    [runtimeState],
  );
  useEffect(() => {
    runtimeState.setDefinitions({ projectVariables: variables, document });
  }, [runtimeState, variables, document]);
  useEffect(() => {
    runtimeState.enterPage(currentPageId);
  }, [runtimeState, currentPageId]);
  const value = useMemo(
    () => ({ runtimeState, revision }),
    [runtimeState, revision],
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
