import React, { memo, useState, useCallback } from "react";
import {
  Select as AriaSelect,
  SelectValue,
} from "react-aria-components/Select";
import { Button } from "react-aria-components/Button";
import { Popover } from "react-aria-components/Popover";
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import { ChevronDown } from "lucide-react";
import { iconProps } from "../../../utils/ui/uiConstants";
import { useSelectTriggerFocusRestore } from "./useSelectTriggerFocusRestore";
import {
  useControlPopoverMetrics,
  type PopoverWidthMode,
} from "./useControlPopoverMetrics";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../i18n";

interface PropertySelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  /** 컬렉션 컬럼명 등 사용자 데이터는 번역하지 않는다. */
  translateOptions?: boolean;
  /**
   * 옵션 값의 해석 모드 (기본 `legacy`).
   *
   * - `legacy`: 기존 동작. item key = 옵션 값 자체이며 `"reset"` 은 스타일 초기화 명령으로
   *   해석해 `onChange("")` 로 바꾼다. 빈 값은 선택 없음(또는 reset 항목)으로 표현한다.
   * - `literal`: 옵션 값이 UI 문구가 아니라 **원본 데이터 키**다. item key 를 값과 일대일
   *   대응하는 비어 있지 않은 UI key 로 바꿔 빈 문자열도 유효한 항목으로 표현하고,
   *   선택 시 현재 options 에서 대응 항목을 찾아 **원본 값 그대로** 전달한다. 예약 문자열
   *   치환이 없으므로 `reset` 이라는 이름의 실제 필드도 손실 없이 저장된다.
   *
   * literal 모드는 라벨 번역 정책(`translateOptions`)과 독립이다 — 한쪽이 다른 쪽을
   * 활성화하지 않는다.
   */
  optionValueMode?: "legacy" | "literal";
  /**
   * 선택 불가 항목의 **옵션 값** (ADR-210 — columns 모드의 Pie/Radial). RAC `Select`
   * 의 `disabledKeys` 로 그대로 전달하며 (literal 모드는 UI key 로 변환) reset/literal/
   * 키보드 계약은 바꾸지 않는다. 사유 문구는 호출부가 별도 hint 로 둔다.
   */
  disabledKeys?: readonly string[];
  icon?: React.ComponentType<{
    color?: string;
    size?: number;
    strokeWidth?: number;
  }>;
  className?: string;
  description?: string; // Optional description (not displayed)
  popoverWidthMode?: PopoverWidthMode;
}

/**
 * literal 모드의 UI item key — 원본 값과 일대일 대응하며 비어 있지 않다.
 *
 * `""` / `"reset"` / `"value:\"\""` 같은 서로 다른 원본 문자열이 같은 key 로 접히지
 * 않아야 하므로 JSON 직렬화를 쓴다. locale·목록 순서·라벨에 의존하지 않는다.
 */
function literalKey(value: string): string {
  return `value:${JSON.stringify(value)}`;
}

// 🚀 Phase 21: memo + 커스텀 비교 함수 적용
export const PropertySelect = memo(
  function PropertySelect({
    label,
    value,
    onChange,
    options,
    translateOptions = true,
    optionValueMode = "legacy",
    disabledKeys,
    icon: Icon,
    className,
    popoverWidthMode = "fit-content",
  }: PropertySelectProps) {
    const i18n = useOptionalI18n();
    const displayLabel = i18n
      ? translateKey(i18n.t, semanticLabelKeys[label] ?? label, label)
      : label;
    // 🚀 Fix: 명시적 isOpen 관리로 "reset" 선택 시 팝업 닫힘 보장
    // React Aria의 controlled Select에서 onSelectionChange 내 onChange("") 호출이
    // 상태 변경을 유발하여 팝업 자동 닫힘을 방해하는 문제 해결
    const [isOpen, setIsOpen] = useState(false);
    // 팝오버 폭·좌측 정렬 계산은 useControlPopoverMetrics 단일 소스 (패널 공통 규약)
    const { anchorRef, controlRef, popoverStyle } = useControlPopoverMetrics({
      widthMode: popoverWidthMode,
    });
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
    const handleChange = useCallback(
      (key: React.Key | null) => {
        if (optionValueMode === "literal") {
          // UI key → 원본 값 역매핑. 이벤트 문자열을 파싱하지 않고 현재 options 에서 찾는다.
          //   options 에 없는 key 와 null(취소)은 no-op — 해제는 명시적 None 선택만이다.
          const option = options.find((opt) => literalKey(opt.value) === key);
          if (option) onChange(option.value);
          return;
        }
        const selectedValue = key as string;
        // "reset" 선택 시 inline style 제거 (빈 문자열 전달)
        if (selectedValue === "reset") {
          onChange("");
        } else {
          onChange(selectedValue);
        }
      },
      [onChange, optionValueMode, options],
    );

    return (
      <fieldset className={`properties-aria ${className || ""}`}>
        <legend className="fieldset-legend">{displayLabel}</legend>
        <div className="react-aria-control react-aria-Group" ref={anchorRef}>
          <AriaSelect
            className="react-aria-Select"
            ref={controlRef}
            isOpen={isOpen}
            onOpenChange={handleOpenChange}
            selectedKey={
              optionValueMode === "literal"
                ? options.some((opt) => opt.value === value)
                  ? literalKey(value)
                  : null
                : value === ""
                  ? options.some((opt) => opt.value === "reset")
                    ? "reset"
                    : null
                  : value
            }
            onSelectionChange={handleChange}
            aria-label={displayLabel}
            disabledKeys={
              disabledKeys && disabledKeys.length > 0
                ? disabledKeys.map((key) =>
                    optionValueMode === "literal" ? literalKey(key) : key,
                  )
                : undefined
            }
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
              style={popoverStyle}
            >
              <ListBox className="react-aria-ListBox">
                {options.map((option) => (
                  <ListBoxItem
                    key={
                      optionValueMode === "literal"
                        ? literalKey(option.value)
                        : option.value
                    }
                    id={
                      optionValueMode === "literal"
                        ? literalKey(option.value)
                        : option.value
                    }
                    className="react-aria-ListBoxItem"
                    textValue={
                      i18n && translateOptions
                        ? translateKey(
                            i18n.t,
                            semanticLabelKeys[option.label] ?? option.label,
                            option.label,
                          )
                        : option.label
                    }
                  >
                    {i18n && translateOptions
                      ? translateKey(
                          i18n.t,
                          semanticLabelKeys[option.label] ?? option.label,
                          option.label,
                        )
                      : option.label}
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
      prevProps.translateOptions === nextProps.translateOptions &&
      prevProps.optionValueMode === nextProps.optionValueMode &&
      prevProps.disabledKeys === nextProps.disabledKeys &&
      prevProps.popoverWidthMode === nextProps.popoverWidthMode
    );
  },
);
