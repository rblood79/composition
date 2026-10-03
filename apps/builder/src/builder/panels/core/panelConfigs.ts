/**
 * Panel Configurations
 *
 * 패널 설정 정의 및 PanelRegistry 등록
 */

import {
  Bot,
  Columns3,
  Database,
  FileEdit,
  History,
  ListTree,
  Settings,
  PaintRoller,
  SquareMousePointer,
  SwatchBook,
} from "lucide-react";
import type { PanelConfig } from "./types";
import { PanelRegistry } from "./PanelRegistry";

// Navigation panels
import { CatalogNavigatorPanel } from "../navigator/catalog/CatalogNavigatorPanel";
import { ACTION_ICONS } from "../../config/actionIcons";
import { CatalogComponentsPanel } from "../components/CatalogComponentsPanel";
import { AIPanel } from "../ai/lazyAIPanel";
import { lazyPanel, preloadLazyPanels } from "./lazyPanel";

// Editor panels
import { DesignPanel } from "../design/DesignPanel";

// ADR-131 Phase 8 (2026-05-13): DataPanel 제거 — DataTablePanel (기존) 가 data SSOT.
// ADR-149 Phase 2c (2026-07-19): ActionsPanel 제거 — cross-event reuse 는 EventsPanel
// L2 고급 토글로 흡수 예정 (Phase 3). document.actions 는 canonical read view.

// ADR-212 HC5: 편집기 구현은 lazy 경계 뒤 — initial chunk 에 editor bytes 0.
const DataTableEditorPanel = lazyPanel(
  () => import("../datatable/DataTableEditorPanel"),
);
const DataTableFieldPanel = lazyPanel(
  () => import("../datatable/DataTableFieldPanel"),
);

// ADR-242 — 초기 화면 밖 패널은 첫 열림에 chunk 를 받는다 (패널 밖이 값으로 쓰는 store · utils 는
//   그대로 initial). 상수 이름은 등록 인벤토리 검사 (`panelCloseActions.static`) 가 읽는다.
const CatalogHistoryPanel = lazyPanel(() =>
  import("../history/CatalogHistoryPanel").then((m) => ({
    default: m.CatalogHistoryPanel,
  })),
);

const SettingsPanel = lazyPanel(() =>
  import("../settings/SettingsPanel").then((m) => ({
    default: m.SettingsPanel,
  })),
);

const CatalogInteractionsPanel = lazyPanel(() =>
  import("../interactions/catalog/CatalogInteractionsPanel").then((m) => ({
    default: m.CatalogInteractionsPanel,
  })),
);

const CatalogThemesPanel = lazyPanel(() =>
  import("../themes/catalog/CatalogThemesPanel").then((m) => ({
    default: m.CatalogThemesPanel,
  })),
);

const DataTablePanel = lazyPanel(() =>
  import("../datatable/DataTablePanel").then((m) => ({
    default: m.DataTablePanel,
  })),
);

// Bottom panels

/**
 * 패널 설정
 */
export const PANEL_CONFIGS: PanelConfig[] = [
  // Navigation panels
  {
    id: "navigator",
    name: "탐색기",
    nameEn: "Navigator",
    icon: ListTree,
    component: CatalogNavigatorPanel,
    category: "navigation",
    defaultPosition: "left",
    minWidth: 233,
    maxWidth: 640,
    defaultHeight: 320,
    description: "페이지, 프레임 및 레이어 구조 탐색",
    shortcutId: "toggleNavigator",
  },
  {
    id: "components",
    name: "컴포넌트",
    nameEn: "Components",
    icon: ACTION_ICONS.component,
    component: CatalogComponentsPanel,
    category: "navigation",
    defaultPosition: "left",
    minWidth: 233,
    maxWidth: 640,
    defaultHeight: 520,
    description: "컴포넌트 라이브러리",
    shortcutId: "toggleComponents",
  },
  {
    id: "datatable",
    name: "데이터테이블",
    nameEn: "DataTable",
    icon: Database,
    component: DataTablePanel,
    category: "navigation",
    defaultPosition: "left",
    minWidth: 233,
    maxWidth: "100%",
    defaultHeight: 520,
    description: "DataTables, APIs, Variables 관리",
    shortcutId: "toggleDatatable",
  },
  {
    id: "datatableEditor",
    name: "데이터테이블 에디터",
    nameEn: "DataTable Editor",
    icon: FileEdit,
    component: DataTableEditorPanel,
    category: "editor",
    defaultPosition: "left",
    minWidth: 233,
    maxWidth: "100%",
    // 격자 + 탭 라벨이 잘리지 않는 첫 열림 폭 (리서치 U1). 리사이즈 · 폭 저장은 그대로.
    defaultWidth: 560,
    defaultHeight: 600,
    description: "DataTable, API, Variable 편집",
  },
  {
    id: "datatableField",
    name: "필드",
    nameEn: "Field",
    icon: Columns3,
    component: DataTableFieldPanel,
    category: "editor",
    defaultPosition: "left",
    minWidth: 240,
    maxWidth: 480,
    // ADR-212 HC2/HC3 — 편집기 옆 열에 스냅, 필드 패널 폭 260 (Widths 아트보드)
    defaultWidth: 260,
    defaultHeight: 600,
    snapTo: "datatableEditor",
    // 편집기 헤더 `+` / 헤더 클릭으로만 연다 — rail · 전체 메뉴 진입점 없음
    hiddenFromRail: true,
    hiddenFromMenu: true,
    description: "테이블 필드 편집 (편집기 옆 스냅)",
  },

  // Tool panels
  {
    id: "theme",
    name: "테마",
    nameEn: "Theme",
    icon: SwatchBook,
    component: CatalogThemesPanel,
    category: "tool",
    defaultPosition: "left",
    minWidth: 233,
    maxWidth: 640,
    defaultHeight: 520,
    description: "Tint 프리셋 및 테마 설정",
    shortcutId: "toggleTheme",
    // 진입점은 전체 메뉴 작업 공간 구역 · ⌥4 (사용자 2026-09-29 — 레일에서 뺌)
    hiddenFromRail: true,
  },
  // System panels
  {
    id: "settings",
    name: "설정",
    nameEn: "Settings",
    icon: Settings,
    component: SettingsPanel,
    category: "system",
    defaultPosition: "left",
    minWidth: 233,
    maxWidth: 1000,
    defaultWidth: 233,
    defaultHeight: 500,
    description: "앱 설정 및 환경설정",
    shortcutId: "openSettings",
    displayModes: ["panel", "floating"],
    // 진입점은 2026-08-25 에 헤더 좌측 메뉴로 옮겼다 — 저빈도 작업이라 좌측
    // 레일 한 칸을 상주로 차지할 이유가 없다. 패널 배치·토글 경로는 그대로다.
    hiddenFromRail: true,
    // 전체 메뉴에는 도움 구역의 "설정" 명령 항목으로 따로 선다 (ADR-249)
    hiddenFromMenu: true,
  },

  {
    id: "ai",
    name: "AI",
    nameEn: "AI",
    icon: Bot,
    component: AIPanel,
    category: "tool",
    defaultPosition: "right",
    minWidth: 233,
    maxWidth: 800,
    defaultWidth: 360,
    defaultHeight: 500,
    description: "AI 도구 및 제안",
    shortcutId: "toggleAI",
    displayModes: ["panel", "floating"],
  },

  // Editor panels
  {
    // ADR-252 — Properties · Styles 를 한 패널의 탭으로 합친 Design 패널. `id` 는 패널
    // 위치/크기 persist 키라 `properties` 그대로 둔다 (Events → Interactions 와 같은 선례).
    // 저장된 레이아웃의 `styles` row 는 registry 에 없어 정규화가 버린다 (변환 없음).
    // 최소 폭 233 그대로 — 탭 5개 (Modified 를 뺀 뒤, 사용자 2026-10-04) 는 233 에서도 선택 탭
    // 라벨이 잘리지 않는다 (탭 6개일 때는 262 가 경계였다). 아이콘은 구 Styles 의 PaintRoller —
    // 새 아이콘은 initial 번들을 늘린다 (G4), 탭 아이콘과 겹치지 않는다.
    id: "properties",
    name: "디자인",
    nameEn: "Design",
    icon: PaintRoller,
    component: DesignPanel,
    category: "editor",
    defaultPosition: "right",
    minWidth: 233,
    maxWidth: 640,
    defaultHeight: 520,
    description: "요소 속성 · 스타일 편집",
    shortcutId: "toggleProperties",
  },
  {
    // ADR-158 Phase 2 — EventsPanel → InteractionsPanel 교체.
    // `id` 는 패널 위치/크기 persist 키라 유지한다 (rename 시 사용자 레이아웃 소실).
    id: "events",
    name: "인터랙션",
    nameEn: "Interactions",
    icon: SquareMousePointer,
    component: CatalogInteractionsPanel,
    category: "editor",
    defaultPosition: "right",
    minWidth: 233,
    maxWidth: 800,
    defaultHeight: 520,
    description: "한 줄 규칙으로 요소 동작 정의",
    shortcutId: "toggleEvents",
  },
  // ADR-149 Phase 2c (2026-07-19): actions 패널 제거 (HC4) — ADR-131 Phase 5 G3
  // raw skeleton panel 이었음. cross-event reuse 는 EventsPanel L2 고급 토글로 흡수 (Phase 3).
  {
    id: "history",
    name: "히스토리",
    nameEn: "History",
    icon: History,
    component: CatalogHistoryPanel,
    category: "editor",
    defaultPosition: "right",
    minWidth: 233,
    maxWidth: 640,
    defaultWidth: 320,
    defaultHeight: 450,
    description: "변경 내역 확인 및 복원",
    shortcutId: "toggleHistory",
    // 진입점은 전체 메뉴 작업 공간 구역 · ⌥8 (사용자 2026-09-29 — 레일에서 뺌)
    hiddenFromRail: true,
    displayModes: ["panel", "floating"],
  },
  // 구 "폰트" 도킹 패널은 2026-08-25 에 등록 해제했다 — 폰트 관리는 Typography 의
  // Font Family 피커가 여는 모달(`FontManagerDialog`)이 담당한다. 저빈도 작업이라
  // 인스펙터 레일 한 칸을 상주로 차지할 이유가 없다 (Figma/Pen 도 그렇게 안 한다).
];

/**
 * ADR-242 HC3 — 부팅 뒤 idle 에 초기 화면 밖 패널 chunk 를 미리 받는다 (받은 패널은 fallback 없이
 * 바로 열린다). AI (100 KB) · datatable 편집기/필드 (목록 패널에서 여는 2차 표면) 는 첫 열림에 받는다.
 */
export function preloadOffscreenPanels(): void {
  preloadLazyPanels([
    CatalogHistoryPanel,
    SettingsPanel,
    CatalogInteractionsPanel,
    CatalogThemesPanel,
    DataTablePanel,
  ]);
}

/**
 * PanelRegistry에 모든 패널 등록
 */
export function registerAllPanels() {
  // 이미 초기화된 경우 건너뛰기 (HMR/Strict Mode 대응)
  if (PanelRegistry.isInitialized) {
    return;
  }

  PANEL_CONFIGS.forEach((config) => {
    PanelRegistry.register(config);
  });

  PanelRegistry.markInitialized();
}

// 앱 시작 시 자동 등록
registerAllPanels();
