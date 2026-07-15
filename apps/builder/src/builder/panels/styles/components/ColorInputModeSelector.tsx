/**
 * ColorInputModeSelector - 색상 입력 모드 선택기
 *
 * 노출 모드: HEX, RGBA, CSS (HSL/HSB 는 표기 변환 뷰일 뿐 표현력 동일 —
 * 셀렉터에서 숨김, 2026-07-15). ColorInputMode 타입·변환 함수는 보존.
 * useFillUIStore (Zustand)에서 읽기/쓰기
 */

import { memo, useCallback } from "react";
import type { ColorInputMode } from "../../../../types/builder/fill.types";
import { useFillUIStore } from "../hooks/useFillValues";

import "./ColorInputModeSelector.css";

const MODES: { value: ColorInputMode; label: string }[] = [
  { value: "hex", label: "HEX" },
  { value: "rgba", label: "RGBA" },
  { value: "css", label: "CSS" },
];

export const ColorInputModeSelector = memo(function ColorInputModeSelector() {
  const mode = useFillUIStore((s) => s.colorInputMode);
  const setMode = useFillUIStore((s) => s.setColorInputMode);

  const handleChange = useCallback(
    (newMode: ColorInputMode) => {
      setMode(newMode);
    },
    [setMode],
  );

  return (
    <div
      className="color-input-mode-selector"
      role="radiogroup"
      aria-label="Color input mode"
    >
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          className="color-input-mode-selector__btn"
          data-active={m.value === mode || undefined}
          role="radio"
          aria-checked={m.value === mode}
          onClick={() => handleChange(m.value)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
});
