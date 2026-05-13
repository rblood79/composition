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
  Type,
  Workflow,
} from "lucide-react";
import type { PanelConfig } from "./types";
import { PanelRegistry } from "./PanelRegistry";

// Navigation panels
import { NodesPanel } from "../nodes/NodesPanel";
import { ComponentsPanel } from "../components/ComponentsPanel";
import { ThemesPanel } from "../themes/ThemesPanel";
import { AIPanel } from "../ai/AIPanel";
import { SettingsPanel } from "../settings/SettingsPanel";
import { DataTablePanel } from "../datatable/DataTablePanel";
import { DataTableEditorPanel } from "../datatable/DataTableEditorPanel";

// Editor panels
import { PropertiesPanel } from "../properties/PropertiesPanel";
import { StylesPanel } from "../styles/StylesPanel";
import { EventsPanel } from "../events/EventsPanel";
import { HistoryPanel } from "../history/HistoryPanel";

// ADR-131 Phase 5 — Inspector UI panel (events 는 EventsPanel 기존 / actions 신규)
// ADR-131 Phase 8 (2026-05-13): DataPanel 제거 — DataTablePanel (기존) 가 data SSOT.
import { ActionsPanel } from "../actions/ActionsPanel";

// Font Manager panel
import { FontManagerPanel } from "../fonts/FontManagerPanel";

// Bottom panels
import { MonitorPanel } from "../monitor/MonitorPanel";

/**
 * 패널 설정
 */
export const PANEL_CONFIGS: PanelConfig[] = [
  // Navigation panels
  {
    id: "nodes",
    name: "노드",
    nameEn: "Nodes",
    icon: File,
    component: NodesPanel,
    category: "navigation",
    defaultPosition: "left",
    minWidth: 233,
    maxWidth: 400,
    description: "페이지 계층 구조 탐색",
    shortcut: "Ctrl+Shift+N",
  },
  {
    id: "components",
    name: "컴포넌트",
    nameEn: "Components",
    icon: Box,
    component: ComponentsPanel,
    category: "navigation",
    defaultPosition: "left",
    minWidth: 249,
    maxWidth: 249,
    description: "컴포넌트 라이브러리",
    shortcut: "Ctrl+Shift+C",
  },
  {
    id: "datatable",
    name: "데이터테이블",
    nameEn: "DataTable",
    icon: Database,
    component: DataTablePanel,
    category: "navigation",
    defaultPosition: "left",
    minWidth: 337,
    maxWidth: 337,
    description: "DataTables, APIs, Variables, Transformers 관리",
    shortcut: "Ctrl+Shift+T",
  },
  {
    id: "datatableEditor",
    name: "데이터테이블 에디터",
    nameEn: "DataTable Editor",
    icon: FileEdit,
    component: DataTableEditorPanel,
    category: "editor",
    defaultPosition: "left",
    minWidth: 490,
    maxWidth: 490,
    description: "DataTable, API, Variable, Transformer 편집",
  },

  // Font Manager panel
  {
    id: "fonts",
    name: "폰트",
    nameEn: "Fonts",
    icon: Type,
    component: FontManagerPanel,
    category: "tool",
    defaultPosition: "right",
    minWidth: 249,
    maxWidth: 400,
    description: "커스텀 폰트 업로드 및 관리",
  },

  // Tool panels
  {
    id: "theme",
    name: "테마",
    nameEn: "Theme",
    icon: SwatchBook,
    component: ThemesPanel,
    category: "tool",
    defaultPosition: "right",
    minWidth: 249,
    maxWidth: 249,
    description: "Tint 프리셋 및 테마 설정",
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
    maxWidth: 400,
    defaultWidth: 360,
    defaultHeight: 500,
    description: "AI 도구 및 제안",
    displayModes: ["panel", "modal"],
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
    maxWidth: 400,
    defaultWidth: 768,
    defaultHeight: 500,
    description: "앱 설정 및 환경설정",
    shortcut: "Ctrl+,",
    displayModes: ["panel", "modal"],
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
    maxWidth: 240,
    description: "요소 속성 편집",
    shortcut: "Ctrl+Shift+P",
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
    maxWidth: 233,
    description: "CSS 스타일 편집",
    shortcut: "Ctrl+Shift+S",
  },
  {
    id: "events",
    name: "이벤트",
    nameEn: "Events",
    icon: SquareMousePointer,
    component: EventsPanel,
    category: "editor",
    defaultPosition: "right",
    minWidth: 233,
    maxWidth: 500,
    description: "이벤트 핸들러 관리",
    shortcut: "Ctrl+Shift+E",
  },
  // ADR-131 Phase 5 G3 — Actions root collection panel
  // (DataPanel 은 Phase 8 에서 제거 — DataTablePanel 이 data SSOT)
  {
    id: "actions",
    name: "액션",
    nameEn: "Actions",
    icon: Workflow,
    component: ActionsPanel,
    category: "editor",
    defaultPosition: "right",
    minWidth: 233,
    maxWidth: 500,
    description: "document.actions 루트 컬렉션 (ADR-131)",
  },
  {
    id: "history",
    name: "히스토리",
    nameEn: "History",
    icon: History,
    component: HistoryPanel,
    category: "editor",
    defaultPosition: "right",
    minWidth: 233,
    maxWidth: 400,
    defaultWidth: 320,
    defaultHeight: 450,
    description: "변경 내역 확인 및 복원",
    shortcut: "Ctrl+Shift+H",
    displayModes: ["panel", "modal"],
  },

  // Bottom panels
  {
    id: "monitor",
    name: "모니터",
    nameEn: "Monitor",
    icon: Activity,
    component: MonitorPanel,
    category: "system",
    defaultPosition: "bottom",
    minWidth: 600,
    description: "메모리 사용량 모니터링 및 최적화",
    shortcut: "Ctrl+Alt+M",
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
