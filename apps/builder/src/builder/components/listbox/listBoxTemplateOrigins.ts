import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import {
  COMPONENTS_SYSTEM_BODY_ID,
  ensureComponentsSystemPage,
} from "../../pages/systemComponentsPage";

export const LISTBOX_ITEM_DEFAULT_ORIGIN_ID = "component-listbox-item-default";
export const LISTBOX_ITEM_SELECTED_ORIGIN_ID =
  "component-listbox-item-selected";
export const LISTBOX_ORIGIN_ID = "component-listbox";
export const LISTBOX_TEMPLATE_ANCHOR_ROLE = "listbox-item-template-anchor";

const LISTBOX_SYSTEM_ORIGIN_IDS = new Set([
  LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
  LISTBOX_ITEM_SELECTED_ORIGIN_ID,
  LISTBOX_ORIGIN_ID,
]);

type ListBoxAuthoringInput = {
  children?: Array<{ id?: unknown; type?: unknown; ref?: unknown }>;
  dataBinding?: unknown;
  props?: Record<string, unknown>;
};

export type ListBoxAuthoringMode =
  | { mode: "data-bound"; rowDataSource: "dataBinding" | "items" }
  | { mode: "static"; rowDataSource: "static-children" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasDataBinding(value: unknown): boolean {
  return value !== null && value !== undefined;
}

function hasNonEmptyItems(props: Record<string, unknown> | undefined): boolean {
  return Array.isArray(props?.items) && props.items.length > 0;
}

function hasStaticListBoxItemRefChildren(
  children: ListBoxAuthoringInput["children"],
): boolean {
  return Boolean(
    children?.some(
      (child) =>
        child.type === "ListBoxItem" ||
        child.ref === LISTBOX_ITEM_DEFAULT_ORIGIN_ID ||
        child.ref === LISTBOX_ITEM_SELECTED_ORIGIN_ID,
    ),
  );
}

export function detectListBoxAuthoringMode(
  input: ListBoxAuthoringInput,
): ListBoxAuthoringMode {
  if (hasDataBinding(input.dataBinding)) {
    return { mode: "data-bound", rowDataSource: "dataBinding" };
  }
  if (hasNonEmptyItems(input.props)) {
    return { mode: "data-bound", rowDataSource: "items" };
  }
  if (hasStaticListBoxItemRefChildren(input.children)) {
    return { mode: "static", rowDataSource: "static-children" };
  }
  return { mode: "static", rowDataSource: "static-children" };
}

export function isListBoxTemplateAnchor(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const metadata = value.metadata;
  if (!isRecord(metadata)) return false;
  return metadata.templateRole === LISTBOX_TEMPLATE_ANCHOR_ROLE;
}

function createListBoxItemDefaultOrigin(): CanonicalNode {
  return {
    id: LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
    type: "ListBoxItem",
    name: "ListBoxItem/Default",
    reusable: true,
    props: {
      children: "{label}",
      textValue: "{label}",
      description: "{description}",
    },
    metadata: {
      type: "listbox-template-origin",
      systemOwned: true,
      componentFamily: "ListBox",
      variant: "default",
    },
  };
}

function createListBoxItemSelectedOrigin(): CanonicalNode {
  return {
    id: LISTBOX_ITEM_SELECTED_ORIGIN_ID,
    type: "ListBoxItem",
    name: "ListBoxItem/Selected",
    reusable: true,
    props: {
      children: "{label}",
      textValue: "{label}",
      description: "{description}",
      style: {
        backgroundColor: "var(--color-accent-subtle)",
      },
    },
    metadata: {
      type: "listbox-template-origin",
      systemOwned: true,
      componentFamily: "ListBox",
      variant: "selected",
    },
  };
}

function createListBoxOrigin(): CanonicalNode {
  return {
    id: LISTBOX_ORIGIN_ID,
    type: "ListBox",
    name: "ListBox",
    reusable: true,
    props: {
      orientation: "vertical",
      selectionMode: "single",
      items: [],
    },
    slot: [LISTBOX_ITEM_DEFAULT_ORIGIN_ID, LISTBOX_ITEM_SELECTED_ORIGIN_ID],
    metadata: {
      type: "listbox-origin",
      systemOwned: true,
      componentFamily: "ListBox",
    },
  };
}

function repairOrigin(
  existing: CanonicalNode | undefined,
  createNode: () => CanonicalNode,
): CanonicalNode {
  const base = createNode();
  if (!existing) return base;
  return {
    ...base,
    props: existing.props ?? base.props,
    children: existing.children ?? base.children,
    metadata: {
      ...base.metadata,
      ...(existing.metadata ?? {}),
      type: existing.metadata?.type ?? base.metadata?.type ?? "listbox-origin",
      systemOwned: true,
      componentFamily: "ListBox",
    },
  };
}

function collectOrigins(
  nodes: readonly CanonicalNode[],
  out = new Map<string, CanonicalNode>(),
): Map<string, CanonicalNode> {
  for (const node of nodes) {
    if (LISTBOX_SYSTEM_ORIGIN_IDS.has(node.id)) {
      out.set(node.id, node);
    }
    collectOrigins(node.children ?? [], out);
  }
  return out;
}

function stripOrigins(nodes: readonly CanonicalNode[]): CanonicalNode[] {
  return nodes
    .filter((node) => !LISTBOX_SYSTEM_ORIGIN_IDS.has(node.id))
    .map((node) => {
      if (!node.children) return node;
      return {
        ...node,
        children: stripOrigins(node.children),
      };
    });
}

function withOriginsInComponentsBody(
  nodes: readonly CanonicalNode[],
  origins: CanonicalNode[],
): CanonicalNode[] {
  return nodes.map((node) => {
    if (node.id === COMPONENTS_SYSTEM_BODY_ID) {
      return {
        ...node,
        children: [...(node.children ?? []), ...origins],
      };
    }
    if (!node.children) return node;
    return {
      ...node,
      children: withOriginsInComponentsBody(node.children, origins),
    };
  });
}

export function ensureListBoxTemplateOrigins(
  document: CompositionDocument,
): CompositionDocument {
  const withComponentsPage = ensureComponentsSystemPage(document);
  const existingOrigins = collectOrigins(withComponentsPage.children);
  const origins = [
    repairOrigin(
      existingOrigins.get(LISTBOX_ITEM_DEFAULT_ORIGIN_ID),
      createListBoxItemDefaultOrigin,
    ),
    repairOrigin(
      existingOrigins.get(LISTBOX_ITEM_SELECTED_ORIGIN_ID),
      createListBoxItemSelectedOrigin,
    ),
    repairOrigin(existingOrigins.get(LISTBOX_ORIGIN_ID), createListBoxOrigin),
  ];

  const strippedChildren = stripOrigins(withComponentsPage.children);
  const nextChildren = withOriginsInComponentsBody(strippedChildren, origins);
  const nextDocument = { ...withComponentsPage, children: nextChildren };

  return JSON.stringify(withComponentsPage) === JSON.stringify(nextDocument)
    ? withComponentsPage
    : nextDocument;
}
