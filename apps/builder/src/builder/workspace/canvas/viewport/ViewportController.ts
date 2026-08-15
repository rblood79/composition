/**
 * ViewportController
 *
 * 🚀 Phase 12 B3.2: PixiJS Container 직접 조작으로 React 리렌더 최소화
 *
 * 기능:
 * - 드래그/줌 중 PixiJS Container 직접 조작
 * - 인터랙션 종료 시 React state 동기화
 * - 관성 스크롤 (Phase 3에서 추가)
 *
 * @since 2025-12-12 Phase 12 B3.2
 */

import { viewportState } from "./viewportState";
import { recordViewportInteractionListenerFanout } from "./viewportInteractionMetrics";
import {
  publishViewportPresentation,
  resetViewportPresentation,
} from "./viewportPresentation";

/** PixiJS Container에서 필요한 최소 인터페이스 */
interface PixiContainerLike {
  x: number;
  y: number;
  scale: { set(value: number): void; x: number };
  label?: string;
  position?: { x: number; y: number };
  parent?: unknown;
}

// ============================================
// Types
// ============================================

export interface ViewportState {
  x: number;
  y: number;
  scale: number;
}

export interface ViewportControllerOptions {
  /** 최소 줌 */
  minZoom?: number;
  /** 최대 줌 */
  maxZoom?: number;
  /** 상태 동기화 콜백 (인터랙션 종료 시 호출) */
  onStateSync?: (state: ViewportState) => void;
}

// ============================================
// ViewportController Class
// ============================================

/**
 * PixiJS Container를 직접 조작하는 뷰포트 컨트롤러
 *
 * React state 업데이트 없이 Container의 x, y, scale을 직접 조작하여
 * 드래그/줌 중 React 리렌더를 방지합니다.
 */
export class ViewportController {
  private container: PixiContainerLike | null = null;
  private options: Required<ViewportControllerOptions>;

  // 현재 상태 (Container에서 동기화)
  private currentState: ViewportState = { x: 0, y: 0, scale: 1 };

  // 드래그 상태
  private isPanning = false;
  private lastPanPoint: { x: number; y: number } | null = null;

  // currentState 가 실제 뷰포트를 반영하는지 (아래 hasLiveState 참조)
  private stateIsLive = false;

  // 외부 리스너 (스크롤바 등이 pan/zoom 중 실시간 추적)
  private updateListeners: Set<(state: ViewportState) => void> = new Set();

  constructor(options: ViewportControllerOptions = {}) {
    this.options = {
      minZoom: options.minZoom ?? 0.1,
      maxZoom: options.maxZoom ?? 5,
      onStateSync: options.onStateSync ?? (() => {}),
    };
  }

  // ============================================
  // Container 연결
  // ============================================

  /**
   * PixiJS Container 연결
   */
  attach(container: PixiContainerLike): void {
    this.container = container;
    // 현재 Container 상태로 동기화
    this.currentState = {
      x: container.x,
      y: container.y,
      scale: container.scale.x,
    };
    this.stateIsLive = true;
    publishViewportPresentation(this.currentState);
  }

  /**
   * Container 연결 해제
   */
  detach(): void {
    this.container = null;
  }

  /**
   * Container 연결 여부
   *
   * **주의**: ADR-900 으로 PixiJS 가 제거돼 `attach()` 호출부가 없다 — 실전에서
   * 항상 false 다. "컨트롤러를 써도 되는가" 판정에는 `hasLiveState()` 를 쓸 것.
   */
  isAttached(): boolean {
    return this.container !== null;
  }

  /**
   * `currentState` 가 실제 뷰포트를 반영하는가.
   *
   * **Why (2026-08-15)**: 구 소비자들은 이 판정을 `isAttached()` 로 했는데, 그건
   * PixiJS Container 연결 여부라 ADR-900 이후 **항상 false** 다. 그 결과:
   * - 스크롤바가 컨트롤러의 실시간 상태 대신 React mirror 를 읽어 pan 중 위치가
   *   갱신되지 않았다 (mirror 는 `endPan()` 에서만 동기화)
   * - `panToPage` 와 workflow pan 은 early return 으로 **완전한 no-op** 이었다
   *
   * 컨트롤러의 `currentState` 는 Container 유무와 무관하게 pan/zoom/setPosition
   * 에서 갱신되므로, 한 번이라도 갱신됐다면 그 값이 정본이다.
   */
  hasLiveState(): boolean {
    return this.stateIsLive;
  }

  /**
   * onStateSync 콜백 업데이트 (싱글톤에서 지연 설정용)
   */
  setOnStateSync(callback: (state: ViewportState) => void): void {
    this.options.onStateSync = callback;
  }

  // ============================================
  // 직접 조작 API
  // ============================================

  /**
   * 팬 시작
   */
  startPan(clientX: number, clientY: number): void {
    this.isPanning = true;
    this.lastPanPoint = { x: clientX, y: clientY };
  }

  /**
   * 팬 업데이트 (드래그 중 호출)
   * React state 업데이트 없이 Container 직접 조작
   */
  updatePan(clientX: number, clientY: number): void {
    if (!this.isPanning || !this.lastPanPoint) return;

    const deltaX = clientX - this.lastPanPoint.x;
    const deltaY = clientY - this.lastPanPoint.y;

    // Container 직접 조작 (PixiJS 경로)
    if (this.container) {
      this.container.x += deltaX;
      this.container.y += deltaY;
    }

    // 내부 상태 업데이트
    this.currentState.x += deltaX;
    this.currentState.y += deltaY;

    this.lastPanPoint = { x: clientX, y: clientY };

    this.notifyUpdateListeners();
  }

  /**
   * 팬 종료 → React state 동기화
   */
  endPan(): void {
    if (!this.isPanning) return;

    this.isPanning = false;
    this.lastPanPoint = null;

    // React state로 동기화
    this.syncToReactState();
  }

  /**
   * 특정 위치 중심으로 줌
   * @param clientX 마우스 X 좌표 (화면 기준)
   * @param clientY 마우스 Y 좌표 (화면 기준)
   * @param containerRect 컨테이너의 bounding rect
   * @param delta 줌 변화량 (양수: 줌인, 음수: 줌아웃)
   * @param syncImmediately true면 즉시 React state 동기화
   */
  zoomAtPoint(
    clientX: number,
    clientY: number,
    containerRect: DOMRect,
    delta: number,
    syncImmediately = true,
  ): void {
    const { minZoom, maxZoom } = this.options;

    // 컨테이너 내 상대 좌표
    const relativeX = clientX - containerRect.left;
    const relativeY = clientY - containerRect.top;

    // 현재 스케일
    const currentScale = this.currentState.scale;

    // 새 스케일 계산 (클램핑)
    const newScale = Math.min(
      Math.max(currentScale * (1 + delta), minZoom),
      maxZoom,
    );

    if (newScale === currentScale) return;

    // 줌 비율
    const zoomRatio = newScale / currentScale;

    // 커서 위치 유지를 위한 새 팬 오프셋
    const newX = relativeX - (relativeX - this.currentState.x) * zoomRatio;
    const newY = relativeY - (relativeY - this.currentState.y) * zoomRatio;

    // Container 직접 조작 (PixiJS 경로)
    if (this.container) {
      this.container.x = newX;
      this.container.y = newY;
      this.container.scale.set(newScale);
    }

    // 내부 상태 업데이트
    this.currentState = { x: newX, y: newY, scale: newScale };

    this.notifyUpdateListeners();

    // 즉시 동기화 (휠 줌은 즉시 동기화)
    if (syncImmediately) {
      this.syncToReactState();
    }
  }

  /**
   * 절대 위치/스케일 설정 (외부에서 React state가 변경될 때)
   */
  setPosition(x: number, y: number, scale: number): boolean {
    if (
      this.currentState.x === x &&
      this.currentState.y === y &&
      this.currentState.scale === scale
    ) {
      return false;
    }

    // Container 직접 조작 (PixiJS 경로)
    if (this.container) {
      this.container.x = x;
      this.container.y = y;
      this.container.scale.set(scale);
    }

    this.currentState = { x, y, scale };

    this.notifyUpdateListeners();
    return true;
  }

  /** Viewport interaction session이 사용하는 zoom clamp 경계 */
  clampZoom(scale: number): number {
    return Math.min(
      Math.max(scale, this.options.minZoom),
      this.options.maxZoom,
    );
  }

  /**
   * 현재 상태 가져오기
   */
  getState(): ViewportState {
    return { ...this.currentState };
  }

  /**
   * 팬 중인지 여부
   */
  isPanningActive(): boolean {
    return this.isPanning;
  }

  // ============================================
  // Update Listeners
  // ============================================

  /**
   * 뷰포트 상태 변경 리스너 등록
   * 스크롤바 등 외부 컴포넌트가 pan/zoom 중 실시간으로 상태를 추적할 수 있게 함
   *
   * @returns cleanup 함수 (리스너 해제)
   */
  addUpdateListener(listener: (state: ViewportState) => void): () => void {
    this.updateListeners.add(listener);
    return () => {
      this.updateListeners.delete(listener);
    };
  }

  // ============================================
  // 내부 메서드
  // ============================================

  /**
   * 모든 등록된 리스너에게 현재 상태 전달
   */
  private notifyUpdateListeners(): void {
    // 상태를 바꾸는 모든 경로(updatePan / zoomAt / setPosition)가 여기를 지난다
    this.stateIsLive = true;
    const state = this.currentState;
    // ADR-100: 뮤터블 ref 동기 갱신 — SkiaCanvas RAF에서 zero-latency 읽기
    viewportState.x = state.x;
    viewportState.y = state.y;
    viewportState.zoom = state.scale;
    publishViewportPresentation(state);
    recordViewportInteractionListenerFanout(this.updateListeners.size);
    for (const listener of this.updateListeners) {
      listener(state);
    }
  }

  /**
   * React state로 동기화
   */
  private syncToReactState(): void {
    this.options.onStateSync(this.currentState);
  }
}

// ============================================
// Singleton Instance (선택적 사용)
// ============================================

let viewportControllerInstance: ViewportController | null = null;

/**
 * ViewportController 싱글톤 인스턴스 가져오기
 */
export function getViewportController(
  options?: ViewportControllerOptions,
): ViewportController {
  if (!viewportControllerInstance) {
    viewportControllerInstance = new ViewportController(options);
  }
  return viewportControllerInstance;
}

/**
 * ViewportController 인스턴스 초기화
 */
export function resetViewportController(): void {
  if (viewportControllerInstance) {
    viewportControllerInstance.detach();
    viewportControllerInstance = null;
  }
  resetViewportPresentation();
}

export default ViewportController;
