/**
 * collection items 단일 계약 (ADR-912 영역 B 연장) — DOM wrapper / Skia projector 공통 source.
 *
 * **배경**: collection items 의 source(static props.items / dataBinding / collections / fallback)가
 * DOM(wrapper 별 `useCollectionData` + ad-hoc 정적 items 분기)과 Skia(`getFlatProjectionRows`)에서
 * 분산 처리되어, 같은 데이터가 두 경로에서 다르게 흐른다(TagGroup `9e84c2707` items 누락 버그의 근원).
 *
 * **본 모듈**: 기존 builder `collectionRowProjectionModel.ts`(import 0 순수 함수)를 `packages/shared`
 * 로 hoist 하여, DOM wrapper(shared)와 Skia projector(builder)가 **동일 row normalizer** 를 소비한다.
 * builder 의 기존 2 경로(`components/collection/` + `components/listbox/`)는 본 모듈을 재export 하는
 * thin alias 로 유지(BC 0, ADR-912 C1 hoist 선례).
 *
 * **계약 분리 (설계 §2-D)**:
 * - `resolveCollectionItems(input)` — **동기 순수 함수**. raw source → `CollectionProjectionRow[]` 정규화
 *   + `sourceKind` 판정. Skia projector 는 canonical props + collections snapshot 을 넘겨 직접 호출.
 * - DOM wrapper 는 직접 호출 금지(shared/service 경계). `useResolvedCollectionItems` hook adapter
 *   (별도 파일, Task 2-A)가 `useCollectionData` 로 async/dataTable 을 해소한 뒤 본 함수로 통과.
 *
 * **RAC 정합**: RAC 가 "collection data source" ↔ "item render adapter" 를 분리하듯, 본 계약은
 * source 통합만 담당하고 render adapt(JSX children / items+render fn / `<Collection>`)는 wrapper.
 *
 * **family 무관 = generic**: readDataBindingRows(collections/dataBinding 3경로) +
 *   readStringField(고정 필드 휴리스틱) + getItem*(Key/Label/Description/Icon/Value/Disabled).
 * **family 차이 = getRows 구현**: ListBox=flat row / GridList=section flatten(kind 분기) /
 *   Table=cell 차원(2D 직교). 차이는 caller 의 getRows 가 흡수, 본 모듈은 공통 primitive 만.
 */

export const COLLECTION_ROW_PROJECTION_WINDOW_LIMIT = 100;

/**
 * ADR-157: 빌더 표시 정책 — A2 가상화 window 미적용(auto-height/unbounded) data-bound 소유자의
 * 캔버스 샘플 투영 상한. 실데이터 앞부분 N행만 scene 에 투영하고 나머지는 계산된 높이의 hatch
 * placeholder + "+N more" 라벨로 표시한다 (Pencil 동형 표시 범위 — 정의 단계 hatch + 사용 단계
 * 샘플 행의 합성). A2 window 소유자(bounded height + scroll)는 종전대로 scrollOffset window 를 쓴다.
 * N=10 근거: Pencil heroui 샘플 7행 + A2 overscan 6 관행 범위 (사용자 설정화는 후속).
 */
export const COLLECTION_ROW_PROJECTION_SAMPLE_LIMIT = 10;

/**
 * ADR-150 A2: 가상화 window 의 viewport 상/하 여유 행 수(overscan).
 * 스크롤 시 window 경계 바로 밖 행을 미리 투영해 빈 영역 노출을 방지한다.
 */
export const DEFAULT_COLLECTION_OVERSCAN = 6;

/**
 * ADR-150 A2: scrollOffset 기반 투영 window — 절대 index `[startIndex, endIndex)`.
 * draw tree 와 hit tree 가 **동일 window** 를 공유하는 단일 소스(R2).
 */
export interface CollectionWindow {
  /** inclusive, >= 0 */
  startIndex: number;
  /** exclusive, <= totalRows */
  endIndex: number;
}

export interface CollectionWindowInput {
  /** window 전 원본 행 전체 수. */
  totalRows: number;
  /** 컨테이너 수직 스크롤 위치(px). */
  scrollTop: number;
  /** 컨테이너 가시 높이(px). */
  viewportHeight: number;
  /** 측정된 template 행 높이(px). `<=0` 이면 측정 실패로 간주 → legacy cap fallback. */
  rowHeight: number;
  /** viewport 상/하 여유 행 수 (기본 `DEFAULT_COLLECTION_OVERSCAN`). */
  overscan?: number;
}

/**
 * ADR-150 A2 (ListBox 선행 proof): scrollOffset + 측정 row height 로 투영 window 산출.
 *
 * window 는 정수 row 경계로 quantize 되므로 overscan slack 안의 스크롤은 window 를 바꾸지
 * 않는다 — scene rebuild 를 row 경계 이동 시점으로만 국한한다(pointer/scroll hot path 무회귀).
 * draw/hit 두 경로가 각자 계산하면 클릭 오배정/유령 row 가 생기므로 본 함수가 단일 소스(R2).
 *
 * `rowHeight<=0`(측정 실패) → legacy 정적 cap `[0, min(total, LIMIT))` 로 격하(R5) —
 * 측정 실패가 대용량 전량 투영으로 폭발하지 않게 한다.
 */
export function resolveCollectionWindow(
  input: CollectionWindowInput,
): CollectionWindow {
  const { totalRows, scrollTop, viewportHeight, rowHeight } = input;
  if (totalRows <= 0) return { startIndex: 0, endIndex: 0 };
  if (rowHeight <= 0) {
    return {
      startIndex: 0,
      endIndex: Math.min(totalRows, COLLECTION_ROW_PROJECTION_WINDOW_LIMIT),
    };
  }
  const overscan = input.overscan ?? DEFAULT_COLLECTION_OVERSCAN;
  const firstVisible = Math.max(0, Math.floor(scrollTop / rowHeight));
  const visibleCount = Math.max(0, Math.ceil(viewportHeight / rowHeight));
  const startIndex = Math.max(0, firstVisible - overscan);
  const endIndex = Math.min(totalRows, firstVisible + visibleCount + overscan);
  return { startIndex, endIndex };
}

/**
 * `number | CollectionWindow` → clamp 된 `[start, end)` 슬라이스 경계.
 * number(legacy cap) 은 `[0, min(limit, total))`, window 는 절대 index 를 total 로 클램프.
 */
function resolveSliceBounds(
  window: number | CollectionWindow,
  total: number,
): { start: number; end: number } {
  if (typeof window === "number") {
    return { start: 0, end: Math.min(Math.max(0, window), total) };
  }
  const start = Math.max(0, Math.min(window.startIndex, total));
  const end = Math.max(start, Math.min(window.endIndex, total));
  return { start, end };
}

/**
 * collections/dataBinding/props.items → window 전 원본 행 배열(정규화 전).
 * `getFlatProjectionRows` / `resolveCollectionItems` 가 source 선택 + totalRows 산출에 공유.
 */
function readSourceRows(
  input: Record<string, unknown> | CollectionProjectionRowsInput | undefined,
): unknown[] {
  const props = isProjectionRowsInput(input) ? input.props : input;
  const dataBindingRows = isProjectionRowsInput(input)
    ? readDataBindingRows(input.dataBinding, input.collections)
    : [];
  if (dataBindingRows.length > 0) return dataBindingRows;
  return Array.isArray(props?.items) ? props.items : [];
}

/**
 * collection data source (collections store entry). dataTable/static/collection 바인딩의
 * row 데이터 출처. ListBox/GridList/Table 공통.
 */
export type CollectionDataSource = {
  id?: string;
  mockData?: Record<string, unknown>[];
  name?: string;
  runtimeData?: Record<string, unknown>[];
  useMockData?: boolean;
};

/**
 * collection projected row (ListBoxProjectionRow 일반화).
 *
 * `kind` discriminator: `item`=데이터 행/카드 / `section`=GridList section header(props.items mode 한정).
 * `header`=section 제목(kind:'section' 일 때). 나머지 필드는 item 의 fixed-field 추출값.
 */
export type CollectionProjectionRow = {
  /** ADR-912 C1: GridList section flatten 용. ListBox 는 항상 'item'. */
  kind: "item" | "section";
  /** section header 텍스트 (kind:'section' 일 때만). */
  header?: string;
  description: string | null;
  /** ADR-147: icon slot — lucide icon name (data row field) 또는 null. */
  icon: string | null;
  isDisabled: boolean;
  item: unknown;
  itemKey: string;
  label: string;
  rowIndex: number;
  value: string | null;
};

export type CollectionProjectionRowsInput = {
  collections?: readonly CollectionDataSource[];
  dataBinding?: unknown;
  props?: Record<string, unknown>;
};

/**
 * collection source 의 정규화 결과 — DOM wrapper / Skia projector 공통 소비 (설계 §2-C).
 *
 * `sourceKind` 는 render adapter 가 분기 없이 동일 처리하되, 디버깅/write 라우팅 보조용.
 * write target 변환은 본 계약에 포함하지 않고 `resolveCollectionWriteTarget(projection, intent)`
 * 단일 책임에 위임한다(중복 source of truth 방지).
 */
export interface ResolvedCollectionItems {
  /** 정규화된 item 행 (kind:'item'|'section'). window 적용 시 window 슬라이스만. */
  rows: CollectionProjectionRow[];
  /** source 판정 — 어느 경로에서 rows 가 나왔는지. */
  sourceKind:
    | "static-items"
    | "dataBinding"
    | "collection"
    | "fallback"
    | "empty";
  /** ADR-150 A2: window 적용 전 원본 행 전체 수 (총 content height / scrollbar 산출용). */
  totalRows: number;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function isProjectionRowsInput(
  value: Record<string, unknown> | CollectionProjectionRowsInput | undefined,
): value is CollectionProjectionRowsInput {
  if (!isRecord(value)) return false;
  return "props" in value || "dataBinding" in value || "collections" in value;
}

/**
 * dataBinding → row 배열. dataTable/static/collection 3경로 (ListBox/GridList/Table 공통).
 * collections store 에서 mockData/runtimeData 선택.
 */
export function readDataBindingRows(
  dataBinding: unknown,
  collections: readonly CollectionDataSource[] = [],
): unknown[] {
  if (!isRecord(dataBinding)) return [];

  if (
    dataBinding.source === "dataTable" &&
    typeof dataBinding.name === "string"
  ) {
    const table = collections.find(
      (collection) =>
        collection.name === dataBinding.name ||
        collection.id === dataBinding.name,
    );
    if (!table) return [];
    if (table.useMockData === true) return readArray(table.mockData);
    const runtimeData = readArray(table.runtimeData);
    return runtimeData.length > 0 ? runtimeData : readArray(table.mockData);
  }

  if (dataBinding.type === "collection") {
    const config = isRecord(dataBinding.config) ? dataBinding.config : {};
    if (dataBinding.source === "static") {
      const data = readArray(config.data);
      return data.length > 0 ? data : readArray(config.items);
    }
    const runtimeData = readArray(config.runtimeData);
    if (runtimeData.length > 0) return runtimeData;
  }

  return [];
}

/** 고정 필드 우선순위로 string 값 추출 (number 는 String 변환). */
export function readStringField(
  item: Record<string, unknown>,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.length > 0) return value;
    if (typeof value === "number") return String(value);
  }
  return null;
}

export function getItemKey(item: unknown, index: number): string {
  if (isRecord(item)) {
    return readStringField(item, ["id", "key", "value"]) ?? `row-${index + 1}`;
  }
  return `row-${index + 1}`;
}

export function getItemLabel(
  item: unknown,
  itemKey: string,
  index: number,
): string {
  if (isRecord(item)) {
    return (
      readStringField(item, [
        "label",
        "textValue",
        "children",
        "name",
        "title",
        "value",
      ]) ?? itemKey
    );
  }
  if (typeof item === "string" && item.length > 0) return item;
  return itemKey || `Row ${index + 1}`;
}

export function getItemDescription(item: unknown): string | null {
  if (!isRecord(item)) return null;
  return readStringField(item, ["description", "subtitle", "detail"]);
}

/**
 * ADR-147: icon slot 값 — data row field 에서 lucide icon name 추출.
 * label/description 와 동일한 fixed-field 휴리스틱.
 */
export function getItemIcon(item: unknown): string | null {
  if (!isRecord(item)) return null;
  return readStringField(item, ["icon", "iconName", "avatar", "image"]);
}

export function getItemValue(item: unknown): string | null {
  if (!isRecord(item)) return null;
  return readStringField(item, ["value", "id", "key"]);
}

export function getItemDisabled(item: unknown): boolean {
  if (!isRecord(item)) return false;
  return item.isDisabled === true || item.disabled === true;
}

/**
 * data row 1개 → CollectionProjectionRow(kind:'item'). ListBox/GridList item 공통 변환.
 * section 분기는 caller(getGridListProjectionRows)가 kind:'section' 으로 별도 emit.
 */
export function toItemProjectionRow(
  item: unknown,
  rowIndex: number,
): CollectionProjectionRow {
  const itemKey = getItemKey(item, rowIndex);
  return {
    kind: "item",
    description: getItemDescription(item),
    icon: getItemIcon(item),
    isDisabled: getItemDisabled(item),
    item,
    itemKey,
    label: getItemLabel(item, itemKey, rowIndex),
    rowIndex,
    value: getItemValue(item),
  };
}

/**
 * collections/dataBinding/props.items → flat item row 배열 (kind:'item' 만, section 없음).
 * ListBox getRows 정본. GridList 는 본 함수 대신 getGridListProjectionRows(section 분기) 사용.
 *
 * `window`: `number`(legacy 정적 cap — `[0, limit)`) 또는 `CollectionWindow`(ADR-150 A2
 * scrollOffset 기반 절대 index `[startIndex, endIndex)`). window 슬라이스여도 각 행의
 * `rowIndex` 는 **절대 index**(post-slice 0 이 아님)로 보존 — selection·위치 offset 정합.
 */
export function getFlatProjectionRows(
  input: Record<string, unknown> | CollectionProjectionRowsInput | undefined,
  window: number | CollectionWindow = COLLECTION_ROW_PROJECTION_WINDOW_LIMIT,
): CollectionProjectionRow[] {
  const sourceRows = readSourceRows(input);
  const { start, end } = resolveSliceBounds(window, sourceRows.length);
  return sourceRows
    .slice(start, end)
    .map((item, i) => toItemProjectionRow(item, start + i));
}

/**
 * 단일 계약 진입점 (설계 §2-C) — flat rows + sourceKind 판정.
 *
 * `getFlatProjectionRows` 가 rows 를 산출하고, 본 함수는 어느 source 에서 나왔는지를 추가 판정한다.
 * 판정 우선순위는 `getFlatProjectionRows` 의 source 선택과 동일(dataBinding 우선 → props.items).
 * `dataBinding` 의 dataTable/collection 세부 구분은 `sourceKind` 로 노출(write 라우팅 보조).
 *
 * **순수 함수**: DOM wrapper 직접 호출 금지(§2-D). Skia projector + `useResolvedCollectionItems`
 * hook adapter 만 호출한다.
 */
export function resolveCollectionItems(
  input: Record<string, unknown> | CollectionProjectionRowsInput | undefined,
  window: number | CollectionWindow = COLLECTION_ROW_PROJECTION_WINDOW_LIMIT,
): ResolvedCollectionItems {
  const props = isProjectionRowsInput(input) ? input.props : input;
  const dataBindingRows = isProjectionRowsInput(input)
    ? readDataBindingRows(input.dataBinding, input.collections)
    : [];

  let sourceKind: ResolvedCollectionItems["sourceKind"];
  if (dataBindingRows.length > 0) {
    // dataTable/static/collection 세부 — readDataBindingRows 와 동일 판정 로직.
    const dataBinding = isProjectionRowsInput(input) ? input.dataBinding : null;
    sourceKind =
      isRecord(dataBinding) && dataBinding.source === "dataTable"
        ? "collection"
        : "dataBinding";
  } else if (Array.isArray(props?.items) && props.items.length > 0) {
    sourceKind = "static-items";
  } else {
    sourceKind = "empty";
  }

  // totalRows 는 window 전 원본 전체 수 (readSourceRows 와 동일 source 선택).
  const totalRows = readSourceRows(input).length;

  return {
    rows: getFlatProjectionRows(input, window),
    sourceKind,
    totalRows,
  };
}

/**
 * ADR-157: 샘플 투영 밖 나머지 행 메타 — hatch placeholder 높이 산출용.
 *
 * `hiddenRows` = `totalRows − projectedRows` (음수 클램프), `hiddenHeight` = `hiddenRows × rowHeight`.
 * `rowHeight` 는 **caller 주입** — shared 층은 template style 측정 행 높이를 모른다(Layer D resolver
 * `resolveListBoxItemRowHeightFromStyle` 는 builder/specs 소재). scene projector 와 layout
 * `calculateContentHeight` 가 동일 rowHeight resolver 산출값을 주입해야 hatch 높이 ↔ 컨테이너 높이가
 * 정합한다(ADR-907 Layer D 계약, R2). `hiddenRows ≤ 0`(전량 투영 / 비-데이터 collection) → `null`.
 */
export interface CollectionRemainder {
  /** 샘플 window 밖 숨은 행 수 (>0). */
  hiddenRows: number;
  /** 숨은 행 영역의 픽셀 높이 = `hiddenRows × rowHeight` (>=0). */
  hiddenHeight: number;
}

export function resolveCollectionRemainder(
  totalRows: number,
  projectedRows: number,
  rowHeight: number,
): CollectionRemainder | null {
  const hiddenRows = Math.max(0, totalRows - Math.max(0, projectedRows));
  if (hiddenRows <= 0) return null;
  return { hiddenRows, hiddenHeight: hiddenRows * Math.max(0, rowHeight) };
}

// ── 2D collection (Table) — ADR-912 단계 4 C1 ──────────────────────────────
//
// Table 은 flat row(label/description) 가 아니라 columns × rows 2D grid 다. flat 모델과
// **직교**(같은 readDataBindingRows source 를 공유하되 cell 차원만 추가) → BC 0.
// 차이는 본 getTableProjectionRows 가 흡수, 공통 primitive(readDataBindingRows)는 재사용.

/** Table column 정의 (Table.spec TableColumn 동형 — id/label/width). */
export type TableColumnDef = {
  id: string;
  label: string;
  width: number;
};

/**
 * Table projected row(2D). flat row 와 달리 `cells`(columnId→string 값) + `isHeader` 차원을 가진다.
 *
 * `kind:'header'`=컬럼 헤더 행(데이터 무관, label 사용) / `kind:'data'`=데이터 행(cells 사용).
 * `rowIndex` 는 data 행 인덱스(header 는 -1) — striped(짝수/홀수) + selected 시각의 SSOT.
 */
export type TableProjectionRow = {
  kind: "header" | "data";
  /** columnId → 셀 텍스트. header 행은 빈 객체(컬럼 label 은 column.label 에서). */
  cells: Record<string, string>;
  isSelected: boolean;
  rowIndex: number;
  rowKey: string;
};

// NOTE (2026-06-22): TABLE_DEFAULT_COLUMNS / TABLE_DEFAULT_ROWS (Name/Email/Role +
// John/Jane/Bob 3행) 샘플 fallback 은 제거됨. reference 컴포넌트
// (packages/react-aria-starter/src/Table.tsx)는 columns/items 가 비면 빈 테이블을
// 그대로 그릴 뿐 샘플을 주입하지 않는다 (renderEmptyState 도 Table 엔 미사용).
// CSS preview Table (Table.tsx) 도 빈 데이터 시 빈 테이블을 그리므로, Skia 만 샘플
// 3행을 그리는 것은 reference 위반 + CSS↔Skia 시각 비대칭이었다. fallback 을 빈 배열로
// 두면 resolveDataBoundTableProjection (canvasSceneNode.ts:868) 의 "data 행 0개 →
// null → standalone render.shapes 유지" gating 이 부활하여 양 경로가 빈 테이블로 정합된다.

/** props.columns(TableColumn[]) → TableColumnDef[]. 없으면 빈 배열 (reference 정합 — 샘플 미주입). */
export function readTableColumns(
  props: Record<string, unknown> | undefined,
): TableColumnDef[] {
  const raw = props?.columns;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((col, index) => {
      const record = isRecord(col) ? col : {};
      const id =
        typeof record.id === "string" && record.id.length > 0
          ? record.id
          : `col-${index + 1}`;
      const label =
        typeof record.label === "string" && record.label.length > 0
          ? record.label
          : id;
      const width =
        typeof record.width === "number" && record.width > 0
          ? record.width
          : 100;
      return { id, label, width };
    });
  }
  return [];
}

/**
 * 데이터 행 1개에서 컬럼별 셀 값 추출. row.cells(Table.spec 구조) 우선, 없으면 row 자체를
 * flat record 로 취급(dataBinding/collections 의 평탄 row 와 호환).
 */
function readRowCells(
  item: unknown,
  columns: readonly TableColumnDef[],
): Record<string, string> {
  const record = isRecord(item) ? item : {};
  const cellsSource = isRecord(record.cells) ? record.cells : record;
  const cells: Record<string, string> = {};
  for (const col of columns) {
    const value = cellsSource[col.id];
    cells[col.id] =
      value == null ? "" : typeof value === "string" ? value : String(value);
  }
  return cells;
}

/**
 * collections/dataBinding/props.rows → TableProjectionRow[](header 1행 + data N행) + totalDataRows.
 *
 * data source: readDataBindingRows(flat 와 동일) → cells 차원 부착. props.columns 가 컬럼 차원.
 * `window`: `number`(legacy 정적 cap `[0, limit)`) 또는 `CollectionWindow`(ADR-150 A2 scrollOffset
 * 기반 절대 index `[startIndex, endIndex)`). **header 행은 항상 1개 포함**(window 무관) 하고 window
 * 은 data 행에만 적용된다. 슬라이스여도 각 data 행의 `rowIndex` 는 절대 index(post-slice 0 아님)로
 * 보존 — striped(짝/홀) + selected 시각 + spacer 절대 위치 정합. `totalDataRows` 는 window 전 원본
 * data 행 전체 수(총 content height / 스크롤바 / trailing spacer 산출용).
 */
export function getTableProjectionRows(
  input: Record<string, unknown> | CollectionProjectionRowsInput | undefined,
  window: number | CollectionWindow = COLLECTION_ROW_PROJECTION_WINDOW_LIMIT,
): {
  columns: TableColumnDef[];
  rows: TableProjectionRow[];
  totalDataRows: number;
} {
  const props = isProjectionRowsInput(input) ? input.props : input;
  const columns = readTableColumns(props);

  const dataBindingRows = isProjectionRowsInput(input)
    ? readDataBindingRows(input.dataBinding, input.collections)
    : [];
  const propRows = Array.isArray(props?.rows) ? props.rows : [];
  // reference 정합 (2026-06-22): 빈 데이터 시 샘플 fallback 미주입 → 빈 배열.
  // data 0행이면 resolveDataBoundTableProjection 이 null 반환(standalone 유지)하여
  // Skia 도 CSS 와 동일하게 빈 테이블을 그린다.
  const sourceRows =
    dataBindingRows.length > 0
      ? dataBindingRows
      : propRows.length > 0
        ? propRows
        : [];

  const headerRow: TableProjectionRow = {
    kind: "header",
    cells: {},
    isSelected: false,
    rowIndex: -1,
    rowKey: "__header__",
  };

  const { start, end } = resolveSliceBounds(window, sourceRows.length);
  const dataRows = sourceRows
    .slice(start, end)
    .map((item, i): TableProjectionRow => {
      const rowIndex = start + i;
      const record = isRecord(item) ? item : {};
      const rowKey = getItemKey(item, rowIndex);
      return {
        kind: "data",
        cells: readRowCells(item, columns),
        isSelected: record.isSelected === true,
        rowIndex,
        rowKey,
      };
    });

  return {
    columns,
    rows: [headerRow, ...dataRows],
    totalDataRows: sourceRows.length,
  };
}
