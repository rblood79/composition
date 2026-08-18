import { mergeProps, useKeyboard, useMove } from "react-aria";
import type { PanelResizeEdge } from "../panels/core/types";

export interface PanelSplitterProps {
  edge: PanelResizeEdge;
  label: string;
  controls: string;
  value: number;
  minValue: number;
  maxValue: number;
  layoutVersion?: number;
  onResizeStart: () => void;
  onResize: (deltaX: number, deltaY: number) => void;
  onResizeEnd: () => void;
}

function deltaForTarget(
  edge: PanelResizeEdge,
  currentValue: number,
  targetValue: number,
): { deltaX: number; deltaY: number } {
  switch (edge) {
    case "left":
      return { deltaX: currentValue - targetValue, deltaY: 0 };
    case "right":
      return { deltaX: targetValue - currentValue, deltaY: 0 };
    case "top":
      return { deltaX: 0, deltaY: currentValue - targetValue };
    case "bottom":
      return { deltaX: 0, deltaY: targetValue - currentValue };
  }
}

export function PanelSplitter({
  edge,
  label,
  controls,
  value,
  minValue,
  maxValue,
  layoutVersion,
  onResizeStart,
  onResize,
  onResizeEnd,
}: PanelSplitterProps) {
  const adjustsWidth = edge === "left" || edge === "right";
  const { moveProps } = useMove({
    onMoveStart: onResizeStart,
    onMove: (event) => onResize(event.deltaX, event.deltaY),
    onMoveEnd: onResizeEnd,
  });
  const { keyboardProps } = useKeyboard({
    onKeyDown: (event) => {
      if (event.key !== "Home" && event.key !== "End") {
        if (
          event.key === "ArrowLeft" ||
          event.key === "ArrowRight" ||
          event.key === "ArrowUp" ||
          event.key === "ArrowDown"
        ) {
          return;
        }
        event.continuePropagation();
        return;
      }

      event.preventDefault();
      const targetValue = event.key === "Home" ? minValue : maxValue;
      const { deltaX, deltaY } = deltaForTarget(edge, value, targetValue);
      if (deltaX === 0 && deltaY === 0) return;

      onResizeStart();
      onResize(deltaX, deltaY);
      onResizeEnd();
    },
  });

  return (
    <div
      {...mergeProps(moveProps, keyboardProps)}
      className="panel-resize-handle"
      data-edge={edge}
      data-layout-version={layoutVersion}
      role="separator"
      aria-label={label}
      aria-controls={controls}
      aria-orientation={adjustsWidth ? "vertical" : "horizontal"}
      aria-valuenow={value}
      aria-valuemin={minValue}
      aria-valuemax={maxValue}
      tabIndex={0}
    />
  );
}
