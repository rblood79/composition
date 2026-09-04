import { useContext } from "react";
import { ContextMenuContext } from "./contextMenuContext";
import type { ContextMenuController } from "./types";

export function useContextMenu(): ContextMenuController {
  const context = useContext(ContextMenuContext);
  if (!context) {
    throw new Error("useContextMenu must be used within a ContextMenuProvider");
  }

  return context;
}
