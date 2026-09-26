/**
 * ResponsiveSection — breakpoint override 관리 허브 (ADR-154 개정 1)
 *
 * 개정 모델: 편집은 어느 breakpoint 에서든 기본 base(전역)다. breakpoint 전용 override 는
 * **이 섹션에서 명시적으로 opt-in** 한다 — eligible(Layout·Transform) 속성을 헤더 「+」 메뉴로
 * 추가하면 현재 값이 해당 tier override 로 복사되고, 이후 그 속성 편집이 override 로
 * 라우팅된다(store `setResponsiveStyleOverrideEnabled` + `shouldWriteBreakpointOverride`).
 *
 * 배경·border·radius·typography 등 non-eligible 속성은 항상 전역이라 여기 노출되지 않는다.
 * desktop = base 이므로 override 관리는 tablet/mobile 에서만. override 존재 판정은 raw
 * `element.responsive`(useResponsiveOverrides) — 병합 map 재판정 금지.
 *
 * 시각 어법 (panel-ui 04, 2026-09-14):
 * - Responsive 절: Visibility 는 「🖥 📱 📱」 다중 선택 seg 한 줄 (desktop 은 base 라 잠김 —
 *   base `display` 를 그대로 비춘다). 종전 카드 3장 (각 60) + Show All / Hide All 버튼 + 도움말
 *   (구 ResponsiveVisibilityEditor, 삭제) 은 5탭 중 가장 긴 탭 (794) 의 원인이었다.
 * - Overrides 절 (tablet/mobile 만): 헤더 「tablet · 2」 카운트 + 「+」 메뉴 (추가할 속성 고르기),
 *   행은 다른 절과 같은 lrow 「width · 100%」 + 28 열 × (override 해제). 종전 chip + select.
 *
 * UI 편차 주기(2026-07-23): 브레인스토밍 스케치는 per-property 토글 dot 이었으나, Layout/
 * Transform 섹션 입력이 이질적(fieldset/grid/unit-input 혼재)이라 per-row dot 은 침습적이고
 * 일관성이 낮다. override 를 이 단일 섹션에 집약하는 편이 명료·유지보수 유리.
 */

import { memo, useCallback, useMemo } from "react";
import type { Key } from "react-aria-components/Collection";
import { Monitor, Smartphone, Tablet, X } from "lucide-react";
import { camelToKebab, type BreakpointName } from "@composition/shared";
import {
  ToggleButton,
  ToggleButtonGroup,
} from "@composition/shared/components";
import { PropertyRowMenu, PropertySection } from "../../../components";
import { SwatchIconButton } from "../../../components/ui";
import { ACTION_ICONS } from "../../../config/actionIcons";
import {
  useStore,
  useUpdateResponsiveVisibility,
  useSetResponsiveStyleOverrideEnabled,
} from "../../../stores";
import { useElementStyleContext } from "../hooks/useElementStyleContext";
import { resolveDirectionDrivenProp } from "../utils/orientationDrivenTags";
import { resolveTierSeedDefaults } from "../utils/tierSeedDefaults";
import { BREAKPOINT_ORDER } from "../../../../types/builder/responsive.types";
import { iconProps, iconSmall } from "../../../../utils/ui/uiConstants";
import { useResponsiveOverrides } from "../hooks/useResponsiveOverrides";
import { camelToLabel } from "../utils/styleValueHelpers";
import { useOptionalI18n, useSemanticLabel } from "../../../../i18n";

const BP_LABEL: Record<BreakpointName, string> = {
  desktop: "Desktop",
  tablet: "Tablet",
  mobile: "Mobile",
};

const BP_ICON: Record<BreakpointName, typeof Monitor> = {
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
};

const AddIcon = ACTION_ICONS.add;

/**
 * "Add override" 메뉴가 제공하는 주요 eligible 속성 (shorthand 형태 + 대표 transform).
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

/**
 * 「+」 메뉴가 추가할 수 있는 override 키 — 이미 켠 속성은 빼고, 라벨 위치 · orientation 으로 방향이
 * 정해지는 요소 (orientationDrivenTags) 는 Direction 도 뺀다. 그 요소의 방향 정본은 tier 축이 없는 prop
 * 이라, tier flexDirection 은 켜는 순간 seed 기본값 (row) 으로 라벨을 옆으로 옮기고 이후 Direction 토글
 * (전역 prop) 이 그 tier 에 닿지 않았다. 이미 있는 tier 값은 아래 행에서 지울 수 있다.
 */
export function addableOverrideKeys(
  overridden: ReadonlySet<string>,
  directionDriven: boolean,
): string[] {
  return PRIMARY_ELIGIBLE.filter(
    (p) =>
      !(directionDriven && p.key === "flexDirection") &&
      !p.longhands.some((lh) => overridden.has(lh)),
  ).map((p) => p.key);
}

const PRIMARY_COVERED_KEYS = new Set(
  PRIMARY_ELIGIBLE.flatMap((p) => p.longhands),
);

/**
 * 행에 보일 override 값 — longhand 값이 전부 같으면 하나, 다르면 순서대로 공백 join
 * (padding 「8px 16px 8px 16px」). 값이 없는 longhand 는 건너뛴다.
 */
function describeOverrideValue(
  values: Record<string, unknown>,
  longhands: readonly string[],
): string {
  const present = longhands
    .map((lh) => values[lh])
    .filter((v) => v !== undefined && v !== null)
    .map((v) => String(v));
  if (present.length === 0) return "";
  return new Set(present).size === 1 ? present[0]! : present.join(" ");
}

interface OverrideRow {
  readonly key: string;
  readonly label: string;
  readonly name: string;
  readonly value: string;
}

export const ResponsiveSection = memo(function ResponsiveSection() {
  const i18n = useOptionalI18n();
  const localize = useSemanticLabel();
  /** 패널 자체 문구 — provider 밖(격리 렌더)이면 키를 그대로 돌려준다. */
  const t = (
    key: string,
    params?: Record<string, string | number | boolean>,
  ) => (i18n ? i18n.t(`styles.${key}`, params) : key);
  const {
    activeBreakpoint,
    isBase,
    activeOverriddenProps,
    activeOverrideValues,
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
  // 메뉴 목록(shorthand)으로 그룹화되지 않는 잔여 override 키(예: flexGrow/aspectRatio) 도
  // 정확성을 위해 행으로 노출(제거 가능).
  const overrideRows = useMemo<OverrideRow[]>(() => {
    const primaries = PRIMARY_ELIGIBLE.filter((p) =>
      p.longhands.some((lh) => overriddenSet.has(lh)),
    ).map((p) => ({
      key: p.key,
      label: p.label,
      name: camelToKebab(p.key),
      value: describeOverrideValue(activeOverrideValues, p.longhands),
    }));
    const uncovered = activeOverriddenProps
      .filter((k) => !PRIMARY_COVERED_KEYS.has(k))
      .map((k) => ({
        key: k,
        label: camelToLabel(k),
        name: camelToKebab(k),
        value: describeOverrideValue(activeOverrideValues, [k]),
      }));
    return [...primaries, ...uncovered];
  }, [activeOverriddenProps, activeOverrideValues, overriddenSet]);

  const selectedId = useStore((state) => state.selectedElementId);
  const styleContext = useElementStyleContext(selectedId);
  const directionDriven =
    resolveDirectionDrivenProp(styleContext.type) !== undefined;
  const availableToAdd = useMemo(() => {
    const keys = new Set(addableOverrideKeys(overriddenSet, directionDriven));
    return PRIMARY_ELIGIBLE.filter((p) => keys.has(p.key)).map((p) => ({
      id: p.key,
      label: localize(p.label),
    }));
  }, [overriddenSet, directionDriven, i18n]);

  // 켜는 순간 seed = 그 요소의 현재 값. 인라인 · tier 가 없으면 catalog 기본값 (Canvas 엔진과 같은 해석)
  //   을 넘긴다 — 없으면 액션이 CSS 초기값을 넣어 켜는 순간 모양이 바뀌었다 (ADR-236 후속).
  const handleAddOverride = useCallback(
    (key: string) => {
      setOverrideEnabled(
        key,
        true,
        resolveTierSeedDefaults(styleContext.type, styleContext.size),
      );
    },
    [setOverrideEnabled, styleContext.type, styleContext.size],
  );

  const handleRemoveOverride = useCallback(
    (key: string) => {
      setOverrideEnabled(key, false);
    },
    [setOverrideEnabled],
  );

  // seg 선택 = 보이는 breakpoint. desktop 은 base(display) 파생이라 잠김 (표시만).
  const visibleKeys = useMemo(() => {
    const keys = new Set<Key>();
    if (!baseHidden) keys.add("desktop");
    for (const bp of ["tablet", "mobile"] as const) {
      if (visibility[bp] ?? true) keys.add(bp);
    }
    return keys;
  }, [baseHidden, visibility]);

  const handleVisibilityChange = useCallback(
    (next: Set<Key>) => {
      // desktop 은 lock(base) — tablet/mobile 변경분만 store 에 반영.
      for (const bp of ["tablet", "mobile"] as const) {
        const nextVisible = next.has(bp);
        const curVisible = visibility[bp] ?? true;
        if (nextVisible !== curVisible) {
          updateResponsiveVisibility(bp, nextVisible);
        }
      }
    },
    [visibility, updateResponsiveVisibility],
  );

  const bpLabel = localize(BP_LABEL[activeBreakpoint]);

  // 헤더 「+」 — 추가할 속성을 고르는 메뉴 (전부 추가됐으면 비활성)
  const addOverrideAction = (
    <PropertyRowMenu
      icon={AddIcon}
      label={`Add ${bpLabel} override`}
      items={availableToAdd}
      isDisabled={availableToAdd.length === 0}
      onAction={handleAddOverride}
    />
  );

  return (
    <>
      <PropertySection title="Responsive">
        <div className="responsive-visibility">
          <fieldset className="properties-aria responsive-visibility-seg">
            <legend className="fieldset-legend">
              {localize("Visibility")}
            </legend>
            <ToggleButtonGroup
              aria-label={localize("Visibility")}
              indicator
              selectionMode="multiple"
              selectedKeys={visibleKeys}
              onSelectionChange={handleVisibilityChange}
            >
              {BREAKPOINT_ORDER.map((bp) => {
                const Icon = BP_ICON[bp];
                const locked = bp === "desktop";
                return (
                  <ToggleButton
                    key={bp}
                    id={bp}
                    isDisabled={locked}
                    aria-label={
                      locked
                        ? `${localize(BP_LABEL[bp])} · Base`
                        : localize(BP_LABEL[bp])
                    }
                  >
                    <Icon
                      color={iconProps.color}
                      size={iconProps.size}
                      strokeWidth={iconProps.strokeWidth}
                    />
                  </ToggleButton>
                );
              })}
            </ToggleButtonGroup>
          </fieldset>
        </div>
        {isBase && (
          <p className="responsive-hint">{t("responsiveGlobalHint")}</p>
        )}
      </PropertySection>

      {!isBase && (
        <PropertySection
          title="Overrides"
          className="responsive-overrides"
          badge={
            <span className="responsive-overrides-count">
              {`${bpLabel.toLowerCase()} · ${overrideRows.length}`}
            </span>
          }
          actions={addOverrideAction}
        >
          {overrideRows.length === 0 ? (
            <p className="responsive-hint">
              {t("responsiveNoOverrides", { breakpoint: bpLabel })}
            </p>
          ) : (
            overrideRows.map((row) => (
              <div key={row.key} className="responsive-override-row">
                <div className="responsive-override-row__body">
                  <span className="responsive-override-row__name">
                    {row.name}
                  </span>
                  {row.value && (
                    <>
                      <span
                        className="responsive-override-row__dot"
                        aria-hidden="true"
                      >
                        ·
                      </span>
                      <span className="responsive-override-row__value">
                        {row.value}
                      </span>
                    </>
                  )}
                </div>
                <div className="fieldset-actions actions-icon">
                  <SwatchIconButton
                    onPress={() => handleRemoveOverride(row.key)}
                    aria-label={`Remove ${localize(row.label)} override`}
                  >
                    <X
                      size={iconSmall.size}
                      strokeWidth={iconSmall.strokeWidth}
                    />
                  </SwatchIconButton>
                </div>
              </div>
            ))
          )}
        </PropertySection>
      )}
    </>
  );
});
