import { describe, expect, it } from "vitest";

import {
  filterSlotCandidates,
  isSlotCandidateAllowed,
  isSlotHostElement,
  resolveSlotInsertAction,
} from "../slotHostPolicy";
import {
  LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
  LISTBOX_ITEM_SELECTED_ORIGIN_ID,
} from "../listbox/listBoxTemplateOrigins";
import { GRIDLIST_ITEM_DEFAULT_ORIGIN_ID } from "../gridlist/gridListTemplateOrigins";
import {
  TAG_ITEM_DEFAULT_ORIGIN_ID,
  TAG_ITEM_SELECTED_ORIGIN_ID,
} from "../taggroup/tagGroupTemplateOrigins";
import {
  TAB_ITEM_DEFAULT_ORIGIN_ID,
  TAB_ITEM_SELECTED_ORIGIN_ID,
} from "../tabs/tabsTemplateOrigins";

describe("ADR-146 shared slot host policy", () => {
  it("keeps frame-compatible shell slot host detection out of property panels", () => {
    expect(isSlotHostElement({ id: "frame", type: "Frame" })).toBe(true);
    expect(isSlotHostElement({ id: "content", type: "CardContent" })).toBe(
      true,
    );
    expect(isSlotHostElement({ id: "text", type: "Text" })).toBe(false);
  });

  it("limits ListBox slot candidates to ListBoxItem template variants", () => {
    const host = { id: "listbox-origin", type: "ListBox" };
    const defaultItem = {
      id: LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
      type: "ListBoxItem",
      reusable: true,
    };
    const selectedItem = {
      id: LISTBOX_ITEM_SELECTED_ORIGIN_ID,
      type: "ListBoxItem",
      reusable: true,
    };
    const genericItem = {
      id: "local-listbox-item",
      type: "ListBoxItem",
      reusable: true,
    };
    const button = { id: "button-origin", type: "Button", reusable: true };

    expect(isSlotCandidateAllowed(host, defaultItem)).toBe(true);
    expect(isSlotCandidateAllowed(host, selectedItem)).toBe(true);
    expect(isSlotCandidateAllowed(host, genericItem)).toBe(false);
    expect(isSlotCandidateAllowed(host, button)).toBe(false);
    expect(
      filterSlotCandidates(host, [button, selectedItem, defaultItem]),
    ).toEqual([selectedItem, defaultItem]);
  });

  // ADR-161 Phase 7: GridList slot host parity (ListBox 대칭).
  it("recognizes reusable GridList origin as a slot host", () => {
    expect(
      isSlotHostElement({
        id: "component-gridlist",
        type: "GridList",
        reusable: true,
      }),
    ).toBe(true);
    // 비-reusable/비-systemOwned GridList 는 slot host 아님 (ListBox 규약 동일).
    expect(isSlotHostElement({ id: "gl", type: "GridList" })).toBe(false);
  });

  it("limits GridList slot candidates to GridListItem template variants", () => {
    const host = { id: "component-gridlist", type: "GridList" };
    const defaultItem = {
      id: GRIDLIST_ITEM_DEFAULT_ORIGIN_ID,
      type: "GridListItem",
      reusable: true,
    };
    const genericItem = {
      id: "local-gridlist-item",
      type: "GridListItem",
      reusable: true,
    };
    const button = { id: "button-origin", type: "Button", reusable: true };

    expect(isSlotCandidateAllowed(host, defaultItem)).toBe(true);
    expect(isSlotCandidateAllowed(host, genericItem)).toBe(false);
    expect(isSlotCandidateAllowed(host, button)).toBe(false);
    expect(filterSlotCandidates(host, [button, defaultItem])).toEqual([
      defaultItem,
    ]);
  });

  // ADR-229 Phase 2: TagGroup 은 ListBox 대칭 slot host — origin Properties 에 "Slot" 절, 후보는 Tag item origin 2.
  it("recognizes reusable TagGroup origin as a slot host and limits candidates to Tag item template variants", () => {
    expect(
      isSlotHostElement({
        id: "component-taggroup",
        type: "TagGroup",
        reusable: true,
      }),
    ).toBe(true);
    expect(isSlotHostElement({ id: "tg", type: "TagGroup" })).toBe(false);
    const host = { id: "component-taggroup", type: "TagGroup" };
    const defaultItem = {
      id: TAG_ITEM_DEFAULT_ORIGIN_ID,
      type: "Tag",
      reusable: true,
    };
    const selectedItem = {
      id: TAG_ITEM_SELECTED_ORIGIN_ID,
      type: "Tag",
      reusable: true,
    };
    const plainTag = { id: "local-tag", type: "Tag", reusable: true };
    const button = { id: "button-origin", type: "Button", reusable: true };
    expect(isSlotCandidateAllowed(host, defaultItem)).toBe(true);
    expect(isSlotCandidateAllowed(host, selectedItem)).toBe(true);
    expect(isSlotCandidateAllowed(host, plainTag)).toBe(false);
    expect(
      filterSlotCandidates(host, [button, plainTag, defaultItem, selectedItem]),
    ).toEqual([defaultItem, selectedItem]);
  });

  /**
   * ADR-229 Phase 3 후속 (사용자 지적 2026-09-21): TagGroup 은 chip 이 `items[]` 데이터라 (ADR-097
   * Addendum 1) origin Slot 절의 "+" 가 ref 자식을 root 에 넣어도 TagList 에 아무것도 안 생긴다 —
   * Tag/Default "+" 는 item 등록, Tag/Selected "+" 는 item 등록 + selectedKeys. Frame/ListBox 는 종전 ref 자식.
   */
  it("resolveSlotInsertAction — TagGroup host 는 collection item 등록, selected variant 면 selected", () => {
    const host = { id: "component-taggroup", type: "TagGroup", reusable: true };
    expect(
      resolveSlotInsertAction(host, {
        id: TAG_ITEM_DEFAULT_ORIGIN_ID,
        type: "Tag",
      }),
    ).toEqual({ kind: "collection-item", itemsKey: "items", selected: false });
    expect(
      resolveSlotInsertAction(host, {
        id: TAG_ITEM_SELECTED_ORIGIN_ID,
        type: "Tag",
        metadata: { variant: "selected" },
      }),
    ).toEqual({ kind: "collection-item", itemsKey: "items", selected: true });
    // 사용자가 만든 selected 변형 (id 는 임의, metadata.variant 로 판정)
    expect(
      resolveSlotInsertAction(host, {
        id: "my-tag-selected",
        type: "Tag",
        componentName: "Tag/Hot",
        metadata: { variant: "selected" },
      }),
    ).toEqual({ kind: "collection-item", itemsKey: "items", selected: true });
    expect(
      resolveSlotInsertAction(
        { id: "frame", type: "frame" },
        { id: "button-origin", type: "Button" },
      ),
    ).toEqual({ kind: "child" });
    expect(
      resolveSlotInsertAction(
        { id: "component-listbox", type: "ListBox", reusable: true },
        { id: LISTBOX_ITEM_DEFAULT_ORIGIN_ID, type: "ListBoxItem" },
      ),
    ).toEqual({ kind: "child" });
  });

  /**
   * ADR-233 Phase 1: Tabs origin root 가 Tab 항목 template slot host (Tag 대칭). Tab 은 items + TabPanel
   * 쌍이라 그 쌍을 만드는 기존 추가 경로가 없어 (Phase 0) "+" 는 삽입 없음.
   */
  it("Tabs origin 은 Tab 항목 origin 만 후보로 받는 slot host 이고 삽입은 none", () => {
    const host = { id: "component-tabs", type: "Tabs", reusable: true };
    const defaultItem = { id: TAB_ITEM_DEFAULT_ORIGIN_ID, type: "Tab", reusable: true };
    const selectedItem = { id: TAB_ITEM_SELECTED_ORIGIN_ID, type: "Tab", reusable: true };
    const button = { id: "button-origin", type: "Button", reusable: true };
    expect(isSlotHostElement(host)).toBe(true);
    // plain Tabs (사용자 배치) 는 host 아님 — Tag 와 같은 정책.
    expect(isSlotHostElement({ id: "tabs-1", type: "Tabs" })).toBe(false);
    expect(filterSlotCandidates(host, [button, defaultItem, selectedItem])).toEqual([
      defaultItem,
      selectedItem,
    ]);
    expect(resolveSlotInsertAction(host, defaultItem)).toEqual({ kind: "none" });
    expect(resolveSlotInsertAction(host, selectedItem)).toEqual({ kind: "none" });
  });
});
