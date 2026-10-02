import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { FieldOrigin } from "@composition/shared";
import type { EditTarget } from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogBindingValue,
  catalogTargetBinding,
} from "../../../catalogRuntime/dataBinding";
import { useCatalogWorkspace } from "../../../catalogRuntime/react";
import { catalogRowTemplateOwner } from "../../../catalogRuntime/rowTemplate";
import { targetKey } from "../../../catalogRuntime/session";
import { catalogVisibleVariableEntries } from "../../../catalogRuntime/stateVariables";
import { useCollections } from "../../../stores/data";
import type { FieldValueSource } from "../generic/fieldValueSource";
import { fieldsFromOwner } from "../hooks/useOwnerCollectionColumns";
import {
  useProjectVariableNames,
  useStableNames,
} from "../hooks/useVisibleVariableNames";

const noSubscription = () => () => {};

/** The edit target of a drawn record (the panel's `elementId` is the record identity). */
function useRecordTarget(identity: string | null | undefined) {
  const workspace = useCatalogWorkspace();
  return useMemo(
    () => (identity ? workspace.itemOfRecord(identity)?.target : undefined),
    [identity, workspace],
  );
}

/**
 * The data binding field (`dataBinding`) reads the node's typed binding, not a prop (ADR-248
 * 4e-4e — the catalog document has no `dataBinding` prop).
 */
const BINDING_KEY = "dataBinding";
const readValue = (
  readModel: ReturnType<typeof useCatalogWorkspace>["readModel"],
  target: EditTarget,
  key: string,
) =>
  key === BINDING_KEY
    ? readModel.bindingValue(target)
    : readModel.propSource(target, key).value;
const subscribeValue = (
  readModel: ReturnType<typeof useCatalogWorkspace>["readModel"],
  target: EditTarget,
  key: string,
  notify: () => void,
) =>
  key === BINDING_KEY
    ? readModel.subscribeBinding(target, notify)
    : readModel.subscribePropSource(target, key, notify);

/** A document reading kept while its JSON is the same (re-read after each step). */
function useStepReading<T>(read: () => T): T {
  const { runtime } = useCatalogWorkspace();
  const subscribe = useCallback(
    (notify: () => void) => runtime.subscribeSteps(() => notify()),
    [runtime],
  );
  const key = useSyncExternalStore(subscribe, () => JSON.stringify(read()));
  return useMemo(() => JSON.parse(key ?? "null") as T, [key]);
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
        subscribeValue(readModel, target, key, notify),
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
          ? (readValue(readModel, target, key) ?? baseValues[index])
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
          ? subscribeValue(readModel, target, key, notify)
          : noSubscription(),
      // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the target
      [readModel, id, key],
    );
    // The cached reading keeps its value object until the value changes.
    return useSyncExternalStore(subscribe, () =>
      target ? (readValue(readModel, target, key) ?? baseValue) : baseValue,
    );
  },
  useValuesSnapshot(elementId, _origin, keys, baseValues) {
    return useSourcedValues(useRecordTarget(elementId), keys, baseValues);
  },
  /**
   * `{field}` templates: inside a bound collection's row template, the bound collection's fields
   * (the old owner lookup's binding source; the rows read the template's value).
   */
  useOwnerFields(elementId) {
    const { runtime } = useCatalogWorkspace();
    const target = useRecordTarget(elementId);
    const collections = useCollections();
    const binding = useStepReading(() => {
      const ownerId = target
        ? catalogRowTemplateOwner(runtime.graph, target)
        : undefined;
      return ownerId
        ? (catalogBindingValue(
            catalogTargetBinding(runtime.graph, { kind: "node", id: ownerId }),
          ) ?? null)
        : null;
    });
    return useMemo(
      () =>
        binding
          ? fieldsFromOwner({ props: { dataBinding: binding } }, collections)
          : null,
      [binding, collections],
    );
  },
  /**
   * `{{` autocompletion: the variables the element sees — its own and its ancestors' (an instance
   * descendant: its instance's), its page's, then the project's.
   */
  useVariableNames(elementId) {
    const { runtime } = useCatalogWorkspace();
    const target = useRecordTarget(elementId);
    const scoped = useStepReading(() => {
      if (!target) return [];
      try {
        return catalogVisibleVariableEntries(
          runtime.graph,
          target.kind === "node" ? target.id : target.ownerId,
        ).map((variable) => variable.name);
      } catch {
        return [];
      }
    });
    const project = useProjectVariableNames();
    const names = useMemo(() => {
      const out: string[] = [];
      for (const name of [...scoped, ...project])
        if (!out.includes(name)) out.push(name);
      return out;
    }, [scoped, project]);
    return useStableNames(names);
  },
};
