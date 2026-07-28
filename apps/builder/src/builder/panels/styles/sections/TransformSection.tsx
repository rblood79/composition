/**
 * TransformSection - Transform 스타일 편집 섹션
 *
 * Size (ADR-026 Size Mode), Position 편집.
 * Alignment는 Layout 섹션의 3x3 Flex alignment로 통합됨.
 */

import { memo, useCallback, useMemo, useState } from "react";
import type { Key } from "react-aria-components";
import {
  PropertySection,
  PropertyUnitInput,
  PropertySelect,
} from "../../../components";
import {
  ToggleButton,
  ToggleButtonGroup,
} from "@composition/shared/components";
import { SwatchIconButton } from "../../../components/ui";
import { iconProps } from "../../../../utils/ui/uiConstants";
import {
  EllipsisVertical,
  RulerDimensionLine,
  ArrowRightFromLine,
  ArrowDownFromLine,
  Minus,
  MoveHorizontal,
  Shrink,
  ChevronsLeftRightEllipsis,
  Ratio,
  Lock,
  Unlock,
} from "lucide-react";
import { useOptimizedStyleActions } from "../hooks/useOptimizedStyleActions";
import { useTransformValues } from "../hooks/useTransformValues";
import {
  useWidthSizeMode,
  useHeightSizeMode,
  useParentDisplay,
  useParentFlexDirection,
} from "../hooks/useTransformAuxiliary";
import { useStore } from "../../../stores";
import { useResetStyles, useHasDirtyStyles } from "../hooks/useResetStyles";
import { useViewportSyncStore } from "../../../workspace/canvas/stores";
import {
  resolveSizeMode,
  sizeModeToStyleUpdates,
} from "../../../stores/utils/sizeModeResolver";
import type { SizeMode } from "../../../stores/utils/sizeModeResolver";
import {
  buildAspectRatioStyleUpdates,
  hasEnabledAspectRatio,
} from "../../../utils/aspectRatio";

const ICON_SIZE = 14;
const ICON_STROKE = 1.5;

const ASPECT_RATIO_OPTIONS = [
  { value: "reset", label: "Auto" },
  { value: "1 / 1", label: "1:1 Square" },
  { value: "16 / 9", label: "16:9 Video" },
  { value: "4 / 3", label: "4:3 Classic" },
  { value: "3 / 2", label: "3:2 Photo" },
  { value: "21 / 9", label: "21:9 Ultra" },
  { value: "9 / 16", label: "9:16 Portrait" },
  { value: "3 / 4", label: "3:4 Portrait" },
];

/**
 * Size Mode 세그먼트 컨트롤 (ADR-026)
 * Fixed / Fill / Hug 3버튼 토글 (내부 mode 값은 하위호환을 위해 "fit" 유지)
 * Phase 4: fillDisabled prop으로 Fill 버튼 비활성화 + 사유를 accessible label에 노출
 */
const SizeModeToggle = memo(function SizeModeToggle({
  axis,
  mode,
  onChange,
  fillDisabled,
  fillDisabledReason,
}: {
  axis: "width" | "height";
  mode: SizeMode;
  onChange: (mode: SizeMode) => void;
  fillDisabled?: boolean;
  fillDisabledReason?: string;
}) {
  const handleSelectionChange = useCallback(
    (keys: Set<Key>) => {
      const selected = Array.from(keys)[0] as SizeMode | undefined;
      if (selected) onChange(selected);
    },
    [onChange],
  );

  return (
    <ToggleButtonGroup
      aria-label={`${axis} size mode`}
      size="sm"
      indicator
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[mode]}
      onSelectionChange={handleSelectionChange}
    >
      <ToggleButton id="fixed" aria-label="Fixed">
        <Minus size={ICON_SIZE} strokeWidth={ICON_STROKE} />
      </ToggleButton>
      <ToggleButton
        id="fill"
        aria-label={
          fillDisabledReason ? `Fill (${fillDisabledReason})` : "Fill"
        }
        isDisabled={fillDisabled}
      >
        <MoveHorizontal
          size={ICON_SIZE}
          strokeWidth={ICON_STROKE}
          style={axis === "height" ? { transform: "rotate(90deg)" } : undefined}
        />
      </ToggleButton>
      <ToggleButton id="fit" aria-label="Hug">
        <Shrink size={ICON_SIZE} strokeWidth={ICON_STROKE} />
      </ToggleButton>
    </ToggleButtonGroup>
  );
});

const TransformSectionContent = memo(function TransformSectionContent() {
  const { updateStyleImmediate, updateStylePreview, updateStylesImmediate } =
    useOptimizedStyleActions();
  const selectedId = useStore((s) => s.selectedElementId);
  const bundle = useTransformValues(selectedId);

  // 기존 styleValues 인터페이스 어댑터 (문자열 값)
  //   ADR-082 A2: inline 없으면 Spec specDefault (containerStyles/composition 의 "100%",
  //   "fit-content", "300px" 등) 로 fallback — Appearance/Layout section 과 동일 패턴
  const styleValues = useMemo(() => {
    if (!bundle) return null;
    const toStr = (
      inline: string | number | undefined,
      specDefault: string | number | undefined,
      fallback = "",
    ): string => {
      if (inline !== undefined && inline !== null && inline !== "")
        return String(inline);
      if (specDefault !== undefined && specDefault !== null)
        return typeof specDefault === "number"
          ? `${specDefault}px`
          : String(specDefault);
      return fallback;
    };
    return {
      width: toStr(bundle.width.inline, bundle.width.specDefault, "auto"),
      height: toStr(bundle.height.inline, bundle.height.specDefault, "auto"),
      top: toStr(bundle.top.inline, bundle.top.specDefault, "auto"),
      left: toStr(bundle.left.inline, bundle.left.specDefault, "auto"),
      minWidth: toStr(bundle.minWidth.inline, bundle.minWidth.specDefault),
      maxWidth: toStr(bundle.maxWidth.inline, bundle.maxWidth.specDefault),
      minHeight: toStr(bundle.minHeight.inline, bundle.minHeight.specDefault),
      maxHeight: toStr(bundle.maxHeight.inline, bundle.maxHeight.specDefault),
      aspectRatio: toStr(
        bundle.aspectRatio.inline,
        bundle.aspectRatio.specDefault,
      ),
      isBody: bundle.isBody,
    };
  }, [bundle]);

  const canvasSize = useViewportSyncStore((state) => state.canvasSize);
  const hasConstraints = !!(
    styleValues?.minWidth ||
    styleValues?.maxWidth ||
    styleValues?.minHeight ||
    styleValues?.maxHeight ||
    styleValues?.aspectRatio
  );
  const [showConstraints, setShowConstraints] = useState(hasConstraints);

  // ADR-026: Size Mode (Zustand hooks)
  const widthMode = useWidthSizeMode(selectedId);
  const heightMode = useHeightSizeMode(selectedId);
  const parentDisplay = useParentDisplay(selectedId);
  const parentFlexDirection = useParentFlexDirection(selectedId);

  const handleSizeModeChange = useCallback(
    (axis: "width" | "height", mode: SizeMode) => {
      const currentValue =
        axis === "width" ? styleValues?.width : styleValues?.height;
      const effectiveSize =
        axis === "width" ? bundle?.width.effective : bundle?.height.effective;
      const fixedFallbackValue =
        effectiveSize !== undefined && Number.isFinite(effectiveSize)
          ? `${Math.max(0, Math.round(effectiveSize))}px`
          : undefined;
      const css = resolveSizeMode(
        mode,
        axis,
        parentDisplay,
        parentFlexDirection,
        currentValue,
        fixedFallbackValue,
      );
      const updates = sizeModeToStyleUpdates(css);
      updateStylesImmediate(updates);
    },
    [
      parentDisplay,
      parentFlexDirection,
      styleValues?.width,
      styleValues?.height,
      bundle?.width.effective,
      bundle?.height.effective,
      updateStylesImmediate,
    ],
  );

  const handleWidthModeChange = useCallback(
    (mode: SizeMode) => handleSizeModeChange("width", mode),
    [handleSizeModeChange],
  );

  const handleHeightModeChange = useCallback(
    (mode: SizeMode) => handleSizeModeChange("height", mode),
    [handleSizeModeChange],
  );

  const handleAspectRatioLock = useCallback(() => {
    if (hasEnabledAspectRatio(styleValues?.aspectRatio)) {
      updateStylesImmediate(
        buildAspectRatioStyleUpdates("", {
          width: styleValues?.width,
          height: styleValues?.height,
        }),
      );
    } else {
      const w = parseFloat(styleValues?.width ?? "0");
      const h = parseFloat(styleValues?.height ?? "0");
      const nextRatio = w > 0 && h > 0 ? `${w} / ${h}` : "1 / 1";
      updateStylesImmediate(
        buildAspectRatioStyleUpdates(nextRatio, {
          width: styleValues?.width,
          height: styleValues?.height,
        }),
      );
    }
  }, [
    styleValues?.aspectRatio,
    styleValues?.width,
    styleValues?.height,
    updateStylesImmediate,
  ]);

  if (!styleValues) return null;

  const displayWidth =
    styleValues.isBody && styleValues.width === "auto"
      ? String(canvasSize.width)
      : styleValues.width;
  const displayHeight =
    styleValues.isBody && styleValues.height === "auto"
      ? String(canvasSize.height)
      : styleValues.height;

  // Body 요소에서는 Size Mode 비표시
  const showSizeMode = !styleValues.isBody;

  // ADR-026 Phase 4: Fill 비활성화 힌트
  // Block 부모: Height Fill 불가 (Block은 높이 채우기 미지원)
  const isBlockParent =
    parentDisplay === "block" || parentDisplay === "inline-block";
  const heightFillDisabled = isBlockParent;
  const heightFillReason = isBlockParent ? "Block 부모에서 불가" : undefined;
  // Width Fill은 모든 부모에서 가능 (block: 100%, flex: flex-grow, grid: stretch)
  const widthFillDisabled = false;

  return (
    <>
      {showSizeMode && (
        <div className="transform-row">
          <fieldset className="properties-aria size-mode-width">
            <legend className="fieldset-legend">W Sizing</legend>
            <SizeModeToggle
              axis="width"
              mode={widthMode}
              onChange={handleWidthModeChange}
              fillDisabled={widthFillDisabled}
            />
          </fieldset>
          <fieldset className="properties-aria size-mode-height">
            <legend className="fieldset-legend">H Sizing</legend>
            <SizeModeToggle
              axis="height"
              mode={heightMode}
              onChange={handleHeightModeChange}
              fillDisabled={heightFillDisabled}
              fillDisabledReason={heightFillReason}
            />
          </fieldset>
        </div>
      )}
      <div className="transform-row">
        <PropertyUnitInput
          icon={RulerDimensionLine}
          label="Width"
          className="width"
          value={displayWidth}
          units={["reset", "px", "%", "vw"]}
          onChange={(value) => updateStyleImmediate("width", value)}
          onDrag={(value) => updateStylePreview("width", value)}
          min={0}
          max={9999}
        />
        <PropertyUnitInput
          icon={RulerDimensionLine}
          label="Height"
          className="height"
          value={displayHeight}
          units={["reset", "px", "%", "vh"]}
          onChange={(value) => updateStyleImmediate("height", value)}
          onDrag={(value) => updateStylePreview("height", value)}
          min={0}
          max={9999}
        />
        <div className="fieldset-actions actions-size">
          <SwatchIconButton
            aria-label="Toggle constraints"
            onPress={() => setShowConstraints((v) => !v)}
          >
            <ChevronsLeftRightEllipsis
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </SwatchIconButton>
        </div>
      </div>

      {showConstraints && !styleValues.isBody && (
        <div className="transform-constraints">
          <PropertyUnitInput
            label="Min W"
            className="min-width"
            value={styleValues.minWidth}
            units={["reset", "px", "%", "rem", "vw"]}
            onChange={(value) => updateStyleImmediate("minWidth", value)}
            onDrag={(value) => updateStylePreview("minWidth", value)}
            min={0}
            max={9999}
          />
          <PropertyUnitInput
            label="Max W"
            className="max-width"
            value={styleValues.maxWidth}
            units={["reset", "px", "%", "rem", "vw"]}
            onChange={(value) => updateStyleImmediate("maxWidth", value)}
            onDrag={(value) => updateStylePreview("maxWidth", value)}
            min={0}
            max={9999}
          />
          <div className="fieldset-actions actions-constraint-w" />
          <PropertyUnitInput
            label="Min H"
            className="min-height"
            value={styleValues.minHeight}
            units={["reset", "px", "%", "rem", "vh"]}
            onChange={(value) => updateStyleImmediate("minHeight", value)}
            onDrag={(value) => updateStylePreview("minHeight", value)}
            min={0}
            max={9999}
          />
          <PropertyUnitInput
            label="Max H"
            className="max-height"
            value={styleValues.maxHeight}
            units={["reset", "px", "%", "rem", "vh"]}
            onChange={(value) => updateStyleImmediate("maxHeight", value)}
            onDrag={(value) => updateStylePreview("maxHeight", value)}
            min={0}
            max={9999}
          />
          <div className="fieldset-actions actions-constraint-h" />
          <div className="aspect-ratio-field">
            <PropertySelect
              icon={Ratio}
              label="Ratio"
              className="aspect-ratio-select"
              value={styleValues.aspectRatio || ""}
              options={ASPECT_RATIO_OPTIONS}
              onChange={(value) =>
                updateStylesImmediate(
                  buildAspectRatioStyleUpdates(value, {
                    width: styleValues.width,
                    height: styleValues.height,
                  }),
                )
              }
            />
            <SwatchIconButton
              aria-label="Lock aspect ratio"
              onPress={handleAspectRatioLock}
            >
              {styleValues.aspectRatio ? (
                <Lock
                  color={iconProps.color}
                  size={iconProps.size}
                  strokeWidth={iconProps.strokeWidth}
                />
              ) : (
                <Unlock
                  color={iconProps.color}
                  size={iconProps.size}
                  strokeWidth={iconProps.strokeWidth}
                />
              )}
            </SwatchIconButton>
          </div>
        </div>
      )}

      <div className="transform-row">
        <PropertyUnitInput
          icon={ArrowRightFromLine}
          label="Left"
          className="left"
          value={styleValues.left}
          units={["reset", "px", "%", "vh", "vw"]}
          onChange={(value) => updateStyleImmediate("left", value)}
          onDrag={(value) => updateStylePreview("left", value)}
          min={-9999}
          max={9999}
        />
        <PropertyUnitInput
          icon={ArrowDownFromLine}
          label="Top"
          className="top"
          value={styleValues.top}
          units={["reset", "px", "%", "vh", "vw"]}
          onChange={(value) => updateStyleImmediate("top", value)}
          onDrag={(value) => updateStylePreview("top", value)}
          min={-9999}
          max={9999}
        />
        <div className="fieldset-actions actions-position">
          <SwatchIconButton aria-label="More position options">
            <EllipsisVertical
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </SwatchIconButton>
        </div>
      </div>
    </>
  );
});

/**
 * TransformSection - 외부 래퍼 (PropertySection 관리)
 */
const TRANSFORM_PROPS = [
  "width",
  "height",
  "top",
  "left",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "justifySelf",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "aspectRatio",
];

export const TransformSection = memo(function TransformSection() {
  const resetStyles = useResetStyles();
  const hasDirty = useHasDirtyStyles(TRANSFORM_PROPS);

  const handleReset = () => {
    resetStyles(TRANSFORM_PROPS);
  };

  return (
    <PropertySection
      id="transform"
      title="Transform"
      onReset={hasDirty ? handleReset : undefined}
    >
      <TransformSectionContent />
    </PropertySection>
  );
});
