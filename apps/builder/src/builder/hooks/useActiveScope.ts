/**
 * useActiveScope Hook
 *
 * 현재 활성 스코프 감지
 * - 패널 포커스 상태
 * - 텍스트 편집 모드
 * - 모달 열림 상태
 * - 캔버스 포커스
 *
 * @since Phase 4 구현 (2025-12-28)
 */

import { useEffect, useState, useCallback } from "react";
import { useStore } from "../stores";
import type { ShortcutScope } from "../types/keyboard";
import type { PanelId } from "../panels/core/types";

// ============================================
// Types
// ============================================

interface ActiveScopeState {
  /** 현재 활성 스코프 */
  scope: ShortcutScope;

  /** 텍스트 편집 중 여부 */
  isTextEditing: boolean;

  /** 모달 열림 여부 */
  isModalOpen: boolean;

  /** 캔버스 포커스 여부 */
  isCanvasFocused: boolean;

  /** 활성 패널 ID */
  activePanel: PanelId | null;
}

// ============================================
// Constants
// ============================================

/** 텍스트 입력 요소 태그 */
const TEXT_INPUT_TAGS = new Set(["INPUT", "TEXTAREA"]);

/**
 * `data-shortcut-scope` 로 선언할 수 있는 스코프.
 * modal / text-editing 은 DOM 상태에서 파생돼야 하므로 선언 대상이 아니다.
 */
const DECLARABLE_SCOPES = new Set<ShortcutScope>([
  "global",
  "canvas-focused",
  "panel:properties",
  "panel:styles",
  "panel:events",
  "panel:navigator",
]);

/** 패널 ID → 스코프 매핑 */
const PANEL_SCOPE_MAP: Partial<Record<PanelId, ShortcutScope>> = {
  properties: "panel:properties",
  styles: "panel:styles",
  events: "panel:events",
  nodes: "panel:navigator",
};

// ============================================
// Helper Functions
// ============================================

/**
 * 요소가 텍스트 입력 가능한 요소인지 확인
 */
function isTextInputElement(element: Element | null): boolean {
  if (!element) return false;

  const el = element as HTMLElement;

  // Input/Textarea 태그
  if (TEXT_INPUT_TAGS.has(el.tagName)) {
    // readonly input은 제외
    if ((el as HTMLInputElement).readOnly) return false;
    return true;
  }

  // contentEditable 요소
  if (el.isContentEditable) return true;

  // data-text-editing 속성
  if (el.closest('[data-text-editing="true"]')) return true;

  return false;
}

/**
 * 모달이 열려있는지 확인
 */
function isModalOpen(): boolean {
  // React Aria의 모달은 role="dialog" aria-modal="true" 속성 사용
  const modal = document.querySelector('[role="dialog"][aria-modal="true"]');
  if (modal) return true;

  // data-overlay-container 확인 (React Aria OverlayContainer)
  const overlay = document.querySelector('[data-overlay-container="true"]');
  if (overlay && overlay.childElementCount > 0) return true;

  return false;
}

/**
 * 조상이 명시한 스코프 (`data-shortcut-scope`) 를 읽는다.
 *
 * 캔버스 위에 떠 있지만 자체 키보드 규약을 갖는 오버레이 (ADR-192 액션 바 등)
 * 는 포커스가 그 안에 있는 동안 캔버스 단축키를 받으면 안 된다 — 예를 들어
 * `canvas-focused` 의 ←/→ 는 형제 재배치라, 툴바 안에서 버튼을 옮기는 화살표
 * 입력이 문서를 바꾼다 (2026-08-27 code-review #2). 오버레이가 자기 스코프를
 * 선언하면 그 값이 캔버스·패널 추론보다 우선한다.
 */
function getDeclaredScope(activeElement: Element | null): ShortcutScope | null {
  const declared = activeElement
    ?.closest("[data-shortcut-scope]")
    ?.getAttribute("data-shortcut-scope");
  return declared && DECLARABLE_SCOPES.has(declared as ShortcutScope)
    ? (declared as ShortcutScope)
    : null;
}

/**
 * 캔버스 컨테이너 셀렉터 정본 — `BuilderCanvas` 루트가 이 속성을 emit 한다.
 * scope 판정과 "캔버스로 포커스 복귀" 가 같은 계약을 읽는다.
 */
export const CANVAS_CONTAINER_SELECTOR = '[data-canvas-container="true"]';

/**
 * 캔버스 컨테이너로 포커스를 되돌린다 — `canvas-focused` scope 복귀점.
 * hook 밖(액션 바 Escape · 옵션 메뉴 닫힘 · 요소 추가 직후)에서 쓴다.
 */
export function focusCanvasContainer(options?: FocusOptions): void {
  document
    .querySelector<HTMLElement>(CANVAS_CONTAINER_SELECTOR)
    ?.focus(options);
}

/**
 * 캔버스가 포커스 상태인지 확인
 */
function isCanvasFocused(activeElement: Element | null): boolean {
  if (!activeElement) return false;

  // data-scope="canvas" 속성 확인
  if (activeElement.getAttribute("data-scope") === "canvas") return true;

  // 캔버스 컨테이너 내부인지 확인
  if (activeElement.closest(CANVAS_CONTAINER_SELECTOR)) return true;

  // 캔버스 영역 클래스 확인 (fallback)
  if (activeElement.closest(".builder-canvas, .canvas-container")) return true;

  return false;
}

/**
 * 패널 영역에 포커스가 있는지 확인
 */
function getActivePanelFromFocus(
  activeElement: Element | null,
): PanelId | null {
  if (!activeElement) return null;

  // data-panel-id 속성으로 패널 확인
  const panelElement = activeElement.closest("[data-panel-id]");
  if (panelElement) {
    const panelId = panelElement.getAttribute("data-panel-id") as PanelId;
    return panelId;
  }

  return null;
}

// ============================================
// Hook
// ============================================

/**
 * 현재 활성 스코프 반환
 *
 * @returns 현재 활성 스코프
 */
export function useActiveScope(): ShortcutScope {
  const state = useActiveScopeState();
  return state.scope;
}

/**
 * 활성 스코프 상태 전체 반환
 *
 * @returns 스코프 상태 객체
 */
export function useActiveScopeState(): ActiveScopeState {
  // 패널 레이아웃에서 활성 패널 가져오기
  const panelWorkspaceLayout = useStore((state) => state.panelWorkspaceLayout);

  const [state, setState] = useState<ActiveScopeState>({
    scope: "global",
    isTextEditing: false,
    isModalOpen: false,
    isCanvasFocused: false,
    activePanel: null,
  });

  // 스코프 결정 로직
  const determineScope = useCallback((): ActiveScopeState => {
    const activeElement = document.activeElement;

    // 1. 모달 열림 상태 확인 (최고 우선순위)
    const modalOpen = isModalOpen();
    if (modalOpen) {
      return {
        scope: "modal",
        isTextEditing: isTextInputElement(activeElement),
        isModalOpen: true,
        isCanvasFocused: false,
        activePanel: null,
      };
    }

    // 2. 텍스트 편집 모드 확인
    const textEditing = isTextInputElement(activeElement);
    if (textEditing) {
      return {
        scope: "text-editing",
        isTextEditing: true,
        isModalOpen: false,
        isCanvasFocused: false,
        activePanel: null,
      };
    }

    // 3. 오버레이가 선언한 스코프 (캔버스·패널 추론보다 우선)
    const declaredScope = getDeclaredScope(activeElement);
    if (declaredScope) {
      return {
        scope: declaredScope,
        isTextEditing: false,
        isModalOpen: false,
        isCanvasFocused: declaredScope === "canvas-focused",
        activePanel: null,
      };
    }

    // 4. 캔버스 포커스 확인
    const canvasFocused = isCanvasFocused(activeElement);
    if (canvasFocused) {
      return {
        scope: "canvas-focused",
        isTextEditing: false,
        isModalOpen: false,
        isCanvasFocused: true,
        activePanel: null,
      };
    }

    // 5. 포커스된 패널 확인
    const focusedPanel = getActivePanelFromFocus(activeElement);
    if (focusedPanel && PANEL_SCOPE_MAP[focusedPanel]) {
      return {
        scope: PANEL_SCOPE_MAP[focusedPanel]!,
        isTextEditing: false,
        isModalOpen: false,
        isCanvasFocused: false,
        activePanel: focusedPanel,
      };
    }

    // 6. 활성 패널 (우측 우선) 확인
    const activeRightPanels =
      panelWorkspaceLayout?.railOrder.right.filter(
        (panelId) => panelWorkspaceLayout.visibility[panelId] === true,
      ) || [];
    const activeLeftPanels =
      panelWorkspaceLayout?.railOrder.left.filter(
        (panelId) => panelWorkspaceLayout.visibility[panelId] === true,
      ) || [];

    // 우측 패널 중 스코프가 있는 첫 번째 패널
    for (const panelId of activeRightPanels) {
      if (PANEL_SCOPE_MAP[panelId]) {
        return {
          scope: PANEL_SCOPE_MAP[panelId]!,
          isTextEditing: false,
          isModalOpen: false,
          isCanvasFocused: false,
          activePanel: panelId,
        };
      }
    }

    // 좌측 패널 중 스코프가 있는 첫 번째 패널
    for (const panelId of activeLeftPanels) {
      if (PANEL_SCOPE_MAP[panelId]) {
        return {
          scope: PANEL_SCOPE_MAP[panelId]!,
          isTextEditing: false,
          isModalOpen: false,
          isCanvasFocused: false,
          activePanel: panelId,
        };
      }
    }

    // 7. 기본값: global
    return {
      scope: "global",
      isTextEditing: false,
      isModalOpen: false,
      isCanvasFocused: false,
      activePanel: null,
    };
  }, [panelWorkspaceLayout]);

  // 포커스 변경 및 DOM 변화 감지
  useEffect(() => {
    const updateScope = () => {
      const newState = determineScope();
      setState((prev) => {
        // 상태가 동일하면 업데이트 안함
        if (
          prev.scope === newState.scope &&
          prev.isTextEditing === newState.isTextEditing &&
          prev.isModalOpen === newState.isModalOpen &&
          prev.isCanvasFocused === newState.isCanvasFocused &&
          prev.activePanel === newState.activePanel
        ) {
          return prev;
        }
        return newState;
      });
    };

    // 초기 상태 설정
    updateScope();

    // 포커스 변경 감지
    document.addEventListener("focusin", updateScope);
    document.addEventListener("focusout", updateScope);

    // DOM 변화 감지 (모달 열림/닫힘)
    const observer = new MutationObserver(updateScope);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-modal", "data-overlay-container"],
    });

    return () => {
      document.removeEventListener("focusin", updateScope);
      document.removeEventListener("focusout", updateScope);
      observer.disconnect();
    };
  }, [determineScope]);

  return state;
}

/**
 * 스코프가 매칭되는지 확인
 *
 * @param targetScope 확인할 스코프 (단일 또는 배열)
 * @param currentScope 현재 활성 스코프
 * @returns 매칭 여부
 */
export function matchesScope(
  // `ShortcutDefinition.scope` 는 `readonly ShortcutScope[]` 라 여기서도 받는다
  targetScope: ShortcutScope | readonly ShortcutScope[],
  currentScope: ShortcutScope,
): boolean {
  // global은 항상 매칭
  if (targetScope === "global") return true;
  if (Array.isArray(targetScope) && targetScope.includes("global")) return true;

  // 배열이면 포함 여부 확인
  if (Array.isArray(targetScope)) {
    return targetScope.includes(currentScope);
  }

  // 단일 스코프 비교
  return targetScope === currentScope;
}

export default useActiveScope;
