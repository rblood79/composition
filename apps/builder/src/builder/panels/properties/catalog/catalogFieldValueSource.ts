import {
  isRichText,
  richTextPlain,
} from "../../../../../../../packages/shared/src/catalog/document/textRuns";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { FieldOrigin } from "@composition/shared";
import type { EditTarget } from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  catalogBindingValue,
  catalogTargetBinding,
} from "../../../catalogRuntime/dataBinding";
import {
  useCatalogStepReading,
  useCatalogWorkspace,
} from "../../../catalogRuntime/react";
import { catalogRowTemplateOwner } from "../../../catalogRuntime/rowTemplate";
import { targetKey } from "../../../catalogRuntime/session";
import { catalogPickerSelectionOwner } from "../../../catalogRuntime/singleSelection";
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
function useRecordTarget(identity: string | null | undefined, key?: string) {
  const workspace = useCatalogWorkspace();
  return useMemo(() => {
    const owner =
      identity && key === "isSelected"
        ? catalogPickerSelectionOwner(workspace, identity)
        : undefined;
    return identity
      ? workspace.itemOfRecord(owner?.id ?? identity)?.target
      : undefined;
  }, [identity, workspace, key]);
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
    : plainText(readModel.propSource(target, key).value);
/**
 * ADR-299 — a range-formatted text shows as its plain text in a Properties text field (a string
 * written from there replaces the runs — Decision 6 「문자열 쓰기 = 서식 초기화」; ranges are the
 * editor's and the Typography section's).
 */
const plainText = (value: unknown) =>
  isRichText(value) ? richTextPlain(value) : value;
const subscribeValue = (
  readModel: ReturnType<typeof useCatalogWorkspace>["readModel"],
  target: EditTarget,
  key: string,
  notify: () => void,
) =>
  key === BINDING_KEY
    ? readModel.subscribeBinding(target, notify)
    : readModel.subscribePropSource(target, key, notify);

function useSourcedValues(
  identity: string | null | undefined,
  keys: readonly string[],
  baseValues: readonly unknown[],
): string {
  const { readModel } = useCatalogWorkspace();
  const target = useRecordTarget(identity);
  // (Selected is the option's for a picker's selection Checkbox — `useRecordTarget`)
  const selected = useRecordTarget(identity, "isSelected");
  const targetOf = (key: string, own: EditTarget) =>
    key === "isSelected" ? (selected ?? own) : own;
  const id = target ? targetKey(target) : "";
  const selectedId = selected ? targetKey(selected) : "";
  const keysId = keys.join("|");
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!target) return noSubscription();
      const unsubscribe = keys.map((key) =>
        subscribeValue(readModel, targetOf(key, target), key, notify),
      );
      return () => unsubscribe.forEach((stop) => stop());
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the targets and keys
    [readModel, id, selectedId, keysId],
  );
  return useSyncExternalStore(subscribe, () =>
    JSON.stringify(
      keys.map((key, index) =>
        target
          ? (readValue(readModel, targetOf(key, target), key) ??
            baseValues[index])
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
    const target = useRecordTarget(elementId, key);
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
    return useSourcedValues(elementId, keys, baseValues);
  },
  /**
   * `{field}` templates: inside a bound collection's row template, the bound collection's fields
   * (the old owner lookup's binding source; the rows read the template's value).
   */
  useOwnerFields(elementId) {
    const workspace = useCatalogWorkspace();
    const { runtime } = workspace;
    const target = useRecordTarget(elementId);
    const collections = useCollections();
    const binding = useCatalogStepReading(workspace, () => {
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
    const workspace = useCatalogWorkspace();
    const { runtime } = workspace;
    const target = useRecordTarget(elementId);
    const scoped = useCatalogStepReading(workspace, () => {
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
  /** A followed variable's name (a document state variable — the filter's · 「변수로 정하기」's). */
  useVariableName(ref) {
    const workspace = useCatalogWorkspace();
    const { runtime } = workspace;
    const id = ref.slice("!var.".length).split(".")[0] ?? "";
    return (
      useCatalogStepReading(workspace, () => {
        const entry = runtime.graph.getEntry(id as never);
        return entry?.kind === "stateVariable" ? entry.name : null;
      }) ?? undefined
    );
  },
};
