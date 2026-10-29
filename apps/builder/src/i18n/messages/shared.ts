/**
 * Per-locale message modules — shared types and the catalog flattener.
 *
 * Each locale lives in its own module (`ko-KR.ts` · `en-US.ts`) so the Builder loads only the
 * active language: `../loadMessages.ts` imports them dynamically (one chunk per locale). The
 * eager two-locale view (`../translations.ts`) is for tests and tooling only — app code never
 * imports it (`localeSplit.static.test.ts`).
 */
import type { TranslationKeys } from "../types";

export type FormatterVariables = Record<string, string | number | boolean>;
export type LocalizedMessage =
  string | ((args: FormatterVariables | undefined) => string);
/** The flat dictionary React Aria's `useLocalizedStringFormatter` reads for one locale. */
export type LocaleStrings = Record<string, LocalizedMessage>;

export interface LocaleMessages {
  /** The nested catalog (`TranslationKeys`) — data-driven consumers read groups from it. */
  catalog: TranslationKeys;
  /** catalog flattened to dot keys + semantic labels + parameterized (function) messages. */
  strings: LocaleStrings;
}

/**
 * Flatten the nested application catalog for React Aria's string formatter (dot-separated keys).
 */
export function flattenTranslationCatalog(
  value: unknown,
  prefix = "",
  result: Record<string, string> = {},
): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return result;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const messageKey = prefix ? `${prefix}.${key}` : key;

    if (typeof nestedValue === "string") {
      result[messageKey] = nestedValue;
    } else {
      flattenTranslationCatalog(nestedValue, messageKey, result);
    }
  }

  return result;
}
