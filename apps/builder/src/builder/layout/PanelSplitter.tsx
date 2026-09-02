import { mergeProps, useKeyboard, useMove } from "react-aria";
import { useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { PanelResizeEdge } from "../panels/core/types";

export interface PanelSplitterProps {
  edge: PanelResizeEdge;
  label: string;
  controls: string;
  value: number;
  minValue: number;
  maxValue: number;
  layoutVersion?: number;
  className?: string;
  splitterKind?: "row" | "column";
  style?: CSSProperties;
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
  className,
  splitterKind,
  style,
  onResizeStart,
  onResize,
  onResizeEnd,
}: PanelSplitterProps) {
  const adjustsWidth = edge === "left" || edge === "right";
  const pointerDeltaRef = useRef({ deltaX: 0, deltaY: 0 });
  // 포인터 드래그가 진행 중인 동안만 true. 손잡이 표시(::after)와 커서를 hover 가 아니라
  // 이 상태에 묶는다 — 드래그 중 포인터는 한 프레임 뒤에서 따라오는 10px 손잡이 영역을
  // 쉽게 벗어나고, hover 에 묶어 두면 그때마다 표시가 사라졌다 나타난다 (2026-09-02 지적).
  // useMove 는 첫 이동에서야 onMoveStart 를 부르므로 클릭·더블클릭만으로는 켜지지 않는다.
  const [isResizing, setIsResizing] = useState(false);
  const { moveProps } = useMove({
    onMoveStart: (event) => {
      pointerDeltaRef.current = { deltaX: 0, deltaY: 0 };
      if (event.pointerType !== "keyboard") setIsResizing(true);
      onResizeStart();
    },
    onMove: (event) => {
      pointerDeltaRef.current = {
        deltaX: pointerDeltaRef.current.deltaX + event.deltaX,
        deltaY: pointerDeltaRef.current.deltaY + event.deltaY,
      };
      onResize(pointerDeltaRef.current.deltaX, pointerDeltaRef.current.deltaY);
    },
    onMoveEnd: () => {
      setIsResizing(false);
      onResizeEnd();
    },
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
    <>
      <div
        {...mergeProps(moveProps, keyboardProps)}
        className={`panel-resize-handle ${className ?? ""}`.trim()}
        data-edge={edge}
        data-layout-version={layoutVersion}
        data-splitter-kind={splitterKind}
        data-resizing={isResizing ? "true" : undefined}
        role="separator"
        aria-label={label}
        aria-controls={controls}
        aria-orientation={adjustsWidth ? "vertical" : "horizontal"}
        aria-valuenow={value}
        aria-valuemin={minValue}
        aria-valuemax={maxValue}
        style={style}
        tabIndex={0}
      />
      {isResizing &&
        typeof document !== "undefined" &&
        createPortal(
          // 드래그 중 화면 전체를 덮는 투명 막. 포인터가 손잡이를 벗어나도 resize 커서를
          // 유지하고, 아래 패널·캔버스의 hover 반응과 텍스트 선택을 막는다. useMove 는
          // window 에서 pointermove/up 을 듣기 때문에 이 막이 이벤트를 가려도 드래그는 계속된다.
          <div
            className="panel-resize-shield"
            data-edge={edge}
            aria-hidden="true"
          />,
          document.body,
        )}
    </>
  );
}
