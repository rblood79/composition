/**
 * ResponsiveVisibilityEditor
 *
 * Element의 Breakpoint별 가시성을 편집하는 Inspector 에디터.
 * Desktop, Tablet, Mobile에서 요소 표시/숨김 설정.
 */

import { memo, useCallback } from "react";
import { Monitor, Tablet, Smartphone, Eye, EyeOff } from "lucide-react";
import { PropertySection } from "../../../components";
import type {
  ResponsiveVisibility,
  BreakpointName,
} from "../../../../types/builder/responsive.types";
import {
  BREAKPOINTS,
  BREAKPOINT_ORDER,
} from "../../../../types/builder/responsive.types";
import { iconEditProps, iconSmall } from "../../../../utils/ui/uiConstants";
import { useI18n } from "@/i18n";

interface ResponsiveVisibilityEditorProps {
  /** 현재 가시성 설정 */
  visibility: ResponsiveVisibility | undefined;
  /** 변경 콜백 */
  onChange: (visibility: ResponsiveVisibility) => void;
  /** 섹션 제목 */
  title?: string;
  /** 비활성화 */
  disabled?: boolean;
  /**
   * ADR-154: base(desktop)로 lock 할 breakpoint. lock 된 행은 disabled + "Base"
   * 힌트로 표시되고 토글 불가 — desktop 가시성은 base props.style.display 로
   * 제어하므로(responsive.visibility 는 tablet/mobile override 전용) 여기서 편집 금지.
   */
  lockedBreakpoints?: BreakpointName[];
}

/**
 * Breakpoint 아이콘 컴포넌트
 */
function BreakpointIcon({
  breakpoint,
  size = 16,
}: {
  breakpoint: BreakpointName;
  size?: number;
}) {
  switch (breakpoint) {
    case "desktop":
      return <Monitor size={size} />;
    case "tablet":
      return <Tablet size={size} />;
    case "mobile":
      return <Smartphone size={size} />;
    default:
      return null;
  }
}

/**
 * ResponsiveVisibilityEditor Component
 */
export const ResponsiveVisibilityEditor = memo(
  function ResponsiveVisibilityEditor({
    visibility = {},
    onChange,
    title = "Responsive Visibility",
    disabled = false,
    lockedBreakpoints = [],
  }: ResponsiveVisibilityEditorProps) {
    const { t } = useI18n();
    const isLocked = useCallback(
      (bp: BreakpointName) => lockedBreakpoints.includes(bp),
      [lockedBreakpoints],
    );

    // 가시성 토글 핸들러 (lock 된 breakpoint 는 무시)
    const handleToggle = useCallback(
      (breakpoint: BreakpointName) => {
        if (lockedBreakpoints.includes(breakpoint)) return;
        const currentValue = visibility[breakpoint] ?? true; // 기본값은 표시
        onChange({
          ...visibility,
          [breakpoint]: !currentValue,
        });
      },
      [visibility, onChange, lockedBreakpoints],
    );

    // 전체 표시 핸들러 (lock 된 breakpoint 보존)
    const handleShowAll = useCallback(() => {
      const next: ResponsiveVisibility = { ...visibility };
      for (const bp of BREAKPOINT_ORDER) {
        if (!lockedBreakpoints.includes(bp)) next[bp] = true;
      }
      onChange(next);
    }, [visibility, onChange, lockedBreakpoints]);

    // 전체 숨김 핸들러 (lock 된 breakpoint 보존)
    const handleHideAll = useCallback(() => {
      const next: ResponsiveVisibility = { ...visibility };
      for (const bp of BREAKPOINT_ORDER) {
        if (!lockedBreakpoints.includes(bp)) next[bp] = false;
      }
      onChange(next);
    }, [visibility, onChange, lockedBreakpoints]);

    return (
      <PropertySection title={title}>
        <div className="responsive-visibility-editor">
          {/* Breakpoint 토글 버튼들 */}
          <div className="responsive-visibility-buttons">
            {BREAKPOINT_ORDER.map((bp) => {
              const isVisible = visibility[bp] ?? true;
              const config = BREAKPOINTS[bp];
              const locked = isLocked(bp);

              return (
                <button
                  key={bp}
                  type="button"
                  className={`responsive-visibility-btn ${isVisible ? "visible" : "hidden"}${locked ? " locked" : ""}`}
                  onClick={() => handleToggle(bp)}
                  disabled={disabled || locked}
                  title={
                    locked
                      ? t("propertiesPanel.visibilityLockedBase", {
                          breakpoint: config.label,
                        })
                      : `${config.label}: ${isVisible ? "Visible" : "Hidden"} (${config.minWidth}px${config.maxWidth ? `-${config.maxWidth}px` : "+"})`
                  }
                  aria-pressed={isVisible}
                >
                  <BreakpointIcon breakpoint={bp} size={iconEditProps.size} />
                  <span className="responsive-visibility-label">
                    {config.label}
                    {locked && (
                      <span className="responsive-visibility-base">
                        {" "}
                        · Base
                      </span>
                    )}
                  </span>
                  {isVisible ? (
                    <Eye size={iconSmall.size} />
                  ) : (
                    <EyeOff size={iconSmall.size} />
                  )}
                </button>
              );
            })}
          </div>

          {/* 빠른 액션 버튼들 */}
          <div className="responsive-visibility-actions">
            <button
              type="button"
              className="responsive-visibility-action"
              onClick={handleShowAll}
              disabled={disabled}
              title="Show on all breakpoints"
            >
              Show All
            </button>
            <button
              type="button"
              className="responsive-visibility-action"
              onClick={handleHideAll}
              disabled={disabled}
              title="Hide on all breakpoints"
            >
              Hide All
            </button>
          </div>

          {/* 도움말 텍스트 */}
          <p className="responsive-visibility-help">
            Control element visibility at different screen sizes
          </p>
        </div>

        <style>{`
        .responsive-visibility-editor {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }

        .responsive-visibility-buttons {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .responsive-visibility-btn {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--bg-raised);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: var(--text-xs);
        }

        .responsive-visibility-btn:hover:not(:disabled) {
          background: var(--bg-overlay);
        }

        .responsive-visibility-btn.visible {
          border-color: var(--color-success-500, #22c55e);
          background: var(--color-success-50, #f0fdf4);
        }

        .responsive-visibility-btn.hidden {
          border-color: var(--color-error-500, #ef4444);
          background: var(--color-error-50, #fef2f2);
          opacity: 0.7;
        }

        .responsive-visibility-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .responsive-visibility-btn.locked {
          border-color: var(--border);
          background: var(--bg-raised);
          opacity: 0.65;
        }

        .responsive-visibility-base {
          color: var(--fg-muted);
          font-size: var(--text-2xs);
        }

        .responsive-visibility-label {
          flex: 1;
          text-align: left;
        }

        .responsive-visibility-actions {
          display: flex;
          gap: var(--spacing-sm);
        }

        .responsive-visibility-action {
          flex: 1;
          padding: var(--spacing-xs) var(--spacing-sm);
          background: var(--bg-raised);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          cursor: pointer;
          font-size: var(--text-2xs);
          transition: all 0.2s ease;
        }

        .responsive-visibility-action:hover:not(:disabled) {
          background: var(--bg-overlay);
        }

        .responsive-visibility-action:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .responsive-visibility-help {
          font-size: var(--text-2xs);
          color: var(--text-secondary);
          margin: 0;
        }
      `}</style>
      </PropertySection>
    );
  },
);

export default ResponsiveVisibilityEditor;
