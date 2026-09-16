import React, { memo, useState, useCallback } from "react";
import {
  Select as AriaSelect,
  SelectValue,
} from "react-aria-components/Select";
import { Button } from "react-aria-components/Button";
import { Popover } from "react-aria-components/Popover";
import {
  ListBox,
  ListBoxItem,
  ListBoxSection,
} from "react-aria-components/ListBox";
import { Check, ChevronDown } from "lucide-react";
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
import "./PropertySelectGrid.css";
import "./PropertySwatch.css";

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
   * 값 → 색 (CSS 색/토큰). 있으면 트리거와 항목 앞에 색 점 — 값이 곧 색인 variant (Button ·
   * Badge · StatusLight) 의 미리보기. 없는 값은 점 없이 글자만.
   */
  swatches?: Readonly<Record<string, string>>;
  /**
   * 팝오버를 목록 대신 **6열 스와치 격자** 로 (Theme 패널 tint-grid 어법 — 28 칸 · gap 8 · 선택
   * 체크). 값이 곧 색인 variant (Badge 25 · StatusLight 19, 2026-09-16 사용자 판정 「A 팝오버
   * grid」). 트리거는 그대로 색 점 + 이름. `swatches` 가 함께 있어야 칸에 색이 든다. 구획
   * (`gridSections` — 옵션 값 묶음, 순서대로) 사이엔 구분선. 어느 구획에도 없는 값은 마지막
   * 구획 뒤에 선다. RAC ListBox `layout="grid"` 라 화살표 2차원 이동 · 타이핑 검색 유지.
   * 칸의 이름은 `title` (hover) + 접근 이름 (`textValue`).
   */
  grid?: boolean;
  gridSections?: readonly (readonly string[])[];
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
  /**
   * `legend` (기본, 필드 위 18 행) / `inline` (legend·아이콘 없이 28 상자만 — 값이 곧 라벨인
   * 셀렉트, Font Weight 「Semi Bold ▾」 등. 접근 이름은 label 그대로, panel-ui 03) /
   * `suffix` (라벨을 상자 안 우측 10 mono caps 로 — 「Primary VARIANT ▾」, panel-ui 07).
   */
  labelMode?: "legend" | "inline" | "suffix";
  suffixLabel?: string;
  description?: string; // Optional description (not displayed)
  /**
   * 컨트롤 박스 아래 필드 상태 문구 슬롯 (RAC `<Text slot="description">` / `.react-aria-FieldError`).
   * 값·데이터에 반응하는 메시지만 — 정적 설명은 여기 두지 않는다 (legend help 후속).
   */
  afterControl?: React.ReactNode;
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
    swatches,
    grid = false,
    gridSections,
    disabledKeys,
    icon: Icon,
    className,
    labelMode = "legend",
    suffixLabel,
    afterControl,
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

    const optionLabel = (option: { value: string; label: string }) =>
      i18n && translateOptions
        ? translateKey(
            i18n.t,
            semanticLabelKeys[option.label] ?? option.label,
            option.label,
          )
        : option.label;
    const itemKey = (option: { value: string }) =>
      optionValueMode === "literal" ? literalKey(option.value) : option.value;

    // 격자 구획 — gridSections 순서대로, 어디에도 없는 값은 마지막 구획 뒤
    const gridGroups: ReadonlyArray<ReadonlyArray<(typeof options)[number]>> =
      (() => {
        if (!grid) return [];
        const byValue = new Map(options.map((o) => [o.value, o]));
        const placed = new Set<string>();
        const groups = (gridSections ?? [options.map((o) => o.value)]).map(
          (values) =>
            values.flatMap((v) => {
              const option = byValue.get(v);
              if (!option || placed.has(v)) return [];
              placed.add(v);
              return [option];
            }),
        );
        const rest = options.filter((o) => !placed.has(o.value));
        if (rest.length > 0) groups.push(rest);
        return groups.filter((g) => g.length > 0);
      })();

    const gridItem = (option: { value: string; label: string }) => {
      const text = optionLabel(option);
      return (
        <ListBoxItem
          key={itemKey(option)}
          id={itemKey(option)}
          className="react-aria-ListBoxItem property-select-grid__item"
          textValue={text}
          aria-label={text}
        >
          {({ isSelected }) => (
            <span
              className="property-select-grid__swatch"
              title={text}
              style={{ background: swatches?.[option.value] }}
            >
              {isSelected && (
                <Check
                  aria-hidden="true"
                  className="property-select-grid__check"
                  size={iconProps.size}
                  strokeWidth={2.5}
                />
              )}
            </span>
          )}
        </ListBoxItem>
      );
    };

    return (
      <fieldset
        className={`properties-aria ${className || ""}`}
        data-label-mode={labelMode}
        aria-label={labelMode !== "legend" ? displayLabel : undefined}
      >
        {labelMode === "legend" && (
          <legend className="fieldset-legend">{displayLabel}</legend>
        )}
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
              {Icon && labelMode === "legend" && (
                <label className="control-label">
                  <Icon
                    color={iconProps.color}
                    size={iconProps.size}
                    strokeWidth={iconProps.strokeWidth}
                  />
                </label>
              )}
              {/* 값 없음은 「—」 — RAC 기본 「Select an item」 이 반폭 55 에서 「Select an」 으로 잘린다;
                  이름은 legend/aria-label 이 준다 (2026-09-15 live 전수 대조) */}
              {/* 색 점은 항목 children 에 있고 SelectValue 가 선택 항목의 children 을 그대로 그린다 */}
              {/* 격자 모드의 항목 children 은 스와치뿐이라 트리거는 직접 그린다 — 색 점 + 이름 */}
              <SelectValue>
                {({ isPlaceholder, defaultChildren, selectedText }) =>
                  isPlaceholder ? (
                    "—"
                  ) : grid ? (
                    <>
                      {swatches?.[value] != null && (
                        <span
                          aria-hidden="true"
                          className="property-swatch property-select__swatch"
                          style={{ background: swatches[value] }}
                        />
                      )}
                      {selectedText}
                    </>
                  ) : (
                    defaultChildren
                  )
                }
              </SelectValue>
              {labelMode === "suffix" && (
                <span className="property-field__suffix" aria-hidden="true">
                  {suffixLabel ?? displayLabel}
                </span>
              )}
              <span aria-hidden="true" className="select-chevron">
                <ChevronDown size={iconProps.size} />
              </span>
            </Button>
            <Popover
              className={
                grid
                  ? "react-aria-Popover property-select-popover property-select-popover--grid"
                  : "react-aria-Popover property-select-popover"
              }
              style={popoverStyle}
            >
              {grid ? (
                <ListBox
                  className="react-aria-ListBox property-select-grid"
                  layout="grid"
                >
                  {gridGroups.map((group, index) => (
                    <ListBoxSection
                      key={index}
                      className="react-aria-ListBoxSection property-select-grid__section"
                      aria-label={`${displayLabel} ${index + 1}`}
                    >
                      {group.map(gridItem)}
                    </ListBoxSection>
                  ))}
                </ListBox>
              ) : (
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
                    {swatches && swatches[option.value] != null && (
                      <span
                        aria-hidden="true"
                        className="property-swatch property-select__swatch"
                        // 모양은 클래스 (PropertySelectGrid.css, 팝오버 portal 에도 닿는 unlayered) ·
                        //   변하는 색만 인라인
                        style={{ background: swatches[option.value] }}
                      />
                    )}
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
              )}
            </Popover>
          </AriaSelect>
        </div>
        {afterControl}
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
      prevProps.swatches === nextProps.swatches &&
      prevProps.grid === nextProps.grid &&
      prevProps.gridSections === nextProps.gridSections &&
      prevProps.afterControl === nextProps.afterControl &&
      prevProps.popoverWidthMode === nextProps.popoverWidthMode
    );
  },
);
