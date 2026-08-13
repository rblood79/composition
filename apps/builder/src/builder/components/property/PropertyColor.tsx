import React, { useCallback, useRef, memo } from "react";
import {
  ColorPicker as AriaColorPicker,
  ColorField as AriaColorField,
  Input,
  DialogTrigger,
  Button as AriaButton,
  type Color,
} from "react-aria-components";
import { ColorSwatch } from "@composition/shared/components/ColorSwatch";
import { ColorArea } from "@composition/shared/components/ColorArea";
import { ColorSlider } from "@composition/shared/components/ColorSlider";
import { Popover } from "@composition/shared/components/Popover";
import { useStore } from "../../stores";

interface PropertyColorProps {
  label?: string;
  value: string; // Hex color string (e.g., "#FF0000")
  onChange: (value: string) => void;
  /**
   * 드래그 중 연속 호출 — 캔버스 preview 채널 (updateStylePreview) 배선용.
   * 생략 시 기존 커밋-only 동작 (드롭 시점에만 캔버스 반영).
   */
  onPreview?: (value: string) => void;
  icon?: React.ComponentType<{
    color?: string;
    size?: number;
    strokeWidth?: number;
  }>;
  placeholder?: string;
  className?: string;
}

/**
 * 내부 ColorPicker 컴포넌트 - 드래그 중 로컬 상태 관리
 * 외부 value 변경은 useEffect 로 로컬 상태에 동기화한다 (remount 금지).
 * 🚀 Jotai selectAtom equality 체크로 동일 값이면 리렌더 없음
 */
function ColorPickerInner({
  initialValue,
  onChange,
  onPreview,
  label,
}: {
  initialValue: string;
  onChange: (value: string) => void;
  onPreview?: (value: string) => void;
  label?: string;
}) {
  const selectedElementId = useStore((state) => state.selectedElementId);
  const [localColor, setLocalColor] = React.useState<string>(initialValue);
  const [inputValue, setInputValue] = React.useState<string>(initialValue);
  const lastSavedValue = useRef<string>(initialValue);
  const focusedElementIdRef = useRef<string | null>(null);
  // preview 드래그 세션 (첫 handleChange ~ handleChangeEnd) 추적 —
  // 세션 중에는 아래 useEffect 의 외부 value 동기화를 건너뛴다.
  const isPreviewSessionRef = useRef(false);

  React.useEffect(() => {
    // preview / 커밋 경로가 store 를 mutate 하면서 initialValue 가 편집값으로
    // 먼저 바뀌어도, 같은 요소를 편집(hex Input focus) 중이면 로컬 편집 세션을
    // 유지한다 (PropertyUnitInput 의 activeElement 스킵 계약과 동형 — style-ssot.md).
    const currentSelectedId = selectedElementId ?? null;
    const isFocusedOnSameElement =
      focusedElementIdRef.current !== null &&
      focusedElementIdRef.current === currentSelectedId;
    if (isFocusedOnSameElement) return;
    // preview 드래그 중에는 동기화 금지 — lastSavedValue 가 preview 반영값으로
    // 덮이면 onChangeEnd 의 변경 감지가 "변경 없음" 으로 오판해 커밋(히스토리/DB)
    // 이 소실된다 (style-ssot.md PropertyUnitInput commit skip 함정과 동형).
    if (isPreviewSessionRef.current) return;

    queueMicrotask(() => {
      setLocalColor(initialValue);
      setInputValue(initialValue);
      lastSavedValue.current = initialValue;
      focusedElementIdRef.current = null;
    });
  }, [initialValue, selectedElementId]);

  // 드래그 중: 로컬 상태 + (배선 시) 캔버스 preview 채널 — updateStylePreview 가
  // RAF 배칭(프레임당 1회) / 히스토리·DB 무접촉을 보장한다.
  const handleChange = useCallback(
    (color: Color | null) => {
      if (!color) return;
      const hexValue = color.toString("hex");
      setLocalColor(hexValue);
      setInputValue(hexValue);
      if (onPreview) {
        isPreviewSessionRef.current = true;
        onPreview(hexValue);
      }
    },
    [onPreview],
  );

  // 드래그 종료: 실제 저장 (onChangeEnd) — lastSavedValue 는 세션 시작 전
  // 커밋값이 보존돼 있어 최종값과의 diff 가 정확하다.
  const handleChangeEnd = useCallback(
    (color: Color) => {
      isPreviewSessionRef.current = false;
      const hexValue = color.toString("hex");
      if (hexValue !== lastSavedValue.current) {
        lastSavedValue.current = hexValue;
        onChange(hexValue);
      }
    },
    [onChange],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setInputValue(e.target.value);
    },
    [],
  );

  const handleBlur = useCallback(() => {
    const currentElementId = useStore.getState().selectedElementId ?? null;
    if (
      focusedElementIdRef.current !== null &&
      currentElementId !== focusedElementIdRef.current
    ) {
      return;
    }

    if (inputValue !== lastSavedValue.current) {
      lastSavedValue.current = inputValue;
      setLocalColor(inputValue);
      onChange(inputValue);
    }
  }, [inputValue, onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (inputValue !== lastSavedValue.current) {
          lastSavedValue.current = inputValue;
          setLocalColor(inputValue);
          onChange(inputValue);
        }
        (e.target as HTMLInputElement).blur();
      }
    },
    [inputValue, onChange],
  );

  return (
    <AriaColorPicker value={localColor} onChange={handleChange}>
      <DialogTrigger>
        <AriaButton className="react-aria-Group color-swatch-button">
          <ColorSwatch />
        </AriaButton>
        <Popover placement="bottom start" className="color-picker-popover">
          <div className="color-picker-content">
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
            <AriaColorField
              className="react-aria-ColorField"
              aria-label={label || "Color"}
            >
              <Input
                className="react-aria-Input"
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => {
                  focusedElementIdRef.current = selectedElementId ?? null;
                }}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
              />
            </AriaColorField>
          </div>
        </Popover>
      </DialogTrigger>
    </AriaColorPicker>
  );
}

// 🚀 Phase 21: memo 적용
// 🚀 Jotai selectAtom equality 체크로 동일 값이면 리렌더 없음 → key 변경 없음
export const PropertyColor = memo(
  function PropertyColor({
    label,
    value,
    onChange,
    onPreview,
    className,
  }: PropertyColorProps) {
    const selectedElementId = useStore((state) => state.selectedElementId);
    return (
      <fieldset
        className={`properties-aria property-color-input ${className || ""}`}
      >
        {label && <legend className="fieldset-legend">{label}</legend>}
        <ColorPickerInner
          // key 에 value 를 넣지 않는다 — 커밋마다 remount 되어 열린 popover 가
          // 닫히던 결함(2026-07-15). 외부 value 변경은 ColorPickerInner 의
          // useEffect 가 로컬 상태로 동기화한다. 요소 전환 시에만 remount.
          key={selectedElementId ?? "none"}
          initialValue={value}
          onChange={onChange}
          onPreview={onPreview}
          label={label}
        />
      </fieldset>
    );
  },
  (prevProps, nextProps) => {
    // 커스텀 비교: onChange 함수 참조는 무시하고 실제 값만 비교
    return (
      prevProps.label === nextProps.label &&
      prevProps.value === nextProps.value &&
      prevProps.className === nextProps.className &&
      prevProps.icon === nextProps.icon &&
      prevProps.placeholder === nextProps.placeholder
    );
  },
);
