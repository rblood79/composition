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
  /** ADR-187 runtime이 유일한 frame scheduler인 migrated control. */
  presentationOwnsFrameScheduling?: boolean;
  onPresentationCancel?: (reason: "pointer-cancel" | "escape") => void;
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
  presentationOwnsFrameScheduling = false,
  onPresentationCancel,
  onChange,
  onChangeEnd,
}: {
  initialValue: string;
  resetKey?: string;
  presentationOwnsFrameScheduling?: boolean;
  onPresentationCancel?: (reason: "pointer-cancel" | "escape") => void;
  onChange: (color: string) => void;
  onChangeEnd: (color: string) => void;
}) {
  const [localColor, setLocalColor] = useState<Color>(() =>
    safeParseColor(initialValue),
  );
  const lastSavedRef = useRef<string>(initialValue);

  const lastResetKeyRef = useRef(resetKey);

  useEffect(() => {
    if (lastResetKeyRef.current === resetKey) {
      return;
    }
    lastResetKeyRef.current = resetKey;

    const parsed = safeParseColor(initialValue);
    setLocalColor(parsed);
    lastSavedRef.current = parsed.toString("hexa");
  }, [initialValue, resetKey]);

  // 드래그 중: 로컬 상태와 presentation runtime 입력을 즉시 갱신한다.
  // 프레임 배칭은 editor presentation runtime 단일 owner가 담당한다.
  const handleChange = useCallback(
    (color: Color | null) => {
      if (!color) return;
      recordEditorPresentationRawInput();
      setLocalColor(color);
      onChange(color.toString("hexa"));
    },
    [onChange],
  );

  // 드래그 종료: 최종 값 flush + 실제 저장
  const handleChangeEnd = useCallback(
    (color: Color) => {
      recordEditorPresentationTerminalEvent();
      // 최종 색상으로 로컬 상태 동기화
      setLocalColor(color);

      const hex = color.toString("hexa");
      if (presentationOwnsFrameScheduling || hex !== lastSavedRef.current) {
        lastSavedRef.current = hex;
        onChangeEnd(hex);
      }
    },
    [onChangeEnd, presentationOwnsFrameScheduling],
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
      <div
        className="color-picker-panel"
        onKeyDownCapture={(event) => {
          if (presentationOwnsFrameScheduling && event.key === "Escape") {
            onPresentationCancel?.("escape");
          }
        }}
        onPointerCancelCapture={() => {
          if (presentationOwnsFrameScheduling) {
            onPresentationCancel?.("pointer-cancel");
          }
        }}
      >
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
  presentationOwnsFrameScheduling,
  onPresentationCancel,
  onChange,
  onChangeEnd,
}: ColorPickerPanelProps) {
  return (
    <ColorPickerPanelInner
      initialValue={value}
      resetKey={resetKey}
      presentationOwnsFrameScheduling={presentationOwnsFrameScheduling}
      onPresentationCancel={onPresentationCancel}
      onChange={onChange}
      onChangeEnd={onChangeEnd}
    />
  );
});
