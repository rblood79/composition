/**
 * 구조 표 → 렌더 모델 (ADR-249 §4-1 · §4-2 · §4-4).
 *
 * 구조 표의 각 층을 구분선 기준 **블록**으로 나눈다. 블록 하나가 RAC `MenuSection`
 * 하나이고, 켜고 끄는 항목만 모인 블록은 `selectionMode` 를 갖는다 — role
 * (`menuitemcheckbox` · `menuitemradio`) 과 `aria-checked` 는 RAC 가 붙인다 (D1).
 * 검색은 같은 블록을 잎 항목만 남겨 평면으로 펼친다.
 */
import type { PanelConfig, PanelId } from "../../panels/core/types";
import type { ShortcutId } from "../../config/keyboardShortcuts";
import type {
  CommandSearchFields,
  matchesCommandSearch,
} from "../../components/overlay/commandSearch";
import type { BuilderMenuNode } from "./builderMenuStructure";
import {
  HEADER_MENU_ACTIONS,
  type HeaderMenuActionId,
  type HeaderMenuHost,
} from "./headerMenuActions";
import {
  COMMAND_CHECKED_STATE,
  isCheckableCommand,
  resolveCommandEnablement,
  type MenuCheckState,
  type MenuCommandStateInput,
  type WorkspacePanelGroup,
} from "./resolveMenuItemState";

export type MenuSelection = "none" | "single" | "multiple";

/** 레일 버튼과 같은 아이콘 (`PanelConfig.icon`) — 패널 항목만 갖는다. */
export type MenuIcon = PanelConfig["icon"];

export interface MenuLeaf {
  kind: "leaf";
  key: string;
  label: string;
  icon?: MenuIcon;
  shortcut?: string;
  enabled: boolean;
  checkable: boolean;
  checked: boolean;
  /** 자리 항목은 없다 — 항상 비활성. */
  run?: () => void;
  search: CommandSearchFields;
}

export interface MenuSubmenu {
  kind: "submenu";
  key: string;
  label: string;
  blocks: MenuBlock[];
}

export interface MenuBlock {
  key: string;
  /** 구역 머리글 — 검색 결과의 경로 ("레이아웃 › 정렬"). */
  header?: string;
  /** 상위 하위 메뉴 라벨 — 검색 결과의 경로 머리글. */
  path: readonly string[];
  selection: MenuSelection;
  /** 앞 블록과의 사이에 구분선 — 구조 표의 `separator` · 작업 공간 방향 경계에서만. */
  separated: boolean;
  entries: (MenuLeaf | MenuSubmenu)[];
}

export type MenuTranslate = (
  key: string,
  params?: Record<string, string | number | boolean>,
) => string;

export interface MenuModelContext {
  t: MenuTranslate;
  host: HeaderMenuHost;
  enablement: MenuCommandStateInput;
  checks: MenuCheckState;
  panelGroups: readonly WorkspacePanelGroup[];
  panelLabel: (config: PanelConfig) => string;
  /** 라벨 키 — 문맥 라벨 (`componentSemanticsActions`) 이 있으면 그것. */
  commandLabel: (id: ShortcutId) => string;
  commandShortcut: (id: ShortcutId) => string;
  commandCategory: (id: ShortcutId) => string;
  runCommand: (id: ShortcutId) => void;
  togglePanel: (id: PanelId) => void;
}

function commandLeaf(id: ShortcutId, ctx: MenuModelContext): MenuLeaf {
  const label = ctx.commandLabel(id);
  const shortcut = ctx.commandShortcut(id);
  const checkable = isCheckableCommand(id);
  return {
    kind: "leaf",
    key: `cmd:${id}`,
    label,
    shortcut,
    enabled: resolveCommandEnablement(id, ctx.enablement).enabled,
    checkable,
    checked: checkable ? COMMAND_CHECKED_STATE[id](ctx.checks) : false,
    run: () => ctx.runCommand(id),
    search: { label, id, category: ctx.commandCategory(id), shortcut },
  };
}

function actionLeaf(
  id: HeaderMenuActionId,
  ctx: MenuModelContext,
): MenuLeaf | null {
  const spec = HEADER_MENU_ACTIONS[id];
  if (spec.isSupported && !spec.isSupported()) return null;
  const label = ctx.t(spec.labelKey) + (spec.opensDialog ? "…" : "");
  return {
    kind: "leaf",
    key: `action:${id}`,
    label,
    enabled: spec.isEnabled ? spec.isEnabled(ctx.host) : true,
    checkable: Boolean(spec.isChecked),
    checked: spec.isChecked ? spec.isChecked(ctx.host) : false,
    run: () => spec.run(ctx.host),
    search: { label, id, category: "header", shortcut: "" },
  };
}

function panelLeaf(config: PanelConfig, ctx: MenuModelContext): MenuLeaf {
  const label = ctx.panelLabel(config);
  const shortcut = config.shortcutId
    ? ctx.commandShortcut(config.shortcutId)
    : undefined;
  return {
    kind: "leaf",
    key: `panel:${config.id}`,
    label,
    icon: config.icon,
    shortcut,
    enabled: true,
    checkable: true,
    checked: ctx.checks.isPanelVisible(config.id),
    run: () => ctx.togglePanel(config.id),
    search: {
      label,
      id: config.shortcutId ?? config.id,
      category: "panels",
      shortcut: shortcut ?? "",
    },
  };
}

/** 블록의 selectionMode — 체크 항목만 모였으면 multiple, 하나도 없으면 none. */
function blockSelection(
  entries: readonly (MenuLeaf | MenuSubmenu)[],
  single: boolean,
): MenuSelection {
  const leaves = entries.filter(
    (entry): entry is MenuLeaf => entry.kind === "leaf",
  );
  if (leaves.length === 0 || !leaves.every((leaf) => leaf.checkable)) {
    return "none";
  }
  return single ? "single" : "multiple";
}

function buildBlocks(
  nodes: readonly BuilderMenuNode[],
  ctx: MenuModelContext,
  path: readonly string[],
  keyPrefix: string,
  single = false,
): MenuBlock[] {
  const blocks: MenuBlock[] = [];
  let current: (MenuLeaf | MenuSubmenu)[] = [];
  // 구분선 노드를 지난 뒤 첫 블록만 구분선을 단다. 체크 여부로 갈린 구역 (RAC selectionMode
  // 는 구역 단위) 은 구분선 없이 이어질 수 있다.
  let separatedNext = false;

  const flush = () => {
    if (current.length === 0) return;
    blocks.push({
      key: `${keyPrefix}:block:${blocks.length}`,
      path,
      selection: blockSelection(current, single),
      separated: separatedNext && blocks.length > 0,
      entries: current,
    });
    separatedNext = false;
    current = [];
  };

  for (const node of nodes) {
    switch (node.kind) {
      case "separator":
        flush();
        separatedNext = true;
        break;
      case "panels":
        flush();
        for (const [index, group] of ctx.panelGroups.entries()) {
          const entries = group.panels.map((config) => panelLeaf(config, ctx));
          // 방향 머리글은 두지 않는다 — 구분선이 경계다 (사용자 2026-09-29)
          blocks.push({
            key: `${keyPrefix}:panels:${group.side}`,
            path,
            selection: "multiple",
            // 방향 경계는 구분선 (머리글 대신, 사용자 2026-09-29)
            separated: blocks.length > 0 && (index > 0 || separatedNext),
            entries,
          });
        }
        break;
      case "section": {
        flush();
        current = buildBlocks(node.children, ctx, path, node.id).flatMap(
          (block) => block.entries,
        );
        // 작업 공간 패널 구역 바로 뒤라도 구분선을 둔다 (패널 ↔ 워크플로 경계)
        separatedNext = separatedNext || blocks.length > 0;
        flush();
        break;
      }
      case "command":
        current.push(commandLeaf(node.id, ctx));
        break;
      case "action": {
        const leaf = actionLeaf(node.id, ctx);
        if (leaf) current.push(leaf);
        break;
      }
      case "placeholder": {
        const label = ctx.t(node.labelKey);
        current.push({
          kind: "leaf",
          key: `placeholder:${node.id}`,
          label,
          enabled: false,
          checkable: false,
          checked: false,
          search: { label, id: node.id, category: "help", shortcut: "" },
        });
        break;
      }
      case "submenu": {
        const label = ctx.t(node.labelKey);
        current.push({
          kind: "submenu",
          key: `submenu:${node.id}`,
          label,
          blocks: buildBlocks(
            node.children,
            ctx,
            [...path, label],
            node.id,
            node.selection === "single",
          ),
        });
        break;
      }
    }
  }
  flush();
  return blocks;
}

export function buildMenuModel(
  root: readonly BuilderMenuNode[],
  ctx: MenuModelContext,
): MenuBlock[] {
  return buildBlocks(root, ctx, [], "root");
}

/**
 * 검색 — 모든 잎 항목을 원래 블록째 평면으로 펼치고 걸리는 것만 남긴다
 * (`SubmenuTrigger` 안쪽은 Autocomplete 필터가 닿지 않는다). 머리글은 경로
 * ("레이아웃 › 정렬") 이고, 앞 블록과 경로가 같으면 한 번만 단다.
 */
export function searchMenuModel(
  blocks: readonly MenuBlock[],
  query: string,
  /** 팔레트와 같은 필터 (R7) — lazy chunk 는 runtime 으로 받는다. */
  matches: typeof matchesCommandSearch,
): MenuBlock[] {
  const results: MenuBlock[] = [];
  let lastHeader: string | undefined;
  const visit = (levelBlocks: readonly MenuBlock[]) => {
    for (const block of levelBlocks) {
      const leaves = block.entries.filter(
        (entry): entry is MenuLeaf =>
          entry.kind === "leaf" && matches(entry.search, query),
      );
      if (leaves.length > 0) {
        const pathLabel = block.path.join(" › ");
        const header =
          [pathLabel, block.header].filter(Boolean).join(" › ") || undefined;
        results.push({
          ...block,
          key: `search:${block.key}`,
          header: header === lastHeader ? undefined : header,
          entries: leaves,
        });
        lastHeader = header;
      }
      for (const entry of block.entries) {
        if (entry.kind === "submenu") visit(entry.blocks);
      }
    }
  };
  visit(blocks);
  return results;
}
