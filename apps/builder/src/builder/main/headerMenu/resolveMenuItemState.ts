/**
 * 전체 메뉴 항목 상태 판정 (ADR-249 §4-2) — 순수 함수.
 *
 * 명령 항목의 활성은 네 조건의 AND 다: 등록 (`resolveCommand`) · precondition
 * (`COMMAND_META`) · 등록자 실행 조건 (`CommandEntry.canRun`) · 소속 패널 열림.
 * **포커스 scope 는 쓰지 않는다** — scope 는 "이 키가 어느 리스너로 가나" 를 가르는
 * 규칙이고 메뉴는 사용자가 명령을 직접 고른 것이다. 헤더 버튼을 누르면 포커스가
 * 캔버스를 떠나 scope 가 캔버스 명령과 어긋나는 함정 (팔레트가 `scopeAtOpen` 으로
 * 우회한 것) 이 구조적으로 사라진다. `panel:*` 는 포커스 경로가 아니라 정의에 적힌
 * 소속으로만 읽는다.
 */
import {
  SHORTCUT_DEFINITIONS,
  type ShortcutId,
} from "../../config/keyboardShortcuts";
import {
  COMMAND_META,
  type AgentReadModel,
  type CommandMeta,
} from "../../config/commandMeta";
import type { CommandEntry } from "../../stores/commandRegistry";
import type { PanelConfig, PanelId, PanelSide } from "../../panels/core/types";
import type {
  ShortcutDefinition,
  ShortcutScope,
} from "../../types/keyboard";

export type MenuDisabledReason =
  "unregistered" | "precondition" | "cannot-run" | "panel-hidden";

export type MenuItemEnablement =
  | { enabled: true }
  | { enabled: false; reason: MenuDisabledReason; detail?: string };

/** `useActiveScope.ts` 의 `panelIdForScope` — lazy chunk 는 runtime 으로 받는다. */
export type PanelIdForScope = (scope: ShortcutScope) => PanelId | null;

export interface MenuCommandStateInput {
  readModel: AgentReadModel;
  resolve: (id: ShortcutId) => CommandEntry | undefined;
  isPanelVisible: (panelId: PanelId) => boolean;
  panelIdForScope: PanelIdForScope;
  /** 테스트 주입용 — 기본은 `COMMAND_META`. */
  meta?: Readonly<Record<ShortcutId, CommandMeta>>;
}

/**
 * 정의 scope 가 `panel:*` 하나인 명령의 소속 패널. 배열 scope
 * (`["canvas-focused", "panel:properties"]`) 는 캔버스에서도 쓰므로 소속이 없다.
 */
export function ownerPanelForCommand(
  id: ShortcutId,
  panelIdForScope: PanelIdForScope,
): PanelId | null {
  const def: ShortcutDefinition = SHORTCUT_DEFINITIONS[id];
  return typeof def.scope === "string" ? panelIdForScope(def.scope) : null;
}

export function resolveCommandEnablement(
  id: ShortcutId,
  input: MenuCommandStateInput,
): MenuItemEnablement {
  const entry = input.resolve(id);
  if (!entry || entry.disabled)
    return { enabled: false, reason: "unregistered" };

  const precondition = (input.meta ?? COMMAND_META)[id].precondition;
  if (precondition) {
    const verdict = precondition(input.readModel);
    if (!verdict.ok) {
      return { enabled: false, reason: "precondition", detail: verdict.reason };
    }
  }

  if (entry.canRun && !entry.canRun()) {
    return { enabled: false, reason: "cannot-run" };
  }

  const owner = ownerPanelForCommand(id, input.panelIdForScope);
  if (owner && !input.isPanelVisible(owner)) {
    return { enabled: false, reason: "panel-hidden", detail: owner };
  }

  return { enabled: true };
}

export interface WorkspacePanelGroup {
  side: PanelSide;
  panels: readonly PanelConfig[];
}

const RAIL_SIDES: readonly PanelSide[] = ["left", "right", "bottom"];

/**
 * 작업 공간 구역 — `railOrder` 세 방향에서 파생한다 (§2-2). 레일에서 뺀 패널
 * (`hiddenFromRail` — 테마 · 작업 내역) 도 메뉴에는 남고 `hiddenFromMenu` (설정 · 필드)
 * 만 뺀다. 레일에 버튼이 없는 패널 (bottom 배치 포함) 은 메뉴가 마우스로 여는 유일한
 * 경로다. 빈 구역은 돌려주지 않는다.
 */
export function deriveWorkspacePanelGroups(
  railOrder: Readonly<Record<PanelSide, readonly PanelId[]>>,
  getPanel: (id: PanelId) => PanelConfig | undefined,
): WorkspacePanelGroup[] {
  const groups: WorkspacePanelGroup[] = [];
  for (const side of RAIL_SIDES) {
    const panels = (railOrder[side] ?? []).flatMap((panelId) => {
      const config = getPanel(panelId);
      return config && !config.hiddenFromMenu ? [config] : [];
    });
    if (panels.length > 0) groups.push({ side, panels });
  }
  return groups;
}

/** 켜고 끄는 명령의 체크 상태 입력 — 전부 store 값 (§4-2 체크 열). */
export interface MenuCheckState {
  showRulers: boolean;
  showWorkflowOverlay: boolean;
  focusMode: boolean;
  isPanelVisible: (panelId: PanelId) => boolean;
}

/**
 * 체크 표시를 갖는 명령 — 핸들러가 이 값을 뒤집는다 (`useGlobalKeyboardShortcuts`
 * 의 `setShowRulers(!showRulers)` · `toggleWorkflowOverlay`, StylesPanel 의 `toggleFocusMode`).
 * 설정 열기는 명령 팔레트 · 도움말과 한 구역이라 체크를 두지 않는다 — 한 구역에 체크 항목과
 * 일반 항목이 섞이면 RAC selectionMode 를 줄 수 없다 (사용자 배치 2026-09-29).
 */
export const COMMAND_CHECKED_STATE = {
  toggleRulers: (state: MenuCheckState) => state.showRulers,
  toggleWorkflowOverlay: (state: MenuCheckState) => state.showWorkflowOverlay,
  toggleFocusMode: (state: MenuCheckState) => state.focusMode,
} as const satisfies Partial<
  Record<ShortcutId, (state: MenuCheckState) => boolean>
>;

export function isCheckableCommand(
  id: ShortcutId,
): id is keyof typeof COMMAND_CHECKED_STATE {
  return id in COMMAND_CHECKED_STATE;
}
