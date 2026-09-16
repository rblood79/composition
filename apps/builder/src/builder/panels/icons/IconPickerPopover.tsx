/**
 * IconPickerPopover - 아이콘 검색/선택 팝오버
 *
 * Lucide 아이콘 그리드 + 검색
 * React Aria DialogTrigger + Popover 기반
 *
 * 그리드는 RAC `Autocomplete` + `Virtualizer(GridLayout)` + `ListBox layout="grid"` —
 * 검색 입력에서 방향키가 그리드의 가상 포커스를 움직이고 Enter 가 고른다 (APG combobox/listbox).
 * 아이콘 ~1,500 개를 전부 `<button>` 으로 그리던 것을 뷰포트 안 행만 그리도록 (2026-09-16).
 */

import { memo, useCallback, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Autocomplete } from "react-aria-components/Autocomplete";
import { Dialog, DialogTrigger } from "react-aria-components/Dialog";
import { Popover } from "react-aria-components/Popover";
import { Input } from "react-aria-components/Input";
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import type { Selection } from "react-aria-components/ListBox";
import { SearchField } from "react-aria-components/SearchField";
import {
  GridLayout,
  Size,
  Virtualizer,
} from "react-aria-components/Virtualizer";
import type { Key } from "react-aria-components/Collection";
import { IconPreview } from "./components/IconPreview";
import { useIconSearch } from "./hooks/useIconSearch";

const GRID_ICON_SIZE = 20;
const VISIBLE_ROWS = 8;
/** 셀 28 (`--control-size`) — 팔레트 swatch 그리드와 같은 격자 */
const CELL_SIZE = 28;
/** 셀 사이 최소 간격. 7 = 내부 폭 215 (233 − padding 8×2 − border 1×2) 에서 6열 —
 *  GridLayout 은 `floor(width / (cell + space))` 로 열을 세서 CSS auto-fill (gap 8, 6열) 과
 *  같은 열 수를 내려면 한 px 좁아야 한다. */
const CELL_SPACE = 7;
const GRID_MAX_HEIGHT = VISIBLE_ROWS * (CELL_SIZE + CELL_SPACE) + CELL_SPACE;

const GRID_LAYOUT_OPTIONS = {
  minItemSize: new Size(CELL_SIZE, CELL_SIZE),
  maxItemSize: new Size(CELL_SIZE, CELL_SIZE),
  minSpace: new Size(CELL_SPACE, CELL_SPACE),
  preserveAspectRatio: true,
};

interface IconPickerPopoverProps {
  /** 현재 선택된 아이콘 이름 */
  value?: string;
  /** 아이콘 선택 콜백 */
  onSelect: (iconName: string) => void;
  /** 트리거 요소 */
  children: React.ReactNode;
  /**
   * 팝오버 폭·좌측 정렬 override.
   *
   * RAC `Popover` 는 **트리거 버튼** 기준(`--trigger-width`)으로 뜨는데, 패널 field 의
   * 트리거는 선택된 아이콘 미리보기·clear 버튼 유무로 폭이 바뀐다. 그래서 field 박스
   * (`.react-aria-Group`) 기준 값을 호출부(`useControlPopoverMetrics`)가 계산해 넘긴다 —
   * 패널 Select/UnitInput/DataBinding 과 같은 규약.
   */
  popoverStyle?: CSSProperties;
}

export const IconPickerPopover = memo(function IconPickerPopover({
  value,
  onSelect,
  children,
  popoverStyle,
}: IconPickerPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = useCallback(
    (iconName: string) => {
      onSelect(iconName);
      setIsOpen(false);
    },
    [onSelect],
  );

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      {children}
      <Popover
        placement="bottom start"
        className="icon-picker-popover"
        style={popoverStyle}
      >
        <Dialog className="icon-picker-dialog" aria-label="Icons">
          <IconPickerContent value={value} onSelect={handleSelect} />
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
});

const IconPickerContent = memo(function IconPickerContent({
  value,
  onSelect,
}: {
  value?: string;
  onSelect: (iconName: string) => void;
}) {
  const { query, setQuery, filteredIcons } = useIconSearch();

  const items = useMemo(
    () => filteredIcons.map((name) => ({ id: name })),
    [filteredIcons],
  );

  // 단일 선택 toggle — 이미 고른 아이콘을 다시 누르면 빈 집합이 온다 (해제). 그때는
  // 현재 값을 다시 고른 것으로 보고 닫는다. (RAC 1.21 ListBox 는 목록 단위 onAction 이 없다)
  const handleSelectionChange = useCallback(
    (keys: Selection) => {
      if (keys === "all") return;
      const next = keys.values().next().value as Key | undefined;
      if (next != null) onSelect(String(next));
      else if (value) onSelect(value);
    },
    [onSelect, value],
  );

  return (
    <Autocomplete inputValue={query} onInputChange={setQuery}>
      <SearchField
        className="icon-picker-search"
        aria-label="Search icons"
        autoFocus
      >
        <Input
          placeholder="Search icons…"
          className="icon-picker-search-input"
        />
      </SearchField>
      <div className="icon-picker-count" aria-live="polite">
        {filteredIcons.length} icons
      </div>
      <Virtualizer layout={GridLayout} layoutOptions={GRID_LAYOUT_OPTIONS}>
        <ListBox
          className="icon-picker-grid"
          aria-label="Icons"
          layout="grid"
          items={items}
          selectionMode="single"
          selectedKeys={value ? [value] : []}
          onSelectionChange={handleSelectionChange}
          style={{ maxHeight: GRID_MAX_HEIGHT }}
        >
          {(item) => (
            <ListBoxItem
              id={item.id}
              textValue={item.id}
              className="icon-picker-item"
            >
              <IconPreview name={item.id} size={GRID_ICON_SIZE} />
            </ListBoxItem>
          )}
        </ListBox>
      </Virtualizer>
    </Autocomplete>
  );
});
