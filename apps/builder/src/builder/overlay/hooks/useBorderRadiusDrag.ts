/**
 * useBorderRadiusDrag - border-radius 드래그 인터랙션 훅
 *
 * Adobe XD 스타일의 코너 포인트 드래그로 border-radius 조절
 *
 * 성능 최적화:
 * - Module-level 상태로 확실한 드래그 제어
 * - 드래그 중: Canvas에 직접 postMessage (즉시 렌더링)
 * - 드래그 종료: Inspector state 업데이트 (store 저장)
 * - 드래그 오버레이로 iframe 이벤트 캡처 문제 해결
 */

import { useCallback, useEffect } from "react";
import { MessageService } from "../../../utils/messaging";
import { useStore } from "../../stores";
// 🚀 Phase 11: Feature Flags for WebGL-only mode
import {
  isWebGLCanvas,
  isCanvasCompareMode,
} from "../../../utils/featureFlags";

export type CornerPosition =
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight";

// ⚡ Module-level 드래그 상태 (React 외부에서 확실한 제어)
let isDragging = false;
let activeCorner: CornerPosition | null = null;
let initialRadius = 0;
let initialMouseX = 0;
let initialMouseY = 0;
let maxRadius = 0;
let lastRadius = -1;
let rafId: number | null = null;
let dragOverlay: HTMLDivElement | null = null;

interface UseBorderRadiusDragOptions {
  onDragStart?: () => void;
  onDrag?: (radius: number, corner: CornerPosition) => void;
  onDragEnd?: (radius: number, corner: CornerPosition) => void;
}

/**
 * 현재 borderRadius 값을 파싱 (px, %, rem 등 → 숫자)
 */
function parseBorderRadius(value: string | undefined): number {
  if (
    !value ||
    value === "reset" ||
    value === "inherit" ||
    value === "initial"
  ) {
    return 0;
  }
  const firstValue = value.split(/\s+/)[0];
  const parsed = parseFloat(firstValue);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * 개별 코너 속성 이름 매핑
 */
const cornerPropertyMap: Record<CornerPosition, string> = {
  topLeft: "borderTopLeftRadius",
  topRight: "borderTopRightRadius",
  bottomLeft: "borderBottomLeftRadius",
  bottomRight: "borderBottomRightRadius",
};

/**
 * 대각선 방향 계산 (코너별)
 */
function calculateDiagonalDistance(
  corner: CornerPosition,
  deltaX: number,
  deltaY: number,
): number {
  switch (corner) {
    case "topLeft":
      return (deltaX + deltaY) / Math.SQRT2;
    case "topRight":
      return (-deltaX + deltaY) / Math.SQRT2;
    case "bottomLeft":
      return (deltaX - deltaY) / Math.SQRT2;
    case "bottomRight":
      return (-deltaX - deltaY) / Math.SQRT2;
    default:
      return 0;
  }
}

/**
 * Canvas에 직접 스타일 업데이트 전송 (빠른 프리뷰용)
 * 🚀 Phase 11: WebGL-only 모드에서는 postMessage 스킵
 */
function sendStyleToCanvas(
  elementId: string,
  styleProps: Record<string, string>,
) {
  // 🚀 Phase 11: WebGL-only 모드에서는 iframe 통신 불필요
  const isWebGLOnly = isWebGLCanvas() && !isCanvasCompareMode();
  if (isWebGLOnly) return;

  const iframe = MessageService.getIframe();
  if (iframe?.contentWindow) {
    // `merge` 필드는 싣지 않는다 — 수신 측(`preview/messaging/messageHandler.ts`
    // 의 `UpdateElementPropsMessage`)에 그 필드가 없고, 실제 적용부인
    // `runtimeStore.updateElementProps` 는 `{...currentProps, ...patch}` 얕은
    // 병합 한 경로뿐이라 replace 분기 자체가 존재하지 않는다. 종전에 실려 있던
    // `merge: true` 는 구현된 적 없는 의미론을 광고하던 dead payload 였다.
    iframe.contentWindow.postMessage(
      {
        type: "UPDATE_ELEMENT_PROPS",
        elementId,
        props: { style: styleProps },
      },
      window.location.origin,
    );
  }
}

/**
 * 코너별 커서 스타일
 */
function getCornerCursor(corner: CornerPosition): string {
  switch (corner) {
    case "topLeft":
    case "bottomRight":
      return "nwse-resize";
    case "topRight":
    case "bottomLeft":
      return "nesw-resize";
    default:
      return "nwse-resize";
  }
}

/**
 * 드래그 오버레이 생성 (iframe 위에서 이벤트 캡처)
 */
function createDragOverlay(): void {
  if (dragOverlay) return;

  const cursor = activeCorner ? getCornerCursor(activeCorner) : "nwse-resize";

  dragOverlay = document.createElement("div");
  dragOverlay.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 99999;
    cursor: ${cursor};
  `;
  document.body.appendChild(dragOverlay);
}

/**
 * 드래그 오버레이 제거
 */
function removeDragOverlay(): void {
  if (dragOverlay) {
    dragOverlay.remove();
    dragOverlay = null;
  }
}

/**
 * 드래그 상태 초기화
 */
function resetDragState() {
  isDragging = false;
  activeCorner = null;
  initialRadius = 0;
  initialMouseX = 0;
  initialMouseY = 0;
  maxRadius = 0;
  lastRadius = -1;

  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  removeDragOverlay();
}

/**
 * 스타일 객체 생성
 */
function createStyleProps(
  radius: number,
  corner: CornerPosition,
  shiftKey: boolean,
): Record<string, string> {
  if (shiftKey) {
    return {
      borderTopLeftRadius: `${radius}px`,
      borderTopRightRadius: `${radius}px`,
      borderBottomLeftRadius: `${radius}px`,
      borderBottomRightRadius: `${radius}px`,
      borderRadius: `${radius}px`,
    };
  } else {
    const property = cornerPropertyMap[corner];
    return { [property]: `${radius}px` };
  }
}

/**
 * 드래그 강제 취소 (blur, ESC 등)
 */
function cancelDrag() {
  if (!isDragging) return;

  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("mouseup", handleMouseUp);
  document.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("blur", handleWindowBlur);

  // 원래 값으로 복원
  const selectedElementId = useStore.getState().selectedElementId;
  if (selectedElementId && activeCorner) {
    const styleProps = createStyleProps(initialRadius, activeCorner, false);
    sendStyleToCanvas(selectedElementId, styleProps);
  }

  resetDragState();
}

/**
 * ESC 키 핸들러
 */
function handleKeyDown(e: KeyboardEvent) {
  if (e.key === "Escape" && isDragging) {
    e.preventDefault();
    cancelDrag();
  }
}

/**
 * 윈도우 블러 핸들러 (포커스 손실 시 드래그 취소)
 */
function handleWindowBlur() {
  if (isDragging) {
    cancelDrag();
  }
}

// ⚡ Module-level 이벤트 핸들러 (항상 같은 참조)
function handleMouseMove(e: MouseEvent) {
  if (!isDragging || !activeCorner) return;

  const deltaX = e.clientX - initialMouseX;
  const deltaY = e.clientY - initialMouseY;
  const diagonalDistance = calculateDiagonalDistance(
    activeCorner,
    deltaX,
    deltaY,
  );

  let newRadius = Math.round(initialRadius + diagonalDistance);
  newRadius = Math.max(0, Math.min(maxRadius, newRadius));

  // 같은 값이면 스킵
  if (newRadius === lastRadius) return;
  lastRadius = newRadius;

  // 선택된 요소 ID
  const selectedElementId = useStore.getState().selectedElementId;
  if (!selectedElementId) return;

  // ⚡ RAF throttle
  if (rafId === null) {
    rafId = requestAnimationFrame(() => {
      rafId = null;
      if (!isDragging || !activeCorner) return;

      const styleProps = createStyleProps(lastRadius, activeCorner, e.shiftKey);
      sendStyleToCanvas(selectedElementId, styleProps);
    });
  }
}

function handleMouseUp(e: MouseEvent) {
  if (!isDragging || !activeCorner) return;

  // ⚡ 즉시 모든 이벤트 리스너 제거
  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("mouseup", handleMouseUp);
  document.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("blur", handleWindowBlur);

  // 값 저장 후 상태 초기화
  const corner = activeCorner;
  const deltaX = e.clientX - initialMouseX;
  const deltaY = e.clientY - initialMouseY;
  const diagonalDistance = calculateDiagonalDistance(corner, deltaX, deltaY);
  let finalRadius = Math.round(initialRadius + diagonalDistance);
  finalRadius = Math.max(0, Math.min(maxRadius, finalRadius));
  const shiftKey = e.shiftKey;

  // 상태 초기화
  resetDragState();

  // 선택된 요소 ID
  const selectedElementId = useStore.getState().selectedElementId;
  if (!selectedElementId) return;

  // Canvas에 최종 값 전송
  const styleProps = createStyleProps(finalRadius, corner, shiftKey);
  sendStyleToCanvas(selectedElementId, styleProps);

  // Builder Store 업데이트 (직접 저장)
  const updateStyle = useStore.getState().updateSelectedStyle;
  const updateStyles = useStore.getState().updateSelectedStyles;

  if (shiftKey) {
    updateStyles(styleProps);
  } else {
    const property = cornerPropertyMap[corner];
    updateStyle(property, `${finalRadius}px`);
  }
}

export function useBorderRadiusDrag(
  rect: { width: number; height: number } | null,
  currentBorderRadius: string | undefined,
  options: UseBorderRadiusDragOptions = {},
) {
  const { onDragStart } = options;

  // ⚡ 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (isDragging) {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("blur", handleWindowBlur);
        resetDragState();
      }
    };
  }, []);

  const handleDragStart = useCallback(
    (corner: CornerPosition, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!rect) return;

      // 이전 드래그가 남아있으면 정리
      if (isDragging) {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("blur", handleWindowBlur);
        resetDragState();
      }

      // 새 드래그 시작
      isDragging = true;
      activeCorner = corner;
      initialRadius = parseBorderRadius(currentBorderRadius);
      initialMouseX = e.clientX;
      initialMouseY = e.clientY;
      maxRadius = Math.min(rect.width, rect.height) / 2;
      lastRadius = initialRadius;

      // ⚡ 드래그 오버레이 생성 (iframe 위에서 mouseup 캡처)
      createDragOverlay();

      onDragStart?.();

      // 모든 이벤트 리스너 등록
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("keydown", handleKeyDown);
      window.addEventListener("blur", handleWindowBlur);
    },
    [rect, currentBorderRadius, onDragStart],
  );

  return {
    handleDragStart,
    isDragging,
    activeCorner,
  };
}
