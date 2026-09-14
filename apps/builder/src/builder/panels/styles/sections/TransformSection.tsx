/**
 * TransformSection - Transform 스타일 편집 섹션
 *
 * Size (ADR-026 Size Mode), Position 편집.
 * Alignment는 Layout 섹션의 3x3 Flex alignment로 통합됨.
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import type { Key } from "react-aria-components/Collection";
import {
  PropertySection,
  PropertyUnitInput,
  PropertySelect,
} from "../../../components";
import {
  ToggleButton,
  ToggleButtonGroup,
} from "@composition/shared/components";
import { type BreakpointName } from "@composition/shared";
import {
  parseBorderWidth,
  parsePadding4Way,
  parsePxValue,
} from "@composition/specs";
import {
  SwatchIconButton,
  SwatchIconToggleButton,
} from "../../../components/ui";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { Minus, MoveHorizontal, Shrink, Lock, Unlock } from "lucide-react";
import { LayoutFreeform } from "../../../components/icons";
import { useOptimizedStyleActions } from "../hooks/useOptimizedStyleActions";
import { useLayoutPresentationActions } from "../hooks/useLayoutPresentationActions";
import { useTransformValues } from "../hooks/useTransformValues";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../../i18n";
import {
  useWidthSizeMode,
  useHeightSizeMode,
  useParentDisplay,
  useParentFlexDirection,
} from "../hooks/useTransformAuxiliary";
import { useStore } from "../../../stores";
import { historyManager } from "../../../stores/history";
import { useCanonicalPropertyElement } from "../../properties/hooks/useCanonicalPropertyRead";
import {
  getPagePositionPresentationSnapshot,
  subscribePagePositionPresentation,
} from "../../../workspace/canvas/interaction/pagePositionPresentation";
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
import { getSceneBounds } from "../../../workspace/canvas/skia/renderCommands";
import type { BoundingBox } from "../../../workspace/canvas/selection/types";
import { resolveResponsiveStyleMap } from "../../../workspace/canvas/layout/resolveResponsive";
import { resolveContainerStylesFallback } from "../../../workspace/canvas/layout/engines/implicitStyles";
import type { CanvasLayoutNode } from "../../../workspace/canvas/layout/layoutNode";
import { resolveAbsolutePositionActivationStyles } from "./transformUtils";
import { POSITION_PROPS, SIZE_PROPS } from "./styleSectionProps";
import {
  isSectionCollapsedInState,
  useSectionCollapse,
} from "../hooks/useSectionCollapse";
import { OVERFLOW_OPTIONS } from "../constants/styleOptions";

const POSITION_SECTION_ID = "position";

const ICON_SIZE = 14;
const ICON_STROKE = 1.5;

function resolveAbsoluteContainingBlockBounds(
  parent: CanvasLayoutNode,
  parentBounds: BoundingBox,
  activeBreakpoint: BreakpointName,
): BoundingBox {
  const rawStyle = (parent.props?.style ?? {}) as Record<string, unknown>;
  const responsiveStyle = resolveResponsiveStyleMap(
    rawStyle,
    parent.responsive,
    activeBreakpoint,
  );
  const type = parent.type.toLowerCase();
  const style = {
    ...resolveContainerStylesFallback(type, responsiveStyle),
    ...responsiveStyle,
  };
  const padding = parsePadding4Way(style);
  const borderWidth = parseBorderWidth(style.borderWidth ?? style.border, 0);
  const borderLeft = parsePxValue(
    style.borderLeftWidth ?? style.borderLeft,
    borderWidth,
  );
  const borderTop = parsePxValue(
    style.borderTopWidth ?? style.borderTop,
    borderWidth,
  );

  // Skia absolute layout은 부모 border-box가 아닌 border+padding 이후의 콘텐츠
  // 원점을 left/top 0으로 사용한다. 토글 전환도 동일 원점을 써야 시각 좌표가 보존된다.
  return {
    ...parentBounds,
    x: parentBounds.x + borderLeft + padding.left,
    y: parentBounds.y + borderTop + padding.top,
  };
}

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
  const i18n = useOptionalI18n();
  const localize = (label: string) =>
    i18n
      ? translateKey(i18n.t, semanticLabelKeys[label] ?? label, label)
      : label;
  const handleSelectionChange = useCallback(
    (keys: Set<Key>) => {
      const selected = Array.from(keys)[0] as SizeMode | undefined;
      if (selected) onChange(selected);
    },
    [onChange],
  );

  return (
    <ToggleButtonGroup
      aria-label={localize(
        axis === "width" ? "Width size mode" : "Height size mode",
      )}
      size="sm"
      indicator
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[mode]}
      onSelectionChange={handleSelectionChange}
    >
      <ToggleButton id="fixed" aria-label={localize("Fixed")}>
        <Minus size={ICON_SIZE} strokeWidth={ICON_STROKE} />
      </ToggleButton>
      <ToggleButton
        id="fill"
        aria-label={
          fillDisabledReason
            ? `${localize("Fill")} (${fillDisabledReason})`
            : localize("Fill")
        }
        isDisabled={fillDisabled}
      >
        <MoveHorizontal
          size={ICON_SIZE}
          strokeWidth={ICON_STROKE}
          style={axis === "height" ? { transform: "rotate(90deg)" } : undefined}
        />
      </ToggleButton>
      <ToggleButton id="fit" aria-label={localize("Hug")}>
        <Shrink size={ICON_SIZE} strokeWidth={ICON_STROKE} />
      </ToggleButton>
    </ToggleButtonGroup>
  );
});

/**
 * 페이지 X/Y row (ADR-177 적응형 통합) — 드래그 중 실시간 표시.
 *
 * 커밋 값은 store pagePositions 를 구독하고, 드래그 중에는 ADR-176/178 의
 * transient 채널(pagePositionPresentation.activeOverrides)을 직접 구독한다 —
 * Zustand set 무경유라 드래그 프레임이 전역 셀렉터 sweep 을 유발하지 않고,
 * 스냅샷을 반올림 정수 문자열로 잘라 표시값이 실제 바뀐 프레임에만 이 row
 * 하나가 재렌더된다 (드래그 중이 아닐 땐 notify 자체가 없음 — 비용 0).
 */
const PagePositionRow = memo(function PagePositionRow({
  pageId,
}: {
  pageId: string;
}) {
  const pagePosition = useStore((s) => s.pagePositions[pageId]);
  const liveKey = useSyncExternalStore(
    subscribePagePositionPresentation,
    () => {
      const snap = getPagePositionPresentationSnapshot();
      const override = snap.isActive
        ? snap.activeOverrides?.get(pageId)
        : undefined;
      return override
        ? `${Math.round(override.x)}:${Math.round(override.y)}`
        : null;
    },
  );

  const handleCommit = useCallback(
    (axis: "x" | "y", value: string) => {
      const parsed = Number.parseFloat(value);
      if (!Number.isFinite(parsed)) return;
      const state = useStore.getState();
      const current = state.pagePositions[pageId];
      if (!current) return;
      state.updatePagePosition(
        pageId,
        axis === "x" ? parsed : current.x,
        axis === "y" ? parsed : current.y,
      );
    },
    [pageId],
  );
  const handleXCommit = useCallback(
    (value: string) => handleCommit("x", value),
    [handleCommit],
  );
  const handleYCommit = useCallback(
    (value: string) => handleCommit("y", value),
    [handleCommit],
  );

  if (!pagePosition) return null;

  const live = liveKey ? liveKey.split(":") : null;
  const displayX = live ? live[0] : String(Math.round(pagePosition.x));
  const displayY = live ? live[1] : String(Math.round(pagePosition.y));

  return (
    <div className="transform-row">
      {/* 페이지 캔버스 위치 — 값/undo 는 updatePagePosition 계약 그대로 (ADR-177) */}
      <PropertyUnitInput
        label="X"
        labelMode="suffix"
        className="left"
        value={`${displayX}px`}
        units={["px"]}
        onChange={handleXCommit}
        min={-99999}
        max={99999}
      />
      <PropertyUnitInput
        label="Y"
        labelMode="suffix"
        className="top"
        value={`${displayY}px`}
        units={["px"]}
        onChange={handleYCommit}
        min={-99999}
        max={99999}
      />
      <div className="fieldset-actions actions-position" />
    </div>
  );
});

/**
 * Size / Position 두 절이 같은 값 묶음 (useTransformValues) 을 읽는다 — 절 하나당 마운트라
 * 훅은 두 번 돌지만 값은 같은 store 구독이라 비용은 미미하다 (panel-ui 01, 2026-09-14).
 */
type TransformSectionPart = "size" | "position";

const TransformSectionContent = memo(function TransformSectionContent({
  part,
}: {
  part: TransformSectionPart;
}) {
  const i18n = useOptionalI18n();
  /** 패널 자체 문구 — provider 밖(격리 렌더)이면 키를 그대로 돌려준다. */
  const t = (key: string) => (i18n ? i18n.t(key) : key);
  const localize = (label: string) =>
    i18n
      ? translateKey(i18n.t, semanticLabelKeys[label] ?? label, label)
      : label;
  const { updateStyleImmediate, updateStylePreview, updateStylesImmediate } =
    useOptimizedStyleActions();
  const { commitLayoutPresentation, previewLayoutPresentation } =
    useLayoutPresentationActions();
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
      position: toStr(
        bundle.position.inline,
        bundle.position.specDefault,
        "static",
      ),
      top: toStr(bundle.top.inline, bundle.top.specDefault),
      left: toStr(bundle.left.inline, bundle.left.specDefault),
      minWidth: toStr(bundle.minWidth.inline, bundle.minWidth.specDefault),
      maxWidth: toStr(bundle.maxWidth.inline, bundle.maxWidth.specDefault),
      minHeight: toStr(bundle.minHeight.inline, bundle.minHeight.specDefault),
      maxHeight: toStr(bundle.maxHeight.inline, bundle.maxHeight.specDefault),
      aspectRatio: toStr(
        bundle.aspectRatio.inline,
        bundle.aspectRatio.specDefault,
      ),
      overflow: toStr(
        bundle.overflow.inline,
        bundle.overflow.specDefault,
        "visible",
      ),
      isBody: bundle.isBody,
    };
  }, [bundle]);

  const canvasSize = useViewportSyncStore((state) => state.canvasSize);

  // ADR-177 적응형 통합 — body 선택 시 position row 는 CSS left/top 이 아니라
  // 페이지 캔버스 위치(pagePositions)를 편집한다 (Pen/Figma 단일 Position 어법).
  // 실제 page body (page_id 보유 + stale mismatch 아님) 한정 — projection/frame
  // body 는 페이지 이동 대상이 아니므로 position row 자체를 숨긴다.
  const selectedElement = useCanonicalPropertyElement(selectedId ?? "");
  const currentPageId = useStore((s) => s.currentPageId);
  const selectedElementPageId = selectedElement?.page_id ?? null;
  const hasStalePageMismatch =
    selectedElementPageId != null &&
    currentPageId != null &&
    selectedElementPageId !== currentPageId;
  const pagePositionPageId =
    styleValues?.isBody &&
    !hasStalePageMismatch &&
    selectedElementPageId != null
      ? selectedElementPageId
      : null;

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

  const commitAbsoluteActivation = useCallback(
    (styles: Record<string, string>) => {
      const state = useStore.getState();
      const elementId = state.selectedElementId;
      if (!elementId) {
        updateStylesImmediate(styles);
        return;
      }

      historyManager.runInTransaction({ type: "batch", elementId }, () => {
        updateStylesImmediate(styles);
        useStore.getState().moveElementToSiblingEdge(elementId, "front");
      });
    },
    [updateStylesImmediate],
  );

  const handleAbsolutePositionChange = useCallback(
    (isSelected: boolean) => {
      if (!isSelected) {
        updateStyleImmediate("position", "");
        return;
      }

      const isFlexParent =
        parentDisplay === "flex" || parentDisplay === "inline-flex";
      if (isFlexParent) {
        const state = useStore.getState();
        const elementId = state.selectedElementId;
        const element = elementId
          ? state.elementsMap.get(elementId)
          : undefined;
        const parentId = element?.parent_id;
        if (elementId && parentId) {
          const parent = state.elementsMap.get(parentId);
          const parentBounds = getSceneBounds(parentId);
          const activationStyles = resolveAbsolutePositionActivationStyles(
            getSceneBounds(elementId),
            parent && parentBounds
              ? resolveAbsoluteContainingBlockBounds(
                  parent,
                  parentBounds,
                  state.activeBreakpoint,
                )
              : parentBounds,
          );
          if (activationStyles) {
            commitAbsoluteActivation(activationStyles);
            return;
          }
        }
      }

      commitAbsoluteActivation({ position: "absolute" });
    },
    [commitAbsoluteActivation, parentDisplay, updateStyleImmediate],
  );

  if (!styleValues) return null;

  const isAbsolutePositioned = styleValues.position === "absolute";
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
  const heightFillReason = isBlockParent
    ? t("propertiesPanel.heightFillBlockParent")
    : undefined;
  // Width Fill은 모든 부모에서 가능 (block: 100%, flex: flex-grow, grid: stretch)
  const widthFillDisabled = false;

  if (part === "position") {
    return pagePositionPageId ? (
      <PagePositionRow pageId={pagePositionPageId} />
    ) : styleValues.isBody ? null : (
      <div className="transform-row">
        <PropertyUnitInput
          label="Left"
          labelMode="suffix"
          className="left"
          value={isAbsolutePositioned ? styleValues.left : "auto"}
          units={["px", "%", "vw"]}
          preserveEmptyValueOnUnitChange
          allowEmptyReset
          isDisabled={!isAbsolutePositioned}
          placeholder="auto"
          onChange={(value) => updateStyleImmediate("left", value)}
          onDrag={(value) => updateStylePreview("left", value)}
          min={-9999}
          max={9999}
        />
        <PropertyUnitInput
          label="Top"
          labelMode="suffix"
          className="top"
          value={isAbsolutePositioned ? styleValues.top : "auto"}
          units={["px", "%", "vh"]}
          preserveEmptyValueOnUnitChange
          allowEmptyReset
          isDisabled={!isAbsolutePositioned}
          placeholder="auto"
          onChange={(value) => updateStyleImmediate("top", value)}
          onDrag={(value) => updateStylePreview("top", value)}
          min={-9999}
          max={9999}
        />
        <div className="fieldset-actions actions-position">
          <SwatchIconToggleButton
            aria-label={localize("Absolute position")}
            isSelected={styleValues.position === "absolute"}
            onChange={handleAbsolutePositionChange}
          >
            <LayoutFreeform
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </SwatchIconToggleButton>
        </div>
      </div>
    );
  }

  // Size — 라벨은 필드 안 suffix (W · H · MIN · MAX — 축은 열이 말한다), 행 28. 제약(min/max/ratio)은 항상
  //   보인다 (종전 토글 뒤에 숨김). Overflow 는 Appearance 에서 여기로 (크기의 일부).
  return (
    <>
      {showSizeMode && (
        <div className="transform-row">
          <fieldset className="properties-aria size-mode-width">
            <legend className="fieldset-legend">{localize("W Sizing")}</legend>
            <SizeModeToggle
              axis="width"
              mode={widthMode}
              onChange={handleWidthModeChange}
              fillDisabled={widthFillDisabled}
            />
          </fieldset>
          <fieldset className="properties-aria size-mode-height">
            <legend className="fieldset-legend">{localize("H Sizing")}</legend>
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
          label="Width"
          labelMode="suffix"
          suffixLabel="W"
          className="width"
          value={displayWidth}
          units={["reset", "px", "%", "vw"]}
          onChange={(value) =>
            commitLayoutPresentation("width", value) ||
            updateStyleImmediate("width", value)
          }
          onDrag={(value) =>
            previewLayoutPresentation("width", value) ||
            updateStylePreview("width", value)
          }
          min={0}
          max={9999}
        />
        <PropertyUnitInput
          label="Height"
          labelMode="suffix"
          suffixLabel="H"
          className="height"
          value={displayHeight}
          units={["reset", "px", "%", "vh"]}
          onChange={(value) =>
            commitLayoutPresentation("height", value) ||
            updateStyleImmediate("height", value)
          }
          onDrag={(value) =>
            previewLayoutPresentation("height", value) ||
            updateStylePreview("height", value)
          }
          min={0}
          max={9999}
        />
        <div className="fieldset-actions actions-size" />
      </div>

      {!styleValues.isBody && (
        <div className="transform-constraints">
          <PropertyUnitInput
            label="Min W"
            labelMode="suffix"
            suffixLabel="MIN"
            placeholder="auto"
            className="min-width"
            value={styleValues.minWidth}
            units={["reset", "px", "%", "vw"]}
            preserveEmptyValueOnUnitChange
            onChange={(value) => updateStyleImmediate("minWidth", value)}
            onDrag={(value) => updateStylePreview("minWidth", value)}
            min={0}
            max={9999}
          />
          <PropertyUnitInput
            label="Max W"
            labelMode="suffix"
            suffixLabel="MAX"
            placeholder="auto"
            className="max-width"
            value={styleValues.maxWidth}
            units={["reset", "px", "%", "vw"]}
            preserveEmptyValueOnUnitChange
            onChange={(value) => updateStyleImmediate("maxWidth", value)}
            onDrag={(value) => updateStylePreview("maxWidth", value)}
            min={0}
            max={9999}
          />
          <div className="fieldset-actions actions-constraint-w" />
          <PropertyUnitInput
            label="Min H"
            labelMode="suffix"
            suffixLabel="MIN"
            placeholder="auto"
            className="min-height"
            value={styleValues.minHeight}
            units={["reset", "px", "%", "vh"]}
            preserveEmptyValueOnUnitChange
            onChange={(value) => updateStyleImmediate("minHeight", value)}
            onDrag={(value) => updateStylePreview("minHeight", value)}
            min={0}
            max={9999}
          />
          <PropertyUnitInput
            label="Max H"
            labelMode="suffix"
            suffixLabel="MAX"
            placeholder="auto"
            className="max-height"
            value={styleValues.maxHeight}
            units={["reset", "px", "%", "vh"]}
            preserveEmptyValueOnUnitChange
            onChange={(value) => updateStyleImmediate("maxHeight", value)}
            onDrag={(value) => updateStylePreview("maxHeight", value)}
            min={0}
            max={9999}
          />
          <div className="fieldset-actions actions-constraint-h" />
          <div className="aspect-ratio-field">
            <PropertySelect
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
              aria-label={localize("Lock aspect ratio")}
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
          <PropertySelect
            label="Overflow"
            className="overflow"
            value={styleValues.overflow}
            options={OVERFLOW_OPTIONS}
            onChange={(value) => updateStyleImmediate("overflow", value)}
          />
        </div>
      )}
    </>
  );
});

/**
 * TransformSection - 외부 래퍼: Size 절 + Position 절 (panel-ui 01, 2026-09-14).
 *
 * 절 id "transform" 은 collapse persist 키라 그대로 (제목만 "Size"). Position 은 접힌
 * 채로 시작하고 position 이 absolute 가 되면 펼친다 — static 요소에서 Left/Top 은
 * 비활성이라 펼칠 이유가 없다. reset 범위는 SIZE_PROPS / POSITION_PROPS 로 나눈다
 * (합집합 = TRANSFORM_PROPS, responsiveEligible 게이트와 단일 소스).
 */
export const TransformSection = memo(function TransformSection() {
  const resetStyles = useResetStyles();
  const hasSizeDirty = useHasDirtyStyles(SIZE_PROPS);
  const hasPositionDirty = useHasDirtyStyles(POSITION_PROPS);
  const selectedId = useStore((s) => s.selectedElementId);
  const bundle = useTransformValues(selectedId);
  const isAbsolute = bundle?.position.inline === "absolute";
  const expandSections = useSectionCollapse((s) => s.expandSections);
  const positionCollapsed = useSectionCollapse((s) =>
    isSectionCollapsedInState(s, POSITION_SECTION_ID),
  );

  // position ≠ static 이 되면 Position 절을 자동으로 펼친다 (한 번 — 사용자가 다시 접을 수 있다)
  const wasAbsoluteRef = useRef(isAbsolute);
  useEffect(() => {
    if (isAbsolute && !wasAbsoluteRef.current && positionCollapsed) {
      expandSections([POSITION_SECTION_ID]);
    }
    wasAbsoluteRef.current = isAbsolute;
  }, [isAbsolute, positionCollapsed, expandSections]);

  return (
    <>
      <PropertySection
        id="transform"
        title="Size"
        onReset={hasSizeDirty ? () => resetStyles(SIZE_PROPS) : undefined}
      >
        <TransformSectionContent part="size" />
      </PropertySection>
      <PropertySection
        id={POSITION_SECTION_ID}
        title="Position"
        onReset={
          hasPositionDirty ? () => resetStyles(POSITION_PROPS) : undefined
        }
      >
        <TransformSectionContent part="position" />
      </PropertySection>
    </>
  );
});
