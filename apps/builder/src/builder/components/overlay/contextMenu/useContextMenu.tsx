import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { buildContextMenuItems } from "./buildContextMenuItems";
import { ContextMenuOverlay } from "./ContextMenuOverlay";
import { resolveContextMenuDisposition } from "./contextMenuPolicy";
import type {
  ContextMenuController,
  ContextMenuDeps,
  ContextMenuRequest,
  ContextMenuState,
} from "./types";

const EMPTY_CONTEXT_MENU_DEPS: ContextMenuDeps = {};
const ContextMenuContext = createContext<ContextMenuController | null>(null);

export interface ContextMenuProviderProps {
  children: ReactNode;
  deps?: ContextMenuDeps;
}

export function ContextMenuProvider({
  children,
  deps = EMPTY_CONTEXT_MENU_DEPS,
}: ContextMenuProviderProps) {
  const [request, setRequest] = useState<ContextMenuRequest | null>(null);

  const open = useCallback((nextRequest: ContextMenuRequest) => {
    setRequest(nextRequest);
  }, []);

  const close = useCallback(() => {
    setRequest(null);
  }, []);

  const state = useMemo<ContextMenuState>(
    () => ({
      request,
      isOpen: request !== null,
    }),
    [request],
  );

  const controller = useMemo<ContextMenuController>(
    () => ({ close, open, state }),
    [close, open, state],
  );

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      const disposition = resolveContextMenuDisposition({
        altKey: event.altKey,
        target: event.target,
      });

      if (disposition === "native") {
        close();
        return;
      }

      event.preventDefault();
      if (disposition === "suppress-without-menu") {
        close();
      }
    };

    document.addEventListener("contextmenu", handleContextMenu, true);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu, true);
    };
  }, [close]);

  const items = request ? buildContextMenuItems(request, deps) : [];

  return (
    <ContextMenuContext.Provider value={controller}>
      {children}
      <ContextMenuOverlay
        isOpen={state.isOpen}
        items={items}
        onClose={close}
        request={request}
      />
    </ContextMenuContext.Provider>
  );
}

export function useContextMenu(): ContextMenuController {
  const context = useContext(ContextMenuContext);
  if (!context) {
    throw new Error("useContextMenu must be used within a ContextMenuProvider");
  }

  return context;
}
