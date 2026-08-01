/** 줌 레벨 표시 input + 프리셋 액션 메뉴 (MenuTrigger 패턴) */

import { useCallback, useRef, memo, useState } from "react";
import {
  MenuTrigger,
  Menu,
  MenuItem,
  Button,
  Popover,
} from "react-aria-components";
import { ChevronDown } from "lucide-react";
import { useViewportSyncStore } from "./canvas/stores";
import {
  applyViewportState,
  computeFillViewport,
  computeFitViewport,
  zoomViewportAtContainerCenter,
} from "./canvas/viewport/viewportActions";
import { alignPagesToScreen } from "./canvas/viewport/pageLayoutActions";
import {
  getViewportPresentationSnapshot,
  useViewportPresentationZoom,
} from "./canvas/viewport/viewportPresentation";
import { iconProps } from "../../utils/ui/uiConstants";

// ============================================
// Constants
// ============================================

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.1;

// ============================================
// Types
// ============================================

export interface ZoomControlsProps {
  /** 클래스명 */
  className?: string;
}

// ============================================
// Component
// ============================================

export const ZoomControls = memo(function ZoomControls({
  className,
}: ZoomControlsProps) {
  const zoom = useViewportPresentationZoom();

  const zoomPercent = Math.round(zoom * 100);
  // null = 편집 중 아님, string = 편집 중인 값
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const displayedValue =
    editingValue !== null ? editingValue : `${zoomPercent}%`;
  const anchorRef = useRef<HTMLDivElement>(null);

  // ============================================
  // Zoom Handlers (getState 사용으로 의존성 최소화)
  // ============================================

  const zoomTo = useCallback((level: number) => {
    zoomViewportAtContainerCenter(level);
  }, []);

  const zoomIn = useCallback(() => {
    const currentZoom = getViewportPresentationSnapshot().scale;
    zoomTo(currentZoom + ZOOM_STEP);
  }, [zoomTo]);

  const zoomOut = useCallback(() => {
    const currentZoom = getViewportPresentationSnapshot().scale;
    zoomTo(currentZoom - ZOOM_STEP);
  }, [zoomTo]);

  const zoomToFit = useCallback(() => {
    const state = useViewportSyncStore.getState();
    const { containerSize, canvasSize } = state;

    if (containerSize.width === 0 || containerSize.height === 0) return;

    applyViewportState(computeFitViewport({ canvasSize, containerSize }));
  }, []);

  const zoomToFill = useCallback(() => {
    const state = useViewportSyncStore.getState();
    const { containerSize, canvasSize } = state;

    if (containerSize.width === 0 || containerSize.height === 0) return;

    applyViewportState(computeFillViewport({ canvasSize, containerSize }));
  }, []);

  // ============================================
  // Menu Action Handler
  // ============================================

  const handleAction = useCallback(
    (key: React.Key) => {
      switch (key) {
        case "zoom-in":
          zoomIn();
          break;
        case "zoom-out":
          zoomOut();
          break;
        case "zoom-100":
          zoomTo(1);
          break;
        case "zoom-200":
          zoomTo(2);
          break;
        case "fit-to-screen":
          zoomToFit();
          break;
        case "fill-screen":
          zoomToFill();
          break;
        case "align-pages":
          alignPagesToScreen();
          break;
      }
    },
    [zoomIn, zoomOut, zoomTo, zoomToFit, zoomToFill],
  );

  // ============================================
  // Input Handlers
  // ============================================

  const handleInputBlur = useCallback(() => {
    const numStr = (editingValue ?? "").replace(/%/g, "").trim();
    const num = parseFloat(numStr);
    setEditingValue(null);

    if (isNaN(num) || num < MIN_ZOOM * 100 || num > MAX_ZOOM * 100) {
      return;
    }

    zoomTo(num / 100);
  }, [editingValue, zoomTo]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleInputBlur();
        (e.target as HTMLInputElement).blur();
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setEditingValue(null);
        (e.target as HTMLInputElement).blur();
        return;
      }

      const step = e.shiftKey ? 10 : 1;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const newZoom = Math.min(zoomPercent + step, MAX_ZOOM * 100);
        zoomTo(newZoom / 100);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const newZoom = Math.max(zoomPercent - step, MIN_ZOOM * 100);
        zoomTo(newZoom / 100);
      }
    },
    [handleInputBlur, zoomPercent, zoomTo],
  );

  const handleInputFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setEditingValue(`${zoomPercent}%`);
      e.target.select();
    },
    [zoomPercent],
  );

  // ============================================
  // Render
  // ============================================

  return (
    <div className={`zoom-controls ${className || ""}`}>
      <div ref={anchorRef} className="zoom-trigger-button">
        <input
          className="zoom-input"
          value={displayedValue}
          onChange={(e) => setEditingValue(e.target.value)}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          aria-label="Zoom level"
        />
        <MenuTrigger>
          <Button className="zoom-chevron-button" aria-label="Zoom menu">
            <ChevronDown size={iconProps.size} />
          </Button>
          <Popover
            className="zoom-menu-popover"
            placement="bottom start"
            triggerRef={anchorRef}
          >
            <Menu className="zoom-menu" onAction={handleAction}>
              <MenuItem id="zoom-in" className="zoom-menu-item">
                <span>확대</span>
                <kbd>⌘+</kbd>
              </MenuItem>
              <MenuItem id="zoom-out" className="zoom-menu-item">
                <span>축소</span>
                <kbd>⌘-</kbd>
              </MenuItem>
              <MenuItem id="zoom-100" className="zoom-menu-item">
                <span>100%</span>
                <kbd>⌘1</kbd>
              </MenuItem>
              <MenuItem id="zoom-200" className="zoom-menu-item">
                <span>200%</span>
                <kbd>⌘2</kbd>
              </MenuItem>
              <MenuItem id="fit-to-screen" className="zoom-menu-item">
                <span>화면에 맞추기</span>
                <kbd>⌘0</kbd>
              </MenuItem>
              <MenuItem id="fill-screen" className="zoom-menu-item">
                <span>화면 채우기</span>
              </MenuItem>
              <MenuItem id="align-pages" className="zoom-menu-item">
                <span>화면 정렬</span>
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>
    </div>
  );
});

export default ZoomControls;
