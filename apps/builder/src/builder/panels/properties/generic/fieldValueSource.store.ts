/**
 * ADR-248 Phase 4e-7: the old canonical store as the field value source — what the generic field
 * renderer read without a provider before 4e-7. Old-store tests import this module (it registers
 * itself as the test fallback); it goes with the old store.
 */
import {
  useCanonicalPropertyValue,
  useCanonicalPropertyValuesSnapshot,
} from "../hooks/useCanonicalPropertyRead";
import { useOwnerCollectionFields } from "../hooks/useOwnerCollectionColumns.legacy";
import { useVisibleVariableNames } from "../hooks/useVisibleVariableNames.legacy";
import {
  setFieldValueSourceTestFallback,
  type FieldValueSource,
} from "./fieldValueSource";

export const STORE_FIELD_VALUE_SOURCE: FieldValueSource = {
  useValue: useCanonicalPropertyValue,
  useValuesSnapshot: useCanonicalPropertyValuesSnapshot,
  useOwnerFields: useOwnerCollectionFields,
  useVariableNames: useVisibleVariableNames,
};

setFieldValueSourceTestFallback(STORE_FIELD_VALUE_SOURCE);
