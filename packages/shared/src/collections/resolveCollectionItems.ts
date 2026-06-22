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
  /** 정규화된 item 행 (kind:'item'|'section'). */
  rows: CollectionProjectionRow[];
  /** source 판정 — 어느 경로에서 rows 가 나왔는지. */
  sourceKind:
    | "static-items"
    | "dataBinding"
    | "collection"
    | "fallback"
    | "empty";
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
 */
export function getFlatProjectionRows(
  input: Record<string, unknown> | CollectionProjectionRowsInput | undefined,
  windowLimit = COLLECTION_ROW_PROJECTION_WINDOW_LIMIT,
): CollectionProjectionRow[] {
  const props = isProjectionRowsInput(input) ? input.props : input;
  const dataBindingRows = isProjectionRowsInput(input)
    ? readDataBindingRows(input.dataBinding, input.collections)
    : [];
  const sourceRows =
    dataBindingRows.length > 0
      ? dataBindingRows
      : Array.isArray(props?.items)
        ? props.items
        : [];

  return sourceRows
    .slice(0, windowLimit)
    .map((item, rowIndex) => toItemProjectionRow(item, rowIndex));
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
  windowLimit = COLLECTION_ROW_PROJECTION_WINDOW_LIMIT,
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

  return {
    rows: getFlatProjectionRows(input, windowLimit),
    sourceKind,
  };
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
 * collections/dataBinding/props.rows → TableProjectionRow[](header 1행 + data N행).
 *
 * data source: readDataBindingRows(flat 와 동일) → cells 차원 부착. props.columns 가 컬럼 차원.
 * window: data 행만 windowLimit 적용(header 행은 항상 1개 포함, limit 무관).
 */
export function getTableProjectionRows(
  input: Record<string, unknown> | CollectionProjectionRowsInput | undefined,
  windowLimit = COLLECTION_ROW_PROJECTION_WINDOW_LIMIT,
): { columns: TableColumnDef[]; rows: TableProjectionRow[] } {
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

  const dataRows = sourceRows
    .slice(0, windowLimit)
    .map((item, rowIndex): TableProjectionRow => {
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

  return { columns, rows: [headerRow, ...dataRows] };
}
