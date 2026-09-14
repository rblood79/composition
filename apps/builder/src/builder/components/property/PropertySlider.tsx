import React, { useEffect, useState } from "react";
import {
  Slider as AriaSlider,
  SliderTrack,
  SliderThumb,
  SliderOutput,
} from "react-aria-components/Slider";
import { iconProps } from "../../../utils/ui/uiConstants";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../i18n";

interface PropertySliderProps {
  label: string;
  value: number;
  /** 드래그 중 매 값 (연속 입력 — 호출측이 preview 경로로 보낸다). */
  onChange: (value: number) => void;
  /** 드래그 종료 · 키보드 입력 후 최종 값 (commit 경로). 없으면 onChange 만. */
  onChangeEnd?: (value: number) => void;
  /** 출력 텍스트. 기본 `${value}%`. `editable` 이면 숫자만 (단위는 `unit`). */
  formatValue?: (value: number) => string;
  /**
   * 라벨 위치 — `legend` (기본, 필드 위 18 행) / `inline` (28 상자 안 왼쪽 글자, legend 없음 —
   * 「Width ──●── 1 px」, panel-ui 02). 접근 이름은 두 경우 다 `label`.
   */
  labelMode?: "legend" | "inline";
  /** 값 칸을 클릭해 직접 입력 (Enter/blur 커밋 → onChangeEnd, Escape 취소). */
  editable?: boolean;
  /** 값 칸 뒤 단위 글자 (10 mono caps) — `editable` 값 칸과 짝. */
  unit?: string;
  /** 직접 입력 상한 (기본 `max`) — 슬라이더 범위 밖 값을 타이핑으로만 허용할 때 (반경 999 등). */
  inputMax?: number;
  min?: number;
  max?: number;
  step?: number;
  icon?: React.ComponentType<{
    color?: string;
    size?: number;
    strokeWidth?: number;
  }>;
  className?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function PropertySlider({
  label,
  value,
  onChange,
  onChangeEnd,
  formatValue,
  labelMode = "legend",
  editable = false,
  unit,
  inputMax,
  min = 0,
  max = 100,
  step = 1,
  icon: Icon,
  className,
}: PropertySliderProps) {
  const i18n = useOptionalI18n();
  const displayLabel = i18n
    ? translateKey(i18n.t, semanticLabelKeys[label] ?? label, label)
    : label;
  const toSingle = (newValue: number | number[]): number =>
    Array.isArray(newValue) ? newValue[0] : newValue;

  // 드래그 중 thumb 는 로컬 값을 따른다. RAC Slider 는 controlled 라 `value` 가 안 바뀌면 thumb 를
  //   매 렌더 되돌리는데, 호출측 preview 가 presentation 경로 (Skia 만 갈아끼우고 store 무변경 —
  //   Effect opacity) 면 드래그 내내 `value` 가 그대로라 thumb 가 끊겼다. store preview 경로
  //   (Border) 도 rAF 뒤에나 `value` 가 와 한 프레임 늦었다. 드래그 밖에서는 `value` 그대로.
  const [dragValue, setDragValue] = useState<number | null>(null);
  const handleChange = (newValue: number | number[]) => {
    const next = toSingle(newValue);
    setDragValue(next);
    onChange(next);
  };
  const handleChangeEnd = (newValue: number | number[]) => {
    setDragValue(null);
    onChangeEnd?.(toSingle(newValue));
  };
  const sliderValue = dragValue ?? value;

  // 값 칸 직접 입력 — local draft, 커밋은 Enter/blur 한 번 (연속 preview 없음).
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => {
    setDraft(null);
  }, [value]);
  const commitDraft = (): void => {
    if (draft === null) return;
    const parsed = Number.parseFloat(draft);
    setDraft(null);
    if (!Number.isFinite(parsed)) return;
    const next = clamp(parsed, min, inputMax ?? max);
    if (next === value) return;
    onChange(next);
    onChangeEnd?.(next);
  };

  // 값 칸도 드래그 값을 따른다 (thumb 만 따르고 숫자는 놓을 때 갱신되던 결함 — 2026-09-14)
  const outputText = formatValue
    ? formatValue(sliderValue)
    : editable
      ? String(sliderValue)
      : `${sliderValue}%`;

  return (
    <fieldset
      className={`properties-aria ${className || ""}`}
      data-label-mode={labelMode}
      aria-label={labelMode === "inline" ? displayLabel : undefined}
    >
      {labelMode === "legend" && (
        <legend className="fieldset-legend">{displayLabel}</legend>
      )}
      <div className="react-aria-control react-aria-Group">
        {labelMode === "inline" ? (
          <span className="slider-inline-label" aria-hidden="true">
            {displayLabel}
          </span>
        ) : (
          Icon && (
            <label className="control-label">
              <Icon
                color={iconProps.color}
                size={iconProps.size}
                strokeWidth={iconProps.strokeWidth}
              />
            </label>
          )
        )}
        <AriaSlider
          className="react-aria-Slider"
          value={sliderValue}
          onChange={handleChange}
          onChangeEnd={handleChangeEnd}
          minValue={min}
          maxValue={max}
          step={step}
          aria-label={displayLabel}
        >
          <div className="slider-container">
            <SliderTrack className="slider-track">
              {({ state }) => (
                <>
                  <div
                    className="slider-fill"
                    style={{ width: `${state.getThumbPercent(0) * 100}%` }}
                  />
                  <SliderThumb className="slider-thumb" />
                </>
              )}
            </SliderTrack>
            {editable ? (
              <input
                className="slider-output slider-output--input"
                type="text"
                inputMode="decimal"
                aria-label={displayLabel}
                value={draft ?? outputText}
                size={Math.max(2, (draft ?? outputText).length)}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={commitDraft}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitDraft();
                    event.currentTarget.blur();
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setDraft(null);
                    event.currentTarget.blur();
                  }
                }}
              />
            ) : (
              <SliderOutput className="slider-output">
                {outputText}
              </SliderOutput>
            )}
            {unit && (
              <span className="slider-unit" aria-hidden="true">
                {unit}
              </span>
            )}
          </div>
        </AriaSlider>
      </div>
    </fieldset>
  );
}
