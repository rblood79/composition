/**
 * Interaction Runtime — publish 축 (ADR-158 후속, 2026-08-17)
 *
 * 빌더에서 저장한 인터랙션 규칙(canonical `document.events` 의 `InteractionRule[]`)을
 * 게시된 사이트에서 실행한다. 규칙 색인(`buildInteractionIndex`)과 실행
 * (`executeInteractionRule`)은 preview 와 **같은 shared 모듈**을 소비한다 —
 * 정책이 두 벌이 되면 그 순간 preview↔publish 동작 발산이 시작된다.
 *
 * 구 경로와의 관계: 종전 `ElementRenderer` 는 legacy `element.events` 를
 * `ActionExecutor` 로 실행했는데, ADR-158 Phase 1 에서 그 mirror 파생이 끊겨
 * **입력이 영구 empty** — 게시본 인터랙션이 완전 무동작이었다. export 페이로드는
 * `CompositionDocument` 전체를 직렬화하므로 규칙은 이미 게시본에 도착해 있었고,
 * 없던 것은 소비뿐이다.
 *
 * 실행 결과(capability prop patch)는 **override 층**에 쌓는다 (preview 와 동일
 * 설계) — 게시본의 render model 은 읽기 전용 스냅샷이고, 실행은 런타임 동작이지
 * 문서 편집이 아니다. 병합 의미도 preview `patchInteractionOverride` 미러:
 * 요소별 shallow merge (dispatcher 의 `buildPatch` 가 style 을 실행 시점 현재값
 * 기준으로 이미 병합해 보내므로 여기선 shallow 가 정확하다).
 *
 * override 층은 context 값이 아니라 작은 외부 store 다 (2026-09-20 /simplify) —
 * context 에 실으면 patch 1회 = 페이지의 모든 ElementRenderer 재렌더 + 핸들러 전부
 * 재생성이라, preview 의 `useRuntimeStore((s) => s.interactionOverrides[id])` 처럼
 * 요소별로 `useSyncExternalStore` 선택한다.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Element, Page } from "@composition/shared";
import {
  buildInteractionIndex,
  createElementHandlers,
  EMPTY_INTERACTION_INDEX,
  resolvePageIdByPath,
  type DispatchDeps,
  type InteractionIndex,
} from "@composition/shared";
import { useToast } from "@composition/shared/components";
import { useRuntimeState } from "./RuntimeStateRuntime";

type PropsBag = Record<string, unknown>;

/** 요소별 override — shallow merge, style 만 1단 deep merge (preview 와 같은 규칙). */
export function mergeInteractionOverride(
  props: PropsBag,
  override: PropsBag | undefined,
): PropsBag {
  if (!override) return props;
  const merged: PropsBag = { ...props, ...override };
  if (override.style && typeof override.style === "object") {
    merged.style = {
      ...((props.style as PropsBag | undefined) ?? {}),
      ...(override.style as PropsBag),
    };
  }
  return merged;
}

interface OverrideStore {
  get: (elementId: string) => PropsBag | undefined;
  patch: (elementId: string, patch: PropsBag) => void;
  subscribe: (listener: () => void) => () => void;
}

function createOverrideStore(): OverrideStore {
  const overrides = new Map<string, PropsBag>();
  const listeners = new Set<() => void>();
  return {
    get: (elementId) => overrides.get(elementId),
    patch: (elementId, patch) => {
      if (!elementId || !patch || Object.keys(patch).length === 0) return;
      overrides.set(elementId, { ...overrides.get(elementId), ...patch });
      for (const fn of [...listeners]) fn();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

interface InteractionRuntimeValue {
  index: InteractionIndex;
  deps: DispatchDeps;
  overrides: OverrideStore;
}

const InteractionRuntimeContext = createContext<InteractionRuntimeValue | null>(
  null,
);

export interface InteractionRuntimeProviderProps {
  /** canonical `document.events` — 구 `SerializedEvent` 잔존 entry 는 색인이 걸러낸다 */
  rules: readonly unknown[];
  /** 전체 페이지 요소 (규칙 대상이 다른 페이지에 있을 수 있다) */
  elements: Element[];
  pages: Page[];
  /** navigate 규칙의 슬러그가 매칭된 페이지로 전환 */
  onNavigatePage: (pageId: string) => void;
  children: ReactNode;
}

export function InteractionRuntimeProvider({
  rules,
  elements,
  pages,
  onNavigatePage,
  children,
}: InteractionRuntimeProviderProps) {
  const { addToast } = useToast();
  const overrides = useMemo(() => createOverrideStore(), []);

  const index = useMemo(
    () =>
      rules.length ? buildInteractionIndex(rules) : EMPTY_INTERACTION_INDEX,
    [rules],
  );

  const elementById = useMemo(
    () => new Map(elements.map((el) => [el.id, el])),
    [elements],
  );

  // ADR-214 — 런타임 상태 handle (RuntimeStateProvider 가 바깥). handle 은 projectId 당
  //   하나라 deps 에 넣어도 memo 가 안 깨진다.
  const runtimeState = useRuntimeState()?.runtimeState ?? null;

  // deps 는 참조 안정이어야 한다 — 실행마다 바뀌면 소비자 memo 가 전부 깨진다.
  const deps = useMemo<DispatchDeps>(
    () => ({
      getElement: (id) => {
        const el = elementById.get(id);
        if (!el) return undefined;
        return {
          type: el.type,
          props: mergeInteractionOverride(
            (el.props ?? {}) as PropsBag,
            overrides.get(id),
          ),
        };
      },
      updateElementProps: overrides.patch,
      navigate: (path) => {
        // 외부 링크/앵커는 브라우저 기본 의미로 — 게시본은 실제 사이트다.
        if (/^https?:\/\//.test(path)) {
          window.location.assign(path);
          return;
        }
        if (path.startsWith("#")) {
          window.location.hash = path;
          return;
        }
        // navigate path → 페이지: preview `CanvasRouter` 가 라우트로 쓰는 `generatePageUrl` 표
        // (parent_id 계층 · 동적 세그먼트 · trailing slash/대소문자 허용) 와 같은 해석기.
        // 게시 페이로드에는 layout 이 없어 layout slug 규칙 (rule 2) 은 여기서 생략된다.
        const pageId = resolvePageIdByPath(path, pages);
        if (pageId) {
          onNavigatePage(pageId);
          return;
        }
        console.warn(`[Interaction] navigate: 매칭되는 페이지 없음 — ${path}`);
      },
      showToast: (message) => addToast({ title: message }),
      // ADR-214 Phase 4 — 변수 쓰기. 스코프는 shared `write()` 가 소유자에서 유도한다 —
      //   publish 가 덧붙이는 건 element 소유자의 instanceKey 규약 하나뿐.
      writeState: ({ variableId, op, value, instanceKeyFor }) => {
        if (!runtimeState)
          return {
            ok: false,
            reason: "런타임 상태 없음 (RuntimeStateProvider 밖)",
          };
        const owner = runtimeState.getDefinition(variableId)?.owner;
        if (!owner) return { ok: false, reason: `변수 없음: ${variableId}` };
        const scope =
          owner.kind === "element" && instanceKeyFor
            ? {
                kind: "element" as const,
                instanceKey: instanceKeyFor(owner.elementId),
              }
            : undefined;
        const result = runtimeState.write({ variableId, op, value, scope });
        return result.ok
          ? { ok: true }
          : { ok: false, reason: result.reason ?? "setState 실패" };
      },
    }),
    [elementById, pages, onNavigatePage, overrides, addToast, runtimeState],
  );

  const value = useMemo(
    () => ({ index, deps, overrides }),
    [index, deps, overrides],
  );

  return (
    <InteractionRuntimeContext.Provider value={value}>
      {children}
    </InteractionRuntimeContext.Provider>
  );
}

const NO_HANDLERS: Record<string, (...args: unknown[]) => void> = {};
const noopSubscribe = () => () => {};

/** 요소의 트리거 callback map — provider 밖(규칙 없음)에선 빈 객체. */
export function useElementInteractionHandlers(
  elementId: string,
): Record<string, (...args: unknown[]) => void> {
  const runtime = useContext(InteractionRuntimeContext);
  return useMemo(() => {
    if (!runtime) return NO_HANDLERS;
    return createElementHandlers(elementId, runtime.index, runtime.deps);
  }, [runtime, elementId]);
}

/** 요소의 실행 override — 렌더 직전 props 에 병합할 patch. patch 된 요소만 재렌더된다. */
export function useElementInteractionOverride(
  elementId: string,
): PropsBag | undefined {
  const runtime = useContext(InteractionRuntimeContext);
  const getSnapshot = useCallback(
    () => runtime?.overrides.get(elementId),
    [runtime, elementId],
  );
  return useSyncExternalStore(
    runtime?.overrides.subscribe ?? noopSubscribe,
    getSnapshot,
  );
}
