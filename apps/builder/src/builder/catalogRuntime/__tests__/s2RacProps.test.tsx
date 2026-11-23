// @vitest-environment jsdom
/**
 * S2 체크리스트 §9.1 · §9.2 「숨김」 (2026-11-24, 사용자 /goal 「권장 순서대로 1 → 2 → 3」 의 2) — S2 ·
 * RAC 가 선언하는 동작 · HTML prop 을 binding 이 받기만 하고 (`editorHidden`) 패널에 내지 않는다
 * (Button form 속성과 같은 방식 — 2026-11-11 사용자 결정 「개발자용 속성은 패널에 없음」). 동작은
 * RAC 의 것이라 (D1) 여기서는 작성값이 Preview · Publish 의 RAC 컴포넌트에 prop 으로 닿는지 본다 —
 * 렌더된 트리에서 RAC export 인 컴포넌트 하나가 그 값을 받았으면 통과.
 */
import "fake-indexeddb/auto";
import { render } from "@testing-library/react";
import * as RAC from "react-aria-components";
import * as RACTooltip from "react-aria-components/Tooltip";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogEditContract } from "../editContract";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:hidden" as NodeId;

// (jsdom has none — TagGroup's tag rows measure themselves.)
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

interface HiddenCase {
  palette: string;
  type: string;
  key: string;
  value: unknown;
  /** Other writes the case needs (a MenuTrigger open, so its Popover renders). */
  extra?: Record<string, unknown>;
  /** §9 「패널」 — shown in the panel (default: hidden). */
  panel?: true;
  /** The type to open first (its `isOpen`), so its Popover renders. */
  open?: string;
  /** Not a RAC component (S2 StatusLight is a `div`): the attribute on its element instead. */
  attribute?: string;
}

/** The palette type, the record's type in it, the prop and a non-default value. */
export const S2_HIDDEN_PROPS: readonly HiddenCase[] = [
  {
    palette: "CardView",
    type: "CardView",
    key: "disabledBehavior",
    value: "selection",
  },
  {
    palette: "CardView",
    type: "CardView",
    key: "disallowTypeAhead",
    value: true,
  },
  {
    palette: "CardView",
    type: "CardView",
    key: "escapeKeyBehavior",
    value: "none",
  },
  {
    palette: "CardView",
    type: "CardView",
    key: "shouldSelectOnPressUp",
    value: true,
  },
  {
    palette: "CardView",
    type: "CardView",
    key: "orientation",
    value: "horizontal",
  },
  {
    palette: "CardView",
    type: "Card",
    key: "allowsArrowNavigation",
    value: true,
  },
  { palette: "CardView", type: "Card", key: "focusMode", value: "child" },
  { palette: "CardView", type: "Card", key: "textValue", value: "First card" },
  { palette: "Menu", type: "Menu", key: "escapeKeyBehavior", value: "none" },
  {
    palette: "NumberField",
    type: "NumberField",
    key: "incrementAriaLabel",
    value: "More",
  },
  {
    palette: "NumberField",
    type: "NumberField",
    key: "decrementAriaLabel",
    value: "Less",
  },
  { palette: "Select", type: "Select", key: "autoComplete", value: "country" },
  {
    palette: "ComboBox",
    type: "ComboBox",
    key: "shouldFocusWrap",
    value: true,
  },
  { palette: "Form", type: "Form", key: "autoComplete", value: "off" },
  {
    palette: "Table",
    type: "Table",
    key: "disabledBehavior",
    value: "selection",
  },
  { palette: "Table", type: "Table", key: "escapeKeyBehavior", value: "none" },
  {
    palette: "Table",
    type: "Table",
    key: "keyboardNavigationBehavior",
    value: "tab",
  },
  {
    palette: "Table",
    type: "Table",
    key: "shouldSelectOnPressUp",
    value: true,
  },
  {
    palette: "Table",
    type: "Column",
    key: "allowsArrowNavigation",
    value: true,
  },
  { palette: "Table", type: "Column", key: "focusMode", value: "child" },
  { palette: "Table", type: "Cell", key: "allowsArrowNavigation", value: true },
  { palette: "Table", type: "Cell", key: "focusMode", value: "child" },
  {
    palette: "GridList",
    type: "GridList",
    key: "disabledBehavior",
    value: "selection",
  },
  {
    palette: "GridList",
    type: "GridList",
    key: "disallowTypeAhead",
    value: true,
  },
  {
    palette: "GridList",
    type: "GridList",
    key: "escapeKeyBehavior",
    value: "none",
  },
  {
    palette: "GridList",
    type: "GridList",
    key: "keyboardNavigationBehavior",
    value: "tab",
  },
  {
    palette: "GridList",
    type: "GridList",
    key: "shouldSelectOnPressUp",
    value: true,
  },
  {
    palette: "GridList",
    type: "GridListItem",
    key: "allowsArrowNavigation",
    value: true,
  },
  {
    palette: "GridList",
    type: "GridListItem",
    key: "focusMode",
    value: "child",
  },
  { palette: "GridList", type: "GridListItem", key: "download", value: true },
  { palette: "GridList", type: "GridListItem", key: "hrefLang", value: "ko" },
  {
    palette: "GridList",
    type: "GridListItem",
    key: "ping",
    value: "https://example.com/ping",
  },
  {
    palette: "GridList",
    type: "GridListItem",
    key: "referrerPolicy",
    value: "no-referrer",
  },
  {
    palette: "Tree",
    type: "Tree",
    key: "disabledBehavior",
    value: "selection",
  },
  { palette: "Tree", type: "Tree", key: "escapeKeyBehavior", value: "none" },
  {
    palette: "Tree",
    type: "Tree",
    key: "keyboardNavigationBehavior",
    value: "tab",
  },
  { palette: "Tree", type: "Tree", key: "shouldSelectOnPressUp", value: true },
  {
    palette: "Tree",
    type: "TreeItem",
    key: "allowsArrowNavigation",
    value: true,
  },
  { palette: "Tree", type: "TreeItem", key: "focusMode", value: "child" },
  { palette: "Tree", type: "TreeItem", key: "download", value: true },
  { palette: "Tree", type: "TreeItem", key: "hrefLang", value: "ko" },
  {
    palette: "Tree",
    type: "TreeItem",
    key: "ping",
    value: "https://example.com/ping",
  },
  {
    palette: "Tree",
    type: "TreeItem",
    key: "referrerPolicy",
    value: "no-referrer",
  },
  {
    palette: "TagGroup",
    type: "TagGroup",
    key: "escapeKeyBehavior",
    value: "none",
  },
  {
    palette: "TagGroup",
    type: "TagGroup",
    key: "shouldSelectOnPressUp",
    value: true,
  },
  {
    palette: "RangeCalendar",
    type: "RangeCalendar",
    key: "commitBehavior",
    value: "reset",
  },
  {
    palette: "DateRangePicker",
    type: "DateRangePicker",
    key: "commitBehavior",
    value: "reset",
  },
  {
    palette: "DatePicker",
    type: "DatePicker",
    key: "autoComplete",
    value: "bday",
  },
  {
    palette: "DateField",
    type: "DateField",
    key: "autoComplete",
    value: "bday",
  },
  {
    palette: "Menu",
    type: "MenuTrigger",
    key: "shouldFlip",
    value: false,
    extra: { isOpen: true },
  },
  // §9 「패널」 (2026-11-24) — shown, the same way to RAC.
  {
    palette: "CardView",
    type: "CardView",
    key: "disallowEmptySelection",
    value: true,
    panel: true,
  },
  {
    palette: "Menu",
    type: "Menu",
    key: "shouldCloseOnSelect",
    value: false,
    panel: true,
  },
  {
    palette: "Menu",
    type: "Menu",
    key: "shouldFocusWrap",
    value: true,
    panel: true,
  },
  {
    palette: "NumberField",
    type: "NumberField",
    key: "commitBehavior",
    value: "validate",
    panel: true,
  },
  {
    palette: "Select",
    type: "Select",
    key: "shouldCloseOnSelect",
    value: false,
    panel: true,
  },
  {
    palette: "ComboBox",
    type: "ComboBox",
    key: "formValue",
    value: "text",
    panel: true,
  },
  {
    palette: "Menu",
    type: "Popover",
    key: "isNonModal",
    value: true,
    open: "MenuTrigger",
    panel: true,
  },
  {
    palette: "Tooltip",
    type: "TooltipTrigger",
    key: "shouldCloseOnPress",
    value: false,
    panel: true,
  },
  {
    palette: "StatusLight",
    type: "StatusLight",
    key: "role",
    value: "status",
    attribute: "role",
    panel: true,
  },
  {
    palette: "ContextualHelp",
    type: "ContextualHelp",
    key: "placement",
    value: "top start",
    extra: { isOpen: true },
    panel: true,
  },
  {
    palette: "ContextualHelp",
    type: "ContextualHelp",
    key: "offset",
    value: 20,
    extra: { isOpen: true },
    panel: true,
  },
  {
    palette: "ContextualHelp",
    type: "ContextualHelp",
    key: "crossOffset",
    value: 4,
    extra: { isOpen: true },
    panel: true,
  },
  {
    palette: "ContextualHelp",
    type: "ContextualHelp",
    key: "containerPadding",
    value: 24,
    extra: { isOpen: true },
    panel: true,
  },
  {
    palette: "ContextualHelp",
    type: "ContextualHelp",
    key: "shouldFlip",
    value: false,
    extra: { isOpen: true },
    panel: true,
  },
  {
    palette: "Menu",
    type: "MenuItem",
    key: "shouldCloseOnSelect",
    value: false,
    open: "MenuTrigger",
    panel: true,
  },
];

async function open(palette: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-hidden-props" as const,
        name: "S2 hidden props",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-hidden-props-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: OWNER,
          definitionId: catalogPaletteDefinitionId(library, palette),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  return workspace;
}

// (A component imported from its RAC subpath — `react-aria-components/Tooltip` — is that module's.)
const RAC_TYPES: ReadonlySet<unknown> = new Set([
  ...Object.values(RAC),
  ...Object.values(RACTooltip),
]);

/** The container's HostRoot as React holds it now (the container key keeps the first one). */
const currentRoot = (fiber: Fiber): Fiber =>
  (fiber.stateNode as { current?: Fiber } | null)?.current ?? fiber;

type Fiber = {
  stateNode?: unknown;
  type: unknown;
  elementType: unknown;
  memoizedProps: Record<string, unknown> | null;
  child: Fiber | null;
  sibling: Fiber | null;
};

/** The RAC components in the rendered tree that received `key` = `value`. */
function racReceivers(container: HTMLElement, key: string, value: unknown) {
  const rootKey = Object.keys(container).find((k) =>
    k.startsWith("__reactContainer$"),
  )!;
  const out: string[] = [];
  const stack: Fiber[] = [
    currentRoot((container as unknown as Record<string, Fiber>)[rootKey]!),
  ];
  while (stack.length) {
    const fiber = stack.pop()!;
    if (
      (RAC_TYPES.has(fiber.elementType) || RAC_TYPES.has(fiber.type)) &&
      fiber.memoizedProps?.[key] === value
    ) {
      const type = fiber.elementType as {
        displayName?: string;
        render?: { name?: string };
      };
      out.push(type.displayName ?? type.render?.name ?? "?");
    }
    if (fiber.sibling) stack.push(fiber.sibling);
    if (fiber.child) stack.push(fiber.child);
  }
  return out;
}

function racAll(container: HTMLElement) {
  const rootKey = Object.keys(container).find((k) =>
    k.startsWith("__reactContainer$"),
  )!;
  const out: string[] = [];
  const stack: Fiber[] = [
    currentRoot((container as unknown as Record<string, Fiber>)[rootKey]!),
  ];
  while (stack.length) {
    const fiber = stack.pop()!;
    if (RAC_TYPES.has(fiber.elementType) || RAC_TYPES.has(fiber.type)) {
      const type = fiber.elementType as {
        displayName?: string;
        render?: { name?: string };
      };
      out.push(
        (type.displayName ?? type.render?.name ?? "?") +
          ":" +
          Object.keys(fiber.memoizedProps ?? {}).join(","),
      );
    }
    if (fiber.sibling) stack.push(fiber.sibling);
    if (fiber.child) stack.push(fiber.child);
  }
  return out;
}

describe("S2 §9 숨김 · 패널 prop — binding 이 받고 (숨김은 패널에 없고) RAC 에 닿는다", () => {
  it.each(S2_HIDDEN_PROPS)(
    "$palette › $type · $key",
    async ({
      palette,
      type,
      key,
      value,
      extra = {},
      panel = false,
      open: opened,
      attribute,
    }) => {
      const workspace = await open(palette);
      try {
        const root = workspace.root;
        const owner = [...root.canvasInputs.values()].find((item) =>
          item.id.endsWith(`::${OWNER}`),
        )!;
        if (opened) {
          const trigger = [...root.canvasInputs.values()].find(
            (item) => root.typeOf(item) === opened,
          )!;
          workspace.execute(
            setFields({
              targets: [workspace.itemOfRecord(trigger.id)!.target],
              props: { isOpen: { kind: "set", value: true } },
            }),
          );
        }
        // A record the DOM draws (a Table's first Column may be its hidden selection column).
        const first = render(renderCatalogDom(root, owner.id));
        // (A portal — an open Popover — draws in the body.)
        const html = document.body.innerHTML;
        first.unmount();
        const records = [...root.canvasInputs.values()].filter(
          (item) => root.typeOf(item) === type,
        );
        const record =
          records.find((item) => html.includes(item.id)) ?? records[0];
        expect(record, `${type} in ${palette}`).toBeDefined();
        const target = workspace.itemOfRecord(record!.id)!.target;
        const contract = catalogEditContract(
          root.runtime.graph,
          workspace.readModel,
          target,
        );
        expect(
          contract.fields.find((f) => f.key === key)?.editorHidden ??
            (contract.fields.some((f) => f.key === key) ? false : undefined),
          `${type}.${key} accepted · ${panel ? "shown" : "hidden"}`,
        ).toBe(!panel);
        workspace.execute(
          setFields({
            targets: [target],
            props: Object.fromEntries(
              Object.entries({ ...extra, [key]: value }).map(([k, v]) => [
                k,
                { kind: "set" as const, value: v as never },
              ]),
            ),
          }),
        );
        const { container, unmount } = render(
          <>
            {renderCatalogDom(root, owner.id)}
            {/* (A record the closed owner does not draw — a MenuTrigger's Menu — on its own.) */}
            {html.includes(record!.id)
              ? null
              : renderCatalogDom(root, record!.id)}
          </>,
        );
        try {
          if (attribute)
            expect(
              document.querySelector(`[${attribute}="${String(value)}"]`),
              `${type}.${key} on its element`,
            ).not.toBeNull();
          else
            expect(
              racReceivers(container, key, value),
              `${type}.${key} = ${String(value)} reaches a RAC component — ${JSON.stringify(racAll(container)).slice(0, 600)}`,
            ).not.toEqual([]);
        } finally {
          unmount();
        }
      } finally {
        workspace.dispose();
      }
    },
  );
});
