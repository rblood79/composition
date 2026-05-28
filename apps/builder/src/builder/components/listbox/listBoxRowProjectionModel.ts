export const LISTBOX_ROW_PROJECTION_WINDOW_LIMIT = 100;

export type ListBoxProjectionRow = {
  description: string | null;
  isDisabled: boolean;
  item: unknown;
  itemKey: string;
  label: string;
  rowIndex: number;
  value: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readItems(props: Record<string, unknown> | undefined): unknown[] {
  return Array.isArray(props?.items) ? props.items : [];
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
  props: Record<string, unknown> | undefined,
  windowLimit = LISTBOX_ROW_PROJECTION_WINDOW_LIMIT,
): ListBoxProjectionRow[] {
  return readItems(props)
    .slice(0, windowLimit)
    .map((item, rowIndex) => {
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
