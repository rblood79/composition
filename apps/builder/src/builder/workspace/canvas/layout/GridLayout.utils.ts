import { useMemo, type ReactNode } from "react";
import type { CanvasLayoutNode } from "./layoutNode";
import type { CSSStyle } from "../sprites/styleConverter";

/**
 * CSS Grid 스타일 속성
 */
export interface GridStyle {
  display?: "grid" | "inline-grid" | "flex" | "block" | "none";
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  gridTemplateAreas?: string;
  gridAutoColumns?: string;
  gridAutoRows?: string;
  gridAutoFlow?: "row" | "column" | "dense" | "row dense" | "column dense";
  gap?: number | string;
  rowGap?: number | string;
  columnGap?: number | string;
  justifyItems?: "start" | "end" | "center" | "stretch";
  alignItems?: "start" | "end" | "center" | "stretch";
  justifyContent?:
    | "start"
    | "end"
    | "center"
    | "stretch"
    | "space-around"
    | "space-between"
    | "space-evenly";
  alignContent?:
    | "start"
    | "end"
    | "center"
    | "stretch"
    | "space-around"
    | "space-between"
    | "space-evenly";
  // Grid Item 속성
  gridColumn?: string;
  gridRow?: string;
  gridArea?: string;
  justifySelf?: "start" | "end" | "center" | "stretch";
  alignSelf?: "start" | "end" | "center" | "stretch";
}

/**
 * 파싱된 그리드 트랙 정보
 */
export interface GridTrack {
  size: number;
  unit: "px" | "fr" | "%" | "auto" | "minmax";
  originalValue: string;
  /** minmax용: 최소값 (px) */
  min?: number;
  /** minmax용: 최대값 (px). -1이면 1fr 동작 */
  max?: number;
}

/**
 * 계산된 셀 위치/크기
 */
export interface GridCellBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  column: number;
  row: number;
  columnSpan: number;
  rowSpan: number;
}

export interface GridLayoutProps {
  element: CanvasLayoutNode;
  containerWidth: number;
  containerHeight: number;
  isSelected?: boolean;
  children?: ReactNode;
}

/**
 * CanvasLayoutNode가 Grid 컨테이너인지 확인
 */
export function isGridContainer(element: CanvasLayoutNode): boolean {
  const style = element.props?.style as CSSStyle | undefined;
  const display = style?.display;
  return display === "grid" || display === "inline-grid";
}

/**
 * CanvasLayoutNode가 Flex 컨테이너인지 확인
 * 🚀 Phase 7: LayoutEngine.ts에서 이동
 */
export function isFlexContainer(element: CanvasLayoutNode): boolean {
  const style = element.props?.style as CSSStyle | undefined;
  return style?.display === "flex";
}

/**
 * 괄호 깊이를 추적하며 최상위 레벨 토큰을 분리
 *
 * 예: "repeat(3, 1fr) 100px minmax(200px, 1fr)"
 * → ["repeat(3, 1fr)", "100px", "minmax(200px, 1fr)"]
 */
function tokenizeTemplate(template: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let current = "";

  for (const ch of template) {
    if (ch === "(") {
      depth++;
      current += ch;
    } else if (ch === ")") {
      depth--;
      current += ch;
    } else if (ch === " " && depth === 0) {
      const trimmed = current.trim();
      if (trimmed) tokens.push(trimmed);
      current = "";
    } else {
      current += ch;
    }
  }

  const trimmed = current.trim();
  if (trimmed) tokens.push(trimmed);

  return tokens;
}

/**
 * 단일 트랙 값을 파싱 (px, fr, %, auto)
 *
 * minmax()를 제외한 단순 값 파싱용.
 * 반환값은 아직 fr 크기가 결정되지 않은 상태의 GridTrack.
 */
function parseSingleTrackValue(value: string): GridTrack {
  const v = value.trim();
  if (v.endsWith("fr")) {
    return { size: 0, unit: "fr", originalValue: v };
  }
  if (v.endsWith("px")) {
    return { size: parseFloat(v), unit: "px", originalValue: v };
  }
  if (v.endsWith("%")) {
    // % 크기는 resolveGridTracks에서 containerSize 기반으로 계산
    return { size: 0, unit: "%", originalValue: v };
  }
  if (v === "auto") {
    return { size: 0, unit: "auto", originalValue: v };
  }
  // 알 수 없는 값은 auto로 처리
  return { size: 0, unit: "auto", originalValue: v };
}

/**
 * minmax(min, max) 문자열을 파싱
 *
 * @returns GridTrack (unit: 'minmax')
 */
function parseMinmax(expr: string): GridTrack {
  // "minmax(200px, 1fr)" → 내부 인자 추출
  const inner = expr.slice(expr.indexOf("(") + 1, expr.lastIndexOf(")"));
  const parts = inner.split(",").map((s) => s.trim());
  const minStr = parts[0] ?? "0px";
  const maxStr = parts[1] ?? "1fr";

  let minVal = 0;
  if (minStr.endsWith("px")) {
    minVal = parseFloat(minStr) || 0;
  } else if (
    minStr === "auto" ||
    minStr === "min-content" ||
    minStr === "max-content"
  ) {
    minVal = 0; // 컨텐츠 기반 → 0으로 폴백
  }

  // max 값: fr이면 -1 sentinel, px면 실제 값
  let maxVal = -1; // 기본: 1fr
  if (maxStr.endsWith("fr")) {
    maxVal = -(parseFloat(maxStr) || 1); // fr 값을 음수로 저장 (예: 2fr → -2)
  } else if (maxStr.endsWith("px")) {
    maxVal = parseFloat(maxStr) || 0;
  } else if (maxStr === "auto" || maxStr === "max-content") {
    maxVal = -1; // 1fr로 동작
  }

  return {
    size: 0,
    unit: "minmax",
    originalValue: expr,
    min: minVal,
    max: maxVal,
  };
}

/**
 * repeat() 문자열을 파싱하여 트랙 배열로 전개
 *
 * - repeat(3, 1fr) → [1fr, 1fr, 1fr]
 * - repeat(2, 100px 1fr) → [100px, 1fr, 100px, 1fr]
 * - repeat(auto-fill, minmax(200px, 1fr)) → 컨테이너 크기 기반 동적 트랙 수
 * - repeat(auto-fit, ...) → auto-fill과 동일 (빈 트랙 축소는 resolve 단계에서 처리)
 */
function expandRepeat(
  expr: string,
  containerSize: number,
  gap: number,
): { tracks: GridTrack[]; isAutoFit: boolean } {
  // "repeat(3, 1fr 200px)" → 인자 추출
  const inner = expr.slice(expr.indexOf("(") + 1, expr.lastIndexOf(")"));

  // 첫 번째 콤마 위치 (count와 track-list 분리)
  let depth = 0;
  let firstComma = -1;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === "(") depth++;
    else if (inner[i] === ")") depth--;
    else if (inner[i] === "," && depth === 0) {
      firstComma = i;
      break;
    }
  }

  if (firstComma === -1) {
    return { tracks: [], isAutoFit: false };
  }

  const countStr = inner.slice(0, firstComma).trim();
  const trackListStr = inner.slice(firstComma + 1).trim();

  // 반복할 트랙 패턴 파싱
  const patternTokens = tokenizeTemplate(trackListStr);
  const patternTracks = patternTokens.map((token) => {
    if (token.startsWith("minmax(")) return parseMinmax(token);
    return parseSingleTrackValue(token);
  });

  let isAutoFit = false;

  // 반복 횟수 결정
  let repeatCount: number;
  if (countStr === "auto-fill" || countStr === "auto-fit") {
    isAutoFit = countStr === "auto-fit";
    // 패턴 당 최소 크기 합산
    let patternMinSize = 0;
    for (const track of patternTracks) {
      if (track.unit === "minmax") {
        patternMinSize += track.min ?? 0;
      } else if (track.unit === "px") {
        patternMinSize += track.size;
      } else {
        // fr, auto 등은 최소 크기 0으로 가정
        patternMinSize += 0;
      }
    }

    if (patternMinSize <= 0) {
      repeatCount = 1;
    } else {
      // 컨테이너에 들어갈 수 있는 최대 반복 횟수
      // gap도 고려: N * patternMinSize + (N * patternTracks.length - 1) * gap <= containerSize
      // 단순화: N * (patternMinSize + gap * patternTracks.length) <= containerSize + gap
      const effectiveGap = gap * patternTracks.length;
      repeatCount = Math.max(
        1,
        Math.floor((containerSize + gap) / (patternMinSize + effectiveGap)),
      );
    }
  } else {
    repeatCount = parseInt(countStr, 10) || 1;
  }

  // 트랙 전개
  const tracks: GridTrack[] = [];
  for (let i = 0; i < repeatCount; i++) {
    for (const track of patternTracks) {
      tracks.push({ ...track });
    }
  }

  return { tracks, isAutoFit };
}

/**
 * 파싱된 트랙 배열의 크기를 계산 (fr 분배, minmax 해결)
 *
 * @param tracks - 파싱된 트랙 배열 (size 미결정 상태)
 * @param containerSize - 컨테이너 크기
 * @param gap - 트랙 간 gap
 */
function resolveGridTracks(
  tracks: GridTrack[],
  containerSize: number,
  gap: number,
): void {
  if (tracks.length === 0) return;

  // 1단계: 고정 크기 합산 (% 해결 포함)
  let fixedSize = 0;
  let frTotal = 0;
  const totalGap = gap * (tracks.length - 1);

  for (const track of tracks) {
    switch (track.unit) {
      case "px":
        fixedSize += track.size;
        break;
      case "%": {
        const pxSize = (parseFloat(track.originalValue) / 100) * containerSize;
        track.size = pxSize;
        fixedSize += pxSize;
        break;
      }
      case "fr": {
        const frVal = parseFloat(track.originalValue) || 1;
        frTotal += frVal;
        break;
      }
      case "auto":
        frTotal += 1; // auto는 1fr로 동작
        break;
      case "minmax": {
        // 1단계에서는 min 크기만 확보
        fixedSize += track.min ?? 0;
        // max가 fr인 경우 fr 풀에 참여
        if (track.max !== undefined && track.max < 0) {
          frTotal += Math.abs(track.max);
        }
        break;
      }
    }
  }

  // 2단계: 남은 공간을 fr/auto/minmax(fr)에 분배
  const remainingSpace = Math.max(0, containerSize - fixedSize - totalGap);
  const frSize = frTotal > 0 ? remainingSpace / frTotal : 0;

  for (const track of tracks) {
    switch (track.unit) {
      case "fr": {
        const frVal = parseFloat(track.originalValue) || 1;
        track.size = frSize * frVal;
        break;
      }
      case "auto":
        track.size = frSize;
        break;
      case "minmax": {
        const minVal = track.min ?? 0;
        if (track.max !== undefined && track.max < 0) {
          // max가 fr: min 보장 + fr 분배
          const frVal = Math.abs(track.max);
          track.size = Math.max(minVal, minVal + frSize * frVal);
        } else if (track.max !== undefined) {
          // max가 px: min과 max 사이
          track.size = Math.min(track.max, Math.max(minVal, minVal + frSize));
        } else {
          track.size = minVal;
        }
        break;
      }
      // px, %는 이미 결정됨
    }
  }
}

/**
 * CSS Grid 트랙 값을 파싱
 *
 * repeat(), minmax(), auto-fill, auto-fit 지원.
 * 기존 단순 값(px, fr, %, auto)도 호환 유지.
 */
export function parseGridTemplate(
  template: string | undefined,
  containerSize: number,
  gap?: number,
): GridTrack[] {
  if (!template) return [];

  const effectiveGap = gap ?? 0;
  const tokens = tokenizeTemplate(template.trim());
  let tracks: GridTrack[] = [];
  let hasAutoFit = false;

  for (const token of tokens) {
    if (token.startsWith("repeat(")) {
      const { tracks: expanded, isAutoFit } = expandRepeat(
        token,
        containerSize,
        effectiveGap,
      );
      tracks = tracks.concat(expanded);
      if (isAutoFit) hasAutoFit = true;
    } else if (token.startsWith("minmax(")) {
      tracks.push(parseMinmax(token));
    } else {
      tracks.push(parseSingleTrackValue(token));
    }
  }

  // 트랙 크기 계산
  resolveGridTracks(tracks, containerSize, effectiveGap);

  // auto-fit: 빈 트랙 축소 (크기 0으로)
  // 실제 CSS는 아이템 수에 따라 빈 트랙을 축소하지만,
  // 여기서는 트랙을 유지하되 GridEngine에서 아이템 배치 시 처리
  if (hasAutoFit) {
    // auto-fit은 parseGridTemplate 단계에서는 auto-fill과 동일하게 동작
    // 실제 빈 트랙 축소는 calculateGridCellBounds에서 아이템 수 기반으로 처리 가능
    // 현재는 트랙을 그대로 유지
  }

  return tracks;
}

/**
 * Gap 값을 숫자로 파싱
 */
export function parseGap(value: number | string | undefined): number {
  if (value === undefined) return 0;
  if (typeof value === "number") return value;
  if (value.endsWith("px")) return parseFloat(value);
  return parseFloat(value) || 0;
}

/**
 * grid-area 문자열을 파싱
 */
export function parseGridArea(area: string | undefined): {
  name?: string;
  rowStart?: number;
  colStart?: number;
  rowEnd?: number;
  colEnd?: number;
} {
  if (!area) return {};

  if (area.includes("/")) {
    const parts = area.split("/").map((p) => p.trim());
    return {
      rowStart: parseInt(parts[0], 10) || 1,
      colStart: parseInt(parts[1], 10) || 1,
      rowEnd: parseInt(parts[2], 10) || undefined,
      colEnd: parseInt(parts[3], 10) || undefined,
    };
  }

  return { name: area };
}

/**
 * Grid 템플릿 영역을 파싱하여 영역 맵 생성
 */
export function parseGridTemplateAreas(
  template: string | undefined,
): Map<
  string,
  { rowStart: number; rowEnd: number; colStart: number; colEnd: number }
> {
  const areas = new Map<
    string,
    { rowStart: number; rowEnd: number; colStart: number; colEnd: number }
  >();
  if (!template) return areas;

  const rows = template.match(/"[^"]+"/g);
  if (!rows) return areas;

  rows.forEach((row, rowIndex) => {
    const cells = row.replace(/"/g, "").trim().split(/\s+/);
    cells.forEach((cellName, colIndex) => {
      if (cellName === ".") return;

      const existing = areas.get(cellName);
      if (existing) {
        existing.rowEnd = Math.max(existing.rowEnd, rowIndex + 2);
        existing.colEnd = Math.max(existing.colEnd, colIndex + 2);
      } else {
        areas.set(cellName, {
          rowStart: rowIndex + 1,
          rowEnd: rowIndex + 2,
          colStart: colIndex + 1,
          colEnd: colIndex + 2,
        });
      }
    });
  });

  return areas;
}

/**
 * gridColumn/gridRow 값에서 start/end 파싱 (span 키워드 지원)
 *
 * 지원 형식:
 * - "2"          → { start: 2, end: 3 }
 * - "1 / 4"      → { start: 1, end: 4 }
 * - "span 2"     → { start: -1 (auto), span: 2 }
 * - "1 / span 3" → { start: 1, span: 3 }
 * - "span 2 / 5" → { span: 2, end: 5 } → start = 5 - 2 = 3
 *
 * @param value - gridColumn 또는 gridRow 값
 * @param autoStart - auto 배치 시 사용할 시작 위치
 * @returns { start, end } (1-based grid line 번호)
 */
export function parseGridLine(
  value: string,
  autoStart: number,
): { start: number; end: number } {
  if (value.includes("/")) {
    const [startPart, endPart] = value.split("/").map((s) => s.trim());

    const startIsSpan = startPart.startsWith("span");
    const endIsSpan = endPart.startsWith("span");

    if (startIsSpan && !endIsSpan) {
      // "span 2 / 5" → end = 5, start = 5 - 2
      const spanVal = parseInt(startPart.replace("span", "").trim(), 10) || 1;
      const end = parseInt(endPart, 10) || autoStart + spanVal;
      return { start: end - spanVal, end };
    }

    if (!startIsSpan && endIsSpan) {
      // "1 / span 3" → start = 1, end = 1 + 3
      const start = parseInt(startPart, 10) || autoStart;
      const spanVal = parseInt(endPart.replace("span", "").trim(), 10) || 1;
      return { start, end: start + spanVal };
    }

    // "1 / 4" → start = 1, end = 4
    const start = parseInt(startPart, 10) || autoStart;
    const end = parseInt(endPart, 10) || start + 1;
    return { start, end };
  }

  // 슬래시 없는 경우
  if (value.startsWith("span")) {
    // "span 2" → auto 위치에서 2칸 span
    const spanVal = parseInt(value.replace("span", "").trim(), 10) || 1;
    return { start: autoStart, end: autoStart + spanVal };
  }

  // 단순 숫자: "2" → start = 2, end = 3
  const start = parseInt(value, 10) || autoStart;
  return { start, end: start + 1 };
}

/**
 * 자식 요소의 그리드 셀 위치/크기 계산
 */
export function calculateGridCellBounds(
  childStyle: CSSStyle | GridStyle | undefined,
  columnTracks: GridTrack[],
  rowTracks: GridTrack[],
  columnGap: number,
  rowGap: number,
  templateAreas: Map<
    string,
    { rowStart: number; rowEnd: number; colStart: number; colEnd: number }
  >,
  childIndex: number,
): GridCellBounds {
  const gridStyle = childStyle as GridStyle | undefined;
  const cols = columnTracks.length || 1;

  let colStart = 1;
  let colEnd = 2;
  let rowStart = 1;
  let rowEnd = 2;

  if (gridStyle?.gridArea) {
    const area = parseGridArea(gridStyle.gridArea);
    if (area.name) {
      const namedArea = templateAreas.get(area.name);
      if (namedArea) {
        colStart = namedArea.colStart;
        colEnd = namedArea.colEnd;
        rowStart = namedArea.rowStart;
        rowEnd = namedArea.rowEnd;
      }
    } else {
      if (area.colStart) colStart = area.colStart;
      if (area.colEnd) colEnd = area.colEnd;
      if (area.rowStart) rowStart = area.rowStart;
      if (area.rowEnd) rowEnd = area.rowEnd;
    }
  } else if (gridStyle?.gridColumn || gridStyle?.gridRow) {
    // auto 배치 위치 계산
    const autoCol = (childIndex % cols) + 1;
    const autoRow = Math.floor(childIndex / cols) + 1;

    if (gridStyle.gridColumn) {
      const parsed = parseGridLine(gridStyle.gridColumn, autoCol);
      colStart = parsed.start;
      colEnd = parsed.end;
    } else {
      colStart = autoCol;
      colEnd = colStart + 1;
    }

    if (gridStyle.gridRow) {
      const parsed = parseGridLine(gridStyle.gridRow, autoRow);
      rowStart = parsed.start;
      rowEnd = parsed.end;
    } else {
      rowStart = autoRow;
      rowEnd = rowStart + 1;
    }
  } else {
    colStart = (childIndex % cols) + 1;
    colEnd = colStart + 1;
    rowStart = Math.floor(childIndex / cols) + 1;
    rowEnd = rowStart + 1;
  }

  let x = 0;
  for (let i = 0; i < colStart - 1; i++) {
    x += columnTracks[i]?.size || 0;
    if (i < colStart - 2) x += columnGap;
  }

  let y = 0;
  for (let i = 0; i < rowStart - 1; i++) {
    y += rowTracks[i]?.size || 0;
    if (i < rowStart - 2) y += rowGap;
  }

  let width = 0;
  for (let i = colStart - 1; i < colEnd - 1; i++) {
    width += columnTracks[i]?.size || 0;
    if (i < colEnd - 2) width += columnGap;
  }

  let height = 0;
  for (let i = rowStart - 1; i < rowEnd - 1; i++) {
    height += rowTracks[i]?.size || 0;
    if (i < rowEnd - 2) height += rowGap;
  }

  if (width === 0) width = columnTracks[0]?.size || 100;
  if (height === 0) height = rowTracks[0]?.size || 100;

  return {
    x,
    y,
    width,
    height,
    column: colStart,
    row: rowStart,
    columnSpan: colEnd - colStart,
    rowSpan: rowEnd - rowStart,
  };
}

/**
 * Grid 레이아웃 계산 훅
 */
export function useGridLayout(
  element: CanvasLayoutNode,
  containerWidth: number,
  containerHeight: number,
) {
  const style = element.props?.style as CSSStyle | GridStyle | undefined;

  return useMemo(() => {
    const gridStyle = style as GridStyle | undefined;

    // Gap 파싱 (트랙 파싱보다 먼저 — repeat(auto-fill)에 gap 필요)
    const gap = parseGap(gridStyle?.gap);
    const columnGap = parseGap(gridStyle?.columnGap) ?? gap;
    const rowGap = parseGap(gridStyle?.rowGap) ?? gap;

    const columnTracks = parseGridTemplate(
      gridStyle?.gridTemplateColumns,
      containerWidth,
      columnGap,
    );
    const rowTracks = parseGridTemplate(
      gridStyle?.gridTemplateRows,
      containerHeight,
      rowGap,
    );

    const templateAreas = parseGridTemplateAreas(gridStyle?.gridTemplateAreas);

    return {
      columnTracks,
      rowTracks,
      columnGap,
      rowGap,
      templateAreas,
    };
  }, [style, containerWidth, containerHeight]);
}
