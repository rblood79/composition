import type { TokenRef } from "@composition/rendering";
import type { ComponentRule } from "../../types/catalog-style.types";

/**
 * ADR-321 Phase 4 — Rating 의 rule (D3). 값의 출처는 spectrum-design-data 의 `rating` (MCP dataset
 * 4.7.0 — breakdown §5.6 토큰 표). S2 1.8.2 · RAC 에 Rating 이 없어 별 다섯은 노드가 아니라 Rating 이
 * 자기 상자 안에 그린다 (StepList 표식의 방식) — 자리 · 채움 · 색은 이 파일의 함수 하나씩이고 두
 * consumer 가 같이 읽는다: DOM 은 `span.rating-star` 의 SVG (`delegatedDom.runtime.ts`), Canvas 는 path
 * 도형 (`ruleShapes.ts` `catalogRatingStarShapes`).
 *
 * - 별 개수 = 5 고정 (사용자 결정 6, 2026-11-27 — Spectrum 「always 5 available stars」).
 * - 별 = Spectrum 의 Star 아이콘 (S2 `icons/Star` 윤곽 · `icons/StarFilled` 채움 — 아래 경로).
 *   반쪽 = 윤곽 위에 채운 별의 왼쪽 반 (표시 전용만 — 값은 `runtime/rating.ts` 의 유효값).
 * - 상자 = 별 줄 (별 5 + 간격 4 × 4) × (별 + 세로 padding × 2). design-data 의 전체 폭 토큰
 *   (`rating-width-*` 104 · 128) 은 anatomyReview 가 「legacy width records」 라 적은 값이고 별 줄과
 *   맞지 않아 쓰지 않는다 (breakdown §5.6 「어긋나는 값」 — Phase 4 에서 별 줄로 정함).
 */
export const RATING_TYPE = "Rating";

/** 사용자 결정 6 — 별 개수. */
export const RATING_STAR_COUNT = 5;

export const RATING_SIZES = ["S", "M"] as const;
export type RatingSize = (typeof RATING_SIZES)[number];

/** 별 아이콘 (`workflow-icon-small` · `-medium`) · 세로 padding (`base-padding-vertical-*`). */
const STAR_SIZE: Readonly<Record<RatingSize, number>> = { S: 16, M: 18 };
const PADDING_Y: Readonly<Record<RatingSize, number>> = { S: 4, M: 7 };
/** 별 간격 — `spacing` (icon to icon) 4 px = `{spacing.xs}`. */
export const RATING_STAR_GAP = 4;

export const catalogRatingSize = (value: unknown): RatingSize =>
  value === "S" ? "S" : "M";

/** 상자 (작성값이 없을 때) — 별 줄 폭 · 별 + 세로 padding 높이. */
export function catalogRatingBox(size: RatingSize) {
  const star = STAR_SIZE[size];
  return {
    star,
    width: star * RATING_STAR_COUNT + RATING_STAR_GAP * (RATING_STAR_COUNT - 1),
    height: star + PADDING_Y[size] * 2,
  };
}

/**
 * ADR-321 Phase 5 — the RAC SliderTrack's box (Phase 0 P2): slot = star + gap, the track is slot × 5
 * wide and starts half a slot + half a gap left of the star row, so star i's center sits at the
 * track's i ÷ 5 and a press anywhere on star i rounds to i (RAC `useSlider` track press). The stars
 * stay where the Canvas draws them (the track's left padding undoes its offset).
 */
export function catalogRatingTrack(size: RatingSize) {
  const slot = STAR_SIZE[size] + RATING_STAR_GAP;
  const left = slot / 2 + RATING_STAR_GAP / 2;
  return { width: slot * RATING_STAR_COUNT, left };
}

export type RatingStarFill = "full" | "half" | "empty";

/** 별마다의 채움 — `value` 는 유효값 (입력 = 정수, 표시 = 0.5 단위). */
export function catalogRatingStarFills(value: number): RatingStarFill[] {
  return Array.from({ length: RATING_STAR_COUNT }, (_, index) =>
    value >= index + 1 ? "full" : value >= index + 0.5 ? "half" : "empty",
  );
}

/** 별 색 — neutral content (강조 = accent content, 비활성 = disabled content). */
export function catalogRatingStarColor(input: {
  emphasized: boolean;
  disabled: boolean;
}): TokenRef {
  if (input.disabled) return "{color.disabled-content}";
  return input.emphasized
    ? "{color.accent-content}"
    : "{color.neutral-content}";
}

const STAR_VIEWBOX = 20;
// S2 1.8.2 `icons/Star` · `icons/StarFilled` (Apache-2.0, https://github.com/adobe/react-spectrum) —
// viewBox 20. Kept here, not in the icon set: only a Rating draws them (the Preview's first load
// carries the icon set, not the catalog rules).
const S2_STAR =
  "M5.506 18.63c-.36 0-.719-.112-1.027-.337-.594-.431-.854-1.168-.66-1.876l.977-3.577c.079-.29-.02-.596-.254-.783l-2.893-2.32c-.573-.459-.796-1.207-.57-1.906.228-.698.848-1.172 1.582-1.206l3.703-.176c.3-.014.56-.204.665-.483l1.313-3.469c.26-.687.902-1.131 1.637-1.131s1.376.444 1.636 1.13v.001l1.31 3.468c.107.28.369.47.667.484l3.704.176c.733.034 1.354.508 1.582 1.207.226.698.003 1.447-.57 1.906l-2.894 2.32c-.232.186-.333.493-.254.782l.977 3.574c.193.71-.067 1.448-.662 1.879-.598.434-1.38.447-1.994.041l-3.07-2.036c-.252-.166-.576-.166-.827-.002l-3.117 2.045c-.295.193-.628.29-.961.29M9.979 2.866c-.08 0-.184.028-.235.162L8.433 6.496c-.317.839-1.101 1.409-1.998 1.451l-3.704.176c-.142.006-.2.097-.225.172s-.03.183.08.273l2.893 2.319c.702.56 1.001 1.483.764 2.349l-.977 3.576c-.038.137.03.222.094.268.063.045.162.086.285.007l3.117-2.045c.753-.493 1.725-.492 2.476.005l3.072 2.037c.12.08.221.04.285-.006.064-.047.133-.13.094-.268l-.976-3.575c-.236-.866.063-1.787.764-2.348l2.893-2.32c.111-.088.106-.197.081-.272s-.083-.166-.225-.172l-3.705-.176c-.895-.042-1.68-.612-1.998-1.45l-1.31-3.47c-.05-.133-.155-.161-.234-.161";
const S2_STAR_FILLED =
  "M11.495 2.414 12.7 5.597c.211.56.735.94 1.332.968l3.4.161c1.492.07 2.103 1.951.937 2.886l-2.656 2.128c-.467.375-.667.99-.508 1.568l.896 3.26c.396 1.444-1.207 2.608-2.457 1.785l-2.819-1.858c-.5-.33-1.147-.33-1.648-.002l-2.867 1.88c-1.249.82-2.848-.342-2.454-1.783l.898-3.284c.158-.577-.042-1.192-.509-1.566L1.59 9.612c-1.167-.935-.556-2.815.937-2.886l3.4-.161c.597-.028 1.12-.409 1.332-.968L8.46 2.414c.529-1.398 2.506-1.398 3.034 0";
/** The S2 star paths (윤곽 · 채움) in their 20 viewBox — the DOM draws them as they are. */
export function catalogRatingStarPaths(): { outline: string; filled: string } {
  return { outline: S2_STAR, filled: S2_STAR_FILLED };
}

const scaledPaths = new Map<number, { outline: string; filled: string }>();
/**
 * The same paths at `star` px (Canvas path 도형은 노드 px 좌표다). Every number of an S2 icon path is a
 * coordinate or a length (no arc flags), so scaling each number scales the shape.
 */
export function catalogRatingScaledStarPaths(star: number) {
  let paths = scaledPaths.get(star);
  if (!paths) {
    const k = star / STAR_VIEWBOX;
    const scale = (d: string) =>
      d.replace(/-?(?:\d+\.?\d*|\.\d+)/g, (n) =>
        String(Math.round(Number(n) * k * 1000) / 1000),
      );
    const raw = catalogRatingStarPaths();
    paths = { outline: scale(raw.outline), filled: scale(raw.filled) };
    scaledPaths.set(star, paths);
  }
  return paths;
}

const sizeBlock = (size: RatingSize, borderRadius: number | string) => {
  const box = catalogRatingBox(size);
  return { width: box.width, height: box.height, borderRadius };
};

const ratingBox = {
  display: "flex",
  alignItems: "center",
  gap: `${RATING_STAR_GAP}px`,
  flexShrink: "0",
};

export const RATING_RULE: ComponentRule = {
  defaultVariant: "default",
  defaultSize: "M",
  variants: { default: { paint: {} } },
  // radius = `corner-radius-medium-size-*` (S 7 — 저장소 단에 없음 · M 8 = `{radius.md}`) — focus ring 의 모서리.
  sizes: { S: sizeBlock("S", 7), M: sizeBlock("M", "{radius.md}") },
  containerStyles: ratingBox,
  structure: {
    archetype: "container",
    element: "div",
    containerStyles: ratingBox,
    composition: {
      delegation: [],
      rootSelectors: {
        "& .rating-star": {
          styles: {
            position: "relative",
            display: "block",
            "flex-shrink": "0",
          },
        },
        "& .rating-star > svg": {
          styles: { position: "absolute", inset: "0", display: "block" },
        },
        // (A star draws its outline · its filled star by its fill — the Canvas's paths: a full star
        //  is the filled one, a half star the outline under the filled one's left half.)
        '& .rating-star[data-fill="full"] > .rating-star-outline': {
          styles: { display: "none" },
        },
        '& .rating-star[data-fill="empty"] > .rating-star-filled': {
          styles: { display: "none" },
        },
        '& .rating-star[data-fill="half"] > .rating-star-filled': {
          styles: { "clip-path": "inset(0 50% 0 0)" },
        },
        // Phase 5 — the input (RAC Slider): the track is a box only the stars press (a press left of
        //  the row does not clear — design-data has no such clear), the thumb is the focus target.
        "& > .rating-track": {
          styles: {
            position: "relative",
            display: "flex",
            gap: "inherit",
            "box-sizing": "border-box",
            "flex-shrink": "0",
            "pointer-events": "none",
          },
        },
        // (Not disabled — a disabled Slider takes no press; the readOnly Meter has no track.)
        "&:not([data-disabled]) .rating-track > *": {
          styles: { "pointer-events": "auto", cursor: "pointer" },
        },
        "& .rating-thumb": {
          styles: { position: "absolute", width: "0", height: "100%" },
        },
        "&:has(.rating-thumb[data-focus-visible])": {
          styles: {
            outline: "var(--focus-ring-width) solid var(--focus-ring)",
            "outline-offset": "var(--focus-ring-offset)",
          },
        },
        // (Hover preview — the stars up to the hovered one fill; the value does not change. The
        //  rules after win over the fill rules above by one more selector.)
        "&:not([data-disabled]) .rating-track:has(:hover) .rating-star-filled":
          {
            styles: { display: "block", "clip-path": "none" },
          },
        "&:not([data-disabled]) .rating-track:has(:hover) .rating-star-outline":
          {
            styles: { display: "none" },
          },
        "&:not([data-disabled]) .rating-star:hover ~ * > .rating-star-filled": {
          styles: { display: "none" },
        },
        "&:not([data-disabled]) .rating-star:hover ~ * > .rating-star-outline":
          {
            styles: { display: "block" },
          },
      },
    },
  },
};
