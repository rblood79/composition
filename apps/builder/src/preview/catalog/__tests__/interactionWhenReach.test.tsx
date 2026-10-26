import { act, createEvent, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CAPABILITY_REGISTRY } from "@composition/shared";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import {
  catalogInteractionOwner,
  catalogInteractionsCommand,
  catalogNewInteraction,
} from "../../../builder/catalogRuntime/interactions";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * RAC event audit (2026-10-26) — every When the Interactions panel offers runs a rule on the whole
 * Preview path: the palette instance, a rule `<event> → toast` on its root, the user's own RAC
 * interaction. The capability gate (`capabilityBindingReach.test.ts`) asks whether a Do reaches
 * RAC; this asks the When side — a wrapper that drops the handler leaves 「the rule never runs」.
 * Oracle: the toast the rule shows (RAC called the callback). jsdom + RAC 1.22.1.
 */
type Harness = Awaited<ReturnType<typeof openAdr280Preview>>;
type User = ReturnType<typeof userEvent.setup>;

interface Row {
  /** The palette entry (an overlay's palette entry is its trigger tree). */
  palette: string;
  /** The registry type of the instance root (the rule's owner). */
  type: string;
  event: string;
  declare?: Record<string, unknown>;
  /** The record whose node owns the rule (default: the instance root) — a position in it. */
  ownerRecord?: string;
  /** An owned node in the instance that owns the rule (a collection item). */
  ownerNode?: (h: Harness) => NodeId;
  /** Other palette entries next to it (a Button whose rule opens a standalone overlay). */
  with?: readonly string[];
  /** Props declared on the instance root when the rule's owner is another node. */
  declareRoot?: Record<string, unknown>;
  /** Rules set before the user's interaction (a Button's press opening the body). */
  setup?: (h: Harness) => void;
  act: (h: Harness, user: User) => Promise<void>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

const q = <T extends Element = HTMLElement>(h: Harness, selector: string) =>
  h.view.container.querySelector<T>(selector);
const qa = <T extends Element = HTMLElement>(h: Harness, selector: string) => [
  ...h.view.container.querySelectorAll<T>(selector),
];
const inBody = <T extends Element = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector);
const root = (h: Harness) => h.element(h.ids[0] as NodeId)!;
const press = (user: User, element: Element | null | undefined) =>
  user.click(element as Element);
const type = (user: User, element: Element | null, text: string) =>
  user.type(element as Element, text);

/** Open a picker and choose its last option (Select · ComboBox · Menu — their list portals out). */
async function chooseLast(user: User) {
  const options = await waitFor(() => {
    const found = [
      ...document.querySelectorAll<HTMLElement>(
        "[role=option], [role=menuitem], [role=menuitemradio], [role=menuitemcheckbox]",
      ),
    ];
    expect(found.length).toBeGreaterThan(0);
    return found;
  });
  await press(user, options.at(-1));
}

/** Open the MenuTrigger, read its last item's node, close it again. */
async function lastMenuItem(h: Harness): Promise<NodeId> {
  const user = userEvent.setup();
  await press(user, q(h, "button[aria-haspopup]"));
  const items = await waitFor(() => {
    const found = [...document.querySelectorAll("[role^=menuitem]")];
    expect(found.length).toBeGreaterThan(0);
    return found;
  });
  const id = nodeOf(items.at(-1));
  await user.keyboard("{Escape}");
  await waitFor(() => expect(document.querySelector("[role=menu]")).toBeNull());
  return id;
}

/** A rule (and declared props) on the node at a drawn record — a position inside an instance. */
function ruleAt(h: Harness, identity: string, row: Row, message: string) {
  const item = h.workspace.itemOfRecord(identity);
  expect(item, identity).toBeDefined();
  const owner = catalogInteractionOwner(item!.target);
  if (row.declare)
    h.workspace.execute(
      setFields({
        targets: [item!.target],
        props: Object.fromEntries(
          Object.entries(row.declare).map(([key, value]) => [
            key,
            { kind: "set" as const, value: value as never },
          ]),
        ),
        label: "Edit properties",
      }),
    );
  h.workspace.execute(
    catalogInteractionsCommand(
      owner,
      [catalogNewInteraction(owner, row.event, { opcode: "toast", message }, h.workspace.newId)],
      "Rules",
    ),
  );
  h.flush();
}

let dragPoint = 1;
/** A text drag over the DropZone (RAC `useDrop` reads `dataTransfer.items` · `types`). */
function drag(zone: Element, ...events: ("dragEnter" | "dragOver" | "drop" | "dragLeave")[]) {
  const items = [
    {
      kind: "string",
      type: "text/plain",
      getAsString: (cb: (s: string) => void) => cb("hi"),
    },
  ];
  const dataTransfer = {
    items: Object.assign(items, { add() {} }),
    types: ["text/plain"],
    files: [],
    dropEffect: "none",
    effectAllowed: "all",
    getData: () => "hi",
  };
  // (RAC reports a move — and restarts the activation timer — when the point moves.)
  // (jsdom has no DragEvent — the fallback Event takes no `clientX`, so it is set on the event.)
  act(() => {
    events.forEach((event, index) => {
      const created = createEvent[event](zone, { dataTransfer });
      for (const axis of ["clientX", "clientY"])
        Object.defineProperty(created, axis, { value: dragPoint + index });
      fireEvent(zone, created);
    });
  });
  dragPoint += events.length;
}

/** The owned node a record draws (`<path>::<node>` — an instance's own item). */
const nodeOf = (element: Element | null | undefined) =>
  element!.getAttribute("data-catalog-id")!.split("::").at(-1) as NodeId;

const ROWS: Row[] = [
  // ── press ──
  {
    palette: "Button",
    type: "Button",
    event: "onPress",
    act: (h, u) => press(u, root(h)),
  },
  {
    palette: "Link",
    type: "Link",
    event: "onPress",
    act: (h, u) => press(u, root(h)),
  },
  {
    palette: "ToggleButton",
    type: "ToggleButton",
    event: "onPress",
    act: (h, u) => press(u, root(h)),
  },
  {
    palette: "ToggleButton",
    type: "ToggleButton",
    event: "onChange",
    act: (h, u) => press(u, root(h)),
  },
  {
    palette: "FileTrigger",
    type: "FileTrigger",
    event: "onSelect",
    act: async (h) => {
      const input = q<HTMLInputElement>(h, "input[type=file]")!;
      const file = new File(["a"], "a.txt", { type: "text/plain" });
      act(() => {
        fireEvent.change(input, { target: { files: [file] } });
      });
    },
  },
  {
    palette: "DropZone",
    type: "DropZone",
    event: "onDrop",
    act: async (h) => {
      drag(root(h), "dragEnter", "dragOver", "drop");
      await act(async () => {});
    },
  },
  ...(["onDropEnter", "onDropMove"] as const).map(
    (event): Row => ({
      palette: "DropZone",
      type: "DropZone",
      event,
      act: async (h) => drag(root(h), "dragEnter", "dragOver", "dragOver"),
    }),
  ),
  {
    palette: "DropZone",
    type: "DropZone",
    event: "onDropExit",
    act: async (h) => drag(root(h), "dragEnter", "dragOver", "dragLeave"),
  },
  {
    palette: "DropZone",
    type: "DropZone",
    event: "onDropActivate",
    act: async (h) => {
      // (RAC activates a drop target held over for a while — `DROP_ACTIVATE_TIMEOUT`.)
      drag(root(h), "dragEnter", "dragOver");
      await act(() => new Promise((done) => setTimeout(done, 900)));
    },
  },
  // ── toggles ──
  {
    palette: "Checkbox",
    type: "Checkbox",
    event: "onChange",
    act: (h, u) => press(u, q(h, "input[type=checkbox]")),
  },
  ...(["Checkbox", "Switch"] as const).map(
    (palette): Row => ({
      palette,
      type: palette,
      event: "onPress",
      act: (h, u) => press(u, q(h, "input[type=checkbox]")),
    }),
  ),
  {
    palette: "Switch",
    type: "Switch",
    event: "onChange",
    act: (h, u) => press(u, q(h, "input[type=checkbox]")),
  },
  {
    palette: "CheckboxGroup",
    type: "CheckboxGroup",
    event: "onChange",
    act: (h, u) => press(u, q(h, "input[type=checkbox]")),
  },
  {
    palette: "ToggleButtonGroup",
    type: "ToggleButtonGroup",
    event: "onSelectionChange",
    act: (h, u) => press(u, qa(h, "button").at(-1)),
  },
  {
    palette: "RadioGroup",
    type: "RadioGroup",
    event: "onChange",
    act: (h, u) => press(u, qa(h, "input[type=radio]").at(-1)),
  },
  // ── text · number fields ──
  ...(["TextField", "TextArea", "SearchField"] as const).map(
    (palette): Row => ({
      palette,
      type: palette,
      event: "onChange",
      act: (h, u) => type(u, q(h, "input, textarea"), "x"),
    }),
  ),
  {
    palette: "SearchField",
    type: "SearchField",
    event: "onSubmit",
    act: (h, u) => type(u, q(h, "input"), "x{Enter}"),
  },
  {
    palette: "SearchField",
    type: "SearchField",
    event: "onClear",
    act: (h, u) => type(u, q(h, "input"), "x{Escape}"),
  },
  {
    palette: "NumberField",
    type: "NumberField",
    event: "onChange",
    act: async (h, u) => {
      await type(u, q(h, "input"), "4");
      await u.tab();
    },
  },
  {
    palette: "ColorField",
    type: "ColorField",
    event: "onChange",
    act: async (h, u) => {
      const input = q<HTMLInputElement>(h, "input")!;
      await u.clear(input);
      await type(u, input, "#00ff00");
      await u.tab();
    },
  },
  // ── sliders · color controls (a thumb's arrow key — move start · move · end) ──
  ...(["Slider", "ColorArea", "ColorSlider", "ColorWheel"] as const).flatMap(
    (palette): Row[] =>
      (["onChange", "onChangeEnd"] as const).map((event) => ({
        palette,
        type: palette,
        event,
        act: async (h, u) => {
          const thumb = q<HTMLInputElement>(h, "input[type=range]")!;
          act(() => thumb.focus());
          await u.keyboard("{ArrowLeft}{ArrowRight}");
        },
      })),
  ),
  {
    palette: "ColorSwatchPicker",
    type: "ColorSwatchPicker",
    event: "onChange",
    act: (h, u) => press(u, qa(h, "[role=option]").at(-1)),
  },
  // ── pickers ──
  {
    palette: "Select",
    type: "Select",
    event: "onOpenChange",
    act: (h, u) => press(u, q(h, "button[aria-haspopup]")),
  },
  // (RAC 1.22 deprecated `onSelectionChange` on a Select — single only, derived hidden: a rule
  // that uses it still runs; with `selectionMode: "multiple"` RAC calls only `onChange`.)
  {
    palette: "Select",
    type: "Select",
    event: "onSelectionChange",
    act: async (h, u) => {
      await press(u, q(h, "button[aria-haspopup]"));
      await chooseLast(u);
    },
  },
  {
    palette: "Select",
    type: "Select",
    event: "onChange",
    act: async (h, u) => {
      await press(u, q(h, "button[aria-haspopup]"));
      await chooseLast(u);
    },
  },
  {
    palette: "Select",
    type: "Select",
    event: "onChange",
    declare: { selectionMode: "multiple" },
    act: async (h, u) => {
      await press(u, q(h, "button[aria-haspopup]"));
      await chooseLast(u);
    },
  },
  {
    palette: "ComboBox",
    type: "ComboBox",
    event: "onInputChange",
    act: (h, u) => type(u, q(h, "input[role=combobox]"), "a"),
  },
  {
    palette: "ComboBox",
    type: "ComboBox",
    event: "onOpenChange",
    act: (h, u) => press(u, q(h, "button[aria-haspopup]")),
  },
  {
    palette: "ComboBox",
    type: "ComboBox",
    event: "onSelectionChange",
    act: async (h, u) => {
      await press(u, q(h, "button[aria-haspopup]"));
      await chooseLast(u);
    },
  },
  {
    palette: "Autocomplete",
    type: "Autocomplete",
    event: "onInputChange",
    act: (h, u) => type(u, q(h, "input"), "a"),
  },
  // ── collections ──
  ...(
    [
      ["ListBox", "[role=option]"],
      ["GridList", "[role=row]"],
      ["CardView", "[role=row]"],
      ["Tree", "[role=row]"],
      ["TagGroup", "[role=row]"],
    ] as const
  ).flatMap(([palette, item]): Row[] => [
    {
      palette,
      type: palette,
      event: "onSelectionChange",
      declare: { selectionMode: "single" },
      act: (h, u) => press(u, qa(h, item).at(-1)),
    },
  ]),
  ...(
    [
      ["ListBox", "[role=option]"],
      ["GridList", "[role=row]"],
      ["CardView", "[role=row]"],
      ["Tree", "[role=row]"],
    ] as const
  ).map(([palette, item]): Row => ({
    palette,
    type: palette,
    event: "onAction",
    declare: { selectionMode: "none" },
    act: (h, u) => press(u, qa(h, item).at(-1)),
  })),
  {
    palette: "Table",
    type: "Table",
    event: "onSelectionChange",
    declare: { selectionMode: "single" },
    act: (h, u) => press(u, qa(h, "tbody [role=row] [role=gridcell]").at(-1)),
  },
  {
    palette: "Table",
    type: "Table",
    event: "onRowAction",
    declare: { selectionMode: "none" },
    act: (h, u) => press(u, qa(h, "tbody [role=row] [role=gridcell]").at(-1)),
  },
  {
    palette: "Table",
    type: "Table",
    event: "onSortChange",
    act: async (h, u) => {
      const column = qa(h, "[role=columnheader]")[0]!;
      const id = column.getAttribute("data-catalog-id")!.split("::").at(-1)!;
      h.declare(id as NodeId, { allowsSorting: true });
      await press(u, qa(h, "[role=columnheader]")[0]);
    },
  },
  {
    palette: "Tree",
    type: "Tree",
    event: "onExpandedChange",
    act: (h, u) => press(u, q(h, "button[slot=chevron]")),
  },
  {
    palette: "TagGroup",
    type: "TagGroup",
    event: "onRemove",
    act: async (h, u) => {
      const row = qa(h, "[role=row]")[0]!;
      act(() => row.focus());
      await u.keyboard("{Delete}");
    },
  },
  // (A Menu is the list in its MenuTrigger's Popover — a position of the instance.)
  ...(
    [
      ["onAction", undefined],
      ["onSelectionChange", { selectionMode: "single" }],
    ] as const
  ).map(
    ([event, declare]): Row => ({
      palette: "Menu",
      type: "Menu",
      event,
      ownerRecord: "lib:template:component-menu__menu",
      ...(declare ? { declare } : {}),
      act: async (h, u) => {
        await press(u, q(h, "button[aria-haspopup]"));
        await chooseLast(u);
      },
    }),
  ),
  {
    palette: "Menu",
    type: "MenuTrigger",
    event: "onOpenChange",
    act: (h, u) => press(u, q(h, "button[aria-haspopup]")),
  },
  {
    palette: "Breadcrumbs",
    type: "Breadcrumbs",
    event: "onAction",
    act: (h, u) => press(u, qa(h, "a")[0]),
  },
  {
    palette: "Tabs",
    type: "Tabs",
    event: "onSelectionChange",
    act: (h, u) => press(u, qa(h, "[role=tab]").at(-1)),
  },
  {
    palette: "Disclosure",
    type: "Disclosure",
    event: "onExpandedChange",
    act: (h, u) => press(u, q(h, "button[slot=trigger]")),
  },
  {
    palette: "DisclosureGroup",
    type: "DisclosureGroup",
    event: "onExpandedChange",
    act: (h, u) => press(u, q(h, "button[slot=trigger]")),
  },
  // ── overlays (the palette names the trigger tree after its body) ──
  ...(
    [
      ["Dialog", "DialogTrigger"],
      ["Popover", "DialogTrigger"],
      ["ContextualHelp", "ContextualHelp"],
    ] as const
  ).map(([palette, owner]): Row => ({
    palette,
    type: owner,
    event: "onOpenChange",
    act: (h, u) => press(u, q(h, "button")),
  })),
  {
    palette: "Tooltip",
    type: "TooltipTrigger",
    event: "onOpenChange",
    act: async (h, u) => {
      await u.tab();
      expect(document.activeElement).toBe(q(h, "button"));
    },
  },
  // ── date · time ──
  ...(["DateField", "TimeField", "DatePicker", "DateRangePicker"] as const).map(
    (palette): Row => ({
      palette,
      type: palette,
      event: "onChange",
      act: async (h, u) => {
        // (Every segment set — a range needs both ends' — then the value is complete.)
        for (const segment of qa(h, "[role=spinbutton]")) {
          act(() => segment.focus());
          await u.keyboard("{ArrowUp}");
        }
      },
    }),
  ),
  ...(["DatePicker", "DateRangePicker"] as const).map((palette): Row => ({
    palette,
    type: palette,
    event: "onOpenChange",
    act: (h, u) => press(u, q(h, "button[aria-haspopup]")),
  })),
  {
    palette: "Calendar",
    type: "Calendar",
    event: "onChange",
    act: (h, u) => press(u, qa(h, "[role=gridcell] [role=button]").at(-1)),
  },
  {
    palette: "Calendar",
    type: "Calendar",
    event: "onFocusChange",
    act: (h, u) => press(u, qa(h, "[role=gridcell] [role=button]").at(-1)),
  },
  {
    palette: "RangeCalendar",
    type: "RangeCalendar",
    event: "onChange",
    act: async (h, u) => {
      const cells = qa(h, "[role=gridcell] [role=button]");
      await press(u, cells.at(-2));
      await press(u, cells.at(-1));
    },
  },
  {
    palette: "RangeCalendar",
    type: "RangeCalendar",
    event: "onFocusChange",
    act: (h, u) => press(u, qa(h, "[role=gridcell] [role=button]").at(-1)),
  },
  // ── form ──
  {
    palette: "Form",
    type: "Form",
    event: "onSubmit",
    act: async (h, u) => {
      for (const input of qa(h, "input")) await type(u, input, "a@b.co");
      await press(u, q(h, "button[type=submit]"));
    },
  },
  {
    palette: "Form",
    type: "Form",
    event: "onReset",
    act: (h, u) => press(u, q(h, "button[type=reset]")),
  },
  {
    palette: "Form",
    type: "Form",
    event: "onInvalid",
    act: (h, u) => press(u, q(h, "button[type=submit]")),
  },
  {
    palette: "Menu",
    type: "Menu",
    event: "onClose",
    ownerRecord: "lib:template:component-menu__menu",
    act: async (h, u) => {
      await press(u, q(h, "button[aria-haspopup]"));
      await chooseLast(u);
    },
  },
  {
    palette: "TagGroup",
    type: "TagGroup",
    event: "onAction",
    act: (h, u) => press(u, qa(h, "[role=row]").at(-1)),
  },
  // ── an item's own action (the item node's When) ──
  ...(
    [
      ["ListBox", "ListBoxItem", "[role=option]"],
      ["GridList", "GridListItem", "[role=row]"],
      ["Tree", "TreeItem", "[role=row]"],
      ["Table", "Row", "tbody [role=row]"],
      ["TagGroup", "Tag", "[role=row]"],
    ] as const
  ).map(
    ([palette, item, selector]): Row => ({
      palette,
      type: item,
      event: "onAction",
      // (A selectable collection presses to select — its items act on a press without selection.)
      declareRoot: { selectionMode: "none" },
      ownerNode: (h) => nodeOf(qa(h, selector).at(-1)),
      act: (h, u) =>
        press(
          u,
          palette === "Table"
            ? qa(h, `${selector} [role=gridcell]`).at(-1)
            : qa(h, selector).at(-1),
        ),
    }),
  ),
  {
    palette: "Menu",
    type: "MenuItem",
    event: "onAction",
    ownerNode: () => menuItemId!,
    setup: () => {},
    act: async (h, u) => {
      await press(u, q(h, "button[aria-haspopup]"));
      await chooseLast(u);
    },
  },
  // ── a standalone overlay body: a rule opens it, the user dismisses it ──
  {
    palette: "Modal",
    with: ["Button"],
    type: "Modal",
    event: "onOpenChange",
    setup: (h) =>
      h.rule(h.ids[1] as NodeId, "onPress", {
        opcode: "capability",
        target: { nodeId: h.ids[0] as NodeId },
        capabilityId: "open",
      } as never),
    act: async (h, u) => {
      await press(u, h.element(h.ids[1] as NodeId));
      await waitFor(() =>
        expect(inBody(".react-aria-ModalOverlay")).not.toBeNull(),
      );
      // (A Modal without a Dialog has nothing to focus — Escape goes to the overlay itself.)
      act(() => {
        fireEvent.keyDown(inBody(".react-aria-Modal")!, { key: "Escape" });
      });
    },
  },
];

/**
 * The element a type's press · hover · focus events come from (its palette instance) — the hidden
 * events the panel's 「Show all of RAC」 toggle opens.
 */
const POINTER_TARGET: Readonly<Record<string, string>> = {
  Button: "button",
  Link: "a",
  ToggleButton: "button",
  DropZone: "[data-catalog-id$='dropzone-0']",
  Checkbox: "input[type=checkbox]",
  Switch: "input[type=checkbox]",
  CheckboxGroup: "input[type=checkbox]",
  RadioGroup: "input[type=radio]",
  TextField: "input",
  TextArea: "textarea",
  SearchField: "input",
  NumberField: "input",
  ColorField: "input",
  Select: "button[aria-haspopup]",
  ComboBox: "input[role=combobox]",
  ListBox: "[role=option]",
  DateField: "[role=spinbutton]",
  TimeField: "[role=spinbutton]",
  DatePicker: "[role=spinbutton]",
  DateRangePicker: "[role=spinbutton]",
};

/** One interaction per hidden event: press it, hover it, focus it (and leave). */
async function pointerAct(h: Harness, u: User, type: string, event: string) {
  const target = q(h, POINTER_TARGET[type]!)!;
  if (event.startsWith("onPress")) return press(u, target);
  if (event.startsWith("onHover")) {
    await u.hover(target);
    if (event === "onHoverEnd") await u.unhover(target);
    return;
  }
  await press(u, target);
  if (event === "onBlur") await u.click(document.body);
}

/**
 * Rows jsdom cannot run — the same RAC component rendered alone calls none either (probe, RAC
 * 1.22.1 + user-event): an `<a>`'s press ends without `onPressUp` in jsdom.
 */
const JSDOM_UNOBSERVABLE: ReadonlySet<string> = new Set(["Link.onPressUp"]);

/** The hidden events the toggle offers (every group but keyboard — Q3), one row each. */
const HIDDEN_ROWS: Row[] = Object.entries(CAPABILITY_REGISTRY).flatMap(
  ([type, entry]) =>
    (entry.groups ?? [])
      .filter((group) => ["press", "hover", "focus"].includes(group.id))
      .flatMap((group) =>
        group.hiddenEvents
          .filter((event) => !JSDOM_UNOBSERVABLE.has(`${type}.${event}`))
          .map(
          (event): Row => ({
            palette: type,
            type,
            event,
            act: (h, u) => pointerAct(h, u, type, event),
          }),
        ),
      ),
);

/**
 * The menu items are drawn only when the menu is open — the MenuItem row reads the last item's
 * node from the Menu probe below (set before its row runs).
 */
let menuItemId: NodeId | undefined;

describe("RAC event audit — every offered When runs its rule in the Preview", () => {
  it.each(
    ROWS.map(
      (row) =>
        [
          `${row.type}.${row.event}${row.declare ? ` ${JSON.stringify(row.declare)}` : ""}`,
          row,
        ] as const,
    ),
  )("%s", async (_name, row) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr280Preview([row.palette, ...(row.with ?? [])]);
    if (row.type === "MenuItem") menuItemId = await lastMenuItem(h);
    const owner = row.ownerNode ? row.ownerNode(h) : (h.ids[0] as NodeId);
    const message = `${row.type}.${row.event}`;
    if (row.declareRoot)
      h.declare(h.ids[0] as NodeId, row.declareRoot as Record<string, never>);
    row.setup?.(h);
    if (row.ownerRecord)
      ruleAt(h, `project:node:home-body/${owner}::${row.ownerRecord}`, row, message);
    else {
      if (row.declare) h.declare(owner, row.declare as Record<string, never>);
      h.rule(owner, row.event, { opcode: "toast", message });
    }
    const user = userEvent.setup();
    await row.act(h, user);
    await waitFor(() => expect(h.toasts).toContain(message));
    h.view.unmount();
  });

  it.each(HIDDEN_ROWS.map((row) => [`${row.type}.${row.event}`, row] as const))(
    "hidden (Show all of RAC): %s",
    async (_name, row) => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const h = await openAdr280Preview([row.palette]);
      const owner = h.ids[0] as NodeId;
      const message = `${row.type}.${row.event}`;
      h.rule(owner, row.event, { opcode: "toast", message });
      await row.act(h, userEvent.setup());
      await waitFor(() => expect(h.toasts).toContain(message));
      h.view.unmount();
    },
  );

  it("every hidden press · hover · focus event has its target (static)", () => {
    expect(
      HIDDEN_ROWS.map((row) => row.type).filter((type) => !POINTER_TARGET[type]),
    ).toEqual([]);
  });

  it("the matrix has a row for every When the registry offers (static)", () => {
    const covered = new Set(ROWS.map((row) => `${row.type}.${row.event}`));
    // (A standalone Popover · Tooltip has no palette entry — the palette's is the trigger tree, the
    // DialogTrigger · TooltipTrigger rows; the same body type is the Modal row's path.)
    const exempt = new Set([
      "Popover.onOpenChange",
      "Tooltip.onOpenChange",
    ]);
    const offered = Object.entries(CAPABILITY_REGISTRY).flatMap(
      ([type, entry]) =>
        (entry.groups ?? []).flatMap((group) =>
          group.events.map((event) => `${type}.${event}`),
        ),
    );
    expect(
      offered.filter((name) => !covered.has(name) && !exempt.has(name)),
    ).toEqual([]);
  });
});

// ── Do: the capabilities the audit added reach RAC (the render result is the oracle) ──

/** The palette `type` plus a Button whose press runs `capabilityId` (value) on it. */
async function doRule(
  palette: string,
  capabilityId: string,
  value?: string | ((h: Harness) => string),
  declare?: Record<string, unknown>,
) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr280Preview([palette, "Button"]);
  const [target, button] = h.ids as [NodeId, NodeId];
  if (declare) h.declare(target, declare as Record<string, never>);
  const resolved = typeof value === "function" ? value(h) : value;
  h.rule(button, "onPress", {
    opcode: "capability",
    target: { nodeId: target },
    capabilityId,
    ...(resolved !== undefined ? { value: resolved } : {}),
  } as never);
  const user = userEvent.setup();
  return {
    ...h,
    target,
    press: () => press(user, h.element(button)),
    rule: (id: string, value?: string) =>
      h.rule(button, "onPress", {
        opcode: "capability",
        target: { nodeId: target },
        capabilityId: id,
        ...(value !== undefined ? { value } : {}),
      } as never),
  };
}

/** The hidden native `<select>`'s chosen option texts (RAC's `HiddenSelect` mirrors the value). */
const selectChosen = (h: Harness) =>
  qa<HTMLOptionElement>(h, "select option").filter((option) => option.selected).map(
    (option) => option.textContent,
  );

describe("RAC event audit — the added Do capabilities reach RAC", () => {
  it("Select (multiple) selectItem adds, deselectItem removes, clearSelection empties", async () => {
    const h = await doRule("Select", "selectItem", (harness) =>
      qa<HTMLOptionElement>(harness, "select option")[1]!.value,
      { selectionMode: "multiple" },
    );
    // (`rule` replaces the Button's rule — one capability per press.)
    const values = qa<HTMLOptionElement>(h, "select option").map((o) => o.value);
    await h.press();
    h.rule("selectItem", values[2]);
    await h.press();
    expect(selectChosen(h)).toEqual(["Aardvark", "Cat"]);
    h.rule("deselectItem", values[1]);
    await h.press();
    expect(selectChosen(h)).toEqual(["Cat"]);
    h.rule("clearSelection");
    await h.press();
    expect(selectChosen(h)).toEqual([]);
    h.view.unmount();
  });

  it("Select (single) selectItem replaces the selection", async () => {
    const h = await doRule("Select", "selectItem", (harness) =>
      qa<HTMLOptionElement>(harness, "select option")[1]!.value,
    );
    const values = qa<HTMLOptionElement>(h, "select option").map((o) => o.value);
    await h.press();
    expect(selectChosen(h)).toEqual(["Aardvark"]);
    h.rule("selectItem", values[2]);
    await h.press();
    expect(selectChosen(h)).toEqual(["Cat"]);
    h.rule("clearSelection");
    await h.press();
    // (Cleared — the hidden select's placeholder option is the chosen one.)
    expect(selectChosen(h).map((text) => text?.trim())).toEqual([""]);
    h.view.unmount();
  });

  it.each(["Calendar", "RangeCalendar"])("%s focusDate shows that month", async (palette) => {
    const h = await doRule(palette, "focusDate", "2030-01-15");
    await h.press();
    await waitFor(() =>
      expect(h.element(h.target)!.getAttribute("aria-label")).toContain("January 2030"),
    );
    h.view.unmount();
  });

  it("Tree collapseItem collapses that item only", async () => {
    // (Node 1 has child items — it expands; `collapseItem` takes it out of the expanded set.)
    const h = await doRule("Tree", "expand", "item-1");
    const expanded = () =>
      q(h, "[role=row][data-key=item-1]")?.getAttribute("aria-expanded");
    await h.press();
    expect(expanded()).toBe("true");
    h.rule("collapseItem", "item-1");
    await h.press();
    expect(expanded()).toBe("false");
    h.view.unmount();
  });

  it("DisclosureGroup collapseItem closes that Disclosure only", async () => {
    // (A DisclosureGroup's expansion keys are its Disclosures' records — the runtime's own key.)
    const h = await doRule("DisclosureGroup", "collapseItem", (harness) =>
      qa(harness, "[data-catalog-id]")
        .find((el) => el.querySelector(":scope > h3 button[slot=trigger]"))!
        .getAttribute("data-catalog-id")!,
    );
    await h.press();
    expect(
      qa(h, "button[slot=trigger]").map((button) => button.getAttribute("aria-expanded")),
    ).toEqual(["false", "true"]);
    h.view.unmount();
  });

  it("CheckboxGroup checkItem · uncheckItem", async () => {
    const h = await doRule("CheckboxGroup", "checkItem", (harness) =>
      qa<HTMLInputElement>(harness, "input[type=checkbox]").at(-1)!.value,
    );
    const boxes = () => qa<HTMLInputElement>(h, "input[type=checkbox]");
    const before = boxes().map((box) => box.checked);
    await h.press();
    expect(boxes().map((box) => box.checked)).toEqual([...before.slice(0, -1), true]);
    h.rule("uncheckItem", boxes().at(-1)!.value);
    await h.press();
    expect(boxes().at(-1)!.checked).toBe(false);
    h.view.unmount();
  });

  it("Disclosure toggleExpand twice", async () => {
    const h = await doRule("Disclosure", "toggleExpand");
    const expanded = () => q(h, "button[slot=trigger]")!.getAttribute("aria-expanded");
    const start = expanded();
    await h.press();
    expect(expanded()).not.toBe(start);
    await h.press();
    expect(expanded()).toBe(start);
    h.view.unmount();
  });

  it.each([
    ["Dialog", "[role=dialog]"],
    ["Select", "[role=listbox]"],
    ["Modal", ".react-aria-ModalOverlay"],
  ])("%s toggleOpen opens it", async (palette, open) => {
    const h = await doRule(palette, "toggleOpen");
    expect(inBody(open)).toBeNull();
    await h.press();
    await waitFor(() => expect(inBody(open)).not.toBeNull());
    h.view.unmount();
  });

  it("a palette Link (href #) press keeps the page — no 404 (the Preview router)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr280Preview(["Link"]);
    await press(userEvent.setup(), h.element(h.ids[0] as NodeId));
    expect(h.session.notFound).toBeUndefined();
    expect(h.element(h.ids[0] as NodeId)).not.toBeNull();
    h.view.unmount();
  });
});
