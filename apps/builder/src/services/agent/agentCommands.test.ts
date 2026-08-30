/**
 * ADR-196 Phase 1 — `AGENT_COMMANDS` adapter parity (G1).
 *
 * 1. 정적 대조 — adapter 파일이 import 하는 심볼 = Phase 0 표의 "handler → 호출 심볼"
 *    (breakdown §2 Phase 0 실측 결과). 다른 store 의 같은 이름 함수 (`canvasStore.setZoom`)
 *    와 registry/handler 경로는 import 금지.
 * 2. jsdom spy — 각 adapter 가 그 심볼을 정확히 1회, handler 와 같은 인자로 부른다.
 *
 * 결과 동일성 (parity) 의 oracle 은 handler 경로 live 대조 (G3) — 여기서는 호출
 * 심볼·인자만 본다 (measurement-validity §2 #3/#4: callee 를 직접 불러 비교하는
 * 자기 확인은 oracle 이 아니다).
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../../builder/stores";
import { useViewportSyncStore } from "../../builder/workspace/canvas/stores";
import * as canvasActions from "../../builder/workspace/canvas/actions/canvasActions";
import * as viewportActions from "../../builder/workspace/canvas/viewport/viewportActions";
import * as guideEmphasis from "../../builder/workspace/canvas/interaction/guideEmphasis";
import * as pageGuideActions from "../../builder/workspace/canvas/viewport/pageGuideActions";
import * as panelLayout from "../../builder/hooks/usePanelLayout";
import * as editingSemantics from "../../builder/utils/editingSemantics";
import { useSectionCollapse } from "../../builder/panels/styles/hooks/useSectionCollapse";
import { AGENT_COMMANDS, type AgentCommandInput } from "./agentCommands";
import type { ShortcutId } from "../../builder/config/keyboardShortcuts";

vi.mock(
  "../../builder/workspace/canvas/actions/canvasActions",
  async (orig) => {
    const actual =
      await orig<
        typeof import("../../builder/workspace/canvas/actions/canvasActions")
      >();
    return {
      ...actual,
      copySelection: vi.fn(async () => true),
      cutSelection: vi.fn(async () => undefined),
      paste: vi.fn(async () => undefined),
      deleteSelection: vi.fn(async () => undefined),
      duplicateSelection: vi.fn(async () => undefined),
      groupSelection: vi.fn(async () => undefined),
      ungroupSelection: vi.fn(async () => undefined),
      alignSelection: vi.fn(async () => undefined),
      distributeSelection: vi.fn(async () => undefined),
    };
  },
);
vi.mock(
  "../../builder/workspace/canvas/viewport/viewportActions",
  async (orig) => {
    const actual =
      await orig<
        typeof import("../../builder/workspace/canvas/viewport/viewportActions")
      >();
    return {
      ...actual,
      zoomViewportAtContainerCenter: vi.fn(),
      computeFitViewport: vi.fn(() => ({ scale: 0.5, x: 1, y: 2 })),
      applyViewportState: vi.fn(),
    };
  },
);
vi.mock(
  "../../builder/workspace/canvas/interaction/guideEmphasis",
  async (orig) => {
    const actual =
      await orig<
        typeof import("../../builder/workspace/canvas/interaction/guideEmphasis")
      >();
    return {
      ...actual,
      getSelectedGuide: vi.fn(() => null),
      clearGuideSelection: vi.fn(),
    };
  },
);
vi.mock(
  "../../builder/workspace/canvas/viewport/pageGuideActions",
  async (orig) => {
    const actual =
      await orig<
        typeof import("../../builder/workspace/canvas/viewport/pageGuideActions")
      >();
    return { ...actual, deletePageGuide: vi.fn() };
  },
);
vi.mock("../../builder/hooks/usePanelLayout", async (orig) => {
  const actual =
    await orig<typeof import("../../builder/hooks/usePanelLayout")>();
  return { ...actual, togglePanelWorkspace: vi.fn() };
});
vi.mock("../../builder/utils/editingSemantics", async (orig) => {
  const actual =
    await orig<typeof import("../../builder/utils/editingSemantics")>();
  return { ...actual, canDetachInstance: vi.fn(() => true) };
});

// ---------- 1. 정적 대조 ----------

/** Phase 0 표 — 심볼 → import 모듈 경로 조각 */
const EXPECTED_IMPORTS: Array<[symbol: string, moduleFragment: string]> = [
  ["copySelection", "workspace/canvas/actions/canvasActions"],
  ["cutSelection", "workspace/canvas/actions/canvasActions"],
  ["paste", "workspace/canvas/actions/canvasActions"],
  ["deleteSelection", "workspace/canvas/actions/canvasActions"],
  ["duplicateSelection", "workspace/canvas/actions/canvasActions"],
  ["groupSelection", "workspace/canvas/actions/canvasActions"],
  ["ungroupSelection", "workspace/canvas/actions/canvasActions"],
  ["alignSelection", "workspace/canvas/actions/canvasActions"],
  ["distributeSelection", "workspace/canvas/actions/canvasActions"],
  [
    "zoomViewportAtContainerCenter",
    "workspace/canvas/viewport/viewportActions",
  ],
  ["computeFitViewport", "workspace/canvas/viewport/viewportActions"],
  ["applyViewportState", "workspace/canvas/viewport/viewportActions"],
  ["useViewportSyncStore", "workspace/canvas/stores"],
  ["getSelectedGuide", "workspace/canvas/interaction/guideEmphasis"],
  ["clearGuideSelection", "workspace/canvas/interaction/guideEmphasis"],
  ["deletePageGuide", "workspace/canvas/viewport/pageGuideActions"],
  ["togglePanelWorkspace", "hooks/usePanelLayout"],
  ["useSectionCollapse", "panels/styles/hooks/useSectionCollapse"],
  ["canDetachInstance", "utils/editingSemantics"],
  ["useStore", "builder/stores"],
  // ADR-199 Phase 3 — 컴포넌트 시맨틱 2 명령은 store 액션을 직접 부르지 않고
  // 공통 실행 경로를 거친다 (확인 문구·payload 조립이 4 표면 한 벌).
  ["runComponentSemanticsAction", "builder/utils/componentSemanticsRunner"],
];
/** root store 액션 — `useStore.getState()` 경유 호출 (Phase 0 표) */
const EXPECTED_STORE_CALLS = [
  ".undo()",
  ".redo()",
  "setShowRulers(",
  "moveElementToSiblingEdge(",
  "reorderElementWithinParent(",
  "getPageElements(",
  "setSelectedElements(",
];
const FORBIDDEN = [
  "canvasStore",
  "commandRegistry",
  "resolveCommand",
  "useKeyboardShortcutsRegistry",
  "bindHandlersToDefinitions",
  "useGlobalKeyboardShortcuts",
  "CanvasSelectionShortcuts",
];

/** 주석 제거 — 금지 심볼은 코드에서만 본다 (주석의 언급은 설명일 뿐) */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function importBlocks(source: string): Array<{ names: string; from: string }> {
  return [...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g)].map(
    (m) => ({ names: m[1], from: m[2] }),
  );
}

describe("AGENT_COMMANDS 정적 대조 — Phase 0 표의 handler 호출 심볼", () => {
  let source = "";
  let hookSource = "";
  beforeEach(async () => {
    source = await readFile(resolve(__dirname, "agentCommands.ts"), "utf-8");
    hookSource = await readFile(
      resolve(__dirname, "../../builder/hooks/useGlobalKeyboardShortcuts.ts"),
      "utf-8",
    );
  });

  it.each(EXPECTED_IMPORTS)("%s 를 %s 에서 import 한다", (symbol, fragment) => {
    const hit = importBlocks(source).find(
      (b) =>
        b.from.includes(fragment) &&
        new RegExp(`(^|[\\s,])${symbol}(\\s*,|\\s*$|\\s*})`).test(b.names),
    );
    expect(hit, `${symbol} from *${fragment}`).toBeDefined();
  });

  it.each(EXPECTED_STORE_CALLS)("root store 액션 %s 를 부른다", (call) => {
    expect(source).toContain(call);
  });

  // toggleComponentOrigin / detachInstance 는 ADR-199 Phase 3 에서 공통 실행
  // 경로로 옮겼다. 게이트의 뜻은 그대로다 — agent handler 가 그 액션의 실행
  // 경로를 실제로 부르는가. 부르는 대상만 store 직접 호출에서 러너로 바뀐다.
  it.each([
    ["toggle-component-origin"],
    ["detach-instance"],
  ])("컴포넌트 시맨틱 %s 를 공통 실행 경로로 부른다", (actionId) => {
    expect(source).toContain(`runComponentSemanticsAction("${actionId}"`);
  });

  it("agent detach 는 확인을 건너뛴다 (executor confirm 게이트가 이미 묻는다)", () => {
    expect(source).toContain('confirm: "skip"');
  });

  it.each(FORBIDDEN)("금지 심볼 %s 를 참조하지 않는다 (주석 제외)", (name) => {
    expect(stripComments(source)).not.toContain(name);
  });

  it("paste 는 batch history (Phase 0 실측 — per-element 는 N entry)", () => {
    expect(source).toContain('pasteHistory: "batch"');
  });

  it("zoom step 은 handler 상수와 같다", () => {
    const hook = hookSource.match(/const ZOOM_STEP = ([\d.]+)/)?.[1];
    const adapter = source.match(/const AGENT_ZOOM_STEP = ([\d.]+)/)?.[1];
    expect(hook).toBeDefined();
    expect(adapter).toBe(hook);
  });
});

// ---------- 2. jsdom spy ----------

const originalStore = {
  undo: useStore.getState().undo,
  redo: useStore.getState().redo,
  setShowRulers: useStore.getState().setShowRulers,
  toggleComponentOrigin: useStore.getState().toggleComponentOrigin,
  detachInstance: useStore.getState().detachInstance,
  moveElementToSiblingEdge: useStore.getState().moveElementToSiblingEdge,
  reorderElementWithinParent: useStore.getState().reorderElementWithinParent,
  getPageElements: useStore.getState().getPageElements,
  setSelectedElements: useStore.getState().setSelectedElements,
} as const;

type Spies = { [K in keyof typeof originalStore]: ReturnType<typeof vi.fn> };

function seedStore(selected: string[]): Spies {
  const spies = {
    undo: vi.fn(async () => undefined),
    redo: vi.fn(async () => undefined),
    setShowRulers: vi.fn(),
    toggleComponentOrigin: vi.fn(async () => null),
    detachInstance: vi.fn(() => null),
    moveElementToSiblingEdge: vi.fn(() => true),
    reorderElementWithinParent: vi.fn(() => true),
    getPageElements: vi.fn(() => [{ id: "a" }, { id: "b" }]),
    setSelectedElements: vi.fn(),
  };
  const elementsMap = new Map(
    ["a", "b"].map((id) => [
      id,
      { id, type: "Button", props: {}, parent_id: "body", page_id: "page-1" },
    ]),
  );
  useStore.setState({
    ...spies,
    showRulers: false,
    activeBreakpoint: "desktop",
    currentPageId: "page-1",
    selectedElementId: selected[0] ?? null,
    selectedElementIds: selected,
    elementsMap,
  } as never);
  useViewportSyncStore.setState({
    zoom: 1,
    containerSize: { width: 800, height: 600 },
    canvasSize: { width: 1000, height: 1000 },
  } as never);
  return spies as Spies;
}

function input(): AgentCommandInput {
  return {
    elementsMap: useStore.getState().elementsMap as never,
    clipboard: {
      read: async () => "clip",
      write: async () => true,
    },
  };
}

const run = (id: ShortcutId, i = input()) => AGENT_COMMANDS[id]!(i);

describe("AGENT_COMMANDS jsdom spy — 심볼 1회 호출, handler 와 같은 인자", () => {
  let spies: Spies;
  beforeEach(() => {
    vi.clearAllMocks();
    spies = seedStore(["a"]);
  });
  afterEach(() => {
    useStore.setState({ ...originalStore } as never);
  });

  it("undo / redo → store.undo / store.redo", async () => {
    await run("undo");
    await run("redo");
    expect(spies.undo).toHaveBeenCalledTimes(1);
    expect(spies.redo).toHaveBeenCalledTimes(1);
  });

  it("zoomIn / zoomOut / zoom100 / zoom200 → zoomViewportAtContainerCenter(현재 zoom ± step)", async () => {
    await run("zoomIn");
    await run("zoomOut");
    await run("zoom100");
    await run("zoom200");
    expect(
      vi.mocked(viewportActions.zoomViewportAtContainerCenter).mock.calls,
    ).toEqual([[1.1], [0.9], [1], [2]]);
  });

  it("zoomToFit → computeFitViewport({canvasSize, containerSize}) → applyViewportState; containerSize 0 이면 no-op", async () => {
    await run("zoomToFit");
    expect(viewportActions.computeFitViewport).toHaveBeenCalledWith({
      canvasSize: { width: 1000, height: 1000 },
      containerSize: { width: 800, height: 600 },
    });
    expect(viewportActions.applyViewportState).toHaveBeenCalledWith({
      scale: 0.5,
      x: 1,
      y: 2,
    });
    useViewportSyncStore.setState({
      containerSize: { width: 0, height: 0 },
    } as never);
    await run("zoomToFit");
    expect(viewportActions.computeFitViewport).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["toggleNavigator", "navigator"],
    ["toggleComponents", "components"],
    ["toggleDatatable", "datatable"],
    ["toggleTheme", "theme"],
    ["toggleProperties", "properties"],
    ["toggleStyles", "styles"],
    ["toggleEvents", "events"],
    ["toggleHistory", "history"],
    ["openSettings", "settings"],
  ] as Array<[ShortcutId, string]>)(
    "%s → togglePanelWorkspace(%s)",
    async (id, panelId) => {
      await run(id);
      expect(panelLayout.togglePanelWorkspace).toHaveBeenCalledTimes(1);
      expect(panelLayout.togglePanelWorkspace).toHaveBeenCalledWith(panelId);
    },
  );

  it("toggleRulers → setShowRulers(!showRulers)", async () => {
    await run("toggleRulers");
    expect(spies.setShowRulers).toHaveBeenCalledWith(true);
  });

  it("toggleFocusMode → useSectionCollapse.toggleFocusMode (전역 store)", async () => {
    const before = useSectionCollapse.getState().focusMode;
    await run("toggleFocusMode");
    expect(useSectionCollapse.getState().focusMode).toBe(!before);
    useSectionCollapse.getState().toggleFocusMode();
  });

  it("copy → copySelection(elementsMap, writeClipboardText, requireCurrentPageForCopy)", async () => {
    const i = input();
    await run("copy", i);
    expect(canvasActions.copySelection).toHaveBeenCalledTimes(1);
    expect(canvasActions.copySelection).toHaveBeenCalledWith({
      elementsMap: i.elementsMap,
      writeClipboardText: i.clipboard?.write,
      requireCurrentPageForCopy: true,
    });
  });

  it("paste → paste(elementsMap, readClipboardText, pasteHistory batch)", async () => {
    const i = input();
    await run("paste", i);
    expect(canvasActions.paste).toHaveBeenCalledWith({
      elementsMap: i.elementsMap,
      readClipboardText: i.clipboard?.read,
      pasteHistory: "batch",
    });
  });

  it("cut → cutSelection(handler 와 같은 컨텍스트)", async () => {
    const i = input();
    await run("cut", i);
    expect(canvasActions.cutSelection).toHaveBeenCalledWith({
      elementsMap: i.elementsMap,
      writeClipboardText: i.clipboard?.write,
      requireCurrentPageForCopy: true,
    });
  });

  it("delete → deleteSelection; 가이드 선택 중이면 deletePageGuide 로 분기 (handler 부가 동작)", async () => {
    const i = input();
    await run("delete", i);
    expect(canvasActions.deleteSelection).toHaveBeenCalledWith({
      elementsMap: i.elementsMap,
    });

    vi.mocked(guideEmphasis.getSelectedGuide).mockReturnValueOnce({
      pageId: "page-1",
      guideId: "g1",
    } as never);
    await run("delete", i);
    expect(guideEmphasis.clearGuideSelection).toHaveBeenCalledTimes(1);
    expect(pageGuideActions.deletePageGuide).toHaveBeenCalledWith(
      "page-1",
      "g1",
      "desktop",
    );
    expect(canvasActions.deleteSelection).toHaveBeenCalledTimes(1);
  });

  it("toggleComponentOrigin → toggleComponentOrigin(selectedElementId)", async () => {
    await run("toggleComponentOrigin");
    expect(spies.toggleComponentOrigin).toHaveBeenCalledWith("a");
  });

  it("detachInstance → canDetachInstance 통과 시 detachInstance(id); 아니면 호출 0", async () => {
    await run("detachInstance");
    expect(spies.detachInstance).toHaveBeenCalledWith("a");
    vi.mocked(editingSemantics.canDetachInstance).mockReturnValueOnce(false);
    await run("detachInstance");
    expect(spies.detachInstance).toHaveBeenCalledTimes(1);
  });

  it("z-order 4 → moveElementToSiblingEdge / reorderElementWithinParent, 단일 선택 한정", async () => {
    await run("bringToFront");
    await run("sendToBack");
    await run("bringForward");
    await run("sendBackward");
    expect(spies.moveElementToSiblingEdge.mock.calls).toEqual([
      ["a", "front"],
      ["a", "back"],
    ]);
    expect(spies.reorderElementWithinParent.mock.calls).toEqual([
      ["a", 1],
      ["a", -1],
    ]);

    spies = seedStore(["a", "b"]);
    await run("bringToFront");
    await run("bringForward");
    expect(spies.moveElementToSiblingEdge).not.toHaveBeenCalled();
    expect(spies.reorderElementWithinParent).not.toHaveBeenCalled();
  });

  it.each([
    ["duplicate", "duplicateSelection"],
    ["group", "groupSelection"],
    ["ungroup", "ungroupSelection"],
  ] as Array<[ShortcutId, keyof typeof canvasActions]>)(
    "%s → %s({elementsMap})",
    async (id, fn) => {
      const i = input();
      await run(id, i);
      expect(canvasActions[fn]).toHaveBeenCalledWith({
        elementsMap: i.elementsMap,
      });
    },
  );

  it.each([
    ["alignLeft", "left"],
    ["alignHCenter", "center"],
    ["alignRight", "right"],
    ["alignTop", "top"],
    ["alignVCenter", "middle"],
    ["alignBottom", "bottom"],
  ] as Array<[ShortcutId, string]>)(
    "%s → alignSelection(ctx, %s)",
    async (id, type) => {
      const i = input();
      await run(id, i);
      expect(canvasActions.alignSelection).toHaveBeenCalledWith(
        { elementsMap: i.elementsMap },
        type,
      );
    },
  );

  it.each([
    ["distributeH", "horizontal"],
    ["distributeV", "vertical"],
  ] as Array<[ShortcutId, string]>)(
    "%s → distributeSelection(ctx, %s)",
    async (id, type) => {
      const i = input();
      await run(id, i);
      expect(canvasActions.distributeSelection).toHaveBeenCalledWith(
        { elementsMap: i.elementsMap },
        type,
      );
    },
  );

  it("selectAll → getPageElements(currentPageId) → setSelectedElements(전체 id, body 포함)", async () => {
    await run("selectAll");
    expect(spies.getPageElements).toHaveBeenCalledWith("page-1");
    expect(spies.setSelectedElements).toHaveBeenCalledWith(["a", "b"]);
  });

  it("allowlist 40 전부 adapter 가 있다", () => {
    expect(Object.keys(AGENT_COMMANDS)).toHaveLength(40);
  });
});
