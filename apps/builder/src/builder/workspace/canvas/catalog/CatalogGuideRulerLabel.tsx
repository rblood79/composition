import { useEffect, useRef } from "react";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import {
  catalogGuidesByPage,
  catalogPageGuides,
} from "../../../catalogRuntime/pageGuides";
import { useBuilderUiStore } from "../../../stores/builderUiStore";
import {
  RULER_LABEL_GAP_PX,
  RULER_SIZE_PX,
} from "../../components/rulerMetrics";
import {
  getHoveredGuide,
  getSelectedGuide,
  resolveGuideEmphasis,
  resolveGuideEmphasisIdsForPage,
} from "../interaction/guideEmphasis";
import {
  OVERLAY_BLUE_HEX,
  OVERLAY_WARM_RED_HEX,
} from "../skia/semanticOverlayColors";
import {
  getGuideDrag,
  isGuideWithinPage,
  mergeGuideDrag,
  resolveGuideDragPreview,
} from "../interaction/guidePresentation";
import { subscribePageGuideRevision } from "../interaction/pageGuideRevision";
import {
  getViewportPresentationSnapshot,
  subscribeViewportPresentation,
} from "../viewport/viewportPresentation";

const GUIDE_VALUE_COLOR = `#${OVERLAY_WARM_RED_HEX.toString(16).padStart(6, "0")}`;

const SELECTED_GUIDE_COLOR = `#${OVERLAY_BLUE_HEX.toString(16).padStart(6, "0")}`;

/** 눈금자 위 안내선과 수치. 수치는 드래그·hover·선택 순으로 한 개만 표시한다. */
export function CatalogGuideRulerLabel({
  workspace,
}: {
  workspace: CatalogWorkspace;
}) {
  const showRulers = useBuilderUiStore((state) => state.showRulers);
  const labelRef = useRef<HTMLSpanElement>(null);
  const markersRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const label = labelRef.current;
    const host = markersRef.current;
    if (!showRulers || !label || !host) return;
    const markers = new Map<string, HTMLSpanElement>();

    const updateMarkers = () => {
      const session = workspace.session.getSnapshot();
      const frames = workspace.root.pageFrameRects();
      const drag = getGuideDrag();
      const viewport = getViewportPresentationSnapshot();
      const visible = new Set<string>();
      const place = (
        key: string,
        axis: "x" | "y",
        scenePosition: number,
        color: string,
        opacity: string,
      ) => {
        const screen =
          (axis === "x" ? viewport.x : viewport.y) +
          scenePosition * viewport.scale;
        if (screen < 0) return;
        visible.add(key);
        let marker = markers.get(key);
        if (!marker) {
          marker = document.createElement("span");
          marker.className = "ruler-guide-line";
          host.appendChild(marker);
          markers.set(key, marker);
        }
        if (marker.dataset.axis !== axis) marker.dataset.axis = axis;
        const transform =
          axis === "x" ? `translateX(${screen}px)` : `translateY(${screen}px)`;
        if (marker.style.transform !== transform)
          marker.style.transform = transform;
        if (marker.dataset.color !== color) {
          marker.style.backgroundColor = color;
          marker.dataset.color = color;
        }
        if (marker.style.opacity !== opacity) marker.style.opacity = opacity;
      };
      const byPage = mergeGuideDrag(
        catalogGuidesByPage(workspace.runtime.graph, session.breakpoint),
        drag,
      );
      for (const [pageId, guides] of byPage) {
        const frame = frames.get(pageId);
        if (!frame) continue;
        const ids = resolveGuideEmphasisIdsForPage(pageId);
        const emphasis =
          drag && !drag.removing && drag.pageId === pageId
            ? { ...ids, hoveredGuideId: drag.guideId }
            : ids;
        for (const guide of guides) {
          const kind = resolveGuideEmphasis(guide.id, emphasis);
          if (
            (pageId !== session.pageId && kind === "default") ||
            !isGuideWithinPage(guide.axis, guide.position, frame)
          )
            continue;
          place(
            JSON.stringify([pageId, guide.id]),
            guide.axis,
            (guide.axis === "x" ? frame.x : frame.y) + guide.position,
            kind === "selected" ? SELECTED_GUIDE_COLOR : GUIDE_VALUE_COLOR,
            kind === "default" ? "0.7" : "1",
          );
        }
      }
      const preview = resolveGuideDragPreview(drag);
      if (preview)
        place(
          "preview",
          preview.axis,
          preview.scenePosition,
          GUIDE_VALUE_COLOR,
          "0.45",
        );
      for (const [key, marker] of markers) {
        if (visible.has(key)) continue;
        marker.remove();
        markers.delete(key);
      }
    };

    const showValue = (
      axis: "x" | "y",
      position: number,
      scenePosition: number,
    ) => {
      const viewport = getViewportPresentationSnapshot();
      const screen =
        (axis === "x" ? viewport.x : viewport.y) +
        scenePosition * viewport.scale;
      // 코너와 겹치거나 화면 밖인 안내선은 숫자도 숨긴다.
      const hidden = screen < RULER_SIZE_PX;
      if (label.hidden !== hidden) label.hidden = hidden;
      const text = String(Math.round(position * 100) / 100);
      if (label.textContent !== text) label.textContent = text;
      if (label.dataset.axis !== axis) label.dataset.axis = axis;
      const transform =
        axis === "x"
          ? `translateX(${screen + RULER_LABEL_GAP_PX}px)`
          : `translateY(${screen + RULER_LABEL_GAP_PX}px)`;
      if (label.style.transform !== transform)
        label.style.transform = transform;
    };

    const update = () => {
      updateMarkers();
      const drag = getGuideDrag();
      if (drag?.kind === "create") {
        const pageId = drag.pageId ?? workspace.session.getSnapshot().pageId;
        const frame = pageId && workspace.root.pageFrameRects().get(pageId);
        const origin = frame ? (drag.axis === "x" ? frame.x : frame.y) : 0;
        // 페이지에 들어가기 전에는 활성 페이지 기준으로 미리보기 좌표를 표시한다.
        const scenePosition =
          drag.pageId && frame ? origin + drag.position : drag.scenePosition;
        if (drag.removing || scenePosition === null) {
          if (!label.hidden) label.hidden = true;
          return;
        }
        showValue(drag.axis, scenePosition - origin, scenePosition);
        return;
      }
      const target =
        drag?.kind === "move" && drag.originPageId
          ? { pageId: drag.originPageId, guideId: drag.guideId }
          : (getHoveredGuide() ?? getSelectedGuide());
      const frame =
        target && workspace.root.pageFrameRects().get(target.pageId);
      const guide =
        target &&
        catalogPageGuides(
          workspace.runtime.graph,
          target.pageId,
          workspace.session.getSnapshot().breakpoint,
        ).find((entry) => entry.id === target.guideId);
      const matchingDrag =
        drag &&
        target &&
        drag.guideId === target.guideId &&
        drag.originPageId === target.pageId;
      const position = matchingDrag ? drag.position : guide?.position;
      if (
        !guide ||
        !frame ||
        position === undefined ||
        (drag && (!matchingDrag || drag.removing)) ||
        !isGuideWithinPage(guide.axis, position, frame)
      ) {
        if (!label.hidden) label.hidden = true;
        return;
      }
      showValue(
        guide.axis,
        position,
        (guide.axis === "x" ? frame.x : frame.y) + position,
      );
    };

    update();
    const cleanups = [
      subscribePageGuideRevision(update),
      subscribeViewportPresentation(update),
      workspace.runtime.subscribeSteps(update),
      workspace.subscribeRoot(update),
      workspace.session.subscribe(update),
    ];
    return () => {
      cleanups.forEach((cleanup) => cleanup());
      for (const marker of markers.values()) marker.remove();
    };
  }, [showRulers, workspace]);

  if (!showRulers) return null;
  return (
    <div className="ruler-guide-position-overlay">
      <div ref={markersRef} aria-hidden="true" />
      <span
        className="ruler-label ruler-guide-position"
        ref={labelRef}
        style={{ color: GUIDE_VALUE_COLOR }}
        hidden
      />
    </div>
  );
}
