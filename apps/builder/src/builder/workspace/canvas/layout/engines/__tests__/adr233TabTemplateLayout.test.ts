import { describe, expect, it } from "vitest";
import { resolveItemTemplateRowBoxStyle } from "@composition/shared";

import type { CanvasLayoutNode } from "../../layoutNode";
import { applyImplicitStyles } from "../implicitStyles";
import { resolveLeafBoxEdges } from "../utils";

/**
 * ADR-233 Phase 3 (live L3 가 잡은 측정 층) — Tab 항목 template 이 Tab 행 높이를 바꿀 때 TabList 가 따라
 * 자라야 한다. 종전 TabList 는 탭 바 높이 (Tabs rule md 29) 로 고정돼 행 40 이 위로 5.5 삐져나왔고, 고정을
 * 풀자 Tab 테두리 기본값 (rule 에 borderWidth 없음 → thin 1px) 이 높이 추정에 끼어 42 가 됐다 (DOM 생성
 * CSS 는 `border: none`, engine 행은 40).
 */
const node = (
  type: string,
  props: Record<string, unknown> = {},
  id = `${type}-233`,
  parent_id?: string,
): CanvasLayoutNode =>
  ({ id, type, props, parent_id }) as unknown as CanvasLayoutNode;

const styleOf = (el: CanvasLayoutNode) =>
  (el.props?.style ?? {}) as Record<string, unknown>;

function implicit(owner: CanvasLayoutNode, children: CanvasLayoutNode[]) {
  const byId = new Map<string, CanvasLayoutNode>([
    [owner.id, owner],
    ...children.map((c) => [c.id, c] as const),
  ]);
  return applyImplicitStyles(owner, children, () => [], byId, 400);
}

const ITEMS = [{ id: "a", title: "A" }];
const TEMPLATE = { paddingTop: 10, paddingBottom: 10 };

describe("ADR-233 — Tab 항목 template 과 TabList 높이", () => {
  it("Tabs 분기: template 표식이 있으면 TabList 는 고정 높이 대신 하한 29 · 없으면 종전 고정 29", () => {
    const owner = node("Tabs", { items: ITEMS }, "tabs-1");
    const plainList = node("TabList", { items: ITEMS }, "tablist-1", owner.id);
    const plain = implicit(owner, [plainList]).filteredChildren[0];
    expect(styleOf(plain).height).toBe(29);
    expect(styleOf(plain).minHeight).toBe(29);

    const templated = node(
      "TabList",
      { items: ITEMS, _tabTemplateStyle: TEMPLATE },
      "tablist-1",
      owner.id,
    );
    const out = implicit(owner, [templated]).filteredChildren[0];
    expect(styleOf(out).height).toBeUndefined();
    expect(styleOf(out).minHeight).toBe(29);
  });

  it("TabList 분기: 같은 규칙 (template 이면 minHeight · 아니면 height)", () => {
    const owner = node("Tabs", { items: ITEMS }, "tabs-2");
    const plain = node("TabList", { items: ITEMS }, "tablist-2", owner.id);
    const byId = new Map<string, CanvasLayoutNode>([
      [owner.id, owner],
      [plain.id, plain],
    ]);
    const plainParent = applyImplicitStyles(plain, [], () => [], byId, 400)
      .effectiveParent;
    expect(styleOf(plainParent).height).toBe(29);

    const templated = node(
      "TabList",
      { items: ITEMS, _tabTemplateStyle: TEMPLATE },
      "tablist-2",
      owner.id,
    );
    byId.set(templated.id, templated);
    const parent = applyImplicitStyles(templated, [], () => [], byId, 400)
      .effectiveParent;
    expect(styleOf(parent).height).toBeUndefined();
    expect(styleOf(parent).minHeight).toBe(29);
  });

  it("Tab leaf 테두리 = 0 (DOM 생성 CSS `border: none`) — 종전 thin 1px 기본값", () => {
    const tab = node("Tab", { title: "A", size: "md" });
    expect(resolveLeafBoxEdges(tab, 400).border).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
  });

  it("행 상자 규칙 (shared, 두 leg 공용) — auto + rule 높이 하한 (sm 21 · md 29 · lg 41)", () => {
    expect(resolveItemTemplateRowBoxStyle("Tab", "sm")).toEqual({
      height: "auto",
      minHeight: 21,
    });
    expect(resolveItemTemplateRowBoxStyle("Tab", undefined)).toEqual({
      height: "auto",
      minHeight: 29,
    });
    expect(resolveItemTemplateRowBoxStyle("Tab", "lg")).toEqual({
      height: "auto",
      minHeight: 41,
    });
  });
});
