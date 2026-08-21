/**
 * ColorPickerPanel - 풀 컬러 피커 패널
 *
 * Color Picker Phase 1: HSB ColorArea + Hue/Alpha Slider + Input Fields
 * - 드래그 최적화: 로컬 상태로 UI 업데이트, onChangeEnd에서 부모 콜백
 * - React Aria parseColor 사용
 *
 * @since 2026-02-10 Color Picker Phase 1
 */

import { memo, useState, useCallback, useRef, useEffect } from "react";
import {
  ColorPicker as AriaColorPicker,
  parseColor,
  type Color,
} from "react-aria-components";
import { ColorArea } from "@composition/shared/components/ColorArea";
import { ColorSlider } from "@composition/shared/components/ColorSlider";
import { ColorInputModeSelector } from "./ColorInputModeSelector";
import { ColorInputFields } from "./ColorInputFields";
import { EyeDropperButton } from "./EyeDropperButton";
import {
  recordEditorPresentationControlRaf,
  recordEditorPresentationRawInput,
  recordEditorPresentationTerminalEvent,
} from "../../../performance/editorPresentationPhase0Metrics";

import "./ColorPickerPanel.css";

function safeParseColor(value: string): Color {
  try {
    return parseColor(value);
  } catch {
    return parseColor("#000000");
  }
}

interface ColorPickerPanelProps {
  value: string; // "#RRGGBBAA" hex8
  resetKey?: string;
  onChange: (color: string) => void;
  onChangeEnd: (color: string) => void;
}

/**
 * 내부 피커 - 드래그 중 로컬 상태 관리
 * 외부 preview 값으로는 재초기화하지 않고, 명시적 resetKey 변경 시에만 동기화한다.
 */
function ColorPickerPanelInner({
  initialValue,
  resetKey,
  onChange,
  onChangeEnd,
}: {
  initialValue: string;
  resetKey?: string;
  onChange: (color: string) => void;
  onChangeEnd: (color: string) => void;
}) {
  const [localColor, setLocalColor] = useState<Color>(() =>
    safeParseColor(initialValue),
  );
  const lastSavedRef = useRef<string>(initialValue);

  // RAF 스로틀: 외부 preview onChange만 프레임당 1회로 제한
  // 로컬 색상 상태는 즉시 반영해 pointerdown 첫 프레임 좌표 불일치를 막는다.
  const localRafRef = useRef<number | null>(null);
  const latestColorRef = useRef<Color | null>(null);
  const lastResetKeyRef = useRef(resetKey);

  useEffect(() => {
    return () => {
      if (localRafRef.current !== null) {
        cancelAnimationFrame(localRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (lastResetKeyRef.current === resetKey) {
      return;
    }
    lastResetKeyRef.current = resetKey;

    const parsed = safeParseColor(initialValue);
    setLocalColor(parsed);
    lastSavedRef.current = parsed.toString("hexa");
  }, [initialValue, resetKey]);

  // 드래그 중: 로컬 상태는 즉시 갱신, 외부 preview만 RAF 스로틀
  const handleChange = useCallback(
    (color: Color | null) => {
      if (!color) return;
      recordEditorPresentationRawInput();
      setLocalColor(color);
      latestColorRef.current = color;

      if (localRafRef.current !== null) return;

      localRafRef.current = requestAnimationFrame(() => {
        const startedAt = performance.now();
        localRafRef.current = null;
        const latest = latestColorRef.current;
        if (!latest) return;
        onChange(latest.toString("hexa"));
        recordEditorPresentationControlRaf(performance.now() - startedAt);
      });
    },
    [onChange],
  );

  // 드래그 종료: 보류 중인 RAF 취소 + 최종 값 flush + 실제 저장
  const handleChangeEnd = useCallback(
    (color: Color) => {
      recordEditorPresentationTerminalEvent();
      // 보류 중인 RAF 취소 (이중 업데이트 방지)
      if (localRafRef.current !== null) {
        cancelAnimationFrame(localRafRef.current);
        localRafRef.current = null;
      }
      latestColorRef.current = null;

      // 최종 색상으로 로컬 상태 동기화
      setLocalColor(color);

      const hex = color.toString("hexa");
      if (hex !== lastSavedRef.current) {
        lastSavedRef.current = hex;
        onChangeEnd(hex);
      }
    },
    [onChangeEnd],
  );

  // InputFields에서 직접 hex8 문자열로 변경
  const handleInputChange = useCallback(
    (hex: string) => {
      try {
        const parsed = parseColor(hex);
        setLocalColor(parsed);
        lastSavedRef.current = hex;
        onChangeEnd(hex);
      } catch {
        // 무효한 입력 무시
      }
    },
    [onChangeEnd],
  );

  const hexValue = localColor.toString("hexa");

  return (
    <AriaColorPicker value={localColor} onChange={handleChange}>
      <div className="color-picker-panel">
        <ColorArea
          colorSpace="hsb"
          xChannel="saturation"
          yChannel="brightness"
          onChangeEnd={handleChangeEnd}
        />
        <ColorSlider
          colorSpace="hsb"
          channel="hue"
          onChangeEnd={handleChangeEnd}
        />
        <ColorSlider channel="alpha" onChangeEnd={handleChangeEnd} />
        <div className="color-picker-panel__inputs">
          <div className="color-picker-panel__inputs-row">
            <EyeDropperButton onColorPick={handleInputChange} />
            <ColorInputModeSelector />
          </div>
          <ColorInputFields value={hexValue} onChange={handleInputChange} />
        </div>
      </div>
    </AriaColorPicker>
  );
}

export const ColorPickerPanel = memo(function ColorPickerPanel({
  value,
  resetKey,
  onChange,
  onChangeEnd,
}: ColorPickerPanelProps) {
  return (
    <ColorPickerPanelInner
      initialValue={value}
      resetKey={resetKey}
      onChange={onChange}
      onChangeEnd={onChangeEnd}
    />
  );
});
