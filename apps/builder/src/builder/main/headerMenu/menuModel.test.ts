/**
 * ADR-249 §4-1 · §4-4 — 구조 표 → 블록 모델, 검색 평면화.
 */
import { describe, expect, it, vi } from "vitest";
import { SHORTCUT_DEFINITIONS } from "../../config/keyboardShortcuts";
import type { CommandEntry } from "../../stores/commandRegistry";
import type { PanelConfig } from "../../panels/core/types";
import { BUILDER_MENU_ROOT } from "./builderMenuStructure";
import { matchesCommandSearch } from "../../components/overlay/commandSearch";
import { panelIdForScope } from "../../hooks/useActiveScope";
import {
  buildMenuModel,
  searchMenuModel,
  type MenuBlock,
  type MenuLeaf,
  type MenuModelContext,
} from "./menuModel";

const NavigatorIcon = (() => null) as unknown as PanelConfig["icon"];
const entry = { handler: vi.fn(), disabled: false } as unknown as CommandEntry;

function context(overrides: Partial<MenuModelContext> = {}): MenuModelContext {
  return {
    t: (key) => key,
    host: {
      projectId: "p1",
      onImportProject: vi.fn(),
      onExportProject: vi.fn(),
      onExportProjectJson: vi.fn(),
      onConnectFolder: vi.fn(),
      onDeleteProject: vi.fn(),
      onResetPanelLayout: vi.fn(),
      runtime: {
        useThemeMode: () => "auto",
        getThemeMode: () => "auto",
        useI18n: () => ({ t: (key: string) => key }) as never,
        formatShortcut: () => "",
        SearchField: (() => null) as never,
        resolveCommand: () => entry,
        subscribeCommandRegistry: () => () => {},
        getCommandRegistrySnapshot: () => new Map(),
        matchesCommandSearch,
        icons: {} as never,
        iconSize: 16,
        iconStrokeWidth: 1.5,
        setThemeMode: vi.fn(),
        panelLabel: (config) => config.id,
        panelIdForScope,
      },
    },
    enablement: {
      readModel: {
        viewport: { containerSize: { width: 800, height: 600 } },
      },
      resolve: () => entry,
      isPanelVisible: () => true,
      panelIdForScope,
    },
    checks: {
      showRulers: true,
      showWorkflowOverlay: false,
      focusMode: false,
      isPanelVisible: (id) => id === "navigator",
    },
    panelGroups: [
      {
        side: "left",
        panels: [
          {
            id: "navigator",
            shortcutId: "toggleNavigator",
            icon: NavigatorIcon,
          },
          { id: "datatableEditor" },
        ] as PanelConfig[],
      },
      {
        side: "bottom",
        panels: [
          { id: "history", shortcutId: "toggleHistory" },
        ] as PanelConfig[],
      },
    ],
    panelLabel: (config) => `panel.${config.id}`,
    commandLabel: (id) => `command.${id}`,
    commandShortcut: (id) => SHORTCUT_DEFINITIONS[id].key.toUpperCase(),
    commandCategory: (id) => SHORTCUT_DEFINITIONS[id].category,
    runCommand: vi.fn(),
    togglePanel: vi.fn(),
    ...overrides,
  };
}

function leaves(blocks: readonly MenuBlock[]): MenuLeaf[] {
  return blocks.flatMap((block) =>
    block.entries.flatMap((item) =>
      item.kind === "leaf" ? [item] : leaves(item.blocks),
    ),
  );
}

function allBlocks(blocks: readonly MenuBlock[]): MenuBlock[] {
  return blocks.flatMap((block) => [
    block,
    ...block.entries.flatMap((item) =>
      item.kind === "submenu" ? allBlocks(item.blocks) : [],
    ),
  ]);
}

describe("buildMenuModel", () => {
  const model = buildMenuModel(BUILDER_MENU_ROOT, context());

  it("켜고 끄는 항목은 전부 selectionMode 가 있는 블록에 있다 (한 블록에 섞이지 않음)", () => {
    const mixed = allBlocks(model).filter((block) => {
      const blockLeaves = block.entries.filter(
        (item): item is MenuLeaf => item.kind === "leaf",
      );
      const checkable = blockLeaves.filter((leaf) => leaf.checkable).length;
      return checkable > 0 && checkable < blockLeaves.length;
    });
    expect(mixed.map((block) => block.key)).toEqual([]);

    const orphanChecks = allBlocks(model).flatMap((block) =>
      block.selection === "none"
        ? block.entries.filter((item) => item.kind === "leaf" && item.checkable)
        : [],
    );
    expect(orphanChecks).toEqual([]);
  });

  it("작업 공간 구역은 railOrder 방향별 블록 (머리글 없음) · 체크 = 패널 열림 · 레일 아이콘", () => {
    const panelBlocks = model.filter((block) => block.key.includes(":panels:"));
    expect(panelBlocks.map((block) => block.key)).toEqual([
      "root:panels:left",
      "root:panels:bottom",
    ]);
    expect(panelBlocks.every((block) => block.header === undefined)).toBe(true);
    expect((panelBlocks[0].entries[0] as MenuLeaf).icon).toBe(NavigatorIcon);
    const navigator = panelBlocks[0].entries[0] as MenuLeaf;
    expect(navigator).toMatchObject({ checked: true, shortcut: "1" });
    // 단축키가 없는 패널도 항목이 선다 — 명령 정의로 만들면 빠진다
    expect(panelBlocks[0].entries[1]).toMatchObject({
      key: "panel:datatableEditor",
      shortcut: undefined,
    });
  });

  it("구분선은 구조 표의 separator 와 작업 공간 방향 경계에만 — 워크플로 ↔ 대시보드는 이어진다", () => {
    const keysOf = (block: MenuBlock) =>
      block.entries.map((entry) => entry.key).join(",");
    expect(model.map((block) => [keysOf(block), block.separated])).toEqual([
      ["panel:navigator,panel:datatableEditor", false],
      ["panel:history", true],
      ["cmd:toggleWorkflowOverlay", true],
      ["cmd:openProject", false],
      [
        "submenu:file,submenu:edit,submenu:view,submenu:layout,submenu:component",
        true,
      ],
      ["cmd:commandPalette,cmd:openSettings,submenu:help", true],
    ]);
  });

  it("모양 하위 메뉴는 single 선택 블록이다", () => {
    const appearance = allBlocks(model).find((block) =>
      block.entries.some(
        (item) => item.kind === "leaf" && item.key === "action:themeDark",
      ),
    );
    expect(appearance?.selection).toBe("single");
  });

  it("자리 항목 (튜토리얼 · 버전) 은 실행 경로 없이 비활성", () => {
    const placeholders = leaves(model).filter((leaf) =>
      leaf.key.startsWith("placeholder:"),
    );
    expect(placeholders).toHaveLength(2);
    expect(placeholders.every((leaf) => !leaf.enabled && !leaf.run)).toBe(true);
  });

  it("명령 항목 실행은 runCommand 를 거친다", () => {
    const ctx = context();
    const copy = leaves(buildMenuModel(BUILDER_MENU_ROOT, ctx)).find(
      (leaf) => leaf.key === "cmd:copy",
    );
    copy?.run?.();
    expect(ctx.runCommand).toHaveBeenCalledWith("copy");
  });
});

describe("searchMenuModel", () => {
  const model = buildMenuModel(BUILDER_MENU_ROOT, context());

  it("하위 메뉴 안의 잎 항목을 경로 머리글과 함께 평면으로 보인다", () => {
    const results = searchMenuModel(model, "alignLeft", matchesCommandSearch);
    expect(results).toHaveLength(1);
    expect(results[0].header).toBe("styles.layout › contextMenu.align");
    expect(results[0].entries.map((item) => item.key)).toEqual([
      "cmd:alignLeft",
    ]);
  });

  it("같은 경로의 연속 블록은 머리글을 한 번만 단다", () => {
    const results = searchMenuModel(model, "zoom", matchesCommandSearch);
    const headers = results.map((block) => block.header);
    expect(headers[0]).toBe("headerMenu.view");
    expect(
      headers.slice(1).filter((header) => header === "headerMenu.view"),
    ).toEqual([]);
  });

  it("빈 결과는 빈 배열", () => {
    expect(searchMenuModel(model, "zzzz-없음", matchesCommandSearch)).toEqual(
      [],
    );
  });
});
