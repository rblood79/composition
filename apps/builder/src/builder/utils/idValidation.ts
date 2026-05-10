interface CustomIdValidationNode {
  id: string;
  customId?: string | null;
}

/**
 * Validates if a custom ID follows HTML ID rules
 *
 * Rules:
 * - Must start with a letter (a-z, A-Z)
 * - Can contain letters, digits, hyphens, underscores, periods
 * - No spaces or special characters
 *
 * @param customId - The custom ID to validate
 * @returns True if valid, false otherwise
 */
export function isValidHtmlId(customId: string): boolean {
  if (!customId || customId.trim() === "") {
    return false;
  }

  // HTML ID must start with a letter
  const htmlIdPattern = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
  return htmlIdPattern.test(customId);
}

/**
 * Checks if a custom ID is unique within the current page
 *
 * @param customId - The custom ID to check
 * @param currentElementId - The ID of the element being edited (to exclude from check)
 * @param pageElements - All elements in the current page
 * @returns True if unique, false if duplicate found
 */
export function isUniqueCustomId(
  customId: string,
  currentElementId: string,
  pageElements: readonly CustomIdValidationNode[],
): boolean {
  if (!customId || customId.trim() === "") {
    return true; // Empty customId is allowed (optional field)
  }

  // Check if any other element has the same customId
  return !pageElements.some(
    (el) => el.customId === customId && el.id !== currentElementId, // Exclude current element
  );
}

/**
 * Validates custom ID with detailed error messages
 *
 * @param customId - The custom ID to validate
 * @param currentElementId - The ID of the element being edited
 * @param pageElements - All elements in the current page
 * @returns Object with validation result and error message
 */
export function validateCustomId(
  customId: string,
  currentElementId: string,
  pageElements: readonly CustomIdValidationNode[],
): { isValid: boolean; error?: string } {
  // Allow empty customId (optional field)
  if (!customId || customId.trim() === "") {
    return { isValid: true };
  }

  // Check HTML ID format
  if (!isValidHtmlId(customId)) {
    return {
      isValid: false,
      error:
        "Invalid ID format. Must start with a letter and contain only letters, numbers, hyphens, and underscores.",
    };
  }

  // Check uniqueness
  if (!isUniqueCustomId(customId, currentElementId, pageElements)) {
    return {
      isValid: false,
      error: `ID "${customId}" is already in use. Please choose a unique ID.`,
    };
  }

  return { isValid: true };
}
