/**
 * The selected grid's track · cell selection (Figma grid — 2026-10-16 사용자 「남은 차이 전부 맞춰」).
 *
 * Builder chrome state, not the document: the Canvas headers (`CatalogGridTrackLayer`) set it, the
 * Design panel shows the selected tracks (its 「그리드」 view), the paste shortcut reads the cell.
 * Tracks and a cell are exclusive — selecting one clears the other. Neither outlives the grid's
 * selection (the layer clears both when the selection changes, on a Canvas press, on Escape).
 */
import { create } from "zustand";

export type GridTrackAxis = "column" | "row";

export interface GridTrackSelection {
  /** The grid record. */
  identity: string;
  axis: GridTrackAxis;
  indices: number[];
  anchor: number;
}

export interface GridCellSelection {
  /** The grid record. */
  identity: string;
  /** Track indices (0-based). */
  column: number;
  row: number;
}

interface GridTrackSelectionState {
  tracks: GridTrackSelection | null;
  cell: GridCellSelection | null;
  setTracks: (tracks: GridTrackSelection | null) => void;
  setCell: (cell: GridCellSelection | null) => void;
  clear: () => void;
}

export const useGridTrackSelection = create<GridTrackSelectionState>(
  (set, get) => ({
    tracks: null,
    cell: null,
    setTracks: (tracks) => set({ tracks, cell: null }),
    setCell: (cell) => set({ cell, tracks: null }),
    clear: () => {
      const { tracks, cell } = get();
      if (tracks || cell) set({ tracks: null, cell: null });
    },
  }),
);
