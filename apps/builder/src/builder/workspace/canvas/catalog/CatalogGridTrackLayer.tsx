import { catalogIsOutOfFlow } from "../../../../../../../packages/shared/src/catalog/runtime/positioning";
/**
 * CatalogGridTrackLayer — 선택한 grid 의 열 · 행 머리 (Figma grid 의 canvas track 편집 —
 * 2026-10-16 사용자 「1,2,3 한번에 진행」).
 *
 * 위 가장자리에 열마다, 왼쪽 가장자리에 행마다 pill 하나 (`gridTrackHeaders`). pill 을 누르면 그
 * 열 · 행이 선택되고 (⌘/Ctrl 토글 · ⇧ 범위), 선택된 pill 을 다시 누르면 크기 메뉴 (Fixed · Fill ·
 * Hug · 제거), pill 사이 경계를 끌면 앞 트랙이 Fixed 로 크기가 바뀌고 (놓을 때 한 step — 끄는 동안은
 * 미리보기), pill 을 끌면 선택한 트랙이 옮겨지며 그 트랙에 고정된 요소가 따라간다. Delete ·
 * Backspace 는 선택한 트랙과 그 안에만 있는 요소를 지운다 (Figma — Layout 탭 「−」 와 같은 명령).
 *
 * 2026-10-16 사용자 「남은 차이 전부 맞춰」 (Figma 실측): pill 은 포인터 아래 열 · 행과 선택한 열 · 행에만
 * 보인다. 선택한 열 · 행은 한 상자로 두르고 요소가 없는 칸을 칠한다. 선택된 grid 의 빈 칸을 누르면
 * 그 칸이 선택되고 grid 선택선이 점선이 된다 (핸들은 그대로 — catalogOverlay `dashedSelection`; 붙여넣기가 그 칸으로, `gridCellPaste`). 열 · 행 ·
 * 칸 선택은 `useGridTrackSelection` 에 있고 Design 패널이 같은 선택을 보여 준다.
 *
 * Builder chrome 이다 (문서 paint 아님). 배치는 scene 좌표를 요소의 CSS 변수로 두고, 카메라
 * (`--zoom` · `--pan-x` · `--pan-y`) 만 프레임마다 루트에 쓴다 — 카메라 제스처 · 요소 drag 중에는
 * 숨기고 쓰지 않는다.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Menu, MenuItem } from "react-aria-components/Menu";
import { Popover } from "react-aria-components/Popover";
import { setFields } from "../../../../../../../packages/shared/src/catalog/commands";
import { stageOver } from "../../../../../../../packages/shared/src/catalog/commands/compose";
import { useSemanticLabel } from "../../../../i18n";
import { gridPlacement } from "../../../catalogRuntime/canvasGridCells";
import { useToastStore } from "../../../stores/toast";
import { useGridTrackSelection } from "../../../stores/gridTrackSelection";
import type { BoundingBox } from "../selection/types";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import type { CatalogGridTrackGeometry } from "../../../catalogRuntime/canvasGesture";
import { gridTrackOrderAfterMove } from "../../../catalogRuntime/gridTrackEdit";
import {
  gridCellBox,
  gridEmptyCellAt,
  gridHoverTracks,
  gridTrackFill,
  gridTrackHeaders,
  gridTrackInsertion,
  gridTrackLine,
  gridTrackResizedTo,
  gridTrackSelection,
  type GridTrackAxis,
  type GridTrackHeader,
  type GridTrackHeaders,
} from "../../../catalogRuntime/gridTrackHeaders";
import { createCatalogStylesHost } from "../../../panels/styles/catalog/catalogStylesHost";
import {
  gridTrackList,
  gridTrackListTemplate,
  gridTrackResized,
  type GridTrack,
} from "../../../panels/styles/utils/gridTracks";
import {
  getCanvasFramePresentationSnapshot,
  subscribeCanvasFramePresentation,
} from "../canvasFramePresentation";
import { useViewportSyncStore } from "../stores";
import "./CatalogGridTrackLayer.css";

const PAGE_ROOT = "catalog:root";
/** A press that moves farther than this drags the track (else it is a click). */
const DRAG_SLOP = 4;
/** How far out (screen px) from the grid's top · left edge a pointer still shows a header. */
const HEADER_REACH = 36;

const AXIS = {
  column: {
    key: "gridTemplateColumns",
    track: "Column track",
    remove: "Remove column",
  },
  row: { key: "gridTemplateRows", track: "Row track", remove: "Remove row" },
} as const;

interface Model {
  identity: string;
  headers: GridTrackHeaders;
  geometry: CatalogGridTrackGeometry;
}

type Hover = { column?: number; row?: number };

interface SwapItem {
  identity: string;
  area: { row: number; column: number; rowSpan: number; columnSpan: number };
  box: BoundingBox;
}

interface SwapModel {
  grid: string;
  items: SwapItem[];
}

type Drag =
  | { kind: "resize"; axis: GridTrackAxis; index: number; px: number }
  | { kind: "move"; axis: GridTrackAxis; before: number };

interface Press {
  axis: GridTrackAxis;
  index: number;
  pointerId: number;
  x: number;
  y: number;
  toggle: boolean;
  range: boolean;
  /** The track size at the press (a boundary drag). */
  size?: number;
  boundary?: boolean;
  dragging?: boolean;
  /** The size a boundary drag shows (the release commits it — the `drag` state may lag a frame). */
  px?: number;
}

const headersOf = (headers: GridTrackHeaders, axis: GridTrackAxis) =>
  axis === "column" ? headers.columns : headers.rows;

function cameraNow() {
  const camera = getCanvasFramePresentationSnapshot()?.cameraState;
  return camera ?? { zoom: 1, panX: 0, panY: 0 };
}

export function CatalogGridTrackLayer({
  workspace,
  tracksOf,
  gestureActive,
  boundsOf,
}: {
  workspace: CatalogWorkspace;
  /** The overlay's tracks of a grid record (cached per drawn scene). */
  tracksOf: (identity: string) => CatalogGridTrackGeometry | undefined;
  /** A Canvas gesture (move · resize · marquee) runs: the headers hide. */
  gestureActive: () => boolean;
  /** A drawn record's scene box (the swap handles sit at the selected items' centres). */
  boundsOf: (identity: string) => BoundingBox | undefined;
}) {
  const localize = useSemanticLabel();
  const host = useMemo(() => createCatalogStylesHost(workspace), [workspace]);
  const rootRef = useRef<HTMLDivElement>(null);
  const [model, setModel] = useState<Model | null>(null);
  const modelKeyRef = useRef("");
  const modelRef = useRef<Model | null>(null);
  const selected = useGridTrackSelection((state) => state.tracks);
  const setSelected = useGridTrackSelection((state) => state.setTracks);
  const cell = useGridTrackSelection((state) => state.cell);
  const [hover, setHover] = useState<Hover>({});
  const [menu, setMenu] = useState<{
    axis: GridTrackAxis;
    anchor: HTMLElement;
  } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const pressRef = useRef<Press | null>(null);

  type Snapshot = ReturnType<CatalogWorkspace["session"]["getSnapshot"]>;
  type CatalogRoot = CatalogWorkspace["root"];
  const read = useCallback(
    (snapshot: Snapshot, catalogRoot: CatalogRoot): Model | null => {
      if (snapshot.selection.length !== 1 || snapshot.textEditing) return null;
      const identity = snapshot.selection[0]!.identity;
      const record = catalogRoot.domInputs.get(identity);
      if (!record || !record.parentId || record.parentId === PAGE_ROOT)
        return null;
      const display = record.layout.display;
      if (display !== "grid" && display !== "inline-grid") return null;
      const geometry = tracksOf(identity);
      if (!geometry) return null;
      const headers = gridTrackHeaders(record.layout, geometry);
      if (!headers.columns.length && !headers.rows.length) return null;
      return { identity, headers, geometry };
    },
    [tracksOf, workspace],
  );

  // Swap (Figma — 「Select two or more child objects that span the same number of cells, then
  // drag the pink circles to swap them」): a handle on each selected grid child.
  const [swap, setSwap] = useState<SwapModel | null>(null);
  const swapKeyRef = useRef("");
  const [swapDrag, setSwapDrag] = useState<{
    from: string;
    /** The pointer in the layer (px) — the ghost handle follows it. */
    x: number;
    y: number;
    pointerId: number;
  } | null>(null);
  const layerPoint = (clientX: number, clientY: number) => {
    const rect = rootRef.current?.getBoundingClientRect();
    return { x: clientX - (rect?.left ?? 0), y: clientY - (rect?.top ?? 0) };
  };
  const readSwap = useCallback(
    (snapshot: Snapshot, catalogRoot: CatalogRoot): SwapModel | null => {
      if (snapshot.selection.length < 2 || snapshot.textEditing) return null;
      const records = catalogRoot.domInputs;
      const selectedIds = snapshot.selection.map((item) => item.identity);
      const parentId = records.get(selectedIds[0]!)?.parentId;
      const grid = parentId ? records.get(parentId) : undefined;
      if (!grid || parentId === PAGE_ROOT) return null;
      if (
        grid.layout.display !== "grid" &&
        grid.layout.display !== "inline-grid"
      )
        return null;
      const flow = grid.children.filter((child) => {
        const record = records.get(child);
        return (
          !!record &&
          !record.hidden &&
          record.layout.display !== "none" &&
          !catalogIsOutOfFlow(record)
        );
      });
      const columns =
        gridTrackList(String(grid.layout.gridTemplateColumns ?? ""))?.length ||
        tracksOf(grid.id)?.columns.length ||
        1;
      const { cells } = gridPlacement(
        flow.map((child) => {
          const layout = records.get(child)!.layout;
          return {
            column: layout.gridColumnStart,
            row: layout.gridRowStart,
            columnEnd: layout.gridColumnEnd,
            rowEnd: layout.gridRowEnd,
          };
        }),
        columns,
      );
      const items: SwapItem[] = [];
      for (const identity of selectedIds) {
        const at = flow.indexOf(identity);
        const box = boundsOf(identity);
        if (at < 0 || !box) return null;
        items.push({ identity, area: cells[at]!, box });
      }
      const [first] = items;
      if (
        !items.every(
          (item) =>
            item.area.columnSpan === first!.area.columnSpan &&
            item.area.rowSpan === first!.area.rowSpan,
        )
      )
        return null;
      return { grid: grid.id, items };
    },
    [boundsOf, tracksOf, workspace],
  );

  // Follow the camera, the selection and the drawn tracks (one frame callback, no own RAF).
  useEffect(() => {
    let camera = { zoom: NaN, panX: NaN, panY: NaN };
    // The session and the root are read when they change, not per frame (ADR-246 select count).
    let snapshot = workspace.session.getSnapshot();
    let catalogRoot = workspace.root;
    const selectionKey = () =>
      snapshot.selection.map((item) => item.identity).join("|");
    let selected = selectionKey();
    const update = () => {
      const root = rootRef.current;
      const hidden =
        useViewportSyncStore.getState().cameraGestureActive ||
        (gestureActive() && !pressRef.current);
      // Nothing shown (no grid · no swap): no attribute write either (ADR-246 drag count).
      const shows = !!modelRef.current || !!swapKeyRef.current;
      if (
        root &&
        (shows || !hidden) &&
        root.hasAttribute("data-hidden") !== hidden
      )
        root.toggleAttribute("data-hidden", hidden);
      if (hidden) return;
      const next = read(snapshot, catalogRoot);
      const key = next ? JSON.stringify(next) : "";
      if (key !== modelKeyRef.current) {
        modelKeyRef.current = key;
        modelRef.current = next;
        setModel(next);
      }
      const nextSwap = readSwap(snapshot, catalogRoot);
      const swapKey = nextSwap ? JSON.stringify(nextSwap) : "";
      if (swapKey !== swapKeyRef.current) {
        swapKeyRef.current = swapKey;
        setSwap(nextSwap);
      }
      const now = cameraNow();
      if (
        root &&
        (now.zoom !== camera.zoom ||
          now.panX !== camera.panX ||
          now.panY !== camera.panY)
      ) {
        camera = { ...now };
        root.style.setProperty("--zoom", String(now.zoom));
        root.style.setProperty("--pan-x", `${now.panX}px`);
        root.style.setProperty("--pan-y", `${now.panY}px`);
      }
    };
    update();
    const offFrame = subscribeCanvasFramePresentation(update);
    // Figma (실측 2026-10-16): a selection change elsewhere (the Layers panel) ends a track · cell
    // selection. By identity: a step re-reconciles the session (a new array, the same items) — an
    // edit of the selected tracks keeps them.
    const offSession = workspace.session.subscribe(() => {
      snapshot = workspace.session.getSnapshot();
      const key = selectionKey();
      if (key !== selected) {
        selected = key;
        useGridTrackSelection.getState().clear();
        setMenu(null);
      }
      update();
    });
    const offRoot = workspace.subscribeRoot(() => {
      catalogRoot = workspace.root;
      update();
    });
    const offSteps = workspace.runtime.subscribeSteps(() => update());
    const offViewport = useViewportSyncStore.subscribe(update);
    return () => {
      offFrame();
      offSession();
      offRoot();
      offSteps();
      offViewport();
    };
  }, [gestureActive, read, readSwap, workspace]);

  const identity = model?.identity;
  const selection =
    selected && selected.identity === identity ? selected : null;
  const cellSelection = cell && cell.identity === identity ? cell : null;

  const commitTracks = (axis: GridTrackAxis, tracks: readonly GridTrack[]) =>
    host.updateStyle(AXIS[axis].key, gridTrackListTemplate(tracks));

  const removeTracks = (axis: GridTrackAxis, indices: readonly number[]) => {
    if (!model || !indices.length) return;
    const headers = headersOf(model.headers, axis);
    const template = gridTrackListTemplate(
      headers
        .filter((header) => !indices.includes(header.index))
        .map((header) => header.track),
    );
    setSelected(null);
    setMenu(null);
    if (host.applyGridTracks)
      host.applyGridTracks(model.identity, [
        { axis, template, removed: indices, deleteContents: true },
      ]);
    else host.updateStyle(AXIS[axis].key, template);
  };

  const moveTracks = (
    axis: GridTrackAxis,
    moving: readonly number[],
    before: number,
  ) => {
    if (!model) return;
    const headers = headersOf(model.headers, axis);
    const order = gridTrackOrderAfterMove(headers.length, moving, before);
    if (order.every((old, at) => old === at)) return;
    host.applyGridTracks?.(model.identity, [
      {
        axis,
        template: gridTrackListTemplate(
          order.map((old) => headers[old]!.track),
        ),
        removed: [],
        order,
      },
    ]);
    const indices = moving
      .map((old) => order.indexOf(old))
      .sort((a, b) => a - b);
    setSelected({
      identity: model.identity,
      axis,
      indices,
      anchor: indices[0] ?? 0,
    });
  };

  const setKind = (axis: GridTrackAxis, kind: GridTrack["kind"]) => {
    if (!model || !selection || selection.axis !== axis) return;
    const headers = headersOf(model.headers, axis);
    const tracks = headers.map((header) => {
      if (!selection.indices.includes(header.index)) return header.track;
      const next: GridTrack =
        kind === "fixed"
          ? { kind, px: Math.max(1, Math.round(header.size)) }
          : kind === "fill"
            ? { kind, weight: 1 }
            : { kind };
      return header.track.kind === kind
        ? header.track
        : gridTrackResized(header.track, next);
    });
    // Hug (Figma): the items filling the tracks keep their size — one step with the template.
    const hugged = selection.indices.filter(
      (index) => kind === "hug" && headers[index]?.track.kind !== "hug",
    );
    if (hugged.length && host.applyGridTracks)
      host.applyGridTracks(model.identity, [
        {
          axis,
          template: gridTrackListTemplate(tracks),
          removed: [],
          hugged,
        },
      ]);
    else commitTracks(axis, tracks);
    setMenu(null);
  };

  const press = (
    axis: GridTrackAxis,
    index: number,
    anchor: HTMLElement,
    modifiers: { toggle?: boolean; range?: boolean },
  ) => {
    if (!model) return;
    const current = selection?.axis === axis ? selection.indices : [];
    if (
      !modifiers.toggle &&
      !modifiers.range &&
      current.length === 1 &&
      current[0] === index
    ) {
      setMenu((open) => (open ? null : { axis, anchor }));
      return;
    }
    const indices = gridTrackSelection(
      current,
      selection?.axis === axis ? selection.anchor : undefined,
      index,
      modifiers,
    );
    setMenu(null);
    setSelected(
      indices.length
        ? {
            identity: model.identity,
            axis,
            indices,
            anchor: modifiers.range ? (selection?.anchor ?? index) : index,
          }
        : null,
    );
  };

  /** Scene position of a pointer along an axis. */
  const scenePosition = (
    axis: GridTrackAxis,
    clientX: number,
    clientY: number,
  ) => {
    const rect = rootRef.current?.getBoundingClientRect();
    const camera = cameraNow();
    return axis === "column"
      ? (clientX - (rect?.left ?? 0) - camera.panX) / camera.zoom
      : (clientY - (rect?.top ?? 0) - camera.panY) / camera.zoom;
  };

  const onPointerDown = (
    event: ReactPointerEvent<HTMLElement>,
    axis: GridTrackAxis,
    header: GridTrackHeader,
    boundary: boolean,
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pressRef.current = {
      axis,
      index: header.index,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      toggle: event.metaKey || event.ctrlKey,
      range: event.shiftKey,
      size: header.size,
      boundary,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const current = pressRef.current;
    if (!current || current.pointerId !== event.pointerId || !model) return;
    const delta =
      current.axis === "column"
        ? event.clientX - current.x
        : event.clientY - current.y;
    if (!current.dragging && Math.abs(delta) < DRAG_SLOP) return;
    current.dragging = true;
    const headers = headersOf(model.headers, current.axis);
    if (current.boundary) {
      const px = Math.max(1, (current.size ?? 0) + delta / cameraNow().zoom);
      current.px = px;
      host.previewStyle(
        AXIS[current.axis].key,
        gridTrackListTemplate(gridTrackResizedTo(headers, current.index, px)),
      );
      setDrag({ kind: "resize", axis: current.axis, index: current.index, px });
      return;
    }
    if (
      selection?.axis !== current.axis ||
      !selection.indices.includes(current.index)
    )
      setSelected({
        identity: model.identity,
        axis: current.axis,
        indices: [current.index],
        anchor: current.index,
      });
    setMenu(null);
    setDrag({
      kind: "move",
      axis: current.axis,
      before: gridTrackInsertion(
        headers,
        scenePosition(current.axis, event.clientX, event.clientY),
      ),
    });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const current = pressRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    pressRef.current = null;
    const ended = drag;
    setDrag(null);
    // A boundary drag ends its preview even when the grid is gone (another selection mid-drag).
    if (current.boundary) {
      if (model && current.px !== undefined)
        commitTracks(
          current.axis,
          gridTrackResizedTo(
            headersOf(model.headers, current.axis),
            current.index,
            current.px,
          ),
        );
      else host.cancelPreview?.();
      return;
    }
    if (!model) return;
    if (!current.dragging) {
      press(current.axis, current.index, event.currentTarget, current);
      return;
    }
    if (ended?.kind === "move") {
      const moving =
        selection?.axis === current.axis &&
        selection.indices.includes(current.index)
          ? selection.indices
          : [current.index];
      moveTracks(current.axis, moving, ended.before);
    }
  };

  const onPointerCancel = () => {
    if (pressRef.current?.boundary) host.cancelPreview?.();
    pressRef.current = null;
    setDrag(null);
  };

  // Delete · Backspace · Escape on a pill: the Builder's global shortcuts listen in the document's
  // capture phase (Delete would remove the grid itself) — the window's capture phase runs first.
  const keyRef = useRef<(event: KeyboardEvent) => void>(() => {});
  const onWindowKey = (event: KeyboardEvent) => {
    // Escape (Figma): the track selection goes, the grid stays selected.
    if (event.key === "Escape" && (selection || cellSelection || menu)) {
      const target = event.target as HTMLElement | null;
      // A field keeps its Escape; a menu · popover closes itself only (RAC).
      if (
        target?.closest?.(
          "input, textarea, [contenteditable='true'], [role='menu'], [role='listbox'], [role='dialog'], .react-aria-Popover",
        )
      )
        return;
      event.stopPropagation();
      useGridTrackSelection.getState().clear();
      setMenu(null);
      return;
    }
    const pill = (event.target as Element | null)?.closest?.<HTMLElement>(
      "[data-track-axis]",
    );
    if (!pill || !rootRef.current?.contains(pill)) return;
    const axis = pill.dataset.trackAxis as GridTrackAxis;
    const index = Number(pill.dataset.trackIndex);
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      removeTracks(
        axis,
        selection?.axis === axis && selection.indices.includes(index)
          ? selection.indices
          : [index],
      );
    }
  };
  // Figma (실측 2026-10-16): a track · cell selection lasts until another press on the Canvas — the
  // grid (its name · an empty cell), a child, the empty canvas — or a selection change elsewhere
  // (the Layers panel). A press on a header keeps it (that is the header's own click). A click on
  // an empty cell of the selected grid selects that cell (the grid stays selected).
  useEffect(() => {
    const container = rootRef.current?.parentElement;
    if (!container) return;
    const clear = () => {
      useGridTrackSelection.getState().clear();
      setMenu(null);
    };
    const sceneAt = (clientX: number, clientY: number) => {
      const rect = rootRef.current?.getBoundingClientRect();
      const camera = cameraNow();
      return {
        x: (clientX - (rect?.left ?? 0) - camera.panX) / camera.zoom,
        y: (clientY - (rect?.top ?? 0) - camera.panY) / camera.zoom,
      };
    };
    let pending:
      | {
          pointerId: number;
          x: number;
          y: number;
          identity: string;
          column: number;
          row: number;
        }
      | undefined;
    const onPress = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      clear();
      pending = undefined;
      const current = modelRef.current;
      if (
        !current ||
        event.button !== 0 ||
        event.shiftKey ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      const at = gridEmptyCellAt(
        current.geometry,
        sceneAt(event.clientX, event.clientY),
      );
      if (at)
        pending = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          identity: current.identity,
          ...at,
        };
    };
    const onRelease = (event: PointerEvent) => {
      const press = pending;
      pending = undefined;
      if (!press || press.pointerId !== event.pointerId) return;
      if (
        Math.hypot(event.clientX - press.x, event.clientY - press.y) >=
        DRAG_SLOP
      )
        return;
      const selection = workspace.session.getSnapshot().selection;
      if (selection.length !== 1 || selection[0]!.identity !== press.identity)
        return;
      useGridTrackSelection.getState().setCell({
        identity: press.identity,
        column: press.column,
        row: press.row,
      });
    };
    // The headers near the pointer (Figma): the column · row under it.
    let hovered = "";
    const showHover = (next: Hover) => {
      const key = `${next.column ?? ""}|${next.row ?? ""}`;
      if (key === hovered) return;
      hovered = key;
      setHover(next);
    };
    const onMove = (event: PointerEvent) => {
      const current = modelRef.current;
      if (!current) return showHover({});
      showHover(
        gridHoverTracks(
          current.geometry,
          sceneAt(event.clientX, event.clientY),
          HEADER_REACH / cameraNow().zoom,
        ),
      );
    };
    const onLeave = () => showHover({});
    container.addEventListener("pointerdown", onPress, true);
    container.addEventListener("pointermove", onMove);
    container.addEventListener("pointerleave", onLeave);
    window.addEventListener("pointerup", onRelease, true);
    return () => {
      container.removeEventListener("pointerdown", onPress, true);
      container.removeEventListener("pointermove", onMove);
      container.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("pointerup", onRelease, true);
    };
  }, [workspace]);

  // The latest handler is connected at commit (no ref write during render).
  useEffect(() => {
    keyRef.current = onWindowKey;
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => keyRef.current(event);
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const onKeyDown = (
    event: ReactKeyboardEvent<HTMLElement>,
    axis: GridTrackAxis,
    index: number,
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      press(axis, index, event.currentTarget, {
        toggle: event.metaKey || event.ctrlKey,
        range: event.shiftKey,
      });
    }
  };

  /** Scene point of a client point. */
  const scenePoint = (clientX: number, clientY: number) => {
    const rect = rootRef.current?.getBoundingClientRect();
    const camera = cameraNow();
    return {
      x: (clientX - (rect?.left ?? 0) - camera.panX) / camera.zoom,
      y: (clientY - (rect?.top ?? 0) - camera.panY) / camera.zoom,
    };
  };

  /** The two items trade cells (pinned there — same spans, so the others keep theirs). */
  const swapItems = (a: SwapItem, b: SwapItem) => {
    const breakpoint = workspace.session.getSnapshot().breakpoint;
    const targetA = workspace.itemOfRecord(a.identity)?.target;
    const targetB = workspace.itemOfRecord(b.identity)?.target;
    if (!targetA || !targetB) return;
    const pin = (area: SwapItem["area"]) => ({
      gridColumnStart: { kind: "set" as const, value: String(area.column + 1) },
      gridRowStart: { kind: "set" as const, value: String(area.row + 1) },
    });
    const commands = [
      setFields({ targets: [targetA], breakpoint, layout: pin(b.area) }),
      setFields({ targets: [targetB], breakpoint, layout: pin(a.area) }),
    ];
    try {
      workspace.execute((reader) => {
        const stage = stageOver(reader);
        const ops = commands.flatMap((command) => {
          const plan = command(stage);
          stage.apply(plan.ops);
          return plan.ops;
        });
        return { label: "Swap", ops };
      });
    } catch (error) {
      useToastStore
        .getState()
        .showToast(
          "error",
          error instanceof Error ? error.message : String(error),
        );
    }
  };

  const onSwapUp = (event: ReactPointerEvent<HTMLElement>) => {
    const drag = swapDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setSwapDrag(null);
    if (!swap) return;
    const point = scenePoint(event.clientX, event.clientY);
    const from = swap.items.find((item) => item.identity === drag.from);
    const to = swap.items.find(
      (item) =>
        item.identity !== drag.from &&
        point.x >= item.box.x &&
        point.x <= item.box.x + item.box.width &&
        point.y >= item.box.y &&
        point.y <= item.box.y + item.box.height,
    );
    if (from && to) swapItems(from, to);
  };

  /** Figma: a Fill track is its `fr` share (`1fr` · `2fr`), Fixed its px (`140px`), Hug its drawn size. */
  const labelOf = ({ track, size }: GridTrackHeader) =>
    track.kind === "fixed"
      ? `${Math.round(track.px)}px`
      : track.kind === "hug"
        ? `${Math.round(size)} ${localize("Hug")}`
        : `${track.weight}fr`;

  const headers = model?.headers;
  const frameVars = headers
    ? ({
        "--fx": headers.frame.x,
        "--fy": headers.frame.y,
        "--fw": headers.frame.width,
        "--fh": headers.frame.height,
        "--cx": headers.content.x,
        "--cy": headers.content.y,
        "--cw": headers.content.width,
        "--ch": headers.content.height,
      } as CSSProperties)
    : undefined;

  /** The tracks whose headers show (Figma): the hovered one, the selected ones, the cell's. */
  const shownOf = (axis: GridTrackAxis) => {
    const shown = new Set<number>();
    const hovered = axis === "column" ? hover.column : hover.row;
    if (hovered !== undefined) shown.add(hovered);
    if (selection?.axis === axis)
      for (const index of selection.indices) shown.add(index);
    if (cellSelection)
      shown.add(axis === "column" ? cellSelection.column : cellSelection.row);
    if (drag?.kind === "resize" && drag.axis === axis) {
      shown.add(drag.index);
      shown.add(drag.index + 1);
    }
    return shown;
  };

  const boxVars = (box: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) =>
    ({
      "--bx": box.x,
      "--by": box.y,
      "--bw": box.width,
      "--bh": box.height,
    }) as CSSProperties;

  const renderAxis = (axis: GridTrackAxis) => {
    if (!headers) return null;
    const list = headersOf(headers, axis);
    const gap = axis === "column" ? headers.columnGap : headers.rowGap;
    const shown = shownOf(axis);
    return (
      <div
        className="grid-track-axis"
        data-axis={axis}
        role="group"
        aria-label={localize(axis === "column" ? "Columns" : "Grid rows")}
      >
        {list.map((header) => {
          const isSelected =
            selection?.axis === axis &&
            selection.indices.includes(header.index);
          const name = `${localize(AXIS[axis].track)} ${header.index + 1}`;
          return (
            <button
              key={`t${header.index}`}
              type="button"
              className="grid-track-pill"
              style={
                { "--s": header.start, "--l": header.size } as CSSProperties
              }
              aria-label={`${name} · ${labelOf(header)}`}
              aria-pressed={isSelected}
              aria-haspopup="menu"
              data-selected={isSelected || undefined}
              data-visible={shown.has(header.index) || undefined}
              data-track-axis={axis}
              data-track-index={header.index}
              onPointerDown={(event) =>
                onPointerDown(event, axis, header, false)
              }
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              onKeyDown={(event) => onKeyDown(event, axis, header.index)}
            >
              <span className="grid-track-pill-label">
                {drag?.kind === "resize" &&
                drag.axis === axis &&
                drag.index === header.index
                  ? `${Math.round(drag.px)}px`
                  : labelOf(header)}
              </span>
            </button>
          );
        })}
        {list.slice(0, -1).map((header) => (
          <div
            key={`b${header.index}`}
            className="grid-track-boundary"
            style={
              {
                "--line": gridTrackLine(list, header.index + 1, gap),
              } as CSSProperties
            }
            aria-hidden="true"
            data-visible={
              shown.has(header.index) ||
              shown.has(header.index + 1) ||
              undefined
            }
            data-active={
              (drag?.kind === "resize" &&
                drag.axis === axis &&
                drag.index === header.index) ||
              undefined
            }
            onPointerDown={(event) => onPointerDown(event, axis, header, true)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          />
        ))}
        {/* The selected tracks, each one box (Figma) — over the empty-cell fill. */}
        {selection?.axis === axis &&
          list
            .filter((header) => selection.indices.includes(header.index))
            .map((header) => (
              <div
                key={`h${header.index}`}
                className="grid-track-box"
                style={
                  { "--s": header.start, "--l": header.size } as CSSProperties
                }
                aria-hidden="true"
              />
            ))}
        {drag?.kind === "move" && drag.axis === axis && (
          <div
            className="grid-track-insertion"
            style={
              {
                "--line": gridTrackLine(list, drag.before, gap),
              } as CSSProperties
            }
            aria-hidden="true"
          />
        )}
      </div>
    );
  };

  const menuHeaders =
    menu && headers && selection ? headersOf(headers, menu.axis) : [];
  const menuKind =
    selection?.indices.length === 1
      ? menuHeaders[selection.indices[0]!]?.track.kind
      : undefined;

  // The selected tracks' cells no item takes (Figma), and the selected cell.
  const fills =
    model && selection
      ? gridTrackFill(model.geometry, selection.axis, selection.indices)
      : [];
  const cellBox =
    model && cellSelection
      ? gridCellBox(model.geometry, cellSelection.column, cellSelection.row)
      : undefined;

  return (
    <div
      ref={rootRef}
      className="catalog-grid-track-layer"
      data-grid-track-layer=""
      style={frameVars}
    >
      {fills.map((box) => (
        <div
          key={`${box.x},${box.y}`}
          className="grid-track-fill"
          style={boxVars(box)}
          aria-hidden="true"
        />
      ))}
      {cellBox && (
        <div
          className="grid-track-fill"
          data-cell=""
          style={boxVars(cellBox)}
          aria-hidden="true"
        />
      )}
      {renderAxis("column")}
      {renderAxis("row")}
      {swap?.items.map((item) => (
        <button
          key={item.identity}
          type="button"
          className="grid-swap-handle"
          aria-label={localize("Swap")}
          data-dragging={swapDrag?.from === item.identity || undefined}
          style={
            {
              "--bx": item.box.x + item.box.width / 2,
              "--by": item.box.y + item.box.height / 2,
            } as CSSProperties
          }
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.stopPropagation();
            event.currentTarget.setPointerCapture(event.pointerId);
            setSwapDrag({
              from: item.identity,
              ...layerPoint(event.clientX, event.clientY),
              pointerId: event.pointerId,
            });
          }}
          onPointerMove={(event) => {
            if (swapDrag?.pointerId === event.pointerId)
              setSwapDrag({
                ...swapDrag,
                ...layerPoint(event.clientX, event.clientY),
              });
          }}
          onPointerUp={onSwapUp}
          onPointerCancel={() => setSwapDrag(null)}
        />
      ))}
      {swapDrag && (
        <div
          className="grid-swap-ghost"
          aria-hidden="true"
          style={{ left: swapDrag.x, top: swapDrag.y }}
        />
      )}
      {menu && selection && (
        <Popover
          className="react-aria-Popover property-select-popover property-row-menu-popover"
          triggerRef={{ current: menu.anchor }}
          isOpen
          onOpenChange={(open) => {
            if (!open) setMenu(null);
          }}
          placement={menu.axis === "column" ? "bottom" : "right"}
        >
          <Menu
            className="react-aria-Menu property-row-menu"
            aria-label={localize(AXIS[menu.axis].track)}
            onAction={(key) => {
              if (key === "remove") removeTracks(menu.axis, selection.indices);
              else setKind(menu.axis, key as GridTrack["kind"]);
            }}
          >
            {(["fixed", "fill", "hug"] as const).map((kind) => (
              <MenuItem
                key={kind}
                id={kind}
                className="react-aria-MenuItem"
                textValue={localize(
                  kind === "fixed" ? "Fixed" : kind === "fill" ? "Fill" : "Hug",
                )}
                data-current={menuKind === kind || undefined}
              >
                <span>
                  {localize(
                    kind === "fixed"
                      ? "Fixed"
                      : kind === "fill"
                        ? "Fill"
                        : "Hug",
                  )}
                </span>
              </MenuItem>
            ))}
            <MenuItem
              id="remove"
              className="react-aria-MenuItem"
              textValue={localize(AXIS[menu.axis].remove)}
            >
              <span>{localize(AXIS[menu.axis].remove)}</span>
            </MenuItem>
          </Menu>
        </Popover>
      )}
    </div>
  );
}
