import { describe, expect, it } from "vitest";
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { resolveSlotComposition } from "@composition/shared";

import {
  TAB_ITEM_DEFAULT_ORIGIN_ID,
  TAB_ITEM_SELECTED_ORIGIN_ID,
  TABS_ORIGIN_ID,
  ensureTabsTemplateOrigins,
} from "../tabsTemplateOrigins";
import { getReusableOriginEnsurers } from "../../reusableCompositeOrigins";
import {
  TEMPLATE_ORIGIN_REUSABLE_TYPES,
  buildCatalogOrigin,
  getCatalogOriginTypes,
} from "../../catalogOrigins";

function makeDocument(): CompositionDocument {
  return {
    version: "composition-1.0",
    children: [
      {
        id: "page-home",
        type: "frame",
        name: "Home",
        metadata: { type: "legacy-page", pageId: "page-home", slug: "/" },
        children: [{ id: "body-home", type: "body" as CanonicalNode["type"] }],
      },
    ],
  };
}

function findById(
  nodes: readonly CanonicalNode[],
  id: string,
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findById(node.children ?? [], id);
    if (child) return child;
  }
  return undefined;
}

function mapNodes(
  nodes: readonly CanonicalNode[],
  fn: (node: CanonicalNode) => CanonicalNode,
): CanonicalNode[] {
  return nodes.map((node) => {
    const next = fn(node);
    return next.children
      ? { ...next, children: mapNodes(next.children, fn) }
      : next;
  });
}

describe("ADR-233 Phase 1 — Tabs 의 Tab 항목 template origins", () => {
  it("Tab item default/selected origin 을 label slot 자식 (Text {label}) 으로 시드한다", () => {
    const doc = ensureTabsTemplateOrigins(makeDocument());
    const def = findById(doc.children, TAB_ITEM_DEFAULT_ORIGIN_ID)!;
    const sel = findById(doc.children, TAB_ITEM_SELECTED_ORIGIN_ID)!;
    expect(def).toMatchObject({
      type: "Tab",
      name: "Tab/Default",
      reusable: true,
      metadata: { type: "tab-template-origin", variant: "default" },
    });
    expect(sel).toMatchObject({
      type: "Tab",
      name: "Tab/Selected",
      reusable: true,
      props: { _isSelected: true },
      metadata: { variant: "selected" },
    });
    // 두 leg 가 읽는 slot 구성 = label 하나.
    expect(resolveSlotComposition(def.children)?.order).toEqual(["label"]);
    expect(def.children?.[0]).toMatchObject({
      type: "Text",
      props: { slot: "label", children: "{label}" },
      metadata: { slotRole: "label" },
    });
  });

  it("Tabs origin 은 generic seed 와 같은 트리이고 root 가 slot: [default, selected] 를 갖는다", () => {
    const doc = ensureTabsTemplateOrigins(makeDocument());
    const tabs = findById(doc.children, TABS_ORIGIN_ID)!;
    expect(tabs.slot).toEqual([
      TAB_ITEM_DEFAULT_ORIGIN_ID,
      TAB_ITEM_SELECTED_ORIGIN_ID,
    ]);
    // Tabs factory 는 item id 를 매번 새로 발급한다 (generic seed 도 같다) — id 를 지운 구조로 비교.
    const stripIds = (value: unknown): string =>
      JSON.stringify(value).replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
        "<uuid>",
      );
    const { slot: _slot, ...rest } = tabs;
    expect(stripIds(rest)).toBe(stripIds(buildCatalogOrigin("Tabs")));
  });

  it("등록 — Tabs 는 template origin 보유자로 generic 에서 빠지고 ensurer 는 손 seed 모듈이다", () => {
    expect(TEMPLATE_ORIGIN_REUSABLE_TYPES.has("Tabs")).toBe(true);
    expect(getCatalogOriginTypes()).not.toContain("Tabs");
    expect(getReusableOriginEnsurers()[TABS_ORIGIN_ID]).toBe(
      ensureTabsTemplateOrigins,
    );
  });

  it("재hydration 멱등 + 기존 origin 편집 보존 + 사용자 slot 보존 + 결손 slot 만 보충", () => {
    const once = ensureTabsTemplateOrigins(makeDocument());
    expect(JSON.stringify(ensureTabsTemplateOrigins(once))).toBe(
      JSON.stringify(once),
    );

    // 사용자 편집: item origin root style · 사용자 slot (순서 뒤집기)
    const edited: CompositionDocument = {
      ...once,
      children: mapNodes(once.children, (node) => {
        if (node.id === TAB_ITEM_DEFAULT_ORIGIN_ID) {
          return { ...node, props: { ...node.props, style: { paddingLeft: 30 } } };
        }
        if (node.id === TABS_ORIGIN_ID) {
          return {
            ...node,
            slot: [TAB_ITEM_SELECTED_ORIGIN_ID, TAB_ITEM_DEFAULT_ORIGIN_ID],
          };
        }
        return node;
      }),
    };
    const repaired = ensureTabsTemplateOrigins(edited);
    expect(JSON.stringify(repaired)).toBe(JSON.stringify(edited));
    expect(
      findById(repaired.children, TAB_ITEM_DEFAULT_ORIGIN_ID)?.props?.style,
    ).toEqual({ paddingLeft: 30 });

    // slot 결손 (ADR-233 이전 문서의 component-tabs) → 보충 (허용 보충 필드 1)
    const withoutSlot: CompositionDocument = {
      ...once,
      children: mapNodes(once.children, (node) => {
        if (node.id !== TABS_ORIGIN_ID) return node;
        const { slot: _slot, ...rest } = node;
        return rest as CanonicalNode;
      }),
    };
    const refilled = ensureTabsTemplateOrigins(withoutSlot);
    expect(findById(refilled.children, TABS_ORIGIN_ID)?.slot).toEqual([
      TAB_ITEM_DEFAULT_ORIGIN_ID,
      TAB_ITEM_SELECTED_ORIGIN_ID,
    ]);
  });
});
