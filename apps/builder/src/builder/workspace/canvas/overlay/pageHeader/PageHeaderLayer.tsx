/**
 * ADR-221 — 페이지 헤더 DOM 층.
 *
 * `.canvas-container` 안, Skia 캔버스 위에 페이지마다 헤더 노드 하나. DOM 순서 =
 * `orderPagesForPaint` (활성 페이지 마지막) = 헤더끼리의 z-order. 위 페이지 body 와의 가림은
 * 배치 훅의 clip-path 가 맡는다. 배치는 React state 가 아니라 훅이 transform 으로 쓴다 —
 * 이 컴포넌트는 `style` prop 을 렌더하지 않아 재렌더가 훅의 인라인 스타일을 되돌리지 않는다.
 *
 * Phase 1: 표시 전용 (`pointer-events: none`). 히트 (drag · shift 토글 · 이름 편집) 는 Phase 2.
 */
import { useMemo, useState } from "react";
import { useStore } from "../../../../stores";
import { orderPagesForPaint } from "../../scene/pagePaintOrder";
import type { PageHeaderFrame } from "./pageHeaderGeometry";
import { usePageHeaderPlacement } from "./usePageHeaderPlacement";
import "./PageHeaderLayer.css";

export interface PageHeaderLayerProps {
  /** 뷰포트 안 페이지 프레임 (scene 좌표) — Skia 와 같은 소스 (`visiblePageFrames`). */
  frames: readonly PageHeaderFrame[];
}

export function PageHeaderLayer({ frames }: PageHeaderLayerProps) {
  const currentPageId = useStore((state) => state.currentPageId);
  const hasSelection = useStore((state) => state.selectedElementIds.length > 0);
  const [layerNode, setLayerNode] = useState<HTMLDivElement | null>(null);

  const ordered = useMemo(
    () =>
      orderPagesForPaint(
        frames.filter((frame) => Boolean(frame.title)),
        currentPageId,
      ),
    [frames, currentPageId],
  );

  usePageHeaderPlacement({ layerNode, frames: ordered });

  return (
    <div
      ref={setLayerNode}
      className="page-header-layer"
      data-page-header-layer=""
    >
      {ordered.map((frame) => {
        const active = frame.id === currentPageId;
        return (
          <div
            key={frame.id}
            className="page-header"
            data-page-header=""
            data-page-id={frame.id}
            data-active={active || undefined}
            data-highlighted={(active && hasSelection) || undefined}
          >
            <span className="page-header__title">{frame.title}</span>
          </div>
        );
      })}
    </div>
  );
}

export default PageHeaderLayer;
