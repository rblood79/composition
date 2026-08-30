/**
 * ResponsiveSection — breakpoint override 관리 허브 (ADR-154 개정 1)
 *
 * 개정 모델: 편집은 어느 breakpoint 에서든 기본 base(전역)다. breakpoint 전용 override 는
 * **이 섹션에서 명시적으로 opt-in** 한다 — eligible(Layout·Transform) 속성을 "Add override"
 * 로 추가하면 현재 값이 해당 tier override 로 복사되고, 이후 그 속성 편집이 override 로
 * 라우팅된다(store `setResponsiveStyleOverrideEnabled` + `shouldWriteBreakpointOverride`).
 *
 * 배경·border·radius·typography 등 non-eligible 속성은 항상 전역이라 여기 노출되지 않는다.
 * desktop = base 이므로 override 관리는 tablet/mobile 에서만. override 존재 판정은 raw
 * `element.responsive`(useResponsiveOverrides) — 병합 map 재판정 금지.
 *
 * UI 편차 주기(2026-07-23): 브레인스토밍 스케치는 per-property 토글 dot 이었으나, Layout/
 * Transform 섹션 입력이 이질적(fieldset/grid/unit-input 혼재)이라 per-row dot 은 침습적이고
 * 일관성이 낮다. override 를 이 단일 섹션에 집약(picker + chip)하는 편이 명료·유지보수 유리.
 */

import { memo, useCallback, useMemo } from "react";
import { X } from "lucide-react";
import type { BreakpointName, ResponsiveVisibility } from "@composition/shared";
import { PropertySection } from "../../../components";
import {
  useUpdateResponsiveVisibility,
  useSetResponsiveStyleOverrideEnabled,
} from "../../../stores";
import { ResponsiveVisibilityEditor } from "../../properties/editors/ResponsiveVisibilityEditor";
import { useResponsiveOverrides } from "../hooks/useResponsiveOverrides";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../../i18n";

const BP_LABEL: Record<BreakpointName, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

/**
 * "Add override" picker 가 제공하는 주요 eligible 속성 (shorthand 형태 + 대표 transform).
 * `longhands` 는 override 존재/제거 판정용 — shorthand 는 store longhand 로 분배 저장되므로
 * (ADR-909) longhand 중 하나라도 있으면 active. eligibility SSOT 는
 * `RESPONSIVE_ELIGIBLE_STYLE_PROPS`(shared) — 이 목록은 그 부분집합(대표 UI 노출).
 */
const PRIMARY_ELIGIBLE: {
  key: string;
  label: string;
  longhands: string[];
}[] = [
  { key: "width", label: "Width", longhands: ["width"] },
  { key: "height", label: "Height", longhands: ["height"] },
  { key: "minWidth", label: "Min Width", longhands: ["minWidth"] },
  { key: "maxWidth", label: "Max Width", longhands: ["maxWidth"] },
  { key: "minHeight", label: "Min Height", longhands: ["minHeight"] },
  { key: "maxHeight", label: "Max Height", longhands: ["maxHeight"] },
  { key: "display", label: "Display", longhands: ["display"] },
  { key: "flexDirection", label: "Direction", longhands: ["flexDirection"] },
  { key: "justifyContent", label: "Justify", longhands: ["justifyContent"] },
  { key: "alignItems", label: "Align", longhands: ["alignItems"] },
  { key: "gap", label: "Gap", longhands: ["rowGap", "columnGap"] },
  {
    key: "padding",
    label: "Padding",
    longhands: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"],
  },
  {
    key: "margin",
    label: "Margin",
    longhands: ["marginTop", "marginRight", "marginBottom", "marginLeft"],
  },
];

const PRIMARY_COVERED_KEYS = new Set(
  PRIMARY_ELIGIBLE.flatMap((p) => p.longhands),
);

/** camelCase style prop → 읽기 좋은 라벨 (picker 미포함 override 표시용) */
function formatPropLabel(prop: string): string {
  return prop
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export const ResponsiveSection = memo(function ResponsiveSection() {
  const i18n = useOptionalI18n();
  const localize = (label: string) =>
    i18n
      ? translateKey(i18n.t, semanticLabelKeys[label] ?? label, label)
      : label;
  /** 패널 자체 문구 — provider 밖(격리 렌더)이면 키를 그대로 돌려준다. */
  const t = (
    key: string,
    params?: Record<string, string | number | boolean>,
  ) => (i18n ? i18n.t(`styles.${key}`, params) : key);
  const {
    activeBreakpoint,
    isBase,
    activeOverriddenProps,
    visibility,
    baseHidden,
  } = useResponsiveOverrides();

  const setOverrideEnabled = useSetResponsiveStyleOverrideEnabled();
  const updateResponsiveVisibility = useUpdateResponsiveVisibility();

  const overriddenSet = useMemo(
    () => new Set(activeOverriddenProps),
    [activeOverriddenProps],
  );

  // active(=override 존재) 여부는 longhand 기준. shorthand 는 longhand 중 하나라도 있으면 active.
  const activePrimaries = useMemo(
    () =>
      PRIMARY_ELIGIBLE.filter((p) =>
        p.longhands.some((lh) => overriddenSet.has(lh)),
      ),
    [overriddenSet],
  );

  const availableToAdd = useMemo(
    () =>
      PRIMARY_ELIGIBLE.filter(
        (p) => !p.longhands.some((lh) => overriddenSet.has(lh)),
      ),
    [overriddenSet],
  );

  // picker 목록(shorthand)으로 그룹화되지 않는 잔여 override 키(예: flexGrow/aspectRatio) —
  // 정확성을 위해 raw chip 으로 노출(제거 가능).
  const uncoveredOverrides = useMemo(
    () => activeOverriddenProps.filter((k) => !PRIMARY_COVERED_KEYS.has(k)),
    [activeOverriddenProps],
  );

  const activeOverrideCount =
    activePrimaries.length + uncoveredOverrides.length;

  const handleAddOverride = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const key = e.target.value;
      if (!key) return;
      setOverrideEnabled(key, true);
      e.target.value = ""; // reset picker to placeholder
    },
    [setOverrideEnabled],
  );

  const handleRemoveOverride = useCallback(
    (key: string) => {
      setOverrideEnabled(key, false);
    },
    [setOverrideEnabled],
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

  return (
    <PropertySection title="Responsive">
      <div className="responsive-section">
        {isBase ? (
          <p className="responsive-hint">{t("responsiveGlobalHint")}</p>
        ) : (
          <div className="responsive-overrides">
            <div className="responsive-overrides-header">
              {BP_LABEL[activeBreakpoint]} overrides
            </div>

            {activeOverrideCount === 0 ? (
              <p className="responsive-hint">
                {t("responsiveNoOverrides", {
                  breakpoint: BP_LABEL[activeBreakpoint],
                })}
              </p>
            ) : (
              <div className="responsive-chips">
                {activePrimaries.map((p) => (
                  <span key={p.key} className="responsive-chip">
                    <span className="responsive-chip-label">{p.label}</span>
                    <button
                      type="button"
                      className="responsive-chip-clear"
                      onClick={() => handleRemoveOverride(p.key)}
                      aria-label={`Remove ${localize(p.label)} override`}
                      title={`${localize(p.label)} ${t("restoreGlobally")}`}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
                {uncoveredOverrides.map((key) => (
                  <span key={key} className="responsive-chip">
                    <span className="responsive-chip-label">
                      {formatPropLabel(key)}
                    </span>
                    <button
                      type="button"
                      className="responsive-chip-clear"
                      onClick={() => handleRemoveOverride(key)}
                      aria-label={`Remove ${localize(formatPropLabel(key))} override`}
                      title={`${localize(formatPropLabel(key))} ${t("restoreGlobally")}`}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {availableToAdd.length > 0 && (
              <select
                className="control-button"
                data-variant="add"
                value=""
                onChange={handleAddOverride}
                aria-label={`Add ${BP_LABEL[activeBreakpoint]} override`}
              >
                <option value="">{localize("+ Add override…")}</option>
                {availableToAdd.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <ResponsiveVisibilityEditor
          visibility={editorVisibility}
          onChange={handleVisibilityChange}
          lockedBreakpoints={["desktop"]}
          title={localize("Visibility")}
        />
      </div>
    </PropertySection>
  );
});
