/**
 * ADR-148 후속 (2026-07-17) — ListBoxItem/GridListItem metric 분기의 childful gating.
 *
 * Components 페이지의 reusable origin 은 slot 자식이 실 scene 노드로 선다
 * (canvasSceneNode unfold — 더블클릭 drill/편집 대상). 이때 item 의 intrinsic height 는
 * escape metric 공식(flat props 기준 1~2줄)이 아니라 **일반 컨테이너 자식 합산**을
 * 따라야 자식이 카드 밖으로 넘치지 않는다. metric 분기는 자식이 없을 때만
 * (projection 행/legacy flat 경로 — 기존 동작 보존).
 */

import { describe, expect, it } from "vitest";
import { calculateContentHeight } from "../utils";
import type { Element } from "../../../../../../types/core/store.types";

function makeItem(
  type: "ListBoxItem" | "GridListItem" | "div",
  props: Record<string, unknown> = {},
): Element {
  return {
    id: `${type}-1`,
    type,
    props,
    childrenIds: [],
  } as unknown as Element;
}

function makeTextChild(id: string, children: string): Element {
  return {
    id,
    type: "Text",
    props: { children, style: { fontSize: 14 } },
    childrenIds: [],
  } as unknown as Element;
}

describe("calculateContentHeight — slot host childful gating (ADR-148 후속)", () => {
  const slotChildren = [
    makeTextChild("c-label", "{label}"),
    makeTextChild("c-desc", "{description}"),
  ];

  it("ListBoxItem childless → metric 공식 유지 (1줄 = paddingY*2 + lineHeight = 28)", () => {
    const h = calculateContentHeight(
      makeItem("ListBoxItem", {
        children: "Aardvark",
      }),
    );
    expect(h).toBe(28);
  });

  it("GridListItem childless → metric 공식 유지 (1줄 = line box 20)", () => {
    const h = calculateContentHeight(
      makeItem("GridListItem", {
        children: "Card",
      }),
    );
    expect(h).toBe(20);
  });

  it("ListBoxItem childful → metric 분기 skip, 일반 컨테이너 자식 합산과 동일", () => {
    const item = calculateContentHeight(
      makeItem("ListBoxItem", { children: "{label}" }),
      400,
      slotChildren,
    );
    const generic = calculateContentHeight(
      makeItem("div", { children: "{label}" }),
      400,
      slotChildren,
    );
    expect(item).toBe(generic);
    expect(item).not.toBe(28);
  });

  it("GridListItem childful → metric 분기 skip, 일반 컨테이너 자식 합산과 동일", () => {
    const item = calculateContentHeight(
      makeItem("GridListItem", { children: "{label}" }),
      400,
      slotChildren,
    );
    const generic = calculateContentHeight(
      makeItem("div", { children: "{label}" }),
      400,
      slotChildren,
    );
    expect(item).toBe(generic);
    expect(item).not.toBe(20);
  });
});
