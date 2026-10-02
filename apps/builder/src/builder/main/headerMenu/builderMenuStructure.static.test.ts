/**
 * ADR-249 G0 — 전체 메뉴 인벤토리 게이트.
 *
 * 입력 (oracle) 은 정의 표 `SHORTCUT_DEFINITIONS` · `panelConfigs.ts` 의 레일 패널 ·
 * `COMMAND_META` · 등록 소스이고, 채점 대상은 메뉴 구조 표 (`builderMenuStructure.ts`)
 * 다 — 표가 자기 자신을 확인하는 순환이 아니다.
 *
 * `panelConfigs.ts` 는 패널 컴포넌트를 전부 끌고 들어와 import 할 수 없어
 * (`shortcutDisplay.static.test.ts` 와 같은 사유) 소스에서 읽는다.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  SHORTCUT_DEFINITIONS,
  type ShortcutId,
} from "../../config/keyboardShortcuts";
// The guard set the catalog host answers (ADR-248 4e-7: the old table keeps it for reference).
import { COMMAND_META } from "../../config/commandMeta";
import { createCatalogAgentCommandHost } from "../../catalogRuntime/agentHost";
import { openStylesFixture } from "../../panels/styles/__tests__/support/catalogStylesFixture";
import type { AgentCommandHost } from "../../../services/agent/agentCommandHost";

let catalogHost: AgentCommandHost;
beforeAll(async () => {
  catalogHost = createCatalogAgentCommandHost(
    (await openStylesFixture([])).workspace,
  );
});
import {
  BUILDER_MENU_ROOT,
  MENU_COMMAND_CONDITIONS,
  MENU_EXCLUDED_COMMANDS,
  type BuilderMenuNode,
  type MenuIncludedCommandId,
} from "./builderMenuStructure";
import { HEADER_MENU_ACTIONS } from "./headerMenuActions";
import {
  deriveWorkspacePanelGroups,
  ownerPanelForCommand,
} from "./resolveMenuItemState";
import type { PanelConfig, PanelId, PanelSide } from "../../panels/core/types";
import { panelIdForScope } from "../../hooks/useActiveScope";

const SRC_ROOT = resolve(__dirname, "../../..");
const read = (rel: string) => readFileSync(join(SRC_ROOT, rel), "utf8");

interface RailPanelSource {
  id: PanelId;
  defaultPosition: PanelSide;
  shortcutId?: ShortcutId;
  hiddenFromRail: boolean;
  hiddenFromMenu: boolean;
}

/** `PANEL_CONFIGS` 배열의 객체 리터럴마다 id · 위치 · 단축키 · 레일 숨김을 읽는다. */
function panelConfigsFromSource(): RailPanelSource[] {
  const source = read("builder/panels/core/panelConfigs.ts");
  const body = source.slice(source.indexOf("export const PANEL_CONFIGS"));
  const blocks = body
    .split(/\n  \{(?=\n)/)
    .slice(1)
    .map((block) => block.slice(0, block.indexOf("\n  },")));
  return blocks.map((block) => {
    const field = (name: string) =>
      block.match(new RegExp(`\\n\\s{4}${name}:\\s*"([^"]+)"`))?.[1];
    return {
      id: field("id") as PanelId,
      defaultPosition: field("defaultPosition") as PanelSide,
      shortcutId: field("shortcutId") as ShortcutId | undefined,
      hiddenFromRail: /\n\s{4}hiddenFromRail:\s*true/.test(block),
      hiddenFromMenu: /\n\s{4}hiddenFromMenu:\s*true/.test(block),
    };
  });
}

function collectNodes(
  nodes: readonly BuilderMenuNode[],
  out: BuilderMenuNode[] = [],
): BuilderMenuNode[] {
  for (const node of nodes) {
    out.push(node);
    if (node.kind === "submenu" || node.kind === "section") {
      collectNodes(node.children, out);
    }
  }
  return out;
}

const REGISTRATION_ID_PATTERN =
  /(?:bindHandlersToDefinitions\(\s*\[([\s\S]*?)\]|:\s*(?:readonly\s+)?\w*ShortcutId\[\]\s*=\s*\[([\s\S]*?)^\s*\];)/gm;

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, out);
      continue;
    }
    if (!/\.tsx?$/.test(entry) || /\.(test|spec)\.tsx?$/.test(entry)) continue;
    out.push(full);
  }
  return out;
}

function registeredShortcutIds(): Set<string> {
  const ids = new Set<string>();
  for (const file of collectSourceFiles(SRC_ROOT)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(REGISTRATION_ID_PATTERN)) {
      for (const quoted of (match[1] ?? match[2] ?? "").matchAll(
        /"([a-zA-Z][a-zA-Z0-9]*)"/g,
      )) {
        ids.add(quoted[1]);
      }
    }
  }
  return ids;
}

const allNodes = collectNodes(BUILDER_MENU_ROOT);
const commandIds = allNodes.flatMap((node) =>
  node.kind === "command" ? [node.id] : [],
);
// 전체 메뉴 작업 공간 패널 — 레일 버튼 유무와 별개 (테마 · 작업 내역은 레일에 없고 메뉴에만)
const railPanels = panelConfigsFromSource().filter(
  (panel) => !panel.hiddenFromMenu,
);

describe("ADR-249 G0 — 전체 메뉴 인벤토리", () => {
  it("레일 버튼은 8 개 — 테마 · 작업 내역은 메뉴 전용 (사용자 2026-09-29)", () => {
    expect(
      panelConfigsFromSource()
        .filter((panel) => !panel.hiddenFromRail)
        .map((panel) => panel.id),
    ).toEqual([
      "navigator",
      "components",
      "datatable",
      "datatableEditor",
      "ai",
      "properties",
      "styles",
      "events",
    ]);
  });

  it("panelConfigs 소스 파서가 메뉴 패널 10 개를 읽는다", () => {
    expect(railPanels.map((panel) => panel.id)).toEqual([
      "navigator",
      "components",
      "datatable",
      "datatableEditor",
      "theme",
      "ai",
      "properties",
      "styles",
      "events",
      "history",
    ]);
  });

  it("71 정의가 구조 표 · 레일 패널 묶음 · 제외 표 중 정확히 한 곳에 나온다", () => {
    const panelShortcutIds = railPanels.flatMap((panel) =>
      panel.shortcutId ? [panel.shortcutId] : [],
    );
    const placements = [
      ...commandIds,
      ...panelShortcutIds,
      ...(Object.keys(MENU_EXCLUDED_COMMANDS) as ShortcutId[]),
    ];
    const definitionIds = Object.keys(SHORTCUT_DEFINITIONS) as ShortcutId[];
    expect(definitionIds).toHaveLength(71);

    const counts = new Map<string, number>();
    for (const id of placements) counts.set(id, (counts.get(id) ?? 0) + 1);
    const wrong = definitionIds.filter((id) => counts.get(id) !== 1);
    expect(wrong).toEqual([]);
    expect(placements.filter((id) => !(id in SHORTCUT_DEFINITIONS))).toEqual(
      [],
    );
    expect(commandIds.length + panelShortcutIds.length).toBe(49);
    expect(Object.keys(MENU_EXCLUDED_COMMANDS)).toHaveLength(22);
  });

  it("포함 49 는 활성 조건 출처가 원본과 일치한다", () => {
    const entries = Object.entries(MENU_COMMAND_CONDITIONS) as [
      MenuIncludedCommandId,
      (typeof MENU_COMMAND_CONDITIONS)[MenuIncludedCommandId],
    ][];
    expect(entries).toHaveLength(49);

    const mismatches: string[] = [];
    for (const [id, condition] of entries) {
      const sources = new Set(condition.sources);
      // A command the catalog agent host answers (a plan or a refusal) takes its precondition from
      //   the host (ADR-248 4e-5); the rest from `COMMAND_META`.
      const hosted = catalogHost.plan(id) !== undefined;
      if (
        sources.has("precondition") !==
        (hosted || Boolean(COMMAND_META[id].precondition))
      )
        mismatches.push(`${id}: precondition`);
      if (
        sources.has("panel") !==
        (ownerPanelForCommand(id, panelIdForScope) !== null)
      )
        mismatches.push(`${id}: panel`);
      if (sources.size === 0 && !condition.alwaysReason)
        mismatches.push(`${id}: 조건 없음 사유`);
    }
    expect(mismatches).toEqual([]);
  });

  it("등록자 실행 조건은 zoomToSelection 하나이고 CatalogCanvas 가 등록한다", () => {
    const canRunIds = Object.entries(MENU_COMMAND_CONDITIONS)
      .filter(([, condition]) => condition.sources.includes("canRun"))
      .map(([id]) => id);
    expect(canRunIds).toEqual(["zoomToSelection"]);
    expect(read("builder/workspace/canvas/catalog/CatalogCanvas.tsx")).toMatch(
      /\{\s*zoomToSelection:\s*\(\)\s*=>/,
    );
  });

  it("scope 분기 열 = getScopedHandler 로 감싼 포함 명령", () => {
    const source = read("builder/hooks/useGlobalKeyboardShortcuts.ts");
    const wrapped = [...source.matchAll(/(\w+):\s*getScopedHandler\(/g)]
      .map((match) => match[1])
      .filter((id) => id in MENU_COMMAND_CONDITIONS)
      .sort();
    const marked = Object.entries(MENU_COMMAND_CONDITIONS)
      .filter(([, condition]) => condition.scopeBranch)
      .map(([id]) => id)
      .sort();
    expect(wrapped).toEqual(["copy", "delete", "paste"]);
    expect(marked).toEqual(wrapped);
  });

  it("railOrder 세 방향 합집합 = 메뉴 패널 (bottom 포함)", () => {
    const configs = new Map(
      panelConfigsFromSource().map((panel) => [
        panel.id,
        panel as unknown as PanelConfig,
      ]),
    );
    const railOrder: Record<PanelSide, PanelId[]> = {
      left: [],
      right: [],
      bottom: [],
    };
    for (const panel of configs.values())
      railOrder[panel.defaultPosition].push(panel.id);
    // 사용자가 옮긴 레이아웃 — 히스토리를 아래로
    railOrder.right = railOrder.right.filter((id) => id !== "history");
    railOrder.bottom.push("history");

    const groups = deriveWorkspacePanelGroups(railOrder, (id) =>
      configs.get(id),
    );
    const menuPanels = groups.flatMap((group) =>
      group.panels.map((panel) => panel.id),
    );
    expect(new Set(menuPanels)).toEqual(
      new Set(railPanels.map((panel) => panel.id)),
    );
    expect(groups.map((group) => group.side)).toEqual([
      "left",
      "right",
      "bottom",
    ]);
  });

  it("모든 항목은 실행 경로를 갖거나 자리 항목이다", () => {
    const registered = registeredShortcutIds();
    expect(commandIds.filter((id) => !registered.has(id))).toEqual([]);

    const actionIds = allNodes.flatMap((node) =>
      node.kind === "action" ? [node.id] : [],
    );
    expect(actionIds.filter((id) => !(id in HEADER_MENU_ACTIONS))).toEqual([]);
    expect(
      Object.keys(HEADER_MENU_ACTIONS).filter(
        (id) => !actionIds.includes(id as never),
      ),
    ).toEqual([]);

    const placeholders = allNodes.flatMap((node) =>
      node.kind === "placeholder" ? [node.id] : [],
    );
    expect(placeholders).toEqual(["tutorial", "version"]);
  });
});
