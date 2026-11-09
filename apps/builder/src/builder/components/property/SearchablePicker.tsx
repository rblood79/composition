/**
 * SearchablePicker — 검색되는 고르기 팝오버 하나 (2026-11-09).
 *
 * `DialogTrigger` + 트리거 (호출부의 RAC `Button`) + `Popover` + `Dialog` + `Autocomplete` (검색이 목록을
 * 거른다 — 입력이 DOM focus 를 갖고 방향키가 목록의 가상 focus 를 옮긴다) + 빌더 `SearchField` +
 * 구역 머리글 목록 (`SearchablePickerSection`). 항목이 많으면 `virtualized` (RAC Virtualizer · 28 행).
 * 목록 Popover 에는 빌더 팝업 목록 정본 class 가 붙는다.
 *
 * 쓰는 곳: Interactions 대상 · 값 고르기, 컴포넌트 교체 · 슬롯 삽입 · instance 속성 (CatalogComponentPicker),
 * 글꼴 고르기 (`FontFamilyPicker` — 선택 ✓ (`selectedKey`) · 짧은 목록은 검색 칸 없이 (`searchable`) ·
 * 목록 아래 관리 줄 (`footer`)). 아이콘 고르기 (`IconPickerPopover`) 는 견본 격자라 대상이 아니다.
 *
 * Why: 같은 조합을 세 파일이 따로 조립했고 팝오버 · 검색 · 목록 CSS (여백 · 최대 높이 · 그림자) 도
 * 두 벌 (`interactions-target-*` · `component-swap-*`) 이었다.
 */
import type { CSSProperties, ReactNode } from "react";
import { Autocomplete } from "react-aria-components/Autocomplete";
import type { Key } from "react-aria-components/Collection";
import { Dialog, DialogTrigger } from "react-aria-components/Dialog";
import { Header } from "react-aria-components/Header";
import { ListBox, ListBoxSection } from "react-aria-components/ListBox";
import { Popover } from "react-aria-components/Popover";
import { ListLayout, Virtualizer } from "react-aria-components/Virtualizer";
import { useFilter } from "react-aria-components";

import { SearchField } from "../ui/SearchField";
import { BUILDER_POPUP_LIST_CLASS } from "../../styles/modules/builderPopupList";
import "./SearchablePicker.css";

const VIRTUAL_LAYOUT = { rowHeight: 28, headingHeight: 24 };

export interface SearchablePickerProps {
  /** 목록 · Dialog 의 접근 이름 */
  label: string;
  /** 검색 칸의 placeholder · 접근 이름 */
  searchLabel: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 트리거 — RAC `Button` */
  trigger: ReactNode;
  /** 항목을 고르면 — `selectedKey` 가 있으면 선택이 바뀔 때 */
  onAction: (key: Key) => void;
  /** 현재 값 (선택 ✓) — 주면 단일 선택 목록, 없으면 동작 목록 */
  selectedKey?: Key;
  /** 검색 칸 (기본 켬) — 몇 줄짜리 목록은 훑는 쪽이 빠르다 */
  searchable?: boolean;
  /** 목록 아래 줄 (관리 진입 등) — 구분선 위 */
  footer?: ReactNode;
  placement?: "bottom start" | "bottom end";
  /** 호출부 class (최소 폭 등) — popover · list 에 붙는다 */
  popoverClassName?: string;
  listClassName?: string;
  popoverStyle?: CSSProperties;
  /** 보이는 행만 그린다 (RAC Virtualizer) — 목록은 고정 높이 상자 */
  virtualized?: boolean;
  /** `SearchablePickerSection` 들 */
  children: ReactNode;
}

export function SearchablePicker({
  label,
  searchLabel,
  open,
  onOpenChange,
  trigger,
  onAction,
  selectedKey,
  searchable = true,
  footer,
  placement = "bottom start",
  popoverClassName,
  listClassName,
  popoverStyle,
  virtualized = false,
  children,
}: SearchablePickerProps) {
  const { contains } = useFilter({ sensitivity: "base" });
  // 목록은 Popover 안에 그대로 적는다 (변수로 빼면 정적 게이트 (a) 가 Popover 안 ListBox 를 못 본다)
  const listProps = {
    className: `react-aria-ListBox searchable-picker-list${listClassName ? ` ${listClassName}` : ""}`,
    "data-virtualized": virtualized || undefined,
    "aria-label": label,
    ...(selectedKey === undefined
      ? { selectionMode: "none" as const, onAction }
      : {
          selectionMode: "single" as const,
          disallowEmptySelection: true,
          selectedKeys: [selectedKey],
          onSelectionChange: (keys: "all" | Set<Key>) => {
            const next = keys === "all" ? undefined : [...keys][0];
            if (next != null) onAction(next);
          },
        }),
  };
  return (
    <DialogTrigger isOpen={open} onOpenChange={onOpenChange}>
      {trigger}
      <Popover
        className={`react-aria-Popover property-select-popover searchable-picker-popover ${BUILDER_POPUP_LIST_CLASS}${popoverClassName ? ` ${popoverClassName}` : ""}`}
        placement={placement}
        style={popoverStyle}
      >
        <Dialog className="searchable-picker-dialog" aria-label={label}>
          <Autocomplete filter={contains}>
            {searchable && (
              <SearchField
                appearance="control"
                autoFocus
                placeholder={searchLabel}
                aria-label={searchLabel}
              />
            )}
            {virtualized ? (
              <Virtualizer layout={ListLayout} layoutOptions={VIRTUAL_LAYOUT}>
                <ListBox {...listProps}>{children}</ListBox>
              </Virtualizer>
            ) : (
              <ListBox {...listProps}>{children}</ListBox>
            )}
          </Autocomplete>
          {footer != null && (
            <div className="searchable-picker-footer">{footer}</div>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

/** 머리글이 있는 구역 — 항목이 없으면 그리지 않는다 */
export function SearchablePickerSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode[];
}) {
  return children.length ? (
    <ListBoxSection id={id}>
      <Header>{title}</Header>
      {children}
    </ListBoxSection>
  ) : null;
}
