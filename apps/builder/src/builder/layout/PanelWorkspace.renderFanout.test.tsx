// @vitest-environment jsdom

/**
 * coordinator flush 한 번이 React 컴포넌트를 몇 개 다시 렌더하는지 세는 회귀 게이트.
 *
 * 패널 resize·move 는 매 프레임 coordinator snapshot 을 새로 만든다. overlay 루트가
 * snapshot 전체를 구독하면 flush 마다 PanelDock → render-prop → frame 12개 element 가
 * 전부 다시 만들어져 (2026-09-02 실측: fiber 103개/flush, ~20 MB/s 할당) GC 가 프레임을
 * 삼킨다. 구독을 leaf 로 내린 뒤에는 geometry 가 바뀐 frame 과 splitter 계층만 렌더돼야
 * 한다. 이 파일은 그 상한을 fiber 순회로 고정한다.
 *
 * 측정 방법: commit 전 current 트리의 fiber 객체 집합을 기억해 두고, commit 뒤 트리에서
 * "새 객체 (이번 commit 에 방문됨)" 이면서 `PerformedWork` flag 가 켜진 (bailout 이 아니라
 * 실제 함수가 실행된) 컴포넌트 fiber 만 센다 — React DevTools 의 "highlight updates" 와
 * 같은 기준이다.
 *
 * React 내부 의존 (공개 API 아님, react-dom 19.2.8 에서 실측 확인): `PerformedWork = 0b1`,
 * fiber tag 0/11/14/15, 컨테이너의 `__reactContainer$*` 키. React major 를 올릴 때 이 상수가
 * 바뀌면 실패가 아니라 조용한 과소/과다 카운트가 되므로, 업그레이드 시 이 파일의 두 시나리오를
 * 일부러 깨뜨려 (예: overlay 에 snapshot 전체 구독을 잠시 되돌려) RED 가 나는지 다시 확인한다.
 * 한 측정 창 = commit 하나 (`act` 한 번) 여야 한다 — commit 이 둘이면 첫 commit 에서 렌더된
 * fiber 가 둘째 commit 의 bailout 방문으로 이전 객체로 돌아가 카운트에서 빠진다.
 */

import { act, fireEvent, render } from "@testing-library/react";
import { PanelLeft } from "lucide-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { I18nProvider } from "../../i18n";
import type { PanelConfig } from "../panels/core/types";
import { PanelRegistry } from "../panels/core/PanelRegistry";
import { useStore } from "../stores";
import {
  PANEL_WORKSPACE_TEST_REGISTRY,
  createPanelWorkspaceLayoutV2,
} from "./panelWorkspaceLayoutV2.testFixtures";
import { createPanelWorkspaceRegistryEntry } from "./panelWorkspaceLayoutV2";
import type { PanelWorkspaceLayoutV4 } from "./panelWorkspaceLayoutV4";
import { migratePanelWorkspaceLayoutV2ToV4 } from "./panelWorkspaceLayoutV4Migration";
import { PanelWorkspace } from "./PanelWorkspace";

const TEST_CONFIGS: PanelConfig[] = PANEL_WORKSPACE_TEST_REGISTRY.map(
  (entry): PanelConfig => ({
    id: entry.id,
    name: entry.id,
    icon: PanelLeft,
    component: () => null,
    category: "editor",
    defaultPosition: entry.defaultPosition,
    defaultWidth: entry.defaultWidth,
    minWidth: entry.minWidth,
    maxWidth: entry.maxWidth,
    defaultHeight: entry.defaultHeight,
    minHeight: entry.minHeight,
    maxHeight: entry.maxHeight,
  }),
);

const TEST_REGISTRY = TEST_CONFIGS.map((config) =>
  createPanelWorkspaceRegistryEntry(config),
);

function migrateFixture(): PanelWorkspaceLayoutV4 {
  const migrated = migratePanelWorkspaceLayoutV2ToV4(
    createPanelWorkspaceLayoutV2(),
    TEST_REGISTRY,
    {
      surfaceRect: { width: 1600, height: 852 },
      migrationId: "panel-workspace-render-fanout-fixture",
    },
  );
  if (!migrated.ok) throw new Error(migrated.error);
  return migrated.value;
}

function renderPanelWorkspace(ui: ReactElement) {
  return render(<I18nProvider initialLocale="en-US">{ui}</I18nProvider>);
}

// ── fiber 순회 기반 렌더 카운터 ─────────────────────────────────────────────

interface FiberLike {
  tag: number;
  flags: number;
  type: unknown;
  child: FiberLike | null;
  sibling: FiberLike | null;
  stateNode: unknown;
}

const PERFORMED_WORK = 0b1;
// FunctionComponent · ForwardRef · MemoComponent · SimpleMemoComponent
const COMPONENT_TAGS = new Set([0, 11, 14, 15]);

function currentRootFiber(container: HTMLElement): FiberLike {
  const record = container as unknown as Record<string, unknown>;
  const key = Object.keys(record).find((name) =>
    name.startsWith("__reactContainer$"),
  );
  if (!key) throw new Error("React container fiber key not found");
  const hostRoot = record[key] as FiberLike;
  const fiberRoot = hostRoot.stateNode as { current: FiberLike };
  return fiberRoot.current;
}

function collectFibers(root: FiberLike): FiberLike[] {
  const out: FiberLike[] = [];
  const stack: FiberLike[] = [root];
  while (stack.length > 0) {
    const fiber = stack.pop() as FiberLike;
    out.push(fiber);
    if (fiber !== root && fiber.sibling) stack.push(fiber.sibling);
    if (fiber.child) stack.push(fiber.child);
  }
  return out;
}

function componentName(fiber: FiberLike): string {
  const type = fiber.type as {
    displayName?: string;
    name?: string;
    type?: unknown;
    render?: unknown;
  } | null;
  if (!type) return "(anonymous)";
  if (typeof type === "function") {
    const fn = type as { displayName?: string; name?: string };
    return fn.displayName || fn.name || "(anonymous)";
  }
  const inner = (type.type ?? type.render) as
    { displayName?: string; name?: string } | undefined;
  return type.displayName || inner?.displayName || inner?.name || "(anonymous)";
}

/** `action` 이 일으킨 commit 에서 실제로 함수가 실행된 컴포넌트를 이름별로 센다. */
function countRenders(
  container: HTMLElement,
  action: () => void,
): Map<string, number> {
  const before = new Set(collectFibers(currentRootFiber(container)));
  act(action);
  const counts = new Map<string, number>();
  for (const fiber of collectFibers(currentRootFiber(container))) {
    if (before.has(fiber)) continue; // 이번 commit 에 방문되지 않음
    if (!COMPONENT_TAGS.has(fiber.tag)) continue;
    if ((fiber.flags & PERFORMED_WORK) === 0) continue; // memo bailout
    const name = componentName(fiber);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

function renders(counts: Map<string, number>, name: string): number {
  return counts.get(name) ?? 0;
}

// ── 입력 구동 ───────────────────────────────────────────────────────────────

function dispatchPointer(
  target: Element | Window,
  type: "pointerdown" | "pointermove" | "pointerup",
  clientX: number,
  clientY = 20,
) {
  const event = new MouseEvent(type, {
    bubbles: true,
    button: 0,
    clientX,
    clientY,
  });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    pointerType: { value: "mouse" },
  });
  fireEvent(target, event);
}

function frameStyles(container: HTMLElement): Map<string, string> {
  return new Map(
    [...container.querySelectorAll<HTMLElement>(".workspace-panel-frame")].map(
      (frame) => [frame.dataset.panel ?? "", frame.style.cssText] as const,
    ),
  );
}

function changedFrameCount(
  before: Map<string, string>,
  after: Map<string, string>,
): number {
  let changed = 0;
  for (const [panelId, style] of after) {
    if (before.get(panelId) !== style) changed += 1;
  }
  return changed;
}

describe("PanelWorkspace coordinator flush 당 렌더 fan-out", () => {
  let frameQueue: FrameRequestCallback[] = [];
  const flushFrames = (): void => {
    const callbacks = frameQueue.splice(0);
    for (const callback of callbacks) callback(performance.now());
  };

  beforeEach(() => {
    frameQueue = [];
    Object.defineProperty(Element.prototype, "getAnimations", {
      configurable: true,
      value: () => [],
    });
    vi.stubGlobal("PointerEvent", MouseEvent);
    vi.spyOn(PanelRegistry, "getAllPanels").mockReturnValue(TEST_CONFIGS);
    vi.spyOn(PanelRegistry, "getPanel").mockImplementation((panelId) =>
      TEST_CONFIGS.find((config) => config.id === panelId),
    );
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frameQueue.push(callback);
      return frameQueue.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1600,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 900,
    });
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1600);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(852);
    useStore.getState().initializePanelWorkspaceLayout(TEST_REGISTRY, {
      width: 1592,
      height: 844,
    });
    useStore.setState({
      panelWorkspaceLayout: migrateFixture(),
      panelWorkspaceHydrationStatus: "memory-fallback",
      panelWorkspaceHydrationError: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("resize flush 는 geometry 가 바뀐 frame 만 렌더하고 overlay 루트·dock·toggle rail 은 건드리지 않는다", () => {
    const { container } = renderPanelWorkspace(
      <PanelWorkspace chrome={<div />}>
        <div />
      </PanelWorkspace>,
    );
    act(flushFrames);

    const splitter = container.querySelector<HTMLElement>(
      '.workspace-panel-frame[data-panel="navigator"] .panel-resize-handle[data-edge="right"]',
    );
    if (!splitter) throw new Error("navigator right splitter not rendered");

    // 첫 move 는 useMove 의 onMoveStart (beginInteraction) 를 겸하므로 제외하고,
    // 정상 상태의 두 번째 move + flush 를 잰다.
    act(() => {
      dispatchPointer(splitter, "pointerdown", 300);
      dispatchPointer(window, "pointermove", 312);
      flushFrames();
    });

    const stylesBefore = frameStyles(container);
    const counts = countRenders(container, () => {
      dispatchPointer(window, "pointermove", 324);
      flushFrames();
    });
    const changedFrames = changedFrameCount(
      stylesBefore,
      frameStyles(container),
    );

    expect(changedFrames).toBeGreaterThanOrEqual(1);
    expect(renders(counts, "PanelFrame")).toBe(changedFrames);
    expect(renders(counts, "SnapshotPanelFrame")).toBe(changedFrames);
    expect(renders(counts, "PanelWorkspaceOverlay")).toBe(0);
    expect(renders(counts, "PanelDock")).toBe(0);
    expect(renders(counts, "PanelToggleGroup")).toBe(0);
    expect(renders(counts, "PanelFrameContent")).toBe(0);
    expect(renders(counts, "HydratedPanelWorkspace")).toBe(0);

    act(() => {
      dispatchPointer(window, "pointerup", 324);
      flushFrames();
    });
  });

  it("move preview flush 는 끌리는 frame 하나만 렌더한다", () => {
    const { container } = renderPanelWorkspace(
      <PanelWorkspace chrome={<div />}>
        <div />
      </PanelWorkspace>,
    );
    act(flushFrames);

    const handle = container.querySelector<HTMLElement>(
      '.workspace-panel-frame[data-panel="navigator"] .panel-move-handle',
    );
    if (!handle) throw new Error("navigator move handle not rendered");

    // 첫 move 는 setIsMoving(true) 로 frame 자신을 다시 렌더하므로 제외.
    act(() => {
      dispatchPointer(handle, "pointerdown", 40, 40);
      dispatchPointer(window, "pointermove", 52, 52);
      flushFrames();
    });

    const counts = countRenders(container, () => {
      dispatchPointer(window, "pointermove", 64, 64);
      flushFrames();
    });

    expect(renders(counts, "PanelFrame")).toBe(1);
    expect(renders(counts, "SnapshotPanelFrame")).toBe(1);
    expect(renders(counts, "PanelWorkspaceOverlay")).toBe(0);
    expect(renders(counts, "PanelDock")).toBe(0);
    expect(renders(counts, "PanelToggleGroup")).toBe(0);
    expect(renders(counts, "PanelFrameContent")).toBe(0);

    act(() => {
      dispatchPointer(window, "pointerup", 64, 64);
      flushFrames();
    });
  });
});
