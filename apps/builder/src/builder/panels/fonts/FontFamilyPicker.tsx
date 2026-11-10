/**
 * Theme·Design이 공유하는 폰트 선택창.
 * 등록·관리 진입점은 Theme에만 두고 Design은 선택과 테마 상속만 제공한다.
 * 기본·사용자 폰트 목록은 같은 레지스트리를 읽으며 등록만으로 선택값을 바꾸지 않는다.
 */

import {
  memo,
  useCallback,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import { Button } from "react-aria-components/Button";
import { ListBoxItem } from "react-aria-components/ListBox";
import type { Key } from "react-aria-components/Collection";
import { Settings2 } from "lucide-react";
import { ACTION_ICONS } from "../../config/actionIcons";
import { iconProps } from "../../../utils/ui/uiConstants";
import { useControlPopoverMetrics } from "../../components/property/useControlPopoverMetrics";
import {
  SearchablePicker,
  SearchablePickerSection,
} from "../../components/property/SearchablePicker";
import {
  DEFAULT_BASE_TYPOGRAPHY,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_OPTIONS,
  extractFirstFontFamily,
} from "../../fonts/customFonts";
import { useFontRegistry } from "./useFontRegistry";
import type { FontManagerDialogProps } from "./FontManagerDialog";
import "./FontFamilyPicker.css";
import { useI18n, useSemanticLabel } from "@/i18n";
import { SelectChevron } from "../../components/property/PanelSelect";

/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const AddIcon = ACTION_ICONS.add;

/** inline style 제거를 뜻하는 항목 key — PropertySelect 의 "reset" 규약과 같다. */
const RESET_KEY = "reset";

/**
 * 검색창을 띄우는 최소 패밀리 수. 3~4개짜리 목록 위의 검색창은 훑는 것보다 느리다.
 * 커스텀 폰트가 쌓이면(상한 FONT_LIMITS.MAX_FACES) 넘어간다.
 */
const SEARCH_MIN_FAMILIES = 7;

interface FontFamilyPickerProps {
  /** Theme처럼 위쪽 필드명이 필요한 곳의 legend. Design은 서체 이름만 표시한다. */
  label?: string;
  /** Theme은 기본 서체 편집·관리, element는 개별 서체 선택·테마 상속. */
  scope?: "theme" | "element";
  /** 현재 fontFamily. element의 빈 문자열은 테마 상속. */
  value: string;
  onChange: (value: string) => void;
  /**
   * ADR-298 Phase 5 (시안 Text 탭): 작성값이 없을 때 실제로 쓰이는 서체 — 테마 base 서체
   * (`installedBaseFontFamily`) 또는 rule 값. 트리거가 「테마」 칩 + 그 이름을 보인다.
   */
  inheritedFamily?: string;
}

/** 글꼴 한 줄 — 이름을 그 글꼴로 그린다 */
function fontItem(option: { value: string; label: string }) {
  return (
    <ListBoxItem
      key={option.value}
      id={option.value}
      className="react-aria-ListBoxItem font-picker-item"
      textValue={option.label}
    >
      <span style={{ fontFamily: option.value }}>{option.label}</span>
    </ListBoxItem>
  );
}

export const FontFamilyPicker = memo(function FontFamilyPicker({
  value,
  onChange,
  inheritedFamily,
  scope = "element",
  label,
}: FontFamilyPickerProps) {
  const { t } = useI18n();
  const localize = useSemanticLabel();
  const defaultValue =
    scope === "theme" ? DEFAULT_BASE_TYPOGRAPHY.fontFamily : "";
  const defaultFamily =
    scope === "theme" ? DEFAULT_FONT_FAMILY : inheritedFamily;
  const defaultLabel = t(
    scope === "theme" ? "fonts.systemDefaultValue" : "fonts.defaultValue",
  );
  const defaultFamilyLabel =
    DEFAULT_FONT_OPTIONS.find((option) => option.value === defaultFamily)
      ?.label ?? defaultFamily;
  const isDefault = value === "" || value === defaultValue;
  const selectedValue = isDefault ? RESET_KEY : value;
  const displayFamily = isDefault
    ? defaultFamilyLabel
    : (DEFAULT_FONT_OPTIONS.find((option) => option.value === value)?.label ??
      extractFirstFontFamily(value));
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [isManagerOpen, setManagerOpen] = useState(false);
  // ADR-242 — 폰트 관리 대화상자는 처음 열 때 chunk 를 받는다 (저빈도 · Styles 패널이 정적으로 끌던
  //   7.7 KB raw). 로드 실패는 대화상자를 닫는 것으로 끝나고 다음 클릭이 다시 시도한다.
  const [ManagerDialog, setManagerDialog] =
    useState<ComponentType<FontManagerDialogProps> | null>(null);
  const { familyGroups, faceCount } = useFontRegistry();
  // 좌측 정렬은 패널 공통 규약 (PropertySelect 와 같은 소스). 폭은 CSS 233 (색 · 아이콘
  //   팝오버와 같은 폭) — "fit-content" 는 inline width 를 써서 CSS 폭을 이긴다.
  const { anchorRef, controlRef, popoverStyle } = useControlPopoverMetrics({
    widthMode: "min-width",
  });

  const options = useMemo(() => {
    const currentFamily = value ? extractFirstFontFamily(value) : "";
    // 기존 fallback 체인은 표시만 짧게 하고, 다시 선택하기 전까지 저장값을 유지한다.
    const withCurrentValue = (option: { value: string; label: string }) =>
      !isDefault && option.value === currentFamily
        ? { ...option, value }
        : option;
    const builtins = DEFAULT_FONT_OPTIONS.filter(
      (option) => option.value !== RESET_KEY,
    ).map(withCurrentValue);
    const customs = Array.from(familyGroups.keys())
      .filter(
        (family) =>
          !builtins.some(
            (option) => extractFirstFontFamily(option.value) === family,
          ),
      )
      .map((family) => withCurrentValue({ value: family, label: family }));
    if (
      !isDefault &&
      ![...builtins, ...customs].some((option) => option.value === value)
    )
      builtins.push({ value, label: currentFamily });
    return { builtins, customs };
  }, [familyGroups, value, isDefault]);
  const showSearch =
    options.builtins.length + options.customs.length >= SEARCH_MIN_FAMILIES;
  // 검색어는 SearchablePicker (Autocomplete) 가 갖는다 — 팝오버가 닫히면 같이 사라진다.
  const handleSelect = useCallback(
    (selected: Key) => {
      onChange(selected === RESET_KEY ? defaultValue : String(selected));
      setPickerOpen(false);
    },
    [onChange, defaultValue],
  );

  const handleOpenManager = useCallback(() => {
    // 팝오버를 먼저 닫는다 — 오버레이 두 겹이 겹치면 dismiss 대상이 모호해진다.
    setPickerOpen(false);
    setManagerOpen(true);
    if (ManagerDialog) return;
    import("./FontManagerDialog").then(
      (m) => setManagerDialog(() => m.FontManagerDialog),
      (error) => {
        console.warn("[fonts] 폰트 관리 대화상자 로드 실패", error);
        setManagerOpen(false);
      },
    );
  }, [ManagerDialog]);

  const ManageIcon = faceCount === 0 ? AddIcon : Settings2;

  return (
    // legend 는 다른 Select 칸과 같다 (Design Text 「Font Family」 · Theme 「Font」 — 2026-11-10 사용자 지적:
    //   panel-ui 03 의 「이름이 곧 라벨」 로 legend 가 빠져 이 칸만 달랐다). legend 가 없으면 접근 이름만.
    <fieldset
      className="properties-aria font-family"
      aria-label={label ? undefined : "Font Family"}
    >
      {label && <legend className="fieldset-legend">{localize(label)}</legend>}
      <div className="react-aria-control react-aria-Group" ref={anchorRef}>
        <SearchablePicker
          label="Font Family"
          searchLabel={t("fonts.searchPlaceholder")}
          open={isPickerOpen}
          onOpenChange={setPickerOpen}
          selectedKey={selectedValue}
          onAction={handleSelect}
          searchable={showSearch}
          popoverClassName="font-picker-popover"
          popoverStyle={popoverStyle}
          trigger={
            <Button
              className="react-aria-Button font-picker-trigger"
              ref={controlRef}
              aria-label="Font Family"
            >
              {/* 이름을 그 폰트로 그린다 — 고르기 전에 생김새가 보이는 것이 피커의 값 */}
              {isDefault && (
                <span className="font-picker-theme-chip">{defaultLabel}</span>
              )}
              <span
                className="font-picker-value"
                title={isDefault ? defaultFamily : value}
                style={
                  displayFamily
                    ? { fontFamily: isDefault ? defaultFamily : value }
                    : undefined
                }
              >
                {displayFamily || defaultLabel}
              </span>
              <SelectChevron />
            </Button>
          }
          footer={
            scope === "theme" ? (
              <Button
                className="font-picker-manage"
                onPress={handleOpenManager}
              >
                <ManageIcon size={iconProps.size} aria-hidden="true" />
                {faceCount === 0 ? t("fonts.addFonts") : t("fonts.manageFonts")}
              </Button>
            ) : undefined
          }
        >
          <SearchablePickerSection
            id="default"
            title={t("fonts.sectionDefault")}
          >
            {[
              <ListBoxItem
                key={RESET_KEY}
                id={RESET_KEY}
                className="react-aria-ListBoxItem font-picker-item"
                textValue={defaultLabel}
              >
                <span className="font-picker-theme-chip">{defaultLabel}</span>
                {defaultFamily && (
                  <span style={{ fontFamily: defaultFamily }}>
                    {defaultFamilyLabel}
                  </span>
                )}
              </ListBoxItem>,
              ...options.builtins.map(fontItem),
            ]}
          </SearchablePickerSection>
          <SearchablePickerSection id="mine" title={t("fonts.sectionMine")}>
            {options.customs.map(fontItem)}
          </SearchablePickerSection>
        </SearchablePicker>
      </div>

      {scope === "theme" && ManagerDialog && (
        <ManagerDialog isOpen={isManagerOpen} onOpenChange={setManagerOpen} />
      )}
    </fieldset>
  );
});
