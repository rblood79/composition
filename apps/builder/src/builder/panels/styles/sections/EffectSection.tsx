/**
 * EffectSection — Style 탭 Effect 절
 *
 *   Effect                                 [+ Opacity · Blur · 그림자 · 프리셋 S/M/L]  [↺]
 *   Opacity                                     ← fieldset (legend + 슬라이더)
 *   [──●── 50 %                          ][−]
 *   Blur                                        ← fieldset-row (legend + 단위 입력칸 — 감사 C4)
 *   [4                              PX   ][−]
 *   Box Shadows                                 ← fieldset (legend + 레이어 목록)
 *   [■ 0 · 4 · 12 · 0                  −][▢]   ← 레이어마다 (클릭 → 편집 팝오버)
 *
 * 세 효과 모두 기본은 「없음」 — 값이 없으면 그 묶음 (legend · 내용) 을 그리지 않고, 추가는 절
 * 머리줄 「+」 메뉴 하나로 한다 (2026-10-28 사용자 결정 — Opacity 기본 100 % 도 「없음」, Fill
 * 절의 머리줄 추가 · Overrides 절의 「+」 메뉴와 같은 어법). 각 묶음은 패널 표준
 * `fieldset.properties-aria > legend.fieldset-legend + 내용` 이고 행은 7칸 격자 (176 · 28).
 *
 * 종전 Appearance 절에서 분리 (panel-ui 02, 2026-09-14). Skia 는 parseAllBoxShadows 로 다중 ·
 * inset · spread 를 그리고, 프리셋 (sm/md/lg = Spectrum elevation, theme 별 정규화) 은 3 레이어
 * 문자열이라 목록 전체를 바꾼다 — 저장은 `{shadow.*}` 토큰 참조 (ADR-298 D7, legend 에 단계 칩). Filters 는 Skia 가 blur 를 LayerBlurEffect 로 접붙이므로 blur
 * 한 종 (다른 함수는 저장값 보존).
 * 접힌 섹션의 훅 실행을 방지하기 위해 내용 컴포넌트 분리.
 */

import { memo, useState } from "react";
import { CircleDashed, Minus } from "lucide-react";
import { PropertyRowMenu } from "../../../components/property/PropertyRowMenu";
import { Section as PropertySection } from "../../../components/panel/Section";
import { PropertySlider } from "../../../components/property/PropertySlider";
import { SwatchIconButton } from "../../../components/ui";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { EFFECT_PROPS } from "./styleSectionProps";
import { applyShadowInset, getShadowToken } from "@composition/rendering";
import type { ShadowPresetKey } from "@composition/rendering";
import { useStyleActions } from "../hooks/useStyleActions";
import { useOptimizedStyleActions } from "../hooks/useOptimizedStyleActions";
import { useAppearanceValues } from "../hooks/useAppearanceValues";
import { useResetStyles, useHasDirtyStyles } from "../hooks/useResetStyles";
import {
  BoxShadowLayerRow,
  type BoxShadowLayerAction,
} from "../components/BoxShadowLayerRow";
import { PropertyUnitInput } from "../../../components/property/PropertyUnitInput";
import {
  addBoxShadowPresentationLayer,
  parseBoxShadowPresentation,
  patchBoxShadowPresentation,
  removeBoxShadowPresentationLayer,
  serializeBoxShadowPresentation,
  type BoxShadowPresentationValue,
} from "../../../presentation/boxShadowPresentation";
import { parseFilterBlurPx, setFilterBlurPx } from "../utils/filterValue";
import { useSemanticLabel } from "../../../../i18n";

import "./EffectSection.css";
import { useStylesHost, useStylesSelectedId } from "../stylesHost";

const AddIcon = ACTION_ICONS.add;

/** ADR-166: Spectrum 2 elevation 3단계 (xl 없음). 목록 전체를 교체한다. */
const SHADOW_PRESET_KEYS = [
  "sm",
  "md",
  "lg",
] as const satisfies readonly ShadowPresetKey[];

/**
 * 프리셋 표시 — Spectrum 의 용도 이름 (Hub `drop-shadow`). 셋은 작다 → 크다 순서가 아니라 서로 다른
 * 용도다: 강조 컨테이너 · 다른 내용 위에 뜨는 것 · 끄는 중. 토큰 이름 (`sm` · `md` · `lg`) 은 그대로.
 * 2026-11-10 사용자 결정 — 종전 S · M · L 은 크기로 고르게 했다.
 */
const SHADOW_PRESET_LABEL: Record<(typeof SHADOW_PRESET_KEYS)[number], string> =
  {
    sm: "Emphasized",
    md: "Elevated",
    lg: "Dragged",
  };

/**
 * ADR-298 D7 — 그림자 preset 은 `{shadow.sm|md|lg}` 토큰 참조로 저장된다 (`var(--shadow-*)` — 패널
 * 값의 토큰 글자). 레이어 목록은 그 토큰의 값 (light 정규형) 으로 보이고, 레이어를 고치면 리터럴이 된다.
 */
function shadowTokenKey(
  value: string,
): (typeof SHADOW_PRESET_KEYS)[number] | undefined {
  const key = /^var\(--shadow-([a-z]+)\)$/.exec(value.trim())?.[1];
  return SHADOW_PRESET_KEYS.find((preset) => preset === key);
}

/** 그림자 값의 레이어 모델 — 토큰이면 그 토큰의 값으로. */
function shadowModelOf(value: string): BoxShadowPresentationValue | null {
  const token = shadowTokenKey(value);
  return parseBoxShadowPresentation(
    token ? (getShadowToken(token, "light") ?? "") : value,
  );
}

/** 새 blur 기본값 (px) */
const DEFAULT_BLUR_PX = 4;

/** 머리줄 「+」 메뉴로 추가한 opacity 의 첫 값 — 100 % (시각 변화 0, 행만 생긴다) */
const ADDED_OPACITY_VALUE = "1";

/**
 * 요소 opacity ↔ 슬라이더 % 변환.
 *
 * 저장은 CSS `opacity` 문자열 (0~1). Skia 는 `style.opacity` → OpacityEffect
 * (styleConverter `convertToEffects`), DOM 은 inline 그대로 (Fill 레이어 opacity 와 별개).
 * 값이 없으면 (`""`) 행이 없다 — 100 % 도 사용자가 추가했으면 그 값으로 남고, 「−」 가 키를 지운다.
 */
function opacityToPercent(raw: string): number {
  const parsed = raw.trim().endsWith("%")
    ? Number.parseFloat(raw) / 100
    : Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return 100;
  return Math.round(Math.max(0, Math.min(1, parsed)) * 100);
}

function percentToOpacityValue(percent: number): string {
  return String(Math.max(0, Math.min(100, percent)) / 100);
}

const EffectSectionContent = memo(function EffectSectionContent() {
  const localize = useSemanticLabel();
  const { updateStyle } = useStyleActions();
  const { updateStyleImmediate, cancelStylePreview, updateStylePreview } =
    useOptimizedStyleActions();
  const selectedId = useStylesSelectedId();
  const styleValues = useAppearanceValues(selectedId);
  // 색 드래그도 Styles host 미리보기
  const host = useStylesHost();
  // 레이어 topology 가 바뀐 뒤 (추가·제거) 행 목록은 index key 라 그대로, 편집기만 remount.
  const [editorMount, setEditorMount] = useState(0);

  if (!styleValues) return null;

  const boxShadowModel = shadowModelOf(styleValues.boxShadow);
  const shadowToken = shadowTokenKey(styleValues.boxShadow);
  const shadowLayers = boxShadowModel?.layers ?? [];
  const blurPx = parseFilterBlurPx(styleValues.filter);
  const hasOpacity = styleValues.opacity !== "";

  // 요소 opacity — 드래그는 미리보기, 놓으면 commit.
  const handleOpacityPreview = (percent: number): void => {
    updateStylePreview("opacity", String(percent / 100));
  };

  const handleOpacityCommit = (percent: number): void => {
    updateStyleImmediate("opacity", percentToOpacityValue(percent));
  };

  const handleBoxShadowModelPreview = (
    value: BoxShadowPresentationValue,
  ): void => {
    updateStylePreview("boxShadow", serializeBoxShadowPresentation(value));
  };

  const handleBoxShadowModelCommit = (
    value: BoxShadowPresentationValue,
  ): void => {
    updateStyle("boxShadow", serializeBoxShadowPresentation(value));
  };

  // 레이어 제거 · inset — 편집기를 다시 마운트하고 바로 commit 한다 (Skia 는
  //   parseAllBoxShadows 로 다중 렌더).
  const commitBoxShadowTopology = (nextBoxShadow: string): void => {
    setEditorMount((mount) => mount + 1);
    updateStyle("boxShadow", nextBoxShadow);
  };

  const handleLayerAction = (
    action: BoxShadowLayerAction,
    layerIndex: number,
  ): void => {
    if (!boxShadowModel) return;
    // ADR-298 Phase 5: 토큰 행은 토큰 하나 — 제거는 그림자 전체, inset 은 모든 레이어 (preset 의 inset 판과 같은 값).
    if (shadowToken) {
      const tokenValue = getShadowToken(shadowToken, "light") ?? "";
      // 작성값이 없으면 토큰은 rule 의 것 — 키를 지워도 그대로라 `none` 을 쓴다.
      const removed = styleValues.boxShadowAuthored ? "" : "none";
      commitBoxShadowTopology(
        action === "remove" ? removed : applyShadowInset(tokenValue),
      );
      return;
    }
    if (action === "remove") {
      const removed = removeBoxShadowPresentationLayer(
        boxShadowModel,
        layerIndex,
      );
      // 마지막 레이어 제거 = inline boxShadow 키 삭제 (baseline "none"/catalog 로 복귀)
      commitBoxShadowTopology(
        removed ? serializeBoxShadowPresentation(removed) : "",
      );
      return;
    }
    const layer = boxShadowModel.layers[layerIndex];
    if (!layer) return;
    const next = patchBoxShadowPresentation(
      boxShadowModel,
      layerIndex,
      "inset",
      !layer.inset,
    );
    if (next === null) return;
    commitBoxShadowTopology(serializeBoxShadowPresentation(next));
  };

  // blur — scrub 중은 host 미리보기 (rAF, 히스토리 없음), 놓으면 commit.
  const handleBlurScrub = (px: number): void => {
    updateStylePreview("filter", setFilterBlurPx(styleValues.filter, px));
  };
  const handleBlurCommit = (px: number): void => {
    updateStyleImmediate("filter", setFilterBlurPx(styleValues.filter, px));
  };

  const editorKey = `${selectedId ?? "none"}:${editorMount}:${styleValues.boxShadow}`;

  return (
    <>
      {/* Opacity — 요소 전체 (Fill 레이어 opacity 와 별개) · [슬라이더 176][−] */}
      {hasOpacity && (
        <div className="fieldset-row style-opacity" data-wide>
          <PropertySlider
            label="Opacity"
            className="effect-opacity"
            editable
            unit="%"
            value={opacityToPercent(styleValues.opacity)}
            min={0}
            max={100}
            step={1}
            onChange={handleOpacityPreview}
            onChangeEnd={handleOpacityCommit}
          />
          <div className="fieldset-actions actions-remove">
            <SwatchIconButton
              aria-label={localize("Remove opacity")}
              onPress={() => updateStyleImmediate("opacity", "")}
            >
              <Minus
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </SwatchIconButton>
          </div>
        </div>
      )}

      {/* Blur — px 길이는 다른 길이 칸과 같은 PropertyUnitInput (감사 C4 · ADR-298 결정 6 — 종전
          ScrubInput) · Opacity 와 같은 [176][−] 행 */}
      {blurPx !== null && (
        <div className="fieldset-row style-blur" data-wide>
          <PropertyUnitInput
            label="Blur"
            icon={CircleDashed}
            className="effect-blur"
            unitSuffix
            value={`${blurPx}px`}
            units={["px"]}
            allowKeywords={false}
            min={0}
            max={200}
            onChange={(value) => {
              const px = Number.parseFloat(value);
              if (Number.isFinite(px)) handleBlurCommit(px);
            }}
            onDragCancel={cancelStylePreview}
            onDrag={(value) => {
              const px = Number.parseFloat(value);
              if (Number.isFinite(px)) handleBlurScrub(px);
            }}
          />
          <div className="fieldset-actions actions-remove">
            <SwatchIconButton
              aria-label={localize("Remove blur filter")}
              onPress={() =>
                updateStyleImmediate(
                  "filter",
                  setFilterBlurPx(styleValues.filter, null),
                )
              }
            >
              <Minus
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </SwatchIconButton>
          </div>
        </div>
      )}
      {/* Box Shadows — legend + 레이어 목록 */}
      {boxShadowModel && shadowLayers.length > 0 && (
        <fieldset className="properties-aria effect-group style-shadow">
          <legend className="fieldset-legend">
            {localize("Box Shadows")}
          </legend>
          <div className="effect-group__list">
            {/* 토큰이면 칩 + 요약 한 줄 (시안 Style 탭 — ADR-298 Phase 5), 리터럴이면 레이어마다 한 행 */}
            {(shadowToken ? shadowLayers.slice(0, 1) : shadowLayers).map((_, index) => (
              <BoxShadowLayerRow
                // 행은 index 로 안정 (커밋마다 remount 되면 열린 팝오버가 닫힌다) — 편집기만 key
                key={`${selectedId ?? "none"}:${index}`}
                value={boxShadowModel}
                layerIndex={index}
                editorKey={editorKey}
                onAction={handleLayerAction}
                token={
                  shadowToken ? SHADOW_PRESET_LABEL[shadowToken] : undefined
                }
                editor={{
                  onPreview: handleBoxShadowModelPreview,
                  onCommit: handleBoxShadowModelCommit,
                  onCancel: () => host.cancelPreview?.(),
                  livePreview: true,
                }}
              />
            ))}
          </div>
        </fieldset>
      )}
    </>
  );
});

/**
 * 절 머리줄 「+」 — Opacity · 그림자 레이어 · 그림자 프리셋 · Blur 를 고르는 메뉴. 이미 있는
 * Opacity · Blur 는 비활성 (그림자는 레이어를 더 쌓는다). 접힌 절에서도 머리줄은 보이므로 내용
 * 컴포넌트와 따로 값을 읽는다.
 */
const EffectAddMenu = memo(function EffectAddMenu() {
  const localize = useSemanticLabel();
  const { updateStyle } = useStyleActions();
  const { updateStyleImmediate } = useOptimizedStyleActions();
  const selectedId = useStylesSelectedId();
  const styleValues = useAppearanceValues(selectedId);
  if (!styleValues) return null;

  const boxShadowModel = shadowModelOf(styleValues.boxShadow);
  const hasOpacity = styleValues.opacity !== "";
  const hasBlur = parseFilterBlurPx(styleValues.filter) !== null;

  // 순서 = 절의 묶음 순서 (Opacity · Blur · Box Shadows). 프리셋 표기는 Spectrum 용도 이름
  //   (저장 키는 sm · md · lg).
  const items = [
    {
      id: "opacity",
      label: localize("Opacity"),
      icon: AddIcon,
      isDisabled: hasOpacity,
    },
    {
      id: "blur",
      label: localize("Blur"),
      icon: AddIcon,
      isDisabled: hasBlur,
    },
    { id: "shadow", label: localize("Box Shadows"), icon: AddIcon },
    // 프리셋은 그림자 목록 전체를 바꾼다 — 그림자 항목 바로 아래, 아이콘 없이
    ...SHADOW_PRESET_KEYS.map((key) => ({
      id: key,
      label: `${localize("Box Shadows")} · ${SHADOW_PRESET_LABEL[key]}`,
    })),
  ];

  const handleAction = (action: string): void => {
    if (action === "opacity") {
      updateStyleImmediate("opacity", ADDED_OPACITY_VALUE);
      return;
    }
    if (action === "blur") {
      updateStyleImmediate(
        "filter",
        setFilterBlurPx(styleValues.filter, DEFAULT_BLUR_PX),
      );
      return;
    }
    if (action === "shadow") {
      const base: BoxShadowPresentationValue = boxShadowModel ?? { layers: [] };
      const added = addBoxShadowPresentationLayer(base, base.layers.length - 1);
      updateStyle("boxShadow", serializeBoxShadowPresentation(added.value));
      return;
    }
    const presetKey = SHADOW_PRESET_KEYS.find((key) => key === action);
    if (!presetKey) return;
    // ADR-298 D7: preset = `{shadow.*}` 토큰 참조 — 값은 렌더 쪽이 활성 테마 · 색 모드에서 읽는다.
    //   목록에 inset 레이어가 있었으면 inset 판은 토큰이 없어 light 리터럴로 — 색 모드를 따르지 않는다
    //   (읽는 쪽 역매핑도 inset 판은 건너뛴다: `shadowNormalize.ts` §적용 범위).
    const insetActive = boxShadowModel?.layers.some((l) => l.inset) ?? false;
    if (insetActive) {
      const cssValue = getShadowToken(presetKey, "light");
      if (cssValue) updateStyle("boxShadow", applyShadowInset(cssValue));
      return;
    }
    updateStyle("boxShadow", `var(--shadow-${presetKey})`);
  };

  return (
    <PropertyRowMenu
      quiet
      icon={AddIcon}
      label={localize("Add effect")}
      items={items}
      onAction={handleAction}
    />
  );
});

// 머리줄 액션은 참조가 안정해야 Section memo 가 다시 그리지 않는다
const EFFECT_ADD_MENU = <EffectAddMenu />;

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
      actions={EFFECT_ADD_MENU}
      onReset={hasDirty ? () => resetStyles(EFFECT_PROPS) : undefined}
    >
      <EffectSectionContent />
    </PropertySection>
  );
});
