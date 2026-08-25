import React, { useState, useRef, useEffect, memo } from "react";
import { NumberField, Input, Group, Button } from "react-aria-components";
import { Minus, Plus } from "lucide-react";
import { PropertyFieldset } from "./PropertyFieldset";
import { useStore } from "../../stores";
import { translateDisplayLabel, useOptionalI18n } from "../../../i18n";

interface PropertyNumberInputProps {
  label?: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  icon?: React.ComponentType<{
    color?: string;
    size?: number;
    strokeWidth?: number;
  }>;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  className?: string;
  /** true 시 빈 입력을 undefined로 처리. 기본값: true */
  allowEmpty?: boolean;
}

export const PropertyNumberInput = memo(
  function PropertyNumberInput({
    label,
    value,
    onChange,
    icon,
    min,
    max,
    step = 1,
    placeholder,
    className,
    allowEmpty = true,
  }: PropertyNumberInputProps) {
    const i18n = useOptionalI18n();
    const displayLabel =
      label && i18n ? translateDisplayLabel(i18n.t, label) : label;
    const selectedElementId = useStore((state) => state.selectedElementId);
    const [localValue, setLocalValue] = useState<number | undefined>(value);
    const committedRef = useRef(false);
    const focusedElementIdRef = useRef<string | null>(null);
    // 외부 value 또는 선택 요소가 바뀌면 렌더 중 즉시 동기화 (effect 불필요)
    const [prevSync, setPrevSync] = useState({ value, selectedElementId });
    if (
      prevSync.value !== value ||
      prevSync.selectedElementId !== selectedElementId
    ) {
      setPrevSync({ value, selectedElementId });
      setLocalValue(value);
    }

    // ref 리셋은 렌더 중 수행 불가 → effect로 분리
    useEffect(() => {
      committedRef.current = false;
      focusedElementIdRef.current = null;
    }, [value, selectedElementId]);

    const commit = (val: number | undefined) => {
      if (val !== value) {
        onChange(val);
      }
      committedRef.current = true;
    };

    return (
      <PropertyFieldset legend={label} icon={icon} className={className}>
        <NumberField
          aria-label={
            displayLabel ||
            (i18n ? translateDisplayLabel(i18n.t, "Number") : "Number")
          }
          value={localValue ?? NaN}
          onChange={(val) => {
            // React Aria NumberField onChange는 커밋 시점에만 호출됨
            // (blur, Enter, stepper 클릭) → 즉시 store 반영
            const resolved = isNaN(val)
              ? allowEmpty
                ? undefined
                : (min ?? 0)
              : val;
            setLocalValue(resolved);
            commit(resolved);
          }}
          minValue={min}
          maxValue={max}
          step={step}
          isWheelDisabled={false}
        >
          <Group className="react-aria-NumberField-group">
            <Input
              className="react-aria-Input react-aria-NumberField-input"
              placeholder={placeholder}
              onFocus={(e) => {
                e.target.select();
                committedRef.current = false;
                focusedElementIdRef.current =
                  useStore.getState().selectedElementId ?? null;
              }}
              onBlur={() => {
                if (committedRef.current) {
                  committedRef.current = false;
                  return;
                }
                const currentId = useStore.getState().selectedElementId ?? null;
                if (
                  focusedElementIdRef.current !== null &&
                  currentId !== focusedElementIdRef.current
                ) {
                  return;
                }
                commit(localValue);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit(localValue);
                  (e.target as HTMLInputElement).blur();
                }
              }}
            />
            <span className="react-aria-NumberField-steppers">
              <Button
                slot="decrement"
                className="react-aria-NumberField-button"
                aria-label={
                  i18n ? translateDisplayLabel(i18n.t, "Decrease") : "Decrease"
                }
              >
                <Minus size={10} />
              </Button>
              <Button
                slot="increment"
                className="react-aria-NumberField-button"
                aria-label={
                  i18n ? translateDisplayLabel(i18n.t, "Increase") : "Increase"
                }
              >
                <Plus size={10} />
              </Button>
            </span>
          </Group>
        </NumberField>
      </PropertyFieldset>
    );
  },
  (prevProps, nextProps) =>
    prevProps.value === nextProps.value &&
    prevProps.onChange === nextProps.onChange &&
    prevProps.label === nextProps.label &&
    prevProps.min === nextProps.min &&
    prevProps.max === nextProps.max &&
    prevProps.step === nextProps.step,
);
