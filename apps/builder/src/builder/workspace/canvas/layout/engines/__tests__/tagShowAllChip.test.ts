import { describe, expect, it } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import {
  calculateContentWidth,
  isTagAllowsRemoving,
  parseBoxModel,
} from "../utils";

/**
 * 사용자 보고 (2026-09-24): allows removing 을 켜면 maxRows 「Show all」 chip 에도 X 가 붙었다. DOM 의 Show all 은
 * TagList 밖 `<button class="tag-show-all-btn">` 이라 remove 버튼도 `[data-allows-removing]` 여백도 없다. Canvas
 * 의 Show all chip (`_isShowAll`) 은 TagGroup 전파로 `allowsRemoving` 을 받아도 X 자리 · 줄인 오른쪽 padding 을
 * 갖지 않는다.
 */
const showAll = (allowsRemoving: boolean): CanvasLayoutNode =>
  ({
    id: "sa",
    type: "Tag",
    props: {
      children: "Show all (4)",
      style: { width: "fit-content" },
      _isShowAll: true,
      ...(allowsRemoving ? { allowsRemoving: true } : {}),
    },
  }) as unknown as CanvasLayoutNode;

describe("Show all chip — allowsRemoving 이어도 X 자리 없음", () => {
  it("isTagAllowsRemoving 은 Show all 에 false · 일반 Tag 는 true", () => {
    expect(isTagAllowsRemoving(showAll(true))).toBe(false);
    expect(
      isTagAllowsRemoving({
        id: "t",
        type: "Tag",
        props: { children: "One", allowsRemoving: true },
      } as unknown as CanvasLayoutNode),
    ).toBe(true);
  });

  it("폭 · padding 이 allowsRemoving false 와 같다", () => {
    expect(calculateContentWidth(showAll(true))).toBe(
      calculateContentWidth(showAll(false)),
    );
    expect(parseBoxModel(showAll(true), 400, 400).padding).toEqual(
      parseBoxModel(showAll(false), 400, 400).padding,
    );
  });
});
