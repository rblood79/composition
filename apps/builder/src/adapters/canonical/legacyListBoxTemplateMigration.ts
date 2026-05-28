/**
 * @fileoverview ADR-146 — legacy ADR-145 local ListBoxItem template migration.
 *
 * ADR-145 introduced a local `ListBoxItem` template child. ADR-146 supersedes
 * that storage shape: `ListBoxItem/Default` lives once on the Components system
 * page, while content `ListBox` nodes keep a locked ref template anchor.
 */

import type {
  CanonicalNode,
  CompositionDocument,
  RefNode,
} from "@composition/shared";
import {
  ensureListBoxTemplateOrigins,
  LISTBOX_ORIGIN_ID,
  LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
  LISTBOX_TEMPLATE_ANCHOR_ROLE,
} from "../../builder/components/listbox/listBoxTemplateOrigins";

/**
 * ListBox element 가 `ListBoxItem` template child 없이 hydrate 된 legacy state 인지 판정.
 *
 * - `legacyType !== "ListBox"` → false (변환 대상 아님)
 * - children 에 type === "ListBoxItem" 인 element 1개 이상 존재 → false (이미 template 있음)
 * - 그 외 → true (template child 자동 주입 대상)
 */
export function isLegacyListBoxWithoutTemplate(
  legacyType: string,
  children: readonly { type: string }[],
): boolean {
  if (legacyType !== "ListBox") return false;
  return !children.some((child) => child.type === "ListBoxItem");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeTemplateProps(
  props: CanonicalNode["props"] | undefined,
): Record<string, unknown> {
  const next = { ...(props ?? {}) };
  if (isRecord(next.style)) {
    const style = { ...next.style };
    delete style.display;
    if (Object.keys(style).length > 0) {
      next.style = style;
    } else {
      delete next.style;
    }
  }
  return next;
}

function isDefaultTemplateAnchor(node: CanonicalNode): boolean {
  return (
    node.type === "ref" &&
    (node as RefNode).ref === LISTBOX_ITEM_DEFAULT_ORIGIN_ID
  );
}

function isLocalListBoxTemplate(node: CanonicalNode): boolean {
  return node.type === "ListBoxItem";
}

function isSystemListBoxOrigin(node: CanonicalNode): boolean {
  return (
    node.id === LISTBOX_ORIGIN_ID ||
    (isRecord(node.metadata) &&
      node.metadata.systemOwned === true &&
      node.metadata.componentFamily === "ListBox")
  );
}

function hasOwnKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).length > 0;
}

function getDescendantKey(node: CanonicalNode, index: number): string {
  return node.name ?? node.id ?? `child-${index + 1}`;
}

function buildDescendantOverrides(
  template: CanonicalNode,
): RefNode["descendants"] | undefined {
  const children = template.children ?? [];
  if (children.length === 0) return undefined;

  const descendants: NonNullable<RefNode["descendants"]> = {};
  children.forEach((child, index) => {
    descendants[getDescendantKey(child, index)] = {
      props: child.props ?? {},
    };
  });
  return descendants;
}

function createTemplateAnchor(
  id: string,
  template: CanonicalNode | null,
  includeOverrides: boolean,
): RefNode {
  const props = includeOverrides ? sanitizeTemplateProps(template?.props) : {};
  const descendants =
    includeOverrides && template
      ? buildDescendantOverrides(template)
      : undefined;
  return {
    id,
    type: "ref",
    ref: LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
    name: template?.name ?? "ListBoxItem",
    props,
    metadata: {
      type: "legacy-element-props",
      templateRole: LISTBOX_TEMPLATE_ANCHOR_ROLE,
      originRef: LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
      locked: true,
      deleteDisabled: true,
      migratedFrom: template
        ? "adr145-local-template"
        : "adr145-missing-template",
      rowProjectionSource: "items",
    },
    ...(descendants ? { descendants } : {}),
  };
}

function updateDefaultOrigin(
  node: CanonicalNode,
  promotedTemplate: CanonicalNode | null,
): CanonicalNode {
  if (node.id !== LISTBOX_ITEM_DEFAULT_ORIGIN_ID || !promotedTemplate) {
    return node.children
      ? {
          ...node,
          children: node.children.map((child) =>
            updateDefaultOrigin(child, promotedTemplate),
          ),
        }
      : node;
  }

  return {
    ...node,
    props: sanitizeTemplateProps(promotedTemplate.props),
    children: promotedTemplate.children ?? node.children,
    metadata: {
      ...(node.metadata ?? {}),
      type:
        typeof node.metadata?.type === "string"
          ? node.metadata.type
          : "listbox-template-origin",
      promotedFrom: promotedTemplate.id,
    },
  };
}

export function migrateLegacyListBoxTemplatesToOrigins(
  document: CompositionDocument,
): CompositionDocument {
  const bootstrapped = ensureListBoxTemplateOrigins(document);
  let promotedTemplate: CanonicalNode | null = null;

  function migrateNode(node: CanonicalNode): CanonicalNode {
    const migratedChildren = (node.children ?? []).map(migrateNode);
    if (node.type !== "ListBox" || isSystemListBoxOrigin(node)) {
      return node.children ? { ...node, children: migratedChildren } : node;
    }

    if (migratedChildren.some(isDefaultTemplateAnchor)) {
      return { ...node, children: migratedChildren };
    }

    const localTemplates = migratedChildren.filter(isLocalListBoxTemplate);
    if (localTemplates.length === 0) {
      if (!isLegacyListBoxWithoutTemplate(node.type, migratedChildren)) {
        return { ...node, children: migratedChildren };
      }
      return {
        ...node,
        children: [
          ...migratedChildren,
          createTemplateAnchor(
            `${node.id}::template::listboxitem`,
            null,
            false,
          ),
        ],
      };
    }

    const firstTemplate = localTemplates[0];
    const shouldPromote = promotedTemplate === null;
    if (shouldPromote) promotedTemplate = firstTemplate;

    const nonTemplateChildren = migratedChildren.filter(
      (child) => !isLocalListBoxTemplate(child),
    );
    const anchor = createTemplateAnchor(
      firstTemplate.id,
      firstTemplate,
      !shouldPromote,
    );
    return {
      ...node,
      children: [...nonTemplateChildren, anchor],
    };
  }

  const migratedChildren = bootstrapped.children.map(migrateNode);
  const withMigratedListBoxes: CompositionDocument = {
    ...bootstrapped,
    children: migratedChildren,
  };

  if (!promotedTemplate) return withMigratedListBoxes;
  return {
    ...withMigratedListBoxes,
    children: withMigratedListBoxes.children.map((child) =>
      updateDefaultOrigin(child, promotedTemplate),
    ),
  };
}
