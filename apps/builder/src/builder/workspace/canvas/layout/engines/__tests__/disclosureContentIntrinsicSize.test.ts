import { describe, expect, test } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import { TEXT_LEAF_TAGS, enrichWithIntrinsicSize } from "../utils";

/**
 * DisclosureContent (block leaf) width:auto stretch 회귀 게이트.
 *
 * 버그: DisclosureContent(style 없는 block leaf, props.children 텍스트만)가 body padding
 *   55px+ 일 때 layout height 20px(1줄) → 40px(2줄)로 잘못 점프. DOM(RAC DisclosurePanel)은
 *   padding 무관하게 항상 1줄.
 *
 * 근본: block leaf 의 CSS `width:auto` stretch(부모 content-box 폭 채움)가 Taffy 에
 *   에뮬레이션 안 됨 → enrichWithIntrinsicSize 가 block 자식 TEXT_LEAF 에 width 미주입 →
 *   Taffy content-hug(텍스트 자연폭 ~120) 할당 → 좁은 폭에서 줄바꿈.
 *
 * 수정 (Approach A): enrichWithIntrinsicSize 에 parentDisplay 전달 + block-stretch 분기 —
 *   parentDisplay==="block" + TEXT_LEAF + !isFlexChild + (width 없음|auto) 시
 *   width = availableWidth(부모 content-box) 주입 → Taffy stretch → 줄바꿈 없음.
 */
const makeContent = (props: Record<string, unknown> = {}): CanvasLayoutNode =>
  ({
    id: "dc-1",
    type: "DisclosureContent",
    parent_id: "disc-1",
    props: {
      children: "Section content goes here.",
      ...props,
    },
  }) as CanvasLayoutNode;

const styleOf = (el: CanvasLayoutNode): Record<string, unknown> =>
  (el.props?.style ?? {}) as Record<string, unknown>;

describe("DisclosureContent intrinsic size (block leaf width:auto stretch)", () => {
  test("TEXT_LEAF_TAGS 에 disclosurecontent 등록 — 텍스트 leaf 경로 진입", () => {
    expect(TEXT_LEAF_TAGS.has("disclosurecontent")).toBe(true);
  });

  test("block 부모 — width 가 부모 content-box(availableWidth) 로 stretch 주입", () => {
    const enriched = enrichWithIntrinsicSize(
      makeContent(),
      255, // availableWidth = body content area
      600,
      undefined,
      undefined,
      undefined,
      false, // isFlexChild
      "block", // parentDisplay
    );
    expect(styleOf(enriched).width).toBe(255);
  });

  test("block 부모 — height 1줄(lineHeight 20, not 40)", () => {
    const enriched = enrichWithIntrinsicSize(
      makeContent(),
      255,
      600,
      undefined,
      undefined,
      undefined,
      false,
      "block",
    );
    // 1줄 = lineHeight 20 (md text-sm--line-height). 2줄(40) 이면 버그.
    expect(styleOf(enriched).height).toBe(20);
  });

  test("좁은 폭(padding↑ 시뮬레이션)에서도 width stretch → 1줄 유지", () => {
    // 텍스트 자연폭(~168) 보다 큰 200 → stretch 시 1줄.
    const enriched = enrichWithIntrinsicSize(
      makeContent(),
      200,
      600,
      undefined,
      undefined,
      undefined,
      false,
      "block",
    );
    expect(styleOf(enriched).width).toBe(200);
    expect(styleOf(enriched).height).toBe(20);
  });

  test("negative: flex 부모(isFlexChild) — block-stretch 미발동, width!=availableWidth", () => {
    const enriched = enrichWithIntrinsicSize(
      makeContent(),
      255,
      600,
      undefined,
      undefined,
      undefined,
      true, // isFlexChild — flex 자식은 hug
      "flex",
    );
    // flex 자식은 content-hug width(텍스트 자연폭 근처) — 부모폭 255 가 아님.
    expect(styleOf(enriched).width).not.toBe(255);
  });

  test("negative: parentDisplay 미전달(undefined) — block-stretch 미발동", () => {
    const enriched = enrichWithIntrinsicSize(
      makeContent(),
      255,
      600,
      undefined,
      undefined,
      undefined,
      false,
      // parentDisplay 생략 → undefined → block-stretch 분기 미발동
    );
    expect(styleOf(enriched).width).not.toBe(255);
  });

  test("width:100% — block-stretch 발동 (CSS 100% = 부모 content-box 폭)", () => {
    const enriched = enrichWithIntrinsicSize(
      makeContent({ style: { width: "100%" } }),
      255,
      600,
      undefined,
      undefined,
      undefined,
      false,
      "block",
    );
    // 100% 는 부모폭 stretch → availableWidth(255) 주입 + 1줄.
    expect(styleOf(enriched).width).toBe(255);
    expect(styleOf(enriched).height).toBe(20);
  });

  test("negative: 명시적 width:fit-content — intrinsic keyword 경로 유지(stretch override 안 함)", () => {
    const enriched = enrichWithIntrinsicSize(
      makeContent({ style: { width: "fit-content" } }),
      255,
      600,
      undefined,
      undefined,
      undefined,
      false,
      "block",
    );
    // fit-content 는 hasExplicitIntrinsicWidthKeyword 경로 → hug, 255 stretch 아님.
    expect(styleOf(enriched).width).not.toBe(255);
  });
});
