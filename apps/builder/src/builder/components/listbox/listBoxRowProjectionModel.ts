export const LISTBOX_ROW_PROJECTION_WINDOW_LIMIT = 100;

export type ListBoxCollectionDataSource = {
  id?: string;
  mockData?: Record<string, unknown>[];
  name?: string;
  runtimeData?: Record<string, unknown>[];
  useMockData?: boolean;
};

export type ListBoxProjectionRow = {
  description: string | null;
  isDisabled: boolean;
  item: unknown;
  itemKey: string;
  label: string;
  rowIndex: number;
  value: string | null;
};

type ListBoxProjectionRowsInput = {
  collections?: readonly ListBoxCollectionDataSource[];
  dataBinding?: unknown;
  props?: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readItems(props: Record<string, unknown> | undefined): unknown[] {
  return Array.isArray(props?.items) ? props.items : [];
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isProjectionRowsInput(
  value: Record<string, unknown> | ListBoxProjectionRowsInput | undefined,
): value is ListBoxProjectionRowsInput {
  if (!isRecord(value)) return false;
  return "props" in value || "dataBinding" in value || "collections" in value;
}

function readDataBindingRows(
  dataBinding: unknown,
  collections: readonly ListBoxCollectionDataSource[] = [],
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

function readStringField(
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

function getItemKey(item: unknown, index: number): string {
  if (isRecord(item)) {
    return readStringField(item, ["id", "key", "value"]) ?? `row-${index + 1}`;
  }
  return `row-${index + 1}`;
}

function getItemLabel(item: unknown, itemKey: string, index: number): string {
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

function getItemDescription(item: unknown): string | null {
  if (!isRecord(item)) return null;
  return readStringField(item, ["description", "subtitle", "detail"]);
}

function getItemValue(item: unknown): string | null {
  if (!isRecord(item)) return null;
  return readStringField(item, ["value", "id", "key"]);
}

function getItemDisabled(item: unknown): boolean {
  if (!isRecord(item)) return false;
  return item.isDisabled === true || item.disabled === true;
}

export function getListBoxProjectionRows(
  input: Record<string, unknown> | ListBoxProjectionRowsInput | undefined,
  windowLimit = LISTBOX_ROW_PROJECTION_WINDOW_LIMIT,
): ListBoxProjectionRow[] {
  const props = isProjectionRowsInput(input) ? input.props : input;
  const dataBindingRows = isProjectionRowsInput(input)
    ? readDataBindingRows(input.dataBinding, input.collections)
    : [];
  const sourceRows =
    dataBindingRows.length > 0 ? dataBindingRows : readItems(props);

  return sourceRows.slice(0, windowLimit).map((item, rowIndex) => {
    const itemKey = getItemKey(item, rowIndex);
    return {
      description: getItemDescription(item),
      isDisabled: getItemDisabled(item),
      item,
      itemKey,
      label: getItemLabel(item, itemKey, rowIndex),
      rowIndex,
      value: getItemValue(item),
    };
  });
}
