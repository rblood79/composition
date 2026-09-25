/**
 * LayoutSection - Layout 스타일 편집 섹션
 *
 * Flex direction, Alignment, Gap, Padding, Margin 편집
 * 4방향 확장 모드: direction-alignment-grid 스타일 패턴 사용
 * 접힌 섹션의 훅 실행을 방지하기 위해 내용 컴포넌트 분리.
 */

import { memo } from "react";
import { PropertySection, PropertyUnitInput } from "../../../components";
import { SPACING_PRESET_OPTIONS } from "../../../components/property/propertyUnitPresets";
import {
  ToggleButton,
  ToggleButtonGroup,
} from "@composition/shared/components";
import { iconProps } from "../../../../utils/ui/uiConstants";
import {
  AlignHorizontalSpaceAround,
  AlignHorizontalSpaceBetween,
  ArrowRightToLine,
  CornerDownLeft,
  GalleryHorizontal,
  LayoutArrowDown,
  LayoutArrowRight,
  Square,
  TextWrap,
} from "lucide-react";
import { useStyleActions } from "../hooks/useStyleActions";
import { useOptimizedStyleActions } from "../hooks/useOptimizedStyleActions";
import { useLayoutValues } from "../hooks/useLayoutValues";
import { useSemanticLabel } from "../../../../i18n";
import {
  useFlexDirectionKeys,
  useFlexAlignmentKeys,
  useFlexDistributionAxis,
  useJustifyContentSpacingKeys,
  useFlexWrapKeys,
} from "../hooks/useLayoutAuxiliary";
import { useResetStyles, useHasDirtyStyles } from "../hooks/useResetStyles";
import { useStore } from "../../../stores";
import { isDirectionDrivenTag } from "../utils/orientationDrivenTags";
import { resolveStyleSpecType } from "../hooks/useElementStyleContext";
import { useLayoutPresentationActions } from "../hooks/useLayoutPresentationActions";
import { LAYOUT_PROPS } from "./styleSectionProps";
import { resolveGapAxisProperty } from "../utils/gapAxis";
import {
  readSessionSpacingValue,
  useSpacingSession,
} from "../../../presentation/useSpacingSession";

const LayoutSectionContent = memo(function LayoutSectionContent() {
  const localize = useSemanticLabel();

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
  // ref instance (팔레트가 만드는 요소) 는 origin 타입으로 판정한다 — `type` 은 "ref" 다.
  const isDirectionDriven = useStore((s) =>
    isDirectionDrivenTag(
      resolveStyleSpecType(
        selectedId ? s.elementsMap.get(selectedId) : undefined,
        s.elementsMap,
      ),
    ),
  );
  const styleValues = useLayoutValues(selectedId);
  const flexDirectionKeys = useFlexDirectionKeys(selectedId);
  const flexAlignmentKeys = useFlexAlignmentKeys(selectedId);
  const flexDistributionAxis = useFlexDistributionAxis(selectedId);
  const justifyContentSpacingKeys = useJustifyContentSpacingKeys(selectedId);
  const flexWrapKeys = useFlexWrapKeys(selectedId);

  // ADR-222 §4.1: 단일 행/열 flex 는 Gap 필드가 주축 longhand 하나를 읽고 쓴다
  // (row → columnGap · column → rowGap). 그 밖 (wrap · grid · block) 은 종전 shorthand.
  const gapProperty =
    (styleValues &&
      resolveGapAxisProperty(
        styleValues.display,
        styleValues.flexDirection,
        styleValues.flexWrap,
      )) ??
    "gap";
  const spacingSession = useSpacingSession();
  const sessionGap =
    gapProperty === "gap"
      ? null
      : readSessionSpacingValue(spacingSession, selectedId, gapProperty);

  const handleSpacingCommit = (value: string) => {
    if (!commitLayoutPresentation(gapProperty, value)) {
      updateStyleImmediate(gapProperty, value);
    }
  };

  const handleSpacingPreview = (value: string) => {
    if (!previewLayoutPresentation(gapProperty, value)) {
      updateStylePreview(gapProperty, value);
    }
  };

  if (!styleValues) return null;

  return (
    <>
      <div className="layout-direction">
        <div className="direction-controls flex-direction">
          <legend className="fieldset-legend">{localize("Direction")}</legend>
          <ToggleButtonGroup
            aria-label={localize("Flex direction")}
            indicator
            selectedKeys={flexDirectionKeys}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as string;
              handleFlexDirection(value);
            }}
          >
            <ToggleButton
              id="block"
              aria-label={localize("Block")}
              isDisabled={isDirectionDriven}
            >
              <Square
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </ToggleButton>
            <ToggleButton id="row" aria-label={localize("Row")}>
              <LayoutArrowRight
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </ToggleButton>
            <ToggleButton id="column" aria-label={localize("Column")}>
              <LayoutArrowDown
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </ToggleButton>
          </ToggleButtonGroup>
        </div>
        <div className="direction-alignment-grid flex-alignment">
          <legend className="fieldset-legend">{localize("Alignment")}</legend>
          {/* Space 가 켜지면 (space-*) 주축이 분산 — 그리드는 점 → 막대 (data-distributed)
              가 되고 클릭은 교차축만 쓴다 (panel-ui 01, 2026-09-14) */}
          <ToggleButtonGroup
            aria-label={localize("Flex alignment")}
            indicator
            selectionMode="single"
            selectedKeys={flexAlignmentKeys}
            data-distributed={flexDistributionAxis ?? undefined}
            onSelectionChange={(keys) => {
              const value = Array.from(keys)[0] as string;
              if (value) {
                // 🚀 Phase 3: styleValues에서 직접 값 사용
                handleFlexAlignment(value, styleValues.flexDirection, {
                  preserveMainAxis: flexDistributionAxis !== null,
                });
              } else if (flexDistributionAxis !== null) {
                updateStyles({ alignItems: "" });
              } else {
                // 활성화된 토글 재클릭 → alignment 스타일 제거
                updateStyles({ alignItems: "", justifyContent: "" });
              }
            }}
          >
            <ToggleButton id="leftTop" aria-label={localize("Top left")}>
              <span className="alignment-dot" />
            </ToggleButton>
            <ToggleButton id="centerTop" aria-label={localize("Top center")}>
              <span className="alignment-dot" />
            </ToggleButton>
            <ToggleButton id="rightTop" aria-label={localize("Top right")}>
              <span className="alignment-dot" />
            </ToggleButton>
            <ToggleButton id="leftCenter" aria-label={localize("Middle left")}>
              <span className="alignment-dot" />
            </ToggleButton>
            <ToggleButton
              id="centerCenter"
              aria-label={localize("Middle center")}
            >
              <span className="alignment-dot" />
            </ToggleButton>
            <ToggleButton
              id="rightCenter"
              aria-label={localize("Middle right")}
            >
              <span className="alignment-dot" />
            </ToggleButton>
            <ToggleButton id="leftBottom" aria-label={localize("Bottom left")}>
              <span className="alignment-dot" />
            </ToggleButton>
            <ToggleButton
              id="centerBottom"
              aria-label={localize("Bottom center")}
            >
              <span className="alignment-dot" />
            </ToggleButton>
            <ToggleButton
              id="rightBottom"
              aria-label={localize("Bottom right")}
            >
              <span className="alignment-dot" />
            </ToggleButton>
          </ToggleButtonGroup>
        </div>
        {/* 아이콘 칸은 비운다 — 종전 LayoutGrid 버튼은 onPress 없는 dead surface 였다 */}
        <div className="fieldset-actions" />
        <div className="justify-control justify-content">
          <legend className="fieldset-legend">{localize("Space")}</legend>
          <ToggleButtonGroup
            aria-label={localize("Justify content alignment")}
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
            <ToggleButton
              id="space-around"
              aria-label={localize("Space around")}
            >
              <AlignHorizontalSpaceAround
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </ToggleButton>
            <ToggleButton
              id="space-between"
              aria-label={localize("Space between")}
            >
              <AlignHorizontalSpaceBetween
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </ToggleButton>
            <ToggleButton
              id="space-evenly"
              aria-label={localize("Space evenly")}
            >
              <GalleryHorizontal
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </ToggleButton>
          </ToggleButtonGroup>
        </div>
        <div className="justify-control flex-wrap">
          <legend className="fieldset-legend">{localize("Wrap")}</legend>
          <ToggleButtonGroup
            aria-label={localize("Flex wrap")}
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
            <ToggleButton id="wrap" aria-label={localize("Wrap lines")}>
              <TextWrap
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </ToggleButton>
            <ToggleButton
              id="wrap-reverse"
              aria-label={localize("Wrap reverse")}
            >
              <CornerDownLeft
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </ToggleButton>
            <ToggleButton id="nowrap" aria-label={localize("No wrap")}>
              <ArrowRightToLine
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </ToggleButton>
          </ToggleButtonGroup>
        </div>
        {/* legend 「Gap」 + 값 + ▾ 토큰 preset 메뉴 (XS · 4 …, 2026-09-15 사용자 판정 — px 단위 하나뿐인
            메뉴보다 spacing 토큰이 쓸모 있다). preset 은 px 로 풀어 commit — store 가 gap 을 px
            숫자로 강제 (NUMERIC_COERCE_STYLE_PROPS) */}
        <PropertyUnitInput
          label="Gap"
          className={`displayGap${sessionGap !== null ? " property-unit-input--session-active" : ""}`}
          value={sessionGap !== null ? `${sessionGap}px` : styleValues.gap}
          units={["px"]}
          presets={SPACING_PRESET_OPTIONS}
          allowKeywords={false}
          isDisabled={sessionGap !== null}
          onChange={handleSpacingCommit}
          onDrag={handleSpacingPreview}
          min={0}
          max={500}
        />
      </div>

      {/* Padding · Margin 은 Spacing 절 (박스 모델) 로 — SpacingSection (panel-ui 01) */}
    </>
  );
});

/**
 * LayoutSection - 외부 래퍼 (PropertySection 관리)
 */
// store 가 shorthand 를 longhand 로 분배하므로 dirty 판정도 longhand 를 포함.
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
