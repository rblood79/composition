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
import { Play, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { iconProps } from "../../../../../utils/ui/uiConstants";
import { ActionIconButton } from "../../../../components/ui/ActionIconButton";
import { useStore } from "../../../../stores";
import { orderPagesForPaint } from "../../scene/pagePaintOrder";
import type { PageHeaderFrame } from "./pageHeaderGeometry";
import { usePageHeaderPlacement } from "./usePageHeaderPlacement";
import "./PageHeaderLayer.css";

export const PAGE_HEADER_ATTR = "data-page-header";

/** 헤더 우측 액션 슬롯 (패널 header-action 과 같은 `action-icon-button` 어법). */
const PAGE_HEADER_ACTION_CLASS = "page-header__action";

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

/**
 * 액션 버튼 위 이벤트인가 — 편집기와 같은 이유로 헤더 제스처에서 제외한다. 리스너는 층
 * 루트에 걸려 있어 버튼 자손의 pointerdown 도 헤더로 올라오는데, 그대로 두면 버튼을 누를
 * 때마다 페이지 선택·드래그가 시작된다.
 */
function isHeaderActionTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(`.${PAGE_HEADER_ACTION_CLASS}`) !== null
  );
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
      if (isHeaderActionTarget(event.target)) return;
      const pageId = headerIdFromTarget(event.target);
      if (!pageId) return;
      handlersRef.current.onHeaderPointerDown?.(pageId, event);
    };
    const onDoubleClick = (event: MouseEvent): void => {
      if (event.button !== 0 || isEditorTarget(event.target)) return;
      if (isHeaderActionTarget(event.target)) return;
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
              <>
                {/* 타이틀 앞 액션 — 뒤의 close 와 같은 어법·같은 20 상자.
                    동작은 보류 — onPress 는 의미가 확정되면 배선한다. */}
                <ActionIconButton
                  aria-label={`Play ${frame.title}`}
                  className={PAGE_HEADER_ACTION_CLASS}
                  tooltip="Play"
                >
                  <Play aria-hidden="true" size={iconProps.size} />
                </ActionIconButton>
                <span className="page-header__title">{frame.title}</span>
                {/* 패널 header-action 과 같은 어법 (ActionIconButton = action-icon-button).
                    크기는 select/combobox 안 트리거와 같은 20 상자 (--text-xl) — 헤더 띠
                    안에 박히는 버튼이라 그 범주를 따른다 (CSS 에서 --icon-control-size 재지정).
                    동작은 보류 — onPress 는 close 의미가 확정되면 배선한다. */}
                <ActionIconButton
                  aria-label={`Close ${frame.title}`}
                  className={PAGE_HEADER_ACTION_CLASS}
                  tooltip="Close"
                >
                  <X aria-hidden="true" size={iconProps.size} />
                </ActionIconButton>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default PageHeaderLayer;
