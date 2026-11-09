/**
 * ColorInputModeSelector - 색상 입력 모드 선택기
 *
 * 노출 모드: HEX, RGBA, CSS (HSL/HSB 는 표기 변환 뷰일 뿐 표현력 동일 —
 * 셀렉터에서 숨김, 2026-07-15). ColorInputMode 타입·변환 함수는 보존.
 * useFillUIStore (Zustand)에서 읽기/쓰기
 */

import { memo } from "react";
import {
  ToggleButton,
  ToggleButtonGroup,
} from "react-aria-components/ToggleButtonGroup";
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

  // RAC 단일 선택 ToggleButtonGroup = radiogroup + radio, 방향키 이동 (손으로 단 role · aria-checked 대체)
  return (
    <ToggleButtonGroup
      className="color-input-mode-selector"
      aria-label="Color input mode"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[mode]}
      onSelectionChange={(keys) => {
        const next = [...keys][0];
        if (next != null) setMode(next as ColorInputMode);
      }}
    >
      {MODES.map((m) => (
        <ToggleButton
          key={m.value}
          id={m.value}
          className="color-input-mode-selector__btn"
        >
          {m.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
});
