import { create } from "zustand";
import { createSettingsSlice, type SettingsState } from "./canvasSettings";
import { createPanelLayoutSlice, type PanelLayoutSlice } from "./panelLayout";

/**
 * ADR-248 4e-7: the Builder's own UI state — Canvas settings (rulers, snapping, the action bar,
 * page placement) and the panel workspace layout. It used to be two slices of the old element
 * store (`useStore`, with the document and selection); the catalog Builder keeps its document
 * and selection in the workspace, so this store holds only what the chrome needs.
 */
export type BuilderUiState = SettingsState & PanelLayoutSlice;

export const useBuilderUiStore = create<BuilderUiState>((set, get, store) => ({
  ...createSettingsSlice(set, get, store),
  ...createPanelLayoutSlice(set, get, store),
}));
