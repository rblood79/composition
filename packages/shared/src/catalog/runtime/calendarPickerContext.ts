import { createContext } from "react";

/**
 * ADR-256 Phase 9 — what RAC's `CalendarMonthPicker` · `CalendarYearPicker` hand their child (the
 * reference's `<Select {...props}>{item => <SelectItem>{item.formatted}</SelectItem>}</Select>`):
 * the picker's name, the focused month · year key, the move and the items RAC makes.
 */
export interface CatalogCalendarPickerAria {
  readonly "aria-label": string;
  readonly value: string | number;
  readonly onChange: (key: string | number | null) => void;
  readonly items: readonly {
    readonly id: string | number;
    readonly formatted: string;
  }[];
}

/** The nearest calendar picker's RAC values and its record id (the owner of `{formatted}`). */
export const CatalogCalendarPickerContext = createContext<{
  readonly ownerId: string;
  readonly aria: CatalogCalendarPickerAria;
} | null>(null);
