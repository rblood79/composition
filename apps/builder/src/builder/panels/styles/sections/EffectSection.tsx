/**
 * EffectSection — Style 탭 Effect 절
 *
 *   Effect                                 [+ Opacity · 그림자 · 프리셋 · Blur]  [↺]
 *   Opacity                                     ← fieldset (legend + 슬라이더)
 *   [──●── 50 %                          ][−]
 *   Box Shadows                                 ← fieldset (legend + 레이어 목록)
 *   [■ 0 · 4 · 12 · 0                  −][▢]   ← 레이어마다 (클릭 → 편집 팝오버)
 *   Filters                                     ← fieldset (legend + blur 한 종)
 *   [Blur                          4 px  ][−]
 *
 * 세 효과 모두 기본은 「없음」 — 값이 없으면 그 묶음 (legend · 내용) 을 그리지 않고, 추가는 절
 * 머리줄 「+」 메뉴 하나로 한다 (2026-10-28 사용자 결정 — Opacity 기본 100 % 도 「없음」, Fill
 * 절의 머리줄 추가 · Overrides 절의 「+」 메뉴와 같은 어법). 각 묶음은 패널 표준
 * `fieldset.properties-aria > legend.fieldset-legend + 내용` 이고 행은 7칸 격자 (176 · 28).
 *
 * 종전 Appearance 절에서 분리 (panel-ui 02, 2026-09-14). Skia 는 parseAllBoxShadows 로 다중 ·
 * inset · spread 를 그리고, 프리셋 (sm/md/lg = Spectrum elevation, theme 별 정규화) 은 3 레이어
 * 문자열이라 목록 전체를 바꾼다. Filters 는 Skia 가 blur 를 LayerBlurEffect 로 접붙이므로 blur
 * 한 종 (다른 함수는 저장값 보존).
 * 접힌 섹션의 훅 실행을 방지하기 위해 내용 컴포넌트 분리.
 */

import { memo, useRef } from "react";
import { Button } from "react-aria-components/Button";
import { Minus } from "lucide-react";
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
import { ScrubInput } from "../components/ScrubInput";
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
const SHADOW_PRESET_KEYS: readonly ShadowPresetKey[] = ["sm", "md", "lg"];

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

/** 목록 행 액션 칸의 「−」 (Blur — 액션이 하나뿐인 레이어 행) */
function RemoveActionButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Button
      className="effect-layer-row__action effect-layer-row__remove"
      aria-label={label}
      onPress={onPress}
    >
      <Minus
        color={iconProps.color}
        size={iconProps.size}
        strokeWidth={iconProps.strokeWidth}
      />
    </Button>
  );
}

const EffectSectionContent = memo(function EffectSectionContent() {
  const localize = useSemanticLabel();
  const { updateStyle } = useStyleActions();
  const { updateStyleImmediate, updateStylePreview } =
    useOptimizedStyleActions();
  const selectedId = useStylesSelectedId();
  const styleValues = useAppearanceValues(selectedId);
  // 색 드래그도 Styles host 미리보기
  const host = useStylesHost();
  // 레이어 topology 가 바뀐 뒤 (추가·제거) 행 목록은 index key 라 그대로, 편집기만 remount.
  const editorMountRef = useRef(0);

  if (!styleValues) return null;

  const boxShadowModel = parseBoxShadowPresentation(styleValues.boxShadow);
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
    editorMountRef.current += 1;
    updateStyle("boxShadow", nextBoxShadow);
  };

  const handleLayerAction = (
    action: BoxShadowLayerAction,
    layerIndex: number,
  ): void => {
    if (!boxShadowModel) return;
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

  const editorKey = `${selectedId ?? "none"}:${editorMountRef.current}:${styleValues.boxShadow}`;

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

      {/* Box Shadows — legend + 레이어 목록 */}
      {boxShadowModel && shadowLayers.length > 0 && (
        <fieldset className="properties-aria effect-group style-shadow">
          <legend className="fieldset-legend">{localize("Box Shadows")}</legend>
          <div className="effect-group__list">
            {shadowLayers.map((_, index) => (
              <BoxShadowLayerRow
                // 행은 index 로 안정 (커밋마다 remount 되면 열린 팝오버가 닫힌다) — 편집기만 key
                key={`${selectedId ?? "none"}:${index}`}
                value={boxShadowModel}
                layerIndex={index}
                editorKey={editorKey}
                onAction={handleLayerAction}
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

      {/* Filters — legend + blur 한 종 · [Blur 176][−] */}
      {blurPx !== null && (
        <fieldset className="properties-aria effect-group style-filter">
          <legend className="fieldset-legend">{localize("Filters")}</legend>
          <div className="effect-group__list">
            <div className="effect-layer-row">
              <div className="effect-layer-row__body">
                <span className="effect-layer-row__value">
                  {localize("Blur")}
                </span>
                <ScrubInput
                  value={blurPx}
                  onScrub={handleBlurScrub}
                  onCommit={handleBlurCommit}
                  min={0}
                  max={200}
                  suffix="px"
                  label="Blur radius"
                  className="effect-layer-row__scrub"
                />
              </div>
              <div className="effect-layer-row__actions">
                <RemoveActionButton
                  label={localize("Remove blur filter")}
                  onPress={() =>
                    updateStyleImmediate(
                      "filter",
                      setFilterBlurPx(styleValues.filter, null),
                    )
                  }
                />
              </div>
            </div>
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

  const boxShadowModel = parseBoxShadowPresentation(styleValues.boxShadow);
  const hasOpacity = styleValues.opacity !== "";
  const hasBlur = parseFilterBlurPx(styleValues.filter) !== null;

  const items = [
    {
      id: "opacity",
      label: localize("Opacity"),
      icon: AddIcon,
      isDisabled: hasOpacity,
    },
    { id: "shadow", label: localize("Box Shadows"), icon: AddIcon },
    // 프리셋은 그림자 목록 전체를 바꾼다 — 그림자 항목 바로 아래, 아이콘 없이
    ...SHADOW_PRESET_KEYS.map((key) => ({
      id: key,
      label: `${localize("Box Shadows")} · ${key}`,
    })),
    {
      id: "blur",
      label: localize("Blur"),
      icon: AddIcon,
      isDisabled: hasBlur,
    },
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
    // **light 를 정규형으로 기록한다** (ADR-166 후속). 저장 형식은 리터럴이라 theme 정보를
    //   담지 못하므로 읽는 쪽 (Skia `normalizeShadowForTheme` / DOM `shadowLiteralToCssVar`)
    //   이 현재 theme 으로 되돌린다. 목록에 inset 레이어가 있었으면 프리셋도 inset 으로.
    const cssValue = getShadowToken(presetKey, "light");
    if (!cssValue) return;
    const insetActive = boxShadowModel?.layers.some((l) => l.inset) ?? false;
    updateStyle("boxShadow", insetActive ? applyShadowInset(cssValue) : cssValue);
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
