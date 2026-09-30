import { createContext, useContext } from "react";
import type { FieldOrigin } from "@composition/shared";
import {
  useCanonicalPropertyValue,
  useCanonicalPropertyValuesSnapshot,
} from "../hooks/useCanonicalPropertyRead";

/**
 * Where the generic field renderer reads a field's shown value. Each function is a hook (it
 * subscribes to one value). The default is the old canonical store; the catalog Properties panel
 * (ADR-248 Phase 4e-4) provides the read model's prop sources, so the renderer itself is shared.
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
}

const CANONICAL_SOURCE: FieldValueSource = {
  useValue: useCanonicalPropertyValue,
  useValuesSnapshot: useCanonicalPropertyValuesSnapshot,
};

export const FieldValueSourceContext =
  createContext<FieldValueSource>(CANONICAL_SOURCE);

export function useFieldValue(
  elementId: string | null | undefined,
  origin: FieldOrigin,
  key: string,
  baseValue: unknown,
): unknown {
  return useContext(FieldValueSourceContext).useValue(
    elementId,
    origin,
    key,
    baseValue,
  );
}

export function useFieldValuesSnapshot(
  elementId: string | null | undefined,
  origin: FieldOrigin,
  keys: readonly string[],
  baseValues: readonly unknown[],
): string {
  return useContext(FieldValueSourceContext).useValuesSnapshot(
    elementId,
    origin,
    keys,
    baseValues,
  );
}
