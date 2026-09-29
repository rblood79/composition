/**
 * ADR-249 §4-2 — 명령 항목 활성 = 등록 · precondition · 등록자 실행 조건 · 소속
 * 패널 열림의 AND. 포커스 scope 는 보지 않는다.
 */
import { describe, expect, it, vi } from "vitest";
import type { AgentReadModel } from "../../config/commandMeta";
import type { ShortcutId } from "../../config/keyboardShortcuts";
import type { CommandEntry } from "../../stores/commandRegistry";
import type { PanelConfig, PanelId } from "../../panels/core/types";
import { panelIdForScope } from "../../hooks/useActiveScope";
import {
  deriveWorkspacePanelGroups,
  ownerPanelForCommand,
  resolveCommandEnablement,
  type MenuCommandStateInput,
} from "./resolveMenuItemState";

const readModel = (
  overrides: Partial<AgentReadModel> = {},
): AgentReadModel => ({
  currentPageId: "page-1",
  selectedElementId: null,
  selectedElementIds: [],
  multiSelectMode: false,
  elementsMap: new Map(),
  guideSelected: false,
  canUndo: false,
  canRedo: false,
  viewport: { containerSize: { width: 800, height: 600 } },
  ...overrides,
});

const entry = (
  id: ShortcutId,
  overrides: Partial<CommandEntry> = {},
): CommandEntry => ({
  id,
  handler: vi.fn(),
  scope: "global",
  priority: 0,
  allowInInput: false,
  disabled: false,
  seq: 0,
  ...overrides,
});

function input(
  entries: Partial<Record<ShortcutId, CommandEntry>>,
  overrides: Partial<MenuCommandStateInput> = {},
): MenuCommandStateInput {
  return {
    readModel: readModel(),
    resolve: (id) => entries[id],
    isPanelVisible: () => true,
    panelIdForScope,
    ...overrides,
  };
}

describe("resolveCommandEnablement", () => {
  it("등록이 없으면 비활성", () => {
    expect(resolveCommandEnablement("zoomIn", input({}))).toEqual({
      enabled: false,
      reason: "unregistered",
    });
  });

  it("precondition 실패면 비활성 — undo 는 되돌릴 것이 없을 때", () => {
    const state = input({ undo: entry("undo") });
    expect(resolveCommandEnablement("undo", state)).toMatchObject({
      enabled: false,
      reason: "precondition",
    });
    expect(
      resolveCommandEnablement("undo", {
        ...state,
        readModel: readModel({ canUndo: true }),
      }),
    ).toEqual({ enabled: true });
  });

  it("스타일 복사는 선택이 없으면 비활성 (precondition 추가, R1)", () => {
    const state = input({ copyStyles: entry("copyStyles") });
    expect(resolveCommandEnablement("copyStyles", state)).toMatchObject({
      enabled: false,
      reason: "precondition",
    });
    expect(
      resolveCommandEnablement("copyStyles", {
        ...state,
        readModel: readModel({
          selectedElementId: "el-1",
          selectedElementIds: ["el-1"],
        }),
      }),
    ).toEqual({ enabled: true });
  });

  it("등록자 실행 조건 false 면 비활성 — 선택에 맞춤", () => {
    let hasTarget = false;
    const state = input({
      zoomToSelection: entry("zoomToSelection", { canRun: () => hasTarget }),
    });
    expect(resolveCommandEnablement("zoomToSelection", state)).toEqual({
      enabled: false,
      reason: "cannot-run",
    });
    hasTarget = true;
    expect(resolveCommandEnablement("zoomToSelection", state)).toEqual({
      enabled: true,
    });
  });

  it("소속 패널이 닫혀 있으면 비활성 — 상시 host 등록이 남아 있어도 (R4)", () => {
    const visible = new Set<PanelId>(["properties"]);
    const state = input(
      {
        copyStyles: entry("copyStyles"),
        copyProperties: entry("copyProperties"),
      },
      {
        readModel: readModel({ selectedElementId: "el-1" }),
        isPanelVisible: (panelId) => visible.has(panelId),
      },
    );
    expect(resolveCommandEnablement("copyStyles", state)).toEqual({
      enabled: false,
      reason: "panel-hidden",
      detail: "styles",
    });
    expect(resolveCommandEnablement("copyProperties", state)).toEqual({
      enabled: true,
    });
  });

  it("포커스 scope 는 보지 않는다 — 캔버스 명령은 scope 불일치여도 활성", () => {
    const state = input({
      selectAll: entry("selectAll", { scope: "canvas-focused" }),
    });
    expect(resolveCommandEnablement("selectAll", state)).toEqual({
      enabled: true,
    });
  });
});

describe("ownerPanelForCommand", () => {
  it("단일 panel:* scope 만 소속을 갖는다", () => {
    expect(ownerPanelForCommand("copyStyles", panelIdForScope)).toBe("styles");
    expect(ownerPanelForCommand("toggleFocusMode", panelIdForScope)).toBe("styles");
    expect(ownerPanelForCommand("copyProperties", panelIdForScope)).toBe("properties");
    // ["canvas-focused", "panel:properties"] — 캔버스에서도 쓴다
    expect(ownerPanelForCommand("detachInstance", panelIdForScope)).toBeNull();
    expect(ownerPanelForCommand("copy", panelIdForScope)).toBeNull();
  });
});

describe("deriveWorkspacePanelGroups", () => {
  const config = (id: PanelId, hiddenFromMenu = false, hiddenFromRail = false) =>
    ({ id, hiddenFromMenu, hiddenFromRail }) as PanelConfig;
  const configs = new Map<PanelId, PanelConfig>([
    ["navigator", config("navigator")],
    ["settings", config("settings", true, true)],
    ["styles", config("styles")],
    // 레일에서 뺀 패널도 메뉴에는 선다 (사용자 2026-09-29)
    ["history", config("history", false, true)],
  ]);

  it("hiddenFromMenu 만 거르고 (레일 숨김은 남긴다) 빈 구역은 뺀다", () => {
    const groups = deriveWorkspacePanelGroups(
      {
        left: ["navigator", "settings"],
        right: ["styles", "history"],
        bottom: [],
      },
      (id) => configs.get(id),
    );
    expect(groups.map((g) => [g.side, g.panels.map((p) => p.id)])).toEqual([
      ["left", ["navigator"]],
      ["right", ["styles", "history"]],
    ]);
  });

  it("bottom 으로 옮긴 패널은 아래 구역에 선다", () => {
    const groups = deriveWorkspacePanelGroups(
      { left: ["navigator"], right: ["styles"], bottom: ["history"] },
      (id) => configs.get(id),
    );
    expect(groups.at(-1)).toMatchObject({
      side: "bottom",
      panels: [{ id: "history" }],
    });
  });
});
