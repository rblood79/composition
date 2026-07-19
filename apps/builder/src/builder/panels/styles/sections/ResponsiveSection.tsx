/**
 * ResponsiveSection — breakpoint override 요약 + 가시성 편집 (ADR-154)
 *
 * 활성 breakpoint 배지 + "어느 필드가 override 인지" 목록(chips) + visibility 편집.
 * desktop = base 이므로 override chip 은 tablet/mobile 에서만 노출된다. 편집은
 * 기존 store 액션 재사용:
 *  - override 제거: `updateSelectedStyle(prop, "")` (활성 breakpoint 기준 clear)
 *  - visibility:   `updateSelectedResponsiveVisibility(bp, visible)` (tablet/mobile)
 */

import { memo, useCallback } from "react";
import { Monitor, Tablet, Smartphone, X } from "lucide-react";
import type { BreakpointName, ResponsiveVisibility } from "@composition/shared";
import { PropertySection } from "../../../components";
import { useStore, useUpdateResponsiveVisibility } from "../../../stores";
import { ResponsiveVisibilityEditor } from "../../properties/editors/ResponsiveVisibilityEditor";
import { useResponsiveOverrides } from "../hooks/useResponsiveOverrides";

const BP_ICON: Record<BreakpointName, typeof Monitor> = {
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
};

const BP_LABEL: Record<BreakpointName, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

/** camelCase style prop → 읽기 좋은 라벨 */
function formatPropLabel(prop: string): string {
  return prop
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export const ResponsiveSection = memo(function ResponsiveSection() {
  const {
    activeBreakpoint,
    isBase,
    activeOverriddenProps,
    activeOverrideCount,
    visibility,
    baseHidden,
  } = useResponsiveOverrides();

  const updateSelectedStyle = useStore((s) => s.updateSelectedStyle);
  const updateResponsiveVisibility = useUpdateResponsiveVisibility();

  const BadgeIcon = BP_ICON[activeBreakpoint];

  const handleClearOverride = useCallback(
    (prop: string) => {
      // 활성 breakpoint(tablet/mobile) 기준으로 override 제거 — updateSelectedStyle
      // 이 get().activeBreakpoint 로 분기하므로 빈 값이 해당 breakpoint 키를 지운다.
      updateSelectedStyle(prop, "");
    },
    [updateSelectedStyle],
  );

  const handleVisibilityChange = useCallback(
    (next: ResponsiveVisibility) => {
      // desktop 은 lock(base) — tablet/mobile 변경분만 store 에 반영.
      for (const bp of ["tablet", "mobile"] as const) {
        const nextVisible = next[bp] ?? true;
        const curVisible = visibility[bp] ?? true;
        if (nextVisible !== curVisible) {
          updateResponsiveVisibility(bp, nextVisible);
        }
      }
    },
    [visibility, updateResponsiveVisibility],
  );

  // 편집기에 넘길 visibility: desktop 은 base(display) 파생, tablet/mobile 은 override.
  const editorVisibility: ResponsiveVisibility = {
    desktop: !baseHidden,
    ...visibility,
  };

  const badge = (
    <span className="responsive-badge" data-breakpoint={activeBreakpoint}>
      <BadgeIcon size={12} />
      <span>{BP_LABEL[activeBreakpoint]}</span>
      {activeOverrideCount > 0 && (
        <span className="responsive-badge-count">{activeOverrideCount}</span>
      )}
    </span>
  );

  return (
    <PropertySection title="Responsive" icon={BadgeIcon} badge={badge}>
      <div className="responsive-section">
        {isBase ? (
          <p className="responsive-hint">
            Desktop 은 기준(base) 입니다. 툴바에서 Tablet / Mobile 로 전환하면
            해당 breakpoint 전용 override 를 추가할 수 있습니다.
          </p>
        ) : (
          <div className="responsive-overrides">
            <div className="responsive-overrides-header">
              {BP_LABEL[activeBreakpoint]} overrides
            </div>
            {activeOverriddenProps.length === 0 ? (
              <p className="responsive-hint">
                아직 override 가 없습니다. 속성을 편집하면{" "}
                {BP_LABEL[activeBreakpoint]} 전용 값이 추가됩니다.
              </p>
            ) : (
              <div className="responsive-chips">
                {activeOverriddenProps.map((prop) => (
                  <span key={prop} className="responsive-chip">
                    <span className="responsive-chip-label">
                      {formatPropLabel(prop)}
                    </span>
                    <button
                      type="button"
                      className="responsive-chip-clear"
                      onClick={() => handleClearOverride(prop)}
                      aria-label={`Clear ${prop} override`}
                      title={`${formatPropLabel(prop)} override 제거`}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <ResponsiveVisibilityEditor
          visibility={editorVisibility}
          onChange={handleVisibilityChange}
          lockedBreakpoints={["desktop"]}
          title="Visibility"
        />
      </div>
    </PropertySection>
  );
});
