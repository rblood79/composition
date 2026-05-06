import type { Element } from "../../types/builder/unified.types";

const CUSTOM_ID_BASE_PATTERN = /^([a-zA-Z][a-zA-Z0-9-]*)_\d+$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeCustomIdBase(value: string): string {
  return value.toLowerCase();
}

export function getCustomIdBase(customId: string | undefined): string | null {
  if (!customId) return null;
  const match = customId.match(CUSTOM_ID_BASE_PATTERN);
  return match ? match[1] : null;
}

/**
 * Generates a unique custom ID for a component based on its type
 * Format: {type}_{number} (e.g., button_1, select_2, textfield_3)
 *
 * @param type - Component type name (e.g., "Button", "Select")
 * @param pageElements - All elements in the current page
 * @returns Generated custom ID (e.g., "button_1")
 */
export function generateCustomId(
  type: string,
  pageElements: Element[],
): string {
  // Convert type to lowercase for ID format
  const tagLower = normalizeCustomIdBase(type);

  // Extract existing numbers from customIds
  const existingNumbers: number[] = [];
  const idPattern = new RegExp(`^${escapeRegExp(tagLower)}_(\\d+)$`);

  pageElements.forEach((el) => {
    if (el.customId) {
      const match = el.customId.match(idPattern);
      if (match) {
        existingNumbers.push(Number.parseInt(match[1], 10));
      }
    }
  });

  // Find the next available number
  let nextNumber = 1;
  if (existingNumbers.length > 0) {
    // Sort numbers and find the first gap, or use max + 1
    existingNumbers.sort((a, b) => a - b);

    // Find first gap in sequence
    for (let i = 0; i < existingNumbers.length; i++) {
      if (existingNumbers[i] !== i + 1) {
        nextNumber = i + 1;
        break;
      }
    }

    // If no gap found, use max + 1
    if (nextNumber === 1 && existingNumbers.length > 0) {
      nextNumber = Math.max(...existingNumbers) + 1;
    }
  }

  return `${tagLower}_${nextNumber}`;
}
