/**
 * Element Grouping Utilities
 * Phase 4: Grouping & Organization - Group/Ungroup Operations
 *
 * Utilities for creating and managing element groups
 */

import type { Element } from "../../../types/core/store.types";
import { ElementUtils } from "../../../utils/element/elementUtils";

/**
 * ADR-130 transitional guard — accept both canonical "frame" and legacy "Group"
 * during the migration period. Removed once §5 lowercase cleanup ADR lands.
 */
export function isFrameOrLegacyGroup(type: string | undefined): boolean {
  return type === "frame" || type === "Group";
}

/**
 * Group creation result
 */
export interface GroupCreationResult {
  /** The newly created group element */
  groupElement: Element;
  /** Updated child elements with new parent_id */
  updatedChildren: Element[];
}

/**
 * Ungroup result
 */
export interface UngroupResult {
  /** Updated children (moved to group's parent) */
  updatedChildren: Element[];
  /** Group element ID to be deleted */
  groupIdToDelete: string;
}

/**
 * Create a Group element from selected elements
 *
 * @param elementIds - IDs of elements to group
 * @param elementsMap - Map of all elements
 * @param pageId - Current page ID
 * @returns Group element and updated children
 *
 * @example
 * ```ts
 * const result = createGroupFromSelection(
 *   ['elem-1', 'elem-2', 'elem-3'],
 *   elementsMap,
 *   'page-1'
 * );
 * // Returns: { groupElement, updatedChildren }
 * ```
 */
export function createGroupFromSelection<TElement extends Element>(
  elementIds: readonly string[],
  elementsMap: ReadonlyMap<string, TElement>,
  pageId: string,
): GroupCreationResult {
  if (elementIds.length === 0) {
    throw new Error("[Group] No elements selected to group");
  }

  // Get selected elements. Cross-page selection 도 허용 — 모든 element 가 frame 의
  // child 로 reparent 되며 다른 page 의 element 는 frame.page_id 로 page 이동.
  const selectedElements = elementIds
    .map((id) => elementsMap.get(id))
    .filter((el): el is TElement => el !== undefined);

  if (selectedElements.length === 0) {
    throw new Error("[Group] Selected elements not found");
  }

  // Pencil-style 정책: 최초 선택한 요소의 parent + page + position 을 frame anchor 로.
  // Why: 사용자 framing — "최초 선택 요소가 가진 parent 의 자리에 frame 이 생성되고
  // 나머지 요소들이 들어간다". cross-page selection 시 첫 element 의 page 가 frame
  // page 가 되고 다른 page 의 element 도 그 page 로 이동 (page_id reparent 포함).
  const firstElement = selectedElements[0];
  const groupParentId = firstElement.parent_id;
  const groupPageId = firstElement.page_id ?? pageId;
  const firstStyle = (firstElement.props.style || {}) as Record<
    string,
    unknown
  >;
  const firstLeft = parsePixels(firstStyle.left) ?? 0;
  const firstTop = parsePixels(firstStyle.top) ?? 0;

  // Generate customId for group (e.g., "group_1", "group_2").
  // Count both new "frame" and legacy "Group" so `group_N` is not double-issued
  // during the ADR-130 migration period (see `isFrameOrLegacyGroup`).
  const existingGroups = Array.from(elementsMap.values()).filter(
    (el) => isFrameOrLegacyGroup(el.type) && el.customId?.startsWith("group_"),
  );
  const maxGroupNum =
    existingGroups.length > 0
      ? Math.max(
          ...existingGroups.map((el) => {
            const match = el.customId?.match(/^group_(\d+)$/);
            return match ? parseInt(match[1], 10) : 0;
          }),
        )
      : 0;
  const groupCustomId = `group_${maxGroupNum + 1}`;

  // Create frame element (ADR-130: canonical layout container, was "Group" pre-130)
  const groupElement: Element = {
    id: ElementUtils.generateId(),
    customId: groupCustomId,
    type: "frame",
    props: {
      label: `Frame (${selectedElements.length} elements)`,
      style: {
        display: "flex",
        flexDirection: "column",
        position: "relative",
        left: `${firstLeft}px`,
        top: `${firstTop}px`,
      },
    },
    parent_id: groupParentId,
    page_id: groupPageId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Update selected elements' parent_id + page_id to group.
  // cross-page 의 다른 page element 도 frame.page_id 로 이동.
  const updatedChildren = selectedElements.map((el) => ({
    ...el,
    parent_id: groupElement.id,
    page_id: groupPageId,
    updated_at: new Date().toISOString(),
  }));

  console.log(
    `✅ [Group] Created group with ${updatedChildren.length} elements`,
  );

  return {
    groupElement,
    updatedChildren,
  };
}

/**
 * Parse pixel value from style
 */
function parsePixels(value: unknown): number | null {
  if (typeof value === "string") {
    const match = value.match(/^(-?\d+(?:\.\d+)?)px$/);
    if (match) return parseFloat(match[1]);
  }
  if (typeof value === "number") return value;
  return null;
}

/**
 * Ungroup a Group element (move children to group's parent)
 *
 * @param groupId - ID of group to ungroup
 * @param elementsMap - Map of all elements
 * @returns Updated children and group ID to delete
 *
 * @example
 * ```ts
 * const result = ungroupElement('group-123', elementsMap);
 * // Returns: { updatedChildren, groupIdToDelete: 'group-123' }
 * ```
 */
export function ungroupElement<TElement extends Element>(
  groupId: string,
  elementsMap: ReadonlyMap<string, TElement>,
): UngroupResult {
  const groupElement = elementsMap.get(groupId);

  if (!groupElement) {
    throw new Error(`[Ungroup] Group element not found: ${groupId}`);
  }

  if (!isFrameOrLegacyGroup(groupElement.type)) {
    throw new Error(
      `[Ungroup] Element is not a frame/Group: ${groupId} (type: ${groupElement.type})`,
    );
  }

  // Get children of group
  const children = Array.from(elementsMap.values()).filter(
    (el) => el.parent_id === groupId,
  );

  if (children.length === 0) {
    console.warn("[Ungroup] Group has no children, will just delete group");
    return {
      updatedChildren: [],
      groupIdToDelete: groupId,
    };
  }

  // Move children to group's parent
  const newParentId = groupElement.parent_id;

  const updatedChildren = children.map((child) => {
    const updatedChild = {
      ...child,
      parent_id: newParentId,
      updated_at: new Date().toISOString(),
    };
    return updatedChild;
  });

  console.log(
    `✅ [Ungroup] Ungrouped ${children.length} elements from group ${groupId}`,
  );

  return {
    updatedChildren,
    groupIdToDelete: groupId,
  };
}
