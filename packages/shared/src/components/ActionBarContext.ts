import { createContext } from "react";
import type { ContextValue } from "react-aria-components";
import type { ActionBarProps } from "./ActionBar";

export const ActionBarContext =
  createContext<ContextValue<ActionBarProps, HTMLDivElement>>(null);
