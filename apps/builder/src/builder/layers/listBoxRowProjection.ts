import { detectListBoxAuthoringMode } from "../components/listbox/listBoxTemplateOrigins";
import {
  getListBoxProjectionRows,
  LISTBOX_ROW_PROJECTION_WINDOW_LIMIT,
  type ListBoxCollectionDataSource,
} from "../components/listbox/listBoxRowProjectionModel";
import { getElementDataBinding } from "../../adapters/canonical/compositionExtensionFields";
import {
  toListBoxRowProjectionId,
  toListBoxRowsGroupProjectionId,
} from "../projection/renderProjectionIds";
import type { LayerTreeNode } from "../panels/navigator/tree/LayerTree/types";
import type { PanelNode } from "../panels/panelNode";

export { LISTBOX_ROW_PROJECTION_WINDOW_LIMIT };

type TreeChildInput = {
  id: string;
  ref?: unknown;
  type: string;
};

type BuildListBoxRowProjectionInput = {
  collections?: readonly ListBoxCollectionDataSource[];
  depth: number;
  listBoxElement: PanelNode;
  treeChildren?: readonly TreeChildInput[];
};

type RowProjectionData = {
  item: unknown;
  itemKey: string;
  rowIndex: number;
  templateAnchorId: string | null;
};

function findTemplateAnchorId(
  children: readonly TreeChildInput[] | undefined,
): string | null {
  const anchor = children?.find(
    (child) => child.type === "ref" || child.type === "ListBoxItem",
  );
  return anchor?.id ?? null;
}

export function buildListBoxRowProjectionGroup({
  collections,
  depth,
  listBoxElement,
  treeChildren = [],
}: BuildListBoxRowProjectionInput): LayerTreeNode | null {
  if (listBoxElement.type !== "ListBox") return null;
  const dataBinding = getElementDataBinding(listBoxElement);

  const mode = detectListBoxAuthoringMode({
    children: [...treeChildren],
    dataBinding,
    props: listBoxElement.props,
  });
  if (mode.mode !== "data-bound") return null;

  const rows = getListBoxProjectionRows({
    collections,
    dataBinding,
    props: listBoxElement.props,
  });
  if (rows.length === 0) return null;

  const groupId = toListBoxRowsGroupProjectionId(listBoxElement.id);
  const templateAnchorId = findTemplateAnchorId(treeChildren);
  const children = rows.map((row): LayerTreeNode => {
    const rowData: RowProjectionData = {
      item: row.item,
      itemKey: row.itemKey,
      rowIndex: row.rowIndex,
      templateAnchorId,
    };
    return {
      id: toListBoxRowProjectionId(listBoxElement.id, row.itemKey),
      name: row.label,
      type: "ListBoxItem",
      parentId: groupId,
      depth: depth + 1,
      hasChildren: false,
      isLeaf: true,
      element: listBoxElement,
      virtualChildType: "listbox-row",
      virtualChildIndex: row.rowIndex,
      virtualChildData: rowData,
    };
  });

  return {
    id: groupId,
    name: "Rows",
    type: "Rows",
    parentId: listBoxElement.id,
    depth,
    hasChildren: children.length > 0,
    isLeaf: children.length === 0,
    element: listBoxElement,
    virtualChildType: "listbox-rows",
    virtualChildIndex: -1,
    children,
  };
}
