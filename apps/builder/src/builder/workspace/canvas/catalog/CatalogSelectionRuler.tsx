import { useEffect, useRef } from "react";
import { useBuilderUiStore } from "../../../stores/builderUiStore";
import {
  RULER_LABEL_GAP_PX,
  RULER_SIZE_PX,
} from "../../components/rulerMetrics";
import { subscribeCanvasFramePresentation } from "../canvasFramePresentation";
import type { BoundingBox } from "../selection/types";
import {
  getViewportPresentationSnapshot,
  subscribeViewportPresentation,
} from "../viewport/viewportPresentation";

/** 선택 테두리와 같은 scene 상자를 눈금자에만 투영한다. 문서 안내선은 만들지 않는다. */
export function CatalogSelectionRuler({
  selectionBox,
  readOrigin,
}: {
  selectionBox: () => BoundingBox | null;
  readOrigin?: () => { x: number; y: number } | null;
}) {
  const showRulers = useBuilderUiStore((state) => state.showRulers);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!showRulers || !root) return;
    root.style.setProperty("--ruler-size", `${RULER_SIZE_PX}px`);
    const axes = (["x", "y"] as const).map((axis) => ({
      axis,
      range: root.querySelector<HTMLElement>(
        `[data-axis="${axis}"] .ruler-selection-range`,
      )!,
      labels: Array.from(
        root.querySelectorAll<HTMLElement>(
          `[data-axis="${axis}"] .ruler-selection-value`,
        ),
      ),
    }));
    const update = () => {
      const box = selectionBox();
      const hidden = !box;
      if (root.hidden !== hidden) root.hidden = hidden;
      if (!box) return;
      const viewport = getViewportPresentationSnapshot();
      const origin = readOrigin?.() ?? { x: 0, y: 0 };
      for (const { axis, range, labels } of axes) {
        const start = box[axis];
        const size = axis === "x" ? box.width : box.height;
        const pan = viewport[axis];
        const from = pan + start * viewport.scale;
        const to = from + size * viewport.scale;
        // 코너를 제외한 스트립이 clip한다. 음수 좌표의 구간도 보이는 부분은 유지한다.
        const transform =
          axis === "x" ? `translateX(${from}px)` : `translateY(${from}px)`;
        const dimension = axis === "x" ? "width" : "height";
        if (range.style.transform !== transform)
          range.style.transform = transform;
        const extent = `${Math.max(0, to - from)}px`;
        if (range.style[dimension] !== extent) range.style[dimension] = extent;
        for (const [index, label] of labels.entries()) {
          const screen = index === 0 ? from : to;
          const value = (index === 0 ? start : start + size) - origin[axis];
          const text = String(Math.round(value * 100) / 100);
          if (label.textContent !== text) label.textContent = text;
          const hidden = screen < RULER_SIZE_PX;
          if (label.hidden !== hidden) label.hidden = hidden;
          // 시작값은 시작점 바깥, 끝값은 끝점 바깥: 작은 요소도 두 숫자가 겹치지 않는다.
          const offset = screen + (index === 0 ? -1 : 1) * RULER_LABEL_GAP_PX;
          const transform =
            axis === "x"
              ? `translateX(${offset}px)${index === 0 ? " translateX(-100%)" : ""}`
              : `translateY(${offset}px)${index === 0 ? " translateY(-100%)" : ""}`;
          if (label.style.transform !== transform)
            label.style.transform = transform;
        }
      }
    };
    update();
    const cleanups = [
      subscribeCanvasFramePresentation(update),
      subscribeViewportPresentation(update),
    ];
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [readOrigin, selectionBox, showRulers]);

  if (!showRulers) return null;
  return (
    <div
      className="ruler-selection-overlay"
      ref={rootRef}
      aria-hidden="true"
      hidden
    >
      {(["x", "y"] as const).map((axis) => (
        <div className="ruler-selection-strip" data-axis={axis} key={axis}>
          <span className="ruler-selection-range" />
          <span
            className={`ruler-label ruler-label--${axis} ruler-selection-value`}
          />
          <span
            className={`ruler-label ruler-label--${axis} ruler-selection-value`}
          />
        </div>
      ))}
    </div>
  );
}
