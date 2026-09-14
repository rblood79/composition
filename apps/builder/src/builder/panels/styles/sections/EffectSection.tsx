/**
 * EffectSection — Style 탭 Effect 절 (요소 Opacity · Box Shadow)
 *
 * 종전 Appearance 절에서 분리 (panel-ui 02, 2026-09-14). 접힌 섹션의 훅 실행을 방지하기
 * 위해 내용 컴포넌트 분리.
 */

import { memo, useEffect, useRef } from "react";
import {
  PropertySection,
  PropertySelect,
  PropertySlider,
} from "../../../components";
import { SwatchIconToggleButton } from "../../../components/ui";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { Eclipse, Eye } from "lucide-react";
import { SquareOff } from "../../../components/icons";
import { EFFECT_PROPS } from "./styleSectionProps";
import {
  applyShadowInset,
  getShadowToken,
  matchShadowPreset,
  stripShadowInset,
} from "@composition/specs";
import type { ShadowPresetKey } from "@composition/specs";
import { useStyleActions } from "../hooks/useStyleActions";
import { useOptimizedStyleActions } from "../hooks/useOptimizedStyleActions";
import { useStylePresentationActions } from "../hooks/useStylePresentationActions";
import { useAppearanceValues } from "../hooks/useAppearanceValues";
import { useResetStyles, useHasDirtyStyles } from "../hooks/useResetStyles";
import { useStore } from "../../../stores";
import { BoxShadowEditor } from "../components/BoxShadowEditor";
import {
  parseBoxShadowPresentation,
  serializeBoxShadowPresentation,
  type BoxShadowPresentationValue,
} from "../../../presentation/boxShadowPresentation";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../../i18n";

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

/**
 * 요소 opacity ↔ 슬라이더 % 변환.
 *
 * 저장은 CSS `opacity` 문자열 (0~1). Skia 는 `style.opacity` → OpacityEffect
 * (styleConverter `convertToEffects`), DOM 은 inline 그대로 — 채널은 이미 양쪽에 있었고
 * 패널 컨트롤만 없었다 (Fill 레이어 opacity 와 별개). 100 % 는 CSS 기본값이라 inline 키를
 * 지워 baseline 으로 복귀시킨다 — "1" 을 기록하면 boxShadow "none" 과 같은 영구 dirty.
 */
function opacityToPercent(raw: string): number {
  const parsed = raw.trim().endsWith("%")
    ? Number.parseFloat(raw) / 100
    : Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return 100;
  return Math.round(Math.max(0, Math.min(1, parsed)) * 100);
}

function percentToOpacityValue(percent: number): string {
  if (percent >= 100) return "";
  return String(Math.max(0, Math.min(100, percent)) / 100);
}

const EffectSectionContent = memo(function EffectSectionContent() {
  const i18n = useOptionalI18n();
  const localize = (label: string) =>
    i18n
      ? translateKey(i18n.t, semanticLabelKeys[label] ?? label, label)
      : label;
  const { updateStyle } = useStyleActions();
  const { updateStyleImmediate, updateStylePreview } =
    useOptimizedStyleActions();
  const {
    cancelBoxShadowPresentation,
    commitBoxShadowPresentation,
    commitBoxShadowModelPresentation,
    isBoxShadowPresentationOwned,
    previewBoxShadowModelPresentation,
    cancelOpacityPresentation,
    commitOpacityPresentation,
    isOpacityPresentationOwned,
    previewOpacityPresentation,
  } = useStylePresentationActions();
  const selectedId = useStore((s) => s.selectedElementId);
  const styleValues = useAppearanceValues(selectedId);
  const insetActive = Boolean(
    styleValues?.boxShadow &&
    styleValues.boxShadow !== "none" &&
    styleValues.boxShadow.includes("inset"),
  );
  const insetActiveRef = useRef(insetActive);
  useEffect(() => {
    insetActiveRef.current = insetActive;
  }, [insetActive]);
  // 레이어 추가/제거 뒤 편집기가 remount (key 에 boxShadow) 되므로 다음 활성 레이어를 건넨다.
  const nextShadowLayerIndexRef = useRef(0);

  if (!styleValues) return null;

  const presentationOwnsBoxShadow = isBoxShadowPresentationOwned();
  const presentationOwnsOpacity = isOpacityPresentationOwned();
  const boxShadowModel = parseBoxShadowPresentation(styleValues.boxShadow);

  // Box Shadow 2축 모델: Select = out shadow 프리셋 (sm~lg), inset 토글 = 직교 modifier.
  //   프리셋 키 판정은 inset-stripped 값 기준 — "lg + inset 토글" 상태에서도 Select 는
  //   custom 이 아니라 "lg" 를 유지한다.
  const hasShadow = !!styleValues.boxShadow && styleValues.boxShadow !== "none";
  // PropertySelect 의 memo 커스텀 비교는 onChange 참조 변경을 무시한다 — inset 토글만
  //   바뀌면 value/options 가 그대로라 재렌더가 스킵되어 onChange closure 의 insetActive
  //   가 stale (프리셋 전환 시 inset 소실 실측). ref 미러로 commit 시점 최신값을 읽는다.
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
    const nextBoxShadow = isSelected
      ? applyInset(styleValues.boxShadow)
      : stripInset(styleValues.boxShadow);
    if (
      presentationOwnsBoxShadow &&
      commitBoxShadowPresentation(nextBoxShadow)
    ) {
      return;
    }
    updateStyle("boxShadow", nextBoxShadow);
  };

  // 요소 opacity — ModifiedStylesSection 과 같은 presentation 경로 (pilot 이 소유하면
  //   Skia 가 OpacityEffect 만 갈아끼우고, 아니면 canonical preview/commit).
  const handleOpacityPreview = (percent: number): void => {
    const value = String(percent / 100);
    if (presentationOwnsOpacity && previewOpacityPresentation(value)) return;
    updateStylePreview("opacity", value);
  };

  const handleOpacityCommit = (percent: number): void => {
    const value = percentToOpacityValue(percent);
    // "" (100 %) 는 inline 키 삭제 — presentation 은 값을 요구하므로 세션을 닫고 canonical 로.
    if (value === "") {
      cancelOpacityPresentation("superseded");
      updateStyleImmediate("opacity", value);
      return;
    }
    if (presentationOwnsOpacity && commitOpacityPresentation(value)) return;
    updateStyleImmediate("opacity", value);
  };

  const handleBoxShadowModelPreview = (
    value: BoxShadowPresentationValue,
  ): void => {
    if (presentationOwnsBoxShadow) {
      previewBoxShadowModelPresentation(value);
      return;
    }
    updateStylePreview("boxShadow", serializeBoxShadowPresentation(value));
  };

  const handleBoxShadowModelCommit = (
    value: BoxShadowPresentationValue,
  ): void => {
    if (presentationOwnsBoxShadow && commitBoxShadowModelPresentation(value)) {
      return;
    }
    updateStyle("boxShadow", serializeBoxShadowPresentation(value));
  };

  // 레이어 추가 · 제거 · inset — topology 변경은 presentation owner 가 거부하므로 열린
  //   세션을 닫고 canonical commit 으로 바로 간다 (Skia 는 parseAllBoxShadows 로 다중 렌더).
  const handleBoxShadowTopologyCommit = (
    value: BoxShadowPresentationValue,
    nextLayerIndex: number,
  ): void => {
    nextShadowLayerIndexRef.current = nextLayerIndex;
    cancelBoxShadowPresentation("superseded");
    updateStyle("boxShadow", serializeBoxShadowPresentation(value));
  };

  return (
    <>
      {/* Opacity — 요소 전체 (Fill 레이어 opacity 와 별개) */}
      <div className="style-opacity">
        <PropertySlider
          icon={Eye}
          label="Opacity"
          className="opacity"
          value={opacityToPercent(styleValues.opacity)}
          min={0}
          max={100}
          step={1}
          onChange={handleOpacityPreview}
          onChangeEnd={handleOpacityCommit}
        />
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
              cancelBoxShadowPresentation("superseded");
              updateStyle("boxShadow", "");
            } else if (value === "none") {
              cancelBoxShadowPresentation("superseded");
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
              const nextBoxShadow = insetActiveRef.current
                ? applyInset(cssValue)
                : cssValue;
              if (
                presentationOwnsBoxShadow &&
                commitBoxShadowPresentation(nextBoxShadow)
              ) {
                return;
              }
              updateStyle("boxShadow", nextBoxShadow);
            }
          }}
        />
        <fieldset className="properties-aria fieldset-actions actions-icon">
          <legend className="fieldset-legend">{localize("inset")}</legend>
          <SwatchIconToggleButton
            aria-label={localize("Inset shadow")}
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
        {boxShadowModel !== null && (
          <BoxShadowEditor
            key={`${selectedId ?? "none"}:${styleValues.boxShadow}`}
            value={boxShadowModel}
            initialLayerIndex={nextShadowLayerIndexRef.current}
            onPreview={handleBoxShadowModelPreview}
            onCommit={handleBoxShadowModelCommit}
            onTopologyCommit={handleBoxShadowTopologyCommit}
            onCancel={cancelBoxShadowPresentation}
            presentationOwnsFrameScheduling={presentationOwnsBoxShadow}
          />
        )}
      </div>
    </>
  );
});

/**
 * EffectSection - 외부 래퍼 (PropertySection 관리)
 */
export const EffectSection = memo(function EffectSection() {
  const resetStyles = useResetStyles();
  const hasDirty = useHasDirtyStyles(EFFECT_PROPS);

  return (
    <PropertySection
      id="effect"
      title="Effect"
      onReset={hasDirty ? () => resetStyles(EFFECT_PROPS) : undefined}
    >
      <EffectSectionContent />
    </PropertySection>
  );
});
