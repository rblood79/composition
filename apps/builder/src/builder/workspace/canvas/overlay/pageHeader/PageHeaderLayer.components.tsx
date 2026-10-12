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

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { iconProps } from "../../../../../utils/ui/uiConstants";

import { ActionIconButton } from "../../../../components/ui/ActionIconButton";

import { orderPagesForPaint } from "../../scene/pagePaintOrder";

import { resolvePageHeaderLod } from "./pageHeaderGeometry";

import "./PageHeaderLayer.css";

import {
  LAYER_STYLE,
  PAGE_HEADER_ACTION_CLASS,
  PageHeaderItemProps,
  PageHeaderLayerProps,
  resolveHeaderHit,
  useSettledHeaderInput,
} from "./PageHeaderLayer.runtime";
import { usePageHeaderPlacement } from "./usePageHeaderPlacement";

export function PageHeaderLayer({
  frames,
  onHeaderPointerDown,
  canRenamePage,
  onBeginRename,
  onRenamePage,
  activePageId,
  hasSelection,
}: PageHeaderLayerProps) {
  const currentPageId = activePageId;
  const [layerNode, setLayerNode] = useState<HTMLDivElement | null>(null);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const settled = useSettledHeaderInput(frames);

  const ordered = useMemo(
    () =>
      orderPagesForPaint(
        settled.frames.filter((frame) => Boolean(frame.title)),
        currentPageId,
      ),
    [settled.frames, currentPageId],
  );

  usePageHeaderPlacement({
    layerNode,
    frames: ordered,
    gestureActive: settled.gestureActive,
  });

  // 편집 중이던 페이지가 목록에서 빠지면 (삭제 · 뷰포트 밖) 편집기를 닫는다.
  if (editingPageId && !ordered.some((frame) => frame.id === editingPageId)) {
    setEditingPageId(null);
  }

  const handlersRef = useRef({
    onHeaderPointerDown,
    canRenamePage,
    onBeginRename,
    onRenamePage,
  });
  useLayoutEffect(() => {
    handlersRef.current = {
      onHeaderPointerDown,
      canRenamePage,
      onBeginRename,
      onRenamePage,
    };
  });

  useEffect(() => {
    if (!layerNode) return;
    const onPointerDown = (event: PointerEvent): void => {
      const pageId = resolveHeaderHit(event);
      if (!pageId) return;
      handlersRef.current.onHeaderPointerDown?.(pageId, event);
    };
    const onDoubleClick = (event: MouseEvent): void => {
      const pageId = resolveHeaderHit(event);
      if (!pageId) return;
      const { canRenamePage, onBeginRename } = handlersRef.current;
      if (canRenamePage && !canRenamePage(pageId)) return;
      event.preventDefault();
      event.stopPropagation();
      onBeginRename?.(pageId);
      setEditingPageId(pageId);
    };
    layerNode.addEventListener("pointerdown", onPointerDown);
    layerNode.addEventListener("dblclick", onDoubleClick);
    return () => {
      layerNode.removeEventListener("pointerdown", onPointerDown);
      layerNode.removeEventListener("dblclick", onDoubleClick);
    };
  }, [layerNode]);

  // 편집기 닫힘 — value 가 null 이면 취소 (Escape).
  const handleRenameCommit = useCallback(
    (pageId: string, value: string | null) => {
      setEditingPageId(null);
      if (value !== null) handlersRef.current.onRenamePage?.(pageId, value);
    },
    [],
  );

  return (
    <div
      ref={setLayerNode}
      className="page-header-layer"
      data-page-header-layer=""
      style={LAYER_STYLE}
    >
      {ordered.map((frame) => {
        const active = frame.id === currentPageId;
        const editing = frame.id === editingPageId;
        return (
          <PageHeaderItem
            key={frame.id}
            id={frame.id}
            title={frame.title ?? ""}
            active={active}
            highlighted={active && hasSelection}
            editing={editing}
            // 티어 입력은 settle 스냅샷 (frames · zoom) 뿐 — 제스처 중 전환 0. 편집 중은
            // 편집기 폭 확보를 위해 항상 full.
            lod={
              editing
                ? "full"
                : resolvePageHeaderLod(frame.width * settled.zoom)
            }
            onRenameCommit={handleRenameCommit}
          />
        );
      })}
    </div>
  );
}

/**
 * 이름 편집기 — Enter · blur 는 저장, Escape 는 취소. 헤더가 목록에서 빠져 (뷰포트 밖) blur 없이
 * 사라져도 입력한 이름은 저장한다 (삭제된 페이지는 onRenamePage 가 무시한다).
 */
function PageTitleInput({
  id,
  title,
  onRenameCommit,
}: Pick<PageHeaderItemProps, "id" | "title" | "onRenameCommit">) {
  const renameCancelRef = useRef(false);
  const draftRef = useRef(title);
  const doneRef = useRef(false);
  const finish = (value: string | null) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onRenameCommit(id, value);
  };
  const finishRef = useRef(finish);
  useLayoutEffect(() => {
    finishRef.current = finish;
  });
  useEffect(() => () => finishRef.current(draftRef.current), []);
  return (
    <input
      className="page-title-edit-input"
      data-text-editing="true"
      aria-label={`Rename page ${title}`}
      defaultValue={title}
      autoFocus
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        draftRef.current = event.currentTarget.value;
      }}
      onBlur={(event) => {
        const cancelled = renameCancelRef.current;
        renameCancelRef.current = false;
        finish(cancelled ? null : event.currentTarget.value);
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
  );
}

/**
 * 헤더 하나 — props 가 원시값뿐이라 `frames` 배열 identity 가 바뀌어도 (스냅샷 재구축마다)
 * RAC 버튼 서브트리는 재조정되지 않는다. 배치는 훅이 DOM 에 직접 쓴다.
 */
const PageHeaderItem = memo(function PageHeaderItem({
  id,
  title,
  active,
  highlighted,
  editing,
  lod,
  onRenameCommit,
}: PageHeaderItemProps) {
  const compact = lod === "compact";
  return (
    <div
      className="page-header"
      data-page-header=""
      data-page-id={id}
      data-active={active || undefined}
      data-highlighted={highlighted || undefined}
      data-editing={editing || undefined}
      data-lod={lod}
    >
      {editing ? (
        <PageTitleInput id={id} title={title} onRenameCommit={onRenameCommit} />
      ) : (
        <>
          {/* 타이틀 앞 액션 — 뒤의 close 와 같은 어법·같은 20 상자.
              동작은 보류 — onPress 는 의미가 확정되면 배선한다. compact 티어는 버튼 없이
              타이틀 띠만 (배선 뒤 compact 노출 방식은 그 ADR 이 정한다 — ADR-226 R4). */}
          {!compact && (
            <ActionIconButton
              aria-label={`Play ${title}`}
              className={PAGE_HEADER_ACTION_CLASS}
              tooltip="Play"
            >
              <Play aria-hidden="true" size={iconProps.size} />
            </ActionIconButton>
          )}
          <span className="page-header__title">{title}</span>
          {/* 패널 header-action 과 같은 어법 (ActionIconButton = action-icon-button).
              크기는 select/combobox 안 트리거와 같은 20 상자 (--text-xl) — 헤더 띠
              안에 박히는 버튼이라 그 범주를 따른다 (CSS 에서 --icon-control-size 재지정).
              동작은 보류 — onPress 는 close 의미가 확정되면 배선한다. */}
          {!compact && (
            <ActionIconButton
              aria-label={`Close ${title}`}
              className={PAGE_HEADER_ACTION_CLASS}
              tooltip="Close"
            >
              <X aria-hidden="true" size={iconProps.size} />
            </ActionIconButton>
          )}
        </>
      )}
    </div>
  );
});

export default PageHeaderLayer;
