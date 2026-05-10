/**
 * Element Distribution Utilities
 * Phase 5: Alignment & Distribution - Element Distribution
 *
 * Utilities for distributing multiple selected elements with even spacing
 */

/**
 * Distribution type
 */
export type DistributionType =
  | "horizontal" // Distribute horizontally with even spacing
  | "vertical"; // Distribute vertically with even spacing

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
 * Distribution result with element ID and new style
 */
export interface DistributionUpdate {
  id: string;
  style: {
    left?: string;
    top?: string;
  };
}

export interface DistributableElementNode {
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
 * Collect element bounds from elements
 *
 * @param elements - Elements to distribute
 * @returns Array of element bounds
 */
function collectElementBounds(
  elements: readonly DistributableElementNode[],
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
 * Distribute elements horizontally with even spacing
 *
 * @param bounds - Array of element bounds (will be sorted by position)
 * @returns Array of distribution updates
 */
function distributeHorizontally(bounds: ElementBounds[]): DistributionUpdate[] {
  if (bounds.length < 3) {
    console.warn("[Distribution] Need at least 3 elements to distribute");
    return [];
  }

  // Sort by left position
  const sorted = [...bounds].sort((a, b) => a.left - b.left);

  // First and last elements stay in place
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  // Calculate total width of all elements
  const totalWidth = sorted.reduce((sum, b) => sum + b.width, 0);

  // Calculate available space between first and last
  const start = first.left;
  const end = last.left + last.width;
  const availableSpace = end - start - totalWidth;

  // Calculate even spacing
  const spacing = availableSpace / (sorted.length - 1);

  // Generate updates (skip first and last)
  const updates: DistributionUpdate[] = [];
  let currentPos = start;

  sorted.forEach((b, index) => {
    if (index === 0) {
      // First element stays in place
      currentPos += b.width;
      return;
    }

    if (index === sorted.length - 1) {
      // Last element stays in place
      return;
    }

    // Calculate new position with even spacing
    currentPos += spacing;

    updates.push({
      id: b.id,
      style: {
        left: `${currentPos}px`,
      },
    });

    currentPos += b.width;
  });

  return updates;
}

/**
 * Distribute elements vertically with even spacing
 *
 * @param bounds - Array of element bounds (will be sorted by position)
 * @returns Array of distribution updates
 */
function distributeVertically(bounds: ElementBounds[]): DistributionUpdate[] {
  if (bounds.length < 3) {
    console.warn("[Distribution] Need at least 3 elements to distribute");
    return [];
  }

  // Sort by top position
  const sorted = [...bounds].sort((a, b) => a.top - b.top);

  // First and last elements stay in place
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  // Calculate total height of all elements
  const totalHeight = sorted.reduce((sum, b) => sum + b.height, 0);

  // Calculate available space between first and last
  const start = first.top;
  const end = last.top + last.height;
  const availableSpace = end - start - totalHeight;

  // Calculate even spacing
  const spacing = availableSpace / (sorted.length - 1);

  // Generate updates (skip first and last)
  const updates: DistributionUpdate[] = [];
  let currentPos = start;

  sorted.forEach((b, index) => {
    if (index === 0) {
      // First element stays in place
      currentPos += b.height;
      return;
    }

    if (index === sorted.length - 1) {
      // Last element stays in place
      return;
    }

    // Calculate new position with even spacing
    currentPos += spacing;

    updates.push({
      id: b.id,
      style: {
        top: `${currentPos}px`,
      },
    });

    currentPos += b.height;
  });

  return updates;
}

/**
 * Distribute elements with even spacing
 *
 * @param elementIds - IDs of elements to distribute
 * @param elementsMap - Map of all elements
 * @param type - Distribution type (horizontal or vertical)
 * @returns Array of distribution updates
 *
 * @example
 * ```ts
 * // Distribute 5 elements horizontally with even spacing
 * const updates = distributeElements(
 *   ['elem-1', 'elem-2', 'elem-3', 'elem-4', 'elem-5'],
 *   elementsMap,
 *   'horizontal'
 * );
 * // First and last elements stay in place
 * // Middle 3 elements repositioned with even spacing
 * ```
 */
export function distributeElements(
  elementIds: readonly string[],
  elementsMap: ReadonlyMap<string, DistributableElementNode>,
  type: DistributionType,
): DistributionUpdate[] {
  if (elementIds.length < 3) {
    console.warn("[Distribution] Need at least 3 elements to distribute");
    return [];
  }

  // Get elements
  const elements = elementIds
    .map((id) => elementsMap.get(id))
    .filter((el): el is DistributableElementNode => el !== undefined);

  if (elements.length < 3) {
    console.warn("[Distribution] Not enough valid elements to distribute");
    return [];
  }

  // Collect bounds
  const bounds = collectElementBounds(elements);

  if (bounds.length < 3) {
    console.warn(
      "[Distribution] Elements missing position/size properties, cannot distribute",
    );
    return [];
  }

  // Distribute based on type
  const updates =
    type === "horizontal"
      ? distributeHorizontally(bounds)
      : distributeVertically(bounds);

  console.log(
    `✅ [Distribution] Distributed ${updates.length} elements ${type}ly`,
  );

  return updates;
}

/**
 * Get distribution description for UI
 *
 * @param type - Distribution type
 * @returns Human-readable description
 */
export function getDistributionDescription(type: DistributionType): string {
  const descriptions: Record<DistributionType, string> = {
    horizontal: "수평 균등 분산",
    vertical: "수직 균등 분산",
  };

  return descriptions[type];
}
