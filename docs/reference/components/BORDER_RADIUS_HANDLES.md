# WebGL BorderRadius 핸들 구현 설계서

> **작성일**: 2025-12-24
> **상태**: ⚠️ 구현 보류 (성능 문제)
> **참조**: Adobe XD, Figma border-radius 조절 UX

---

## ⚠️ 구현 보류 사유 (2025-12-25)

### 문제점
1차 구현 완료 후 테스트 결과, **심각한 프레임 드랍**이 발생하여 실사용이 불가능한 수준이었습니다.

### 시도한 최적화
- console.log 제거
- 드래그 중 React state 업데이트 제거 (`setPreviewRadius` 삭제)
- RAF 스케줄링 (프레임당 1회만 콜백)
- 드래그 종료 시에만 Store 업데이트

### 분석된 원인
1. **PixiJS stage 이벤트 문제**: `stage.on('pointermove')`가 작동하지 않아 window 이벤트로 대체해야 했음
2. **좌표 변환 오버헤드**: Pixi 좌표 ↔ DOM 좌표 변환 과정에서 성능 저하
3. **개별 코너 borderRadius 미지원**: WebGL 캔버스(`graphicsUtils.ts`)가 단일 `borderRadius`만 지원하여 개별 코너 조절이 렌더링에 반영되지 않음
4. **Store 업데이트 비용**: 드래그 종료 시에도 Store 업데이트가 무거움

### 향후 개선 방향
1. **완전 imperative 방식**: 드래그 중 React/Store를 완전히 우회하고 PixiJS Graphics만 직접 조작
2. **개별 코너 borderRadius 렌더링 지원**: `graphicsUtils.ts`에 커스텀 경로 그리기 추가
3. **드래그 중 preview 분리**: Store와 별개의 preview layer에서 처리
4. **근본적인 아키텍처 재검토 필요**

### 롤백된 파일
- `apps/builder/src/builder/workspace/canvas/selection/borderRadiusTypes.ts` (삭제)
- `apps/builder/src/builder/workspace/canvas/selection/useBorderRadiusDragPixi.ts` (삭제)
- `apps/builder/src/builder/workspace/canvas/selection/BorderRadiusHandle.tsx` (삭제)
- `apps/builder/src/builder/workspace/canvas/selection/BorderRadiusHandles.tsx` (삭제)
- `apps/builder/src/builder/workspace/canvas/selection/SelectionBox.tsx` (원복)
- `apps/builder/src/builder/workspace/canvas/selection/SelectionLayer.tsx` (원복)
- `apps/builder/src/builder/workspace/canvas/selection/index.ts` (원복)

---

## 1. 개요

### 1.1 목표
WebGL 모드(PixiJS 캔버스)에서 Adobe XD/Figma 스타일의 borderRadius 핸들을 구현합니다.

### 1.2 핵심 기능
- **모서리 근처 hover 시에만 핸들 표시** (Figma 스타일)
- **대각선 드래그로 borderRadius 조절**
- **Shift+드래그: 4개 모서리 동시 조절**

### 1.3 참조 디자인

#### Adobe XD
- 선택된 요소의 4개 모서리에 작은 원형 핸들 표시
- 드래그 방향: 대각선 (코너 안쪽으로 드래그하면 radius 증가)
- 드래그 중 현재 값 툴팁 표시

#### Figma
- 모서리 근처에 마우스가 있을 때만 핸들 표시
- 핸들은 현재 radius 값에 비례하여 대각선 방향으로 오프셋
- 드래그 중 실시간 미리보기

---

## 2. 아키텍처

### 2.1 컴포넌트 구조

```
SelectionLayer
  └── SelectionBox
        ├── TransformHandle (기존 8방향 리사이즈)
        └── BorderRadiusHandles (신규)
              └── BorderRadiusHandle × 4 (topLeft, topRight, bottomLeft, bottomRight)
```

### 2.2 파일 구조

```
apps/builder/src/builder/workspace/canvas/selection/
├── types.ts                      # (수정) CornerPosition 추가
├── borderRadiusTypes.ts          # (신규) 상수, 유틸리티
├── BorderRadiusHandle.tsx        # (신규) 개별 핸들 컴포넌트
├── BorderRadiusHandles.tsx       # (신규) 핸들 컨테이너
├── useBorderRadiusDragPixi.ts    # (신규) 드래그 훅
├── SelectionBox.tsx              # (수정) 핸들 렌더링 추가
└── SelectionLayer.tsx            # (수정) borderRadius 구독
```

---

## 3. API 설계

### 3.1 borderRadiusTypes.ts

```typescript
/**
 * 코너 위치 타입
 */
export type CornerPosition = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

/**
 * 코너 근처 hover 감지 거리 (화면 픽셀 기준)
 */
export const CORNER_HOVER_DISTANCE = 30;

/**
 * 핸들 크기 (원형 반지름, 화면 픽셀 기준)
 */
export const BORDER_RADIUS_HANDLE_SIZE = 4;

/**
 * 핸들 색상 (테마 토큰 fallback)
 */
export const BORDER_RADIUS_HANDLE_COLOR = 0x3b82f6;

/**
 * ⚡ Hover 디바운스 시간 (ms) - 깜빡임 방지
 */
export const HOVER_DEBOUNCE_MS = 30;

/**
 * 코너별 CSS 속성 매핑
 */
export const cornerPropertyMap: Record<CornerPosition, string> = {
  topLeft: 'borderTopLeftRadius',
  topRight: 'borderTopRightRadius',
  bottomLeft: 'borderBottomLeftRadius',
  bottomRight: 'borderBottomRightRadius',
};

/**
 * 코너별 커서 스타일
 */
export const cornerCursorMap: Record<CornerPosition, string> = {
  topLeft: 'nwse-resize',
  topRight: 'nesw-resize',
  bottomLeft: 'nesw-resize',
  bottomRight: 'nwse-resize',
};

/**
 * 가장 가까운 코너 찾기
 */
export function findNearestCorner(
  mouseX: number,
  mouseY: number,
  width: number,
  height: number,
  zoom: number
): CornerPosition | null {
  const threshold = CORNER_HOVER_DISTANCE / zoom;

  const corners: Record<CornerPosition, { x: number; y: number }> = {
    topLeft: { x: 0, y: 0 },
    topRight: { x: width, y: 0 },
    bottomLeft: { x: 0, y: height },
    bottomRight: { x: width, y: height },
  };

  let nearestCorner: CornerPosition | null = null;
  let minDistance = Infinity;

  for (const [corner, pos] of Object.entries(corners) as [CornerPosition, { x: number; y: number }][]) {
    const distance = Math.hypot(mouseX - pos.x, mouseY - pos.y);
    if (distance < threshold && distance < minDistance) {
      minDistance = distance;
      nearestCorner = corner;
    }
  }

  return nearestCorner;
}

/**
 * 대각선 거리 계산 (드래그 방향에 따른 radius 변화량)
 */
export function calculateDiagonalDistance(
  corner: CornerPosition,
  deltaX: number,
  deltaY: number
): number {
  switch (corner) {
    case 'topLeft':
      return (deltaX + deltaY) / Math.SQRT2;
    case 'topRight':
      return (-deltaX + deltaY) / Math.SQRT2;
    case 'bottomLeft':
      return (deltaX - deltaY) / Math.SQRT2;
    case 'bottomRight':
      return (-deltaX - deltaY) / Math.SQRT2;
    default:
      return 0;
  }
}
```

> **색상 토큰 주의**: `BORDER_RADIUS_HANDLE_COLOR`는 하드코딩 값이 아니라 `cssVariableReader` 기반 테마 컬러를 우선 사용합니다. `useThemeColors`가 내부에서 `cssVariableReader`를 사용하므로, SelectionLayer에서 색상을 읽어 `handleColor` props로 전달하고 상수는 폴백으로만 둡니다.

### 3.2 BorderRadiusHandle.tsx

```typescript
import { memo, useCallback, useMemo } from 'react';
import { Graphics as PixiGraphics, FederatedPointerEvent, Circle } from 'pixi.js';
import { useExtend } from '@pixi/react';
import { PIXI_COMPONENTS } from '../pixiSetup';
import type { CornerPosition } from './borderRadiusTypes';
import {
  BORDER_RADIUS_HANDLE_SIZE,
  BORDER_RADIUS_HANDLE_COLOR,
  cornerCursorMap,
} from './borderRadiusTypes';

export interface BorderRadiusHandleProps {
  corner: CornerPosition;
  x: number;
  y: number;
  zoom: number;
  /** ⚡ 테마 색상을 부모에서 props로 전달 (훅 호출 방지) */
  handleColor?: number;
  onDragStart: (corner: CornerPosition, e: FederatedPointerEvent) => void;
}

export const BorderRadiusHandle = memo(function BorderRadiusHandle({
  corner,
  x,
  y,
  zoom,
  handleColor = BORDER_RADIUS_HANDLE_COLOR,
  onDragStart,
}: BorderRadiusHandleProps) {
  useExtend(PIXI_COMPONENTS);

  // 줌 독립적 크기
  const radius = BORDER_RADIUS_HANDLE_SIZE / zoom;
  const strokeWidth = 1.5 / zoom;

  // ⚡ hitArea 확장 (클릭 영역 +4px)
  const hitArea = useMemo(() => {
    const hitRadius = (BORDER_RADIUS_HANDLE_SIZE + 4) / zoom;
    return new Circle(0, 0, hitRadius);
  }, [zoom]);

  const draw = useCallback((g: PixiGraphics) => {
    g.clear();
    g.circle(0, 0, radius);
    g.fill({ color: handleColor });
    g.setStrokeStyle({ width: strokeWidth, color: 0xffffff });
    g.stroke();
  }, [radius, strokeWidth, handleColor]);

  const handlePointerDown = useCallback((e: FederatedPointerEvent) => {
    e.stopPropagation();
    onDragStart(corner, e);
  }, [corner, onDragStart]);

  return (
    <pixiGraphics
      x={x}
      y={y}
      draw={draw}
      eventMode="static"
      cursor={cornerCursorMap[corner]}
      hitArea={hitArea}
      onPointerDown={handlePointerDown}
    />
  );
});
```

### 3.3 BorderRadiusHandles.tsx

```typescript
import { memo, useMemo } from 'react';
import { useExtend } from '@pixi/react';
import { PIXI_COMPONENTS } from '../pixiSetup';
import { BorderRadiusHandle } from './BorderRadiusHandle';
import type { CornerPosition } from './borderRadiusTypes';
import { BORDER_RADIUS_HANDLE_COLOR } from './borderRadiusTypes';
import type { FederatedPointerEvent } from 'pixi.js';

export interface BorderRadiusHandlesProps {
  hoveredCorner: CornerPosition | null;
  boundsWidth: number;
  boundsHeight: number;
  currentRadius: number;
  zoom: number;
  /** ⚡ 테마 색상을 부모(SelectionLayer)에서 전달 */
  handleColor?: number;
  onDragStart: (corner: CornerPosition, e: FederatedPointerEvent) => void;
}

export const BorderRadiusHandles = memo(function BorderRadiusHandles({
  hoveredCorner,
  boundsWidth,
  boundsHeight,
  currentRadius,
  zoom,
  handleColor = BORDER_RADIUS_HANDLE_COLOR,
  onDragStart,
}: BorderRadiusHandlesProps) {
  useExtend(PIXI_COMPONENTS);

  // ⚡ 단일 코너만 계산 (4개 모두 계산하지 않음)
  const handlePosition = useMemo(() => {
    if (!hoveredCorner) return null;

    const getOffset = (radius: number) => {
      const minOffset = 4 / zoom;
      const radiusOffset = radius * 0.5;
      return minOffset + radiusOffset;
    };

    const offset = getOffset(currentRadius);

    // ⚡ Math.round로 서브픽셀 렌더링 방지
    switch (hoveredCorner) {
      case 'topLeft':
        return { x: Math.round(offset), y: Math.round(offset) };
      case 'topRight':
        return { x: Math.round(boundsWidth - offset), y: Math.round(offset) };
      case 'bottomLeft':
        return { x: Math.round(offset), y: Math.round(boundsHeight - offset) };
      case 'bottomRight':
        return { x: Math.round(boundsWidth - offset), y: Math.round(boundsHeight - offset) };
      default:
        return null;
    }
  }, [hoveredCorner, boundsWidth, boundsHeight, currentRadius, zoom]);

  // hover된 코너만 렌더링 (조건부 렌더링)
  if (!hoveredCorner || !handlePosition) return null;

  return (
    <BorderRadiusHandle
      corner={hoveredCorner}
      x={handlePosition.x}
      y={handlePosition.y}
      zoom={zoom}
      handleColor={handleColor}
      onDragStart={onDragStart}
    />
  );
});
```

### 3.4 useBorderRadiusDragPixi.ts

```typescript
import { useCallback, useRef, useEffect } from 'react';
import type { FederatedPointerEvent, Container } from 'pixi.js';
import type { CornerPosition } from './borderRadiusTypes';
import { calculateDiagonalDistance } from './borderRadiusTypes';
import { TIMING } from '../../../constants/timing';

// ============================================
// Constants
// ============================================

/**
 * 드래그 스로틀 시간 (ms)
 * TIMING.DRAG_THROTTLE = 16 (60fps 기준)
 * src/builder/constants/timing.ts에서 import
 */
const DRAG_THROTTLE_MS = TIMING.DRAG_THROTTLE; // 16ms

// ============================================
// Types
// ============================================

/**
 * cleanup ref 타입 - keydown 핸들러 저장용
 */
interface CleanupRef {
  keydownHandler?: (e: KeyboardEvent) => void;
}

// ============================================
// RAF Throttle (useDragInteraction 패턴)
// ============================================

/**
 * ⚡ RAF 기반 스로틀 (프레임당 1회만 실행)
 */
function useRAFThrottle() {
  const rafIdRef = useRef<number | null>(null);
  const pendingCallbackRef = useRef<(() => void) | null>(null);

  const schedule = useCallback((callback: () => void) => {
    pendingCallbackRef.current = callback;

    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        pendingCallbackRef.current?.();
        pendingCallbackRef.current = null;
      });
    }
  }, []);

  const cancel = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingCallbackRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return { schedule, cancel };
}

// ============================================
// Types
// ============================================

interface DragState {
  isDragging: boolean;
  corner: CornerPosition | null;
  initialRadius: number;
  initialLocalX: number;
  initialLocalY: number;
  maxRadius: number;
  lastRadius: number;
}

const initialDragState: DragState = {
  isDragging: false,
  corner: null,
  initialRadius: 0,
  initialLocalX: 0,
  initialLocalY: 0,
  maxRadius: 0,
  lastRadius: -1,
};

export interface UseBorderRadiusDragOptions {
  onDragStart?: (corner: CornerPosition) => void;
  onDragUpdate?: (radius: number, corner: CornerPosition, shiftKey: boolean) => void;
  onDragEnd?: (radius: number, corner: CornerPosition, shiftKey: boolean) => void;
  /** ⚡ ESC 키로 드래그 취소 시 콜백 */
  onDragCancel?: (initialRadius: number, corner: CornerPosition | null) => void;
}

// ============================================
// Hook
// ============================================

export function useBorderRadiusDragPixi(
  stage: Container,
  selectionContainer: Container,
  bounds: { width: number; height: number } | null,
  currentBorderRadius: number,
  options: UseBorderRadiusDragOptions = {}
) {
  const { onDragStart, onDragUpdate, onDragEnd, onDragCancel } = options;

  // ref 기반 상태 관리 (React 리렌더링 방지)
  const dragStateRef = useRef<DragState>({ ...initialDragState });
  const lastThrottleTimeRef = useRef<number>(0);
  const pointerIdRef = useRef<number | null>(null);
  const shiftKeyRef = useRef(false);

  // ⚡ RAF 스로틀링
  const { schedule: scheduleUpdate, cancel: cancelUpdate } = useRAFThrottle();

  // ⚡ 순환 참조 방지: keydown 핸들러를 ref로 저장 (나중에 제거용)
  const cleanupRef = useRef<CleanupRef>({});

  const handlePointerMove = useCallback((e: FederatedPointerEvent) => {
    const state = dragStateRef.current;
    if (!state.isDragging || !state.corner) return;
    if (pointerIdRef.current !== e.pointerId) return;

    // ⚡ 시간 기반 스로틀링 (16ms = 60fps)
    const now = performance.now();
    if (now - lastThrottleTimeRef.current < DRAG_THROTTLE_MS) {
      return;
    }
    lastThrottleTimeRef.current = now;

    shiftKeyRef.current = e.shiftKey;

    const local = e.getLocalPosition(selectionContainer);
    const deltaX = local.x - state.initialLocalX;
    const deltaY = local.y - state.initialLocalY;
    const diagonalDistance = calculateDiagonalDistance(state.corner, deltaX, deltaY);

    let newRadius = Math.round(state.initialRadius + diagonalDistance);
    newRadius = Math.max(0, Math.min(state.maxRadius, newRadius));

    if (newRadius === state.lastRadius) return;

    dragStateRef.current.lastRadius = newRadius;

    // ⚡ RAF 스케줄링으로 콜백 호출
    scheduleUpdate(() => {
      onDragUpdate?.(newRadius, state.corner!, shiftKeyRef.current);
    });
  }, [onDragUpdate, scheduleUpdate, selectionContainer]);

  // ⚡ cleanup 함수 (리스너 정리 + 상태 초기화)
  const cleanup = useCallback(() => {
    cancelUpdate();
    stage.off('pointermove', handlePointerMove);
    stage.off('pointerup');
    stage.off('pointerupoutside');

    // keydown 리스너 안전하게 제거
    if (cleanupRef.current.keydownHandler) {
      window.removeEventListener('keydown', cleanupRef.current.keydownHandler);
      cleanupRef.current.keydownHandler = undefined;
    }

    dragStateRef.current = { ...initialDragState };
    pointerIdRef.current = null;
  }, [cancelUpdate, handlePointerMove, stage]);

  const handlePointerUp = useCallback((e: FederatedPointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return;

    const state = dragStateRef.current;
    if (!state.isDragging || !state.corner) return;

    const finalRadius = state.lastRadius;
    const finalCorner = state.corner;
    const shiftKey = e.shiftKey || shiftKeyRef.current;

    // 리스너 정리 + 상태 초기화
    cleanup();

    onDragEnd?.(finalRadius, finalCorner, shiftKey);
  }, [cleanup, onDragEnd]);

  // ⚡ ESC 키로 드래그 취소
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && dragStateRef.current.isDragging) {
      e.preventDefault(); // ⚡ 다른 ESC 동작 방지
      e.stopPropagation();

      const state = dragStateRef.current;
      const initialRadius = state.initialRadius;
      const corner = state.corner;

      // 리스너 정리 + 상태 초기화
      cleanup();

      onDragCancel?.(initialRadius, corner);
    }
  }, [cleanup, onDragCancel]);

  // 드래그 시작
  const startDrag = useCallback((corner: CornerPosition, e: FederatedPointerEvent) => {
    if (!bounds) return;

    const local = e.getLocalPosition(selectionContainer);

    dragStateRef.current = {
      isDragging: true,
      corner,
      initialRadius: currentBorderRadius,
      initialLocalX: local.x,
      initialLocalY: local.y,
      maxRadius: Math.min(bounds.width, bounds.height) / 2,
      lastRadius: currentBorderRadius,
    };

    pointerIdRef.current = e.pointerId;
    shiftKeyRef.current = e.shiftKey;

    onDragStart?.(corner);

    stage.on('pointermove', handlePointerMove);
    stage.on('pointerup', handlePointerUp);
    stage.on('pointerupoutside', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);

    // ⚡ cleanup ref에 keydown 핸들러 저장 (나중에 제거용)
    cleanupRef.current.keydownHandler = handleKeyDown;
  }, [bounds, currentBorderRadius, handlePointerMove, handlePointerUp, handleKeyDown, onDragStart, selectionContainer, stage]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (dragStateRef.current.isDragging) {
        cleanup();
      }
    };
  }, [cleanup]);

  return {
    startDrag,
    isDragging: dragStateRef.current.isDragging,
    activeCorner: dragStateRef.current.corner,
  };
}
```

> **WebGL 전용 훅 규칙**
> - `app.stage`와 `selectionContainer`는 **필수**이며, 준비되기 전에는 핸들을 렌더링하지 않습니다.
> - Pixi pointer 이벤트로만 처리합니다.
> - `FederatedPointerEvent.getLocalPosition(...)`로 로컬 델타를 계산합니다.
> - `pointerupoutside`까지 처리해 드래그 종료를 보장합니다.
> - Store 업데이트는 hook 외부(SelectionLayer)에서 콜백으로 처리합니다.
> - ESC 취소만 `window` 키 이벤트를 사용합니다 (유일한 DOM 리스너 예외).

### 3.5 WebGL 전용 보완 사항

#### 3.5.1 좌표계/줌
- **좌표계 통일**: 드래그 시작/이동/종료 모두 Pixi 좌표로 처리합니다. `FederatedPointerEvent.getLocalPosition(selectionContainer)` 기준으로 델타를 계산하고 DOM `clientX/Y`와 혼용하지 않습니다.
- **줌 보정**: `selectionContainer`가 `viewport` 스케일을 포함한다면 로컬 좌표 사용만으로 보정이 됩니다. DOM 좌표를 써야 한다면 `delta / zoom` 보정을 반드시 적용합니다.
- **로테이션/스케일**: 회전/스케일이 적용된 선택 박스에서도 일관된 델타를 얻으려면 항상 로컬 좌표를 사용합니다.

#### 3.5.2 이벤트 처리 전략
- **Pixi pointer 이벤트 사용**: `pointerdown`은 핸들에서, `pointermove`/`pointerup`/`pointerupoutside`는 `app.stage` 또는 상위 컨테이너에 등록합니다.
- **stage/컨테이너 참조**: `useApplication().app.stage`와 `selectionContainerRef.current`를 hook에 전달합니다.
- **포인터 추적**: `pointerId`를 저장해 멀티 포인터 입력을 무시합니다.
- **키보드 예외**: ESC 취소를 위해 `window`의 `keydown`만 사용하고, `preventDefault()`로 다른 ESC 동작을 방지합니다.
- **cleanup 함수 패턴**: 순환 참조를 방지하기 위해 리스너 정리 로직을 `cleanup` 함수로 통합합니다. `cleanupRef`에 keydown 핸들러를 저장해 나중에 제거할 수 있게 합니다.
- **리스너 정리**: 드래그 종료/취소/언마운트 시 `cleanup()` 호출로 모든 리스너를 일괄 제거합니다.

#### 3.5.3 Store 업데이트 흐름 (WebGL)
- **실시간 미리보기**: `onDragUpdate`에서 **preview 전용 업데이트 함수**를 호출해 WebGL 프리뷰를 즉시 갱신합니다. (DB 저장/히스토리 기록 없음)
- **커밋 시점 분리**: drag end에서만 최종 값을 `updateSelectedStyle(s)`로 저장하고 DB 동기화를 수행합니다(메모리 상태 → preview → DB 순서 유지).
- **히스토리 최소화**: drag start 시 `prevProps`를 캡처하고, drag end에서 **1회만** `historyManager.addEntry(...)`를 호출해 히스토리를 기록합니다.
- **ESC 취소 복원**: 드래그 시작 시 `initialRadius`를 저장해두고 `onDragCancel`에서 preview 값을 원래대로 복원합니다.
- **Shift 상태 반영**: 드래그 중 `event.shiftKey`를 읽어 즉시 반영합니다(마우스 업 시점만 확인하면 UX가 어긋날 수 있음).

> **preview 전용 업데이트 함수 예시**
> - `updateSelectedStylePreview(property, value)`
> - `updateSelectedStylesPreview(styles)`
>
> 이 함수는 `elementsMap`/`selectedElementProps`만 갱신하고 `saveService` 및 `historyManager` 호출을 건너뜁니다.
> 구현 위치는 `apps/builder/src/builder/stores/inspectorActions.ts` (또는 selection 전용 slice)로 둡니다.
>
> **⚠️ 구현 필요 여부 및 우선순위:**
> | 방식 | 우선순위 | 설명 |
> |------|----------|------|
> | **로컬 state 방식** | P0 (1차 구현) | SelectionLayer에서 `previewRadius` state로 드래그 중 표시, drag end에만 store 업데이트. 가장 단순하고 빠른 구현 |
> | **Preview 액션 방식** | P1 (2차 개선) | Store에 preview 전용 액션 추가. 인스펙터 패널까지 실시간 동기화 필요 시 적용 |
>
> **1차 구현(로컬 state 방식)으로 먼저 진행**하고, 인스펙터 실시간 반영이 필요하면 2차로 Preview 액션을 추가합니다.

#### 3.5.4 값/단위 처리 규칙
- **기본 단위**: 드래그 조절 값은 **px만 사용**합니다.
- **percent 정규화**: `%` 값이 있으면 drag start 시 `min(width, height)` 기준으로 px로 변환하고, 드래그 중/종료 시 **px로 저장**합니다.
- **혼합 값**: 코너별 값이 다른 경우(혼합)에는 hover 시 해당 코너만 조절하고 Shift로 전체를 덮어씁니다.

#### 3.5.5 Hover/Hit 영역
- **히트 영역 확장**: `CORNER_HOVER_DISTANCE / zoom`만큼 selection hitArea를 확장해 코너 바깥에서도 hover가 안정적으로 동작하게 합니다.
- **멀티 선택 제한**: 다중 선택 시 핸들 숨김을 유지합니다(드래그 UX 충돌 방지).

#### 3.5.6 값 파싱 유틸

`parseBorderRadius(value, bounds)`는 px 숫자를 반환합니다.

**파싱 규칙:**
- 파싱 우선순위: **inline style → computed style → 0**
- 지원 형식: `12px`, `12`, `50%`
- `bounds`가 없으면 `%`는 0으로 처리합니다.

**복합 값 처리:**
- `"10px 20px"` 같은 복합 값은 **첫 번째 값만 사용** (전체 borderRadius 표현)
- 개별 코너가 필요한 경우 `parseCornerRadius(style, corner, bounds)` 사용
- 개별 코너 속성(`borderTopLeftRadius` 등)이 있으면 우선 적용, 없으면 `borderRadius`로 fallback

**구현:**

```typescript
// borderRadiusTypes.ts 또는 utils에 추가

/**
 * borderRadius 값을 px 숫자로 파싱
 * @param value - CSS 값 (e.g., "12px", "12", "50%")
 * @param bounds - 요소 크기 (percent 변환용)
 * @returns px 숫자
 */
export function parseBorderRadius(
  value: string | number | undefined,
  bounds?: { width: number; height: number }
): number {
  // undefined, null, 특수값 처리
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;

  const trimmed = value.trim();
  if (!trimmed || trimmed === 'reset' || trimmed === 'inherit' || trimmed === 'initial') {
    return 0;
  }

  // 복합 값인 경우 첫 번째 값만 사용 (e.g., "10px 20px" → "10px")
  const firstValue = trimmed.split(/\s+/)[0];

  const parsed = parseFloat(firstValue);
  if (isNaN(parsed)) return 0;

  // percent
  if (firstValue.endsWith('%')) {
    if (!bounds) return 0;
    const base = Math.min(bounds.width, bounds.height);
    return Math.round((base * parsed) / 100);
  }

  // px 또는 단위 없는 숫자
  return Math.round(parsed);
}

/**
 * 코너별 borderRadius 값 파싱
 * @param style - 요소의 style 객체
 * @param corner - 코너 위치
 * @param bounds - 요소 크기 (percent 변환용)
 */
export function parseCornerRadius(
  style: Record<string, unknown> | undefined,
  corner: CornerPosition,
  bounds?: { width: number; height: number }
): number {
  if (!style) return 0;

  // 개별 코너 속성 우선
  const cornerProp = cornerPropertyMap[corner];
  const cornerValue = style[cornerProp];
  if (cornerValue !== undefined && cornerValue !== null) {
    return parseBorderRadius(cornerValue as string, bounds);
  }

  // 전체 borderRadius fallback
  const borderRadius = style.borderRadius;
  return parseBorderRadius(borderRadius as string, bounds);
}
```

**사용 예시:**

```typescript
// SelectionLayer.tsx
const bounds = selectionBoundsRef.current;
const borderRadius = useStore(
  useCallback((state) => {
    if (!selectedId) return 0;
    const el = state.elementsMap.get(selectedId);
    return parseBorderRadius(el?.props?.style?.borderRadius, bounds);
  }, [selectedId, bounds])
);

// 개별 코너별 값이 필요한 경우
const topLeftRadius = parseCornerRadius(style, 'topLeft', bounds);
```

---

### 3.6 UI 피드백 및 레이어링

- **핸들 레이어링**: Selection overlay 최상단에 렌더링하고, 선택 테두리/리사이즈 핸들보다 위에 배치합니다.
- **테마 컬러 연동**: M3 토큰에서 핸들 색을 읽고(예: primary/outline) 다크/라이트 테마를 모두 지원합니다.
- **드래그 툴팁(선택)**: 코너 근처 드래그 시 현재 px 값을 간단한 텍스트로 표시합니다(예: Pixi Text 또는 DOM overlay).
- **히트 영역 확장**: 손잡이 원 크기보다 큰 `hitArea`를 설정해 미스 클릭을 줄입니다.
- **상호작용 충돌 방지**: 드래그 중에는 viewport pan/zoom 입력을 비활성화하거나 `stopPropagation` 처리합니다.

### 3.7 핸들 겹침 해결 전략

TransformHandle(8방향 resize)과 BorderRadiusHandle(4개 모서리)이 모서리에서 겹칠 수 있습니다. 아래 3가지 전략을 조합하여 해결합니다.

#### 3.7.1 안쪽 오프셋 (기본 적용)

BorderRadius 핸들을 모서리에서 안쪽 대각선 방향으로 오프셋합니다.

```typescript
// 핸들 위치 = 모서리에서 안쪽으로 오프셋
const offset = (4 / zoom) + (currentRadius * 0.5);

// topLeft 예시: (0, 0)이 아니라 (offset, offset)
{ x: Math.round(offset), y: Math.round(offset) }
```

```
┌─────────────────┐
│  ◇              │  ◇ = BorderRadius 핸들 (안쪽 오프셋)
│   ↖             │  □ = Resize 핸들 (모서리)
□                 □
│                 │
│                 │
□                 □
│              ↘  │
│              ◇  │
└─────────────────┘
```

- **장점**: 항상 겹침 없이 표시 가능
- **radius 값에 비례**: radius가 클수록 핸들이 더 안쪽으로 이동 (Figma 스타일)

#### 3.7.2 Hover 시에만 표시 (기본 적용)

평소에는 Resize 핸들만 표시하고, 모서리 근처에 마우스가 있을 때만 BorderRadius 핸들을 표시합니다.

```typescript
// hover 시에만 렌더링
if (!hoveredCorner) return null;

return <BorderRadiusHandle corner={hoveredCorner} ... />;
```

- **장점**: UI가 깔끔, 핸들이 많아도 복잡하지 않음
- **Figma 스타일**: 모서리 근처 hover → 핸들 표시 → 드래그 가능

#### 3.7.3 다른 모양/색상으로 구분 (기본 적용)

| 핸들 | 모양 | 색상 | 위치 |
|------|------|------|------|
| **Resize (Transform)** | □ 사각형 | 흰색 배경 + 파란 테두리 | 모서리 + 변 중앙 (8개) |
| **BorderRadius** | ○ 원형 | 파란 배경 + 흰색 테두리 | 모서리 안쪽 (hover 시 1개) |

```typescript
// TransformHandle - 사각형
g.rect(0, 0, adjustedSize, adjustedSize);
g.fill({ color: HANDLE_FILL_COLOR }); // 흰색
g.stroke({ color: HANDLE_STROKE_COLOR }); // 파란색

// BorderRadiusHandle - 원형
g.circle(0, 0, radius);
g.fill({ color: handleColor }); // 파란색
g.stroke({ color: 0xffffff }); // 흰색
```

- **시각적 구분**: 모양과 색상이 반전되어 역할이 명확함
- **일관된 UX**: 디자인 툴에서 흔히 사용하는 패턴

#### 3.7.4 전략 조합 요약

| 전략 | 적용 여부 | 효과 |
|------|----------|------|
| 안쪽 오프셋 | ✅ 기본 적용 | 물리적 겹침 방지 |
| Hover 시에만 표시 | ✅ 기본 적용 | UI 단순화 + 겹침 회피 |
| 다른 모양/색상 | ✅ 기본 적용 | 시각적 역할 구분 |

세 가지 전략을 모두 적용하면 겹침 문제가 완전히 해결됩니다.

## 4. 성능 최적화

> 참조: `docs/performance/13-webgl-canvas-optimization-final.md`

### 4.1 기여도 분석

| 기술 | 기여율 | 적용 위치 |
|------|--------|----------|
| RAF + 시간 기반 스로틀링 | ~25% | `useBorderRadiusDragPixi` 드래그 중 |
| ref 기반 상태 | ~20% | 드래그 중간 상태 |
| **값 변경 시에만 업데이트** | ~12% | hover 감지 (리렌더링 방지) |
| **단일 코너만 계산** | ~10% | `BorderRadiusHandles` (4개 → 1개) |
| Hover debounce | ~8% | 깜빡임 방지 |
| **테마 색상 props 전달** | ~6% | 핸들 내 훅 호출 방지 |
| 조건부 렌더링 | ~5% | hover 코너만 표시 |
| **hitArea 확장** | ~5% | 클릭 성공률 + UX |
| cancelUpdate (RAF 취소) | ~4% | 드래그 종료/취소 시 |
| **Store selector 최소화** | ~3% | 단일 selector + useCallback |
| useDeferredValue | ~2% | 인스펙터 패널 |

### 4.2 최적화 전략

#### 드래그 중 (핵심)
```typescript
// 1. ref 기반 상태 관리 (React 리렌더링 방지)
const dragStateRef = useRef<DragState>({ ... });

// 2. RAF + 시간 기반 이중 스로틀링
const { schedule: scheduleUpdate, cancel: cancelUpdate } = useRAFThrottle();

const now = performance.now();
if (now - lastThrottleTimeRef.current < TIMING.DRAG_THROTTLE) {
  return;
}

// 3. RAF 스케줄링으로 콜백 호출
scheduleUpdate(() => {
  onDragUpdate?.(newRadius, corner, shiftKeyRef.current);
});
```

#### 드래그 종료/취소 시 RAF 정리
```typescript
// ⚡ cleanup 함수로 통합 (순환 참조 방지)
const cleanup = useCallback(() => {
  cancelUpdate();
  stage.off('pointermove', handlePointerMove);
  stage.off('pointerup');
  stage.off('pointerupoutside');

  // keydown 리스너 안전하게 제거
  if (cleanupRef.current.keydownHandler) {
    window.removeEventListener('keydown', cleanupRef.current.keydownHandler);
    cleanupRef.current.keydownHandler = undefined;
  }

  dragStateRef.current = { ...initialDragState };
  pointerIdRef.current = null;
}, [cancelUpdate, handlePointerMove, stage]);

// ⚡ ESC 키로 드래그 취소
const handleKeyDown = useCallback((e: KeyboardEvent) => {
  if (e.key === 'Escape' && dragStateRef.current.isDragging) {
    e.preventDefault(); // 다른 ESC 동작 방지
    e.stopPropagation();

    const { initialRadius, corner } = dragStateRef.current;
    cleanup();
    onDragCancel?.(initialRadius, corner);
  }
}, [cleanup, onDragCancel]);
```

#### Hover 감지 (SelectionBox)
```typescript
// ⚡ 값 변경 시에만 state 업데이트 + debounce로 깜빡임 방지
const hoveredCornerRef = useRef<CornerPosition | null>(null);
const hoverDebounceRef = useRef<NodeJS.Timeout | null>(null);

const handlePointerMove = useCallback((e) => {
  const corner = findNearestCorner(...);

  // 이전 값과 다를 때만 처리
  if (corner !== hoveredCornerRef.current) {
    // pending debounce 취소
    if (hoverDebounceRef.current) {
      clearTimeout(hoverDebounceRef.current);
    }

    if (corner === null) {
      // ⚡ 코너 벗어날 때는 30ms 딜레이 (깜빡임 방지)
      hoverDebounceRef.current = setTimeout(() => {
        hoveredCornerRef.current = null;
        setHoveredCorner(null);
      }, 30);
    } else {
      // 코너 진입은 즉시
      hoveredCornerRef.current = corner;
      setHoveredCorner(corner);
    }
  }
}, []);

// cleanup
useEffect(() => {
  return () => {
    if (hoverDebounceRef.current) {
      clearTimeout(hoverDebounceRef.current);
    }
  };
}, []);
```

#### 단일 코너만 계산 (BorderRadiusHandles)
```typescript
// ⚡ 4개 모두 계산하지 않고 hoveredCorner만 계산
const handlePosition = useMemo(() => {
  if (!hoveredCorner) return null;

  const offset = getOffset(currentRadius);

  // Math.round로 서브픽셀 방지
  switch (hoveredCorner) {
    case 'topLeft':
      return { x: Math.round(offset), y: Math.round(offset) };
    case 'topRight':
      return { x: Math.round(boundsWidth - offset), y: Math.round(offset) };
    // ...
  }
}, [hoveredCorner, boundsWidth, boundsHeight, currentRadius, zoom]);
```

#### 테마 색상 props 전달
```typescript
// ❌ 핸들 내부에서 훅 호출 (매 렌더마다 호출)
const BorderRadiusHandle = () => {
  const colors = useThemeColors();
  ...
}

// ✅ SelectionLayer에서 한 번만 호출하고 props로 전달
const SelectionLayer = () => {
  const colors = useThemeColors();
  return <BorderRadiusHandles handleColor={colors.primary} ... />;
}
```

#### hitArea 확장 (BorderRadiusHandle)
```typescript
// ⚡ 클릭 영역을 핸들 크기보다 크게 설정
const hitArea = useMemo(() => {
  const hitRadius = (BORDER_RADIUS_HANDLE_SIZE + 4) / zoom;
  return new Circle(0, 0, hitRadius);
}, [zoom]);

<pixiGraphics hitArea={hitArea} ... />
```

#### Store selector 최소화 (SelectionLayer)
```typescript
// ⚡ 단일 selector + useCallback으로 불필요한 리렌더링 방지
const selectedId = useStore((state) => state.selectedElementId);
const bounds = selectionBoundsRef.current;

const borderRadius = useStore(
  useCallback((state) => {
    if (!selectedId) return 0;
    const el = state.elementsMap.get(selectedId);
    return parseBorderRadius(el?.props?.style?.borderRadius, bounds);
  }, [selectedId, bounds])
);
```

#### 핸들 렌더링 (BorderRadiusHandles)
```typescript
// hover된 코너만 렌더링 (조건부 렌더링)
if (!hoveredCorner) return null;

return <BorderRadiusHandle corner={hoveredCorner} ... />;
```

#### 인스펙터 패널
```typescript
// useDeferredValue로 Long Task 감소
export const useDebouncedBorderRadius = () => {
  const currentRadius = useBorderRadiusValue();
  return useDeferredValue(currentRadius);
};
```

---

## 5. 구현 순서

### Step 1: borderRadiusTypes.ts
- CornerPosition 타입
- 상수 정의 (CORNER_HOVER_DISTANCE, BORDER_RADIUS_HANDLE_SIZE, HOVER_DEBOUNCE_MS 등)
- 유틸리티 함수 (findNearestCorner, calculateDiagonalDistance)

```typescript
/** ⚡ Hover 디바운스 시간 (ms) - 깜빡임 방지 */
export const HOVER_DEBOUNCE_MS = 30;
```

### Step 2: useBorderRadiusDragPixi.ts
- ⚡ **useRAFThrottle 훅** (useDragInteraction 패턴)
- ref 기반 드래그 상태 관리
- ⚡ **RAF + 시간 기반 이중 스로틀링**
- Pixi pointer 이벤트(`pointermove`, `pointerup`, `pointerupoutside`) 기반 처리
- `stage`/`selectionContainer`를 인자로 받아 로컬 좌표 계산
- `pointerId` 추적으로 멀티 포인터 입력 무시
- ⚡ **cleanup 함수 패턴** - 순환 참조 방지, 리스너 일괄 정리
- ⚡ **ESC 키 취소 처리** + `preventDefault()` + onDragCancel 콜백
- ⚡ **cancelUpdate** - 드래그 종료/취소 시 pending RAF 정리
- onDragUpdate/onDragEnd 콜백으로 radius + shiftKey 전달

### Step 3: BorderRadiusHandle.tsx
- PixiJS Graphics로 원형 핸들 렌더링
- zoom 독립적 크기
- eventMode="static"
- 모든 콜백 useCallback 래핑
- ⚡ **hitArea 확장** (`Circle(0, 0, hitRadius)`) - 클릭 성공률 개선
- ⚡ **handleColor props** - 테마 색상을 부모에서 전달 (훅 호출 방지)

### Step 4: BorderRadiusHandles.tsx
- hoveredCorner에 해당하는 핸들만 렌더링 (조건부 렌더링)
- ⚡ **단일 코너만 계산** - 4개 모두 계산하지 않음
- ⚡ **Math.round로 서브픽셀 방지**
- handleColor props를 자식에게 전달

### Step 5: SelectionBox.tsx 수정
- onPointerMove로 마우스 위치 추적
- findNearestCorner로 hover 코너 감지
- ⚡ **값 변경 시에만 state 업데이트** (불필요한 리렌더링 방지)
- ⚡ **Hover debounce** (30ms) - 깜빡임 방지
- BorderRadiusHandles 렌더링
- selection 컨테이너 `eventMode="static"` + `hitArea` 확장

```typescript
// ⚡ 퍼포먼스 최적화: ref로 이전 값 추적 + debounce
const hoveredCornerRef = useRef<CornerPosition | null>(null);
const hoverDebounceRef = useRef<NodeJS.Timeout | null>(null);
const [hoveredCorner, setHoveredCorner] = useState<CornerPosition | null>(null);

const handlePointerMove = useCallback((e: FederatedPointerEvent) => {
  if (!showHandles) return;

  const local = e.getLocalPosition(e.currentTarget);
  const corner = findNearestCorner(local.x, local.y, width, height, zoom);

  // 값이 변경된 경우에만 처리
  if (corner !== hoveredCornerRef.current) {
    // pending debounce 취소
    if (hoverDebounceRef.current) {
      clearTimeout(hoverDebounceRef.current);
    }

    if (corner === null) {
      // ⚡ 코너 벗어날 때는 30ms 딜레이 (깜빡임 방지)
      hoverDebounceRef.current = setTimeout(() => {
        hoveredCornerRef.current = null;
        setHoveredCorner(null);
      }, HOVER_DEBOUNCE_MS);
    } else {
      // 코너 진입은 즉시
      hoveredCornerRef.current = corner;
      setHoveredCorner(corner);
    }
  }
}, [showHandles, width, height, zoom]);

const handlePointerLeave = useCallback(() => {
  // pending debounce 취소
  if (hoverDebounceRef.current) {
    clearTimeout(hoverDebounceRef.current);
  }
  if (hoveredCornerRef.current !== null) {
    hoveredCornerRef.current = null;
    setHoveredCorner(null);
  }
}, []);

// cleanup
useEffect(() => {
  return () => {
    if (hoverDebounceRef.current) {
      clearTimeout(hoverDebounceRef.current);
    }
  };
}, []);
```

### Step 6: SelectionLayer.tsx 수정
- 선택된 요소의 borderRadius 값 구독
- ⚡ **Store selector 최소화** - 단일 selector + useCallback
- ⚡ **useThemeColors** 훅 호출 → handleColor props로 전달
- onDragStart, onDragUpdate, onDragEnd, ⚡ **onDragCancel** 콜백 연결
- onDragUpdate는 preview 업데이트, onDragEnd는 최종 저장 + 히스토리 1회 기록, onDragCancel은 원복 처리
- ⚡ **useDeferredValue**로 인스펙터 업데이트 분리 (선택적)

```typescript
// ⚡ SelectionLayer에서 테마 색상 + Store selector 최소화
import { useThemeColors } from '../hooks/useThemeColors';

const SelectionLayer = () => {
  // 테마 색상 한 번만 호출
  const colors = useThemeColors();
  const selectedId = useStore((state) => state.selectedElementId);
  const bounds = selectionBoundsRef.current;

  // 단일 selector + useCallback
  const borderRadius = useStore(
    useCallback((state) => {
      if (!selectedId) return 0;
      const el = state.elementsMap.get(selectedId);
      return parseBorderRadius(el?.props?.style?.borderRadius, bounds);
    }, [selectedId, bounds])
  );

  return (
    <BorderRadiusHandles
      handleColor={colors.primary}
      currentRadius={borderRadius}
      ...
    />
  );
};
```

---

## 6. 테스트 체크리스트

### 기능 테스트
- [ ] 단일 요소 선택 시 모서리 근처 hover에서 핸들 표시
- [ ] 다중 선택 시 핸들 숨김
- [ ] 대각선 드래그로 borderRadius 조절
- [ ] Shift+드래그로 4개 모서리 동시 조절
- [ ] 드래그 중 Shift 토글 시 즉시 반영
- [ ] 줌 레벨 변경 시 핸들 크기 일정
- [ ] ESC 키로 드래그 취소 (원래 값 복원)
- [ ] ESC 취소 시 다른 ESC 동작(모달 닫기 등) 방지됨 (preventDefault)
- [ ] pointerupoutside에서도 드래그 종료 처리
- [ ] 최대 radius 제한 (요소 크기의 절반)
- [ ] `%` 값은 drag start에서 px로 정규화되고, drag end에 px로 저장됨
- [ ] 드래그 1회당 히스토리 1개만 기록
- [ ] 드래그 중 DB save/히스토리 기록이 발생하지 않음
- [ ] stage/selectionContainer 준비 전 핸들 미렌더링
- [ ] 컴포넌트 언마운트 시 리스너 정리 (메모리 누수 없음)

### 성능 테스트
- [ ] 드래그 중 60fps 유지
- [ ] hover 시 깜빡임 없음 (debounce 동작)
- [ ] 빠른 마우스 이동에도 핸들 안정적 표시
- [ ] 드래그 종료 후 불필요한 콜백 없음 (cancelUpdate 동작)
- [ ] 테마 변경 시 핸들 색상 즉시 반영
- [ ] hitArea 확장으로 작은 핸들도 클릭 용이
- [ ] Store 변경 시 불필요한 리렌더링 없음 (React DevTools 확인)

---

## 7. 참조 파일

| 파일 | 역할 |
|------|------|
| `overlay/hooks/useBorderRadiusDrag.ts` | 기존 iframe용 드래그 로직 (참조) |
| `selection/TransformHandle.tsx` | PixiJS 핸들 렌더링 패턴 |
| `selection/useDragInteraction.ts` | 드래그 최적화 패턴 |
| `selection/types.ts` | 타입/상수 정의 패턴 |
| `docs/performance/13-webgl-canvas-optimization-final.md` | 성능 최적화 지침 |
