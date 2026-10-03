/**
 * 전체 메뉴 구조 표 (ADR-249 §4-1).
 *
 * 순서 · 구역 · 구분선 · 하위 메뉴만 적는다. 라벨 · 단축키 · 실행 · 활성은 표에
 * 적지 않고 원본에서 읽는다 — 명령은 `SHORTCUT_DEFINITIONS` · ADR-200 라벨 ·
 * `commandRegistry` (ADR-195) · `COMMAND_META` (ADR-196), 패널은 `PanelRegistry` ·
 * workspace `railOrder`/`visibility`, 헤더 전용 동작은 `headerMenuActions.ts`.
 * 손으로 쓴 네 번째 사본이 원본과 어긋난 것이 `96ab2cee1` 결함이었다.
 *
 * 71 정의는 구조 표 · 레일 패널 묶음 (`shortcutId`) · 제외 표 셋 중 정확히 한 곳에
 * 나온다 (G0 — `builderMenuStructure.static.test.ts`).
 */
import type { ShortcutId } from "../../config/keyboardShortcuts";
import type { HeaderMenuActionId } from "./headerMenuActions";

export type BuilderMenuNode =
  | { kind: "command"; id: ShortcutId }
  | { kind: "action"; id: HeaderMenuActionId }
  /** 연결 대상이 아직 없는 자리 — 항상 비활성 (클릭 가능한 빈 항목 금지, ADR-249 §7-4). */
  | { kind: "placeholder"; id: string; labelKey: string }
  | {
      kind: "submenu";
      id: string;
      labelKey: string;
      children: readonly BuilderMenuNode[];
      /** 하나만 고르는 목록 (모양) — RAC `selectionMode="single"` → menuitemradio. */
      selection?: "single";
    }
  /** 레일 패널 묶음 — `railOrder` 세 방향 구역으로 펼쳐진다 (§2-2). 루트 전용. */
  | { kind: "panels" }
  /** 머리글 없는 구역 — 루트 전용. */
  | { kind: "section"; id: string; children: readonly BuilderMenuNode[] }
  | { kind: "separator" };

const command = (id: ShortcutId): BuilderMenuNode => ({ kind: "command", id });
const action = (id: HeaderMenuActionId): BuilderMenuNode => ({
  kind: "action",
  id,
});
const separator: BuilderMenuNode = { kind: "separator" };
/**
 * 분류 라벨 — 기존 어휘가 있으면 재사용한다. `headerMenu.*` 새 키는 번역 카탈로그가
 * initial 번들이라 G2 (initial Δ ≤ 0) 비용이다 (2026-09-29 실측 13 키 ≈ +264 B gzip).
 */
const SUBMENU_LABEL_KEYS = {
  file: "headerMenu.file",
  edit: "common.edit",
  view: "headerMenu.view",
  appearance: "settings.themeAppearance",
  layout: "styles.layout",
  align: "contextMenu.align",
  component: "panels.components",
  help: "headerMenu.help",
} as const;

const submenu = (
  id: keyof typeof SUBMENU_LABEL_KEYS,
  children: readonly BuilderMenuNode[],
  selection?: "single",
): BuilderMenuNode => ({
  kind: "submenu",
  id,
  labelKey: SUBMENU_LABEL_KEYS[id],
  children,
  ...(selection ? { selection } : {}),
});

/** 루트 — 검색창은 이 표 밖 (`HeaderMainMenu` 가 맨 위에 둔다). */
export const BUILDER_MENU_ROOT: readonly BuilderMenuNode[] = [
  // 작업 공간 (Framer 루트 맨 위 영역 전환 목록 자리 — 사용자 결정 2026-09-29)
  { kind: "panels" },
  {
    kind: "section",
    id: "workspace-tools",
    children: [command("toggleWorkflowOverlay")],
  },
  // 구분선 없이 이어진다 (사용자 2026-09-29) — 구역은 체크 여부로만 갈린다
  // 이동 — 라벨 "대시보드" (사용자 2026-09-29, 종전 "프로젝트 열기")
  command("openProject"),
  separator,
  submenu("file", [
    action("importProject"),
    action("exportProject"),
    action("exportProjectJson"),
    action("connectFolder"),
    separator,
    action("createSnapshot"),
    separator,
    action("deleteProject"),
  ]),
  submenu("edit", [
    command("undo"),
    command("redo"),
    separator,
    command("cut"),
    command("copy"),
    command("paste"),
    command("duplicate"),
    command("delete"),
    separator,
    command("selectAll"),
    separator,
    command("copyStyles"),
    command("pasteStyles"),
    command("copyProperties"),
    command("pasteProperties"),
  ]),
  submenu("view", [
    command("zoomIn"),
    command("zoomOut"),
    command("zoomToFit"),
    command("zoomToSelection"),
    command("zoom100"),
    command("zoom200"),
    separator,
    command("toggleRulers"),
    command("toggleFocusMode"),
    action("snapToObjects"),
    separator,
    // ⌥6 — 레일 패널 묶음에서 빠졌다 (Styles 가 Design 의 탭이 됨, ADR-252). 체크 없는
    // 항목이라 체크 블록 (눈금자 · focus · snap) 과 섞지 않는다.
    command("toggleStyles"),
    submenu(
      "appearance",
      [action("themeAuto"), action("themeLight"), action("themeDark")],
      "single",
    ),
    action("resetPanelLayout"),
  ]),
  submenu("layout", [
    command("group"),
    command("ungroup"),
    separator,
    command("bringToFront"),
    command("bringForward"),
    command("sendBackward"),
    command("sendToBack"),
    separator,
    submenu("align", [
      command("alignLeft"),
      command("alignHCenter"),
      command("alignRight"),
      separator,
      command("alignTop"),
      command("alignVCenter"),
      command("alignBottom"),
      separator,
      command("distributeH"),
      command("distributeV"),
    ]),
  ]),
  submenu("component", [
    command("toggleComponentOrigin"),
    command("detachInstance"),
  ]),
  separator,
  // 도움 구역 — 명령 팔레트 · 설정 · 도움말 (사용자 2026-09-29)
  command("commandPalette"),
  command("openSettings"),
  submenu("help", [
    { kind: "placeholder", id: "tutorial", labelKey: "headerMenu.tutorial" },
    { kind: "placeholder", id: "version", labelKey: "headerMenu.version" },
  ]),
];

/**
 * 메뉴에 싣지 않는 정의 22 — 사유와 함께 (breakdown §2-1). 여기와 구조 표 · 레일
 * 패널 묶음에 동시에 나오면 G0 가 실패한다.
 */
export const MENU_EXCLUDED_COMMANDS = {
  zoomInNumpad: "alias",
  deleteAlt: "alias",
  escape: "continuous-key",
  nextElement: "selection-move",
  prevElement: "selection-move",
  arrowUp: "continuous-key",
  arrowDown: "continuous-key",
  arrowLeft: "continuous-key",
  arrowRight: "continuous-key",
  arrowUpShift: "continuous-key",
  arrowDownShift: "continuous-key",
  arrowLeftShift: "continuous-key",
  arrowRightShift: "continuous-key",
  toggleSections: "panel-internal",
  treeNavDown: "tree-native",
  treeNavUp: "tree-native",
  treeNavRight: "tree-native",
  treeNavLeft: "tree-native",
  treeNavHome: "tree-native",
  treeNavEnd: "tree-native",
  treeSelect: "tree-native",
  treeSelectSpace: "tree-native",
} as const satisfies Partial<
  Record<
    ShortcutId,
    | "alias"
    | "continuous-key"
    | "selection-move"
    | "panel-internal"
    | "tree-native"
  >
>;

export type MenuExcludedCommandId = keyof typeof MENU_EXCLUDED_COMMANDS;
export type MenuIncludedCommandId = Exclude<ShortcutId, MenuExcludedCommandId>;

/**
 * 활성 조건 출처 (§4-2) — 등록은 모든 명령에 공통이라 적지 않는다.
 * - precondition: `COMMAND_META[id].precondition`
 * - canRun: 등록자 실행 조건 (`CommandEntry.canRun`)
 * - panel: 정의 scope `panel:*` 의 소속 패널이 보일 때만
 */
export type MenuEnablementSource = "precondition" | "canRun" | "panel";

export interface MenuCommandCondition {
  sources: readonly MenuEnablementSource[];
  /** `getScopedHandler` 로 감싸여 실행 인자 scope 를 따르는가 (§4-5). */
  scopeBranch?: true;
  /** `sources` 가 비었을 때 — 쓸 수 없는 상태가 없는 사유. */
  alwaysReason?: string;
}

const PRE = { sources: ["precondition"] } as const;
const always = (alwaysReason: string): MenuCommandCondition => ({
  sources: [],
  alwaysReason,
});

/**
 * P0 표 — 포함 49 정의마다 활성 조건 출처와 scope 분기 여부 (G0). 레일 패널
 * 토글 9 는 메뉴에서 패널 항목 (항상 활성) 으로 서지만 정의 축도 여기 둔다.
 */
export const MENU_COMMAND_CONDITIONS: Readonly<
  Record<MenuIncludedCommandId, MenuCommandCondition>
> = {
  undo: PRE,
  redo: PRE,
  openProject: always("대시보드 이동 — 프로젝트가 열려 있으면 언제나"),
  zoomIn: always("배율 상한에서 clamp — 눌러도 상태가 깨지지 않는다"),
  zoomOut: always("배율 하한에서 clamp"),
  zoomToFit: PRE,
  zoomToSelection: { sources: ["canRun"] },
  zoom100: always("고정 배율 설정"),
  zoom200: always("고정 배율 설정"),
  toggleNavigator: always("패널 토글"),
  toggleComponents: always("패널 토글"),
  toggleDatatable: always("패널 토글"),
  toggleTheme: always("패널 토글"),
  toggleProperties: always("패널 토글"),
  toggleStyles: always("Design 을 Layout 탭으로 열기 · 닫기"),
  toggleEvents: always("패널 토글"),
  toggleHistory: always("패널 토글"),
  toggleAI: always("패널 토글"),
  toggleWorkflowOverlay: always("보기 토글"),
  toggleRulers: always("보기 토글"),
  openSettings: always("설정 패널 토글 (도움 구역 — 체크 없음)"),
  commandPalette: always("팔레트 열기"),
  copy: { ...PRE, scopeBranch: true },
  paste: { ...PRE, scopeBranch: true },
  cut: PRE,
  duplicate: PRE,
  delete: { ...PRE, scopeBranch: true },
  selectAll: PRE,
  bringToFront: PRE,
  bringForward: PRE,
  sendBackward: PRE,
  sendToBack: PRE,
  toggleComponentOrigin: PRE,
  detachInstance: PRE,
  group: PRE,
  ungroup: PRE,
  alignLeft: PRE,
  alignHCenter: PRE,
  alignRight: PRE,
  alignTop: PRE,
  alignVCenter: PRE,
  alignBottom: PRE,
  distributeH: PRE,
  distributeV: PRE,
  // 속성 복사/붙여넣기는 PropertiesPanel 이 선택 요소가 있을 때만 마운트하는
  // `PropertyClipboardActions` 가 등록한다 — 선택 조건은 등록이 맡는다.
  // ADR-248 4e-5: the catalog agent host refuses these without a selection (as Styles' copy).
  copyProperties: { sources: ["precondition", "panel"] },
  pasteProperties: { sources: ["precondition", "panel"] },
  copyStyles: { sources: ["precondition", "panel"] },
  pasteStyles: { sources: ["precondition", "panel"] },
  toggleFocusMode: { sources: ["panel"] },
};
