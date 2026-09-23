import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveComponentRule } from "@composition/shared";
import type { CanvasLayoutNode } from "../../layoutNode";
import { applyImplicitStyles } from "../implicitStyles";
import { calculateContentHeight } from "../utils";

/**
 * 사용자 지시 (2026-09-24): TagList 의 catalog 기본 = `height: 100%` · `minHeight` = TagGroup Appearance size 의
 * chip 높이 — Tag 가 하나도 없어도 목록 틀이 기본 높이를 가진다 (Slot "+" 로 채울 자리가 보인다).
 * 값 정본 = catalog `TagList.sizes[size].minHeight` (= `Tag.sizes[size].height`, chip border-box).
 * Canvas = implicitStyles taglist 분기 + TagGroup 높이 합산, DOM = `.tag-list-wrapper` (TagList 는 display: contents).
 */

const node = (
  type: string,
  props: Record<string, unknown> = {},
  id = `${type}-t`,
  parent_id?: string,
): CanvasLayoutNode =>
  ({ id, type, props, parent_id }) as unknown as CanvasLayoutNode;

const styleOf = (el: CanvasLayoutNode) =>
  (el.props?.style ?? {}) as Record<string, unknown>;

const SIZES = ["sm", "md", "lg"] as const;
const chipHeight = (size: string) =>
  resolveComponentRule("Tag")!.sizes[size]!.height as number;

const tagListStyle = (
  groupProps: Record<string, unknown>,
  listProps: Record<string, unknown> = {},
) => {
  const group = node("TagGroup", groupProps, "tg");
  const list = node("TagList", listProps, "tl", "tg");
  const byId = new Map<string, CanvasLayoutNode>([
    [group.id, group],
    [list.id, list],
  ]);
  return styleOf(
    applyImplicitStyles(list, [], () => [], byId, 400).effectiveParent,
  );
};

describe("TagList 기본 크기 — height 100% · minHeight = TagGroup size chip 높이", () => {
  it("catalog: TagList sizes minHeight = Tag chip 높이 (sm 22 · md 30 · lg 42) · containerStyles height 100%", () => {
    const rule = resolveComponentRule("TagList")!;
    for (const size of SIZES) {
      expect(rule.sizes[size]!.minHeight, size).toBe(chipHeight(size));
    }
    expect(
      (rule as { containerStyles?: Record<string, unknown> }).containerStyles
        ?.height,
    ).toBe("100%");
  });

  it("Canvas: Tag 없는 TagList 는 TagGroup size 의 minHeight · height 100% (작성자 값 우선)", () => {
    for (const size of SIZES) {
      const style = tagListStyle({ size });
      expect(style.minHeight, size).toBe(chipHeight(size));
      expect(style.height, size).toBe("100%");
    }
    expect(tagListStyle({}).minHeight).toBe(chipHeight("md"));
    const authored = tagListStyle(
      { size: "lg" },
      { style: { minHeight: 10, height: 50 } },
    );
    expect(authored.minHeight).toBe(10);
    expect(authored.height).toBe(50);
  });

  it("Canvas: Tag 없는 TagGroup 높이 = TagList minHeight (Label 없음)", () => {
    for (const size of SIZES) {
      const group = node("TagGroup", { size }, "tg");
      const list = node("TagList", { size }, "tl", "tg");
      expect(
        calculateContentHeight(group, 400, [list], () => []),
        size,
      ).toBe(chipHeight(size));
    }
  });

  it("DOM: .tag-list-wrapper height 100% · size 별 min-height = catalog 값", () => {
    const css = readFileSync(
      resolve(
        __dirname,
        "../../../../../../../../../packages/shared/src/components/styles/TagGroup.css",
      ),
      "utf8",
    );
    expect(css).toMatch(/\.tag-list-wrapper \{[^}]*height: 100%;/);
    for (const size of SIZES) {
      const re = new RegExp(
        `\\.react-aria-TagGroup\\[data-tag-size="${size}"\\] \\.tag-list-wrapper \\{[^}]*min-height: ${chipHeight(size)}px;`,
      );
      expect(css, size).toMatch(re);
    }
  });
});
