/**
 * PropertyPlacementPicker — 9-위치 피커 (Popover · Tooltip 의 `placement`).
 *
 * Properties 패널 컨트롤 어법 (2026-09-15): Top Start … Bottom End 8 값을 목록으로 읽으면 머릿속에서
 * 그려야 한다 — Styles 패널 Layout 의 3×3 Align 격자와 같은 어법으로 그림 그대로 고른다. 가운데 칸은
 * 대상 요소 (선택 불가). 옆에 현재 값 이름.
 *
 * 값 → 칸: 첫 행 top start · top · top end / 둘째 행 left · (대상) · right / 셋째 행 bottom start ·
 * bottom · bottom end. RAC 키는 계약 값 그대로 (공백 포함).
 */
import { memo, useCallback } from "react";
import type { Key } from "react-aria-components/Collection";
import {
  ToggleButton,
  ToggleButtonGroup,
} from "@composition/shared/components";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../i18n";
import "./PropertyPlacementPicker.css";

const GRID: ReadonlyArray<string | null> = [
  "top start",
  "top",
  "top end",
  "left",
  null,
  "right",
  "bottom start",
  "bottom",
  "bottom end",
];

interface PropertyPlacementPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** 계약 옵션 — 격자의 칸 중 계약에 없는 값은 비활성. 라벨은 현재 값 표시에 쓴다. */
  options: ReadonlyArray<{ value: string; label: string }>;
  className?: string;
}

export const PropertyPlacementPicker = memo(function PropertyPlacementPicker({
  label,
  value,
  onChange,
  options,
  className,
}: PropertyPlacementPickerProps) {
  const i18n = useOptionalI18n();
  const localize = (text: string) =>
    i18n ? translateKey(i18n.t, semanticLabelKeys[text] ?? text, text) : text;
  const displayLabel = localize(label);
  const byValue = new Map(options.map((o) => [o.value, o.label]));
  const current = byValue.get(value);

  const handleChange = useCallback(
    (keys: Set<Key>) => {
      const selected = Array.from(keys)[0] as string | undefined;
      if (selected != null) onChange(selected);
    },
    [onChange],
  );

  return (
    <fieldset
      className={`properties-aria property-placement ${className ?? ""}`}
    >
      <legend className="fieldset-legend">{displayLabel}</legend>
      <div className="property-placement__body">
        <ToggleButtonGroup
          aria-label={displayLabel}
          indicator
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={byValue.has(value) ? [value] : []}
          onSelectionChange={handleChange}
        >
          {GRID.map((key, index) =>
            key == null ? (
              <span
                key={`target-${index}`}
                className="property-placement__target"
                aria-hidden="true"
              />
            ) : (
              <ToggleButton
                key={key}
                id={key}
                aria-label={localize(byValue.get(key) ?? key)}
                isDisabled={!byValue.has(key)}
              >
                <span className="alignment-dot" />
              </ToggleButton>
            ),
          )}
        </ToggleButtonGroup>
        <span className="property-placement__value">
          {current ? localize(current) : "—"}
        </span>
      </div>
    </fieldset>
  );
});
