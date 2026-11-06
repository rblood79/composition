import { createContext } from "react";

/** Only an explicitly authored selection slot consumes its owning option's state. */
export const SelectBoxSelectionContext = createContext<{
  isSelected: boolean;
  isDisabled: boolean;
} | null>(null);
