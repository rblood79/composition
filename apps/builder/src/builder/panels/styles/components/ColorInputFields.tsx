/**
 * ColorInputFields - 모드별 색상 입력 필드
 *
 * 모드별 입력:
 * - HEX: 1개 텍스트 (#RRGGBBAA)
 * - RGBA: 4개 숫자 (R 0-255, G 0-255, B 0-255, A 0-100%)
 * - CSS: 1개 텍스트 (rgb(), hsl() 등)
 * - HSL: 4개 숫자 (H 0-360, S 0-100, L 0-100, A 0-100%)
 * - HSB: 4개 숫자 (H 0-360, S 0-100, B 0-100, A 0-100%)
 *
 * @since 2026-02-10 Color Picker Phase 1
 */

import { memo, useState, useCallback, useEffect, useRef } from "react";
import { useFillUIStore } from "../hooks/useFillValues";
import type { ColorInputMode } from "../../../../types/builder/fill.types";
import {
  hex8ToRgba,
  rgbaToHex8,
  hex8ToHsl,
  hslToHex8,
  hex8ToHsb,
  hsbToHex8,
  hex8ToCss,
  cssToHex8,
  normalizeToHex8,
  normalizeHexInputToHex8,
} from "../utils/colorUtils";
import { ScrubInput } from "./ScrubInput";
import { useStore } from "../../../stores";

import "./ColorInputFields.css";

interface ColorInputFieldsProps {
  value: string; // "#RRGGBBAA" or hexa format
  onChange: (hex8: string) => void;
}

/** 단일 숫자 입력 필드 — ScrubInput 래퍼 */
function NumberField({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="color-input-number-field">
      <ScrubInput
        value={value}
        onCommit={onChange}
        min={min}
        max={max}
        suffix={suffix}
        label={label}
        className="color-input-number-field__scrub"
      />
      <span className="color-input-number-field__label">{label}</span>
    </div>
  );
}

/** 단일 텍스트 입력 필드 */
function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const selectedElementId = useStore((state) => state.selectedElementId);
  const [localValue, setLocalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const focusedElementIdRef = useRef<string | null>(null);

  useEffect(() => {
    focusedElementIdRef.current = null;
    if (!isFocused) {
      const nextVal = value;
      queueMicrotask(() => setLocalValue(nextVal));
    }
  }, [value, isFocused, selectedElementId]);

  const handleBlur = useCallback(() => {
    const currentElementId = useStore.getState().selectedElementId ?? null;
    setIsFocused(false);
    if (
      focusedElementIdRef.current !== null &&
      currentElementId !== focusedElementIdRef.current
    ) {
      return;
    }
    onChange(localValue);
  }, [localValue, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        (e.target as HTMLInputElement).blur();
      }
    },
    [],
  );

  return (
    <label className="color-input-text-field">
      <input
        type="text"
        className="color-input-text-field__input"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={(e) => {
          setIsFocused(true);
          setLocalValue(value);
          focusedElementIdRef.current = selectedElementId ?? null;
          e.target.select();
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        aria-label={label}
      />
      <span className="color-input-text-field__label">{label}</span>
    </label>
  );
}

/** HEX 모드 */
function HexFields({ value, onChange }: ColorInputFieldsProps) {
  const hex = normalizeToHex8(value);
  return (
    <div className="color-input-fields color-input-fields--hex">
      <TextField
        label="HEX"
        value={hex}
        onChange={(v) => {
          // 입력 관용: `#` 생략/공백 허용 — bare hex 가 fallback(이전 값)으로
          // 원복되던 결함 수정 (normalizeHexInputToHex8 주석 참조)
          const normalized = normalizeHexInputToHex8(v, hex);
          onChange(normalized);
        }}
      />
    </div>
  );
}

/** RGBA 모드 */
function RgbaFields({ value, onChange }: ColorInputFieldsProps) {
  const rgba = hex8ToRgba(normalizeToHex8(value));

  return (
    <div className="color-input-fields color-input-fields--multi">
      <NumberField
        label="R"
        value={rgba.r}
        min={0}
        max={255}
        onChange={(r) => onChange(rgbaToHex8({ ...rgba, r }))}
      />
      <NumberField
        label="G"
        value={rgba.g}
        min={0}
        max={255}
        onChange={(g) => onChange(rgbaToHex8({ ...rgba, g }))}
      />
      <NumberField
        label="B"
        value={rgba.b}
        min={0}
        max={255}
        onChange={(b) => onChange(rgbaToHex8({ ...rgba, b }))}
      />
      <NumberField
        label="A"
        value={Math.round(rgba.a * 100)}
        min={0}
        max={100}
        suffix="%"
        onChange={(a) => onChange(rgbaToHex8({ ...rgba, a: a / 100 }))}
      />
    </div>
  );
}

/** CSS 모드 */
function CssFields({ value, onChange }: ColorInputFieldsProps) {
  const css = hex8ToCss(normalizeToHex8(value));
  return (
    <div className="color-input-fields color-input-fields--css">
      <TextField
        label="CSS"
        value={css}
        onChange={(v) => {
          const hex = cssToHex8(v);
          onChange(hex);
        }}
      />
    </div>
  );
}

/** HSL 모드 */
function HslFields({ value, onChange }: ColorInputFieldsProps) {
  const hsl = hex8ToHsl(normalizeToHex8(value));

  return (
    <div className="color-input-fields color-input-fields--multi">
      <NumberField
        label="H"
        value={hsl.h}
        min={0}
        max={360}
        onChange={(h) => onChange(hslToHex8({ ...hsl, h }))}
      />
      <NumberField
        label="S"
        value={hsl.s}
        min={0}
        max={100}
        onChange={(s) => onChange(hslToHex8({ ...hsl, s }))}
      />
      <NumberField
        label="L"
        value={hsl.l}
        min={0}
        max={100}
        onChange={(l) => onChange(hslToHex8({ ...hsl, l }))}
      />
      <NumberField
        label="A"
        value={Math.round(hsl.a * 100)}
        min={0}
        max={100}
        suffix="%"
        onChange={(a) => onChange(hslToHex8({ ...hsl, a: a / 100 }))}
      />
    </div>
  );
}

/** HSB 모드 */
function HsbFields({ value, onChange }: ColorInputFieldsProps) {
  const hsb = hex8ToHsb(normalizeToHex8(value));

  return (
    <div className="color-input-fields color-input-fields--multi">
      <NumberField
        label="H"
        value={hsb.h}
        min={0}
        max={360}
        onChange={(h) => onChange(hsbToHex8({ ...hsb, h }))}
      />
      <NumberField
        label="S"
        value={hsb.s}
        min={0}
        max={100}
        onChange={(s) => onChange(hsbToHex8({ ...hsb, s }))}
      />
      <NumberField
        label="B"
        value={hsb.b}
        min={0}
        max={100}
        onChange={(b) => onChange(hsbToHex8({ ...hsb, b }))}
      />
      <NumberField
        label="A"
        value={Math.round(hsb.a * 100)}
        min={0}
        max={100}
        suffix="%"
        onChange={(a) => onChange(hsbToHex8({ ...hsb, a: a / 100 }))}
      />
    </div>
  );
}

const FIELD_MAP: Record<
  ColorInputMode,
  React.ComponentType<ColorInputFieldsProps>
> = {
  hex: HexFields,
  rgba: RgbaFields,
  css: CssFields,
  hsl: HslFields,
  hsb: HsbFields,
};

export const ColorInputFields = memo(function ColorInputFields({
  value,
  onChange,
}: ColorInputFieldsProps) {
  const mode = useFillUIStore((s) => s.colorInputMode);
  const FieldComponent = FIELD_MAP[mode];
  return <FieldComponent value={value} onChange={onChange} />;
});
