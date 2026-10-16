/**
 * GridSizePicker — Layout 절 Columns · Rows 옆의 격자 선택기 (Figma grid 의 「열 × 행」 고르기 —
 * 2026-10-16 사용자 「1,2,3 한번에 진행」).
 *
 * 칸 위를 지나가면 1 × 1 부터 그 칸까지가 칠해지고, 누르면 그 열 수 · 행 수가 된다 (늘린 열 · 행은
 * Fill, 크기를 정한 것은 그대로 — Columns · Rows 칸과 같은 규칙). 키보드는 화살표로 움직이고
 * Enter · Space 로 정한다 (칸 하나만 Tab 순서에 — roving tabindex).
 */

import { memo, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "react-aria-components/Button";
import { Dialog, DialogTrigger } from "react-aria-components/Dialog";
import { Popover } from "react-aria-components/Popover";
import { Grid3x3 } from "lucide-react";
import { SwatchIconButton } from "../../../components/ui";
import { iconProps } from "../../../../utils/ui/uiConstants";
import { useSemanticLabel } from "../../../../i18n";
import "./GridSizePicker.css";

/** The picker's extent — 10 × 10 (a larger grid is typed in Columns · Rows). */
const SIZE = 10;

type Cell = readonly [column: number, row: number];

const clamp = (value: number) => Math.min(SIZE, Math.max(1, value));

export const GridSizePicker = memo(function GridSizePicker({
  columns,
  rows,
  onPick,
}: {
  /** The current counts (0 = none — shown as 1). */
  columns: number;
  rows: number;
  onPick: (columns: number, rows: number) => void;
}) {
  const localize = useSemanticLabel();
  const current: Cell = [clamp(columns), clamp(rows)];
  const [active, setActive] = useState<Cell | null>(null);
  const cellsRef = useRef<HTMLDivElement>(null);
  const shown = active ?? current;
  const move = (event: KeyboardEvent, close: () => void) => {
    const [column, row] = shown;
    const next: Cell | null =
      event.key === "ArrowRight"
        ? [clamp(column + 1), row]
        : event.key === "ArrowLeft"
          ? [clamp(column - 1), row]
          : event.key === "ArrowDown"
            ? [column, clamp(row + 1)]
            : event.key === "ArrowUp"
              ? [column, clamp(row - 1)]
              : null;
    if (!next) {
      if (event.key === "Escape") close();
      return;
    }
    event.preventDefault();
    setActive(next);
    cellsRef.current
      ?.querySelector<HTMLElement>(
        `[data-column="${next[0]}"][data-row="${next[1]}"]`,
      )
      ?.focus();
  };
  return (
    <DialogTrigger onOpenChange={() => setActive(null)}>
      <SwatchIconButton aria-label={localize("Grid size")}>
        <Grid3x3
          color={iconProps.color}
          size={iconProps.size}
          strokeWidth={iconProps.strokeWidth}
        />
      </SwatchIconButton>
      <Popover
        className="react-aria-Popover grid-size-picker-popover"
        placement="bottom end"
      >
        <Dialog className="grid-size-picker" aria-label={localize("Grid size")}>
          {({ close }) => (
            <>
              <output className="grid-size-picker-readout" aria-live="polite">
                {shown[0]} × {shown[1]}
              </output>
              <div
                ref={cellsRef}
                className="grid-size-picker-cells"
                onMouseLeave={() => setActive(null)}
              >
                {Array.from({ length: SIZE * SIZE }, (_, index) => {
                  const column = (index % SIZE) + 1;
                  const row = Math.floor(index / SIZE) + 1;
                  const isFocusTarget = column === shown[0] && row === shown[1];
                  return (
                    <Button
                      key={index}
                      className="grid-size-picker-cell"
                      aria-label={`${column} × ${row}`}
                      data-column={column}
                      data-row={row}
                      data-active={
                        column <= shown[0] && row <= shown[1] ? true : undefined
                      }
                      excludeFromTabOrder={!isFocusTarget}
                      autoFocus={isFocusTarget && active === null}
                      onHoverStart={() => setActive([column, row])}
                      onFocus={() => setActive([column, row])}
                      onKeyDown={(event) => move(event, close)}
                      onPress={() => {
                        onPick(column, row);
                        close();
                      }}
                    />
                  );
                })}
              </div>
            </>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
});
