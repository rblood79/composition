/**
 * ADR-142 family ④(collections) — Menu primitive 의 `PrimitiveBinding`.
 *
 * RAC `Menu` — the list (`delegatedDom` `menu`): in a MenuTrigger's · SubmenuTrigger's Popover, or
 * open in an Autocomplete (ADR-256 후속 4). Its items are its MenuItem nodes.
 */

import type { PrimitiveBinding } from "../types";

export const menuBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "menu",
  },
  props: {
    accepts: {
      dataBinding: { kind: "binding", label: "Data", section: "content" },
      // ADR-912 영역 B Task 3: 정적 items[] SSOT(RuntimeMenuItem[]).
      //   toRacProps 가 props.items pass-through 를 보장(미선언 시 static children placeholder).
      //   kind:"items-manager" 는 비-DATA_ATTR_KIND → out[key]=value 통과 유지 +
      //   Inspector 정적 menu item 추가/제거 UI(ItemsManager) 렌더(RSP Dynamic collections).
      items: {
        kind: "items-manager",
        label: "Menu Items",
        section: "content",
        itemsManager: {
          itemsKey: "items",
          itemTypeName: "MenuItem",
          defaultItem: { id: "", label: "New Item" },
          itemSchema: [
            { key: "label", type: "string", label: "Label" },
            { key: "value", type: "string", label: "Value" },
            { key: "href", type: "string", label: "URL" },
            { key: "isDisabled", type: "boolean", label: "Disabled" },
            { key: "icon", type: "icon", label: "Icon" },
            { key: "shortcut", type: "string", label: "Shortcut" },
            { key: "description", type: "string", label: "Description" },
          ],
          labelKey: "label",
          allowSections: true,
        },
      },
      // ADR-256 후속 4: the trigger (its label · variant) is the MenuTrigger's Button node — a
      //   Menu node is RAC's list.
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      selectionMode: {
        kind: "enum",
        label: "Selection Mode",
        section: "state",
        default: "none",
        options: [
          { value: "none", label: "None" },
          { value: "single", label: "Single" },
          { value: "multiple", label: "Multiple" },
        ],
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
