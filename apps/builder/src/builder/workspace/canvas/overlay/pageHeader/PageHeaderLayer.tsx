/**
 * ADR-221 — 페이지 헤더 DOM 층.
 *
 * `.canvas-container` 안, Skia 캔버스 위에 페이지마다 헤더 노드 하나. DOM 순서 =
 * `orderPagesForPaint` (활성 페이지 마지막) = 헤더끼리의 z-order. 위 페이지 body 와의 가림은
 * 배치 훅의 clip-path 가 맡는다 (clip 밖은 히트도 안 받는다). 배치는 React state 가 아니라
 * 훅이 transform 으로 쓴다 — 이 컴포넌트는 `style` prop 을 렌더하지 않아 재렌더가 훅의
 * 인라인 스타일을 되돌리지 않는다.
 *
 * 히트 (Decision 4): 층 루트에 **native** pointerdown/dblclick 리스너를 위임한다 — 컨테이너의
 * bubble 리스너 (pan · 중앙 핸들러) 보다 먼저 돌아야 `__handled` 계약이 성립한다 (React
 * 합성 핸들러는 root 에서 돌아 너무 늦다). 컨테이너 capture 가드는 `[data-page-header]`
 * 자손이면 Skia 선판정만 건너뛴다.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../../../../stores";
import { orderPagesForPaint } from "../../scene/pagePaintOrder";
import type { PageHeaderFrame } from "./pageHeaderGeometry";
import { usePageHeaderPlacement } from "./usePageHeaderPlacement";
import "./PageHeaderLayer.css";

export const PAGE_HEADER_ATTR = "data-page-header";

/** 이벤트 target 이 페이지 헤더 (또는 그 안 편집기) 인가 — 컨테이너 capture 가드용. */
export function isPageHeaderEventTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest(`[${PAGE_HEADER_ATTR}]`) !== null;
}

function headerIdFromTarget(target: EventTarget | null): string | null {
  if (!(target instanceof Element)) return null;
  const header = target.closest<HTMLElement>(`[${PAGE_HEADER_ATTR}]`);
  return header?.dataset.pageId ?? null;
}

function isEditorTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("input") !== null;
}

export interface PageHeaderLayerProps {
  /** 뷰포트 안 페이지 프레임 (scene 좌표) — Skia 와 같은 소스 (`visiblePageFrames`). */
  frames: readonly PageHeaderFrame[];
  /**
   * 헤더 pointerdown (button 0 · 편집기 밖). drag 시작 / shift 토글 판정은 호출자 (BuilderCanvas)
   * 가 하고, 소비했으면 `event.__handled` 를 세운다. 스페이스 pan 양보도 호출자 판단.
   */
  onHeaderPointerDown?: (pageId: string, event: PointerEvent) => void;
  /** 이름 편집 가능 여부 (components 미러 · 프레임 편집 모드 제외). */
  canRenamePage?: (pageId: string) => boolean;
  /** 편집기 열림 직전 (페이지 전환). */
  onBeginRename?: (pageId: string) => void;
  onRenamePage?: (pageId: string, title: string) => void;
}

export function PageHeaderLayer({
  frames,
  onHeaderPointerDown,
  canRenamePage,
  onBeginRename,
  onRenamePage,
}: PageHeaderLayerProps) {
  const currentPageId = useStore((state) => state.currentPageId);
  const hasSelection = useStore((state) => state.selectedElementIds.length > 0);
  const [layerNode, setLayerNode] = useState<HTMLDivElement | null>(null);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const renameCancelRef = useRef(false);

  const ordered = useMemo(
    () =>
      orderPagesForPaint(
        frames.filter((frame) => Boolean(frame.title)),
        currentPageId,
      ),
    [frames, currentPageId],
  );

  usePageHeaderPlacement({ layerNode, frames: ordered });

  // 편집 중이던 페이지가 목록에서 빠지면 (삭제 · 뷰포트 밖) 편집기를 닫는다.
  useEffect(() => {
    if (editingPageId && !ordered.some((frame) => frame.id === editingPageId)) {
      setEditingPageId(null);
    }
  }, [editingPageId, ordered]);

  const handlersRef = useRef({
    onHeaderPointerDown,
    canRenamePage,
    onBeginRename,
  });
  handlersRef.current = { onHeaderPointerDown, canRenamePage, onBeginRename };

  useEffect(() => {
    if (!layerNode) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (event.button !== 0 || isEditorTarget(event.target)) return;
      const pageId = headerIdFromTarget(event.target);
      if (!pageId) return;
      handlersRef.current.onHeaderPointerDown?.(pageId, event);
    };
    const onDoubleClick = (event: MouseEvent): void => {
      if (event.button !== 0 || isEditorTarget(event.target)) return;
      const pageId = headerIdFromTarget(event.target);
      if (!pageId) return;
      const { canRenamePage, onBeginRename } = handlersRef.current;
      if (canRenamePage && !canRenamePage(pageId)) return;
      event.preventDefault();
      event.stopPropagation();
      onBeginRename?.(pageId);
      renameCancelRef.current = false;
      setEditingPageId(pageId);
    };
    layerNode.addEventListener("pointerdown", onPointerDown);
    layerNode.addEventListener("dblclick", onDoubleClick);
    return () => {
      layerNode.removeEventListener("pointerdown", onPointerDown);
      layerNode.removeEventListener("dblclick", onDoubleClick);
    };
  }, [layerNode]);

  return (
    <div
      ref={setLayerNode}
      className="page-header-layer"
      data-page-header-layer=""
    >
      {ordered.map((frame) => {
        const active = frame.id === currentPageId;
        const editing = frame.id === editingPageId;
        return (
          <div
            key={frame.id}
            className="page-header"
            data-page-header=""
            data-page-id={frame.id}
            data-active={active || undefined}
            data-highlighted={(active && hasSelection) || undefined}
            data-editing={editing || undefined}
          >
            {editing ? (
              <input
                className="page-title-edit-input"
                data-text-editing="true"
                aria-label={`Rename page ${frame.title}`}
                defaultValue={frame.title}
                autoFocus
                onFocus={(event) => event.currentTarget.select()}
                onBlur={(event) => {
                  const value = event.currentTarget.value;
                  setEditingPageId(null);
                  if (renameCancelRef.current) {
                    renameCancelRef.current = false;
                    return;
                  }
                  onRenamePage?.(frame.id, value);
                }}
                onKeyDown={(event) => {
                  event.stopPropagation();
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    renameCancelRef.current = true;
                    event.currentTarget.blur();
                  }
                }}
              />
            ) : (
              <span className="page-header__title">{frame.title}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default PageHeaderLayer;
