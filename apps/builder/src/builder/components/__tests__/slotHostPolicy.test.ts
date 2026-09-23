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

  /**
   * ADR-234 Phase 3 — slot 은 항목을 직접 담는 목록 틀 (TagList) 에 있다. TagGroup root 는 slot host 가 아니다
   * (ADR-229 의 root 규칙은 이관이 대체 — 사용자 지적 2026-09-23: root 에 Slot 절이 떠 Enable · "+" 가 root 를 썼다).
   */
  it("TagGroup root 는 slot host 가 아니고 slot 을 가진 TagList 만 host · 후보는 Tag 항목 origin", () => {
    expect(
      isSlotHostElement({
        id: "component-taggroup",
        type: "TagGroup",
        reusable: true,
      }),
    ).toBe(false);
    expect(isSlotHostElement({ id: "tg", type: "TagGroup" })).toBe(false);
    const host = {
      id: "component-taggroup__1",
      type: "TagList",
      slot: [TAG_ITEM_SELECTED_ORIGIN_ID],
    };
    expect(isSlotHostElement(host)).toBe(true);
    expect(isSlotHostElement({ id: "tl", type: "TagList" })).toBe(false);
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
    expect(resolveSlotInsertAction(host, selectedItem)).toEqual({
      kind: "list-item",
    });
  });

  it("resolveSlotInsertAction — Frame 은 ref 자식 · 목록 틀은 항목 instance", () => {
    expect(
      resolveSlotInsertAction(
        { id: "frame", type: "frame" },
        { id: "button-origin", type: "Button" },
      ),
    ).toEqual({ kind: "child" });
    // ADR-234 Phase 3d — ListBox 는 자기가 목록 틀: "+" = ListBoxItem instance 항목 (`collectionItemInsert`).
    expect(
      resolveSlotInsertAction(
        { id: "component-listbox", type: "ListBox", reusable: true },
        { id: LISTBOX_ITEM_DEFAULT_ORIGIN_ID, type: "ListBoxItem" },
      ),
    ).toEqual({ kind: "list-item" });
  });

  /** ADR-234 Phase 3 — Tabs 도 slot 은 TabList 에 있다. Tabs root 는 slot host 가 아니다. */
  it("Tabs root 는 slot host 가 아니고 slot 을 가진 TabList 만 host · 후보는 Tab 항목 origin", () => {
    expect(
      isSlotHostElement({ id: "component-tabs", type: "Tabs", reusable: true }),
    ).toBe(false);
    expect(isSlotHostElement({ id: "tabs-1", type: "Tabs" })).toBe(false);
    const host = {
      id: "component-tabs__1",
      type: "TabList",
      slot: [TAB_ITEM_SELECTED_ORIGIN_ID],
    };
    const defaultItem = { id: TAB_ITEM_DEFAULT_ORIGIN_ID, type: "Tab", reusable: true };
    const selectedItem = { id: TAB_ITEM_SELECTED_ORIGIN_ID, type: "Tab", reusable: true };
    const button = { id: "button-origin", type: "Button", reusable: true };
    expect(isSlotHostElement(host)).toBe(true);
    expect(filterSlotCandidates(host, [button, defaultItem, selectedItem])).toEqual([
      defaultItem,
      selectedItem,
    ]);
    expect(resolveSlotInsertAction(host, selectedItem)).toEqual({ kind: "list-item" });
  });
});
