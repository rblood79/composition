/**
 * ADR-142 family ④(collections) — Tabs primitive 의 `PrimitiveBinding`.
 *
 * DOM 은 `delegatedDom.tsx` `tabs` 가 shared `components/Tabs` 의 Tabs 를 그리고 그 안의 노드 트리
 * (TabList > Tab… + TabPanel…) 를 순서대로 그린다. Canvas 시각은 catalog rule
 * (`COMPONENT_RULES_TABLE.Tabs`).
 */

import type { PrimitiveBinding } from "../types";

export const tabsBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "tabs",
  },
  props: {
    accepts: {
      // ADR-308 Phase 1: the controlled twin of `defaultSelectedKey` (S2 · RAC) — accepted; the panel offers it in Phase 2.
      selectedKey: {
        editorHidden: true,
        kind: "string",
        label: "Selected tab",
        section: "value",
      },
      items: {
        kind: "items-manager",
        label: "Tabs",
        section: "content",
        itemsManager: {
          itemsKey: "items",
          itemTypeName: "Tab",
          defaultItem: { title: "New tab", content: "Tab body" },
          labelKey: "title",
          itemSchema: [
            { key: "title", type: "string", label: "Title" },
            { key: "content", type: "string", label: "Content" },
          ],
        },
      },
      dataBinding: {
        kind: "binding",
        label: "Data source",
        section: "collection",
      },
      size: {
        editorHidden: true,
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      orientation: {
        kind: "enum",
        label: "Orientation",
        section: "appearance",
        default: "horizontal",
        options: [
          { value: "horizontal", label: "Horizontal" },
          { value: "vertical", label: "Vertical" },
        ],
      },
      // live consumer: `delegatedDom.tsx` `tabs` · `tablist` (Tabs + TabList)
      density: {
        kind: "enum",
        label: "Density",
        section: "appearance",
        default: "regular",
        options: [
          { value: "compact", label: "Compact" },
          { value: "regular", label: "Regular" },
        ],
      },
      labelBehavior: {
        kind: "enum",
        label: "Label behavior",
        section: "appearance",
        default: "show",
        options: [
          { value: "show", label: "Show" },
          { value: "hide", label: "Hide" },
        ],
      },
      keyboardActivation: {
        kind: "enum",
        label: "Keyboard activation",
        section: "state",
        default: "automatic",
        options: [
          { value: "automatic", label: "Automatic" },
          { value: "manual", label: "Manual" },
        ],
      },
      disabledKeys: {
        kind: "string-array",
        label: "Disabled keys",
        section: "state",
      },
      // S2 Tabs `defaultSelectedKey` as the Design panel's Selected Tab (사용자 2026-10-13 「tabs컴퍼넌트의
      //   프러퍼티에 Selected Tab을 선택할수있게」): its choices are the Tabs' Tabs and it shows the
      //   selected one; choosing writes that Tab's Selected (`catalogSingleSelectionCommand` — a Tab's
      //   key can be its record identity, which the document does not keep).
      //   (A chosen value is Content, as a RadioGroup's · a TextField's `value`; the Tab's own
      //   Selected is a state.)
      defaultSelectedKey: {
        kind: "enum",
        label: "Selected tab",
        section: "value",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
