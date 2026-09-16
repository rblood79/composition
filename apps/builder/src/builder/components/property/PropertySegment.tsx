/**
 * PropertySegment — 배타 선택 seg (텍스트 · 아이콘 · 스와치).
 *
 * Properties 패널 컨트롤 어법 (2026-09-15): 배타 2~5 짧은 값 · 방향/정렬/모양 · size 척도 ·
 * 이진 variant 는 셀렉트가 아니라 seg — 현재 값과 대안이 함께 보이고 한 클릭으로 바뀐다.
 * 마크업은 Styles 패널의 정렬 seg (`fieldset.properties-aria` + `ToggleButtonGroup indicator`)
 * 와 같고, 글자 seg 는 `.property-seg` (버튼이 행 폭을 나눠 갖는다 — PropertySizeToggle 과 같다).
 *
 * 값이 옵션 밖 (size 의 2XL · 3XL — 상한 5단 초과) 이면 선택 없음 + legend 뒤에 값·출처.
 */
import { memo, useCallback } from "react";
import type { Key } from "react-aria-components/Collection";
import type { LucideIcon } from "lucide-react";
import {
  ToggleButton,
  ToggleButtonGroup,
} from "@composition/shared/components";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../i18n";
import { iconProps } from "../../../utils/ui/uiConstants";
import "./PropertySegment.css";
import "./PropertySwatch.css";

export interface PropertySegmentOption {
  value: string;
  label: string;
  /** 있으면 아이콘 seg — 글자 대신 글리프, 이름은 `aria-label`. */
  icon?: LucideIcon;
  /** 있으면 색 점 — 글자 앞 (의미색 variant) 또는 글자 대신 (`swatchOnly`). */
  swatch?: string;
}

interface PropertySegmentProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly PropertySegmentOption[];
  /** 색 점만 (staticColor White/Black) — 라벨은 aria/title 로. */
  swatchOnly?: boolean;
  /** 값이 옵션 밖일 때 legend 뒤에 붙는 안내 (「3XL · Styles 에서 변경」). */
  outOfRangeHint?: string;
  className?: string;
}

export const PropertySegment = memo(function PropertySegment({
  label,
  value,
  onChange,
  options,
  swatchOnly = false,
  outOfRangeHint,
  className,
}: PropertySegmentProps) {
  const i18n = useOptionalI18n();
  const localize = (text: string) =>
    i18n ? translateKey(i18n.t, semanticLabelKeys[text] ?? text, text) : text;
  const displayLabel = localize(label);
  const iconMode = options.some((o) => o.icon != null);
  const inRange = options.some((o) => o.value === value);

  const handleChange = useCallback(
    (keys: Set<Key>) => {
      const selected = Array.from(keys)[0] as string | undefined;
      if (selected != null) onChange(selected);
    },
    [onChange],
  );

  return (
    <fieldset
      // 글자·스와치 seg 는 `.property-seg` (버튼이 행 폭을 나눠 갖는다 — 「Auto | ● | ●」) ·
      //   아이콘 seg 는 기본 indicator 그룹 (20×20 버튼이 space-between — Styles 정렬 seg 와 같다)
      className={`properties-aria ${iconMode ? "property-seg-glyphs" : "property-seg"} ${className ?? ""}`}
      data-out-of-range={!inRange ? "true" : undefined}
      data-swatch-only={swatchOnly || undefined}
    >
      <legend className="fieldset-legend">
        {displayLabel}
        {!inRange && outOfRangeHint && (
          <span className="property-seg__hint">{outOfRangeHint}</span>
        )}
      </legend>
      <ToggleButtonGroup
        aria-label={displayLabel}
        selectionMode="single"
        disallowEmptySelection={inRange}
        selectedKeys={inRange ? [value] : []}
        onSelectionChange={handleChange}
        indicator
      >
        {options.map((option) => {
          const text = localize(option.label);
          const Icon = option.icon;
          return (
            <ToggleButton
              key={option.value}
              id={option.value}
              aria-label={iconMode || swatchOnly ? text : undefined}
            >
              {Icon ? (
                <Icon
                  color={iconProps.color}
                  size={iconProps.size}
                  strokeWidth={iconProps.strokeWidth}
                />
              ) : option.swatch != null ? (
                <>
                  <span
                    aria-hidden="true"
                    className="property-swatch property-seg__swatch"
                    style={{ background: option.swatch }}
                  />
                  {!swatchOnly && text}
                </>
              ) : (
                text
              )}
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>
    </fieldset>
  );
});
