/**
 * SpacingSection — Padding · Margin (Layout 탭, panel-ui 01, 2026-09-14).
 *
 * 기본은 박스 모델 다이어그램 (BoxModelEditor — 4방향 값이 제자리에, 가운데 link 로 연동),
 * 헤더의 expand 로 8-필드 표 (FourWayGrid ×2) 폴백. 종전엔 Layout 절 끝에 「Padding ▾ ·
 * Margin ▾」 축약값 둘 + 펼침이라 상하/좌우가 다른 경우를 펼쳐야 알 수 있었다.
 * 값 쓰기는 longhand (paddingTop …) — store 의 shorthand 분배 정책과 같은 채널.
 */

import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { PropertySection } from "../../../components";
import { Input } from "react-aria-components/Input";
import { SwatchIconButton } from "../../../components/ui";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { Maximize2, Minimize2 } from "lucide-react";
import { useOptimizedStyleActions } from "../hooks/useOptimizedStyleActions";
import { useLayoutValues } from "../hooks/useLayoutValues";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../../i18n";
import { useResetStyles, useHasDirtyStyles } from "../hooks/useResetStyles";
import { useStore } from "../../../stores";
import { useLayoutPresentationActions } from "../hooks/useLayoutPresentationActions";
import { BoxModelEditor } from "../components/BoxModelEditor";
import { SPACING_PROPS } from "./styleSectionProps";

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
const SpacingSectionContent = memo(function SpacingSectionContent({
  expanded,
}: {
  expanded: boolean;
}) {
  const i18n = useOptionalI18n();
  const localize = (label: string) =>
    i18n
      ? translateKey(i18n.t, semanticLabelKeys[label] ?? label, label)
      : label;
  const { updateStyleImmediate } = useOptimizedStyleActions();
  const { commitLayoutPresentation } = useLayoutPresentationActions();
  const selectedId = useStore((s) => s.selectedElementId);
  const styleValues = useLayoutValues(selectedId);

  // FourWayGrid · BoxModelEditor 는 local draft + blur 커밋이므로 즉시 업데이트
  const handlePaddingChange = (
    direction: "Top" | "Right" | "Bottom" | "Left",
    value: string,
  ) => {
    if (!commitLayoutPresentation(`padding${direction}`, value)) {
      updateStyleImmediate(`padding${direction}`, value);
    }
  };

  const handleMarginChange = (
    direction: "Top" | "Right" | "Bottom" | "Left",
    value: string,
  ) => {
    updateStyleImmediate(`margin${direction}`, value);
  };

  if (!styleValues) return null;

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

  if (!expanded) {
    return (
      <BoxModelEditor
        padding={paddingValues}
        margin={marginValues}
        onPaddingChange={handlePaddingChange}
        onMarginChange={handleMarginChange}
      />
    );
  }

  /* 확장 모드: 4방향 그리드 입력 ×2 */
  return (
    <div className="layout-container layout-container-expanded">
      <fieldset className="properties-aria property-unit-input layout-padding">
        <legend className="fieldset-legend">{localize("Padding")}</legend>
        <div className="react-aria-Group layout-spacing">
          <FourWayGrid values={paddingValues} onChange={handlePaddingChange} />
        </div>
      </fieldset>
      <fieldset className="properties-aria property-unit-input layout-margin">
        <legend className="fieldset-legend">{localize("Margin")}</legend>
        <div className="react-aria-Group layout-spacing">
          <FourWayGrid
            values={marginValues}
            onChange={handleMarginChange}
            allowNegative
          />
        </div>
      </fieldset>
      <div className="fieldset-actions actions-spacing" />
    </div>
  );
});

export const SpacingSection = memo(function SpacingSection() {
  const i18n = useOptionalI18n();
  const resetStyles = useResetStyles();
  const hasDirty = useHasDirtyStyles(SPACING_PROPS);
  const [expanded, setExpanded] = useState(false);

  const actions = useMemo(() => {
    const label = expanded
      ? "Collapse spacing to single input"
      : "Expand spacing to 4-way input";
    const displayLabel = i18n
      ? translateKey(i18n.t, semanticLabelKeys[label] ?? label, label)
      : label;
    return (
      <SwatchIconButton
        onPress={() => setExpanded((value) => !value)}
        aria-label={displayLabel}
      >
        {expanded ? (
          <Minimize2
            color={iconProps.color}
            size={iconProps.size}
            strokeWidth={iconProps.strokeWidth}
          />
        ) : (
          <Maximize2
            color={iconProps.color}
            size={iconProps.size}
            strokeWidth={iconProps.strokeWidth}
          />
        )}
      </SwatchIconButton>
    );
  }, [expanded, i18n]);

  return (
    <PropertySection
      id="spacing"
      title="Spacing"
      actions={actions}
      onReset={hasDirty ? () => resetStyles(SPACING_PROPS) : undefined}
    >
      <SpacingSectionContent expanded={expanded} />
    </PropertySection>
  );
});
