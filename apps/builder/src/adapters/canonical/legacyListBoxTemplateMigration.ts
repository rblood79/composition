/**
 * @fileoverview ListBox instance anchor-less 정합 migration (Option B).
 *
 * ADR-145 는 local `ListBoxItem` template child 를, ADR-146 은 locked ref template anchor 를
 * 도입했다. Option B(anchor-less)는 in-tree template 을 instance 에서 제거하고, data-bound 행
 * template 을 Components 페이지의 origin(`component-listbox-item-default`)에서 해석한다
 * (`canvasSceneNode.resolveListBoxTemplateOriginId`).
 *
 * 따라서 본 migration 은 hydration 시점에 ListBox instance 의 in-instance template anchor
 * (metadata.templateRole === "listbox-item-template-anchor")를 strip 하여, 컴포넌트 패널 추가와
 * origin copy-paste 가 동일한 bare ref 구조 + layer 트리를 갖도록 정합한다. Components 페이지의
 * origin 노드는 보존하고, templateRole 없는 정적 자식은 건드리지 않는다(오인 strip 금지).
 */

import type {
  CanonicalNode,
  CompositionDocument,
  RefNode,
} from "@composition/shared";
import {
  ensureListBoxTemplateOrigins,
  isListBoxTemplateAnchor,
  LISTBOX_ORIGIN_ID,
} from "../../builder/components/listbox/listBoxTemplateOrigins";

/**
 * ListBox element 가 `ListBoxItem` template child 없이 hydrate 된 legacy state 인지 판정.
 * (ADR-145 Phase 0 guard — 외부 테스트 호환을 위해 유지.)
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

function isSystemListBoxOrigin(node: CanonicalNode): boolean {
  return (
    node.id === LISTBOX_ORIGIN_ID ||
    (isRecord(node.metadata) &&
      node.metadata.systemOwned === true &&
      node.metadata.componentFamily === "ListBox")
  );
}

/**
 * 페이지에 배치된 ListBox instance 판정.
 *
 * - legacy / 직접 노드: `type === "ListBox"` (단, Components 시스템 origin 제외)
 * - canonical runtime instance: `type === "ref"` + `ref === "component-listbox"`
 *   (factory parent = { type:"ref", ref: LISTBOX_ORIGIN_ID }).
 *
 * **Why**: ADR-122 canonical-only runtime 에서 instance 는 ref 노드다. `type === "ListBox"`
 *   만 검사하면 기존 프로젝트의 ref instance anchor 가 strip 되지 않는다.
 */
function isPageListBoxInstance(node: CanonicalNode): boolean {
  if (node.type === "ListBox") return !isSystemListBoxOrigin(node);
  return node.type === "ref" && (node as RefNode).ref === LISTBOX_ORIGIN_ID;
}

/**
 * Option B: 모든 ListBox instance 에서 in-instance template anchor 를 strip 한다.
 *
 * - origin(Components 시스템 노드)은 보존한다 (`isSystemListBoxOrigin`).
 * - `metadata.templateRole === "listbox-item-template-anchor"` 인 anchor 만 제거하므로
 *   정적 ListBoxItem / collection item 자식(templateRole 없음)은 오인 strip 되지 않는다.
 * - 멱등: anchor 가 이미 없으면 동일 참조를 반환한다.
 */
export function migrateLegacyListBoxTemplatesToOrigins(
  document: CompositionDocument,
): CompositionDocument {
  const bootstrapped = ensureListBoxTemplateOrigins(document);

  function migrateNode(node: CanonicalNode): CanonicalNode {
    const migratedChildren = (node.children ?? []).map(migrateNode);

    if (isPageListBoxInstance(node)) {
      const strippedChildren = migratedChildren.filter(
        (child) => !isListBoxTemplateAnchor(child),
      );
      if (strippedChildren.length !== migratedChildren.length) {
        return { ...node, children: strippedChildren };
      }
    }

    return node.children ? { ...node, children: migratedChildren } : node;
  }

  const next: CompositionDocument = {
    ...bootstrapped,
    children: bootstrapped.children.map(migrateNode),
  };

  return JSON.stringify(bootstrapped) === JSON.stringify(next)
    ? bootstrapped
    : next;
}
