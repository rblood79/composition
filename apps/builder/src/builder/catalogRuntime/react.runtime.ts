import { docCounters } from "../../../../../packages/shared/src/catalog/docCounters";
import type { EditContract } from "@composition/shared";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

import type {
  EditTarget,
  EntryId,
  NodeMetadata,
  PageEntry,
} from "../../../../../packages/shared/src/catalog/document/types";

import type { CatalogPosition } from "../../../../../packages/shared/src/catalog/resolution/positions";

import type { CatalogSaveStatus } from "./autosave";

import {
  catalogEditContract,
  catalogEditContractDependencies,
} from "./editContract";
import { catalogOwnedFieldContent } from "./fieldContent";

import type { CatalogComponentSummary } from "./readModel";

import { targetKey, type CatalogSessionState } from "./session";

import type { CatalogWorkspace } from "./workspace";

/**
 * ADR-248 Phase 4e: React access to the open project's workspace. Every hook subscribes to one
 * read (a session field, a row list, a prop source, own fields, save status) and re-renders only
 * when that read's value changes — no hook subscribes to the whole document.
 */
export const WorkspaceContext = createContext<CatalogWorkspace | null>(null);

/** The open project's workspace, or `null` outside a catalog project (shared panels). */
export function useOptionalCatalogWorkspace(): CatalogWorkspace | null {
  return useContext(WorkspaceContext);
}

export function useCatalogWorkspace(): CatalogWorkspace {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("CATALOG_WORKSPACE_REQUIRED");
  return workspace;
}

/**
 * The document revision, re-read after each step — for a view that reads across the whole document
 * (the code view's page code, the interaction rules' target list). A view over one entry's fields
 * subscribes to those fields instead (`useCatalogPropSource` · `runtime.subscribeEntryField`).
 */
export function useCatalogRevision(workspace: CatalogWorkspace): number {
  const { runtime } = workspace;
  const subscribe = useCallback(
    (notify: () => void) => runtime.subscribeSteps(() => notify()),
    [runtime],
  );
  return useSyncExternalStore(subscribe, () => runtime.graph.revision);
}

/**
 * A document reading re-run after each step and kept while its JSON is the same (the same object
 * until something it reads changed). `read` runs on every step — keep it to what the view shows.
 * Same rule as `useCatalogRevision`: a reading of one entry's fields subscribes to them instead.
 */
export function useCatalogStepReading<T>(
  workspace: CatalogWorkspace,
  read: () => T,
): T {
  const { runtime } = workspace;
  const subscribe = useCallback(
    (notify: () => void) => runtime.subscribeSteps(() => notify()),
    [runtime],
  );
  const key = useSyncExternalStore(subscribe, () => JSON.stringify(read()));
  // (A reading of `undefined` has no JSON — it comes back as `null`.)
  return useMemo(() => JSON.parse(key ?? "null") as T, [key]);
}

/** One session field (selection, page, hover, …); state fields keep their identity until changed. */
export function useCatalogSession<T>(
  select: (state: CatalogSessionState) => T,
): T {
  const { session } = useCatalogWorkspace();
  return useSyncExternalStore(session.subscribe, () =>
    select(session.getSnapshot()),
  );
}

/** Layers rows of a page or under a row. */
export function useCatalogRows(
  parent: { pageId: EntryId<"page"> } | { position: CatalogPosition },
): readonly CatalogPosition[] {
  const { readModel } = useCatalogWorkspace();
  const key = "pageId" in parent ? parent.pageId : parent.position.identity;
  const subscribe = useCallback(
    (notify: () => void) => readModel.subscribeRows(parent, notify),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the parent's identity
    [readModel, key],
  );
  return useSyncExternalStore(subscribe, () =>
    "pageId" in parent
      ? readModel.pageRows(parent.pageId)
      : readModel.childRows(parent.position),
  );
}

/** Where a target's prop value comes from, and its value. */
export function useCatalogPropSource(target: EditTarget, key: string) {
  const { readModel } = useCatalogWorkspace();
  const id = targetKey(target);
  const subscribe = useCallback(
    (notify: () => void) => readModel.subscribePropSource(target, key, notify),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the target's key
    [readModel, id, key],
  );
  return useSyncExternalStore(subscribe, () =>
    readModel.propSource(target, key),
  );
}

/** What a target authors itself (Styles modified marks and reset). */
export function useCatalogOwnFields(target: EditTarget) {
  const { readModel } = useCatalogWorkspace();
  const id = targetKey(target);
  const subscribe = useCallback(
    (notify: () => void) => readModel.subscribeOwnFields(target, notify),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the target's key
    [readModel, id],
  );
  return useSyncExternalStore(subscribe, () => readModel.ownFields(target));
}

/** A node's DOM attribute (`metadata` — ID · class names · aria label), `""` when unset or no node. */
export function useCatalogNodeMetadata(
  nodeId: string | undefined,
  field: keyof NodeMetadata,
): string {
  const { runtime } = useCatalogWorkspace();
  const subscribe = useCallback(
    (notify: () => void) => runtime.subscribeSteps(() => notify()),
    [runtime],
  );
  return useSyncExternalStore(subscribe, () => {
    const entry = nodeId ? runtime.graph.getEntry(nodeId) : undefined;
    return entry?.kind === "node" ? (entry.metadata?.[field] ?? "") : "";
  });
}

/** The project's pages in order (re-renders when a page or the page order changes). */
export function useCatalogPages(): readonly PageEntry[] {
  const { readModel } = useCatalogWorkspace();
  const subscribe = useCallback(
    (notify: () => void) => readModel.subscribePages(notify),
    [readModel],
  );
  return useSyncExternalStore(subscribe, () => readModel.pages());
}

export function useCatalogComponents(): readonly CatalogComponentSummary[] {
  const { readModel } = useCatalogWorkspace();
  const subscribe = useCallback(
    (notify: () => void) => readModel.subscribeComponents(notify),
    [readModel],
  );
  return useSyncExternalStore(subscribe, () => readModel.components());
}

export function useCatalogSaveStatus(): CatalogSaveStatus {
  const { autosave } = useCatalogWorkspace();
  return useSyncExternalStore(autosave.subscribe, autosave.getSnapshot);
}

const EMPTY_CONTRACT: EditContract = { type: "", fields: [] };

/**
 * The Properties edit contract of a target (`undefined` = none). Re-read after a step that touched
 * the target's node (its own node, or the instance owning the position) — a leaf edit elsewhere
 * reads nothing.
 */
export function useCatalogEditContract(
  target: EditTarget | undefined,
): EditContract {
  const { runtime, readModel } = useCatalogWorkspace();
  const key = target ? targetKey(target) : "";
  const cache = useRef<{
    key: string;
    contract: EditContract;
    dependencies: ReadonlySet<string>;
  }>(undefined);
  const subscribe = useCallback(
    (notify: () => void) =>
      runtime.subscribeSteps(({ result, invalidatedIds }) => {
        if (!target) return;
        const owner = target.kind === "node" ? target.id : target.ownerId;
        const invalidated = (id: string) => {
          if (process.env.NODE_ENV === "development")
            docCounters.editContractIncludes += invalidatedIds.length;
          return invalidatedIds.includes(id);
        };
        if (
          !result.changedIds.has(owner) &&
          !invalidated(owner) &&
          ![...(cache.current?.dependencies ?? [])].some(
            (id) => result.changedIds.has(id) || invalidated(id),
          )
        )
          return;
        cache.current = undefined;
        notify();
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by the target's key
    [runtime, key],
  );
  return useSyncExternalStore(subscribe, () => {
    if (!target) return EMPTY_CONTRACT;
    if (cache.current?.key !== key) {
      let contract = EMPTY_CONTRACT;
      const dependencies = new Set<string>();
      try {
        contract = catalogEditContract(runtime.graph, readModel, target);
        for (const { target: part } of catalogOwnedFieldContent(
          runtime.graph,
          target,
          contract.type,
        ).values())
          dependencies.add(part.kind === "node" ? part.id : part.ownerId);
        for (const id of catalogEditContractDependencies(contract))
          dependencies.add(id);
      } catch {
        // The target is gone (removed in this step): the selection follows on its own.
      }
      cache.current = { key, contract, dependencies };
    }
    return cache.current.contract;
  });
}
