import { describe, expect, it } from "vitest";

import {
  filterSlotCandidates,
  isSlotCandidateAllowed,
  isSlotHostElement,
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
      isSlotHostElement({ id: "component-taggroup", type: "TagGroup", reusable: true }),
    ).toBe(true);
    expect(isSlotHostElement({ id: "tg", type: "TagGroup" })).toBe(false);
    const host = { id: "component-taggroup", type: "TagGroup" };
    const defaultItem = { id: TAG_ITEM_DEFAULT_ORIGIN_ID, type: "Tag", reusable: true };
    const selectedItem = { id: TAG_ITEM_SELECTED_ORIGIN_ID, type: "Tag", reusable: true };
    const plainTag = { id: "local-tag", type: "Tag", reusable: true };
    const button = { id: "button-origin", type: "Button", reusable: true };
    expect(isSlotCandidateAllowed(host, defaultItem)).toBe(true);
    expect(isSlotCandidateAllowed(host, selectedItem)).toBe(true);
    expect(isSlotCandidateAllowed(host, plainTag)).toBe(false);
    expect(filterSlotCandidates(host, [button, plainTag, defaultItem, selectedItem])).toEqual([
      defaultItem,
      selectedItem,
    ]);
  });
});
