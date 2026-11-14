import type { ItemValue } from "./types";
import type { CatalogBoundRow } from "../resolution/resolver";

/** 신규 Tabs의 유일한 항목 데이터. Tab/TabPanel은 첫 템플릿을 함께 반복한다. */
export const DEFAULT_TABS_ITEMS: readonly ItemValue[] = [
  { id: "tab-1", title: "Tab 1", content: "Tab body 1" },
  { id: "tab-2", title: "Tab 2", content: "Tab body 2" },
  { id: "tab-3", title: "Tab 3", content: "Tab body 3" },
];

export function catalogTabsItemRows(
  value: unknown,
): CatalogBoundRow[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map((item, index) => ({
    key: String(item.id ?? `tab-${index + 1}`),
    values: {
      ...item,
      label: item.title ?? item.label ?? "",
      content: item.content ?? "",
    },
  }));
}
