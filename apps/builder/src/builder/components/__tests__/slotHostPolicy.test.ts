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
});
