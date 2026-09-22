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
  useFillGrow,
  useParentDisplay,
  useParentFlexDirection,
} from "../hooks/useTransformAuxiliary";
import { readImmediateSelectionSnapshot, useStore } from "../../../stores";
import {
  commitPagePlacementFromPoint,
  isPagePlacementEditable,
} from "../../../stores/utils/pagePlacementCommit";
import { useElementStyleContext } from "../hooks/useElementStyleContext";
import { getFillBehavior, getRatioDependentAxis } from "@composition/shared";
import { historyManager } from "../../../stores/history";
import { useCanonicalPropertyElement } from "../../properties/hooks/useCanonicalPropertyRead";
import {
  getPagePositionPresentationSnapshot,
  subscribePagePositionPresentation,
} from "../../../workspace/canvas/interaction/pagePositionPresentation";
import { useResetStyles, useHasDirtyStyles } from "../hooks/useResetStyles";
import { useViewportSyncStore } from "../../../workspace/canvas/stores";
import { hasEnabledAspectRatio } from "../../../utils/aspectRatio";
import type { RatioEditError } from "../../../stores/inspectorActions";

/** Ratio 복합 명령 오류 코드 → semantic label (labels.ts 가 키로, translations 가 ko/en 으로). */
const RATIO_ERROR_LABELS: Record<RatioEditError, string> = {
  "selection-changed": "Selection changed. Try again",
  "target-missing": "Selected element not found",
  "geometry-missing":
    "Size not measured yet. Wait for layout or pick a Ratio preset",
  "tier-geometry-missing":
    "Open each screen size (Desktop, Tablet, Mobile) once, then try again",
  "document-changed": "Document changed. Try again",
};
import { getSceneBounds } from "../../../workspace/canvas/skia/renderCommands";
import type { BoundingBox } from "../../../workspace/canvas/selection/types";
import { resolveResponsiveStyleMap } from "../../../workspace/canvas/layout/resolveResponsive";
import { resolveContainerStylesFallback } from "../../../workspace/canvas/layout/engines/implicitStyles";
import type { CanvasLayoutNode } from "../../../workspace/canvas/layout/layoutNode";
import {
  hasSizeConstraintConflict,
  resolveAbsolutePositionActivationStyles,
  type SizeConstraintProperty,
} from "./transformUtils";
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
  const pagePosition = useStore((s) => s.derivedPagePositions[pageId]);
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
      const current = state.derivedPagePositions[pageId];
      if (!current) return;
      const next = {
        x: axis === "x" ? parsed : current.x,
        y: axis === "y" ? parsed : current.y,
      };
      // ADR-232 — X/Y 입력도 placement 로 쓴다 (Home 은 거부 — 아래 입력 비활성과 같은 판정).
      commitPagePlacementFromPoint(pageId, next);
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

  // ADR-232 — Home 은 흐름 원점이라 이동할 수 없다 (파생 모드 한정).
  const isEditable = isPagePlacementEditable(pageId);
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
        isDisabled={!isEditable}
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
        isDisabled={!isEditable}
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
  const { previewLayoutPresentation } = useLayoutPresentationActions();
  const selectedId = useStore((s) => s.selectedElementId);
  const bundle = useTransformValues(selectedId, part);
  const sizeContext = useElementStyleContext(selectedId);
  const activeBreakpoint = useStore((s) => s.activeBreakpoint);

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
  const widthFillGrow = useFillGrow(selectedId, "width");
  const heightFillGrow = useFillGrow(selectedId, "height");
  const parentDisplay = useParentDisplay(selectedId);
  const parentFlexDirection = useParentFlexDirection(selectedId);

  const commitAxisValue = useCallback(
    (axis: "width" | "height", value: string) => {
      const state = useStore.getState();
      const snapshot = readImmediateSelectionSnapshot();
      if (snapshot.selectedElementId !== selectedId) return;
      const factor = value.match(/^(\d+(?:\.\d+)?)fill$/);
      if (factor || value === "fill") {
        state.applySizingFromSelection(snapshot, {
          axis,
          mode: "fill",
          ...(factor ? { factor: Number(factor[1]) } : {}),
        });
        return;
      }
      state.applySizingFromSelection(snapshot, {
        axis,
        mode: value === "" ? "reset" : "css",
        value,
      });
    },
    [selectedId],
  );

  const selectSizeUnit = useCallback(
    (axis: "width" | "height", unit: string) => {
      if (unit === "fill" || unit === "fit-content" || unit === "reset") {
        commitAxisValue(axis, unit === "reset" ? "" : unit);
        return;
      }
      const effective =
        axis === "width" ? bundle?.width.effective : bundle?.height.effective;
      if (unit === "px") {
        if (effective === undefined || !Number.isFinite(effective)) return;
        commitAxisValue(axis, `${Math.max(0, effective)}px`);
      } else {
        commitAxisValue(axis, `100${unit}`);
      }
    },
    [bundle?.width.effective, bundle?.height.effective, commitAxisValue],
  );

  const [sizingError, setSizingError] = useState<RatioEditError | null>(null);
  const [constraintError, setConstraintError] = useState(false);
  const commitRatio = useCallback(
    (value: string | null) => {
      const snapshot = readImmediateSelectionSnapshot();
      if (snapshot.selectedElementId !== selectedId) return;
      setSizingError(
        useStore.getState().applyRatioFromSelection(snapshot, value),
      );
    },
    [selectedId],
  );
  useEffect(() => {
    setSizingError(null);
    setConstraintError(false);
  }, [selectedId]);

  const validateConstraint = useCallback(
    (property: SizeConstraintProperty, value: string): boolean => {
      if (!styleValues) return false;
      const oppositeProperty: SizeConstraintProperty =
        property === "minWidth"
          ? "maxWidth"
          : property === "maxWidth"
            ? "minWidth"
            : property === "minHeight"
              ? "maxHeight"
              : "minHeight";
      // 같은 편집 세션에서 직전에 저장한 반대 제약은 React selector 재렌더보다 먼저
      // 다음 Enter가 들어올 수 있다. 비교 기준은 렌더 시점 styleValues가 아니라 현재
      // canonical store의 active breakpoint effective style이어야 한다.
      const state = useStore.getState();
      const snapshot = readImmediateSelectionSnapshot();
      const element = snapshot.selectedElementId
        ? state.elementsMap.get(snapshot.selectedElementId)
        : undefined;
      const baseStyle = (element?.props?.style ?? {}) as Record<
        string,
        unknown
      >;
      const effectiveStyle = element
        ? resolveResponsiveStyleMap(
            baseStyle,
            element.responsive,
            state.activeBreakpoint,
          )
        : baseStyle;
      const renderedFallback = styleValues[oppositeProperty];
      const opposite = String(
        effectiveStyle[oppositeProperty] ?? renderedFallback ?? "",
      );
      const conflict = hasSizeConstraintConflict(property, value, opposite);
      setConstraintError(conflict);
      return !conflict;
    },
    [styleValues],
  );

  const commitConstraint = useCallback(
    (property: SizeConstraintProperty, value: string) => {
      if (validateConstraint(property, value)) {
        updateStyleImmediate(property, value);
      }
    },
    [updateStyleImmediate, validateConstraint],
  );

  const previewConstraint = useCallback(
    (property: SizeConstraintProperty, value: string) => {
      if (validateConstraint(property, value)) {
        updateStylePreview(property, value);
      }
    },
    [updateStylePreview, validateConstraint],
  );
  const handleAspectRatioLock = useCallback(() => {
    commitRatio(hasEnabledAspectRatio(styleValues?.aspectRatio) ? "" : null);
  }, [commitRatio, styleValues?.aspectRatio]);

  // ADR-224 §6.1 — Flow→Absolute 는 store 복합 명령 (position/inset + 무효 Fill 의 used px
  // Fixed + 형제 맨 앞, 한 transaction). 오류 코드는 Ratio 와 같은 표로 표시한다.
  const commitAbsoluteActivation = useCallback(
    (stylesFor: (elementId: string) => Record<string, string>) => {
      const snapshot = readImmediateSelectionSnapshot();
      if (snapshot.selectedElementId !== selectedId) return;
      setSizingError(
        useStore.getState().applyAbsoluteFromSelection(snapshot, stylesFor),
      );
    },
    [selectedId],
  );

  const handleAbsolutePositionChange = useCallback(
    (isSelected: boolean) => {
      if (!isSelected) {
        updateStyleImmediate("position", "");
        return;
      }
      // 다중 선택은 요소마다 자기 부모·자기 scene bounds 로 inset 을 계산한다 — 리더의 left/top 을
      // 전부에 쓰면 형제가 리더 위로 겹친다 (live 2026-09-18). 부모가 flex 가 아니거나 bounds 가
      // 없으면 position 만.
      commitAbsoluteActivation((elementId) => {
        const state = useStore.getState();
        const element = state.elementsMap.get(elementId);
        const parentId = element?.parent_id;
        const parent = parentId ? state.elementsMap.get(parentId) : undefined;
        if (!parent || !parentId) return { position: "absolute" };
        const parentStyle = resolveResponsiveStyleMap(
          (parent.props?.style ?? {}) as Record<string, unknown>,
          parent.responsive,
          state.activeBreakpoint,
        );
        const display = String(
          parentStyle.display ??
            resolveContainerStylesFallback(
              parent.type.toLowerCase(),
              parentStyle,
            ).display ??
            "",
        );
        if (display !== "flex" && display !== "inline-flex") {
          return { position: "absolute" };
        }
        const parentBounds = getSceneBounds(parentId);
        return (
          resolveAbsolutePositionActivationStyles(
            getSceneBounds(elementId),
            parentBounds
              ? resolveAbsoluteContainingBlockBounds(
                  parent,
                  parentBounds,
                  state.activeBreakpoint,
                )
              : parentBounds,
          ) ?? { position: "absolute" }
        );
      });
    },
    [commitAbsoluteActivation, updateStyleImmediate],
  );

  // Min/Max 4 필드 펼침 — 토글 on 이거나 값이 하나라도 있으면 보인다 (Border 코너 토글과 같은 규칙,
  //   2026-09-15 사용자 판정). hook 순서를 위해 early return 앞.
  const [constraintsOpen, setConstraintsOpen] = useState(false);
  const showConstraints =
    constraintsOpen || Boolean(styleValues?.hasInlineConstraint);

  if (!styleValues) return null;

  const isAbsolutePositioned = styleValues.position === "absolute";
  const parentContext = {
    display: parentDisplay,
    flexDirection: parentFlexDirection,
  };
  const effectiveSizeStyle = sizeContext.style ?? {};
  const dependentAxis = getRatioDependentAxis(
    effectiveSizeStyle,
    sizeContext.sizing,
  );
  const isFraction = (axis: "width" | "height") =>
    getFillBehavior(axis, effectiveSizeStyle, parentContext) === "fraction";
  const displaySize = (axis: "width" | "height") => {
    const mode = axis === "width" ? widthMode : heightMode;
    const factor = axis === "width" ? widthFillGrow : heightFillGrow;
    if (!styleValues.isBody && mode === "fill")
      return isFraction(axis) ? `${factor ?? 1}fill` : "fill";
    const value = styleValues[axis];
    return styleValues.isBody && value === "auto"
      ? String(canvasSize[axis])
      : value;
  };
  const sizeControl = (axis: "width" | "height") => {
    if (styleValues.isBody) return undefined;
    const mode = axis === "width" ? widthMode : heightMode;
    const computed =
      axis === "width" ? bundle?.width.effective : bundle?.height.effective;
    const kind =
      dependentAxis === axis
        ? ("ratio" as const)
        : mode === "fill"
          ? ("fill" as const)
          : effectiveSizeStyle[axis] === "fit-content"
            ? ("fit" as const)
            : ("css" as const);
    return {
      kind,
      fraction: isFraction(axis),
      computed,
      description:
        kind === "ratio"
          ? localize("Unlock the ratio to edit this axis")
          : `${localize("Computed size")} ${computed == null ? localize("Not measured") : `${Math.round(computed)}px`}${mode === "fill" && isFraction(axis) ? `. ${localize("The number is the fill weight")}` : ""}`,
      disabledModes: getFillBehavior(axis, effectiveSizeStyle, parentContext)
        ? []
        : ["fill"],
      onModeChange: (unit: string) => selectSizeUnit(axis, unit),
    };
  };

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
        {sizingError && (
          <p className="transform-ratio-error" role="alert">
            {localize(RATIO_ERROR_LABELS[sizingError])}
          </p>
        )}
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
          key={`width:${selectedId}:${activeBreakpoint}:${parentDisplay}:${parentFlexDirection}`}
          value={displaySize("width")}
          sizeControl={sizeControl("width")}
          units={[
            "reset",
            "px",
            "%",
            "vw",
            ...(styleValues.isBody ? [] : ["fill", "fit-content"]),
          ]}
          onChange={(value) => commitAxisValue("width", value)}
          onDrag={(value) =>
            previewLayoutPresentation("width", value) ||
            updateStylePreview("width", value)
          }
          min={widthMode === "fill" && isFraction("width") ? 1 : 0}
          max={widthMode === "fill" && isFraction("width") ? 1000 : 9999}
        />
        <PropertyUnitInput
          label="Height"
          unitSuffix
          className="height"
          key={`height:${selectedId}:${activeBreakpoint}:${parentDisplay}:${parentFlexDirection}`}
          value={displaySize("height")}
          sizeControl={sizeControl("height")}
          units={[
            "reset",
            "px",
            "%",
            "vh",
            ...(styleValues.isBody ? [] : ["fill", "fit-content"]),
          ]}
          onChange={(value) => commitAxisValue("height", value)}
          onDrag={(value) =>
            previewLayoutPresentation("height", value) ||
            updateStylePreview("height", value)
          }
          min={heightMode === "fill" && isFraction("height") ? 1 : 0}
          max={heightMode === "fill" && isFraction("height") ? 1000 : 9999}
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
                onChange={(value) => commitConstraint("minWidth", value)}
                onDrag={(value) => previewConstraint("minWidth", value)}
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
                onChange={(value) => commitConstraint("minHeight", value)}
                onDrag={(value) => previewConstraint("minHeight", value)}
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
                onChange={(value) => commitConstraint("maxWidth", value)}
                onDrag={(value) => previewConstraint("maxWidth", value)}
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
                onChange={(value) => commitConstraint("maxHeight", value)}
                onDrag={(value) => previewConstraint("maxHeight", value)}
                min={0}
                max={9999}
              />
              <div className="fieldset-actions actions-constraint-max" />
              {constraintError && (
                <p className="transform-constraint-error" role="alert">
                  {localize("Minimum size cannot exceed maximum size")}
                </p>
              )}
            </>
          )}
          <PropertySelect
            label="Ratio"
            className="aspect-ratio-select"
            value={styleValues.aspectRatio || ""}
            options={ASPECT_RATIO_OPTIONS}
            onChange={commitRatio}
          />
          <div className="fieldset-actions actions-ratio">
            <SwatchIconButton
              aria-label={localize("Lock aspect ratio")}
              aria-description={localize(
                "Applies to every screen size. Height follows Width",
              )}
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
          {sizingError && (
            <p className="transform-ratio-error" role="alert">
              {localize(RATIO_ERROR_LABELS[sizingError])}
            </p>
          )}
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
      onReset={hasPositionDirty ? () => resetStyles(POSITION_PROPS) : undefined}
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
