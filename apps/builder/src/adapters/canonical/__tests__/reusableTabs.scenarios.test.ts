/**
 * ADR-138 A-1 — reusable Tabs (primary, dynamic items) 검증 시나리오.
 *
 * 검증 대상: canonical reusable schema (`reusable` origin + `type:"ref"` instance)
 * 가 복합 컴포넌트 Tabs 에서 작동하는가 — 특히 ADR-066 `props.items` 직렬화 배열
 * 과 `TabPanel.props.itemId` 페어링.
 *
 * 구현 방식 (Phase 0/1 freeze): 8 시나리오 전부 canonical-level 로 구현한다.
 *   - 1~5·8: `resolveCanonicalRefProps` 직접 호출.
 *   - 6 (undo/redo): origin items 의 prev/next canonical 스냅샷 사이 재-resolve
 *     검증. undo/redo 의 history navigation 메커니즘 자체는 별도 테스트
 *     (`stores/history/historyActions.diff.test.ts`) 가 담당.
 *   - 7 (persist): IndexedDB 가 plain object 에 적용하는 structured clone 으로
 *     reusable/ref/descendants 보존을 검증 (`structuredClone` = persist→hydrate).
 *
 * @see docs/adr/design/138-component-palette-reusable-breakdown.md §4
 */

import { describe, it, expect } from "vitest";
import type { CanonicalNode, RefNode } from "@composition/shared";
import {
  hasItemsOverride,
  resolveCanonicalRefProps,
} from "../instanceResolver";

type TabItem = { id: string; title: string };

// ─────────────────────────────────────────────
// fixture helpers
// ─────────────────────────────────────────────

function tabItem(id: string, title: string = id): TabItem {
  return { id, title };
}

function tabPanel(itemId: string): CanonicalNode {
  return { id: `tp-${itemId}`, type: "TabPanel", props: { itemId } };
}

/** reusable Tabs origin — `props.items` + 페어링 TabPanel 자식. */
function tabsOrigin(
  id: string,
  items: TabItem[],
  panelItemIds: string[] = items.map((it) => it.id),
): CanonicalNode {
  return {
    id,
    type: "Tabs",
    reusable: true,
    props: { items },
    children: [
      { id: `${id}-tablist`, type: "TabList", props: {} },
      {
        id: `${id}-tabpanels`,
        type: "TabPanels",
        props: {},
        children: panelItemIds.map(tabPanel),
      },
    ],
  };
}

function tabsRef(
  id: string,
  ref: string,
  props: Record<string, unknown> = {},
): RefNode {
  return { id, type: "ref", ref, props };
}

/** instance(ref) 의 resolved `items` id 목록 — root props merge 결과. */
function resolvedItemIds(master: CanonicalNode, ref: RefNode): string[] {
  const props = resolveCanonicalRefProps(master, ref);
  const items = (props.items as TabItem[] | undefined) ?? [];
  return items.map((it) => it.id);
}

/** Tabs 노드의 TabPanel.itemId 목록 (페어링 검증용). */
function tabPanelItemIds(tabs: CanonicalNode): string[] {
  const panels = tabs.children?.find((c) => c.type === "TabPanels");
  return (panels?.children ?? [])
    .filter((c) => c.type === "TabPanel")
    .map((c) => c.props?.itemId)
    .filter((v): v is string => typeof v === "string");
}

// ─────────────────────────────────────────────
// 시나리오 1~8
// ─────────────────────────────────────────────

describe("ADR-138 A-1 reusable Tabs — dynamic items 시나리오", () => {
  it("시나리오 1 — origin tab 추가 시 미-override instance 2개 모두 items 4 + TabPanel 4쌍 페어링", () => {
    const ids4 = ["t1", "t2", "t3", "t4"];
    // add-tab action: items entry + 페어링 TabPanel 동시 추가 (default panelItemIds)
    const masterAfter = tabsOrigin(
      "tabs-o",
      ids4.map((id) => tabItem(id)),
    );
    const refA = tabsRef("inst-a", "tabs-o");
    const refB = tabsRef("inst-b", "tabs-o");

    expect(resolvedItemIds(masterAfter, refA)).toEqual(ids4);
    expect(resolvedItemIds(masterAfter, refB)).toEqual(ids4);
    // items[].id ↔ TabPanel.itemId 4쌍 페어링 (instance 는 master TabPanels 소비)
    expect(tabPanelItemIds(masterAfter)).toEqual(ids4);
    expect(resolvedItemIds(masterAfter, refA)).toEqual(
      tabPanelItemIds(masterAfter),
    );
  });

  it("시나리오 2 — instance A 만 items label override → A 만 forked, B·origin 무영향", () => {
    const master = tabsOrigin("tabs-o", [
      tabItem("t1"),
      tabItem("t2"),
      tabItem("t3"),
    ]);
    const refA = tabsRef("inst-a", "tabs-o", {
      items: [tabItem("t1"), tabItem("t2", "Renamed"), tabItem("t3")],
    });
    const refB = tabsRef("inst-b", "tabs-o");

    expect(hasItemsOverride(refA, master)).toBe(true);
    expect(hasItemsOverride(refB, master)).toBe(false);
    // B + origin 무영향
    expect(resolvedItemIds(master, refB)).toEqual(["t1", "t2", "t3"]);
    expect((master.props?.items as TabItem[])[1].title).toBe("t2");
    // A 의 resolved items 는 override 반영
    const aItems = resolveCanonicalRefProps(master, refA).items as TabItem[];
    expect(aItems[1].title).toBe("Renamed");
  });

  it("시나리오 3 — instance items 에 tab 추가 (shallow fork) → origin 미반영 + 미페어링 TabPanel + resolver no-throw", () => {
    const master = tabsOrigin("tabs-o", [tabItem("t1"), tabItem("t2")]);
    const refX = tabsRef("inst-x", "tabs-o", {
      items: [tabItem("t1"), tabItem("t2"), tabItem("t3")],
    });

    expect(hasItemsOverride(refX, master)).toBe(true);

    let resolved: string[] = [];
    expect(() => {
      resolved = resolvedItemIds(master, refX);
    }).not.toThrow();
    // shallow fork — instance 자신의 3개 items (origin 변경 미반영)
    expect(resolved).toEqual(["t1", "t2", "t3"]);
    // instance 는 children override 없음 → master TabPanels 2개 소비
    const panels = tabPanelItemIds(master);
    expect(panels).toEqual(["t1", "t2"]);
    // schema gap surface: resolved items 3 ↔ TabPanel 2 — t3 미페어링
    expect(resolved.length).toBeGreaterThan(panels.length);
    expect(panels).not.toContain("t3");
  });

  it("시나리오 4 — origin tab 삭제 → fork instance 는 items 유지(미페어링), 미-fork instance 는 페어링 일치", () => {
    // origin: items 4 → 1개 삭제 → items 3, TabPanel 3
    const masterAfter = tabsOrigin(
      "tabs-o",
      ["t1", "t2", "t3"].map((id) => tabItem(id)),
    );
    // fork instance — 삭제 전 4개 items 를 override 로 동결
    const refFork = tabsRef("inst-fork", "tabs-o", {
      items: ["t1", "t2", "t3", "t4"].map((id) => tabItem(id)),
    });
    const refPlain = tabsRef("inst-plain", "tabs-o");

    // fork: items 4 유지 ↔ master TabPanel 3 → 1 미페어링
    expect(resolvedItemIds(masterAfter, refFork)).toHaveLength(4);
    expect(tabPanelItemIds(masterAfter)).toHaveLength(3);
    // 미-fork: items 3 ↔ TabPanel 3 페어링 일치
    expect(resolvedItemIds(masterAfter, refPlain)).toEqual(
      tabPanelItemIds(masterAfter),
    );
  });

  it("시나리오 5 — origin items 변경 시 fork/미-fork 영향 분류 정확", () => {
    const masterAfter = tabsOrigin(
      "tabs-o",
      ["t1", "t2", "t3", "t9"].map((id) => tabItem(id)),
    );
    const refFork = tabsRef("inst-fork", "tabs-o", {
      items: ["t1", "t2"].map((id) => tabItem(id)),
    });
    const refPlain1 = tabsRef("inst-p1", "tabs-o");
    const refPlain2 = tabsRef("inst-p2", "tabs-o");

    const refs = [refFork, refPlain1, refPlain2];
    const forked = refs.filter((r) => hasItemsOverride(r, masterAfter));
    const propagated = refs.filter((r) => !hasItemsOverride(r, masterAfter));
    expect(forked.map((r) => r.id)).toEqual(["inst-fork"]);
    expect(propagated.map((r) => r.id)).toEqual(["inst-p1", "inst-p2"]);
    // 미-fork 는 새 origin items 반영, fork 는 자기 override 유지
    expect(resolvedItemIds(masterAfter, refPlain1)).toEqual([
      "t1",
      "t2",
      "t3",
      "t9",
    ]);
    expect(resolvedItemIds(masterAfter, refFork)).toEqual(["t1", "t2"]);
  });

  it("시나리오 6 — origin items 변경 undo/redo 시 instance resolved items 가 정확히 토글", () => {
    // undo/redo 의 history navigation 메커니즘은 historyActions.diff.test.ts 담당.
    // 본 시나리오는 ADR-138 계약 — origin items 의 prev/next 스냅샷 사이를 오갈 때
    // instance 가 정확히 재-resolve 되는지 — 를 확인한다.
    const masterV1 = tabsOrigin("tabs-o", [
      tabItem("t1"),
      tabItem("t2"),
      tabItem("t3"),
    ]);
    const masterV2 = tabsOrigin("tabs-o", [
      tabItem("t1"),
      tabItem("t2"),
      tabItem("t3"),
      tabItem("t4"),
    ]);
    const refA = tabsRef("inst-a", "tabs-o");
    const refB = tabsRef("inst-b", "tabs-o");

    // 변경 후 (redo 상태)
    expect(resolvedItemIds(masterV2, refA)).toHaveLength(4);
    expect(resolvedItemIds(masterV2, refB)).toHaveLength(4);
    // undo → V1 복원
    expect(resolvedItemIds(masterV1, refA)).toEqual(["t1", "t2", "t3"]);
    expect(resolvedItemIds(masterV1, refB)).toEqual(["t1", "t2", "t3"]);
    // redo → V2 재반영
    expect(resolvedItemIds(masterV2, refA)).toEqual(["t1", "t2", "t3", "t4"]);
  });

  it("시나리오 7 — IndexedDB persist roundtrip 후 reusable/ref/descendants 보존 + resolver 동작", () => {
    // IndexedDB 는 plain object 를 structured clone 으로 저장/복원 →
    // structuredClone 이 persist→hydrate 와 동일 연산.
    const master = tabsOrigin("tabs-o", [tabItem("t1"), tabItem("t2")]);
    const ref: RefNode = {
      id: "inst-a",
      type: "ref",
      ref: "tabs-o",
      props: { items: [tabItem("t1"), tabItem("x2", "X2")] },
      descendants: { "tabs-o-tablist": { "aria-label": "custom" } },
    };
    const doc = { version: "composition-1.0", children: [master, ref] };

    const cloned = structuredClone(doc);
    const clonedMaster = cloned.children[0] as CanonicalNode;
    const clonedRef = cloned.children[1] as RefNode;

    expect(clonedMaster.reusable).toBe(true);
    expect(clonedRef.type).toBe("ref");
    expect(clonedRef.ref).toBe("tabs-o");
    expect(clonedRef.descendants).toBeDefined();
    // clone 후에도 resolver 정상 동작
    expect(resolvedItemIds(clonedMaster, clonedRef)).toEqual(["t1", "x2"]);
    expect(hasItemsOverride(clonedRef, clonedMaster)).toBe(true);
  });

  it("시나리오 8 — Card origin 안에 Tabs origin 중첩 → Card instance 에서도 내부 Tabs origin 관계 resolve", () => {
    const innerTabs = tabsOrigin("inner-tabs", [tabItem("t1"), tabItem("t2")]);
    const cardMaster: CanonicalNode = {
      id: "card-o",
      type: "Card",
      reusable: true,
      props: {},
      children: [innerTabs],
    };
    const cardRef = tabsRef("card-inst", "card-o");

    // Card instance (override 없음) → root props = origin
    expect(resolveCanonicalRefProps(cardMaster, cardRef)).toEqual({});
    // 내부 Tabs origin 관계 보존
    const nested = cardMaster.children?.find((c) => c.type === "Tabs");
    expect(nested?.reusable).toBe(true);
    // 내부 Tabs 를 ref 하는 instance 도 정상 resolve
    const innerRef = tabsRef("inner-inst", "inner-tabs");
    expect(resolvedItemIds(innerTabs, innerRef)).toEqual(["t1", "t2"]);
  });
});
