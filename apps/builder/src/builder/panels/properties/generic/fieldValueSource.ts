import { createContext, useContext } from "react";
import type { FieldOrigin } from "@composition/shared";
import type { OwnerField } from "../hooks/useOwnerCollectionColumns";
import { useProjectVariableNames } from "../hooks/useVisibleVariableNames";

/**
 * Where the generic field renderer reads a field's shown value. Each function is a hook (it
 * subscribes to one value). The catalog Properties panel (ADR-248 Phase 4e-4) provides the read
 * model's prop sources, so the renderer itself is shared. 4e-7: no default — the old canonical
 * store's source is `fieldValueSource.store.ts` (old-store tests only).
 */
export interface FieldValueSource {
  useValue(
    elementId: string | null | undefined,
    origin: FieldOrigin,
    key: string,
    baseValue: unknown,
  ): unknown;
  /** Several keys as one JSON snapshot (a chip group writes N props). */
  useValuesSnapshot(
    elementId: string | null | undefined,
    origin: FieldOrigin,
    keys: readonly string[],
    baseValues: readonly unknown[],
  ): string;
  /**
   * The fields of the collection that owns the element (`{field}` templates) — a hook; absent =
   * none (the catalog source has none yet).
   */
  useOwnerFields?(elementId: string | undefined): OwnerField[] | null;
  /**
   * The variable names visible at the element (`{{` autocompletion) — a hook; absent = the project
   * variables only (the catalog source has no page / element variables here yet).
   */
  useVariableNames?(elementId: string | undefined): readonly string[];
}

export const FieldValueSourceContext = createContext<FieldValueSource | null>(
  null,
);

/** Old-store tests only (`fieldValueSource.store.ts`, removed with the old store): the source without a provider. */
let testFallback: FieldValueSource | null = null;
export function setFieldValueSourceTestFallback(
  source: FieldValueSource | null,
): void {
  testFallback = source;
}

function useFieldValueSource(): FieldValueSource {
  const source = useContext(FieldValueSourceContext) ?? testFallback;
  if (!source) throw new Error("Field value source is not provided");
  return source;
}

export function useFieldValue(
  elementId: string | null | undefined,
  origin: FieldOrigin,
  key: string,
  baseValue: unknown,
): unknown {
  return useFieldValueSource().useValue(elementId, origin, key, baseValue);
}

export function useFieldValuesSnapshot(
  elementId: string | null | undefined,
  origin: FieldOrigin,
  keys: readonly string[],
  baseValues: readonly unknown[],
): string {
  return useFieldValueSource().useValuesSnapshot(
    elementId,
    origin,
    keys,
    baseValues,
  );
}

/** The owning collection's fields of an element (`{field}` templates); null = none. */
export function useFieldOwnerFields(
  elementId: string | undefined,
): OwnerField[] | null {
  const source = useFieldValueSource();
  // A source's hook set does not change while it is provided (one provider per panel).
  return source.useOwnerFields ? source.useOwnerFields(elementId) : null;
}

/** The variable names a string field autocompletes (`{{`). */
export function useFieldVariableNames(
  elementId: string | undefined,
): readonly string[] {
  const source = useFieldValueSource();
  // A source's hook set does not change while it is provided (one provider per panel).
  return source.useVariableNames
    ? source.useVariableNames(elementId)
    : // eslint-disable-next-line react-hooks/rules-of-hooks -- fixed per provider
      useProjectVariableNames();
}
