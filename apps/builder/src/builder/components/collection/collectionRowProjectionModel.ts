/**
 * ADR-912 단계 4 C1 — collection family 공통 row projection 모델.
 *
 * ListBox proof(`listBoxRowProjectionModel.ts`)의 family 무관 부분(데이터 읽기 +
 * 필드 휴리스틱)을 hoist 하여 GridList/Table 이 공유한다. ListBox 는 본 모듈을 재export
 * 하는 thin alias 로 유지(BC, 소비처 변경 0).
 *
 * **family 무관 = generic**: readDataBindingRows(collections/dataBinding 3경로) +
 *   readStringField(고정 필드 휴리스틱) + getItem*(Key/Label/Description/Icon/Value/Disabled).
 * **family 차이 = getRows 구현**: ListBox=flat row / GridList=section flatten(kind 분기) /
 *   Table=cell 차원(보류). 차이는 caller 의 getRows 가 흡수, 본 모듈은 공통 primitive 만.
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
