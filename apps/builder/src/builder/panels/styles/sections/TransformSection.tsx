/**
 * TransformSection - Transform 스타일 편집 섹션
 *
 * Size (ADR-026 Size Mode — Hug · Fill 은 W/H 단위 메뉴 안, panel-ui 01 「fit W」), Position 편집.
 * Alignment는 Layout 섹션의 3x3 Flex alignment로 통합됨.
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  PropertySection,
  PropertyUnitInput,
  PropertySelect,
} from "../../../components";
import { type BreakpointName } from "@composition/shared";
import { parsePadding4Way } from "@composition/specs";
import { resolveBorderGeometry } from "../../../workspace/canvas/styleConversion/borderGeometry";
import {
  SwatchIconButton,
  SwatchIconToggleButton,
} from "../../../components/ui";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { Lock, Unlock, UnfoldVertical } from "lucide-react";
import { LayoutFreeform } from "../../../components/icons";
import { useOptimizedStyleActions } from "../hooks/useOptimizedStyleActions";
import { useLayoutPresentationActions } from "../hooks/useLayoutPresentationActions";
import { useTransformValues } from "../hooks/useTransformValues";
import { useSemanticLabel } from "../../../../i18n";
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
  type SizeMode,
} from "../../../stores/utils/sizeModeResolver";
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
  // ADR-219 — 변별 폭은 helper 하나로 (longhand ?? shorthand ?? border 단축)
  const { widths } = resolveBorderGeometry(style as Record<string, unknown>);
  const borderTop = widths[0];
  const borderLeft = widths[3];

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
        unitSuffix
        className="left"
        value={`${displayX}px`}
        units={["px"]}
        onChange={handleXCommit}
        min={-99999}
        max={99999}
      />
      <PropertyUnitInput
        label="Y"
        unitSuffix
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
 * 훅은 두 번 돌지만 layout 실측 구독은 자기 축만 (Size = w/h · Position = x/y) 이라 캔버스
 * 드래그/리사이즈가 상대 절을 다시 그리지 않는다 (panel-ui 01, 2026-09-14).
 */
type TransformSectionPart = "size" | "position";

const TransformSectionContent = memo(function TransformSectionContent({
  part,
}: {
  part: TransformSectionPart;
}) {
  const localize = useSemanticLabel();
  const { updateStyleImmediate, updateStylePreview, updateStylesImmediate } =
    useOptimizedStyleActions();
  const { commitLayoutPresentation, previewLayoutPresentation } =
    useLayoutPresentationActions();
  const selectedId = useStore((s) => s.selectedElementId);
  const bundle = useTransformValues(selectedId, part);

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
      // Min/Max 에 사용자 인라인 값이 하나라도 있는가 (spec 기본값은 제외 — 펼침 토글 자동 on 판정)
      hasInlineConstraint: (
        [
          bundle.minWidth,
          bundle.maxWidth,
          bundle.minHeight,
          bundle.maxHeight,
        ] as const
      ).some(
        (tier) =>
          tier.inline !== undefined &&
          tier.inline !== null &&
          String(tier.inline).trim() !== "",
      ),
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

  // W/H 필드 commit — 단위 메뉴의 "fill" · "fit-content" 는 Size Mode 명령 (flexGrow ·
  //   alignSelf 등 부모 문맥별 CSS 를 sizeModeResolver 가 정한다). Fill 상태에서 숫자를
  //   치면 Fixed 로 — fill 속성을 같이 지운다 (종전 Fixed 토글과 같은 경로).
  const commitAxisValue = useCallback(
    (axis: "width" | "height", value: string) => {
      const mode = axis === "width" ? widthMode : heightMode;
      if (value === "fill") {
        handleSizeModeChange(axis, "fill");
        return;
      }
      if (value === "fit-content") {
        handleSizeModeChange(axis, "fit");
        return;
      }
      if (mode === "fill" && value !== "") {
        updateStylesImmediate(
          sizeModeToStyleUpdates(
            resolveSizeMode(
              "fixed",
              axis,
              parentDisplay,
              parentFlexDirection,
              value,
              value,
            ),
          ),
        );
        return;
      }
      if (!commitLayoutPresentation(axis, value)) {
        updateStyleImmediate(axis, value);
      }
    },
    [
      widthMode,
      heightMode,
      handleSizeModeChange,
      updateStylesImmediate,
      parentDisplay,
      parentFlexDirection,
      commitLayoutPresentation,
      updateStyleImmediate,
    ],
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

  // Min/Max 4 필드 펼침 — 토글 on 이거나 값이 하나라도 있으면 보인다 (Border 코너 토글과 같은 규칙,
  //   2026-09-15 사용자 판정). hook 순서를 위해 early return 앞.
  const [constraintsOpen, setConstraintsOpen] = useState(false);
  const showConstraints =
    constraintsOpen || Boolean(styleValues?.hasInlineConstraint);

  if (!styleValues) return null;

  const isAbsolutePositioned = styleValues.position === "absolute";
  // Fill 모드 (flexGrow · alignSelf stretch) 는 width/height 값이 비어 있다 — 필드에 "fill" 로
  const displayWidth =
    styleValues.isBody && styleValues.width === "auto"
      ? String(canvasSize.width)
      : !styleValues.isBody && widthMode === "fill"
        ? "fill"
        : styleValues.width;
  const displayHeight =
    styleValues.isBody && styleValues.height === "auto"
      ? String(canvasSize.height)
      : !styleValues.isBody && heightMode === "fill"
        ? "fill"
        : styleValues.height;

  // ADR-026 Phase 4: Block 부모는 Height Fill 불가 (높이 채우기 미지원) — 단위 메뉴에서 뺀다
  const isBlockParent =
    parentDisplay === "block" || parentDisplay === "inline-block";
  const sizeModeUnits = (axis: "width" | "height") =>
    styleValues.isBody
      ? []
      : axis === "height" && isBlockParent
        ? ["fit-content"]
        : ["fit-content", "fill"];

  if (part === "position") {
    return pagePositionPageId ? (
      <PagePositionRow pageId={pagePositionPageId} />
    ) : styleValues.isBody ? null : (
      <div className="transform-row">
        <PropertyUnitInput
          label="Left"
          unitSuffix
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
          unitSuffix
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

  // Size — 5행: 「Width | Height」 · 「Min W | Min H」 · 「Max W | Max H」 · 「Ratio (열 2) · lock 28」 ·
  //   「Overflow (열 2)」. 라벨은 Gap 과 같은 legend (fieldset legend 위 · 상자 아래), 단위는 상자 안
  //   트리거 (unitSuffix — 「100 PX」 · 키워드는 「fill —」). 시안 (panel-ui 01) 의 필드 안 suffix
  //   라벨은 2026-09-15 사용자 판정으로 legend 로 되돌렸다. Hug · Fill 은 W/H 단위 메뉴
  //   (fit-content · fill). 제약은 항상 보인다.
  return (
    <>
      <div className="transform-row">
        <PropertyUnitInput
          label="Width"
          unitSuffix
          className="width"
          value={displayWidth}
          units={["reset", "px", "%", "vw", ...sizeModeUnits("width")]}
          onChange={(value) => commitAxisValue("width", value)}
          onDrag={(value) =>
            previewLayoutPresentation("width", value) ||
            updateStylePreview("width", value)
          }
          min={0}
          max={9999}
        />
        <PropertyUnitInput
          label="Height"
          unitSuffix
          className="height"
          value={displayHeight}
          units={["reset", "px", "%", "vh", ...sizeModeUnits("height")]}
          onChange={(value) => commitAxisValue("height", value)}
          onDrag={(value) =>
            previewLayoutPresentation("height", value) ||
            updateStylePreview("height", value)
          }
          min={0}
          max={9999}
        />
        <div className="fieldset-actions actions-size">
          {!styleValues.isBody && (
            <SwatchIconToggleButton
              aria-label={localize("Size constraints")}
              isSelected={showConstraints}
              onChange={setConstraintsOpen}
            >
              <UnfoldVertical
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </SwatchIconToggleButton>
          )}
        </div>
      </div>

      {!styleValues.isBody && (
        <div
          className="transform-constraints"
          data-constraints={showConstraints ? "open" : "closed"}
        >
          {showConstraints && (
          <>
          <PropertyUnitInput
            label="Min W"
            unitSuffix
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
            label="Min H"
            unitSuffix
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
          <div className="fieldset-actions actions-constraint-min" />
          <PropertyUnitInput
            label="Max W"
            unitSuffix
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
          <PropertyUnitInput
            label="Max H"
            unitSuffix
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
          <div className="fieldset-actions actions-constraint-max" />
          </>
          )}
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
          <div className="fieldset-actions actions-ratio">
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
          <div className="fieldset-actions actions-overflow" />
        </div>
      )}
    </>
  );
});

/**
 * Size 절 · Position 절 (panel-ui 01, 2026-09-14) — 탭 안 순서는 Layout → Size → Spacing →
 * Position 이라 (panel-ui 01 · 대조 B1) 두 절을 따로 export 한다. TransformSection 은 둘을
 * 이어 그리는 호환 래퍼.
 *
 * 절 id "transform" 은 collapse persist 키라 그대로 (제목만 "Size"). Position 은 접힌
 * 채로 시작하고 position 이 absolute 가 되면 펼친다 — static 요소에서 Left/Top 은
 * 비활성이라 펼칠 이유가 없다. reset 범위는 SIZE_PROPS / POSITION_PROPS 로 나눈다
 * (합집합 = TRANSFORM_PROPS, responsiveEligible 게이트와 단일 소스).
 */
export const SizeSection = memo(function SizeSection() {
  const resetStyles = useResetStyles();
  const hasSizeDirty = useHasDirtyStyles(SIZE_PROPS);
  return (
    <PropertySection
      id="transform"
      title="Size"
      onReset={hasSizeDirty ? () => resetStyles(SIZE_PROPS) : undefined}
    >
      <TransformSectionContent part="size" />
    </PropertySection>
  );
});

export const PositionSection = memo(function PositionSection() {
  const resetStyles = useResetStyles();
  const hasPositionDirty = useHasDirtyStyles(POSITION_PROPS);
  const selectedId = useStore((s) => s.selectedElementId);
  // 접힘 판정은 inline position 만 — layout 실측 구독 0
  const bundle = useTransformValues(selectedId, "none");
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
    <PropertySection
      id={POSITION_SECTION_ID}
      title="Position"
      onReset={
        hasPositionDirty ? () => resetStyles(POSITION_PROPS) : undefined
      }
    >
      <TransformSectionContent part="position" />
    </PropertySection>
  );
});

export const TransformSection = memo(function TransformSection() {
  return (
    <>
      <SizeSection />
      <PositionSection />
    </>
  );
});
