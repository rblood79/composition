/**
 * Layout Preset Definitions
 *
 * Phase 6: 미리 정의된 레이아웃 프리셋
 *
 * **슬롯은 자기 배치를 스스로 선언한다 (2026-07-26)**: `containerStyle` 만으로는 슬롯이
 * 놓일 자리가 정해지지 않는다. 빈 Slot 은 콘텐츠 크기가 0 이라, 주축 크기를 주지 않으면
 * 레이아웃 엔진이 0 을 산출해 캔버스에 아무것도 그려지지 않는다 (실측: fullscreen 적용 후
 * content 슬롯이 `width 0` → 프레임이 빈 채로 보임). grid 프리셋은 `gridTemplateAreas` 를
 * 컨테이너에만 두고 슬롯에 배치를 안 줘서 auto-placement 로 겹쳤다. 그래서 모든 슬롯이
 * `defaultStyle` 로 주축 크기(flex) 또는 배치(grid line)를 명시한다.
 */

import type { CSSProperties } from "react";

import type { LayoutPreset, PresetCategoryMeta } from "./types";

/**
 * 빈 Slot 의 오소링 최소 크기(px).
 *
 * 주축이 auto 인 자리(flex column 의 header/footer 밴드, grid 의 `auto` row)에서 빈 슬롯은
 * 0 이 된다. catalog `COMPONENT_RULES_TABLE.Slot.sizes.md.height` 와 같은 값으로 하한을 둬,
 * 자식이 들어오면 그만큼 자라되 빈 상태에서도 보이고 drop 대상으로 잡히게 한다.
 */
const EMPTY_SLOT_MIN_HEIGHT = 60;

/** 남는 주축 공간을 채우는 슬롯 (content 계열). */
const FLEXIBLE_SLOT: CSSProperties = {
  flex: "1",
  minHeight: EMPTY_SLOT_MIN_HEIGHT,
};

/** 콘텐츠 높이만큼만 차지하는 밴드 슬롯 (header/footer 계열). */
const BAND_SLOT: CSSProperties = { minHeight: EMPTY_SLOT_MIN_HEIGHT };

/**
 * grid 슬롯 배치 — **이름과 숫자 line 을 함께** 낸다.
 *
 * `gridArea` 이름만 주면 레이아웃 엔진이 배치를 해석하지 못하고 auto-placement 로 degrade
 * 한다 (rules/layout-engine.md §"Grid area 이름 해석"). DOM/CSS 경로는 이름을, Skia 경로는
 * 숫자 line 을 소비하므로 둘을 병기해야 두 렌더 결과가 일치한다.
 *
 * @param area   `gridTemplateAreas` 에 선언된 영역 이름
 * @param column `[start, end]` 열 line (1-based, end 는 exclusive)
 * @param row    `[start, end]` 행 line
 */
function gridSlot(
  area: string,
  column: readonly [number, number],
  row: readonly [number, number],
  extra: CSSProperties = {},
): CSSProperties {
  return {
    gridArea: area,
    gridColumnStart: String(column[0]),
    gridColumnEnd: String(column[1]),
    gridRowStart: String(row[0]),
    gridRowEnd: String(row[1]),
    ...extra,
  };
}

export const LAYOUT_PRESETS: Record<string, LayoutPreset> = {
  // ========== Basic Presets ==========
  fullscreen: {
    id: "fullscreen",
    name: "전체화면",
    description: "단일 전체 화면 콘텐츠",
    category: "basic",
    slots: [
      {
        name: "content",
        required: true,
        description: "전체 화면 콘텐츠",
        defaultStyle: FLEXIBLE_SLOT,
      },
    ],
    containerStyle: {
      display: "flex",
      minHeight: "100vh",
    },
    previewAreas: [
      {
        name: "content",
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        isSlot: true,
        required: true,
      },
    ],
  },

  "vertical-2": {
    id: "vertical-2",
    name: "수직 2단",
    description: "Header + Content",
    category: "basic",
    slots: [
      {
        name: "header",
        required: false,
        description: "상단 헤더 영역",
        defaultStyle: BAND_SLOT,
      },
      {
        name: "content",
        required: true,
        description: "메인 콘텐츠 영역",
        defaultStyle: FLEXIBLE_SLOT,
      },
    ],
    containerStyle: {
      display: "flex",
      flexDirection: "column",
      minHeight: "100vh",
    },
    previewAreas: [
      { name: "header", x: 0, y: 0, width: 100, height: 15, isSlot: true },
      {
        name: "content",
        x: 0,
        y: 15,
        width: 100,
        height: 85,
        isSlot: true,
        required: true,
      },
    ],
  },

  "vertical-3": {
    id: "vertical-3",
    name: "수직 3단",
    description: "Header + Content + Footer",
    category: "basic",
    slots: [
      {
        name: "header",
        required: false,
        description: "상단 헤더 영역",
        defaultStyle: BAND_SLOT,
      },
      {
        name: "content",
        required: true,
        description: "메인 콘텐츠 영역",
        defaultStyle: FLEXIBLE_SLOT,
      },
      {
        name: "footer",
        required: false,
        description: "하단 푸터 영역",
        defaultStyle: BAND_SLOT,
      },
    ],
    containerStyle: {
      display: "flex",
      flexDirection: "column",
      minHeight: "100vh",
    },
    previewAreas: [
      { name: "header", x: 0, y: 0, width: 100, height: 12, isSlot: true },
      {
        name: "content",
        x: 0,
        y: 12,
        width: 100,
        height: 76,
        isSlot: true,
        required: true,
      },
      { name: "footer", x: 0, y: 88, width: 100, height: 12, isSlot: true },
    ],
  },

  // ========== Sidebar Presets ==========
  "sidebar-left": {
    id: "sidebar-left",
    name: "좌측 사이드바",
    description: "Sidebar + Content",
    category: "sidebar",
    slots: [
      {
        name: "sidebar",
        required: false,
        description: "좌측 사이드바",
        defaultStyle: { width: "250px", flexShrink: 0 },
      },
      {
        name: "content",
        required: true,
        description: "메인 콘텐츠",
        defaultStyle: FLEXIBLE_SLOT,
      },
    ],
    containerStyle: {
      display: "flex",
      flexDirection: "row",
      minHeight: "100vh",
    },
    previewAreas: [
      { name: "sidebar", x: 0, y: 0, width: 25, height: 100, isSlot: true },
      {
        name: "content",
        x: 25,
        y: 0,
        width: 75,
        height: 100,
        isSlot: true,
        required: true,
      },
    ],
  },

  "sidebar-right": {
    id: "sidebar-right",
    name: "우측 사이드바",
    description: "Content + Sidebar",
    category: "sidebar",
    slots: [
      {
        name: "content",
        required: true,
        description: "메인 콘텐츠",
        defaultStyle: FLEXIBLE_SLOT,
      },
      {
        name: "sidebar",
        required: false,
        description: "우측 사이드바",
        defaultStyle: { width: "250px", flexShrink: 0 },
      },
    ],
    containerStyle: {
      display: "flex",
      flexDirection: "row",
      minHeight: "100vh",
    },
    previewAreas: [
      {
        name: "content",
        x: 0,
        y: 0,
        width: 75,
        height: 100,
        isSlot: true,
        required: true,
      },
      { name: "sidebar", x: 75, y: 0, width: 25, height: 100, isSlot: true },
    ],
  },

  // ========== Complex Presets ==========
  "holy-grail": {
    id: "holy-grail",
    name: "Holy Grail",
    description: "Header + (Sidebar + Content + Aside) + Footer",
    category: "complex",
    // cols: 200px 1fr 200px (line 1~4) / rows: auto 1fr auto (line 1~4)
    slots: [
      {
        name: "header",
        required: false,
        defaultStyle: gridSlot("header", [1, 4], [1, 2], BAND_SLOT),
      },
      {
        name: "sidebar",
        required: false,
        defaultStyle: gridSlot("sidebar", [1, 2], [2, 3]),
      },
      {
        name: "content",
        required: true,
        defaultStyle: gridSlot("content", [2, 3], [2, 3]),
      },
      {
        name: "aside",
        required: false,
        defaultStyle: gridSlot("aside", [3, 4], [2, 3]),
      },
      {
        name: "footer",
        required: false,
        defaultStyle: gridSlot("footer", [1, 4], [3, 4], BAND_SLOT),
      },
    ],
    containerStyle: {
      display: "grid",
      gridTemplateAreas: `
        "header header header"
        "sidebar content aside"
        "footer footer footer"
      `,
      gridTemplateColumns: "200px 1fr 200px",
      gridTemplateRows: "auto 1fr auto",
      minHeight: "100vh",
    },
    previewAreas: [
      { name: "header", x: 0, y: 0, width: 100, height: 12, isSlot: true },
      { name: "sidebar", x: 0, y: 12, width: 20, height: 76, isSlot: true },
      {
        name: "content",
        x: 20,
        y: 12,
        width: 60,
        height: 76,
        isSlot: true,
        required: true,
      },
      { name: "aside", x: 80, y: 12, width: 20, height: 76, isSlot: true },
      { name: "footer", x: 0, y: 88, width: 100, height: 12, isSlot: true },
    ],
  },

  "complex-3col": {
    id: "complex-3col",
    name: "3열 레이아웃",
    description: "Header + 3 Columns + Footer",
    category: "complex",
    // cols: 1fr 2fr 1fr (line 1~4) / rows: auto 1fr auto (line 1~4)
    slots: [
      {
        name: "header",
        required: false,
        defaultStyle: gridSlot("header", [1, 4], [1, 2], BAND_SLOT),
      },
      {
        name: "left",
        required: false,
        defaultStyle: gridSlot("left", [1, 2], [2, 3]),
      },
      {
        name: "content",
        required: true,
        defaultStyle: gridSlot("content", [2, 3], [2, 3]),
      },
      {
        name: "right",
        required: false,
        defaultStyle: gridSlot("right", [3, 4], [2, 3]),
      },
      {
        name: "footer",
        required: false,
        defaultStyle: gridSlot("footer", [1, 4], [3, 4], BAND_SLOT),
      },
    ],
    containerStyle: {
      display: "grid",
      gridTemplateAreas: `
        "header header header"
        "left content right"
        "footer footer footer"
      `,
      gridTemplateColumns: "1fr 2fr 1fr",
      gridTemplateRows: "auto 1fr auto",
      minHeight: "100vh",
    },
    previewAreas: [
      { name: "header", x: 0, y: 0, width: 100, height: 12, isSlot: true },
      { name: "left", x: 0, y: 12, width: 25, height: 76, isSlot: true },
      {
        name: "content",
        x: 25,
        y: 12,
        width: 50,
        height: 76,
        isSlot: true,
        required: true,
      },
      { name: "right", x: 75, y: 12, width: 25, height: 76, isSlot: true },
      { name: "footer", x: 0, y: 88, width: 100, height: 12, isSlot: true },
    ],
  },

  // ========== Dashboard Presets ==========
  dashboard: {
    id: "dashboard",
    name: "대시보드",
    description: "Navigation + Sidebar + Main Content",
    category: "dashboard",
    // cols: 240px 1fr (line 1~3) / rows: auto 1fr (line 1~3)
    slots: [
      {
        name: "navigation",
        required: false,
        description: "상단 네비게이션",
        defaultStyle: gridSlot("navigation", [1, 3], [1, 2], BAND_SLOT),
      },
      {
        name: "sidebar",
        required: false,
        description: "좌측 메뉴",
        defaultStyle: gridSlot("sidebar", [1, 2], [2, 3]),
      },
      {
        name: "content",
        required: true,
        description: "대시보드 콘텐츠",
        defaultStyle: gridSlot("content", [2, 3], [2, 3]),
      },
    ],
    containerStyle: {
      display: "grid",
      gridTemplateAreas: `
        "navigation navigation"
        "sidebar content"
      `,
      gridTemplateColumns: "240px 1fr",
      gridTemplateRows: "auto 1fr",
      minHeight: "100vh",
    },
    previewAreas: [
      {
        name: "navigation",
        x: 0,
        y: 0,
        width: 100,
        height: 10,
        isSlot: true,
      },
      { name: "sidebar", x: 0, y: 10, width: 24, height: 90, isSlot: true },
      {
        name: "content",
        x: 24,
        y: 10,
        width: 76,
        height: 90,
        isSlot: true,
        required: true,
      },
    ],
  },

  "dashboard-widgets": {
    id: "dashboard-widgets",
    name: "대시보드 (위젯)",
    description: "Header + Sidebar + Main + Widgets Panel",
    category: "dashboard",
    // cols: 200px 1fr 280px (line 1~4) / rows: auto 1fr (line 1~3)
    slots: [
      {
        name: "header",
        required: false,
        defaultStyle: gridSlot("header", [1, 4], [1, 2], BAND_SLOT),
      },
      {
        name: "sidebar",
        required: false,
        defaultStyle: gridSlot("sidebar", [1, 2], [2, 3]),
      },
      {
        name: "content",
        required: true,
        defaultStyle: gridSlot("content", [2, 3], [2, 3]),
      },
      {
        name: "widgets",
        required: false,
        defaultStyle: gridSlot("widgets", [3, 4], [2, 3]),
      },
    ],
    containerStyle: {
      display: "grid",
      gridTemplateAreas: `
        "header header header"
        "sidebar content widgets"
      `,
      gridTemplateColumns: "200px 1fr 280px",
      gridTemplateRows: "auto 1fr",
      minHeight: "100vh",
    },
    previewAreas: [
      { name: "header", x: 0, y: 0, width: 100, height: 10, isSlot: true },
      { name: "sidebar", x: 0, y: 10, width: 20, height: 90, isSlot: true },
      {
        name: "content",
        x: 20,
        y: 10,
        width: 52,
        height: 90,
        isSlot: true,
        required: true,
      },
      { name: "widgets", x: 72, y: 10, width: 28, height: 90, isSlot: true },
    ],
  },
};

/**
 * 카테고리별 메타데이터
 */
export const PRESET_CATEGORIES: Record<string, PresetCategoryMeta> = {
  basic: { label: "기본", icon: "Layout" },
  sidebar: { label: "사이드바", icon: "Columns2" },
  complex: { label: "복합", icon: "LayoutGrid" },
  dashboard: { label: "대시보드", icon: "LayoutDashboard" },
};

/**
 * 프리셋 표시 순서
 */
export const PRESET_ORDER: string[] = [
  "fullscreen",
  "vertical-2",
  "vertical-3",
  "sidebar-left",
  "sidebar-right",
  "holy-grail",
  "complex-3col",
  "dashboard",
  "dashboard-widgets",
];
