import {
  createContext,
  createElement,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactElement,
  type ReactNode,
} from "react";

/**
 * The page's main content (ADR-316 — 사용자 결정 2026-11-24 「페이지 본문 = main」).
 *
 * A page without a layout draws its body as `<main>`. A frame the author set as `main`
 * (`frameElementType.ts`) is the page's main instead — the body is a `div` then, so there is never a
 * `main` inside a `main`. A page whose body is a layout's instance keeps a `div` (its content slot
 * is the layout's — ADR-304).
 *
 * The body learns of the frames set as `main` from the frames themselves: each one drawn registers
 * here while it is mounted. The record scan the binding makes (`explicitMain`) only decides the
 * first render, before any frame has mounted — so the page is not drawn twice at load.
 */
interface PageMainStore {
  readonly ids: Set<string>;
  readonly listeners: Set<() => void>;
  notify(): void;
}

function createStore(): PageMainStore {
  const listeners = new Set<() => void>();
  let pending = false;
  return {
    ids: new Set(),
    listeners,
    // (Coalesced: a body switching element remounts its subtree — the frame leaves and comes back
    //  in one commit, and the body reads the settled set.)
    notify() {
      if (pending) return;
      pending = true;
      queueMicrotask(() => {
        pending = false;
        for (const listener of listeners) listener();
      });
    },
  };
}

const PageMainContext = createContext<PageMainStore | null>(null);

type ElementProps = Record<string, unknown> & { children?: ReactNode };

/** The page body: `<main>` unless a layout owns it or a frame inside is the page's main. */
export function CatalogPageBody({
  explicitMain,
  layoutBody,
  children,
  ...rest
}: ElementProps & {
  /** A frame set as `main` is among the body's records (the first render's answer). */
  explicitMain: boolean;
  /** The body is a layout's instance. */
  layoutBody: boolean;
}): ReactElement {
  const store = useMemo(createStore, []);
  // (Until the first commit no frame has registered — the record scan answers.)
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => setMounted(true), []);
  const registered = useSyncExternalStore(
    (listener) => {
      store.listeners.add(listener);
      return () => store.listeners.delete(listener);
    },
    () => store.ids.size > 0,
    () => store.ids.size > 0,
  );
  const yields = layoutBody || registered || (!mounted && explicitMain);
  return (
    <PageMainContext.Provider value={store}>
      {createElement(yields ? "div" : "main", rest, children)}
    </PageMainContext.Provider>
  );
}

/** A frame drawn as `<main>`: the page's main while it is mounted. */
export function CatalogMainFrame({
  recordId,
  children,
  ...rest
}: ElementProps & { recordId: string }): ReactElement {
  const store = useContext(PageMainContext);
  useLayoutEffect(() => {
    if (!store) return;
    store.ids.add(recordId);
    store.notify();
    return () => {
      store.ids.delete(recordId);
      store.notify();
    };
  }, [store, recordId]);
  return createElement("main", rest, children);
}
