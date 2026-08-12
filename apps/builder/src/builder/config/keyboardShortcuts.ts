/**
 * Keyboard Shortcuts Configuration
 *
 * 전체 키보드 단축키 정의 (핸들러 제외)
 * 핸들러는 각 훅/컴포넌트에서 바인딩
 *
 * @since Phase 2 구현 (2025-12-28)
 */

import type {
  ShortcutDefinition,
  ShortcutDefinitions,
  ShortcutScope,
} from "../types/keyboard";

// ============================================
// Priority Constants
// ============================================

export const SHORTCUT_PRIORITY = {
  SYSTEM: 100, // Undo, Redo, Save
  NAVIGATION: 90, // Zoom, Pan
  PANELS: 80, // Panel toggles
  CANVAS: 70, // Element manipulation
  TOOLS: 60, // Tool selection
  PROPERTIES: 50, // Property editing
  EVENTS: 50, // Events panel
  NODES: 50, // Nodes panel
} as const;

// ============================================
// Shortcut Definitions
// ============================================

export const SHORTCUT_DEFINITIONS: ShortcutDefinitions = {
  // ==========================================
  // System (priority: 100)
  // ==========================================

  undo: {
    key: "z",
    modifier: "cmd",
    category: "system",
    scope: "global",
    priority: SHORTCUT_PRIORITY.SYSTEM,
    allowInInput: true,
    capture: true,
    description: "Undo",
    i18n: { ko: "실행 취소" },
  },

  redo: {
    key: "z",
    modifier: "cmdShift",
    category: "system",
    scope: "global",
    priority: SHORTCUT_PRIORITY.SYSTEM,
    allowInInput: true,
    capture: true,
    description: "Redo",
    i18n: { ko: "다시 실행" },
  },

  // ==========================================
  // Navigation (priority: 90)
  // ==========================================

  zoomIn: {
    key: "=",
    modifier: "cmd",
    category: "navigation",
    scope: "global",
    priority: SHORTCUT_PRIORITY.NAVIGATION,
    capture: true,
    description: "Zoom In",
    i18n: { ko: "확대" },
  },

  zoomInNumpad: {
    key: "+",
    modifier: "cmd",
    category: "navigation",
    scope: "global",
    priority: SHORTCUT_PRIORITY.NAVIGATION,
    capture: true,
    description: "Zoom In (numpad)",
    i18n: { ko: "확대 (숫자패드)" },
  },

  zoomOut: {
    key: "-",
    modifier: "cmd",
    category: "navigation",
    scope: "global",
    priority: SHORTCUT_PRIORITY.NAVIGATION,
    capture: true,
    description: "Zoom Out",
    i18n: { ko: "축소" },
  },

  zoomToFit: {
    key: "0",
    modifier: "cmd",
    category: "navigation",
    scope: "global",
    priority: SHORTCUT_PRIORITY.NAVIGATION,
    capture: true,
    description: "Fit to Screen",
    i18n: { ko: "화면에 맞추기" },
  },

  zoom100: {
    key: "1",
    modifier: "cmd",
    category: "navigation",
    scope: "global",
    priority: SHORTCUT_PRIORITY.NAVIGATION,
    capture: true,
    description: "Zoom 100%",
    i18n: { ko: "100%로 확대" },
  },

  zoom200: {
    key: "2",
    modifier: "cmd",
    category: "navigation",
    scope: "global",
    priority: SHORTCUT_PRIORITY.NAVIGATION,
    capture: true,
    description: "Zoom 200%",
    i18n: { ko: "200%로 확대" },
  },

  // ==========================================
  // Panels (priority: 80)
  // ==========================================

  toggleNodes: {
    key: "n",
    modifier: "ctrlShift",
    category: "panels",
    scope: "global",
    priority: SHORTCUT_PRIORITY.PANELS,
    description: "Toggle Nodes Panel",
    i18n: { ko: "노드 패널 토글" },
  },

  toggleComponents: {
    key: "c",
    modifier: "ctrlShift",
    category: "panels",
    scope: "global",
    priority: SHORTCUT_PRIORITY.PANELS,
    description: "Toggle Components Panel",
    i18n: { ko: "컴포넌트 패널 토글" },
  },

  toggleProperties: {
    key: "p",
    modifier: "ctrlShift",
    category: "panels",
    scope: "global",
    priority: SHORTCUT_PRIORITY.PANELS,
    description: "Toggle Properties Panel",
    i18n: { ko: "속성 패널 토글" },
  },

  toggleStyles: {
    key: "s",
    modifier: "ctrlShift",
    category: "panels",
    scope: "global",
    priority: SHORTCUT_PRIORITY.PANELS,
    description: "Toggle Styles Panel",
    i18n: { ko: "스타일 패널 토글" },
  },

  toggleEvents: {
    key: "e",
    modifier: "ctrlShift",
    category: "panels",
    scope: "global",
    priority: SHORTCUT_PRIORITY.PANELS,
    description: "Toggle Events Panel",
    i18n: { ko: "이벤트 패널 토글" },
  },

  toggleHistory: {
    key: "h",
    modifier: "ctrlShift",
    category: "panels",
    scope: "global",
    priority: SHORTCUT_PRIORITY.PANELS,
    description: "Toggle History Panel",
    i18n: { ko: "히스토리 패널 토글" },
  },

  toggleMonitor: {
    key: "m",
    modifier: "ctrlAlt",
    category: "panels",
    scope: "global",
    priority: SHORTCUT_PRIORITY.PANELS,
    description: "Toggle Monitor Panel",
    i18n: { ko: "모니터 패널 토글" },
  },

  openSettings: {
    key: ",",
    modifier: "cmd",
    category: "panels",
    scope: "global",
    priority: SHORTCUT_PRIORITY.PANELS,
    description: "Open Settings",
    i18n: { ko: "설정 열기" },
  },

  toggleHelp: {
    key: "?",
    modifier: "cmd",
    category: "panels",
    scope: "global",
    priority: SHORTCUT_PRIORITY.PANELS,
    description: "Toggle Keyboard Shortcuts Help",
    i18n: { ko: "키보드 단축키 도움말 토글" },
  },

  // ==========================================
  // Canvas (priority: 70)
  // ==========================================

  copy: {
    key: "c",
    modifier: "cmd",
    category: "canvas",
    scope: ["canvas-focused", "panel:events"],
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Copy",
    i18n: { ko: "복사" },
  },

  paste: {
    key: "v",
    modifier: "cmd",
    category: "canvas",
    scope: ["canvas-focused", "panel:events"],
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Paste",
    i18n: { ko: "붙여넣기" },
  },

  cut: {
    key: "x",
    modifier: "cmd",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Cut",
    i18n: { ko: "잘라내기" },
  },

  duplicate: {
    key: "d",
    modifier: "cmd",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Duplicate",
    i18n: { ko: "복제" },
  },

  toggleComponentOrigin: {
    key: "k",
    modifier: "cmdAlt",
    category: "canvas",
    scope: ["canvas-focused", "panel:properties"],
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Create/Remove Component",
    i18n: { ko: "컴포넌트 생성/해제" },
  },

  detachInstance: {
    key: "x",
    modifier: "cmdAlt",
    category: "canvas",
    scope: ["canvas-focused", "panel:properties"],
    priority: SHORTCUT_PRIORITY.CANVAS,
    capture: true,
    description: "Detach Instance",
    i18n: { ko: "인스턴스 분리" },
  },

  selectAll: {
    key: "a",
    modifier: "cmd",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Select All",
    i18n: { ko: "모두 선택" },
  },

  delete: {
    key: "Backspace",
    modifier: "none",
    category: "canvas",
    scope: ["canvas-focused", "panel:events"],
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Delete",
    i18n: { ko: "삭제" },
  },

  deleteAlt: {
    key: "Delete",
    modifier: "none",
    category: "canvas",
    scope: ["canvas-focused", "panel:events"],
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Delete",
    i18n: { ko: "삭제" },
  },

  escape: {
    key: "Escape",
    modifier: "none",
    category: "canvas",
    scope: ["canvas-focused", "panel:events", "modal"],
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Clear Selection / Close Modal",
    i18n: { ko: "선택 해제 / 모달 닫기" },
  },

  nextElement: {
    key: "Tab",
    modifier: "none",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Next Element",
    i18n: { ko: "다음 요소" },
  },

  prevElement: {
    key: "Tab",
    modifier: "shift",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Previous Element",
    i18n: { ko: "이전 요소" },
  },

  // ==========================================
  // Grouping & Alignment (priority: 70)
  // ==========================================

  group: {
    key: "g",
    modifier: "cmd",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Frame",
    i18n: { ko: "프레임" },
  },

  ungroup: {
    key: "g",
    modifier: "cmdShift",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Unframe",
    i18n: { ko: "프레임 해제" },
  },

  alignLeft: {
    key: "l",
    modifier: "cmdShift",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Align Left",
    i18n: { ko: "왼쪽 정렬" },
  },

  alignHCenter: {
    key: "h",
    modifier: "cmdShift",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS - 1, // toggleHistory보다 낮음
    description: "Align Horizontal Center",
    i18n: { ko: "가로 중앙 정렬" },
  },

  alignRight: {
    key: "r",
    modifier: "cmdShift",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Align Right",
    i18n: { ko: "오른쪽 정렬" },
  },

  alignTop: {
    key: "t",
    modifier: "cmdShift",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Align Top",
    i18n: { ko: "위쪽 정렬" },
  },

  alignVCenter: {
    key: "m",
    modifier: "cmdShift",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Align Vertical Center",
    i18n: { ko: "세로 중앙 정렬" },
  },

  alignBottom: {
    key: "b",
    modifier: "cmdShift",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Align Bottom",
    i18n: { ko: "아래쪽 정렬" },
  },

  distributeH: {
    key: "d",
    modifier: "cmdShift",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Distribute Horizontally",
    i18n: { ko: "가로 분배" },
  },

  distributeV: {
    key: "v",
    modifier: "altShift",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Distribute Vertically",
    i18n: { ko: "세로 분배" },
  },

  // ==========================================
  // Properties Panel (priority: 50)
  // ==========================================

  copyProperties: {
    key: "c",
    modifier: "cmdShift",
    category: "properties",
    scope: "panel:properties",
    priority: SHORTCUT_PRIORITY.PROPERTIES,
    description: "Copy Properties",
    i18n: { ko: "속성 복사" },
  },

  pasteProperties: {
    key: "v",
    modifier: "cmdShift",
    category: "properties",
    scope: "panel:properties",
    priority: SHORTCUT_PRIORITY.PROPERTIES,
    description: "Paste Properties",
    i18n: { ko: "속성 붙여넣기" },
  },

  copyAllProperties: {
    key: "c",
    modifier: "cmdAlt",
    category: "properties",
    scope: "panel:properties",
    priority: SHORTCUT_PRIORITY.PROPERTIES,
    description: "Copy All Properties",
    i18n: { ko: "모든 속성 복사" },
  },

  pasteAllProperties: {
    key: "v",
    modifier: "cmdAlt",
    category: "properties",
    scope: "panel:properties",
    priority: SHORTCUT_PRIORITY.PROPERTIES,
    description: "Paste All Properties",
    i18n: { ko: "모든 속성 붙여넣기" },
  },

  // ==========================================
  // Styles Panel (priority: 50)
  // ==========================================

  copyStyles: {
    key: "c",
    modifier: "cmdShift",
    category: "properties",
    scope: "panel:styles",
    priority: SHORTCUT_PRIORITY.PROPERTIES,
    description: "Copy Styles",
    i18n: { ko: "스타일 복사" },
  },

  pasteStyles: {
    key: "v",
    modifier: "cmdShift",
    category: "properties",
    scope: "panel:styles",
    priority: SHORTCUT_PRIORITY.PROPERTIES,
    description: "Paste Styles",
    i18n: { ko: "스타일 붙여넣기" },
  },

  toggleFocusMode: {
    key: "f",
    modifier: "cmd",
    category: "properties",
    scope: "panel:styles",
    priority: SHORTCUT_PRIORITY.PROPERTIES,
    description: "Toggle Focus Mode",
    i18n: { ko: "포커스 모드 토글" },
  },

  expandAllSections: {
    key: "e",
    modifier: "cmd",
    category: "properties",
    scope: "panel:styles",
    priority: SHORTCUT_PRIORITY.PROPERTIES,
    description: "Expand All Sections",
    i18n: { ko: "모든 섹션 펼치기" },
  },

  collapseAllSections: {
    key: "w",
    modifier: "cmd",
    category: "properties",
    scope: "panel:styles",
    priority: SHORTCUT_PRIORITY.PROPERTIES,
    description: "Collapse All Sections",
    i18n: { ko: "모든 섹션 접기" },
  },

  // ==========================================
  // Canvas — 형제 순서 재배치 (priority: 70)
  //
  // composition 은 flow 자식의 x/y 를 레이아웃 엔진이 소유하므로 화살표가
  // 뜻할 수 있는 "이동" 은 canonical children[] 순서 변경뿐이다 (ADR-118).
  // 4방향 모두 축과 무관하게 이전/다음 형제로 매핑한다 — 컨테이너 방향에 따라
  // 키 의미가 달라지면 예측성이 떨어진다.
  // ==========================================

  arrowUp: {
    key: "ArrowUp",
    modifier: "none",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Move Before Sibling",
    i18n: { ko: "이전 형제로 이동" },
  },

  arrowDown: {
    key: "ArrowDown",
    modifier: "none",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Move After Sibling",
    i18n: { ko: "다음 형제로 이동" },
  },

  arrowLeft: {
    key: "ArrowLeft",
    modifier: "none",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Move Before Sibling",
    i18n: { ko: "이전 형제로 이동" },
  },

  arrowRight: {
    key: "ArrowRight",
    modifier: "none",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Move After Sibling",
    i18n: { ko: "다음 형제로 이동" },
  },

  // ==========================================
  // Canvas — 페이지 nudge (ADR-177 Phase 3)
  //
  // 페이지(body) 선택 상태에서 화살표는 형제 순서가 아니라 페이지 위치 이동이다
  // (무수정 1px — 위 arrow* 핸들러가 선택 대상에 따라 분기). Shift 조합은
  // 페이지 선택 상태 전용 10px — element 선택 상태에서는 no-op.
  // ==========================================

  arrowUpShift: {
    key: "ArrowUp",
    modifier: "shift",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Nudge Page Up 10px",
    i18n: { ko: "페이지 위로 10px 이동" },
  },

  arrowDownShift: {
    key: "ArrowDown",
    modifier: "shift",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Nudge Page Down 10px",
    i18n: { ko: "페이지 아래로 10px 이동" },
  },

  arrowLeftShift: {
    key: "ArrowLeft",
    modifier: "shift",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Nudge Page Left 10px",
    i18n: { ko: "페이지 왼쪽으로 10px 이동" },
  },

  arrowRightShift: {
    key: "ArrowRight",
    modifier: "shift",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Nudge Page Right 10px",
    i18n: { ko: "페이지 오른쪽으로 10px 이동" },
  },

  // ==========================================
  // Events Panel (priority: 50)
  //
  // 실제 처리는 패널 자체 훅(`useBlockKeyboard`)의 raw key 분기 — 아래 정의는
  // 치트시트/툴팁 표기용이다 (구 `arrowUp`/`arrowDown` 의 `panel:events` scope
  // 를 캔버스 재배치와 분리하면서 표기만 이관).
  // ==========================================

  eventsNavUp: {
    key: "ArrowUp",
    modifier: "none",
    category: "events",
    scope: "panel:events",
    priority: SHORTCUT_PRIORITY.EVENTS,
    description: "Navigate Up",
    i18n: { ko: "위로 이동" },
  },

  eventsNavDown: {
    key: "ArrowDown",
    modifier: "none",
    category: "events",
    scope: "panel:events",
    priority: SHORTCUT_PRIORITY.EVENTS,
    description: "Navigate Down",
    i18n: { ko: "아래로 이동" },
  },

  // ==========================================
  // Nodes Panel / Tree Navigation (priority: 50)
  // ==========================================

  treeNavDown: {
    key: "ArrowDown",
    modifier: "none",
    category: "nodes",
    scope: "panel:nodes",
    priority: SHORTCUT_PRIORITY.NODES,
    description: "Next Item",
    i18n: { ko: "다음 항목" },
  },

  treeNavUp: {
    key: "ArrowUp",
    modifier: "none",
    category: "nodes",
    scope: "panel:nodes",
    priority: SHORTCUT_PRIORITY.NODES,
    description: "Previous Item",
    i18n: { ko: "이전 항목" },
  },

  treeNavRight: {
    key: "ArrowRight",
    modifier: "none",
    category: "nodes",
    scope: "panel:nodes",
    priority: SHORTCUT_PRIORITY.NODES,
    description: "Expand",
    i18n: { ko: "펼치기" },
  },

  treeNavLeft: {
    key: "ArrowLeft",
    modifier: "none",
    category: "nodes",
    scope: "panel:nodes",
    priority: SHORTCUT_PRIORITY.NODES,
    description: "Collapse",
    i18n: { ko: "접기" },
  },

  treeNavHome: {
    key: "Home",
    modifier: "none",
    category: "nodes",
    scope: "panel:nodes",
    priority: SHORTCUT_PRIORITY.NODES,
    description: "First Item",
    i18n: { ko: "첫 번째 항목" },
  },

  treeNavEnd: {
    key: "End",
    modifier: "none",
    category: "nodes",
    scope: "panel:nodes",
    priority: SHORTCUT_PRIORITY.NODES,
    description: "Last Item",
    i18n: { ko: "마지막 항목" },
  },

  treeSelect: {
    key: "Enter",
    modifier: "none",
    category: "nodes",
    scope: "panel:nodes",
    priority: SHORTCUT_PRIORITY.NODES,
    description: "Select Item",
    i18n: { ko: "항목 선택" },
  },

  treeSelectSpace: {
    key: " ",
    code: "Space",
    modifier: "none",
    category: "nodes",
    scope: "panel:nodes",
    priority: SHORTCUT_PRIORITY.NODES,
    description: "Select Item",
    i18n: { ko: "항목 선택" },
  },
} as const;

// ============================================
// Shortcut ID Type (from keys)
// ============================================

export type ShortcutId = keyof typeof SHORTCUT_DEFINITIONS;

// ============================================
// Helper Functions
// ============================================

/**
 * 특정 스코프에서 활성화된 단축키 필터링
 */
export function getShortcutsForScope(
  scope: ShortcutScope,
): ShortcutDefinition[] {
  return Object.values(SHORTCUT_DEFINITIONS).filter((def) => {
    if (def.scope === "global") return true;
    if (Array.isArray(def.scope)) return def.scope.includes(scope);
    return def.scope === scope;
  });
}

/**
 * 카테고리별 단축키 그룹화
 */
export function getShortcutsByCategory(): Record<string, ShortcutDefinition[]> {
  const grouped: Record<string, ShortcutDefinition[]> = {};

  for (const def of Object.values(SHORTCUT_DEFINITIONS)) {
    if (!grouped[def.category]) {
      grouped[def.category] = [];
    }
    grouped[def.category].push(def);
  }

  return grouped;
}

/**
 * 단축키 ID로 정의 가져오기
 */
export function getShortcutById(
  id: ShortcutId,
): ShortcutDefinition | undefined {
  return SHORTCUT_DEFINITIONS[id];
}

/**
 * 모든 단축키 ID 목록
 */
export function getAllShortcutIds(): ShortcutId[] {
  return Object.keys(SHORTCUT_DEFINITIONS) as ShortcutId[];
}

/**
 * 단축키 개수
 */
export const SHORTCUT_COUNT = Object.keys(SHORTCUT_DEFINITIONS).length;
