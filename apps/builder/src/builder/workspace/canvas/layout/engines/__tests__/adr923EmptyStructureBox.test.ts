import { describe, expect, it } from "vitest";

import type { CanvasLayoutNode } from "../../layoutNode";
import { applyImplicitStyles } from "../implicitStyles";
import {
  calculateContentHeight,
  calculateContentWidth,
  enrichWithIntrinsicSize,
} from "../utils";

/**
 * ADR-923 Phase 3 r21 — 빈 구조 상자 sweep (r21m1) + Button min-content 하한 원천 (r21m2).
 *
 * r20 은 발견된 ListBox/GridList/Button 만 닫았다. DOM 은 자식 0 이면 자기 상자만 남고 (ToggleButtonGroup
 * 0×0 · Tabs items:[] → 빈 TabList 0, panel 없음), RAC `data-empty` 상태 규칙이 base 와 다른 padding 을
 * 둔다 (GridList `--spacing-lg` 16 · Tree `--spacing-xl` 24 — ListBox 는 정렬만), Table 은 수동 CSS
 * `min-height: 40px`, TagGroup 은 parent prop 이 빈 슬롯 자식을 렌더하지 않는다 (`{label && <Label>}`).
 * layout 은 각각 80×30 / 29(+24) / 0 / 4 / 0 / Label+gap 4 였다 — catalog base 규칙만 알고 상태 규칙과
 * 빈 구조를 몰랐다. Button 은 catalog `min-width` 하한을 catalog padding 으로 만들고 최종 폭엔 인라인
 * padding 을 더해 padding:20 → 84 (DOM 68), padding:0+minWidth:0 → 44 (DOM 2) 였다.
 *
 * 실 CSS 오라클: `tests/parity/catalogComponentBox.browser.test.ts` (r21 케이스 7).
 */
const node = (
  type: string,
  props: Record<string, unknown> = {},
  id = `${type}-r21`,
  parent_id?: string,
): CanvasLayoutNode =>
  ({ id, type, props, parent_id }) as unknown as CanvasLayoutNode;

const styleOf = (el: CanvasLayoutNode) =>
  (el.props?.style ?? {}) as Record<string, unknown>;

const enrichSize = (el: CanvasLayoutNode) => {
  const out = enrichWithIntrinsicSize(el, 400, 0, undefined, [], () => []);
  const style = styleOf(out);
  return {
    w: style.width as number | undefined,
    h: style.height as number | undefined,
  };
};

const implicit = (owner: CanvasLayoutNode, children: CanvasLayoutNode[]) => {
  const byId = new Map<string, CanvasLayoutNode>([
    [owner.id, owner],
    ...children.map((c) => [c.id, c] as const),
  ]);
  return applyImplicitStyles(owner, children, () => [], byId, 400);
};

// catalog Button md: minWidth 68 · paddingX 12 · paddingY 4 · borderWidth 1.
const MIN_W = 68;

describe("ADR-923 r21m2 — Button min-content 하한 = 실효 padding/border + 인라인 minWidth 우선", () => {
  it("catalog padding: 68 − 24 − 2 = 42 (r20 그대로)", () => {
    expect(calculateContentWidth(node("Button", { children: "" }))).toBe(42);
  });

  it("인라인 padding 20: 하한 68 − 40 − 2 = 26 → 최종 68 (종전 42 + 42 = 84)", () => {
    const el = node("Button", { children: "", style: { padding: 20 } });
    expect(calculateContentWidth(el)).toBe(26);
    expect(enrichSize(el)).toEqual({ w: MIN_W, h: 42 });
  });

  it("인라인 minWidth (0 포함) 는 엔진이 적용 — catalog 하한 겹치지 않음 (종전 42 → DOM 2 에 44)", () => {
    expect(
      calculateContentWidth(
        node("Button", { children: "", style: { padding: 0, minWidth: 0 } }),
      ),
    ).toBe(0);
    expect(
      calculateContentWidth(
        node("Button", { children: "", style: { minWidth: 120 } }),
      ),
    ).toBe(0);
    // 글자가 있으면 글자 폭이 하한을 대신한다 — 하한 제거가 글자 폭까지 지우지 않는다.
    expect(
      calculateContentWidth(
        node("Button", {
          children: "Save all changes now",
          style: { minWidth: 0 },
        }),
      ),
    ).toBeGreaterThan(42);
  });
});

describe("ADR-923 r21m1 — ToggleButtonGroup 자식 0 = 0×0 (종전 DEFAULT_WIDTH 80 × 버튼 높이 30)", () => {
  it("자식도 legacy items 도 없음 → 폭 0 · 높이 0", () => {
    const empty = node("ToggleButtonGroup", {});
    expect(calculateContentWidth(empty, [])).toBe(0);
    expect(calculateContentHeight(empty, 400, [])).toBe(0);
  });

  it("자식 ToggleButton 이 있으면 종전 그대로 (버튼 폭 합 · 버튼 높이)", () => {
    const group = node("ToggleButtonGroup", {});
    const child = node("ToggleButton", { children: "Bold" }, "tb-1", group.id);
    expect(calculateContentWidth(group, [child], () => [])).toBeGreaterThan(0);
    expect(calculateContentHeight(group, 400, [child])).toBe(30);
    expect(
      calculateContentHeight(
        node("ToggleButtonGroup", { items: ["A"] }),
        400,
        [],
      ),
    ).toBe(30);
  });
});

describe("ADR-923 r21m1 — Tabs items:[] = 빈 TabList 0, stale panel 은 DOM 에 없다", () => {
  const tabs = (items: unknown[]) => {
    const owner = node("Tabs", { items }, "tabs-1");
    const tabList = node("TabList", { items }, "tablist-1", owner.id);
    const panels = node("TabPanels", {}, "tabpanels-1", owner.id);
    const stalePanel = node(
      "TabPanel",
      { itemId: "gone", style: { height: 50 } },
      "tabpanel-gone",
      panels.id,
    );
    const livePanel = node(
      "TabPanel",
      { itemId: "a", style: { height: 50 } },
      "tabpanel-a",
      panels.id,
    );
    const kids: Record<string, CanvasLayoutNode[]> = {
      [owner.id]: [tabList, panels],
      [panels.id]: [stalePanel, livePanel],
    };
    const getChildren = (id: string) => kids[id] ?? [];
    return { owner, tabList, panels, stalePanel, livePanel, getChildren };
  };

  it("calculateContentHeight: items [] → 0 (종전 29 + stale panel 24+50)", () => {
    const t = tabs([]);
    expect(
      calculateContentHeight(
        t.owner,
        400,
        t.getChildren(t.owner.id),
        t.getChildren,
      ),
    ).toBe(0);
  });

  it("calculateContentHeight: items 있음 → tab bar + item 이 있는 panel 만 (stale 제외)", () => {
    const live = tabs([{ id: "a", title: "A" }]);
    const h = calculateContentHeight(
      live.owner,
      400,
      live.getChildren(live.owner.id),
      live.getChildren,
    );
    expect(h).toBe(29 + 12 * 2 + 50);
    // item "gone" 만 있으면 live panel 은 stale — panel 없이 tab bar 만.
    const onlyStale = tabs([{ id: "b", title: "B" }]);
    expect(
      calculateContentHeight(
        onlyStale.owner,
        400,
        onlyStale.getChildren(onlyStale.owner.id),
        onlyStale.getChildren,
      ),
    ).toBe(29);
  });

  it("applyImplicitStyles(tabs): items [] → TabList height 0, TabPanels 제외", () => {
    const t = tabs([]);
    const r = implicit(t.owner, t.getChildren(t.owner.id));
    expect(r.filteredChildren.map((c) => c.type)).toEqual(["TabList"]);
    expect(styleOf(r.filteredChildren[0]).height).toBe(0);
    const live = tabs([{ id: "a", title: "A" }]);
    const rl = implicit(live.owner, live.getChildren(live.owner.id));
    expect(rl.filteredChildren.map((c) => c.type)).toEqual([
      "TabList",
      "TabPanels",
    ]);
    expect(styleOf(rl.filteredChildren[0]).height).toBe(29);
  });

  it("applyImplicitStyles(tabpanels): owner items 에 없는 stale panel 제외, items [] → 없음", () => {
    const live = tabs([{ id: "a", title: "A" }]);
    const byId = new Map<string, CanvasLayoutNode>([
      [live.owner.id, live.owner],
      [live.panels.id, live.panels],
    ]);
    const r = applyImplicitStyles(
      live.panels,
      live.getChildren(live.panels.id),
      live.getChildren,
      byId,
      400,
    );
    expect(r.filteredChildren.map((c) => c.id)).toEqual(["tabpanel-a"]);
    const empty = tabs([]);
    const byIdE = new Map<string, CanvasLayoutNode>([
      [empty.owner.id, empty.owner],
      [empty.panels.id, empty.panels],
    ]);
    const re = applyImplicitStyles(
      empty.panels,
      empty.getChildren(empty.panels.id),
      empty.getChildren,
      byIdE,
      400,
    );
    expect(re.filteredChildren).toEqual([]);
  });
});

describe("ADR-923 r21m1 — TagGroup 슬롯 자식은 parent prop 이 정한다 (`{label && <Label>}`)", () => {
  const group = (label: string | undefined, withLabelChild: boolean) => {
    const owner = node(
      "TagGroup",
      {
        ...(label !== undefined ? { label } : {}),
        items: [{ id: 1, label: "A" }],
      },
      "tg-1",
    );
    const labelChild = node(
      "Label",
      { children: label ?? "" },
      "tg-label",
      owner.id,
    );
    const tagList = node(
      "TagList",
      { items: [{ id: 1, label: "A" }] },
      "tg-list",
      owner.id,
    );
    const children = withLabelChild ? [labelChild, tagList] : [tagList];
    return { owner, children };
  };

  it("label '' / 부재: Label 자식이 있어도 TagList 만 있을 때와 같은 높이 (gap 없음)", () => {
    const base = group(undefined, false);
    const h0 = calculateContentHeight(base.owner, 400, base.children, () => []);
    for (const g of [group("", true), group(undefined, true)]) {
      expect(calculateContentHeight(g.owner, 400, g.children, () => [])).toBe(
        h0,
      );
      const r = implicit(g.owner, g.children);
      expect(r.filteredChildren.map((c) => c.type)).toEqual(["TagList"]);
    }
  });

  it("label 있음: Label 높이 + gap 만큼 더 높다, Taffy 자식에도 남는다", () => {
    const base = group(undefined, false);
    const h0 = calculateContentHeight(base.owner, 400, base.children, () => []);
    const g = group("Tags", true);
    expect(
      calculateContentHeight(g.owner, 400, g.children, () => []),
    ).toBeGreaterThan(h0);
    expect(
      implicit(g.owner, g.children).filteredChildren.map((c) => c.type),
    ).toEqual(["Label", "TagList"]);
  });
});

describe("ADR-923 r21m1 — RAC `data-empty` 상태 padding (GridList 16 · Tree 24)", () => {
  it("GridList: items 없음 · 주입 없음 · 자식 없음 → padding 16 (r20 의 0 은 base 규칙만 본 것)", () => {
    for (const props of [
      {},
      { items: [] },
      { dataBinding: { type: "collection" } },
    ]) {
      const r = implicit(node("GridList", props), []);
      expect(styleOf(r.effectiveParent).paddingTop, JSON.stringify(props)).toBe(
        16,
      );
      expect(styleOf(r.effectiveParent).paddingLeft).toBe(16);
    }
  });

  it("GridList: 행 원천이 하나라도 있으면 base 그대로", () => {
    for (const [props, children] of [
      [{ items: [{ id: 1, label: "A" }] }, []],
      [{ _projectedRowsContentHeight: 120 }, []],
      [{}, [node("GridListItem", { label: "A" }, "gli-1")]],
    ] as const) {
      const r = implicit(node("GridList", props as Record<string, unknown>), [
        ...children,
      ]);
      expect(
        styleOf(r.effectiveParent).paddingTop,
        JSON.stringify(props),
      ).toBeUndefined();
    }
  });

  it("Tree: TreeItem 없음 → padding 24 (catalog base 4), 있으면 4, dataBinding 소유자는 판정 안 함", () => {
    const empty = implicit(node("Tree", {}), []);
    expect(styleOf(empty.effectiveParent).paddingTop).toBe(24);
    expect(styleOf(empty.effectiveParent).padding).toBeUndefined();
    const withItem = implicit(node("Tree", {}), [
      node("TreeItem", { children: "Node" }, "ti-1"),
    ]);
    expect(styleOf(withItem.effectiveParent).paddingTop).toBeUndefined();
    expect(styleOf(withItem.effectiveParent).padding).toBe(4);
    const bound = implicit(
      node("Tree", { dataBinding: { type: "collection" } }),
      [],
    );
    expect(styleOf(bound.effectiveParent).paddingTop).toBeUndefined();
  });

  it("사용자 인라인 padding 은 상태 규칙보다 우선 (DOM inline > class)", () => {
    const r = implicit(node("Tree", { style: { padding: 8 } }), []);
    expect(styleOf(r.effectiveParent).padding).toBe(8);
    expect(styleOf(r.effectiveParent).paddingTop).toBeUndefined();
  });
});
