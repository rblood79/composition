import { describe, expect, it } from "vitest";
import { CAPABILITY_REGISTRY } from "../capabilityRegistry";
import { COMPONENT_INTERACTION_SPECS } from "../componentInteractionSpecs";

/**
 * ADR-280 G1 — the derived registry covers the hand registry it replaced (2026-10-22, main
 * `597941225` `capabilityRegistry.ts:138-452`): same keys · events · capability names · props,
 * with exactly two listed exceptions (R1).
 */
interface HandEntry {
  events: readonly string[];
  /** capability → prop */
  capabilities: Readonly<Record<string, string>>;
  deferred?: readonly string[];
}

const HAND_REGISTRY: Readonly<Record<string, HandEntry>> = {
  Button: { events: ["onPress"], capabilities: {} },
  Link: { events: ["onPress"], capabilities: {} },
  FileTrigger: { events: ["onSelect"], capabilities: {} },
  DropZone: { events: ["onDrop"], capabilities: {} },
  Tree: {
    events: ["onSelectionChange", "onExpandedChange"],
    capabilities: {
      selectItem: "selectedKeys",
      clearSelection: "selectedKeys",
      expand: "expandedKeys",
      collapse: "expandedKeys",
    },
  },
  TagGroup: {
    events: ["onSelectionChange", "onRemove"],
    capabilities: {
      selectItem: "selectedKeys",
      clearSelection: "selectedKeys",
    },
  },
  Modal: {
    events: ["onOpenChange"],
    capabilities: { open: "isOpen", close: "isOpen" },
  },
  ListBox: {
    events: ["onSelectionChange"],
    capabilities: {
      selectItem: "defaultSelectedKeys",
      clearSelection: "defaultSelectedKeys",
    },
  },
  GridList: {
    events: ["onSelectionChange"],
    capabilities: {
      selectItem: "defaultSelectedKeys",
      clearSelection: "defaultSelectedKeys",
    },
  },
  Checkbox: {
    events: ["onChange"],
    capabilities: {
      check: "isSelected",
      uncheck: "isSelected",
      toggleCheck: "isSelected",
    },
  },
  ToggleButton: {
    events: ["onChange"],
    capabilities: {
      check: "isSelected",
      uncheck: "isSelected",
      toggleCheck: "isSelected",
    },
  },
  RadioGroup: { events: ["onChange"], capabilities: { setValue: "value" } },
  Slider: {
    events: ["onChange", "onChangeEnd"],
    capabilities: { setValue: "value" },
  },
  Tabs: {
    events: ["onSelectionChange"],
    capabilities: { selectTab: "defaultSelectedKey" },
  },
  Disclosure: {
    events: ["onExpandedChange"],
    capabilities: { expand: "isExpanded", collapse: "isExpanded" },
  },
  Form: {
    events: ["onSubmit", "onReset"],
    capabilities: { submit: "", reset: "" },
  },
  Select: {
    events: ["onSelectionChange", "onOpenChange"],
    capabilities: {},
    deferred: ["selectItem", "clearSelection", "open", "close"],
  },
  ComboBox: {
    events: ["onSelectionChange", "onInputChange", "onOpenChange"],
    capabilities: {},
    deferred: ["selectItem", "clearSelection", "setInput"],
  },
  TextField: {
    events: ["onChange"],
    capabilities: {},
    deferred: ["setValue", "clear"],
  },
  NumberField: {
    events: ["onChange"],
    capabilities: {},
    deferred: ["setValue", "clear"],
  },
  SearchField: {
    events: ["onChange", "onSubmit"],
    capabilities: {},
    deferred: ["setValue", "clear"],
  },
  Switch: {
    events: ["onChange"],
    capabilities: {},
    deferred: ["check", "uncheck", "toggleCheck"],
  },
  Table: {
    events: ["onSelectionChange"],
    capabilities: {},
    deferred: ["selectItem", "clearSelection"],
  },
  DisclosureGroup: {
    events: ["onExpandedChange"],
    capabilities: {},
    deferred: ["expand", "collapse"],
  },
  DatePicker: {
    events: ["onChange"],
    capabilities: {},
    deferred: ["setValue", "open", "close"],
  },
  Calendar: { events: ["onChange"], capabilities: {}, deferred: ["setValue"] },
  Popover: {
    events: ["onOpenChange"],
    capabilities: {},
    deferred: ["open", "close"],
  },
  Menu: {
    events: ["onAction", "onOpenChange"],
    capabilities: {},
    deferred: ["open", "close"],
  },
};

/**
 * Exception 1 — owner moved (Decision 3 · Phase 0 probe P1): a Menu has no open state in RAC
 * (`MenuProps` lacks `onOpenChange` · `isOpen`) — its open concept is the MenuTrigger's.
 */
const OWNER_MOVED: readonly string[] = [
  "Menu.events.onOpenChange",
  "Menu.deferred.open",
  "Menu.deferred.close",
];

/**
 * Exception 3 — a name RAC deprecated (RAC event audit 2026-10-26): RAC 1.22 Select's selection is
 * `value` · `onChange` (S2 Picker's); `onSelectionChange` is single-only and stays derived, hidden.
 */
const DEPRECATED_HIDDEN: readonly string[] = ["Select.events.onSelectionChange"];

/**
 * Exception 2 — `default*` → controlled transition (Decision 4 · R1): the capability writes the
 * concept's controlled prop once Phase 2 makes the binding controlled. Until then the spec's
 * `legacyProp` keeps the old prop; G1 pins both ends of each pair.
 */
const CONTROLLED_PROP_TRANSITIONS = [
  {
    type: "ListBox",
    capability: "selectItem",
    from: "defaultSelectedKeys",
    to: "selectedKeys",
  },
  {
    type: "ListBox",
    capability: "clearSelection",
    from: "defaultSelectedKeys",
    to: "selectedKeys",
  },
  {
    type: "GridList",
    capability: "selectItem",
    from: "defaultSelectedKeys",
    to: "selectedKeys",
  },
  {
    type: "GridList",
    capability: "clearSelection",
    from: "defaultSelectedKeys",
    to: "selectedKeys",
  },
  {
    type: "Tabs",
    capability: "selectTab",
    from: "defaultSelectedKey",
    to: "selectedKey",
  },
] as const;

describe("ADR-280 G1 — the derived registry covers the hand registry", () => {
  it("every hand type · event · capability · deferred key is derived (owner moves excepted)", () => {
    const missing: string[] = [];
    for (const [type, hand] of Object.entries(HAND_REGISTRY)) {
      const derived = CAPABILITY_REGISTRY[type];
      if (!derived) {
        missing.push(type);
        continue;
      }
      for (const event of hand.events)
        if (!derived.events.includes(event)) {
          missing.push(`${type}.events.${event}`);
          if (DEPRECATED_HIDDEN.includes(`${type}.events.${event}`))
            expect(derived.hiddenEvents).toContain(event);
        }
      for (const name of Object.keys(hand.capabilities))
        if (!derived.capabilities[name])
          missing.push(`${type}.capabilities.${name}`);
      // (A hand-deferred key is derived — deferred until Phase 2, a capability after: G2.)
      for (const name of hand.deferred ?? [])
        if (!derived.deferred?.includes(name) && !derived.capabilities[name])
          missing.push(`${type}.deferred.${name}`);
    }
    expect(missing).toEqual([...DEPRECATED_HIDDEN, ...OWNER_MOVED]);
  });

  it("every hand capability keeps its prop, except the listed transitions", () => {
    const changed: string[] = [];
    for (const [type, hand] of Object.entries(HAND_REGISTRY))
      for (const [name, prop] of Object.entries(hand.capabilities)) {
        const derived = CAPABILITY_REGISTRY[type]?.capabilities[name];
        if (derived && derived.prop !== prop)
          changed.push(`${type}.${name}: ${prop} → ${derived.prop}`);
      }
    const transitions = CONTROLLED_PROP_TRANSITIONS.filter(
      (row) =>
        CAPABILITY_REGISTRY[row.type]?.capabilities[row.capability]?.prop ===
        row.to,
    ).map((row) => `${row.type}.${row.capability}: ${row.from} → ${row.to}`);
    expect(changed).toEqual(transitions);
  });

  it("each transition pair: the hand prop and the concept's controlled prop", () => {
    for (const row of CONTROLLED_PROP_TRANSITIONS) {
      expect(HAND_REGISTRY[row.type]!.capabilities[row.capability]).toBe(
        row.from,
      );
      const use = (
        COMPONENT_INTERACTION_SPECS as Record<
          string,
          { concepts: readonly { concept: { state?: { prop: string } } }[] }
        >
      )[row.type]!.concepts.find((item) => item.concept.state);
      expect(use?.concept.state?.prop).toBe(row.to);
      expect([row.from, row.to]).toContain(
        CAPABILITY_REGISTRY[row.type]!.capabilities[row.capability]!.prop,
      );
    }
  });

  it("every capability names its RAC concept and d.ts type (racRef)", () => {
    // (ADR-287 — a reference API Do names its binding accepts entry instead.)
    for (const [type, entry] of Object.entries(CAPABILITY_REGISTRY))
      for (const [name, def] of Object.entries(entry.capabilities))
        expect(def.racRef, `${type}.${name}`).toMatch(
          /^concepts\/\w+\.ts satisfies \w|^catalog binding \w+\.accepts\.\w/,
        );
  });

  it("every state capability carries its concept's guards (Decision 8)", () => {
    const without = Object.entries(CAPABILITY_REGISTRY).flatMap(
      ([type, entry]) =>
        Object.entries(entry.capabilities)
          // (ADR-287 — a reference API Do is a display prop: no RAC condition stops writing it.)
          .filter(
            ([, def]) =>
              !def.imperative &&
              !def.guards?.length &&
              !def.racRef.startsWith("catalog binding "),
          )
          .map(([name]) => `${type}.${name}`),
    );
    // (Table sort and a ColorSwatchPicker's value have no RAC condition — a Table restricts
    // sorting per Column, a swatch picker per item. ADR-281: a page root's · frame's inherited
    // props are not a RAC component's state — nothing restricts writing them.)
    expect(
      without.filter((name) => !/^(body|frame)\./.test(name)),
    ).toEqual([
      "ColorSwatchPicker.setValue",
      "Table.sort",
      // (RAC restricts a calendar's focused date with nothing — `focusedValue` moves when disabled.)
      "Calendar.focusDate",
      "RangeCalendar.focusDate",
    ]);
  });

  it("an item offers its own onAction only (its press · hover · focus are hidden); keyboard is never offered (Q3)", () => {
    // (RAC event audit 2026-10-26 — an item's `onAction` is RAC's item callback, offered on the
    // item node; the state events stay the collection's.)
    for (const type of [
      "ListBoxItem",
      "GridListItem",
      "TreeItem",
      "Row",
      "Tag",
      "MenuItem",
    ]) {
      expect(CAPABILITY_REGISTRY[type]?.events, type).toEqual(["onAction"]);
      expect(CAPABILITY_REGISTRY[type]?.hiddenEvents, type).toContain("onPress");
    }
    for (const type of ["Tab", "Radio"])
      expect(CAPABILITY_REGISTRY[type]?.events, type).toEqual([]);
    for (const [type, entry] of Object.entries(CAPABILITY_REGISTRY))
      expect(entry.events, type).not.toContain("onKeyDown");
  });

  it("the registry is frozen (derived once at module load)", () => {
    expect(Object.isFrozen(CAPABILITY_REGISTRY)).toBe(true);
    expect(Object.isFrozen(CAPABILITY_REGISTRY.Tree)).toBe(true);
  });
});

describe("ADR-280 G1 — IMPLICIT_STATE_SOURCES is derived from the same concepts", () => {
  /** The hand table it replaced (`state/implicitState.ts:20-37`, main `597941225`). */
  const HAND = {
    Tree: [
      ["selectedKeys", "onSelectionChange", "array"],
      ["expandedKeys", "onExpandedChange", "array"],
    ],
    TagGroup: [["selectedKeys", "onSelectionChange", "array"]],
    ListBox: [["selectedKeys", "onSelectionChange", "array"]],
    GridList: [["selectedKeys", "onSelectionChange", "array"]],
    Checkbox: [["isSelected", "onChange", "boolean"]],
    ToggleButton: [["isSelected", "onChange", "boolean"]],
    Switch: [["isSelected", "onChange", "boolean"]],
    RadioGroup: [["value", "onChange", "string"]],
    Slider: [["value", "onChange", "number"]],
    Tabs: [["selectedKey", "onSelectionChange", "string"]],
    Disclosure: [["isExpanded", "onExpandedChange", "boolean"]],
  } as const;

  it("every hand type keeps its sources (prop · event · type)", async () => {
    const { IMPLICIT_STATE_SOURCES } =
      await import("../../state/implicitState");
    for (const [type, rows] of Object.entries(HAND))
      expect(
        IMPLICIT_STATE_SOURCES[type]?.map((source) => [
          source.prop,
          source.event,
          source.type,
        ]),
        type,
      ).toEqual(rows);
  });

  it("each source is a concept's state prop and its change callback", async () => {
    const { IMPLICIT_STATE_SOURCES } =
      await import("../../state/implicitState");
    for (const [type, sources] of Object.entries(IMPLICIT_STATE_SOURCES))
      for (const source of sources) {
        const entry = CAPABILITY_REGISTRY[type];
        expect(
          [...(entry?.events ?? []), ...(entry?.hiddenEvents ?? [])],
          `${type}.${source.prop}`,
        ).toContain(source.event);
      }
  });
});
