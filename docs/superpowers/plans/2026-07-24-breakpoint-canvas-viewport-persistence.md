# Breakpoint Canvas Viewport Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `desktop`, `tablet`, `mobile` breakpoint별 Canvas 전체 `x/y/scale` viewport와 현재 선택 breakpoint를 새로고침 후에도 복원한다.

**Architecture:** `useWorkspaceCanvasSizing`을 persistence owner로 유지하고, 순수 localStorage 경계는 작은 helper 파일로 분리한다. runtime SSOT는 계속 `useViewportSyncStore`/`ViewportController`이며, localStorage는 유효한 breakpoint snapshot을 hydrate하고 viewport snapshot 변경을 debounce해 저장하는 browser preference adapter로만 사용한다. 기존 `builder-breakpoint`와 `builder.workspace.compare-split.v1` key는 변경하지 않는다.

**Tech Stack:** React 19 hooks, Zustand `subscribeWithSelector`, TypeScript, Vitest/jsdom, Playwright.

## Global Constraints

- 기존 `builder.workspace.compare-split.v1`와 `builder-breakpoint` 저장 계약을 삭제·이관·rename하지 않는다.
- 새 key는 `builder.workspace.breakpoint-viewports.v1`이다.
- 저장 항목은 유한한 `x`, `y`, `scale`이며 `scale`은 `0.1..5` 범위만 허용한다.
- 이번 범위는 Canvas 전체 pan/zoom viewport이며 내부 element `scrollTop/scrollLeft`는 저장하지 않는다.
- `canvasAreaRef`, compare pane 측정 좌표계, `ViewportController`의 runtime 권한을 변경하지 않는다.
- `window`/localStorage/JSON 오류는 workspace 동작을 중단시키지 않고 기존 기본 viewport로 fallback한다.
- 기존 dirty worktree 변경은 수정·포맷·커밋 대상에서 제외한다.
- 변경 라인은 저장/복원 요구, 회귀 테스트, 또는 검증 실패 해결에 직접 연결한다.

---

### Task 1: Breakpoint viewport storage adapter

**Files:**

- Create: `apps/builder/src/builder/workspace/hooks/workspaceCanvasViewportPersistence.ts`
- Test: `apps/builder/src/builder/workspace/hooks/workspaceCanvasViewportPersistence.test.ts`

**Interfaces:**

- Consumes: `ReadonlySet<string>` of valid breakpoint ids and `ReadonlyMap<string, WorkspaceCanvasViewport>`.
- Produces: `WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY`, `WorkspaceCanvasViewport`, `loadWorkspaceCanvasViewports()`, `saveWorkspaceCanvasViewports()` for Task 2.

- [x] **Step 1: Write the failing storage-boundary tests**

Create a jsdom test with the following cases:

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadWorkspaceCanvasViewports,
  saveWorkspaceCanvasViewports,
  WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY,
} from "./workspaceCanvasViewportPersistence";

const VALID_BREAKPOINTS = new Set(["desktop", "tablet", "mobile"]);

describe("workspace canvas viewport persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("loads valid desktop, tablet, and mobile snapshots", () => {
    window.localStorage.setItem(
      WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY,
      JSON.stringify({
        desktop: { x: 120, y: 80, scale: 1 },
        tablet: { x: -40, y: 30, scale: 0.8 },
        mobile: { x: 10, y: -20, scale: 1.2 },
      }),
    );

    expect(loadWorkspaceCanvasViewports(VALID_BREAKPOINTS)).toEqual(
      new Map([
        ["desktop", { x: 120, y: 80, scale: 1 }],
        ["tablet", { x: -40, y: 30, scale: 0.8 }],
        ["mobile", { x: 10, y: -20, scale: 1.2 }],
      ]),
    );
  });

  it("ignores malformed, partial, out-of-range, and unknown entries", () => {
    window.localStorage.setItem(
      WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY,
      JSON.stringify({
        desktop: { x: 1, y: 2, scale: 1 },
        tablet: { x: 1, y: 2 },
        mobile: { x: 1, y: 2, scale: 6 },
        laptop: { x: 1, y: 2, scale: 1 },
        invalidNumbers: { x: "1", y: 2, scale: 1 },
      }),
    );

    expect(loadWorkspaceCanvasViewports(VALID_BREAKPOINTS)).toEqual(
      new Map([["desktop", { x: 1, y: 2, scale: 1 }]]),
    );
  });

  it("returns an empty map for malformed JSON and unavailable storage", () => {
    window.localStorage.setItem(
      WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY,
      "not-json",
    );
    expect(loadWorkspaceCanvasViewports(VALID_BREAKPOINTS)).toEqual(new Map());

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });
    expect(loadWorkspaceCanvasViewports(VALID_BREAKPOINTS)).toEqual(new Map());
  });

  it("saves only valid entries for known breakpoints", () => {
    saveWorkspaceCanvasViewports(
      new Map([
        ["desktop", { x: 120, y: 80, scale: 1 }],
        ["tablet", { x: -40, y: 30, scale: 0.8 }],
        ["laptop", { x: 0, y: 0, scale: 1 }],
      ]),
      VALID_BREAKPOINTS,
    );

    expect(
      JSON.parse(
        window.localStorage.getItem(WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY) ??
          "{}",
      ),
    ).toEqual({
      desktop: { x: 120, y: 80, scale: 1 },
      tablet: { x: -40, y: 30, scale: 0.8 },
    });
  });
});
```

- [x] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm -F @composition/builder exec vitest run src/builder/workspace/hooks/workspaceCanvasViewportPersistence.test.ts
```

Expected: FAIL because `workspaceCanvasViewportPersistence.ts` and its exported storage contract do not exist yet.

- [x] **Step 3: Implement the minimal storage adapter**

Create `workspaceCanvasViewportPersistence.ts` with this contract:

```ts
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
  if (!value || typeof value !== "object") return false;
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
  if (typeof window === "undefined") return result;

  try {
    const stored = window.localStorage.getItem(
      WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY,
    );
    if (!stored) return result;

    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object") return result;

    for (const [breakpointId, value] of Object.entries(parsed)) {
      if (validBreakpointIds.has(breakpointId) && isValidViewport(value)) {
        result.set(breakpointId, value);
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
  if (typeof window === "undefined") return;

  const serializable: Record<string, WorkspaceCanvasViewport> = {};
  for (const [breakpointId, viewport] of viewports) {
    if (validBreakpointIds.has(breakpointId) && isValidViewport(viewport)) {
      serializable[breakpointId] = viewport;
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
```

Do not export `isValidViewport` or the numeric bounds; keep validation inside the browser storage boundary. Use `ReadonlyMap`/`ReadonlySet` at the public boundary so saving cannot mutate runtime state.

- [x] **Step 4: Run the focused test and verify it passes**

Run:

```bash
pnpm -F @composition/builder exec vitest run src/builder/workspace/hooks/workspaceCanvasViewportPersistence.test.ts
```

Expected: all storage adapter tests PASS.

- [x] **Step 5: Commit the isolated adapter change**

Run:

```bash
git add apps/builder/src/builder/workspace/hooks/workspaceCanvasViewportPersistence.ts apps/builder/src/builder/workspace/hooks/workspaceCanvasViewportPersistence.test.ts
git commit -m "feat(workspace): add breakpoint viewport storage adapter"
```

Expected: only the two Task 1 files are included; unrelated dirty files remain unstaged.

### Task 2: Hydrate and persist viewport snapshots in workspace sizing

**Files:**

- Modify: `apps/builder/src/builder/workspace/hooks/useWorkspaceCanvasSizing.ts:1-302`
- Test: `apps/builder/src/builder/workspace/hooks/useWorkspaceCanvasSizing.viewportPersistence.test.ts`
- Modify guard: `apps/builder/src/builder/workspace/hooks/useWorkspaceCanvasSizing.static.test.ts`

**Interfaces:**

- Consumes: `loadWorkspaceCanvasViewports`, `saveWorkspaceCanvasViewports`, and `WorkspaceCanvasViewport` from Task 1; `selectCanvasViewportSnapshot` and `isCanvasViewportSnapshotEqual` from `./../canvas/stores`.
- Produces: breakpoint-aware restore from `useWorkspaceCanvasSizing`; no new public component props.

- [x] **Step 1: Write integration tests for hydration, per-breakpoint isolation, and debounced flush**

Create a jsdom hook test with a deterministic `ResizeObserver`, `requestAnimationFrame`, and container dimensions:

```ts
// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useViewportSyncStore } from "../canvas/stores";
import { useWorkspaceCanvasSizing } from "./useWorkspaceCanvasSizing";
import { WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY } from "./workspaceCanvasViewportPersistence";

const BREAKPOINTS = [
  { id: "desktop", label: "Desktop", max_width: 1920, max_height: 1080 },
  { id: "tablet", label: "Tablet", max_width: 768, max_height: 1024 },
  { id: "mobile", label: "Mobile", max_width: 390, max_height: 844 },
];

function createRefElement(width = 1000, height = 700) {
  const element = document.createElement("div");
  Object.defineProperties(element, {
    clientWidth: { configurable: true, value: width },
    clientHeight: { configurable: true, value: height },
  });
  return { current: element };
}

function readStoredViewports() {
  return JSON.parse(
    window.localStorage.getItem(WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY) ?? "{}",
  );
}

describe("useWorkspaceCanvasSizing viewport persistence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    useViewportSyncStore.getState().reset();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  function renderSizing(initialBreakpoint = "desktop") {
    const containerRef = createRefElement();
    const canvasAreaRef = createRefElement();
    const result = renderHook(
      ({ breakpoint }) =>
        useWorkspaceCanvasSizing({
          breakpoint: new Set([breakpoint]),
          breakpoints: BREAKPOINTS,
          canvasAreaRef,
          compareMode: false,
          containerRef,
        }),
      { initialProps: { breakpoint: initialBreakpoint } },
    );
    return { ...result, containerRef, canvasAreaRef };
  }

  it("restores the persisted desktop viewport after initial sizing", () => {
    window.localStorage.setItem(
      WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY,
      JSON.stringify({ desktop: { x: 120, y: 80, scale: 1.25 } }),
    );

    renderSizing();

    expect(useViewportSyncStore.getState()).toMatchObject({
      panOffset: { x: 120, y: 80 },
      zoom: 1.25,
    });
  });

  it("flushes the active viewport and keeps snapshots isolated by breakpoint", () => {
    const rendered = renderSizing();

    act(() => {
      useViewportSyncStore.getState().setViewportSnapshot({
        panOffset: { x: 120, y: 80 },
        zoom: 1.25,
      });
      vi.advanceTimersByTime(200);
    });

    expect(readStoredViewports().desktop).toEqual({
      x: 120,
      y: 80,
      scale: 1.25,
    });

    act(() => {
      rendered.rerender({ breakpoint: "tablet" });
      useViewportSyncStore.getState().setViewportSnapshot({
        panOffset: { x: -40, y: 30 },
        zoom: 0.8,
      });
      vi.advanceTimersByTime(200);
    });

    expect(readStoredViewports()).toEqual({
      desktop: { x: 120, y: 80, scale: 1.25 },
      tablet: { x: -40, y: 30, scale: 0.8 },
    });

    act(() => {
      rendered.rerender({ breakpoint: "desktop" });
    });
    expect(useViewportSyncStore.getState()).toMatchObject({
      panOffset: { x: 120, y: 80 },
      zoom: 1.25,
    });

    act(() => {
      rendered.rerender({ breakpoint: "tablet" });
    });
    expect(useViewportSyncStore.getState()).toMatchObject({
      panOffset: { x: -40, y: 30 },
      zoom: 0.8,
    });
  });

  it("flushes the latest active snapshot on unmount", () => {
    const rendered = renderSizing();

    act(() => {
      useViewportSyncStore.getState().setViewportSnapshot({
        panOffset: { x: 55, y: -12 },
        zoom: 1,
      });
    });

    rendered.unmount();

    expect(readStoredViewports().desktop).toEqual({
      x: 55,
      y: -12,
      scale: 1,
    });
  });
});
```

The initial implementation may fail before the persistence subscription exists. If the hook currently centers asynchronously in the test environment, keep the test synchronous by making the RAF stub invoke immediately and use `act()` around every store update/rerender.

- [x] **Step 2: Run the integration test and verify it fails**

Run:

```bash
pnpm -F @composition/builder exec vitest run src/builder/workspace/hooks/useWorkspaceCanvasSizing.viewportPersistence.test.ts
```

Expected: FAIL because `useWorkspaceCanvasSizing` still uses an empty in-memory map and does not subscribe/flush viewport snapshots to the new key.

- [x] **Step 3: Add hydration, stable refs, and debounced persistence to the hook**

At the top of `useWorkspaceCanvasSizing.ts`, replace the existing single `useViewportSyncStore` import with the selector/equality helpers, then import the Task 1 adapter:

```ts
import {
  isCanvasViewportSnapshotEqual,
  selectCanvasViewportSnapshot,
  useViewportSyncStore,
} from "../canvas/stores";
import {
  loadWorkspaceCanvasViewports,
  saveWorkspaceCanvasViewports,
  type WorkspaceCanvasViewport,
} from "./workspaceCanvasViewportPersistence";
```

Replace the existing inline map type with a hydrated map and add the timer/valid-id refs immediately after `activeBreakpointIdRef`:

```ts
const validBreakpointIds = useMemo(
  () => new Set((breakpoints ?? []).map((candidate) => candidate.id)),
  [breakpoints],
);
const breakpointViewportsRef = useRef<Map<string, WorkspaceCanvasViewport>>(
  new Map(),
);
const hasHydratedViewportsRef = useRef(false);
if (!hasHydratedViewportsRef.current) {
  breakpointViewportsRef.current =
    loadWorkspaceCanvasViewports(validBreakpointIds);
  hasHydratedViewportsRef.current = true;
}
const viewportPersistenceTimerRef = useRef<ReturnType<
  typeof setTimeout
> | null>(null);
```

Add these callbacks after the map refs. They must always read the current store snapshot and must not call `setState`:

```ts
const clearViewportPersistenceTimer = useCallback(() => {
  if (viewportPersistenceTimerRef.current !== null) {
    clearTimeout(viewportPersistenceTimerRef.current);
    viewportPersistenceTimerRef.current = null;
  }
}, []);

const flushViewportPersistence = useCallback(
  (breakpointId = activeBreakpointIdRef.current) => {
    if (!breakpointId || !validBreakpointIds.has(breakpointId)) return;

    const currentViewport = useViewportSyncStore.getState();
    breakpointViewportsRef.current.set(breakpointId, {
      x: currentViewport.panOffset.x,
      y: currentViewport.panOffset.y,
      scale: currentViewport.zoom,
    });
    saveWorkspaceCanvasViewports(
      breakpointViewportsRef.current,
      validBreakpointIds,
    );
  },
  [validBreakpointIds],
);

const scheduleViewportPersistence = useCallback(() => {
  if (!activeBreakpointIdRef.current) return;

  clearViewportPersistenceTimer();
  viewportPersistenceTimerRef.current = setTimeout(() => {
    viewportPersistenceTimerRef.current = null;
    flushViewportPersistence();
  }, 150);
}, [clearViewportPersistenceTimer, flushViewportPersistence]);
```

Add one stable store subscription after the breakpoint viewport switching effect. It watches only `panOffset/zoom`, so container-size changes do not write storage:

```ts
useEffect(() => {
  const unsubscribe = useViewportSyncStore.subscribe(
    selectCanvasViewportSnapshot,
    () => {
      scheduleViewportPersistence();
    },
    { equalityFn: isCanvasViewportSnapshotEqual },
  );

  return () => {
    clearViewportPersistenceTimer();
    flushViewportPersistence();
    unsubscribe();
  };
}, [
  clearViewportPersistenceTimer,
  flushViewportPersistence,
  scheduleViewportPersistence,
]);
```

Update the existing breakpoint switching effect in this exact order:

```ts
useEffect(() => {
  const breakpointId = selectedBreakpoint?.id ?? null;
  const previousBreakpointId = activeBreakpointIdRef.current;
  if (previousBreakpointId === breakpointId) return;

  clearViewportPersistenceTimer();
  if (previousBreakpointId) {
    flushViewportPersistence(previousBreakpointId);
  }

  const currentViewport = useViewportSyncStore.getState();
  activeBreakpointIdRef.current = breakpointId;

  if (!breakpointId) return;

  const containerSize = containerSizeRef.current;
  if (containerSize.width <= 0 || containerSize.height <= 0) return;

  applyViewportState(
    resolveBreakpointViewport({
      canvasSize,
      containerSize,
      zoom: currentViewport.zoom,
      savedViewport: breakpointViewportsRef.current.get(breakpointId),
    }),
  );
}, [
  canvasSize,
  clearViewportPersistenceTimer,
  flushViewportPersistence,
  selectedBreakpoint,
]);
```

Finally, replace the two initial `centerCanvasAt100Ref.current()` calls in the ResizeObserver setup with a helper that restores the active breakpoint snapshot first:

```ts
const restoreInitialViewport = useCallback(() => {
  const containerSize = containerSizeRef.current;
  if (containerSize.width <= 0 || containerSize.height <= 0) return false;

  const savedViewport = activeBreakpointIdRef.current
    ? breakpointViewportsRef.current.get(activeBreakpointIdRef.current)
    : undefined;
  if (savedViewport) {
    applyViewportState(savedViewport);
    return true;
  }

  return centerCanvasAt100Ref.current();
}, []);
```

Place the helper after the `centerCanvasAt100Ref` synchronization effect, use it for the initial-load branches, and leave the existing `isFitModeRef.current` branch unchanged. The helper must be refreshed through a ref or use the existing `centerCanvasAt100Ref`; it must not capture a stale `canvasSize` or breakpoint id.

- [x] **Step 4: Run focused hook and existing sizing tests**

Run:

```bash
pnpm -F @composition/builder exec vitest run \
  src/builder/workspace/hooks/workspaceCanvasViewportPersistence.test.ts \
  src/builder/workspace/hooks/useWorkspaceCanvasSizing.viewportPersistence.test.ts \
  src/builder/workspace/hooks/useWorkspaceCanvasSizing.static.test.ts
```

Expected: all storage, hydration/isolation, unmount flush, and compare `canvasAreaRef` guard tests PASS.

- [x] **Step 5: Run the builder type-check gate**

Run:

```bash
pnpm run codex:typecheck
```

Expected: the repository baseline remains clean and no new TypeScript error is reported in the workspace hook or storage adapter.

- [x] **Step 6: Commit the hook integration**

Run:

```bash
git add apps/builder/src/builder/workspace/hooks/useWorkspaceCanvasSizing.ts apps/builder/src/builder/workspace/hooks/useWorkspaceCanvasSizing.viewportPersistence.test.ts apps/builder/src/builder/workspace/hooks/useWorkspaceCanvasSizing.static.test.ts
git commit -m "feat(workspace): persist breakpoint canvas viewports"
```

Expected: only the hook and its integration test are included; Task 1 remains independently committed.

### Task 3: User-visible changelog and verification evidence

**Files:**

- Modify: `docs/CHANGELOG.md` at the top of the current `2026-07-24` entries
- Do not modify: `Workspace.tsx`, `WorkspaceCompareMode.tsx`, `Workspace.css`, `BuilderCanvas.tsx`, Spec/CSS renderer files

**Interfaces:**

- Consumes: Task 1 storage key and Task 2 behavior.
- Produces: user-visible changelog entry and verification evidence for refresh and three-breakpoint isolation.

- [x] **Step 1: Add a concise changelog entry**

Add a new top entry using the existing format:

```markdown
## [Breakpoint별 Canvas viewport 복원] - 2026-07-24

### Features

- `desktop`/`tablet`/`mobile` breakpoint별 Canvas 전체 pan 위치와 zoom을
  `builder.workspace.breakpoint-viewports.v1`에 저장하고 새로고침 후 복원.
- 기존 선택 breakpoint(`builder-breakpoint`)와 Compare Mode split
  (`builder.workspace.compare-split.v1`) 저장 계약은 유지.
```

- [x] **Step 2: Run the focused regression suite and preflight**

Run:

```bash
pnpm -F @composition/builder exec vitest run \
  src/builder/workspace/hooks/workspaceCanvasViewportPersistence.test.ts \
  src/builder/workspace/hooks/useWorkspaceCanvasSizing.viewportPersistence.test.ts \
  src/builder/workspace/hooks/useWorkspaceCanvasSizing.static.test.ts
pnpm run codex:preflight
```

Expected: focused tests PASS; `codex:preflight` completes without new guard, format, type-check, or registration errors. Do not modify unrelated dirty files if the formatter reports them outside this change.

- [x] **Step 3: Run the real Builder browser smoke**

Use the existing authenticated Builder/Playwright setup. In one real project:

1. Confirm `builder.workspace.compare-split.v1` has a known value and enter Compare Mode.
2. On `desktop`, pan/zoom Canvas to a distinctive position and select `tablet`.
3. On `tablet`, pan/zoom to a different position and select `mobile`.
4. On `mobile`, pan/zoom to a third position; reload the page.
5. Assert the selected breakpoint remains `mobile` through `builder-breakpoint`.
6. Switch to `desktop`, `tablet`, and `mobile`; confirm each viewport is restored independently.
7. Confirm Compare split remains the prior value and CSS Preview/Skia Canvas remain in their existing compare panes.

Record the observed storage payload and viewport snapshots in the final response. If no authenticated Builder or dev server is available, report browser verification as blocked with the exact missing prerequisite; do not claim it passed from unit tests alone.

- [x] **Step 4: Run the cross-check scope review**

Because this feature changes Canvas viewport state but not component rendering geometry, verify the five consumer layers remain untouched:

| Layer               | Check                                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Spec                | No `packages/specs` file changed                                                                                                        |
| Factory             | No factory default/layout contract changed                                                                                              |
| CSS Renderer        | `Workspace.css` and shared component CSS unchanged                                                                                      |
| WebGL/Skia Renderer | `BuilderCanvas`, `SkiaCanvas`, `ViewportController` runtime contract unchanged except the existing `useViewportSyncStore` consumer path |
| Preview Renderer    | iframe Preview and `fallbackCanvas` wiring unchanged                                                                                    |

If a test exposes a viewport application timing regression, fix the persistence/hydration seam and add the smallest regression test; do not tune component layout or introduce CSS compensation.

- [x] **Step 5: Record final documentation and verification**

Run:

```bash
git add docs/superpowers/plans/2026-07-24-breakpoint-canvas-viewport-persistence.md
git commit -m "docs: record breakpoint viewport persistence plan"
git status --short
```

Expected: the changelog entry is already present in repository history, the execution plan is committed separately, and `git status --short` shows only the pre-existing unrelated user changes (if any).

## Plan Self-Review

- Spec coverage: storage schema/validation is Task 1; hydration, per-breakpoint isolation, debounce, breakpoint flush, zero-size fallback, and unmount flush are Task 2; existing key compatibility, changelog, preflight, browser reload proof, and cross-check scope are Task 3.
- Placeholder scan: no unresolved placeholder or unspecified validation step remains; every implementation step names exact files, exports, commands, and expected outcomes.
- Type consistency: Task 1 exports `WorkspaceCanvasViewport`, `loadWorkspaceCanvasViewports`, `saveWorkspaceCanvasViewports`, and `WORKSPACE_CANVAS_VIEWPORT_STORAGE_KEY`; Task 2 consumes those exact names and uses the existing `selectCanvasViewportSnapshot`/`isCanvasViewportSnapshotEqual` exports.
- Scope: no new Zustand persistence store, no change to `ViewportController` authority, no nested element scroll persistence, and no Spec/CSS/renderer edits.
