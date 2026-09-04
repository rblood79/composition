import { createContext } from "react";
import type { ContextMenuController } from "./types";

export const ContextMenuContext = createContext<ContextMenuController | null>(
  null,
);
