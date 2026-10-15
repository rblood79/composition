/**
 * LayoutSection - Layout 스타일 편집 섹션
 *
 * Display (grid · row · column, 선택 없음 = block), Alignment, Gap 편집 — grid 면 Alignment 자리에
 * Columns · Rows, Wrap · Gap 자리에 Gap X · Gap Y (2026-10-15 사용자 결정). grid 의 자식이면 차지할
 * 칸 수 (열 병합 · 행 병합 — `grid-column-end` · `grid-row-end` 의 `span n`, 2026-10-16 사용자 요청).
 * 4방향 확장 모드: direction-alignment-grid 스타일 패턴 사용
 * 접힌 섹션의 훅 실행을 방지하기 위해 내용 컴포넌트 분리.
 */

import { memo } from "react";
import { Section as PropertySection } from "../../../components/panel/Section";
import { PropertyUnitInput } from "../../../components/property/PropertyUnitInput";
import { PropertyInput } from "../../../components/property/PropertyInput";
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
  LayoutGrid,
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
  useLayoutAlignmentDisabled,
} from "../hooks/useLayoutAuxiliary";
import { useResetStyles, useHasDirtyStyles } from "../hooks/useResetStyles";
import { isDirectionDrivenTag } from "../utils/orientationDrivenTags";
import { useElementStyleContext } from "../hooks/useElementStyleContext";
import { useLayoutPresentationActions } from "../hooks/useLayoutPresentationActions";
import { LAYOUT_PROPS } from "./styleSectionProps";
import { resolveGapAxisProperty } from "../utils/gapAxis";
import {
  readSessionSpacingValue,
  useSpacingSession,
} from "../../../presentation/useSpacingSession";
import { useStylesSelectedId } from "../stylesHost";
import { useParentDisplay } from "../hooks/useTransformAuxiliary";

/** Track count presets of the Columns · Rows combo (`repeat(n, 1fr)`). */
const GRID_TRACK_PRESETS = [1, 2, 3, 4, 5, 6].map((count) => ({
  id: String(count),
  label: String(count),
  value: String(count),
}));

/**
 * The count of a `repeat(n, 1fr)` / `1fr 1fr …` template (`""` when empty); null for any other
 * template — the field then shows it as text and keeps it.
 */
function gridTrackCount(template: string): string | null {
  const value = template.trim();
  if (!value) return "";
  const repeat = /^repeat\(\s*(\d+)\s*,\s*1fr\s*\)$/.exec(value);
  if (repeat) return repeat[1]!;
  const tokens = value.split(/\s+/);
  return tokens.every((token) => token === "1fr") ? String(tokens.length) : null;
}

/** A typed count becomes `repeat(n, 1fr)`; empty removes the template; other text is kept. */
function gridTemplateOf(input: string): string {
  const value = input.trim();
  if (!value) return "";
  const count = Number(value);
  return Number.isInteger(count) && count > 0
    ? `repeat(${count}, 1fr)`
    : value;
}

/** Columns · Rows: a count combo like Gap (1 – 6 presets); a custom template stays text. */
const GridTrackField = memo(function GridTrackField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (template: string) => void;
}) {
  const count = gridTrackCount(value);
  if (count === null)
    return (
      <PropertyInput
        label={label}
        value={value}
        onChange={(next) => onCommit(gridTemplateOf(next))}
      />
    );
  return (
    <PropertyUnitInput
      label={label}
      value={count}
      units={[]}
      allowKeywords={false}
      allowEmptyReset
      preserveEmptyValueOnUnitChange
      placeholder="auto"
      presets={GRID_TRACK_PRESETS}
      onChange={(next) => onCommit(gridTemplateOf(next))}
      min={1}
      max={24}
    />
  );
});

/** `span n` → `"n"`; one track (none · `auto` · `span 1`) → `""`; another line stays as text. */
function gridSpanCount(end: string): string | null {
  const value = end.trim();
  if (!value || value === "auto") return "";
  const span = /^span\s+(\d+)$/.exec(value);
  if (!span) return null;
  return span[1] === "1" ? "" : span[1]!;
}

/** A typed count n > 1 becomes `span n`; 1 or empty removes the span (one track). */
function gridSpanOf(input: string): string {
  const value = input.trim();
  const count = Number(value);
  if (!value || count === 1) return "";
  return Number.isInteger(count) && count > 1 ? `span ${count}` : value;
}

/** Column span · Row span of a grid child: a count combo (1 – 6), empty = one track. */
const GridSpanField = memo(function GridSpanField({
  label,
  className,
  value,
  onCommit,
}: {
  label: string;
  className: string;
  value: string;
  onCommit: (end: string) => void;
}) {
  const count = gridSpanCount(value);
  if (count === null)
    return (
      <PropertyInput
        label={label}
        className={className}
        value={value}
        onChange={(next) => onCommit(gridSpanOf(next))}
      />
    );
  return (
    <PropertyUnitInput
      label={label}
      className={className}
      value={count}
      units={[]}
      allowKeywords={false}
      allowEmptyReset
      preserveEmptyValueOnUnitChange
      placeholder="1"
      presets={GRID_TRACK_PRESETS}
      onChange={(next) => onCommit(gridSpanOf(next))}
      min={1}
      max={24}
    />
  );
});

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
  const selectedId = useStylesSelectedId();
  // 그룹 축 prop derive 컨테이너(ToggleButtonGroup/Toolbar=orientation,
  // RadioGroup/CheckboxGroup=labelPosition)는 그룹 root flexDirection SSOT 가
  // 별도 prop(row/column 만, block 없음)이라 Direction 토글의 block 버튼을 disable
  // — 매핑 불가능한 block 선택을 원천 차단(2026-06-30). 대상 정본:
  // orientationDrivenTags (element.type PascalCase → 헬퍼가 toLowerCase 정규화).
  // ref instance (팔레트가 만드는 요소) 는 origin 타입, instance 안 자식 (synthetic) 은 해소 노드로 판정한다.
  // The host's style context names the component type (an instance: its origin's type).
  const isDirectionDriven = isDirectionDrivenTag(
    useElementStyleContext(selectedId).type,
  );
  const styleValues = useLayoutValues(selectedId);
  const parentDisplay = useParentDisplay(selectedId);
  const inGrid = parentDisplay === "grid" || parentDisplay === "inline-grid";
  const flexDirectionKeys = useFlexDirectionKeys(selectedId);
  const flexAlignmentKeys = useFlexAlignmentKeys(selectedId);
  const flexDistributionAxis = useFlexDistributionAxis(selectedId);
  const justifyContentSpacingKeys = useJustifyContentSpacingKeys(selectedId);
  const flexWrapKeys = useFlexWrapKeys(selectedId);
  // grid 컨테이너는 정렬 계열이 display 를 flex 로 바꾼다 — 비활성 (모드 전환은 Direction).
  const isAlignmentDisabled = useLayoutAlignmentDisabled(selectedId);

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
  const isGrid = flexDirectionKeys[0] === "grid";
  const commitGap = (property: "rowGap" | "columnGap", value: string) => {
    if (!commitLayoutPresentation(property, value))
      updateStyleImmediate(property, value);
  };
  const previewGap = (property: "rowGap" | "columnGap", value: string) => {
    if (!previewLayoutPresentation(property, value))
      updateStylePreview(property, value);
  };

  return (
    <>
      <div className="layout-direction">
        <div className="direction-controls flex-direction">
          <legend className="fieldset-legend">{localize("Display")}</legend>
          {/* grid · row · column — 선택을 모두 끄면 block. 방향이 prop 인 컨테이너는 row · column 만 */}
          <ToggleButtonGroup
            aria-label={localize("Display")}
            indicator
            selectedKeys={flexDirectionKeys}
            onSelectionChange={(keys) => {
              handleFlexDirection(Array.from(keys)[0] as string | undefined);
            }}
          >
            <ToggleButton
              id="grid"
              aria-label={localize("Grid")}
              isDisabled={isDirectionDriven}
            >
              <LayoutGrid
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
        {isGrid ? (
          <div className="flex-alignment grid-tracks">
            <GridTrackField
              label="Columns"
              value={styleValues.gridTemplateColumns}
              onCommit={(template) =>
                updateStyles({ gridTemplateColumns: template })
              }
            />
            <GridTrackField
              label="Rows"
              value={styleValues.gridTemplateRows}
              onCommit={(template) =>
                updateStyles({ gridTemplateRows: template })
              }
            />
          </div>
        ) : (
          <div className="direction-alignment-grid flex-alignment">
            <legend className="fieldset-legend">{localize("Alignment")}</legend>
            {/* Space 가 켜지면 (space-*) 주축이 분산 — 그리드는 점 → 막대 (data-distributed)
                가 되고 클릭은 교차축만 쓴다 (panel-ui 01, 2026-09-14) */}
            <ToggleButtonGroup
              aria-label={localize("Flex alignment")}
              isDisabled={isAlignmentDisabled}
              indicator
              selectionMode="single"
              selectedKeys={flexAlignmentKeys}
              data-distributed={flexDistributionAxis ?? undefined}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as string;
                if (value) {
                  // 🚀 Phase 3: styleValues에서 직접 값 사용
                  // 라벨 위치 컨테이너의 방향은 prop 이 정한다 — Direction 표시와 같은 값으로 축을 매핑.
                  handleFlexAlignment(
                    value,
                    isDirectionDriven
                      ? flexDirectionKeys[0]
                      : styleValues.flexDirection,
                    { preserveMainAxis: flexDistributionAxis !== null },
                  );
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
        )}
        {/* 아이콘 칸은 비운다 — 종전 LayoutGrid 버튼은 onPress 없는 dead surface 였다 */}
        <div className="fieldset-actions" />
        <div className="justify-control justify-content">
          <legend className="fieldset-legend">{localize("Space")}</legend>
          <ToggleButtonGroup
            aria-label={localize("Justify content alignment")}
            isDisabled={isAlignmentDisabled}
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
        {isGrid ? (
          <>
            <PropertyUnitInput
              label="Gap X"
              className="flex-wrap"
              value={styleValues.columnGap}
              units={["px"]}
              presets={SPACING_PRESET_OPTIONS}
              allowKeywords={false}
              onChange={(value) => commitGap("columnGap", value)}
              onDrag={(value) => previewGap("columnGap", value)}
              min={0}
              max={500}
            />
            <PropertyUnitInput
              label="Gap Y"
              className="displayGap"
              value={styleValues.rowGap}
              units={["px"]}
              presets={SPACING_PRESET_OPTIONS}
              allowKeywords={false}
              onChange={(value) => commitGap("rowGap", value)}
              onDrag={(value) => previewGap("rowGap", value)}
              min={0}
              max={500}
            />
          </>
        ) : (
          <>
            <div className="justify-control flex-wrap">
              <legend className="fieldset-legend">{localize("Wrap")}</legend>
              <ToggleButtonGroup
                aria-label={localize("Flex wrap")}
                isDisabled={isAlignmentDisabled}
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
          </>
        )}
      </div>

      {inGrid ? (
        <div className="fieldset-row grid-item-span">
          <GridSpanField
            label="Column span"
            className="grid-column-span"
            value={styleValues.gridColumnEnd}
            onCommit={(end) => updateStyles({ gridColumnEnd: end })}
          />
          <GridSpanField
            label="Row span"
            className="grid-row-span"
            value={styleValues.gridRowEnd}
            onCommit={(end) => updateStyles({ gridRowEnd: end })}
          />
        </div>
      ) : null}

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
