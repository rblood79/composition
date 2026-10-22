import { Check, ChevronDown } from "lucide-react";

import React, { memo, useCallback, useState } from "react";

import { Button } from "react-aria-components/Button";

import { Header } from "react-aria-components/Header";

import {
  ListBox,
  ListBoxItem,
  ListBoxSection,
} from "react-aria-components/ListBox";

import { Popover } from "react-aria-components/Popover";

import {
  Select as AriaSelect,
  SelectValue,
} from "react-aria-components/Select";

import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../i18n";

import { iconProps } from "../../../utils/ui/uiConstants";

import { useLatestCallbacks } from "./latestCallbacks";

import "./PropertySelectGrid.css";

import "./PropertySwatch.css";

import { useControlPopoverMetrics } from "./useControlPopoverMetrics";

import { literalKey, PropertySelectProps } from "./PropertySelect.runtime";
import { useSelectTriggerFocusRestore } from "./useSelectTriggerFocusRestore";

// 🚀 Phase 21: memo + 커스텀 비교 함수 적용
export const PropertySelectControl = memo(
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
    sections,
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

    const listItem = (option: { value: string; label: string }) => (
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
      </ListBoxItem>);
    // 머리글 구획 — sections 순서대로, 어디에도 없는 값은 머리글 없이 맨 뒤
    const listGroups: ReadonlyArray<{
      label?: string;
      options: ReadonlyArray<(typeof options)[number]>;
    }> = (() => {
      if (!sections?.length) return [{ options }];
      const byValue = new Map(options.map((o) => [o.value, o]));
      const placed = new Set<string>();
      const groups: { label?: string; options: (typeof options)[number][] }[] =
        sections.map((section) => ({
          label: section.label,
          options: section.values.flatMap((v) => {
            const option = byValue.get(v);
            if (!option || placed.has(v)) return [];
            placed.add(v);
            return [option];
          }),
        }));
      const rest = options.filter((o) => !placed.has(o.value));
      if (rest.length > 0) groups.push({ options: rest });
      return groups.filter((g) => g.options.length > 0);
    })();

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
                  {listGroups.map((group, index) =>
                    group.label === undefined ? (
                      group.options.map(listItem)
                    ) : (
                      <ListBoxSection
                        key={`section-${index}`}
                        className="react-aria-ListBoxSection"
                      >
                        <Header className="property-select__section-header">
                          {group.label}
                        </Header>
                        {group.options.map(listItem)}
                      </ListBoxSection>
                    ),
                  )}
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
      prevProps.sections === nextProps.sections &&
      prevProps.afterControl === nextProps.afterControl &&
      prevProps.popoverWidthMode === nextProps.popoverWidthMode
    );
  },
);
const CALLBACK_KEYS: readonly (keyof PropertySelectProps)[] = ["onChange"];
export function PropertySelect(props: PropertySelectProps) {
  const current = useLatestCallbacks(props, CALLBACK_KEYS);
  return <PropertySelectControl {...current} />;
}
