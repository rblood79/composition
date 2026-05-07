import { useMemo, useCallback } from "react";
import { buildTreeFromElements } from "../../../../utils/treeUtils";
import type { Element } from "../../../../../types/core/store.types";
import type { ElementTreeItem } from "../../../../../types/builder/stately.types";
import type { ElementProps } from "../../../../../types/integrations/supabase.types";
import { useStore } from "../../../../stores";
import { resolveCanonicalRefTree } from "../../../../utils/canonicalRefResolution";
import { useCanonicalElements } from "../../../../stores/canonical/canonicalElementsView";
import { resolvePageWithFrame } from "../../../../workspace/canvas/scene/resolvePageWithFrame";
import { getPageFrameBindingId } from "../../../../../adapters/canonical/frameMirror";
import { getElementLayoutId } from "../../../../../adapters/canonical/legacyElementFields";
import {
  childrenAs,
  type ButtonItem,
  type CheckboxItem,
  type RadioItem,
  type TreeItem as TreeItemType,
} from "../helpers";
import type { LayerTreeNode, VirtualChildType } from "./types";

export function useLayerTreeData(elements: Element[]) {
  const allElementsMap = useStore((state) => state.elementsMap);
  const currentPageId = useStore((state) => state.currentPageId);
  const pages = useStore((state) => state.pages);

  // ADR-116 direct cutover — canonical store 의 active document 에서 derived
  // Element[] 를 source 로 사용. 초기 hydration 전에는 caller elements[] fallback.
  const canonicalElements = useCanonicalElements();
  const resolutionElementsMap = useMemo(() => {
    if (!canonicalElements) return allElementsMap;
    const map = new Map(
      canonicalElements.map((element) => [element.id, element]),
    );
    for (const [id, element] of allElementsMap) {
      if (!map.has(id)) map.set(id, element);
    }
    return map;
  }, [allElementsMap, canonicalElements]);

  const sourceElements = useMemo(() => {
    const baseElements = mergeCanonicalLayerSource(canonicalElements, elements);
    if (!currentPageId) return baseElements;
    const currentPage = pages.find((page) => page.id === currentPageId);
    const boundFrameId = currentPage ? getPageFrameBindingId(currentPage) : "";
    const legacyLayerSource = baseElements.filter((element) => {
      const elementLayoutId = getElementLayoutId(element);
      const isCurrentPageOwnedElement =
        element.page_id === currentPageId && elementLayoutId === null;
      const isBoundFrameElement =
        boundFrameId.length > 0 && elementLayoutId === boundFrameId;

      return isCurrentPageOwnedElement || isBoundFrameElement;
    });

    if (!currentPage || boundFrameId.length === 0) {
      return legacyLayerSource;
    }

    const pageOwnedElements = baseElements.filter(
      (element) =>
        element.page_id === currentPageId &&
        getElementLayoutId(element) === null,
    );
    const resolvedPage = resolvePageWithFrame({
      page: currentPage,
      pageElements: pageOwnedElements,
      elementsMap: resolutionElementsMap,
    });

    if (!resolvedPage.hasFrameBinding || !resolvedPage.bodyElement) {
      return legacyLayerSource;
    }

    return [resolvedPage.bodyElement, ...resolvedPage.pageElements];
  }, [
    elements,
    canonicalElements,
    currentPageId,
    pages,
    resolutionElementsMap,
  ]);

  const projectedElements = useMemo(() => {
    if (sourceElements.length === 0) return sourceElements;
    const resolvedElements = resolveCanonicalRefTree({
      elements: sourceElements,
      elementsMap: resolutionElementsMap,
    }).elements;

    return dedupeLayerElementsById(resolvedElements);
  }, [resolutionElementsMap, sourceElements]);

  const elementTree = useMemo(
    () => buildTreeFromElements(projectedElements),
    [projectedElements],
  );

  const treeNodes = useMemo(
    () =>
      convertToLayerTreeNodes(elementTree, projectedElements, allElementsMap),
    [allElementsMap, elementTree, projectedElements],
  );

  // nodeMap: treeNodes 기반 O(1) 조회용 맵
  const { nodeMap, focusNodeMap, disabledKeys } = useMemo(() => {
    const nodes = new Map<string, LayerTreeNode>();
    const focusNodes = new Map<
      string,
      { parentId: string | null; children?: unknown[] }
    >();
    const disabled = new Set<string>();
    const stack = [...treeNodes];

    while (stack.length > 0) {
      const node = stack.shift();
      if (!node) continue;

      nodes.set(node.id, node);
      focusNodes.set(node.id, {
        parentId: node.parentId,
        children: node.children,
      });

      if (node.virtualChildType) {
        disabled.add(node.id);
      }

      if (node.children && node.children.length > 0) {
        stack.unshift(...node.children);
      }
    }

    return {
      nodeMap: nodes,
      focusNodeMap: focusNodes,
      disabledKeys: disabled,
    };
  }, [treeNodes]);

  // useTreeData 대신 직접 tree 객체 생성
  // getItem은 nodeMap 기반으로 구현
  const tree = useMemo(
    () => ({
      getItem: (key: string | number) => {
        const node = nodeMap.get(String(key));
        return node ? { value: node } : undefined;
      },
    }),
    [nodeMap],
  );

  const moveElementToContainer = useStore(
    (state) => state.moveElementToContainer,
  );
  const syncToStore = useCallback(
    (
      updates: Array<{
        id: string;
        parentId: string | null;
        insertionIndex: number;
      }>,
    ) => {
      if (updates.length === 0) return;
      for (const update of updates) {
        if (update.parentId === null) continue;
        moveElementToContainer(
          update.id,
          update.parentId,
          update.insertionIndex,
        );
      }
    },
    [moveElementToContainer],
  );

  return { tree, treeNodes, nodeMap, focusNodeMap, disabledKeys, syncToStore };
}

function mergeCanonicalLayerSource(
  canonicalElements: Element[] | null,
  layerElements: Element[],
): Element[] {
  if (!canonicalElements) return layerElements;
  const elementsById = new Map(
    canonicalElements.map((element) => [element.id, element]),
  );

  for (const element of layerElements) {
    if (!elementsById.has(element.id)) {
      elementsById.set(element.id, element);
    }
  }

  return Array.from(elementsById.values());
}

function dedupeLayerElementsById(elements: Element[]): Element[] {
  if (elements.length < 2) return elements;

  const seenIds = new Set<string>();
  const deduped: Element[] = [];
  for (const element of elements) {
    if (seenIds.has(element.id)) continue;
    seenIds.add(element.id);
    deduped.push(element);
  }

  return deduped.length === elements.length ? elements : deduped;
}

function convertToLayerTreeNodes(
  tree: ElementTreeItem[],
  elements: Element[],
  persistedElementsMap: Map<string, Element>,
  depth = 0,
): LayerTreeNode[] {
  const elementsMap = new Map(elements.map((el) => [el.id, el]));

  return tree.flatMap((item): LayerTreeNode[] => {
    const element = elementsMap.get(item.id);
    if (!element) return [];
    const persistedElement = persistedElementsMap.get(item.id);

    const childNodes = item.children
      ? convertToLayerTreeNodes(
          item.children,
          elements,
          persistedElementsMap,
          depth + 1,
        )
      : [];
    const virtualChildren = getVirtualChildren(item, depth + 1, element);
    const children = [...childNodes, ...virtualChildren];

    const baseNode: LayerTreeNode = {
      id: item.id,
      name: getDisplayName(item),
      type: item.type,
      parentId: item.parent_id ?? null,
      depth,
      hasChildren: children.length > 0,
      isLeaf: children.length === 0,
      element: persistedElement ?? element,
      isSyntheticRefChild: !persistedElement,
      children,
    };

    return [baseNode];
  });
}

function getDisplayName(item: ElementTreeItem): string {
  const props = item.props as ElementProps | undefined;

  if (item.type === "TabList") return "Tab List";
  if (item.type === "TabPanels") return "Tab Panels";
  if (item.type === "TabPanel") return "TabPanel";
  if (item.type === "TableHeader") return "thead";
  if (item.type === "TableBody") return "tbody";
  if (item.type === "Column") {
    return `th: ${props?.children || "Column"}`;
  }
  if (item.type === "Row") return "tr";
  if (item.type === "Cell") {
    return `td: ${props?.children || "Cell"}`;
  }

  return item.type;
}

function getVirtualChildren(
  item: ElementTreeItem,
  depth: number,
  element: Element,
): LayerTreeNode[] {
  const props = item.props as ElementProps | undefined;
  if (!props) return [];

  const makeNode = (
    type: VirtualChildType,
    index: number,
    label: string,
    data: unknown,
  ): LayerTreeNode => ({
    id: `${item.id}::${type}:${index}`,
    name: label,
    type: item.type,
    parentId: item.id,
    depth,
    hasChildren: false,
    isLeaf: true,
    element,
    virtualChildType: type,
    virtualChildIndex: index,
    virtualChildData: data,
  });

  if (item.type === "ToggleButtonGroup") {
    const children = childrenAs<ButtonItem>(props.children);
    return children.map((child, index) =>
      makeNode("toggle", index, child.title || `Button ${index + 1}`, child),
    );
  }

  if (item.type === "CheckboxGroup") {
    const children = childrenAs<CheckboxItem>(props.children);
    return children.map((child, index) =>
      makeNode(
        "checkbox",
        index,
        child.label || `Checkbox ${index + 1}`,
        child,
      ),
    );
  }

  if (item.type === "RadioGroup") {
    const children = childrenAs<RadioItem>(props.children);
    return children.map((child, index) =>
      makeNode("radio", index, child.label || `Radio ${index + 1}`, child),
    );
  }

  if (item.type === "Tree") {
    const children = childrenAs<TreeItemType>(props.children);
    return children.map((child, index) =>
      makeNode("tree", index, child.title || `Item ${index + 1}`, child),
    );
  }

  return [];
}
