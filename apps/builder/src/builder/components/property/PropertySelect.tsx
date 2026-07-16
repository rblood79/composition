import React, { memo, useState, useCallback, useEffect, useRef } from "react";
import {
  Select as AriaSelect,
  Button,
  SelectValue,
  Popover,
  ListBox,
  ListBoxItem,
} from "react-aria-components";
import { ChevronDown } from "lucide-react";
import { iconProps } from "../../../utils/ui/uiConstants";
import { useSelectTriggerFocusRestore } from "./useSelectTriggerFocusRestore";

interface PropertySelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  icon?: React.ComponentType<{
    color?: string;
    size?: number;
    strokeWidth?: number;
  }>;
  className?: string;
  description?: string; // Optional description (not displayed)
  popoverWidthMode?: "width" | "min-width" | "fit-content";
}

// 🚀 Phase 21: memo + 커스텀 비교 함수 적용
export const PropertySelect = memo(
  function PropertySelect({
    label,
    value,
    onChange,
    options,
    icon: Icon,
    className,
    popoverWidthMode = "fit-content",
  }: PropertySelectProps) {
    // 🚀 Fix: 명시적 isOpen 관리로 "reset" 선택 시 팝업 닫힘 보장
    // React Aria의 controlled Select에서 onSelectionChange 내 onChange("") 호출이
    // 상태 변경을 유발하여 팝업 자동 닫힘을 방해하는 문제 해결
    const [isOpen, setIsOpen] = useState(false);
    const groupRef = useRef<HTMLDivElement>(null);
    const selectRef = useRef<HTMLDivElement>(null);
    // 🚀 Fix: popover 닫힘 전환 gap 의 focus ring 깜빡임 방지 —
    // 상세 주석은 useSelectTriggerFocusRestore.ts 참조
    const { triggerRef, restoreFocusOnClose } = useSelectTriggerFocusRestore();
    const handleOpenChange = useCallback(
      (open: boolean) => {
        setIsOpen(open);
        restoreFocusOnClose(open);
      },
      [restoreFocusOnClose],
    );
    const [popoverMetrics, setPopoverMetrics] = useState({
      width: 0,
      offset: 0,
    });

    useEffect(() => {
      const updatePopoverMetrics = () => {
        const groupElement = groupRef.current;
        const selectElement = selectRef.current;

        if (!groupElement || !selectElement) return;

        const groupRect = groupElement.getBoundingClientRect();
        const selectRect = selectElement.getBoundingClientRect();
        const nextMetrics = {
          width: Math.round(groupRect.width),
          offset: Math.round(groupRect.left - selectRect.left),
        };

        setPopoverMetrics((prev) => {
          if (
            prev.width === nextMetrics.width &&
            prev.offset === nextMetrics.offset
          ) {
            return prev;
          }

          return nextMetrics;
        });
      };

      updatePopoverMetrics();

      if (typeof ResizeObserver === "undefined") {
        window.addEventListener("resize", updatePopoverMetrics);

        return () => {
          window.removeEventListener("resize", updatePopoverMetrics);
        };
      }

      const resizeObserver = new ResizeObserver(() => {
        updatePopoverMetrics();
      });

      if (groupRef.current) {
        resizeObserver.observe(groupRef.current);
      }

      if (selectRef.current) {
        resizeObserver.observe(selectRef.current);
      }

      window.addEventListener("resize", updatePopoverMetrics);

      return () => {
        resizeObserver.disconnect();
        window.removeEventListener("resize", updatePopoverMetrics);
      };
    }, []);

    const handleChange = useCallback(
      (key: React.Key | null) => {
        const selectedValue = key as string;
        // "reset" 선택 시 inline style 제거 (빈 문자열 전달)
        if (selectedValue === "reset") {
          onChange("");
        } else {
          onChange(selectedValue);
        }
      },
      [onChange],
    );

    return (
      <fieldset className={`properties-aria ${className || ""}`}>
        <legend className="fieldset-legend">{label}</legend>
        <div className="react-aria-control react-aria-Group" ref={groupRef}>
          <AriaSelect
            className="react-aria-Select"
            ref={selectRef}
            isOpen={isOpen}
            onOpenChange={handleOpenChange}
            selectedKey={
              value === ""
                ? options.some((opt) => opt.value === "reset")
                  ? "reset"
                  : null
                : value
            }
            onSelectionChange={handleChange}
            aria-label={label}
          >
            <Button className="react-aria-Button" ref={triggerRef}>
              {Icon && (
                <label className="control-label">
                  <Icon
                    color={iconProps.color}
                    size={iconProps.size}
                    strokeWidth={iconProps.strokeWidth}
                  />
                </label>
              )}
              <SelectValue />
              <span aria-hidden="true" className="select-chevron">
                <ChevronDown size={iconProps.size} />
              </span>
            </Button>
            <Popover
              className="react-aria-Popover property-select-popover"
              style={{
                width:
                  popoverWidthMode === "width" && popoverMetrics.width > 0
                    ? `${popoverMetrics.width}px`
                    : popoverWidthMode === "fit-content"
                      ? "max-content"
                      : undefined,
                minWidth:
                  popoverWidthMode === "fit-content" && popoverMetrics.width > 0
                    ? `${popoverMetrics.width}px`
                    : popoverWidthMode === "min-width" &&
                        popoverMetrics.width > 0
                      ? `${popoverMetrics.width}px`
                      : undefined,
                marginLeft:
                  popoverMetrics.offset !== 0
                    ? `${popoverMetrics.offset}px`
                    : undefined,
              }}
            >
              <ListBox className="react-aria-ListBox">
                {options.map((option) => (
                  <ListBoxItem
                    key={option.value}
                    id={option.value}
                    className="react-aria-ListBoxItem"
                    textValue={option.label}
                  >
                    {option.label}
                  </ListBoxItem>
                ))}
              </ListBox>
            </Popover>
          </AriaSelect>
        </div>
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
      prevProps.options === nextProps.options &&
      prevProps.popoverWidthMode === nextProps.popoverWidthMode
    );
  },
);
