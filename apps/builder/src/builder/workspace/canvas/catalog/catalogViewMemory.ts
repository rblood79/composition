import type { BreakpointName } from "@composition/shared";
import { CANVAS_BREAKPOINTS } from "../../canvasBreakpoints";
import {
  loadWorkspaceCanvasViewports,
  saveWorkspaceCanvasViewports,
  type WorkspaceCanvasViewport,
} from "../../hooks/workspaceCanvasViewportPersistence";

/**
 * ADR-248 Phase 4e: what the Builder view remembers across a reload or reopening a project — the
 * old app's two local keys, kept as they were. The breakpoint is one Builder-wide choice
 * (`builder-breakpoint`); the camera is per project and per breakpoint
 * (`builder.workspace.breakpoint-viewports.v1:<projectId>`). Neither is part of the document.
 */
const BREAKPOINT_KEY = "builder-breakpoint";
const BREAKPOINT_IDS: ReadonlySet<string> = new Set(
  CANVAS_BREAKPOINTS.map((breakpoint) => breakpoint.id),
);

export function readRememberedBreakpoint(): BreakpointName {
  try {
    const stored = window.localStorage.getItem(BREAKPOINT_KEY);
    if (stored && BREAKPOINT_IDS.has(stored)) return stored as BreakpointName;
  } catch {
    // Storage blocked: the default breakpoint.
  }
  return "desktop";
}

export function rememberBreakpoint(breakpoint: BreakpointName): void {
  try {
    window.localStorage.setItem(BREAKPOINT_KEY, breakpoint);
  } catch {
    // Storage blocked or full: the breakpoint still applies to this session.
  }
}

/** The cameras of one project, one per breakpoint. */
export interface CatalogCameraMemory {
  saved(breakpoint: BreakpointName): WorkspaceCanvasViewport | undefined;
  remember(breakpoint: BreakpointName, camera: WorkspaceCanvasViewport): void;
}

export function openCatalogCameraMemory(
  projectId: string,
): CatalogCameraMemory {
  const cameras = loadWorkspaceCanvasViewports(projectId, BREAKPOINT_IDS);
  return {
    saved: (breakpoint) => cameras.get(breakpoint),
    remember(breakpoint, camera) {
      const previous = cameras.get(breakpoint);
      if (
        previous?.x === camera.x &&
        previous.y === camera.y &&
        previous.scale === camera.scale
      )
        return;
      cameras.set(breakpoint, { ...camera });
      saveWorkspaceCanvasViewports(projectId, cameras, BREAKPOINT_IDS);
    },
  };
}

type ContainerSize = { width: number; height: number };

/**
 * The Canvas camera over a camera memory: open (and switch) to the breakpoint's remembered camera,
 * else `fit`; remember each camera change after a short delay (`flush` writes a pending one now).
 * A new root at the same breakpoint (a theme change) keeps the camera. The definition edit view
 * (`view`) fits its frame and remembers nothing; leaving it returns to the page camera.
 */
export interface CatalogCameraBinding {
  show(containerSize: ContainerSize): void;
  rootReplaced(containerSize: ContainerSize): void;
  changed(): void;
  flush(): void;
}

export function bindCatalogCamera(options: {
  memory: CatalogCameraMemory;
  breakpoint: () => BreakpointName;
  camera: () => WorkspaceCanvasViewport;
  setCamera: (camera: WorkspaceCanvasViewport) => void;
  fit: (containerSize: ContainerSize) => void;
  /** The definition edit view shown now (`undefined` = the pages). */
  view?: () => string | undefined;
  delayMs?: number;
}): CatalogCameraBinding {
  let shown = options.breakpoint();
  let shownView = options.view?.();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    options.memory.remember(shown, options.camera());
  };
  const show = (containerSize: ContainerSize) => {
    const saved = shownView ? undefined : options.memory.saved(shown);
    if (saved) options.setCamera(saved);
    else options.fit(containerSize);
  };
  return {
    show,
    rootReplaced(containerSize) {
      const next = options.breakpoint();
      const nextView = options.view?.();
      if (next === shown && nextView === shownView) return;
      clearTimeout(timer);
      timer = undefined;
      if (!shownView) options.memory.remember(shown, options.camera());
      shown = next;
      shownView = nextView;
      show(containerSize);
    },
    changed() {
      if (shownView) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        options.memory.remember(shown, options.camera());
      }, options.delayMs ?? 150);
    },
    flush,
  };
}
