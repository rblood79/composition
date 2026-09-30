import { createContext } from "react";
import type { BreakpointName } from "@composition/shared";
import type { ElementStyleContext } from "./hooks/useElementStyleContext";

/** The selected element as the style actions read it when they run. */
export interface StylesTargetSnapshot {
  id: string | null;
  type: string | undefined;
  /** Authored style at the active breakpoint (a reusable instance: its origin's under its own). */
  style: Record<string, unknown>;
  props: Record<string, unknown>;
}

/**
 * Where the Styles panel reads the selection and writes its edits. Hooks (`use*`) subscribe;
 * commands read the current state when they run. The default is the old store; the catalog
 * Styles panel (ADR-248 Phase 4e-4d) provides the catalog workspace, so the sections are shared.
 */
export interface StylesHost {
  useSelectedId(): string | null;
  useActiveBreakpoint(): BreakpointName;
  useElementStyleContext(id: string | null): ElementStyleContext;
  readSelectedTarget(): StylesTargetSnapshot;
  /** One CSS key (empty = remove); one history step. */
  updateStyle(property: string, value: string): void;
  /** Several CSS keys as one step. */
  updateStyles(styles: Record<string, string>): void;
  /** A live value while dragging (no history). */
  previewStyle(property: string, value: string): void;
  updateProperty(key: string, value: unknown): void;
  updateProperties(props: Record<string, unknown>): void;
  /** The old Canvas editor presentation channel (live paint while editing) is available. */
  presentation: boolean;
}

/** `null` = the old store (`STORE_STYLES_HOST`); the catalog Styles panel provides its own. */
export const StylesHostContext = createContext<StylesHost | null>(null);
