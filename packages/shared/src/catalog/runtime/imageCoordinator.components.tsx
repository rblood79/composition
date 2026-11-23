import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

/**
 * S2 `ImageCoordinator` (`@react-spectrum/s2` 1.8.2 `ImageCoordinator.tsx`, S2 체크리스트 부록 D.2 —
 * 사용자 결정 2026-11-24 「S2 레퍼런스 대로」): the Images inside it are revealed together once all of
 * them have loaded, or after `timeout` (5000 ms) — not one by one as each arrives. S2 renders no
 * element: a context around its children.
 *
 * S2's `group` is a React context made by `createImageGroup()` and handed to both the coordinator and
 * its Images; a document has no code objects, so a group here is its name (`group` on the
 * ImageCoordinator and on the Image — the same name, the same group). No name = S2's
 * `DefaultImageGroup`. An Image outside any coordinator of its group reveals as soon as it loads
 * (S2's default context — `revealAll: true`).
 */
export interface CatalogImageGroupValue {
  revealAll: boolean;
  register(url: string): void;
  unregister(url: string): void;
  load(url: string): void;
}

const DEFAULT_GROUP_VALUE: CatalogImageGroupValue = {
  revealAll: true,
  register() {},
  unregister() {},
  load() {},
};

/** The group name S2's `DefaultImageGroup` stands for. */
const DEFAULT_GROUP = "";

/** The coordinated groups around a node, by name (S2: one context per group). */
const CatalogImageGroups = createContext<
  ReadonlyMap<string, CatalogImageGroupValue>
>(new Map());

const groupKey = (group: string | undefined) =>
  typeof group === "string" ? group.trim() : DEFAULT_GROUP;

/** An Image's group (S2 `useContext(group)`): the nearest coordinator of that name, else S2's default. */
export function useCatalogImageGroup(
  group: string | undefined,
): CatalogImageGroupValue {
  return (
    useContext(CatalogImageGroups).get(groupKey(group)) ?? DEFAULT_GROUP_VALUE
  );
}

interface State {
  loadedAll: boolean;
  timedOut: boolean;
  loadStartTime: number;
  loaded: Map<string, boolean>;
}

type Action =
  | { type: "register"; url: string }
  | { type: "unregister"; url: string }
  | { type: "load"; url: string }
  | { type: "timeout" };

const isAllLoaded = (loaded: Map<string, boolean>) =>
  [...loaded.values()].every(Boolean);

// (S2's reducer, as it is.)
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "register": {
      if (state.loaded.get(action.url) === false) return state;
      const loaded = new Map(state.loaded).set(action.url, false);
      return {
        loadedAll: false,
        // (a first item of a new batch after all had loaded starts the wait over)
        timedOut: state.loadedAll ? false : state.timedOut,
        loadStartTime: state.loadedAll ? Date.now() : state.loadStartTime,
        loaded,
      };
    }
    case "unregister": {
      if (!state.loaded.has(action.url)) return state;
      const loaded = new Map(state.loaded);
      loaded.delete(action.url);
      return { ...state, loadedAll: isAllLoaded(loaded), loaded };
    }
    case "load": {
      if (state.loaded.get(action.url) !== false) return state;
      const loaded = new Map(state.loaded).set(action.url, true);
      return { ...state, loadedAll: isAllLoaded(loaded), loaded };
    }
    case "timeout":
      return !state.loadedAll && !state.timedOut
        ? { ...state, timedOut: true }
        : state;
  }
}

export const CATALOG_IMAGE_COORDINATOR_TIMEOUT = 5000;

export function CatalogImageCoordinator(props: {
  children?: ReactNode;
  timeout?: number;
  group?: string;
}): ReactNode {
  // (Inside a coordinator of the same group already: the outer one coordinates — S2 passes through.)
  const groups = useContext(CatalogImageGroups);
  if (groups.has(groupKey(props.group))) return props.children;
  return <CoordinatorRoot {...props} />;
}

function CoordinatorRoot({
  children,
  timeout,
  group,
}: {
  children?: ReactNode;
  timeout?: number;
  group?: string;
}) {
  const wait =
    typeof timeout === "number" && Number.isFinite(timeout) && timeout >= 0
      ? timeout
      : CATALOG_IMAGE_COORDINATOR_TIMEOUT;
  const [{ loadedAll, timedOut, loadStartTime }, dispatch] = useReducer(
    reducer,
    undefined,
    (): State => ({
      loadedAll: true,
      timedOut: false,
      loadStartTime: 0,
      loaded: new Map(),
    }),
  );
  const register = useCallback(
    (url: string) => dispatch({ type: "register", url }),
    [],
  );
  const unregister = useCallback(
    (url: string) => dispatch({ type: "unregister", url }),
    [],
  );
  const load = useCallback(
    (url: string) => dispatch({ type: "load", url }),
    [],
  );
  useEffect(() => {
    if (loadedAll) return;
    const id = setTimeout(
      () => dispatch({ type: "timeout" }),
      loadStartTime + wait - Date.now(),
    );
    return () => clearTimeout(id);
  }, [loadStartTime, loadedAll, wait]);
  const revealAll = loadedAll || timedOut;
  const outer = useContext(CatalogImageGroups);
  const groups = useMemo(
    () =>
      new Map(outer).set(groupKey(group), {
        revealAll,
        register,
        unregister,
        load,
      }),
    [outer, group, revealAll, register, unregister, load],
  );
  return (
    <CatalogImageGroups.Provider value={groups}>
      {children}
    </CatalogImageGroups.Provider>
  );
}
