/**
 * EffectSection — Style 탭 Effect 절
 *
 *   「Opacity ──●── 100 %」
 *   Box Shadows                       [⋮ 추가 · 프리셋]
 *   [■ 0 · 4 · 12 · 0  outer]         [⋮ inset · 제거]   ← 레이어마다 (클릭 → 편집 팝오버)
 *   Filters                           [+]
 *   [Blur  4 px]                      [삭제]             ← blur 한 종
 *
 * 종전 Appearance 절에서 분리 (panel-ui 02, 2026-09-14). Box Shadow 는 「프리셋 Select + inset
 * 토글 + 인라인 편집기」 → 레이어 목록 (Skia 는 parseAllBoxShadows 로 다중·inset·spread 를
 * 이미 그린다). 프리셋 (sm/md/lg = Spectrum elevation, theme 별 정규화) 은 3 레이어 문자열이라
 * 목록 전체를 바꾼다 → 추가 행 ⋮ 메뉴에. Filters 는 Skia 가 blur 를 LayerBlurEffect 로
 * 접붙이므로 blur 한 종 (다른 함수는 저장값 보존).
 * 접힌 섹션의 훅 실행을 방지하기 위해 내용 컴포넌트 분리.
 */

import { memo, useRef } from "react";
import {
  PropertyRowMenu,
  PropertySection,
  PropertySlider,
} from "../../../components";
import { SwatchIconButton } from "../../../components/ui";
import { ACTION_ICONS } from "../../../config/actionIcons";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { EFFECT_PROPS } from "./styleSectionProps";
import { applyShadowInset, getShadowToken } from "@composition/specs";
import type { ShadowPresetKey } from "@composition/specs";
import { useStyleActions } from "../hooks/useStyleActions";
import { useOptimizedStyleActions } from "../hooks/useOptimizedStyleActions";
import { useStylePresentationActions } from "../hooks/useStylePresentationActions";
import { useAppearanceValues } from "../hooks/useAppearanceValues";
import { useResetStyles, useHasDirtyStyles } from "../hooks/useResetStyles";
import { useStore } from "../../../stores";
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
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../../i18n";

import "./EffectSection.css";

const AddIcon = ACTION_ICONS.add;
const DeleteIcon = ACTION_ICONS.delete;

/** ADR-166: Spectrum 2 elevation 3단계 (xl 없음). 목록 전체를 교체한다. */
const SHADOW_PRESET_KEYS: readonly ShadowPresetKey[] = ["sm", "md", "lg"];

/** 새 blur 기본값 (px) */
const DEFAULT_BLUR_PX = 4;

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
  // 레이어 topology 가 바뀐 뒤 (추가·제거) 행 목록은 index key 라 그대로, 편집기만 remount.
  const editorMountRef = useRef(0);

  if (!styleValues) return null;

  const presentationOwnsBoxShadow = isBoxShadowPresentationOwned();
  const presentationOwnsOpacity = isOpacityPresentationOwned();
  const boxShadowModel = parseBoxShadowPresentation(styleValues.boxShadow);
  const blurPx = parseFilterBlurPx(styleValues.filter);

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

  // 레이어 추가 · 제거 · inset · 프리셋 — topology 변경은 presentation owner 가 거부하므로 열린
  //   세션을 닫고 canonical commit 으로 바로 간다 (Skia 는 parseAllBoxShadows 로 다중 렌더).
  const commitBoxShadowTopology = (nextBoxShadow: string): void => {
    editorMountRef.current += 1;
    cancelBoxShadowPresentation("superseded");
    updateStyle("boxShadow", nextBoxShadow);
  };

  const handleShadowListAction = (action: string): void => {
    if (action === "add") {
      const base: BoxShadowPresentationValue = boxShadowModel ?? { layers: [] };
      const added = addBoxShadowPresentationLayer(base, base.layers.length - 1);
      commitBoxShadowTopology(serializeBoxShadowPresentation(added.value));
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
    commitBoxShadowTopology(
      insetActive ? applyShadowInset(cssValue) : cssValue,
    );
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

  // blur 는 presentation pilot 이 없다 — scrub 중은 store preview (rAF, 히스토리 없음), 놓으면 commit.
  const handleBlurScrub = (px: number): void => {
    updateStylePreview("filter", setFilterBlurPx(styleValues.filter, px));
  };
  const handleBlurCommit = (px: number): void => {
    updateStyleImmediate("filter", setFilterBlurPx(styleValues.filter, px));
  };

  const shadowListItems = [
    { id: "add", label: localize("Add shadow layer"), icon: AddIcon },
    ...SHADOW_PRESET_KEYS.map((key) => ({
      id: key,
      label: `${localize("Shadow preset")} · ${key}`,
    })),
  ];

  const editorKey = `${selectedId ?? "none"}:${editorMountRef.current}:${styleValues.boxShadow}`;

  return (
    <>
      {/* Opacity — 요소 전체 (Fill 레이어 opacity 와 별개) */}
      <div className="style-opacity">
        <PropertySlider
          label="Opacity"
          className="opacity"
          editable
          unit="%"
          value={opacityToPercent(styleValues.opacity)}
          min={0}
          max={100}
          step={1}
          onChange={handleOpacityPreview}
          onChangeEnd={handleOpacityCommit}
        />
      </div>

      {/* Box Shadows — 추가 행 + 레이어 행 */}
      <div className="effect-list style-shadow">
        <div className="effect-add-row">
          <span className="effect-add-row__label">
            {localize("Box Shadows")}
          </span>
          <div className="fieldset-actions actions-icon">
            <PropertyRowMenu
              label={localize("Box shadow actions")}
              items={shadowListItems}
              onAction={handleShadowListAction}
            />
          </div>
        </div>
        {boxShadowModel?.layers.map((_, index) => (
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
              onCancel: cancelBoxShadowPresentation,
              presentationOwnsFrameScheduling: presentationOwnsBoxShadow,
            }}
          />
        ))}
      </div>

      {/* Filters — blur 한 종 */}
      <div className="effect-list style-filter">
        <div className="effect-add-row">
          <span className="effect-add-row__label">{localize("Filters")}</span>
          <div className="fieldset-actions actions-icon">
            <SwatchIconButton
              aria-label={localize("Add blur filter")}
              isDisabled={blurPx !== null}
              onPress={() => handleBlurCommit(DEFAULT_BLUR_PX)}
            >
              <AddIcon
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </SwatchIconButton>
          </div>
        </div>
        {blurPx !== null && (
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
            <div className="fieldset-actions actions-icon">
              <SwatchIconButton
                aria-label={localize("Remove blur filter")}
                onPress={() =>
                  updateStyleImmediate(
                    "filter",
                    setFilterBlurPx(styleValues.filter, null),
                  )
                }
              >
                <DeleteIcon
                  color={iconProps.color}
                  size={iconProps.size}
                  strokeWidth={iconProps.strokeWidth}
                />
              </SwatchIconButton>
            </div>
          </div>
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
