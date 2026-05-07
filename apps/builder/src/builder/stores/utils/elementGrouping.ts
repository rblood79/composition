/**
 * Element Grouping Utilities
 * Phase 4: Grouping & Organization - Group/Ungroup Operations
 *
 * Utilities for creating and managing element groups
 */

import type { Element } from "../../../types/core/store.types";
import { ElementUtils } from "../../../utils/element/elementUtils";

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
export function createGroupFromSelection(
  elementIds: string[],
  elementsMap: Map<string, Element>,
  pageId: string,
): GroupCreationResult {
  if (elementIds.length === 0) {
    throw new Error("[Group] No elements selected to group");
  }

  // Get selected elements
  const selectedElements = elementIds
    .map((id) => elementsMap.get(id))
    .filter((el): el is Element => el !== undefined);

  if (selectedElements.length === 0) {
    throw new Error("[Group] Selected elements not found");
  }

  // Find common parent (if all elements have same parent)
  const firstParentId = selectedElements[0].parent_id;
  const allSameParent = selectedElements.every(
    (el) => el.parent_id === firstParentId,
  );

  // Group's parent_id is the common parent (or null if different parents)
  const groupParentId = allSameParent ? firstParentId : null;

  // Calculate average position for group positioning
  const positions = selectedElements
    .map((el) => {
      const style = (el.props.style || {}) as Record<string, unknown>;
      const left = parsePixels(style.left);
      const top = parsePixels(style.top);
      return { left, top };
    })
    .filter((pos) => pos.left !== null && pos.top !== null);

  const avgLeft =
    positions.length > 0
      ? positions.reduce((sum, pos) => sum + (pos.left || 0), 0) /
        positions.length
      : 0;
  const avgTop =
    positions.length > 0
      ? positions.reduce((sum, pos) => sum + (pos.top || 0), 0) /
        positions.length
      : 0;

  // Generate customId for group (e.g., "group_1", "group_2")
  const existingGroups = Array.from(elementsMap.values()).filter(
    (el) => el.type === "Group" && el.customId?.startsWith("group_"),
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

  // Create Group element
  const groupElement: Element = {
    id: ElementUtils.generateId(),
    customId: groupCustomId,
    type: "Group",
    props: {
      label: `Group (${selectedElements.length} elements)`,
      style: {
        display: "block",
        position: "relative",
        left: `${avgLeft}px`,
        top: `${avgTop}px`,
      },
    },
    parent_id: groupParentId,
    page_id: pageId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Update selected elements' parent_id to group
  const updatedChildren = selectedElements.map((el) => ({
    ...el,
    parent_id: groupElement.id,
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
export function ungroupElement(
  groupId: string,
  elementsMap: Map<string, Element>,
): UngroupResult {
  const groupElement = elementsMap.get(groupId);

  if (!groupElement) {
    throw new Error(`[Ungroup] Group element not found: ${groupId}`);
  }

  if (groupElement.type !== "Group") {
    throw new Error(
      `[Ungroup] Element is not a Group: ${groupId} (type: ${groupElement.type})`,
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
