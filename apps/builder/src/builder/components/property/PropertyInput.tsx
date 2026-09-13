import React, { useState, useEffect, useRef, memo } from "react";
import { PropertyFieldset } from "./PropertyFieldset";
import { useStore } from "../../stores";
import "./PropertyInput.css";

interface PropertyInputProps {
  label?: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: "text" | "number" | "color";
  icon?: React.ComponentType<{
    color?: string;
    size?: number;
    strokeWidth?: number;
  }>;
  placeholder?: string;
  className?: string;
  multiline?: boolean; // New prop for multiline input
  min?: string | number; // 최소값
  max?: string | number; // 최대값
  disabled?: boolean; // Disable input (read-only)
  description?: string; // Optional description (not displayed)
  /**
   * ADR-214 Phase 3 — `{{` 자동완성 후보 (가시성 사슬의 변수 이름). 캐럿 앞이 `{{ 접두` 이면
   * 목록을 보여 주고 Enter/클릭으로 `{{ name }}` 을 넣는다. 미지정이면 종전 입력.
   */
  stateNames?: readonly string[];
}

const STATE_TRIGGER = /\{\{\s*([A-Za-z_$][\w$]*)?$/;

export const PropertyInput = memo(
  function PropertyInput({
    label,
    value,
    onChange,
    type = "text",
    icon,
    placeholder,
    className,
    multiline, // Destructure the new prop
    min,
    max,
    disabled,
    stateNames,
  }: PropertyInputProps) {
    const selectedElementId = useStore((state) => state.selectedElementId);
    // Local state for input value (debounced save)
    const [inputValue, setInputValue] = useState<string>(String(value || ""));
    // `{{` 자동완성 — 캐럿 위치 기준 후보 (stateNames 가 있을 때만)
    const [suggest, setSuggest] = useState<{
      start: number;
      end: number;
      items: string[];
      index: number;
    } | null>(null);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

    const updateSuggest = (text: string, caret: number | null) => {
      if (!stateNames || stateNames.length === 0 || caret === null) {
        setSuggest(null);
        return;
      }
      const before = text.slice(0, caret);
      const match = STATE_TRIGGER.exec(before);
      if (!match) {
        setSuggest(null);
        return;
      }
      const prefix = (match[1] ?? "").toLowerCase();
      const items = stateNames.filter((name) =>
        name.toLowerCase().startsWith(prefix),
      );
      if (items.length === 0) {
        setSuggest(null);
        return;
      }
      setSuggest({ start: caret - match[0].length, end: caret, items, index: 0 });
    };

    const applySuggestion = (name: string) => {
      if (!suggest) return;
      const next = `${inputValue.slice(0, suggest.start)}{{ ${name} }}${inputValue.slice(suggest.end)}`;
      setInputValue(next);
      setSuggest(null);
      const caret = suggest.start + name.length + 6;
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(caret, caret);
        }
      });
    };

    // ⭐ useRef로 변경: 즉시 반영되는 플래그 (useState는 비동기!)
    const justSavedViaEnterRef = useRef(false);
    const focusedElementIdRef = useRef<string | null>(null);

    // Sync local state with prop value / selection when it changes externally
    useEffect(() => {
      setInputValue(String(value || ""));
      // Reset the flag when value changes from parent
      justSavedViaEnterRef.current = false;
      focusedElementIdRef.current = null;
    }, [value, selectedElementId]);

    const handleFocus = (
      e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      // Select all text on focus for easier editing
      e.target.select();
      // Reset flag on focus (new editing session)
      justSavedViaEnterRef.current = false;
      focusedElementIdRef.current = selectedElementId ?? null;
    };

    const handleChange = (newValue: string) => {
      // Update local state immediately for responsive UI
      setInputValue(newValue);
      updateSuggest(newValue, inputRef.current?.selectionStart ?? null);
    };

    const handleBlur = () => {
      // ⭐ Skip save if we just saved via Enter key (useRef는 즉시 반영됨!)
      if (justSavedViaEnterRef.current) {
        justSavedViaEnterRef.current = false;
        return;
      }

      const currentElementId = useStore.getState().selectedElementId ?? null;
      if (
        focusedElementIdRef.current !== null &&
        currentElementId !== focusedElementIdRef.current
      ) {
        return;
      }

      // Save to parent only on blur (reduces DB calls)
      if (inputValue !== String(value || "")) {
        onChange(inputValue);
      }
    };

    const handleKeyDown = (
      e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      if (suggest) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          const delta = e.key === "ArrowDown" ? 1 : -1;
          setSuggest({
            ...suggest,
            index:
              (suggest.index + delta + suggest.items.length) %
              suggest.items.length,
          });
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          applySuggestion(suggest.items[suggest.index]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setSuggest(null);
          return;
        }
      }
      if (e.key === "Enter" && !multiline) {
        // Save on Enter (only for single-line inputs)
        e.preventDefault();
        if (inputValue !== String(value || "")) {
          onChange(inputValue);
          // ⭐ useRef로 즉시 플래그 설정 (setState와 달리 동기적!)
          justSavedViaEnterRef.current = true;
        }
        // Blur the input to confirm the change
        (e.target as HTMLInputElement | HTMLTextAreaElement).blur();
      }
    };

    const suggestionList = suggest ? (
      <ul
        className="property-input-suggest"
        role="listbox"
        aria-label="{{ variables"
      >
        {suggest.items.map((name, i) => (
          <li
            key={name}
            role="option"
            aria-selected={i === suggest.index}
            className="property-input-suggest-item"
            data-active={i === suggest.index ? "true" : undefined}
            // mousedown 은 input blur 보다 먼저 — preventDefault 로 blur 저장을 막고 넣는다
            onMouseDown={(e) => {
              e.preventDefault();
              applySuggestion(name);
            }}
          >
            {`{{ ${name} }}`}
          </li>
        ))}
      </ul>
    ) : null;

    return (
      <PropertyFieldset
        legend={label}
        icon={icon}
        className={
          stateNames && stateNames.length > 0
            ? `${className ?? ""} property-input-with-suggest`.trim()
            : className
        }
      >
        {multiline ? (
          <textarea
            ref={(el) => {
              inputRef.current = el;
            }}
            className="react-aria-TextArea resize-y" // Added resize-y for vertical resizing
            value={inputValue}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={() => {
              setSuggest(null);
              handleBlur();
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={4} // Default rows for textarea
            disabled={disabled}
          />
        ) : (
          <input
            ref={(el) => {
              inputRef.current = el;
            }}
            className="react-aria-Input"
            type={type}
            value={inputValue}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={handleFocus}
            onBlur={() => {
              setSuggest(null);
              handleBlur();
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            min={min}
            max={max}
            disabled={disabled}
          />
        )}
        {suggestionList}
      </PropertyFieldset>
    );
  },
  (prevProps, nextProps) => {
    // ⭐ 커스텀 비교: onChange 함수 참조는 무시하고 실제 값만 비교
    return (
      prevProps.label === nextProps.label &&
      prevProps.value === nextProps.value &&
      prevProps.type === nextProps.type &&
      prevProps.placeholder === nextProps.placeholder &&
      prevProps.className === nextProps.className &&
      prevProps.multiline === nextProps.multiline &&
      prevProps.min === nextProps.min &&
      prevProps.max === nextProps.max &&
      prevProps.disabled === nextProps.disabled &&
      prevProps.icon === nextProps.icon &&
      prevProps.stateNames === nextProps.stateNames
    );
  },
);
