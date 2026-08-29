/**
 * IconPickerPopover - 아이콘 검색/선택 팝오버
 *
 * Lucide 아이콘 그리드 + 검색
 * React Aria DialogTrigger + Popover 기반
 */

import { memo, useCallback, useRef, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Dialog, DialogTrigger, Popover, Input } from "react-aria-components";
import { IconPreview } from "./components/IconPreview";
import { useIconSearch } from "./hooks/useIconSearch";

const GRID_ICON_SIZE = 20;
const VISIBLE_ROWS = 8;
const CELL_SIZE = 32;

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
        <Dialog className="icon-picker-dialog">
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
  const searchRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const handleIconClick = useCallback(
    (name: string) => {
      onSelect(name);
    },
    [onSelect],
  );

  return (
    <>
      <div className="icon-picker-search">
        <Input
          ref={searchRef}
          placeholder="Search icons..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="icon-picker-search-input"
          aria-label="Search icons"
        />
      </div>
      <div className="icon-picker-count">{filteredIcons.length} icons</div>
      <div
        ref={gridRef}
        className="icon-picker-grid"
        role="listbox"
        aria-label="Icons"
        style={{
          maxHeight: VISIBLE_ROWS * CELL_SIZE,
        }}
      >
        {filteredIcons.map((name) => (
          <button
            key={name}
            role="option"
            aria-selected={name === value}
            className={`icon-picker-item${name === value ? " selected" : ""}`}
            title={name}
            onClick={() => handleIconClick(name)}
          >
            <IconPreview name={name} size={GRID_ICON_SIZE} />
          </button>
        ))}
      </div>
    </>
  );
});
