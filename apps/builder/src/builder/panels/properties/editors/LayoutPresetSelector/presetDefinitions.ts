/**
 * Layout Preset Definitions
 *
 * **슬롯은 자기 배치를 스스로 선언한다 (2026-07-26)**: `containerStyle` 만으로는 슬롯이
 * 놓일 자리가 정해지지 않는다. 빈 Slot 은 콘텐츠 크기가 0 이라, 주축 크기를 주지 않으면
 * 레이아웃 엔진이 0 을 산출해 캔버스에 아무것도 그려지지 않는다 (실측: fullscreen 적용 후
 * content 슬롯이 `width 0` → 프레임이 빈 채로 보임). grid 프리셋은 `gridTemplateAreas` 를
 * 컨테이너에만 두고 슬롯에 배치를 안 줘서 auto-placement 로 겹쳤다. 그래서 모든 슬롯이
 * `defaultStyle` 로 주축 크기(flex) 또는 배치(grid line)를 명시한다.
 *
 * **좁은 폭에서는 줄이지 않고 형태를 바꾼다 (ADR-168)**: 사이드바를 250px 그대로 두면
 * 390px 뷰포트에서 콘텐츠가 140px 이 되고, 고정폭 합이 뷰포트를 넘는 프리셋은 아예 성립하지
 * 않는다. 레퍼런스 네 출처(M3 canonical layout / Apple HIG split view / Wroblewski column
 * drop / Framer·Webflow 템플릿)가 같은 결론으로 수렴한다 — **mobile 에서는 세로로 스택한다.**
 *
 * 그 전환은 컨테이너 `display: grid → flex` 한 줄로 끝난다. 슬롯이 grid 배치와 flex 크기를
 * **병기**하기 때문이다: grid 모드에서 `flex`/`minHeight` 는 배치에 영향을 주지 않고, flex
 * 모드에서 grid line 은 무시된다. 덕분에 슬롯 트리가 평면으로 유지되고 이름 없는 wrapper
 * 노드가 생기지 않는다.
 *
 * `repeat()` / `minmax()` 는 쓰지 않는다 — 2026-07-25 실측에서 `minmax(60px, auto)` 가
 * 슬롯 폭 1920 / header 570 같은 비정상값을 냈다. 트랙은 명시 나열한다.
 */

import type { CSSProperties } from "react";

import type {
  LayoutPreset,
  PresetCategory,
  PresetCategoryMeta,
  ResponsiveStyleSet,
} from "./types";

/**
 * 빈 Slot 의 오소링 최소 크기(px).
 *
 * 주축이 auto 인 자리(flex column 의 header/footer 밴드, grid 의 `auto` row)에서 빈 슬롯은
 * 0 이 된다. catalog `COMPONENT_RULES_TABLE.Slot.sizes.md.height` 와 같은 값으로 하한을 둬,
 * 자식이 들어오면 그만큼 자라되 빈 상태에서도 보이고 drop 대상으로 잡히게 한다.
 */
const EMPTY_SLOT_MIN_HEIGHT = 60;

/** 목록 pane 은 행이 여러 개 보여야 목록으로 읽힌다 — 밴드보다 큰 하한. */
const LIST_SLOT_MIN_HEIGHT = 120;

/** 남는 주축 공간을 채우는 슬롯 (content 계열). */
const FLEXIBLE_SLOT: CSSProperties = {
  flex: "1",
  minHeight: EMPTY_SLOT_MIN_HEIGHT,
};

/** 콘텐츠 높이만큼만 차지하는 밴드 슬롯 (header/footer 계열). */
const BAND_SLOT: CSSProperties = { minHeight: EMPTY_SLOT_MIN_HEIGHT };

/**
 * mobile 세로 스택 전환 — 컨테이너 한 줄.
 *
 * grid 컨테이너를 flex column 으로 바꾸면 슬롯의 grid line 이 전부 무시되고 정의 순서대로
 * 쌓인다. 슬롯마다 override 를 쓸 필요가 없다.
 */
const STACK_ON_MOBILE: ResponsiveStyleSet = {
  mobile: { display: "flex", flexDirection: "column" },
};

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

/**
 * grid line 만 바꾸는 breakpoint override.
 *
 * `gridArea` 이름은 싣지 않는다 — shorthand 와 longhand 가 같은 breakpoint 에서 함께 나가면
 * 둘 다 `!important` 동일 특정도라 emit 순서가 승자를 정한다 (ADR-168 리뷰 M3). 이름은 base
 * 에 남아 있고 override 는 숫자 line 만 옮긴다.
 */
function gridSlotLines(
  column: readonly [number, number],
  row: readonly [number, number],
): CSSProperties {
  return {
    gridColumnStart: String(column[0]),
    gridColumnEnd: String(column[1]),
    gridRowStart: String(row[0]),
    gridRowEnd: String(row[1]),
  };
}

export const LAYOUT_PRESETS: Record<string, LayoutPreset> = {
  // ========== Basic ==========
  // 폭에 무관하다 — fullscreen 은 슬롯이 1개라 방향과 상관없고, vertical-* 는 이미 세로다.
  fullscreen: {
    id: "fullscreen",
    name: "Fullscreen",
    description: "Single full-screen content",
    category: "basic",
    slots: [
      {
        name: "content",
        required: true,
        description: "Full-screen content",
        defaultStyle: FLEXIBLE_SLOT,
      },
    ],
    containerStyle: {
      display: "flex",
      minHeight: "100vh",
    },
  },

  "vertical-2": {
    id: "vertical-2",
    name: "2-Row",
    description: "Header + Content",
    category: "basic",
    slots: [
      {
        name: "header",
        required: false,
        description: "Top header band",
        defaultStyle: BAND_SLOT,
      },
      {
        name: "content",
        required: true,
        description: "Main content area",
        defaultStyle: FLEXIBLE_SLOT,
      },
    ],
    containerStyle: {
      display: "flex",
      flexDirection: "column",
      minHeight: "100vh",
    },
  },

  "vertical-3": {
    id: "vertical-3",
    name: "3-Row",
    description: "Header + Content + Footer",
    category: "basic",
    slots: [
      {
        name: "header",
        required: false,
        description: "Top header band",
        defaultStyle: BAND_SLOT,
      },
      {
        name: "content",
        required: true,
        description: "Main content area",
        defaultStyle: FLEXIBLE_SLOT,
      },
      {
        name: "footer",
        required: false,
        description: "Bottom footer band",
        defaultStyle: BAND_SLOT,
      },
    ],
    containerStyle: {
      display: "flex",
      flexDirection: "column",
      minHeight: "100vh",
    },
  },

  // ========== Navigation ==========
  // Apple HIG: split view 는 regular 폭 전용이고 compact 에서 성립하지 않는다.
  // tablet 은 사이드바를 좁히고, mobile 은 세로 스택 + 전폭으로 형태를 바꾼다.
  "sidebar-left": {
    id: "sidebar-left",
    name: "Left Sidebar",
    description: "Sidebar + Content",
    category: "navigation",
    slots: [
      {
        name: "sidebar",
        required: false,
        description: "Left sidebar",
        defaultStyle: {
          width: "250px",
          flexShrink: 0,
          minHeight: EMPTY_SLOT_MIN_HEIGHT,
        },
        responsiveStyle: {
          tablet: { width: "200px" },
          mobile: { width: "100%" },
        },
      },
      {
        name: "content",
        required: true,
        description: "Main content",
        defaultStyle: FLEXIBLE_SLOT,
      },
    ],
    containerStyle: {
      display: "flex",
      flexDirection: "row",
      minHeight: "100vh",
    },
    responsiveContainerStyle: { mobile: { flexDirection: "column" } },
  },

  "sidebar-right": {
    id: "sidebar-right",
    name: "Right Sidebar",
    description: "Content + Sidebar",
    category: "navigation",
    slots: [
      {
        name: "content",
        required: true,
        description: "Main content",
        defaultStyle: FLEXIBLE_SLOT,
      },
      {
        name: "sidebar",
        required: false,
        description: "Right sidebar",
        defaultStyle: {
          width: "250px",
          flexShrink: 0,
          minHeight: EMPTY_SLOT_MIN_HEIGHT,
        },
        responsiveStyle: {
          tablet: { width: "200px" },
          mobile: { width: "100%" },
        },
      },
    ],
    containerStyle: {
      display: "flex",
      flexDirection: "row",
      minHeight: "100vh",
    },
    responsiveContainerStyle: { mobile: { flexDirection: "column" } },
  },

  // ========== List-Detail ==========
  // M3 canonical layout. 목록은 고정폭, 상세는 유동. 좁아지면 두 pane 을 세로로 쌓는다.
  // (M3 는 compact 에서 pane 을 전환하지만 그건 런타임 상태라 정적 빌더의 등가물은 스택이다.)
  "list-detail": {
    id: "list-detail",
    name: "List-Detail",
    description: "List + Detail (M3 canonical)",
    category: "list",
    slots: [
      {
        name: "list",
        required: true,
        description: "List pane (fixed width)",
        defaultStyle: {
          width: "320px",
          flexShrink: 0,
          minHeight: LIST_SLOT_MIN_HEIGHT,
        },
        responsiveStyle: {
          tablet: { width: "260px" },
          mobile: { width: "100%" },
        },
      },
      {
        name: "detail",
        required: true,
        description: "Detail pane (flexible)",
        defaultStyle: FLEXIBLE_SLOT,
      },
    ],
    containerStyle: {
      display: "flex",
      flexDirection: "row",
      minHeight: "100vh",
    },
    responsiveContainerStyle: { mobile: { flexDirection: "column" } },
  },

  // ========== Feed ==========
  // M3 canonical layout. 카드 격자가 폭에 따라 열 수를 줄인다 (4 → 2 → 1).
  // 열 수를 바꾸는 건 **슬롯 자신의** 트랙이다 — feed 슬롯이 곧 grid 컨테이너다.
  feed: {
    id: "feed",
    name: "Feed",
    description: "Header + Card Grid (M3 canonical)",
    category: "feed",
    slots: [
      {
        name: "header",
        required: false,
        description: "Top header band",
        defaultStyle: BAND_SLOT,
      },
      {
        name: "feed",
        required: true,
        description: "Card grid",
        defaultStyle: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr",
          rowGap: 16,
          columnGap: 16,
          flex: "1",
          minHeight: EMPTY_SLOT_MIN_HEIGHT,
        },
        responsiveStyle: {
          tablet: { gridTemplateColumns: "1fr 1fr" },
          mobile: { gridTemplateColumns: "1fr" },
        },
      },
    ],
    containerStyle: {
      display: "flex",
      flexDirection: "column",
      minHeight: "100vh",
    },
  },

  // ========== Complex ==========
  // `complex-3col` 은 삭제됐다 — Holy Grail 과 컬럼 폭만 다른 동일 구조라 흡수한다.
  "holy-grail": {
    id: "holy-grail",
    name: "Holy Grail",
    description: "Header + (Sidebar + Content + Aside) + Footer",
    category: "complex",
    // cols: 200px 1fr 200px (line 1~4) / rows: auto 1fr auto (line 1~4)
    // 고정폭 합 400 은 mobile 390 을 넘는다 → mobile 은 세로 스택으로 전환한다.
    slots: [
      {
        name: "header",
        required: false,
        defaultStyle: gridSlot("header", [1, 4], [1, 2], BAND_SLOT),
      },
      {
        name: "sidebar",
        required: false,
        defaultStyle: gridSlot("sidebar", [1, 2], [2, 3], BAND_SLOT),
      },
      {
        name: "content",
        required: true,
        defaultStyle: gridSlot("content", [2, 3], [2, 3], FLEXIBLE_SLOT),
      },
      {
        name: "aside",
        required: false,
        defaultStyle: gridSlot("aside", [3, 4], [2, 3], BAND_SLOT),
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
    responsiveContainerStyle: {
      tablet: { gridTemplateColumns: "160px 1fr 160px" },
      ...STACK_ON_MOBILE,
    },
  },

  // ========== Dashboard ==========
  dashboard: {
    id: "dashboard",
    name: "Dashboard",
    description: "Navigation + Sidebar + Main Content",
    category: "dashboard",
    // cols: 240px 1fr (line 1~3) / rows: auto 1fr (line 1~3)
    slots: [
      {
        name: "navigation",
        required: false,
        description: "Top navigation",
        defaultStyle: gridSlot("navigation", [1, 3], [1, 2], BAND_SLOT),
      },
      {
        name: "sidebar",
        required: false,
        description: "Left menu",
        defaultStyle: gridSlot("sidebar", [1, 2], [2, 3], BAND_SLOT),
      },
      {
        name: "content",
        required: true,
        description: "Dashboard content",
        defaultStyle: gridSlot("content", [2, 3], [2, 3], FLEXIBLE_SLOT),
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
    responsiveContainerStyle: {
      tablet: { gridTemplateColumns: "200px 1fr" },
      ...STACK_ON_MOBILE,
    },
  },

  "dashboard-widgets": {
    id: "dashboard-widgets",
    name: "Widget Panel",
    description: "Header + Sidebar + Main + Widgets Panel",
    category: "dashboard",
    // cols: 200px 1fr 280px (line 1~4) / rows: auto 1fr (line 1~3)
    // 고정폭 합 480 이라 tablet(768) 에서도 콘텐츠가 288 로 눌린다 → tablet 에서 위젯을
    // 하단 전폭 행으로 내린다. 슬롯 line 을 옮기는 유일한 프리셋이며, 같은 breakpoint 에서
    // 컨테이너 트랙도 함께 바꾼다 (ADR-168 R8 — item placement 단독 변경은 엔진 full
    // rebuild 를 발동시키지 못해 조용히 무반영된다).
    slots: [
      {
        name: "header",
        required: false,
        defaultStyle: gridSlot("header", [1, 4], [1, 2], BAND_SLOT),
        responsiveStyle: { tablet: gridSlotLines([1, 3], [1, 2]) },
      },
      {
        name: "sidebar",
        required: false,
        defaultStyle: gridSlot("sidebar", [1, 2], [2, 3], BAND_SLOT),
      },
      {
        name: "content",
        required: true,
        defaultStyle: gridSlot("content", [2, 3], [2, 3], FLEXIBLE_SLOT),
      },
      {
        name: "widgets",
        required: false,
        defaultStyle: gridSlot("widgets", [3, 4], [2, 3], BAND_SLOT),
        responsiveStyle: { tablet: gridSlotLines([1, 3], [3, 4]) },
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
    responsiveContainerStyle: {
      tablet: {
        gridTemplateAreas: `
        "header header"
        "sidebar content"
        "widgets widgets"
      `,
        gridTemplateColumns: "200px 1fr",
        gridTemplateRows: "auto 1fr auto",
      },
      ...STACK_ON_MOBILE,
    },
  },
};

/**
 * 카테고리별 메타데이터.
 *
 * `Record<PresetCategory, …>` 라 union 에 값을 추가하면 여기 선언 누락이 컴파일 에러가 된다.
 * 패널의 그룹 목록과 아이콘도 이 맵에서 파생하므로(ADR-168 P-4/P-5), 카테고리 추가 시 손댈
 * 곳은 union 과 이 맵 한 쌍뿐이다.
 */
export const PRESET_CATEGORIES: Record<PresetCategory, PresetCategoryMeta> = {
  basic: { label: "Basic", icon: "Layout" },
  navigation: { label: "Navigation", icon: "Columns2" },
  list: { label: "List", icon: "List" },
  feed: { label: "Feed", icon: "Rows3" },
  complex: { label: "Complex", icon: "LayoutGrid" },
  dashboard: { label: "Dashboard", icon: "LayoutDashboard" },
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
  "list-detail",
  "feed",
  "holy-grail",
  "dashboard",
  "dashboard-widgets",
];
