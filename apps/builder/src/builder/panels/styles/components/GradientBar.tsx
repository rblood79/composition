/**
 * GradientBar - 그래디언트 미리보기 바 + 드래그 가능한 스톱 핸들
 *
 * Gradient Phase 2
 * - 바: gradientCss로 미리보기
 * - 핸들: 드래그로 position 조정
 * - 빈 영역 클릭: 새 스톱 추가
 * - Y축 30px 초과 드래그: 스톱 삭제
 *
 * @since 2026-02-10 Gradient Phase 2
 */

import { memo, useState, useCallback, useRef } from "react";
import type { GradientStop } from "../../../../types/builder/fill.types";

import "./GradientBar.css";

interface GradientBarProps {
  stops: GradientStop[];
  gradientCss: string;
  activeStopIndex: number;
  onStopSelect: (index: number) => void;
  onStopMove: (index: number, position: number) => void;
  onStopMoveEnd: (index: number, position: number) => void;
  onStopAdd: (position: number) => void;
  onStopRemove: (index: number) => void;
}

export const GradientBar = memo(function GradientBar({
  stops,
  gradientCss,
  activeStopIndex,
  onStopSelect,
  onStopMove,
  onStopMoveEnd,
  onStopAdd,
  onStopRemove,
}: GradientBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{
    index: number;
    startY: number;
  } | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const getPosition = useCallback((clientX: number): number => {
    const bar = barRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    const raw = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(1, raw));
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      draggingRef.current = { index, startY: e.clientY };
      setDraggingIndex(index);
      onStopSelect(index);
    },
    [onStopSelect],
  );

  // 프레임 소유권은 상위 editor adapter에 있다. legacy 경로도
  // updateFillPreviewThrottled가 단일 RAF를 소유하므로 이 컴포넌트가 중첩 RAF를
  // 만들지 않는다.
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = draggingRef.current;
      if (!drag) return;

      const clientX = e.clientX;
      const clientY = e.clientY;

      const position = getPosition(clientX);
      const deltaY = Math.abs(clientY - drag.startY);

      if (deltaY > 30 && stops.length > 2) return;

      onStopMove(drag.index, position);
    },
    [getPosition, onStopMove, stops.length],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const drag = draggingRef.current;
      if (!drag) return;
      draggingRef.current = null;
      setDraggingIndex(null);

      const deltaY = Math.abs(e.clientY - drag.startY);
      if (deltaY > 30 && stops.length > 2) {
        onStopRemove(drag.index);
        return;
      }

      const position = getPosition(e.clientX);
      onStopMoveEnd(drag.index, position);
    },
    [getPosition, onStopMoveEnd, onStopRemove, stops.length],
  );

  const handleBarClick = useCallback(
    (e: React.MouseEvent) => {
      if (
        (e.target as HTMLElement).classList.contains("gradient-bar__handle")
      ) {
        return;
      }
      const position = getPosition(e.clientX);
      onStopAdd(position);
    },
    [getPosition, onStopAdd],
  );

  return (
    <div
      ref={barRef}
      className="gradient-bar"
      onClick={handleBarClick}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        className="gradient-bar__preview"
        style={{ background: gradientCss }}
      />
      {stops.map((stop, index) => (
        <div
          key={index}
          className="gradient-bar__handle"
          style={{
            left: `${stop.position * 100}%`,
            backgroundColor: stop.color.slice(0, 7),
          }}
          data-active={index === activeStopIndex || undefined}
          data-dragging={draggingIndex === index || undefined}
          onPointerDown={(e) => handlePointerDown(e, index)}
        />
      ))}
    </div>
  );
});
