/**
 * 프리셋 썸네일 파생 (ADR-168 P-1).
 *
 * 수동 `previewAreas` 배열은 폐지됐다. 그 배열은 레이아웃 정의와 **두 번째 진실**이어서,
 * 트랙을 고쳐도 썸네일은 옛 모양을 계속 보여줬다 (실측: `dashboard-widgets` 는 tablet 에서
 * 위젯이 하단 전폭으로 내려가는데 썸네일은 3열 그대로였다). 여기서는 프리셋이 선언한
 * 컨테이너/슬롯 스타일만 읽어 breakpoint 별 사각형을 계산한다 — 정의를 고치면 썸네일이
 * 따라온다.
 *
 * 기준 크기는 `CANVAS_VIEWPORT` (캔버스가 실제로 그리는 프레임 크기) 다. `BREAKPOINTS` 의
 * `minWidth` 는 미디어 쿼리 경계라 여기 쓰면 안 된다 — desktop 은 1280 이 아니라 1920.
 *
 * 지원 범위는 프리셋이 실제로 쓰는 형태로 한정한다: grid(명시 트랙) / flex row / flex column.
 * `repeat()`·`minmax()` 는 프리셋에서 금지돼 있고(정적 테스트가 가드) 여기서도 파싱하지 않는다.
 */

import type { CSSProperties } from "react";

import type { BreakpointName } from "@composition/shared";

import { CANVAS_VIEWPORT } from "../../../../workspace/canvasBreakpoints";
import type {
  LayoutPreset,
  PreviewArea,
  ResponsiveStyleSet,
  SlotDefinition,
} from "./types";

/**
 * desktop-first cascade 적용 순서.
 *
 * mobile 은 mobile → tablet → base 순으로 값을 찾는다 (`getResponsiveValueWithCascade`).
 * 얕은 병합을 그 순서로 겹치면 키 단위 결과가 같다.
 */
const CASCADE_STEPS: Record<BreakpointName, readonly ("tablet" | "mobile")[]> =
  {
    desktop: [],
    tablet: ["tablet"],
    mobile: ["tablet", "mobile"],
  };

/** 격자 슬롯 안에 그리는 카드 셀 최대 개수. 열 수 변화를 읽히게만 하면 된다. */
const MAX_NESTED_CELLS = 8;

/** 격자 셀 사이 여백(슬롯 크기에 대한 %). */
const NESTED_CELL_GAP = 6;

interface Track {
  /** 확정 크기(px). `fr`/미해석 트랙은 0. */
  fixedPx: number;
  /** 잔여 배분 가중치. 확정 트랙은 0. */
  grow: number;
}

/** breakpoint 에서 유효한 스타일 — base 위에 cascade 순서로 override 를 겹친다. */
function effectiveStyle(
  base: CSSProperties | undefined,
  responsive: ResponsiveStyleSet | undefined,
  breakpoint: BreakpointName,
): CSSProperties {
  let merged: CSSProperties = { ...base };
  for (const step of CASCADE_STEPS[breakpoint]) {
    const override = responsive?.[step];
    if (override) merged = { ...merged, ...override };
  }
  return merged;
}

/** CSS 길이 → px. `%` 는 기준 크기에 대한 비율로 환산. 해석 불가면 null. */
function toPx(value: unknown, total: number): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed === "") return null;

  const numeric = Number.parseFloat(trimmed);
  if (!Number.isFinite(numeric)) return null;

  return trimmed.endsWith("%") ? (total * numeric) / 100 : numeric;
}

/**
 * 트랙 목록 파싱.
 *
 * `auto` 는 그 트랙을 차지하는 슬롯의 콘텐츠 크기(`contentPx`)로 확정하고, 콘텐츠를 모르면
 * 잔여를 나눠 갖게 한다 — 0 폭 사각형보다 낫다.
 */
function parseTracks(
  template: unknown,
  contentPx: readonly number[],
  total: number,
): Track[] {
  const tokens = String(template ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return tokens.map((token, index) => {
    if (token.endsWith("fr")) {
      const grow = Number.parseFloat(token);
      return { fixedPx: 0, grow: Number.isFinite(grow) ? grow : 1 };
    }

    if (
      token === "auto" ||
      token === "min-content" ||
      token === "max-content"
    ) {
      const content = contentPx[index] ?? 0;
      return content > 0
        ? { fixedPx: content, grow: 0 }
        : { fixedPx: 0, grow: 1 };
    }

    const px = toPx(token, total);
    return px != null ? { fixedPx: px, grow: 0 } : { fixedPx: 0, grow: 1 };
  });
}

/** 트랙 → px 크기. 확정 트랙은 리터럴, `fr` 은 잔여를 가중치대로 나눈다. */
function resolveTrackSizes(tracks: readonly Track[], total: number): number[] {
  const fixedTotal = tracks.reduce((sum, t) => sum + t.fixedPx, 0);
  const growTotal = tracks.reduce((sum, t) => sum + t.grow, 0);
  const remainder = Math.max(0, total - fixedTotal);

  return tracks.map((track) => {
    if (track.grow <= 0) return track.fixedPx;
    return growTotal > 0 ? (remainder * track.grow) / growTotal : 0;
  });
}

/** px 크기 목록 → 누적 % 경계. `edges[i]` = i 번째 트랙 시작 위치. */
function toPercentEdges(sizes: readonly number[], total: number): number[] {
  const scale = total > 0 ? 100 / total : 0;
  const edges: number[] = [0];
  for (const size of sizes) {
    edges.push(edges[edges.length - 1] + size * scale);
  }
  return edges;
}

/** 1-based grid line 문자열 → 0-based 트랙 인덱스. 해석 불가면 null. */
function toTrackIndex(line: unknown): number | null {
  const parsed = Number.parseInt(String(line ?? ""), 10);
  return Number.isFinite(parsed) ? parsed - 1 : null;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function areaOf(
  slot: SlotDefinition,
  x: number,
  y: number,
  width: number,
  height: number,
): PreviewArea {
  return {
    name: slot.name,
    x: clampPercent(x),
    y: clampPercent(y),
    // 하한을 두지 않는다 — 실제 레이아웃이 collapse 시키는 밴드를 썸네일에서만 부풀리면
    // 그게 곧 R4 가 말하는 발산이다. 0 크기가 나오면 프리셋 정의가 틀린 것이므로
    // `derivePreviewAreas.test.ts` 의 불변식(width/height > 0)이 잡는다.
    width: clampPercent(width),
    height: clampPercent(height),
    isSlot: true,
    required: slot.required,
  };
}

/**
 * 격자 슬롯 안의 카드 셀.
 *
 * `feed` 는 breakpoint 별로 **슬롯 자신의** 열 수를 바꾼다(4 → 2 → 1). 슬롯을 한 덩어리로만
 * 그리면 세 breakpoint 썸네일이 똑같아져서, 이 프리셋이 반응형으로 하는 일이 화면에 전혀
 * 드러나지 않는다. 그래서 격자 슬롯은 안쪽 셀까지 그린다.
 *
 * 셀은 `isSlot: false` — 슬롯이 아니므로 이름표도 붙지 않는다.
 */
function nestedGridCells(
  slot: SlotDefinition,
  style: CSSProperties,
  frame: PreviewArea,
): PreviewArea[] {
  if (style.display !== "grid" && style.display !== "inline-grid") return [];

  const columns = String(style.gridTemplateColumns ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  if (columns < 1) return [];

  const rows = Math.max(1, Math.min(2, Math.floor(MAX_NESTED_CELLS / columns)));
  const cellWidth = (frame.width - NESTED_CELL_GAP * (columns + 1)) / columns;
  const cellHeight = (frame.height - NESTED_CELL_GAP * (rows + 1)) / rows;
  if (cellWidth <= 0 || cellHeight <= 0) return [];

  const cells: PreviewArea[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      cells.push({
        name: `${slot.name}#${row * columns + column}`,
        x: frame.x + NESTED_CELL_GAP + column * (cellWidth + NESTED_CELL_GAP),
        y: frame.y + NESTED_CELL_GAP + row * (cellHeight + NESTED_CELL_GAP),
        width: cellWidth,
        height: cellHeight,
        isSlot: false,
      });
    }
  }
  return cells;
}

interface DeriveContext {
  slots: readonly SlotDefinition[];
  styles: readonly CSSProperties[];
  viewport: { width: number; height: number };
}

/** grid 컨테이너 — 트랙을 풀고 각 슬롯의 line 범위를 % 사각형으로 환산. */
function deriveGridAreas(
  container: CSSProperties,
  ctx: DeriveContext,
): PreviewArea[] {
  const { slots, styles, viewport } = ctx;

  // `auto` 트랙의 콘텐츠 크기는 그 트랙 하나만 차지하는 슬롯에서 가져온다.
  // 여러 트랙에 걸친 슬롯은 어느 트랙 몫인지 알 수 없어 제외한다.
  const columnContent: number[] = [];
  const rowContent: number[] = [];
  slots.forEach((_slot, index) => {
    const style = styles[index];
    const colStart = toTrackIndex(style.gridColumnStart);
    const colEnd = toTrackIndex(style.gridColumnEnd);
    if (colStart != null && colEnd === colStart + 1) {
      const width = toPx(style.width, viewport.width) ?? 0;
      columnContent[colStart] = Math.max(columnContent[colStart] ?? 0, width);
    }

    const rowStart = toTrackIndex(style.gridRowStart);
    const rowEnd = toTrackIndex(style.gridRowEnd);
    if (rowStart != null && rowEnd === rowStart + 1) {
      const height = toPx(style.minHeight, viewport.height) ?? 0;
      rowContent[rowStart] = Math.max(rowContent[rowStart] ?? 0, height);
    }
  });

  const columnTracks = parseTracks(
    container.gridTemplateColumns,
    columnContent,
    viewport.width,
  );
  const rowTracks = parseTracks(
    container.gridTemplateRows,
    rowContent,
    viewport.height,
  );

  const columnEdges = toPercentEdges(
    resolveTrackSizes(columnTracks, viewport.width),
    viewport.width,
  );
  const rowEdges = toPercentEdges(
    resolveTrackSizes(rowTracks, viewport.height),
    viewport.height,
  );

  const lastColumn = columnEdges.length - 1;
  const lastRow = rowEdges.length - 1;

  return slots.flatMap((slot, index) => {
    const style = styles[index];

    // 배치를 선언하지 않은 슬롯은 전체를 덮게 둔다 — 조용히 사라지느니 드러나야 한다.
    const colStart = toTrackIndex(style.gridColumnStart) ?? 0;
    const colEnd = toTrackIndex(style.gridColumnEnd) ?? lastColumn;
    const rowStart = toTrackIndex(style.gridRowStart) ?? 0;
    const rowEnd = toTrackIndex(style.gridRowEnd) ?? lastRow;

    const x = columnEdges[Math.min(colStart, lastColumn)] ?? 0;
    const right = columnEdges[Math.min(colEnd, lastColumn)] ?? 100;
    const y = rowEdges[Math.min(rowStart, lastRow)] ?? 0;
    const bottom = rowEdges[Math.min(rowEnd, lastRow)] ?? 100;

    const frame = areaOf(slot, x, y, right - x, bottom - y);
    return [frame, ...nestedGridCells(slot, style, frame)];
  });
}

/** flex 컨테이너 — 주축은 고정 크기 슬롯이 리터럴, `flex` 슬롯이 잔여를 나눈다. */
function deriveFlexAreas(isColumn: boolean, ctx: DeriveContext): PreviewArea[] {
  const { slots, styles, viewport } = ctx;
  const mainTotal = isColumn ? viewport.height : viewport.width;

  const tracks: Track[] = styles.map((style) => {
    const grow = Number.parseFloat(String(style.flex ?? ""));
    if (Number.isFinite(grow) && grow > 0) return { fixedPx: 0, grow };

    const main = isColumn
      ? (toPx(style.height, mainTotal) ?? toPx(style.minHeight, mainTotal))
      : toPx(style.width, mainTotal);
    return main != null && main > 0
      ? { fixedPx: main, grow: 0 }
      : { fixedPx: 0, grow: 1 };
  });

  const sizes = resolveTrackSizes(tracks, mainTotal).map((size, index) => {
    // `flex` 슬롯도 자기 최소 크기 아래로는 줄지 않는다 (automatic minimum size).
    const floor = isColumn
      ? (toPx(styles[index].minHeight, mainTotal) ?? 0)
      : 0;
    return Math.max(size, floor);
  });

  const edges = toPercentEdges(sizes, mainTotal);

  return slots.flatMap((slot, index) => {
    const start = edges[index] ?? 0;
    const end = edges[index + 1] ?? 100;
    const frame = isColumn
      ? areaOf(slot, 0, start, 100, end - start)
      : areaOf(slot, start, 0, end - start, 100);
    return [frame, ...nestedGridCells(slot, styles[index], frame)];
  });
}

/**
 * breakpoint 기준 썸네일 사각형 목록.
 *
 * 순수 함수 — 프리셋 정의만 읽는다. 같은 입력이면 같은 출력이라 Phase 5 의 실측 bounds 비율과
 * 직접 대조할 수 있다 (G3).
 */
export function derivePreviewAreas(
  preset: LayoutPreset,
  breakpoint: BreakpointName,
): PreviewArea[] {
  const container = effectiveStyle(
    preset.containerStyle,
    preset.responsiveContainerStyle,
    breakpoint,
  );

  const ctx: DeriveContext = {
    slots: preset.slots,
    styles: preset.slots.map((slot) =>
      effectiveStyle(slot.defaultStyle, slot.responsiveStyle, breakpoint),
    ),
    viewport: CANVAS_VIEWPORT[breakpoint],
  };

  if (container.display === "grid" || container.display === "inline-grid") {
    return deriveGridAreas(container, ctx);
  }

  return deriveFlexAreas(container.flexDirection === "column", ctx);
}
