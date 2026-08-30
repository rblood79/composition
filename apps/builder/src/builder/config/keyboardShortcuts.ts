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
  NAVIGATOR: 50, // Navigator panel
} as const;

// ============================================
// Shortcut Definitions
// ============================================

export const SHORTCUT_DEFINITIONS = {
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

  // Figma·Pencil 이 같은 ⇧2 에 둔 액션. ⇧2 는 "@" 를 만들므로 `code` 로 맞춘다.
  zoomToSelection: {
    key: "2",
    code: "Digit2",
    modifier: "shift",
    category: "navigation",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.NAVIGATION,
    description: "Zoom to Selection",
    i18n: { ko: "선택에 맞추기" },
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

  // 아래 패널·진입점 계열은 `allowInInput: true` 다. 입력창에 포커스가 있으면
  // registry 가 `allowInInput` 없는 단축키를 통째로 건너뛰는데(`isInputElement`
  // 는 input/textarea/contentEditable), 패널을 여는 명령까지 막히면 값을 하나
  // 입력하다가 다른 패널로 못 넘어간다 (2026-08-27 실측 — 헤더 줌 입력에
  // 포커스가 있을 때 ⌥1·⌘/·⌘,·⌘K·⌘O 가 전부 무시). ⌥+숫자는 macOS 입력창에서
  // ¡™£¢ 를 만들지만 빌더 입력창에 쓸 일이 없고, Figma 도 같은 조합을 입력 중에
  // 가로챈다. ⌘ 조합은 애초에 문자를 만들지 않는다.
  // ==========================================
  // Panels (priority: 80)
  // ==========================================

  // 레일 순서 그대로 ⌥1–⌥8 (좌측 Navigator·Components·DataTable·Theme →
  // 우측 Properties·Styles·Interactions·History). Figma 가 사이드바를 ⌥1–⌥3 으로
  // 돌리는 규약의 확장이고, ⌥ 계열은 브라우저가 예약하지 않는다 (Chrome 이
  // 쓰는 것은 ⌘1–⌘9 탭 전환). ⌥+숫자도 macOS 에서 문자가 바뀌므로 `code` 로 맞춘다.
  toggleNavigator: {
    key: "1",
    code: "Digit1",
    modifier: "alt",
    category: "panels",
    scope: "global",
    priority: SHORTCUT_PRIORITY.PANELS,
    allowInInput: true,
    description: "Toggle Navigator Panel",
    i18n: { ko: "탐색기 패널 토글" },
  },

  toggleComponents: {
    key: "2",
    code: "Digit2",
    modifier: "alt",
    category: "panels",
    scope: "global",
    priority: SHORTCUT_PRIORITY.PANELS,
    allowInInput: true,
    description: "Toggle Components Panel",
    i18n: { ko: "컴포넌트 패널 토글" },
  },

  toggleDatatable: {
    key: "3",
    code: "Digit3",
    modifier: "alt",
    category: "panels",
    scope: "global",
    priority: SHORTCUT_PRIORITY.PANELS,
    allowInInput: true,
    description: "Toggle DataTable Panel",
    i18n: { ko: "데이터테이블 패널 토글" },
  },

  toggleTheme: {
    key: "4",
    code: "Digit4",
    modifier: "alt",
    category: "panels",
    scope: "global",
    priority: SHORTCUT_PRIORITY.PANELS,
    allowInInput: true,
    description: "Toggle Theme Panel",
    i18n: { ko: "테마 패널 토글" },
  },

  toggleProperties: {
    key: "5",
    code: "Digit5",
    modifier: "alt",
    category: "panels",
    scope: "global",
    priority: SHORTCUT_PRIORITY.PANELS,
    allowInInput: true,
    description: "Toggle Properties Panel",
    i18n: { ko: "속성 패널 토글" },
  },

  toggleStyles: {
    key: "6",
    code: "Digit6",
    modifier: "alt",
    category: "panels",
    scope: "global",
    priority: SHORTCUT_PRIORITY.PANELS,
    allowInInput: true,
    description: "Toggle Styles Panel",
    i18n: { ko: "스타일 패널 토글" },
  },

  toggleEvents: {
    key: "7",
    code: "Digit7",
    modifier: "alt",
    category: "panels",
    scope: "global",
    priority: SHORTCUT_PRIORITY.PANELS,
    allowInInput: true,
    description: "Toggle Interactions Panel",
    i18n: { ko: "인터랙션 패널 토글" },
  },

  toggleHistory: {
    key: "8",
    code: "Digit8",
    modifier: "alt",
    category: "panels",
    scope: "global",
    priority: SHORTCUT_PRIORITY.PANELS,
    allowInInput: true,
    description: "Toggle History Panel",
    i18n: { ko: "히스토리 패널 토글" },
  },

  toggleWorkflowOverlay: {
    key: "w",
    code: "KeyW",
    modifier: "ctrlAlt",
    category: "panels",
    scope: "global",
    priority: SHORTCUT_PRIORITY.PANELS,
    allowInInput: true,
    description: "Toggle Workflow Overlay",
    i18n: { ko: "Workflow 오버레이 토글" },
  },

  // ⌃ 는 ⌥ 의 문자 변환을 억제하지 않는다 (억제하는 것은 ⌘ 뿐) — 실물 macOS 에서
  // ⌃⌥M 의 `event.key` 는 "µ" 라 `key` 로만 맞추면 영영 동작하지 않는다.
  // ⌥ 계열에 code 를 부여할 때 `alt`/`altShift` 만 훑고 `ctrlAlt` 를 빠뜨렸던
  // 자리다 (2026-08-27 실측 — key "µ" 무시 / key "m" 잡힘).
  toggleMonitor: {
    key: "m",
    code: "KeyM",
    modifier: "ctrlAlt",
    category: "panels",
    scope: "global",
    priority: SHORTCUT_PRIORITY.PANELS,
    allowInInput: true,
    description: "Toggle Monitor Panel",
    i18n: { ko: "모니터 패널 토글" },
  },

  /**
   * ADR-181 — 눈금자 토글. 노출 정본은 설정 패널 스위치이고 본 단축키는 보조다.
   * Figma 관례(Shift+R) 승계. `alignRight` 가 cmdShift+r 이라 무충돌.
   */
  toggleRulers: {
    key: "r",
    modifier: "shift",
    category: "panels",
    scope: "global",
    priority: SHORTCUT_PRIORITY.PANELS,
    description: "Toggle Rulers",
    i18n: { ko: "눈금자 토글" },
  },

  openSettings: {
    key: ",",
    modifier: "cmd",
    category: "panels",
    scope: "global",
    priority: SHORTCUT_PRIORITY.PANELS,
    allowInInput: true,
    description: "Open Settings",
    i18n: { ko: "설정 열기" },
  },

  // 프로젝트 목록(대시보드)으로 나간다. Figma·Sketch 가 같은 ⌘O 에 둔 자리이고,
  // Chrome 의 "파일 열기" 는 페이지가 preventDefault 로 막을 수 있다 (⌘N/⌘T/⌘W
  // 와 달리 — 라이브 확인). 종전에는 헤더 메뉴에 ⌘O 표기만 있고 정의·등록·
  // 핸들러가 셋 다 없었다.
  openProject: {
    key: "o",
    modifier: "cmd",
    category: "system",
    scope: "global",
    priority: SHORTCUT_PRIORITY.SYSTEM,
    allowInInput: true,
    capture: true,
    description: "Open Project",
    i18n: { ko: "프로젝트 열기" },
  },

  // Pencil 이 ⌘K 를 AI 채팅에 쓴다 — 같은 자리에 두면 두 도구를 오가는 손이
  // 헷갈리지 않는다. 밀려난 명령 팔레트는 Figma 가 같은 성격의 actions menu 를
  // 둔 ⌘/ 로 간다. 팔레트는 종전에 정의 없이 CommandPalette 안에서만 등록돼
  // 있어 팔레트 자기 목록에도 나오지 않았다.
  toggleAI: {
    key: "k",
    modifier: "cmd",
    category: "panels",
    scope: "global",
    priority: SHORTCUT_PRIORITY.PANELS,
    allowInInput: true,
    description: "Toggle AI Panel",
    i18n: { ko: "AI 패널 토글" },
  },

  commandPalette: {
    key: "/",
    code: "Slash",
    modifier: "cmd",
    category: "panels",
    scope: "global",
    priority: SHORTCUT_PRIORITY.PANELS,
    allowInInput: true,
    palette: false,
    description: "Open Command Palette",
    i18n: { ko: "명령 팔레트 열기" },
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

  // z-order — children[] 순서가 곧 그리기 순서라 "앞" 은 배열 뒤쪽이다
  // (ADR-182 T1 #4~#7). Figma 관례대로 끝 이동은 modifier 없는 대괄호,
  // 한 칸 이동은 ⌘ 조합.
  bringToFront: {
    key: "]",
    modifier: "none",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Bring to Front",
    i18n: { ko: "맨 앞으로" },
  },

  bringForward: {
    key: "]",
    modifier: "cmd",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Bring Forward",
    i18n: { ko: "앞으로" },
  },

  sendBackward: {
    key: "[",
    modifier: "cmd",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Send Backward",
    i18n: { ko: "뒤로" },
  },

  sendToBack: {
    key: "[",
    modifier: "none",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Send to Back",
    i18n: { ko: "맨 뒤로" },
  },

  duplicate: {
    key: "d",
    modifier: "cmd",
    category: "canvas",
    // 레이어 트리 선택에서도 복제한다 (Figma/Pen 동형) — 실제 핸들러 등록
    // (`CanvasSelectionShortcuts`) 과 같은 값을 유지해야 치트시트·툴팁 표기가
    // 실동작과 갈리지 않는다
    scope: ["canvas-focused", "panel:navigator"],
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
    description: "Create/Detach Component",
    i18n: { ko: "컴포넌트 생성/분리" },
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

  // ⌥ 계열은 macOS 에서 문자를 바꾼다 (⌥A→å, ⌥S→ß, ⌥⇧V→◊). `key` 로 맞추면
  // 실물 키보드에서 영영 동작하지 않으므로 이 그룹은 `code` 로 맞춘다 —
  // 종전 `distributeV`(⌥⇧V, code 없음)가 그 상태였다.
  alignLeft: {
    key: "a",
    code: "KeyA",
    modifier: "alt",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Align Left",
    i18n: { ko: "왼쪽 정렬" },
  },

  alignHCenter: {
    key: "h",
    code: "KeyH",
    modifier: "alt",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Align Horizontal Center",
    i18n: { ko: "가로 중앙 정렬" },
  },

  alignRight: {
    key: "d",
    code: "KeyD",
    modifier: "alt",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Align Right",
    i18n: { ko: "오른쪽 정렬" },
  },

  alignTop: {
    key: "w",
    code: "KeyW",
    modifier: "alt",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Align Top",
    i18n: { ko: "위쪽 정렬" },
  },

  alignVCenter: {
    key: "v",
    code: "KeyV",
    modifier: "alt",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Align Vertical Center",
    i18n: { ko: "세로 중앙 정렬" },
  },

  alignBottom: {
    key: "s",
    code: "KeyS",
    modifier: "alt",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Align Bottom",
    i18n: { ko: "아래쪽 정렬" },
  },

  distributeH: {
    key: "h",
    code: "KeyH",
    modifier: "altShift",
    category: "canvas",
    scope: "canvas-focused",
    priority: SHORTCUT_PRIORITY.CANVAS,
    description: "Distribute Horizontally",
    i18n: { ko: "가로 분배" },
  },

  distributeV: {
    key: "v",
    code: "KeyV",
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

  // ⌘⌥C / ⌘⌥V — Figma 의 「속성 복사·붙여넣기」와 같은 자리. 어느 패널에
  // 포커스가 있느냐로 대상이 갈린다 (properties=D2 props / styles=D3 시각 스타일).
  // 종전 ⌘⇧C 는 Chrome DevTools 요소 검사라 페이지가 막을 수 없는 자리였다.
  copyProperties: {
    key: "c",
    modifier: "cmdAlt",
    category: "properties",
    scope: "panel:properties",
    priority: SHORTCUT_PRIORITY.PROPERTIES,
    description: "Copy Properties",
    i18n: { ko: "속성 복사" },
  },

  pasteProperties: {
    key: "v",
    modifier: "cmdAlt",
    category: "properties",
    scope: "panel:properties",
    priority: SHORTCUT_PRIORITY.PROPERTIES,
    description: "Paste Properties",
    i18n: { ko: "속성 붙여넣기" },
  },

  // ==========================================
  // Styles Panel (priority: 50)
  // ==========================================

  copyStyles: {
    key: "c",
    modifier: "cmdAlt",
    category: "properties",
    scope: "panel:styles",
    priority: SHORTCUT_PRIORITY.PROPERTIES,
    description: "Copy Styles",
    i18n: { ko: "스타일 복사" },
  },

  pasteStyles: {
    key: "v",
    modifier: "cmdAlt",
    category: "properties",
    scope: "panel:styles",
    priority: SHORTCUT_PRIORITY.PROPERTIES,
    description: "Paste Styles",
    i18n: { ko: "스타일 붙여넣기" },
  },

  toggleFocusMode: {
    key: "s",
    code: "KeyS",
    modifier: "altShift",
    category: "properties",
    scope: "panel:styles",
    priority: SHORTCUT_PRIORITY.PROPERTIES,
    description: "Toggle Focus Mode",
    i18n: { ko: "포커스 모드 토글" },
  },

  // 종전에 정의가 「전부 펼침」·「전부 접힘」 둘이었지만 구현은 접힘 개수를 보고
  // 번갈아 도는 토글 하나였다. 정의를 실제에 맞춰 하나로 합친다.
  toggleSections: {
    key: "e",
    code: "KeyE",
    modifier: "altShift",
    category: "properties",
    scope: "panel:styles",
    priority: SHORTCUT_PRIORITY.PROPERTIES,
    description: "Toggle All Sections",
    i18n: { ko: "모든 섹션 펼침/접힘" },
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

  // ==========================================
  // Navigator Panel / Tree Navigation (priority: 50)
  //
  // 아래 8종은 RAC `TreeBase` 네이티브 키보드가 처리한다 — 어느
  // `bindHandlersToDefinitions` 에도 등록이 없고(D1), 포커스된 행에 작용하므로
  // 팔레트에서 고를 수 있어도 실행할 대상이 없다. `palette: false` (ADR-195).
  // ==========================================

  treeNavDown: {
    key: "ArrowDown",
    modifier: "none",
    category: "navigator",
    scope: "panel:navigator",
    priority: SHORTCUT_PRIORITY.NAVIGATOR,
    palette: false,
    description: "Next Item",
    i18n: { ko: "다음 항목" },
  },

  treeNavUp: {
    key: "ArrowUp",
    modifier: "none",
    category: "navigator",
    scope: "panel:navigator",
    priority: SHORTCUT_PRIORITY.NAVIGATOR,
    palette: false,
    description: "Previous Item",
    i18n: { ko: "이전 항목" },
  },

  treeNavRight: {
    key: "ArrowRight",
    modifier: "none",
    category: "navigator",
    scope: "panel:navigator",
    priority: SHORTCUT_PRIORITY.NAVIGATOR,
    palette: false,
    description: "Expand",
    i18n: { ko: "펼치기" },
  },

  treeNavLeft: {
    key: "ArrowLeft",
    modifier: "none",
    category: "navigator",
    scope: "panel:navigator",
    priority: SHORTCUT_PRIORITY.NAVIGATOR,
    palette: false,
    description: "Collapse",
    i18n: { ko: "접기" },
  },

  treeNavHome: {
    key: "Home",
    modifier: "none",
    category: "navigator",
    scope: "panel:navigator",
    priority: SHORTCUT_PRIORITY.NAVIGATOR,
    palette: false,
    description: "First Item",
    i18n: { ko: "첫 번째 항목" },
  },

  treeNavEnd: {
    key: "End",
    modifier: "none",
    category: "navigator",
    scope: "panel:navigator",
    priority: SHORTCUT_PRIORITY.NAVIGATOR,
    palette: false,
    description: "Last Item",
    i18n: { ko: "마지막 항목" },
  },

  treeSelect: {
    key: "Enter",
    modifier: "none",
    category: "navigator",
    scope: "panel:navigator",
    priority: SHORTCUT_PRIORITY.NAVIGATOR,
    palette: false,
    description: "Select Item",
    i18n: { ko: "항목 선택" },
  },

  treeSelectSpace: {
    key: " ",
    code: "Space",
    modifier: "none",
    category: "navigator",
    scope: "panel:navigator",
    priority: SHORTCUT_PRIORITY.NAVIGATOR,
    palette: false,
    description: "Select Item",
    i18n: { ko: "항목 선택" },
  },
} as const satisfies ShortcutDefinitions;

// ============================================
// Shortcut ID Type (from keys)
// ============================================

/**
 * 단축키 id 리터럴 union — 위 객체의 키에서 파생된다.
 *
 * **`SHORTCUT_DEFINITIONS` 에 타입 주석을 붙이면 이 union 이 `string` 으로
 * 무너진다.** 주석은 `as const` 를 이기므로 `typeof` 가
 * `Record<string, ShortcutDefinition>` 이 되고, `keyof` 는 `string` 이 된다.
 * 그 상태에서는 아래 소비처들의 `as ShortcutId` 캐스팅이 전부 no-op 이고
 * `shortcutId?: ShortcutId` 가 오타를 하나도 막지 못한다 (2026-08-17 실측 —
 * 존재하지 않는 id 대입이 컴파일 통과). 항목별 형태 검사는 `satisfies` 가
 * 맡으므로 주석 없이도 잃는 것이 없다.
 */
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
