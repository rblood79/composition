/**
 * S2 press 효과 — `@react-spectrum/s2` 1.8.1 `pressScale.ts:46` 의 식을 catalog 값으로 옮긴 것.
 *
 * S2 는 누르는 동안 `transform: <기존> perspective(max(높이, 너비 / 3, 24)px) translate3d(0, 0, -2px)` 를 inline 으로
 * 넣는다 — 요소를 화면 안쪽으로 2px 밀어 원근으로 줄인다. 배율 = P / (P + 2) 라 크기에 비례하지 않고 높이가 늘 약 2px
 * 줄어든다 (옛 `scale(0.95)` 는 큰 카드일수록 많이 줄었다). 그리고 누르지 않을 때도 `will-change: transform` 을 둔다.
 *
 * 식 전체 (`max` · `/ 3` · `24px` · `-2px`) 는 여기 (D3 catalog) 에 있다. 정적 CSS 는 요소 자신의 크기를 읽을 수 없어
 * Preview · Publish runtime (`runtime/pressScale.runtime.ts`) 이 누르는 순간의 크기만 두 변수에 쓴다. 변수는
 * `inherits: false` 로 등록해 (`CATALOG_PRESS_PROPERTY_CSS`) 자손 부품이 host 크기를 물려받지 않는다 — 크기를 재지
 * 않은 부품 (Checkbox 상자 · Radio 고리 · Switch 손잡이, 모두 24px 이하) 은 0 이라 S2 와 같은 `perspective(24px)`.
 */

/** 누른 요소의 너비 · 높이 (px) — runtime 이 누르는 동안만 inline 으로 쓴다. */
export const CATALOG_PRESS_WIDTH_VAR = "--catalog-press-width";
export const CATALOG_PRESS_HEIGHT_VAR = "--catalog-press-height";

/** S2 `pressScale.ts:46` 의 상수 — `pressScaleS2Alignment.static.test.ts` 가 설치본과 대조한다. */
export const S2_PRESS_DEPTH_PX = 2;
export const S2_PRESS_MIN_PERSPECTIVE_PX = 24;
export const S2_PRESS_WIDTH_DIVISOR = 3;

/**
 * 누른 상태의 `transform` 값. `base` = 그 요소가 원래 갖는 transform (S2 의 `${style.transform}` 앞붙임 —
 * Slider thumb 의 `translate(-50%, -50%)` · Toast 닫기 버튼의 `translateY(-50%)`).
 */
export function catalogPressTransform(base = ""): string {
  const perspective =
    `max(var(${CATALOG_PRESS_HEIGHT_VAR}, 0px), ` +
    `calc(var(${CATALOG_PRESS_WIDTH_VAR}, 0px) / ${S2_PRESS_WIDTH_DIVISOR}), ` +
    `${S2_PRESS_MIN_PERSPECTIVE_PX}px)`;
  return `${base ? `${base} ` : ""}perspective(${perspective}) translate3d(0, 0, -${S2_PRESS_DEPTH_PX}px)`;
}

/**
 * press 가 없던 대상에 새로 다는 전환 — S2 style macro `transition` 의 150ms · `default` 곡선
 * (`style/spectrum-theme.ts` `timingFunction.default`). 이미 transform 전환이 있던 Button · ToggleButton 은 그대로.
 */
export const CATALOG_PRESS_TRANSITION =
  "transform 150ms cubic-bezier(0.45, 0, 0.4, 1)";

/** 누르지 않을 때도 두는 값 (S2 `pressScale` 의 else 가지). */
export const CATALOG_PRESS_WILL_CHANGE = "transform";

/**
 * 크기 변수 등록 — `inherits: false` · 초기값 0px. 이 등록이 없으면 Checkbox 상자가 label 까지 포함한 host 의 너비를
 * 물려받아 perspective 가 커진다. `CatalogStates.css` (Builder · Preview · Publish 공통, layer 밖) 가 싣는다.
 */
export const CATALOG_PRESS_PROPERTY_CSS = [
  CATALOG_PRESS_WIDTH_VAR,
  CATALOG_PRESS_HEIGHT_VAR,
]
  .map(
    (name) =>
      `@property ${name} { syntax: "<length>"; inherits: false; initial-value: 0px; }`,
  )
  .join("\n");

/** RAC 가 누르는 동안 붙이는 상태 속성 — Slider thumb 는 S2 처럼 `isDragging` 을 press 로 쓴다. */
export const CATALOG_PRESS_STATE_ATTRIBUTES = [
  "data-pressed",
  "data-dragging",
] as const;

/**
 * 누른 상태가 붙는 요소 (host) 와 줄어드는 요소가 다른 곳 — S2 는 줄어드는 요소를 잰다. `relation` = host 기준 위치
 * (`descendant` = host 안 · `ancestor` = host 를 감싸는 요소). 24px 이하 부품 (Checkbox 상자 등) 은 재지 않아도
 * 초기값 0 → `perspective(24px)` 라 여기 없다.
 */
export interface CatalogPressPart {
  readonly host: string;
  readonly part: string;
  readonly relation: "descendant" | "ancestor";
}
export const CATALOG_PRESS_PARTS: readonly CatalogPressPart[] = [
  // S2 SegmentedControl 의 안쪽 div (`SegmentedControl.tsx:269`) — ToggleButtonGroup 멤버의 `> span`.
  {
    host: ".react-aria-ToggleButtonGroup .react-aria-ToggleButton",
    part: ":scope > span",
    relation: "descendant",
  },
  // S2 quiet Card — 「Only the preview in quiet cards scales」 (`Card.tsx:510-514`, `:614`).
  {
    host: '.react-aria-Card[data-variant="quiet"]',
    part: ".react-aria-CardPreview",
    relation: "descendant",
  },
  // S2 SideNavItem — a pressed link scales its row (`SideNav.tsx:365` `isLinkPressed`).
  {
    host: ".react-aria-SideNavItemLink",
    part: ".react-aria-SideNavItem",
    relation: "ancestor",
  },
];
