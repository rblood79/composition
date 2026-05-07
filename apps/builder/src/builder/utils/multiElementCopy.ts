/**
 * Multi-Element Copy/Paste Utilities
 * Phase 6: Copy/Paste - Multi-Element Copy/Paste
 *
 * Utilities for copying and pasting multiple elements while preserving relationships
 */

import type { Element } from "../../types/core/store.types";
import {
  COMPONENT_MASTER_ID_MIRROR_FIELD,
  COMPONENT_ROLE_MIRROR_FIELD,
  isComponentOriginMirrorElement as isMasterElement,
} from "../../adapters/canonical/componentSemanticsMirror";
import { normalizeExternalFillIngress } from "../panels/styles/utils/fillExternalIngress";
import { ElementUtils } from "../../utils/element/elementUtils";
import {
  getFrameElementMirrorId,
  withFrameElementMirrorId,
} from "../../adapters/canonical/frameMirror";
import { generateCustomId, getCustomIdBase } from "./idGeneration";

/**
 * Copied elements data structure
 */
export interface CopiedElementsData {
  /** Elements to copy */
  elements: Element[];
  /** Root element IDs (elements without parents in the selection) */
  rootIds: string[];
  /** Original parent IDs (for elements whose parents are NOT selected) */
  externalParents: Map<string, string>;
  /** Timestamp of copy operation */
  timestamp: number;
}

export interface PasteMultipleElementsOptions {
  targetParentId?: string | null;
}

export interface ResolvePasteTargetParentInput {
  currentPageId: string | null;
  selectedElementId?: string | null;
  elements: Iterable<Element>;
}

function hasExplicitTargetParent(
  options: PasteMultipleElementsOptions,
): boolean {
  return Object.prototype.hasOwnProperty.call(options, "targetParentId");
}

function isBodyElement(element: Element): boolean {
  return element.type.toLowerCase() === "body";
}

export function resolvePasteTargetParentId({
  currentPageId,
  selectedElementId,
  elements,
}: ResolvePasteTargetParentInput): string | null {
  const elementList = Array.from(elements);
  const selectedElement = selectedElementId
    ? elementList.find((element) => element.id === selectedElementId)
    : undefined;

  if (
    selectedElement &&
    !selectedElement.deleted &&
    (!currentPageId || selectedElement.page_id === currentPageId)
  ) {
    return selectedElement.id;
  }

  if (!currentPageId) return null;

  return (
    elementList.find(
      (element) =>
        !element.deleted &&
        element.page_id === currentPageId &&
        isBodyElement(element),
    )?.id ?? null
  );
}

function isReusableOrigin(element: Element): boolean {
  // ADR-116 G5-B P5-C: legacy `componentRole === "master"` 검사 → isMasterElement
  // 호출로 단일화 (isMasterElement 자체는 read-through fallback marker 보존).
  // canonical 진입 시 element.reusable === true 도 별도 인식.
  return element.reusable === true || isMasterElement(element);
}

function getReusableOriginRoot(copiedData: CopiedElementsData): Element | null {
  if (copiedData.rootIds.length !== 1) return null;
  const root = copiedData.elements.find(
    (element) => element.id === copiedData.rootIds[0],
  );
  if (!root || !isReusableOrigin(root)) return null;
  return root;
}

function parsePixels(value: unknown): number {
  if (typeof value === "string") {
    const match = value.match(/^(-?\d+(?:\.\d+)?)px$/);
    if (match) return parseFloat(match[1]);
  }
  if (typeof value === "number") return value;
  return 0;
}

function createRefOverrideProps(
  origin: Element,
  offset: { x: number; y: number },
): Record<string, unknown> {
  const currentStyle = (origin.props.style || {}) as Record<string, unknown>;
  const left = parsePixels(currentStyle.left);
  const top = parsePixels(currentStyle.top);
  const hasPosition = "left" in currentStyle || "top" in currentStyle;

  if (!hasPosition) return {};

  return {
    style: {
      left: `${left + offset.x}px`,
      top: `${top + offset.y}px`,
    },
  };
}

function getRefMasterType(
  element: Element,
  existingElements: Element[],
): string | null {
  if (element.type !== "ref") return null;
  const ref = (element as Element & { ref?: unknown }).ref;
  if (typeof ref !== "string") return null;
  return (
    existingElements.find((candidate) => candidate.id === ref)?.type ?? null
  );
}

function getCustomIdGenerationBase(
  element: Element,
  existingElements: Element[],
  fallbackType: string = element.type,
): string {
  return (
    getCustomIdBase(element.customId) ??
    getRefMasterType(element, existingElements) ??
    fallbackType
  );
}

function withFreshCustomId(
  element: Element,
  allocatedElements: Element[],
  baseType?: string,
): Element {
  return {
    ...element,
    customId: generateCustomId(
      baseType ?? getCustomIdGenerationBase(element, allocatedElements),
      allocatedElements,
    ),
  };
}

/**
 * Copy multiple elements with relationship preservation
 *
 * @param elementIds - IDs of elements to copy
 * @param elementsMap - Map of all elements
 * @returns Serialized copy data
 */
export function copyMultipleElements(
  elementIds: string[],
  elementsMap: Map<string, Element>,
): CopiedElementsData {
  // Get all elements to copy
  const elementsToCopy = elementIds
    .map((id) => elementsMap.get(id))
    .filter((el): el is Element => el !== undefined);

  if (elementsToCopy.length === 0) {
    return {
      elements: [],
      rootIds: [],
      externalParents: new Map(),
      timestamp: Date.now(),
    };
  }

  // Create a Set for quick lookup
  const selectedIds = new Set(elementIds);

  // Find root elements and external parents
  const rootIds: string[] = [];
  const externalParents = new Map<string, string>();

  elementsToCopy.forEach((element) => {
    if (!element.parent_id) {
      // Top-level element (no parent)
      rootIds.push(element.id);
    } else if (!selectedIds.has(element.parent_id)) {
      // Parent is NOT in selection → external parent
      externalParents.set(element.id, element.parent_id);
      rootIds.push(element.id);
    }
    // else: Parent IS in selection → will be handled by relationship preservation
  });

  // Also need to copy ALL descendants of selected elements
  const allElementsIncludingDescendants = new Set<Element>(elementsToCopy);

  // BFS to find all descendants
  const queue = [...elementsToCopy];
  while (queue.length > 0) {
    const current = queue.shift()!;

    // Find children of current element
    for (const element of elementsMap.values()) {
      if (
        element.parent_id === current.id &&
        !allElementsIncludingDescendants.has(element)
      ) {
        allElementsIncludingDescendants.add(element);
        queue.push(element);
      }
    }
  }

  return {
    elements: Array.from(allElementsIncludingDescendants),
    rootIds,
    externalParents,
    timestamp: Date.now(),
  };
}

/**
 * Paste copied elements with new IDs and optional offset
 *
 * @param copiedData - Data from copyMultipleElements
 * @param currentPageId - Current page ID
 * @param offset - Optional offset for positioning (default: 10px)
 * @returns New elements with updated IDs and relationships
 */
export function pasteMultipleElements(
  copiedData: CopiedElementsData,
  currentPageId: string,
  offset: { x: number; y: number } = { x: 10, y: 10 },
  existingElements: Element[] = [],
  options: PasteMultipleElementsOptions = {},
): Element[] {
  if (copiedData.elements.length === 0) {
    return [];
  }

  const shouldUseTargetParent = hasExplicitTargetParent(options);
  const targetParentId = options.targetParentId ?? null;

  const reusableOrigin = getReusableOriginRoot(copiedData);
  if (reusableOrigin) {
    const instanceElement = withFreshCustomId(
      {
        id: ElementUtils.generateId(),
        type: "ref",
        ref: reusableOrigin.id,
        [COMPONENT_ROLE_MIRROR_FIELD]: "instance",
        [COMPONENT_MASTER_ID_MIRROR_FIELD]: reusableOrigin.id,
        parent_id: shouldUseTargetParent
          ? targetParentId
          : (reusableOrigin.parent_id ?? null),
        page_id: currentPageId,
        props: createRefOverrideProps(reusableOrigin, offset),
        componentName: reusableOrigin.componentName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Element,
      existingElements,
      getCustomIdGenerationBase(reusableOrigin, existingElements),
    );
    return [
      normalizeExternalFillIngress(
        withFrameElementMirrorId(
          instanceElement,
          getFrameElementMirrorId(reusableOrigin),
        ),
      ),
    ];
  }

  // Create ID mapping: old ID → new ID
  const idMap = new Map<string, string>();
  copiedData.elements.forEach((element) => {
    idMap.set(element.id, ElementUtils.generateId());
  });

  // Create new elements with updated IDs and relationships
  const allocatedElements = [...existingElements];
  const newElements: Element[] = copiedData.elements.map((element) => {
    const newId = idMap.get(element.id)!;

    // Determine new parent_id
    let newParentId: string | null = null;

    if (element.parent_id) {
      if (idMap.has(element.parent_id)) {
        // Parent was also copied → use new parent ID
        newParentId = idMap.get(element.parent_id)!;
      } else if (
        shouldUseTargetParent &&
        copiedData.rootIds.includes(element.id)
      ) {
        // Cross-target paste → selected page/container becomes the new parent.
        newParentId = targetParentId;
      } else {
        // Parent was NOT copied → use original parent (external parent)
        newParentId = element.parent_id;
      }
    } else if (
      shouldUseTargetParent &&
      copiedData.rootIds.includes(element.id)
    ) {
      newParentId = targetParentId;
    }

    // Apply offset to position/style if element is a root element
    let updatedProps = { ...element.props };

    if (copiedData.rootIds.includes(element.id)) {
      // Apply offset to root elements
      const currentStyle = (element.props.style || {}) as Record<
        string,
        unknown
      >;

      const left = parsePixels(currentStyle.left);
      const top = parsePixels(currentStyle.top);

      updatedProps = {
        ...updatedProps,
        style: {
          ...currentStyle,
          left: `${left + offset.x}px`,
          top: `${top + offset.y}px`,
        },
      };
    }

    const newElement = normalizeExternalFillIngress(
      withFreshCustomId(
        {
          ...element,
          id: newId,
          parent_id: newParentId,
          page_id: currentPageId,
          props: updatedProps,
          // Reset timestamps
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        allocatedElements,
        getCustomIdGenerationBase(element, allocatedElements),
      ),
    );
    allocatedElements.push(newElement);
    return newElement;
  });

  return newElements;
}

/**
 * Serialize copied elements to clipboard-safe JSON
 *
 * @param copiedData - Data from copyMultipleElements
 * @returns JSON string with magic prefix
 */
export function serializeCopiedElements(
  copiedData: CopiedElementsData,
): string {
  // Convert Map to array for JSON serialization
  const serializable = {
    __composition_elements__: true, // Magic marker for validation
    version: 1,
    elements: copiedData.elements,
    rootIds: copiedData.rootIds,
    externalParents: Array.from(copiedData.externalParents.entries()),
    timestamp: copiedData.timestamp,
  };

  return JSON.stringify(serializable);
}

/**
 * Deserialize clipboard JSON to CopiedElementsData
 *
 * @param json - JSON string from clipboard
 * @returns CopiedElementsData or null if invalid
 */
export function deserializeCopiedElements(
  json: string,
): CopiedElementsData | null {
  // Quick check: does it look like JSON?
  if (!json || typeof json !== "string" || !json.trim().startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(json);

    // Validate magic marker
    if (!parsed.__composition_elements__) {
      // Not our clipboard data - silently ignore
      return null;
    }

    // Validate structure
    if (!parsed.elements || !Array.isArray(parsed.elements)) {
      console.warn(
        "[Paste] Invalid clipboard data structure - missing elements array",
      );
      return null;
    }

    if (parsed.elements.length === 0) {
      console.warn("[Paste] Clipboard data contains no elements");
      return null;
    }

    return {
      elements: parsed.elements,
      rootIds: parsed.rootIds || [],
      externalParents: new Map(parsed.externalParents || []),
      timestamp: parsed.timestamp || Date.now(),
    };
  } catch {
    // Not valid JSON or not our format - silently ignore
    // This is expected when clipboard contains regular text
    return null;
  }
}
