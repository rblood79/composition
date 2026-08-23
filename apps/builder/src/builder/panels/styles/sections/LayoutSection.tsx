/**
 * LayoutSection - Layout 스타일 편집 섹션
 *
 * Flex direction, Alignment, Gap, Padding, Margin 편집
 * 4방향 확장 모드: direction-alignment-grid 스타일 패턴 사용
 * 접힌 섹션의 훅 실행을 방지하기 위해 내용 컴포넌트 분리.
 */

import React, { useState, useMemo, useEffect, useRef, memo } from "react";
import { PropertySection, PropertyUnitInput } from "../../../components";
import {
  ToggleButton,
  ToggleButtonGroup,
} from "@composition/shared/components";
import { Input } from "react-aria-components";
import { SwatchIconButton } from "../../../components/ui";
import { iconProps } from "../../../../utils/ui/uiConstants";
import {
  Square,
  Maximize2,
  Minimize2,
  Frame,
  LayoutGrid,
  SquareSquare,
  StretchHorizontal,
  StretchVertical,
  AlignHorizontalSpaceAround,
  GalleryHorizontal,
  WrapText,
  CornerDownLeft,
  ArrowRightToLine,
} from "lucide-react";
import { useStyleActions } from "../hooks/useStyleActions";
import { useOptimizedStyleActions } from "../hooks/useOptimizedStyleActions";
import { useLayoutValues } from "../hooks/useLayoutValues";
import {
  useFlexDirectionKeys,
  useFlexAlignmentKeys,
  useJustifyContentSpacingKeys,
  useFlexWrapKeys,
} from "../hooks/useLayoutAuxiliary";
import { useResetStyles, useHasDirtyStyles } from "../hooks/useResetStyles";
import { useStore } from "../../../stores";
import { isDirectionDrivenTag } from "../utils/orientationDrivenTags";
import { useLayoutPresentationActions } from "../hooks/useLayoutPresentationActions";

// 4방향 값 추출은 이제 useLayoutValues 훅에서 처리됨

/**
 * 4방향 입력 그리드 컴포넌트
 * direction-alignment-grid 스타일 패턴 사용
 */
interface FourWayGridProps {
  values: { top: string; right: string; bottom: string; left: string };
  onChange: (
    direction: "Top" | "Right" | "Bottom" | "Left",
    value: string,
  ) => void;
  allowNegative?: boolean;
}

function getDisplayValue(value: string): string {
  return value.replace("px", "");
}

function FourWayGrid({ values, onChange }: FourWayGridProps) {
  const selectedElementId = useStore((state) => state.selectedElementId);
  // useMemo로 외부 값에서 표시값 파생
  const derivedValues = useMemo(
    () => ({
      top: getDisplayValue(values.top),
      right: getDisplayValue(values.right),
      bottom: getDisplayValue(values.bottom),
      left: getDisplayValue(values.left),
    }),
    [values.top, values.right, values.bottom, values.left],
  );

  // Local state로 입력값을 관리하여 controlled input 즉시 반영
  const [localValues, setLocalValues] = useState(derivedValues);
  const focusedElementIdRef = useRef<string | null>(null);
  const justSavedViaEnterRef = useRef(false);

  // 선택 요소나 외부 값이 바뀌면 로컬 편집 세션을 새 대상 기준으로 리셋
  useEffect(() => {
    justSavedViaEnterRef.current = false;
    focusedElementIdRef.current = null;
    queueMicrotask(() => setLocalValues(derivedValues));
  }, [derivedValues, selectedElementId]);

  const handleChange = (
    direction: "Top" | "Right" | "Bottom" | "Left",
    inputValue: string,
  ) => {
    const key = direction.toLowerCase() as "top" | "right" | "bottom" | "left";
    setLocalValues((prev) => ({ ...prev, [key]: inputValue }));
  };

  const commitValue = (direction: "Top" | "Right" | "Bottom" | "Left") => {
    if (
      focusedElementIdRef.current !== null &&
      selectedElementId !== focusedElementIdRef.current
    ) {
      return;
    }

    const key = direction.toLowerCase() as "top" | "right" | "bottom" | "left";
    const inputValue = localValues[key];
    const numericValue = inputValue.replace(/[^0-9.-]/g, "");
    if (numericValue === "" || numericValue === "-") {
      onChange(direction, "");
    } else {
      onChange(direction, `${numericValue}px`);
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    direction: "Top" | "Right" | "Bottom" | "Left",
  ) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitValue(direction);
      justSavedViaEnterRef.current = true;
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="four-way-grid">
      {FOUR_WAY_DIRECTIONS.map(({ direction, slot, placeholder }) => {
        const key = direction.toLowerCase() as
          "top" | "left" | "right" | "bottom";
        return (
          <Input
            key={direction}
            className={`react-aria-Input four-way-${slot}`}
            value={localValues[key]}
            onChange={(e) => handleChange(direction, e.target.value)}
            onFocus={() => {
              justSavedViaEnterRef.current = false;
              focusedElementIdRef.current = selectedElementId ?? null;
            }}
            onBlur={() => {
              if (justSavedViaEnterRef.current) {
                justSavedViaEnterRef.current = false;
                return;
              }
              commitValue(direction);
            }}
            onKeyDown={(e) => handleKeyDown(e, direction)}
            placeholder={placeholder}
            aria-label={direction}
          />
        );
      })}
    </div>
  );
}

const FOUR_WAY_DIRECTIONS = [
  { direction: "Top", slot: "top", placeholder: "T" },
  { direction: "Left", slot: "left", placeholder: "L" },
  { direction: "Right", slot: "right", placeholder: "R" },
  { direction: "Bottom", slot: "bottom", placeholder: "B" },
] as const satisfies ReadonlyArray<{
  direction: "Top" | "Left" | "Right" | "Bottom";
  slot: string;
  placeholder: string;
}>;

/**
 * LayoutSection 내부 컨텐츠 — 섹션이 열릴 때만 마운트
 */
const LayoutSectionContent = memo(function LayoutSectionContent() {
  const [isSpacingExpanded, setIsSpacingExpanded] = useState(false);

  const {
    handleFlexDirection,
    handleFlexAlignment,
    handleJustifyContentSpacing,
    handleFlexWrap,
    updateStyles,
  } = useStyleActions();
  // 🚀 Phase 1: RAF 기반 스로틀 업데이트
  const { updateStyleImmediate, updateStylePreview } =
    useOptimizedStyleActions();
  const { commitLayoutPresentation, previewLayoutPresentation } =
    useLayoutPresentationActions();

  // ADR-067 Phase 2: Zustand 직접 구독 + Spec 직접 lookup
  const selectedId = useStore((s) => s.selectedElementId);
  // 그룹 축 prop derive 컨테이너(ToggleButtonGroup/Toolbar=orientation,
  // RadioGroup/CheckboxGroup=labelPosition)는 그룹 root flexDirection SSOT 가
  // 별도 prop(row/column 만, block 없음)이라 Direction 토글의 block 버튼을 disable
  // — 매핑 불가능한 block 선택을 원천 차단(2026-06-30). 대상 정본:
  // orientationDrivenTags (element.type PascalCase → 헬퍼가 toLowerCase 정규화).
  const isDirectionDriven = useStore((s) =>
    isDirectionDrivenTag(
      selectedId ? s.elementsMap.get(selectedId)?.type : undefined,
    ),
  );
  const styleValues = useLayoutValues(selectedId);
  const flexDirectionKeys = useFlexDirectionKeys(selectedId);
  const flexAlignmentKeys = useFlexAlignmentKeys(selectedId);
  const justifyContentSpacingKeys = useJustifyContentSpacingKeys(selectedId);
  const flexWrapKeys = useFlexWrapKeys(selectedId);

  // FourWayGrid는 local state + blur 커밋이므로 즉시 업데이트
  const handlePaddingChange = (
    direction: "Top" | "Right" | "Bottom" | "Left",
    value: string,
  ) => {
    commitLayoutPresentation(`padding${direction}`, value) ||
      updateStyleImmediate(`padding${direction}`, value);
  };

  const handleSpacingCommit = (property: "gap" | "padding", value: string) => {
    commitLayoutPresentation(property, value) ||
      updateStyleImmediate(property, value);
  };

  const handleSpacingPreview = (property: "gap" | "padding", value: string) => {
    previewLayoutPresentation(property, value) ||
      updateStylePreview(property, value);
  };

  const handleMarginChange = (
    direction: "Top" | "Right" | "Bottom" | "Left",
    value: string,
  ) => {
    updateStyleImmediate(`margin${direction}`, value);
  };

  if (!styleValues) return null;

  // 4방향 값은 훅에서 가져옴
  const paddingValues = {
    top: styleValues.paddingTop,
    right: styleValues.paddingRight,
    bottom: styleValues.paddingBottom,
    left: styleValues.paddingLeft,
  };
  const marginValues = {
    top: styleValues.marginTop,
    right: styleValues.marginRight,
    bottom: styleValues.marginBottom,
    left: styleValues.marginLeft,
  };

  return (
    <>
      <div className="layout-direction">
        <div className="direction-controls flex-direction">
          <legend className="fieldset-legend">Direction</legend>
          <ToggleButtonGroup
            aria-label="Flex direction"
            indicator
            selectedKeys={flexDirectionKeys}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as string;
              handleFlexDirection(value);
            }}
          >
            <ToggleButton id="block" isDisabled={isDirectionDriven}>
              <Square
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </ToggleButton>
            <ToggleButton id="row">
              <StretchVertical
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </ToggleButton>
            <ToggleButton id="column">
              <StretchHorizontal
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </ToggleButton>
          </ToggleButtonGroup>
        </div>
        <div className="direction-alignment-grid flex-alignment">
          <legend className="fieldset-legend">Alignment</legend>
          <ToggleButtonGroup
            aria-label="Flex alignment"
            indicator
            selectionMode="single"
            selectedKeys={flexAlignmentKeys}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as string;
              if (value) {
                // 🚀 Phase 3: styleValues에서 직접 값 사용
                handleFlexAlignment(value, styleValues.flexDirection);
              } else {
                // 활성화된 토글 재클릭 → alignment 스타일 제거
                updateStyles({ alignItems: "", justifyContent: "" });
              }
            }}
          >
            <ToggleButton id="leftTop">
              <span className="alignment-dot" />
            </ToggleButton>
            <ToggleButton id="centerTop">
              <span className="alignment-dot" />
            </ToggleButton>
            <ToggleButton id="rightTop">
              <span className="alignment-dot" />
            </ToggleButton>
            <ToggleButton id="leftCenter">
              <span className="alignment-dot" />
            </ToggleButton>
            <ToggleButton id="centerCenter">
              <span className="alignment-dot" />
            </ToggleButton>
            <ToggleButton id="rightCenter">
              <span className="alignment-dot" />
            </ToggleButton>
            <ToggleButton id="leftBottom">
              <span className="alignment-dot" />
            </ToggleButton>
            <ToggleButton id="centerBottom">
              <span className="alignment-dot" />
            </ToggleButton>
            <ToggleButton id="rightBottom">
              <span className="alignment-dot" />
            </ToggleButton>
          </ToggleButtonGroup>
        </div>
        <div className="fieldset-actions">
          <SwatchIconButton aria-label="Layout grid">
            <LayoutGrid
              color={iconProps.color}
              size={iconProps.size}
              strokeWidth={iconProps.strokeWidth}
            />
          </SwatchIconButton>
        </div>
        <div className="justify-control justify-content">
          <legend className="fieldset-legend">Space</legend>
          <ToggleButtonGroup
            aria-label="Justify content alignment"
            indicator
            selectionMode="single"
            selectedKeys={justifyContentSpacingKeys}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as string;
              if (value) {
                handleJustifyContentSpacing(value);
              } else {
                // 활성화된 토글 재클릭 → justifyContent 스타일 제거
                updateStyles({ justifyContent: "" });
              }
            }}
          >
            <ToggleButton id="space-around">
              <AlignHorizontalSpaceAround
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </ToggleButton>
            <ToggleButton id="space-between">
              <GalleryHorizontal
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </ToggleButton>
            <ToggleButton id="space-evenly">
              <AlignHorizontalSpaceAround
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </ToggleButton>
          </ToggleButtonGroup>
        </div>
        <div className="justify-control flex-wrap">
          <legend className="fieldset-legend">Wrap</legend>
          <ToggleButtonGroup
            aria-label="Flex wrap"
            indicator
            selectionMode="single"
            selectedKeys={flexWrapKeys}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as string;
              if (value) {
                handleFlexWrap(value);
              } else {
                // 활성화된 토글 재클릭 → flexWrap 스타일 제거
                updateStyles({ flexWrap: "" });
              }
            }}
          >
            <ToggleButton id="wrap">
              <WrapText
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </ToggleButton>
            <ToggleButton id="wrap-reverse">
              <CornerDownLeft
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </ToggleButton>
            <ToggleButton id="nowrap">
              <ArrowRightToLine
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </ToggleButton>
          </ToggleButtonGroup>
        </div>
        <PropertyUnitInput
          icon={LayoutGrid}
          label="Gap"
          className="displayGap"
          value={styleValues.gap}
          units={["reset", "px"]}
          onChange={(value) => handleSpacingCommit("gap", value)}
          onDrag={(value) => handleSpacingPreview("gap", value)}
          min={0}
          max={500}
        />
      </div>

      {/* Spacing Section: Padding & Margin */}
      {!isSpacingExpanded ? (
        /* 축소 모드: 단일 입력 */
        <div className="layout-container">
          <PropertyUnitInput
            icon={SquareSquare}
            label="Padding"
            className="padding"
            value={styleValues.padding}
            units={["reset", "px"]}
            onChange={(value) => handleSpacingCommit("padding", value)}
            onDrag={(value) => handleSpacingPreview("padding", value)}
            min={0}
            max={500}
          />
          <PropertyUnitInput
            icon={Frame}
            label="Margin"
            className="margin"
            value={styleValues.margin}
            units={["reset", "px"]}
            onChange={(value) => updateStyleImmediate("margin", value)}
            onDrag={(value) => updateStylePreview("margin", value)}
            min={0}
            max={500}
          />
          <div className="fieldset-actions actions-spacing">
            <SwatchIconButton
              onPress={() => setIsSpacingExpanded(true)}
              aria-label="Expand spacing to 4-way input"
            >
              <Maximize2
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </SwatchIconButton>
          </div>
        </div>
      ) : (
        /* 확장 모드: 4방향 그리드 입력 */
        <div className="layout-container layout-container-expanded">
          <fieldset className="properties-aria property-unit-input layout-padding">
            <legend className="fieldset-legend">Padding</legend>
            <div className="react-aria-Group layout-spacing">
              <FourWayGrid
                values={paddingValues}
                onChange={handlePaddingChange}
              />
            </div>
          </fieldset>
          <fieldset className="properties-aria property-unit-input layout-margin">
            <legend className="fieldset-legend">Margin</legend>
            <div className="react-aria-Group layout-spacing">
              <FourWayGrid
                values={marginValues}
                onChange={handleMarginChange}
                allowNegative
              />
            </div>
          </fieldset>
          <div className="fieldset-actions actions-spacing">
            <SwatchIconButton
              onPress={() => setIsSpacingExpanded(false)}
              aria-label="Collapse spacing to single input"
            >
              <Minimize2
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </SwatchIconButton>
          </div>
        </div>
      )}
    </>
  );
});

/**
 * LayoutSection - 외부 래퍼 (PropertySection 관리)
 */
// store 가 shorthand 를 longhand 로 분배하므로 dirty 판정도 longhand 를 포함.
const LAYOUT_PROPS = [
  "display",
  "flexDirection",
  "flexWrap",
  "alignItems",
  "justifyContent",
  "gap",
  "rowGap",
  "columnGap",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
];

export const LayoutSection = memo(function LayoutSection() {
  const resetStyles = useResetStyles();
  const hasDirty = useHasDirtyStyles(LAYOUT_PROPS);

  const handleReset = () => {
    resetStyles(LAYOUT_PROPS);
  };

  return (
    <PropertySection
      id="layout"
      title="Layout"
      onReset={hasDirty ? handleReset : undefined}
    >
      <LayoutSectionContent />
    </PropertySection>
  );
});
