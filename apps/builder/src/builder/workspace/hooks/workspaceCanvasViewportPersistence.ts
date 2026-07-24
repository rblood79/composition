export const WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY =
  "builder.workspace.breakpoint-viewports.v1";

const MIN_CANVAS_ZOOM = 0.1;
const MAX_CANVAS_ZOOM = 5;

export interface WorkspaceCanvasViewport {
  x: number;
  y: number;
  scale: number;
}

function isValidViewport(value: unknown): value is WorkspaceCanvasViewport {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.x === "number" &&
    Number.isFinite(candidate.x) &&
    typeof candidate.y === "number" &&
    Number.isFinite(candidate.y) &&
    typeof candidate.scale === "number" &&
    Number.isFinite(candidate.scale) &&
    candidate.scale >= MIN_CANVAS_ZOOM &&
    candidate.scale <= MAX_CANVAS_ZOOM
  );
}

export function loadWorkspaceCanvasViewports(
  validBreakpointIds: ReadonlySet<string>,
): Map<string, WorkspaceCanvasViewport> {
  const result = new Map<string, WorkspaceCanvasViewport>();
  if (typeof window === "undefined") {
    return result;
  }

  try {
    const stored = window.localStorage.getItem(
      WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY,
    );
    if (!stored) {
      return result;
    }

    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") {
      return result;
    }

    for (const [breakpointId, value] of Object.entries(parsed)) {
      if (validBreakpointIds.has(breakpointId) && isValidViewport(value)) {
        result.set(breakpointId, {
          x: value.x,
          y: value.y,
          scale: value.scale,
        });
      }
    }
  } catch {
    // localStorage/JSON 오류는 기본 viewport fallback으로 처리한다.
  }

  return result;
}

export function saveWorkspaceCanvasViewports(
  viewports: ReadonlyMap<string, WorkspaceCanvasViewport>,
  validBreakpointIds: ReadonlySet<string>,
): void {
  if (typeof window === "undefined") {
    return;
  }

  const serializable: Record<string, WorkspaceCanvasViewport> = {};
  for (const [breakpointId, viewport] of viewports) {
    if (validBreakpointIds.has(breakpointId) && isValidViewport(viewport)) {
      serializable[breakpointId] = {
        x: viewport.x,
        y: viewport.y,
        scale: viewport.scale,
      };
    }
  }

  try {
    window.localStorage.setItem(
      WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY,
      JSON.stringify(serializable),
    );
  } catch {
    // localStorage quota/security 오류가 runtime viewport를 막지 않게 한다.
  }
}
