import { Check } from "lucide-react";

import React, { memo, useCallback, useMemo, useState } from "react";

import { Header } from "react-aria-components/Header";

import { ListBoxItem, ListBoxSection } from "react-aria-components/ListBox";

import { SelectValue } from "react-aria-components/Select";

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
import { PanelSelect, PanelSelectItem } from "./PanelSelect";

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
    descriptions,
    formatValue,
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
    // popover 닫힘 전환 gap 의 focus 복원은 PanelSelect 가 건다 (useSelectTriggerFocusRestore)
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

    // 항목 목록 — 닫힌 Select 도 RAC 가 collection 을 만들려고 항목을 렌더한다. 같은 옵션이면 같은
    //   element 를 돌려줘 다시 그릴 때 항목 렌더 · 번역을 건너뛴다 (2026-10-23 ratchet — frame ·
    //   page 루트의 Locale 37 항목이 선택마다 렌더 · 번역 ×4~5).
    const t = i18n?.t;
    const listBox = useMemo(() => {
      const optionLabel = (option: { value: string; label: string }) =>
        t && translateOptions
          ? translateKey(
              t,
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
                    strokeWidth={1}
                  />
                )}
              </span>
            )}
          </ListBoxItem>
        );
      };

      const listItem = (option: { value: string; label: string }) => (
        <PanelSelectItem
          key={itemKey(option)}
          id={itemKey(option)}
          label={optionLabel(option)}
          description={descriptions?.[option.value]}
          swatch={swatches?.[option.value]}
        />
      );
      // 머리글 구획 — sections 순서대로, 어디에도 없는 값은 머리글 없이 맨 뒤
      const listGroups: ReadonlyArray<{
        label?: string;
        options: ReadonlyArray<(typeof options)[number]>;
      }> = (() => {
        if (!sections?.length) return [{ options }];
        const byValue = new Map(options.map((o) => [o.value, o]));
        const placed = new Set<string>();
        const groups: {
          label?: string;
          options: (typeof options)[number][];
        }[] = sections.map((section) => ({
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
      return grid
        ? gridGroups.map((group, index) => (
            <ListBoxSection
              key={index}
              className="react-aria-ListBoxSection property-select-grid__section"
              aria-label={`${displayLabel} ${index + 1}`}
            >
              {group.map(gridItem)}
            </ListBoxSection>
          ))
        : listGroups.map((group, index) =>
            group.label === undefined ? (
              group.options.map(listItem)
            ) : (
              <ListBoxSection
                key={`section-${index}`}
                className="react-aria-ListBoxSection"
              >
                <Header>{group.label}</Header>
                {group.options.map(listItem)}
              </ListBoxSection>
            ),
          );
    }, [
      displayLabel,
      grid,
      gridSections,
      optionValueMode,
      options,
      sections,
      swatches,
      descriptions,
      t,
      translateOptions,
    ]);

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
          <PanelSelect
            selectRef={controlRef}
            isOpen={isOpen}
            onOpenChange={setIsOpen}
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
            grid={grid}
            popoverStyle={popoverStyle}
            trigger={
              <>
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
                    ) : formatValue?.(value) !== undefined ? (
                      formatValue(value)
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
                    ) : descriptions ? (
                      // An option with a hint renders label + description; the trigger shows the
                      // label only (`selectedText` = textValue).
                      selectedText
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
              </>
            }
          >
            {listBox}
          </PanelSelect>
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
      prevProps.descriptions === nextProps.descriptions &&
      prevProps.formatValue === nextProps.formatValue &&
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
