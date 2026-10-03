import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { EditContract } from "@composition/shared";
import type {
  EditTarget,
  EntryId,
  PageEntry,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { CatalogPosition } from "../../../../../packages/shared/src/catalog/resolution/positions";
import type { CatalogSaveStatus } from "./autosave";
import { catalogEditContract } from "./editContract";
import type { CatalogComponentSummary } from "./readModel";
import { targetKey, type CatalogSessionState } from "./session";
import type { CatalogWorkspace } from "./workspace";

/**
 * ADR-248 Phase 4e: React access to the open project's workspace. Every hook subscribes to one
 * read (a session field, a row list, a prop source, own fields, save status) and re-renders only
 * when that read's value changes — no hook subscribes to the whole document.
 */
const WorkspaceContext = createContext<CatalogWorkspace | null>(null);

export function CatalogWorkspaceProvider({
  workspace,
  children,
}: {
  workspace: CatalogWorkspace;
  children: ReactNode;
}) {
  return (
    <WorkspaceContext.Provider value={workspace}>
      {children}
    </WorkspaceContext.Provider>
  );
}

/** Renders its children only once a project is open (panels mount before the workspace exists). */
export function CatalogWorkspaceGate({ children }: { children: ReactNode }) {
  return useContext(WorkspaceContext) ? <>{children}</> : null;
}

/** The open project's workspace, or `null` outside a catalog project (shared panels). */
export function useOptionalCatalogWorkspace(): CatalogWorkspace | null {
  return useContext(WorkspaceContext);
}

export function useCatalogWorkspace(): CatalogWorkspace {
  const workspace = useContext(WorkspaceContext);
  if (!workspace) throw new Error("CATALOG_WORKSPACE_REQUIRED");
  return workspace;
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
  const cache = useRef<{ key: string; contract: EditContract }>(undefined);
  const subscribe = useCallback(
    (notify: () => void) =>
      runtime.subscribeSteps(({ result, invalidatedIds }) => {
        if (!target) return;
        const owner = target.kind === "node" ? target.id : target.ownerId;
        if (!result.changedIds.has(owner) && !invalidatedIds.includes(owner))
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
      try {
        contract = catalogEditContract(runtime.graph, readModel, target);
      } catch {
        // The target is gone (removed in this step): the selection follows on its own.
      }
      cache.current = { key, contract };
    }
    return cache.current.contract;
  });
}
