import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { FieldOrigin } from "@composition/shared";
import type { EditTarget } from "../../../../../../../packages/shared/src/catalog/document/types";
import { useCatalogWorkspace } from "../../../catalogRuntime/react";
import { targetKey } from "../../../catalogRuntime/session";
import type { FieldValueSource } from "../generic/fieldValueSource";

const noSubscription = () => () => {};

/** The edit target of a drawn record (the panel's `elementId` is the record identity). */
function useRecordTarget(identity: string | null | undefined) {
  const workspace = useCatalogWorkspace();
  return useMemo(
    () => (identity ? workspace.itemOfRecord(identity)?.target : undefined),
    [identity, workspace],
  );
}

function useSourcedValues(
  target: EditTarget | undefined,
  keys: readonly string[],
  baseValues: readonly unknown[],
): string {
  const { readModel } = useCatalogWorkspace();
  const id = target ? targetKey(target) : "";
  const keysId = keys.join("|");
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!target) return noSubscription();
      const unsubscribe = keys.map((key) =>
        readModel.subscribePropSource(target, key, notify),
      );
      return () => unsubscribe.forEach((stop) => stop());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the target and keys
    [readModel, id, keysId],
  );
  return useSyncExternalStore(subscribe, () =>
    JSON.stringify(
      keys.map((key, index) =>
        target
          ? (readModel.propSource(target, key).value ?? baseValues[index])
          : baseValues[index],
      ),
    ),
  );
}

/**
 * ADR-248 Phase 4e-4: the generic field renderer's values from the read model — each field
 * subscribes to its own prop source (a change elsewhere re-renders nothing). The `elementId` the
 * renderer passes is the selected record identity.
 */
export const CATALOG_FIELD_VALUE_SOURCE: FieldValueSource = {
  useValue(elementId, _origin: FieldOrigin, key, baseValue) {
    const { readModel } = useCatalogWorkspace();
    const target = useRecordTarget(elementId);
    const id = target ? targetKey(target) : "";
    const subscribe = useCallback(
      (notify: () => void) =>
        target
          ? readModel.subscribePropSource(target, key, notify)
          : noSubscription(),
      // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the target
      [readModel, id, key],
    );
    // The cached reading keeps its value object until the value changes.
    return useSyncExternalStore(subscribe, () =>
      target
        ? (readModel.propSource(target, key).value ?? baseValue)
        : baseValue,
    );
  },
  useValuesSnapshot(elementId, _origin, keys, baseValues) {
    return useSourcedValues(useRecordTarget(elementId), keys, baseValues);
  },
};
