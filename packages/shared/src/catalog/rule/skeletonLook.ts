import {
  tokenToCSSVar,
  withCatalogTokenVars,
  type TokenRef,
} from "@composition/rendering";

/**
 * ADR-314 Phase 3 — S2 `Skeleton` 의 로딩 모양 (설치본 1.8.2 `Skeleton.tsx` `loadingStyle` · `SkeletonText` ·
 * `useSkeletonIcon` · `useLoadingAnimation`, `StatusLight.tsx:126`). D3 값은 여기 한 곳이고 두 consumer 가 읽는다:
 * Canvas (`canvasBinding.ts` `withSkeletonLook` — 정지 프레임) 와 생성 CSS (`catalogSkeletonStylesheet` →
 * `generated/CatalogSkeleton.css`, Preview · Publish 의 `styles/index.css`).
 *
 * gradient 는 `background-size: 300%` 라 상자에 보이는 것은 그림의 1/3 이다. 움직임의 시작 (`background-position`
 * 100% — 그림의 66.7% ~ 100%) 과 움직임이 없을 때 (0% — 0 ~ 33.3%) 상자는 둘 다 `gray-100` 한 색이다 (정지점
 * 33% · 66% 밖). 그래서 Canvas 의 정지 프레임은 `fill` 한 색의 상자이고 (HC5 — 다시 그리지 않음), 밝은 띠는
 * Preview · Publish 의 움직임에만 지나간다.
 */

/** 참여 컴포넌트가 내는 모양 — S2 의 세 갈래. */
export type CatalogSkeletonLookKind =
  /** `SkeletonText` — 글자를 감싼 inline 상자의 줄 상자마다 (`box-decoration-break: clone` · radius `sm`). */
  | "text"
  /** `SkeletonWrapper` — 요소 자신에 gradient · 자손 `visibility: hidden` (모서리는 요소 자신의 것). */
  | "box"
  /** `SkeletonWrapper` + `useSkeletonIcon` — box 와 같고 모서리가 radius `sm`. */
  | "icon"
  /** StatusLight — 점만 `gray-200`, 글자는 S2 `<Text>` 라 text 모양. */
  | "statusLight";

/**
 * 참여 type → 모양. 범위는 `runtime/skeletonContext.ts` `CATALOG_SKELETON_PARTICIPANTS` (Card 는 모양 없음 —
 * 메뉴 비활성 · `inert` 만) + S2 Meter 의 값 `<Text>` (`Meter.tsx:156` — 우리 `MeterValue`).
 */
export const CATALOG_SKELETON_LOOK_OF: Readonly<
  Record<string, CatalogSkeletonLookKind>
> = {
  Text: "text", // S2 `Content.tsx` `Text` — `useSkeletonText`
  Link: "text", // `Link.tsx:133` — `useSkeletonText`
  MeterValue: "text", // `Meter.tsx:156` — `<Text>{valueText}</Text>`
  Icon: "icon", // `Icon.tsx:128 · 139` — `SkeletonWrapper` + `useSkeletonIcon`
  Badge: "box", // `Badge.tsx:241`
  MeterTrack: "box", // `Meter.tsx:158` — track (fill 은 숨겨진 자손)
  Image: "box", // `Image.tsx:372` — wrapper 에 `loadingStyle`
  Avatar: "box", // S2 Avatar 는 Image (`borderRadius: full`)
  StatusLight: "statusLight", // `StatusLight.tsx:126 · 177`
};

/** S2 값 — `d3S2Alignment` 와 같은 출처 (설치본 줄). */
export const CATALOG_SKELETON_LOOK = {
  /** `color('gray-100')` — gradient 양끝 (정지 프레임의 한 색). */
  fill: "{color.skeleton}" as TokenRef,
  /** `light-dark(gray-25, gray-300)` — 가운데 밝은 띠. */
  highlight: "{color.skeleton-highlight}" as TokenRef,
  /** gradient 정지점 (%) — `gray-100 33%` · (가운데) · `gray-100 66%`. */
  stops: [33, 66] as const,
  backgroundSize: "300%",
  /** `SkeletonText` · `useSkeletonIcon` 의 `borderRadius: 'sm'`. */
  radius: "{radius.sm}" as TokenRef,
  /** StatusLight 점 `isSkeleton: 'gray-200'`. */
  statusLight: "{color.skeleton-status-light}" as TokenRef,
  /** `useLoadingAnimation` — `backgroundPosition` 100% → 0%, 무한, 모든 요소 `startTime = 0`. */
  animation: {
    durationMs: 2000,
    easing: "ease-in-out",
    from: "100%",
    to: "0%",
  },
} as const;

/** DOM 표시 — 모양을 그리는 요소 (`text` 는 글자를 감싼 안쪽 span). StatusLight 는 root 에 점 표시 (`> svg`). */
export const CATALOG_SKELETON_LOOK_ATTR = "data-skeleton-look";
export const CATALOG_SKELETON_DOT_ATTR = "data-skeleton-dot";

/**
 * 생성 sheet — S2 는 `loadingStyle` 을 style macro 보다 뒤 layer (`'L'`) 에 둬 컴포넌트 칠을 덮는다. 여기서는
 * layer 밖에 두어 생성 · 수동 sheet 의 `@layer components` 를 덮는다 (요소 inline 칠은 `background-color`
 * 라 위에 얹는 `background-image` 와 겹치지 않는다). StatusLight 점의 `fill` 은 요소 inline 이라 `!important`.
 */
export function catalogSkeletonStylesheet(): string {
  const look = CATALOG_SKELETON_LOOK;
  const fill = tokenToCSSVar(look.fill);
  const gradient = `linear-gradient(to right, ${fill} ${look.stops[0]}%, ${tokenToCSSVar(look.highlight)}, ${fill} ${look.stops[1]}%)`;
  // (ADR-295 Decision 9 — a user component's radius is the `--catalog-token-*` variable.)
  const radius = withCatalogTokenVars(tokenToCSSVar(look.radius));
  const attr = CATALOG_SKELETON_LOOK_ATTR;
  return [
    "/* Generated from catalog/rule/skeletonLook.ts (ADR-314). Do not edit. */",
    `[${attr}] { background-image: ${gradient}; background-size: ${look.backgroundSize}; }`,
    `[${attr}] * { visibility: hidden; }`,
    `[${attr}="text"] { color: transparent; -webkit-box-decoration-break: clone; box-decoration-break: clone; border-radius: ${radius}; }`,
    `[${attr}="icon"] { border-radius: ${radius}; }`,
    // (`useSkeletonText` — the host's own `-webkit-text-fill-color` hides an ellipsis too.)
    `:has(> [${attr}="text"]) { -webkit-text-fill-color: transparent; }`,
    `[${CATALOG_SKELETON_DOT_ATTR}] > svg { fill: ${tokenToCSSVar(look.statusLight)} !important; }`,
    "",
  ].join("\n");
}
