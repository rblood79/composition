/**
 * AppearanceSection - Appearance 스타일 편집 섹션
 *
 * Background + Border 편집 (단일 섹션)
 * 접힌 섹션의 훅 실행을 방지하기 위해 내용 컴포넌트 분리.
 * Background 편집은 FillBackgroundInline 단일 경로를 사용한다.
 */

import { memo, lazy, Suspense } from "react";
import {
  PropertySection,
  PropertyUnitInput,
  PropertyColor,
  PropertySelect,
} from "../../../components";
import { SwatchIconButton } from "../../../components/ui";
import { iconProps } from "../../../../utils/ui/uiConstants";
import {
  Square,
  SquareDashed,
  SquareRoundCorner,
  SquareDashedBottom,
  EllipsisVertical,
  Eclipse,
  Scissors,
} from "lucide-react";
import { OVERFLOW_OPTIONS } from "../constants/styleOptions";
import { shadows } from "@composition/specs";
import { useStyleActions } from "../hooks/useStyleActions";
import { useOptimizedStyleActions } from "../hooks/useOptimizedStyleActions";
import { useAppearanceValues } from "../hooks/useAppearanceValues";
import { useResetStyles, useHasDirtyStyles } from "../hooks/useResetStyles";
import { useStore } from "../../../stores";

const LazyFillBackgroundInline = lazy(() =>
  import("./FillSection").then((m) => ({ default: m.FillBackgroundInline })),
);

/** Shadow 프리셋 옵션 */
const SHADOW_PRESET_OPTIONS = [
  { value: "reset", label: "Reset" },
  { value: "none", label: "none" },
  { value: "sm", label: "sm" },
  { value: "md", label: "md" },
  { value: "lg", label: "lg" },
  { value: "xl", label: "xl" },
  { value: "inset", label: "inset" },
];

/** CSS box-shadow 값 → 프리셋 키 역매핑 */
const cssToPresetMap = new Map(
  Object.entries(shadows).map(([key, val]) => [val, key]),
);

function boxShadowToPresetKey(cssValue: string): string {
  if (!cssValue || cssValue === "none") return "none";
  return cssToPresetMap.get(cssValue) ?? cssValue;
}

const AppearanceSectionContent = memo(function AppearanceSectionContent() {
  const { updateStyle } = useStyleActions();
  const { updateStyleImmediate, updateStylePreview } =
    useOptimizedStyleActions();
  const selectedId = useStore((s) => s.selectedElementId);
  const styleValues = useAppearanceValues(selectedId);

  if (!styleValues) return null;

  // Box Shadow: 현재 값이 알려진 프리셋이 아니면(import/paste 된 임의 CSS) 동적 "custom" 항목을
  //   추가해 RAC Select 가 빈 선택으로 표시되지 않게 한다(M4). 알려진 프리셋이면 안정 참조 유지.
  const shadowKey = boxShadowToPresetKey(styleValues.boxShadow);
  const shadowOptions = SHADOW_PRESET_OPTIONS.some((o) => o.value === shadowKey)
    ? SHADOW_PRESET_OPTIONS
    : [...SHADOW_PRESET_OPTIONS, { value: shadowKey, label: "custom" }];

  return (
    <>
      <Suspense fallback={null}>
        <LazyFillBackgroundInline />
      </Suspense>

      {/* Border */}
      <div className="style-border">
        <PropertyColor
          icon={Square}
          label="Color"
          className="border-color"
          value={styleValues.borderColor}
          onChange={(value) => updateStyle("borderColor", value)}
          placeholder="#000000"
        />
        <PropertyUnitInput
          icon={SquareDashed}
          label="Border Width"
          className="border-width"
          value={styleValues.borderWidth}
          units={["reset", "px"]}
          onChange={(value) => updateStyleImmediate("borderWidth", value)}
          onDrag={(value) => updateStylePreview("borderWidth", value)}
          min={0}
          max={100}
        />
        <PropertyUnitInput
          icon={SquareRoundCorner}
          label="Border Radius"
          className="border-radius"
          value={styleValues.borderRadius}
          units={["reset", "px"]}
          onChange={(value) => updateStyleImmediate("borderRadius", value)}
          onDrag={(value) => updateStylePreview("borderRadius", value)}
          min={0}
          max={500}
        />
        <PropertySelect
          icon={SquareDashedBottom}
          label="Border Style"
          className="border-style"
          value={styleValues.borderStyle}
          options={[
            { value: "reset", label: "Reset" },
            { value: "none", label: "none" },
            { value: "solid", label: "solid" },
            { value: "dashed", label: "dashed" },
            { value: "dotted", label: "dotted" },
            { value: "double", label: "double" },
            { value: "groove", label: "groove" },
            { value: "ridge", label: "ridge" },
            { value: "inset", label: "inset" },
            { value: "outset", label: "outset" },
          ]}
          onChange={(value) => updateStyle("borderStyle", value)}
        />
        <div className="fieldset-actions actions-icon">
          <SwatchIconButton aria-label="More border options">
            <EllipsisVertical
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </SwatchIconButton>
        </div>
      </div>

      {/* Box Shadow */}
      <div className="style-shadow">
        <PropertySelect
          icon={Eclipse}
          label="Box Shadow"
          className="box-shadow"
          value={shadowKey}
          options={shadowOptions}
          onChange={(value) => {
            // PropertySelect 가 "reset" → "" 로 변환. Reset("") 은 inline boxShadow
            //   키를 삭제해 baseline("none" 또는 catalog)으로 복귀시킨다 — "none" 을
            //   기록하던 과거 동작은 영구 dirty 원인이었다(M3). "none" 항목은 사용자가
            //   명시적으로 고른 값이므로 그대로 기록.
            if (value === "") {
              updateStyle("boxShadow", "");
            } else if (value === "none") {
              updateStyle("boxShadow", "none");
            } else {
              const cssValue = shadows[value as keyof typeof shadows];
              updateStyle("boxShadow", cssValue ?? value);
            }
          }}
        />
      </div>

      {/* Overflow */}
      <div className="style-overflow">
        <PropertySelect
          icon={Scissors}
          label="Overflow"
          className="overflow"
          value={styleValues.overflow}
          options={OVERFLOW_OPTIONS}
          onChange={(value) => updateStyleImmediate("overflow", value)}
        />
      </div>
    </>
  );
});

/**
 * AppearanceSection - 외부 래퍼 (PropertySection 관리)
 */
const APPEARANCE_PROPS = [
  "backgroundColor",
  "borderColor",
  "borderWidth",
  "borderRadius",
  "borderStyle",
  "boxShadow",
  "overflow",
];

export const AppearanceSection = memo(function AppearanceSection() {
  const resetStyles = useResetStyles();
  const hasDirty = useHasDirtyStyles(APPEARANCE_PROPS);
  const selectedId = useStore((s) => s.selectedElementId);

  const handleReset = () => {
    resetStyles(APPEARANCE_PROPS);
    // fills(배경 canonical SSOT)는 style reset 대상이 아니므로 별도로 비운다. 단, 비어있으면
    //   호출 자체가 스퍼리어스 history entry/mutation 을 만들므로 non-empty 일 때만 실행(M2a).
    const state = useStore.getState();
    const el = selectedId ? state.elementsMap.get(selectedId) : undefined;
    const fills = (el as { fills?: unknown[] } | undefined)?.fills;
    if (Array.isArray(fills) && fills.length > 0) {
      state.updateSelectedFills([]);
    }
  };

  return (
    <PropertySection
      id="appearance"
      title="Appearance"
      onReset={hasDirty ? handleReset : undefined}
    >
      <AppearanceSectionContent />
    </PropertySection>
  );
});
