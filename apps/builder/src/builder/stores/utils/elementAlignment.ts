/**
 * Element Alignment Utilities
 * Phase 5: Alignment & Distribution - Element Alignment
 *
 * Utilities for aligning multiple selected elements
 */

/**
 * Alignment type
 */
export type AlignmentType =
  | "left" // Align to leftmost element
  | "center" // Align to horizontal center (average)
  | "right" // Align to rightmost element
  | "top" // Align to topmost element
  | "middle" // Align to vertical middle (average)
  | "bottom"; // Align to bottommost element

/**
 * Element bounds with position and size
 */
export interface ElementBounds {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Alignment result with element ID and new style
 */
export interface AlignmentUpdate {
  id: string;
  style: {
    left?: string;
    top?: string;
  };
}

export interface AlignableElementNode {
  readonly id: string;
  readonly props: {
    readonly style?: unknown;
  };
}

/**
 * Parse pixel value from CSS style
 *
 * @param value - CSS value (e.g., "100px", 100)
 * @returns Numeric pixel value or null if invalid
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
 * Calculate alignment target position
 *
 * @param bounds - Array of element bounds
 * @param type - Alignment type
 * @returns Target position (px)
 */
function calculateAlignmentTarget(
  bounds: ElementBounds[],
  type: AlignmentType,
): number {
  switch (type) {
    case "left":
      // Leftmost element's left edge
      return Math.min(...bounds.map((b) => b.left));

    case "right":
      // Rightmost element's right edge
      return Math.max(...bounds.map((b) => b.left + b.width));

    case "center": {
      // Average horizontal center
      const centers = bounds.map((b) => b.left + b.width / 2);
      return centers.reduce((sum, c) => sum + c, 0) / centers.length;
    }

    case "top":
      // Topmost element's top edge
      return Math.min(...bounds.map((b) => b.top));

    case "bottom":
      // Bottommost element's bottom edge
      return Math.max(...bounds.map((b) => b.top + b.height));

    case "middle": {
      // Average vertical middle
      const middles = bounds.map((b) => b.top + b.height / 2);
      return middles.reduce((sum, m) => sum + m, 0) / middles.length;
    }
  }
}

/**
 * Collect element bounds from elements
 *
 * @param elements - Elements to align
 * @returns Array of element bounds
 */
function collectElementBounds(
  elements: readonly AlignableElementNode[],
): ElementBounds[] {
  return elements
    .map((el) => {
      const style = (el.props.style || {}) as Record<string, unknown>;

      const left = parsePixels(style.left);
      const top = parsePixels(style.top);
      const width = parsePixels(style.width);
      const height = parsePixels(style.height);

      // Skip elements without position/size
      if (left === null || top === null || width === null || height === null) {
        return null;
      }

      return {
        id: el.id,
        left,
        top,
        width,
        height,
      };
    })
    .filter((b): b is ElementBounds => b !== null);
}

/**
 * Align elements to a specific edge or center
 *
 * @param elementIds - IDs of elements to align
 * @param elementsMap - Map of all elements
 * @param type - Alignment type
 * @returns Array of alignment updates
 *
 * @example
 * ```ts
 * // Align 3 elements to left edge
 * const updates = alignElements(
 *   ['elem-1', 'elem-2', 'elem-3'],
 *   elementsMap,
 *   'left'
 * );
 * // Returns: [
 * //   { id: 'elem-1', style: { left: '100px' } },
 * //   { id: 'elem-2', style: { left: '100px' } },
 * //   { id: 'elem-3', style: { left: '100px' } }
 * // ]
 * ```
 */
export function alignElements(
  elementIds: readonly string[],
  elementsMap: ReadonlyMap<string, AlignableElementNode>,
  type: AlignmentType,
): AlignmentUpdate[] {
  if (elementIds.length < 2) {
    console.warn("[Alignment] Need at least 2 elements to align");
    return [];
  }

  // Get elements
  const elements = elementIds
    .map((id) => elementsMap.get(id))
    .filter((el): el is AlignableElementNode => el !== undefined);

  if (elements.length < 2) {
    console.warn("[Alignment] Not enough valid elements to align");
    return [];
  }

  // Collect bounds
  const bounds = collectElementBounds(elements);

  if (bounds.length < 2) {
    console.warn(
      "[Alignment] Elements missing position/size properties, cannot align",
    );
    return [];
  }

  // Calculate target position
  const target = calculateAlignmentTarget(bounds, type);

  // Generate updates
  const updates: AlignmentUpdate[] = bounds.map((b) => {
    let newLeft = b.left;
    let newTop = b.top;

    switch (type) {
      case "left":
        newLeft = target;
        break;
      case "right":
        newLeft = target - b.width;
        break;
      case "center":
        newLeft = target - b.width / 2;
        break;
      case "top":
        newTop = target;
        break;
      case "bottom":
        newTop = target - b.height;
        break;
      case "middle":
        newTop = target - b.height / 2;
        break;
    }

    return {
      id: b.id,
      style: {
        ...(type === "left" || type === "center" || type === "right"
          ? { left: `${newLeft}px` }
          : {}),
        ...(type === "top" || type === "middle" || type === "bottom"
          ? { top: `${newTop}px` }
          : {}),
      },
    };
  });

  console.log(`✅ [Alignment] Aligned ${updates.length} elements to ${type}`);

  return updates;
}

/**
 * Get alignment description for UI
 *
 * @param type - Alignment type
 * @returns Human-readable description
 */
export function getAlignmentDescription(type: AlignmentType): string {
  const descriptions: Record<AlignmentType, string> = {
    left: "왼쪽 정렬",
    center: "수평 중앙 정렬",
    right: "오른쪽 정렬",
    top: "상단 정렬",
    middle: "수직 중앙 정렬",
    bottom: "하단 정렬",
  };

  return descriptions[type];
}
