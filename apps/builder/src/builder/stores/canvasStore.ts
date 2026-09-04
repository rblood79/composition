/**
 * Canvas Store (Direct Zustand Access)
 *
 * 🚀 Phase 10 B2.4: postMessage 없이 직접 스토어 접근
 *
 * WebGL Canvas는 이 스토어를 통해 Builder 상태에 직접 접근합니다.
 * 기존 iframe + postMessage 패턴을 대체합니다.
 *
 * ⚠️ 그리드 설정은 canvasSettings.ts (Single Source of Truth)에서 관리
 * 이 스토어는 뷰포트/편집 상태만 관리
 *
 * @since 2025-12-11 Phase 10 B2.4
 * @moved 2024-12-29 workspace/canvas/store/ → builder/stores/
 */

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

// ============================================
// Types
// ============================================

interface CanvasState {
  // 캔버스 뷰포트 상태
  zoom: number;
  panX: number;
  panY: number;

  // 편집 상태
  isEditing: boolean;
  editingElementId: string | null;

  // 액션
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  setEditing: (isEditing: boolean, elementId?: string | null) => void;
  resetView: () => void;
}

// ============================================
// Store
// ============================================

export const useCanvasStore = create<CanvasState>()(
  subscribeWithSelector((set) => ({
    // Initial State
    zoom: 1,
    panX: 0,
    panY: 0,
    isEditing: false,
    editingElementId: null,

    // Actions
    setZoom: (zoom) => set({ zoom: Math.max(0.1, Math.min(5, zoom)) }),

    setPan: (x, y) => set({ panX: x, panY: y }),

    setEditing: (isEditing, elementId = null) =>
      set({ isEditing, editingElementId: elementId }),

    resetView: () => set({ zoom: 1, panX: 0, panY: 0 }),
  })),
);

export default useCanvasStore;
