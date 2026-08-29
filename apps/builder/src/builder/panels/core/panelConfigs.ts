/**
 * Panel Configurations
 *
 * 패널 설정 정의 및 PanelRegistry 등록
 */

import {
  File,
  Box,
  PaintRoller,
  Bot,
  Settings,
  Settings2,
  SwatchBook,
  Database,
  SquareMousePointer,
  FileEdit,
  Activity,
  History,
} from "lucide-react";
import type { PanelConfig } from "./types";
import { PanelRegistry } from "./PanelRegistry";

// Navigation panels
import { NavigatorPanel } from "../navigator/NavigatorPanel";
import { ComponentsPanel } from "../components/ComponentsPanel";
import { ThemesPanel } from "../themes/ThemesPanel";
import { AIPanel } from "../ai/AIPanel";
import { SettingsPanel } from "../settings/SettingsPanel";
import { DataTablePanel } from "../datatable/DataTablePanel";
import { DataTableEditorPanel } from "../datatable/DataTableEditorPanel";

// Editor panels
import { PropertiesPanel } from "../properties/PropertiesPanel";
import { StylesPanel } from "../styles/StylesPanel";
import { InteractionsPanel } from "../interactions/InteractionsPanel";
import { HistoryPanel } from "../history/HistoryPanel";

// ADR-131 Phase 8 (2026-05-13): DataPanel 제거 — DataTablePanel (기존) 가 data SSOT.
// ADR-149 Phase 2c (2026-07-19): ActionsPanel 제거 — cross-event reuse 는 EventsPanel
// L2 고급 토글로 흡수 예정 (Phase 3). document.actions 는 canonical read view.

// Bottom panels
import { MonitorPanel } from "../monitor/MonitorPanel";

/**
 * 패널 설정
 */
export const PANEL_CONFIGS: PanelConfig[] = [
  // Navigation panels
  {
    id: "navigator",
    name: "탐색기",
    nameEn: "Navigator",
    icon: File,
    component: NavigatorPanel,
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
    icon: Box,
    component: ComponentsPanel,
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
    defaultHeight: 600,
    description: "DataTable, API, Variable 편집",
  },

  // Tool panels
  {
    id: "theme",
    name: "테마",
    nameEn: "Theme",
    icon: SwatchBook,
    component: ThemesPanel,
    category: "tool",
    defaultPosition: "left",
    minWidth: 233,
    maxWidth: 640,
    defaultHeight: 520,
    description: "Tint 프리셋 및 테마 설정",
    shortcutId: "toggleTheme",
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
    defaultWidth: 400,
    defaultHeight: 500,
    description: "앱 설정 및 환경설정",
    shortcutId: "openSettings",
    displayModes: ["panel", "floating"],
    // 진입점은 2026-08-25 에 헤더 좌측 메뉴로 옮겼다 — 저빈도 작업이라 좌측
    // 레일 한 칸을 상주로 차지할 이유가 없다. 패널 배치·토글 경로는 그대로다.
    hiddenFromRail: true,
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
    id: "properties",
    name: "속성",
    nameEn: "Properties",
    icon: Settings2,
    component: PropertiesPanel,
    category: "editor",
    defaultPosition: "right",
    minWidth: 233,
    maxWidth: 640,
    defaultHeight: 520,
    description: "요소 속성 편집",
    shortcutId: "toggleProperties",
  },
  {
    id: "styles",
    name: "스타일",
    nameEn: "Styles",
    icon: PaintRoller,
    component: StylesPanel,
    category: "editor",
    defaultPosition: "right",
    minWidth: 233,
    maxWidth: 640,
    defaultHeight: 520,
    description: "CSS 스타일 편집",
    shortcutId: "toggleStyles",
  },
  {
    // ADR-158 Phase 2 — EventsPanel → InteractionsPanel 교체.
    // `id` 는 패널 위치/크기 persist 키라 유지한다 (rename 시 사용자 레이아웃 소실).
    id: "events",
    name: "인터랙션",
    nameEn: "Interactions",
    icon: SquareMousePointer,
    component: InteractionsPanel,
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
    component: HistoryPanel,
    category: "editor",
    defaultPosition: "right",
    minWidth: 233,
    maxWidth: 640,
    defaultWidth: 320,
    defaultHeight: 450,
    description: "변경 내역 확인 및 복원",
    shortcutId: "toggleHistory",
    displayModes: ["panel", "floating"],
  },
  // 구 "폰트" 도킹 패널은 2026-08-25 에 등록 해제했다 — 폰트 관리는 Typography 의
  // Font Family 피커가 여는 모달(`FontManagerDialog`)이 담당한다. 저빈도 작업이라
  // 인스펙터 레일 한 칸을 상주로 차지할 이유가 없다 (Figma/Pen 도 그렇게 안 한다).

  // Bottom panels
  {
    id: "monitor",
    name: "모니터",
    nameEn: "Monitor",
    icon: Activity,
    component: MonitorPanel,
    category: "system",
    defaultPosition: "bottom",
    minWidth: 233,
    maxWidth: 1600,
    defaultWidth: 600,
    minHeight: 150,
    maxHeight: 600,
    defaultHeight: 240,
    description: "메모리 사용량 모니터링 및 최적화",
    shortcutId: "toggleMonitor",
  },
];

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
