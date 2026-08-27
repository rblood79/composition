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
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Element, Page } from "@composition/shared";
import {
  buildInteractionIndex,
  createElementHandlers,
  EMPTY_INTERACTION_INDEX,
  type DispatchDeps,
  type InteractionIndex,
} from "@composition/shared";
import { useToast } from "@composition/shared/components";

type PropsBag = Record<string, unknown>;

interface InteractionRuntimeValue {
  index: InteractionIndex;
  deps: DispatchDeps;
  interactionOverrides: Record<string, PropsBag>;
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

function normalizeSlug(slug: string): string {
  const trimmed = slug.trim();
  if (trimmed === "" || trimmed === "/") return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function InteractionRuntimeProvider({
  rules,
  elements,
  pages,
  onNavigatePage,
  children,
}: InteractionRuntimeProviderProps) {
  const { addToast } = useToast();
  const [interactionOverrides, setInteractionOverrides] = useState<
    Record<string, PropsBag>
  >({});

  const index = useMemo(
    () =>
      rules.length ? buildInteractionIndex(rules) : EMPTY_INTERACTION_INDEX,
    [rules],
  );

  const elementById = useMemo(
    () => new Map(elements.map((el) => [el.id, el])),
    [elements],
  );
  const pageIdBySlug = useMemo(
    () => new Map(pages.map((p) => [normalizeSlug(p.slug ?? ""), p.id])),
    [pages],
  );

  // deps 는 참조 안정이어야 한다 — 실행마다 바뀌면 소비자 memo 가 전부 깨진다.
  // 최신 상태는 ref 로 그때그때 읽는다 (preview 의 store-경유 읽기와 동형).
  const overridesRef = useRef(interactionOverrides);
  overridesRef.current = interactionOverrides;

  const patchOverride = useCallback((id: string, patch: PropsBag) => {
    if (!id || !patch || Object.keys(patch).length === 0) return;
    setInteractionOverrides((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? {}), ...patch },
    }));
  }, []);

  const deps = useMemo<DispatchDeps>(
    () => ({
      getElement: (id) => {
        const el = elementById.get(id);
        if (!el) return undefined;
        const props = (el.props ?? {}) as PropsBag;
        const override = overridesRef.current[id];
        if (!override) return { type: el.type, props };
        const merged: PropsBag = { ...props, ...override };
        if (override.style && typeof override.style === "object") {
          merged.style = {
            ...((props.style as PropsBag | undefined) ?? {}),
            ...(override.style as PropsBag),
          };
        }
        return { type: el.type, props: merged };
      },
      updateElementProps: patchOverride,
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
        const pageId = pageIdBySlug.get(normalizeSlug(path));
        if (pageId) {
          onNavigatePage(pageId);
          return;
        }
        console.warn(`[Interaction] navigate: 매칭되는 페이지 없음 — ${path}`);
      },
      showToast: (message) => addToast({ title: message }),
    }),
    [elementById, pageIdBySlug, onNavigatePage, patchOverride, addToast],
  );

  const value = useMemo(
    () => ({ index, deps, interactionOverrides }),
    [index, deps, interactionOverrides],
  );

  return (
    <InteractionRuntimeContext.Provider value={value}>
      {children}
    </InteractionRuntimeContext.Provider>
  );
}

const NO_HANDLERS: Record<string, (...args: unknown[]) => void> = {};
const NO_OVERRIDE: PropsBag | undefined = undefined;

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

/** 요소의 실행 override — 렌더 직전 props 에 병합할 patch. */
export function useElementInteractionOverride(
  elementId: string,
): PropsBag | undefined {
  const runtime = useContext(InteractionRuntimeContext);
  return runtime?.interactionOverrides[elementId] ?? NO_OVERRIDE;
}
