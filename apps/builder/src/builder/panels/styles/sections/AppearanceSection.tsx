/**
 * AppearanceSection - Appearance 스타일 편집 섹션
 *
 * Background + Border 편집 (단일 섹션)
 * 접힌 섹션의 훅 실행을 방지하기 위해 내용 컴포넌트 분리.
 * Background 편집은 FillBackgroundInline 단일 경로를 사용한다.
 */

import { memo, lazy, Suspense, useRef } from "react";
import {
  PropertySection,
  PropertyUnitInput,
  PropertyColor,
  PropertySelect,
} from "../../../components";
import {
  SwatchIconButton,
  SwatchIconToggleButton,
} from "../../../components/ui";
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
import { SquareOff } from "../../../components/icons";
import { OVERFLOW_OPTIONS } from "../constants/styleOptions";
import {
  applyShadowInset,
  getShadowToken,
  matchShadowPreset,
  stripShadowInset,
} from "@composition/specs";
import type { ShadowPresetKey } from "@composition/specs";
import { useStyleActions } from "../hooks/useStyleActions";
import { useOptimizedStyleActions } from "../hooks/useOptimizedStyleActions";
import { useAppearanceValues } from "../hooks/useAppearanceValues";
import { useResetStyles, useHasDirtyStyles } from "../hooks/useResetStyles";
import { useStore } from "../../../stores";

const LazyFillBackgroundInline = lazy(() =>
  import("./FillSection").then((m) => ({ default: m.FillBackgroundInline })),
);

/**
 * Shadow 프리셋 옵션 — inset 은 프리셋이 아니라 직교 토글 축 (sm~lg × inset).
 *
 * ADR-166 Phase 1: Adobe Spectrum 2 기반 3단계로 축소 (`xl` 제거 — Spectrum 이 4번째
 * elevation 을 발행하지 않고 D3 소비처가 0건이었다). 기존 프로젝트가 저장한 xl 값은
 * 소실되지 않고 아래 동적 "custom" 항목으로 표시된다.
 */
const SHADOW_PRESET_OPTIONS = [
  { value: "reset", label: "Reset" },
  { value: "none", label: "none" },
  { value: "sm", label: "sm" },
  { value: "md", label: "md" },
  { value: "lg", label: "lg" },
];

/**
 * CSS box-shadow 값 → 프리셋 키 역매핑.
 *
 * ADR-166 Phase 2 (R1): light 값만 인덱싱하면 dark 값이 들어왔을 때 프리셋이 "custom" 으로
 * 표시된다 — Phase 1 에서 토큰이 theme 별로 갈라졌기 때문. 양쪽 map 을 인덱싱해 canvas theme
 * 과 무관하게 같은 프리셋 키로 수렴시킨다.
 *
 * ADR-166 후속: 역매핑 구현을 specs `matchShadowPreset` 로 옮겨 Skia / DOM 소비자와 **한 벌**을
 * 쓴다. 세 곳이 각자 map 을 만들면 프리셋 값이 바뀔 때 한 곳만 갱신돼 조용히 어긋난다.
 * 패널은 표시용이라 inset 토글 여부와 무관하게 원 프리셋 키를 원한다 (`insetApplied` 무시).
 */
function boxShadowToPresetKey(cssValue: string): string {
  if (!cssValue || cssValue === "none") return "none";
  return matchShadowPreset(cssValue)?.key ?? cssValue;
}

const stripInset = stripShadowInset;
const applyInset = applyShadowInset;

const AppearanceSectionContent = memo(function AppearanceSectionContent() {
  const { updateStyle } = useStyleActions();
  const { updateStyleImmediate, updateStylePreview } =
    useOptimizedStyleActions();
  const selectedId = useStore((s) => s.selectedElementId);
  const styleValues = useAppearanceValues(selectedId);

  if (!styleValues) return null;

  // Box Shadow 2축 모델: Select = out shadow 프리셋 (sm~lg), inset 토글 = 직교 modifier.
  //   프리셋 키 판정은 inset-stripped 값 기준 — "lg + inset 토글" 상태에서도 Select 는
  //   custom 이 아니라 "lg" 를 유지한다.
  const hasShadow = !!styleValues.boxShadow && styleValues.boxShadow !== "none";
  const insetActive = hasShadow && styleValues.boxShadow.includes("inset");
  // PropertySelect 의 memo 커스텀 비교는 onChange 참조 변경을 무시한다 — inset 토글만
  //   바뀌면 value/options 가 그대로라 재렌더가 스킵되어 onChange closure 의 insetActive
  //   가 stale (프리셋 전환 시 inset 소실 실측). ref 미러로 commit 시점 최신값을 읽는다.
  const insetActiveRef = useRef(insetActive);
  insetActiveRef.current = insetActive;
  const shadowKey = boxShadowToPresetKey(
    insetActive ? stripInset(styleValues.boxShadow) : styleValues.boxShadow,
  );
  // stripped 값도 알려진 프리셋이 아니면(import/paste 된 임의 CSS) 동적 "custom" 항목을
  //   추가해 RAC Select 가 빈 선택으로 표시되지 않게 한다(M4). 알려진 프리셋이면 안정 참조 유지.
  const shadowOptions = SHADOW_PRESET_OPTIONS.some((o) => o.value === shadowKey)
    ? SHADOW_PRESET_OPTIONS
    : [...SHADOW_PRESET_OPTIONS, { value: shadowKey, label: "custom" }];

  const handleInsetChange = (isSelected: boolean) => {
    if (!hasShadow) return;
    updateStyle(
      "boxShadow",
      isSelected
        ? applyInset(styleValues.boxShadow)
        : stripInset(styleValues.boxShadow),
    );
  };

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
              // **light 를 정규형으로 기록한다** (ADR-166 후속). 저장 형식은 리터럴이라
              //   theme 정보를 담지 못하므로 어느 theme 값을 넣든 한쪽으로 굳는다 — 대신
              //   읽는 쪽(Skia `normalizeShadowForTheme` / DOM `shadowLiteralToCssVar`)이
              //   현재 theme 으로 되돌린다. 여기서 canvas theme 값을 기록하면 저장값이
              //   기록 시점에 따라 갈려 diff 만 지저분해지고 얻는 게 없다.
              //   `?? value` 는 동적 "custom" 항목용 — 그 옵션의 value 는 프리셋 키가 아니라
              //   원본 CSS 라 토큰 조회가 undefined 다.
              const cssValue =
                getShadowToken(value as ShadowPresetKey, "light") ?? value;
              // 프리셋 전환 시 inset 토글 상태 유지 (sm~lg × inset 직교 축)
              updateStyle(
                "boxShadow",
                insetActiveRef.current ? applyInset(cssValue) : cssValue,
              );
            }
          }}
        />
        <fieldset className="properties-aria fieldset-actions actions-icon">
          <legend className="fieldset-legend">inset</legend>
          <SwatchIconToggleButton
            aria-label="Inset shadow"
            isSelected={insetActive}
            isDisabled={!hasShadow}
            onChange={handleInsetChange}
          >
            <SquareOff
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </SwatchIconToggleButton>
        </fieldset>
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
