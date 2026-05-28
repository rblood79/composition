export const LISTBOX_ROW_PROJECTION_PREFIX = "projection:listbox-row:";
export const LISTBOX_ROWS_GROUP_PROJECTION_PREFIX = "projection:listbox-rows:";

export function toListBoxRowProjectionId(
  listBoxId: string,
  itemKey: string,
): string {
  return `${LISTBOX_ROW_PROJECTION_PREFIX}${listBoxId}:${itemKey}`;
}

export function toListBoxRowsGroupProjectionId(listBoxId: string): string {
  return `${LISTBOX_ROWS_GROUP_PROJECTION_PREFIX}${listBoxId}`;
}

export function isRenderProjectionId(id: string | null | undefined): boolean {
  return (
    typeof id === "string" &&
    (id.startsWith(LISTBOX_ROW_PROJECTION_PREFIX) ||
      id.startsWith(LISTBOX_ROWS_GROUP_PROJECTION_PREFIX) ||
      id.includes("::page-frame::"))
  );
}
