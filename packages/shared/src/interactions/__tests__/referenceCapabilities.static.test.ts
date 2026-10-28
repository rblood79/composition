import { describe, expect, it } from "vitest";
import { declaredRefusal } from "../constraints";
import { COMPONENT_RULES_TABLE } from "../../catalog/generated/componentRulesTable";
import {
  CATALOG_D2_COMMON_PROVENANCE,
  CATALOG_D2_PROVENANCE,
} from "../../catalog/document/d2Provenance";
import { deriveOptions } from "../../catalog/outputs/editFields";
import {
  CAPABILITY_REGISTRY,
  resolveCapabilities,
  type CapabilityDef,
} from "../capabilityRegistry";
import { catalogAccepts, isExcludedProp } from "../referenceCapabilities";
import {
  readReferenceFiles,
  REFERENCE_DIRS,
  type ReferenceRow,
} from "./support/referenceApiTables";
import { DEFERRED_REFERENCE_PROPS } from "./support/deferredReferenceProps";

/**
 * ADR-287 G1 — the reference API tables are the oracle of the derived Do (Decision 8). The derived
 * layer reads the binding `accepts`; this reads the tables (outside the code) and checks the two meet:
 *
 * (a) every row of a type's oracle (RAC table ∪ S2 table − excluded − deferred) has a Do on that prop
 * (b) every derived Do's prop is a row of its type's tables, or a `d2Provenance` extension
 * (c) the 25 display components have a Do of their own (30 − Nav · Pagination · Section · Slot — no
 *     writable prop — − Image, user decision 4)
 * (d) a `choice` Do has choices, inside the table's literal union
 * (e) no derived Do writes a prop a concept writes
 * (g) the deferred list only shrinks (a fixed row that gains a Do is removed from it)
 */

/** composition type → its S2 component's name (as `d2S2Alignment.static.test.ts`'s `S2_ALIAS`). */
const S2_NAME: Readonly<Record<string, string>> = {
  body: "Provider",
  Select: "Picker",
  GridList: "ListView",
  GridListItem: "ListViewItem",
  Tree: "TreeView",
  TreeItem: "TreeViewItem",
  TreeItemContent: "TreeViewItemContent",
  ListBoxItem: "PickerItem",
  ListBoxSection: "PickerSection",
  Separator: "Divider",
  DisclosureGroup: "Accordion",
  Table: "TableView",
};

/**
 * React's `HTMLAttributes` (the global HTML · RDFa · microdata attributes) — a RAC table lists them for
 * every component that renders a DOM element (`DOMProps` · `GlobalDOMAttributes`; a TextArea · Group ·
 * OverlayArrow table prints the whole set). The catalog's D2 surface does not carry them
 * (`d2S2Alignment` checks accepts ⊆ API, not the reverse; widening accepts is outside ADR-287 — M5).
 */
const DOM_GLOBAL_PROPS: ReadonlySet<string> = new Set([
  // HTML global attributes
  "accessKey",
  "autoCapitalize",
  "autoCorrect",
  "autoSave",
  "children",
  "color",
  "content",
  "contentEditable",
  "contextMenu",
  "dangerouslySetInnerHTML",
  "dir",
  "draggable",
  "enterKeyHint",
  "exportparts",
  "hidden",
  "inert",
  "inputMode",
  "is",
  "lang",
  "nonce",
  "part",
  "popover",
  "popoverTarget",
  "popoverTargetAction",
  "radioGroup",
  "render",
  "results",
  "role",
  "security",
  "spellCheck",
  "suppressContentEditableWarning",
  "suppressHydrationWarning",
  "tabIndex",
  "title",
  "translate",
  "unselectable",
  // RDFa
  "about",
  "datatype",
  "inlist",
  "prefix",
  "property",
  "rel",
  "resource",
  "rev",
  "typeof",
  "vocab",
  // microdata
  "itemID",
  "itemProp",
  "itemRef",
  "itemScope",
  "itemType",
]);

/**
 * A snapshot table that does not describe the component (`(b)` cannot use it): S2 `TextArea.md`'s
 * table is the HTML `textarea` attribute set — no `label` · `description` · `isRequired` …, while the
 * installed S2 `TextArea` takes `TextFieldProps` (the D2 gate reads the installed types and passes).
 */
const SNAPSHOT_TABLE_DEFECTS: Readonly<Record<string, string>> = {
  TextArea:
    "S2 스냅샷 표 = HTML textarea 속성 — 설치 d.ts 는 TextFieldProps (d2S2Alignment 통과)",
};

/**
 * Choices the panel offers that the table's literal union lacks — the D3 rule's own steps (`deriveOptions`
 * reads `rule.sizes` · `rule.variants`, which the D2 gate does not see: it checks `accepts.options`).
 * Pre-existing catalog extensions, listed so a new one is a RED.
 */
const CHOICE_EXTENSIONS: Readonly<Record<string, string>> = {
  'Badge.size = "XS"': "rule sizes XS (composition size 단계)",
  'Button.size = "XS"': "rule sizes XS (composition size 단계)",
  'ButtonGroup.size = "XS"': "rule sizes XS (composition size 단계)",
  'ColorField.size = "XS"': "rule sizes XS (composition size 단계)",
  'ComboBox.size = "XS"': "rule sizes XS (composition size 단계)",
  'DatePicker.size = "XS"': "rule sizes XS (composition size 단계)",
  'DateRangePicker.size = "XS"': "rule sizes XS (composition size 단계)",
  'Dialog.size = "XS"': "rule sizes XS (composition size 단계)",
  'NumberField.size = "XS"': "rule sizes XS (composition size 단계)",
  'Select.size = "XS"': "rule sizes XS (composition size 단계)",
  'TextField.size = "XS"': "rule sizes XS (composition size 단계)",
  'Breadcrumbs.size = "S"': "rule sizes S (S2 는 M · L)",
  'GridList.layout = "waterfall"': "composition layout (RAC GridList 는 stack · grid)",
};

function tablesByName(dir: string): Map<string, ReferenceRow[]> {
  const out = new Map<string, ReferenceRow[]>();
  for (const file of readReferenceFiles(dir))
    for (const [name, rows] of file.tables)
      if (!out.has(name)) out.set(name, rows);
  return out;
}
const RAC = tablesByName(REFERENCE_DIRS.rac);
const S2 = tablesByName(REFERENCE_DIRS.s2);

/** A type's oracle rows: its RAC table ∪ its S2 table (RAC is behavior · state, S2 the visual axes). */
function oracleOf(type: string): Map<string, ReferenceRow> | undefined {
  const rac = RAC.get(type);
  const s2 = S2.get(S2_NAME[type] ?? type);
  if (!rac && !s2) return undefined;
  const rows = new Map<string, ReferenceRow>();
  for (const row of [...(s2 ?? []), ...(rac ?? [])])
    if (!rows.has(row.prop)) rows.set(row.prop, row);
  return rows;
}

const isDerived = (def: CapabilityDef) =>
  def.racRef.startsWith("catalog binding ");

const ACCEPTS = catalogAccepts();

/** The props a type's Do write (concept or derived). */
function writtenProps(type: string): Set<string> {
  return new Set(
    Object.values(CAPABILITY_REGISTRY[type]?.capabilities ?? {}).map(
      (def) => def.prop,
    ),
  );
}

/** Every oracle row of every catalog type that no Do writes, before the deferred list. */
function missingRows(): string[] {
  const out: string[] = [];
  for (const type of ACCEPTS.keys()) {
    const oracle = oracleOf(type);
    if (!oracle) continue;
    const written = writtenProps(type);
    for (const prop of oracle.keys()) {
      if (isExcludedProp(prop) || DOM_GLOBAL_PROPS.has(prop)) continue;
      if (!written.has(prop)) out.push(`${type}.${prop}`);
    }
  }
  return out.sort();
}

describe("ADR-287 G1 — derived Do vs the reference API tables", () => {
  it("(a) · (g) every oracle row has a Do or is deferred, and the deferred list holds no fixed row", () => {
    const missing = missingRows();
    const deferred = new Set(Object.keys(DEFERRED_REFERENCE_PROPS));
    expect(missing.filter((key) => !deferred.has(key))).toEqual([]);
    expect([...deferred].filter((key) => !missing.includes(key))).toEqual([]);
    // (The count is the ratchet — a new table row without a Do is a RED above, not a new entry.)
    expect(deferred.size).toBe(385);
  });

  it("(b) a derived Do's prop is a row of its type's tables, or a d2Provenance extension", () => {
    const stray: string[] = [];
    for (const [type, entry] of Object.entries(CAPABILITY_REGISTRY)) {
      const oracle = oracleOf(type);
      if (!oracle || SNAPSHOT_TABLE_DEFECTS[type]) continue;
      for (const def of Object.values(entry.capabilities)) {
        if (!isDerived(def) || oracle.has(def.referenceProp ?? def.prop))
          continue;
        if (CATALOG_D2_COMMON_PROVENANCE[def.prop]) continue;
        if (CATALOG_D2_PROVENANCE[type]?.[def.prop]) continue;
        stray.push(`${type}.${def.prop}`);
      }
    }
    expect([...new Set(stray)].sort()).toEqual([]);
  });

  it("(c) the 25 display components have a Do of their own", () => {
    const DISPLAY = [
      "Meter",
      "ProgressBar",
      "ProgressCircle",
      "Badge",
      "StatusLight",
      "Text",
      "Keyboard",
      "Icon",
      "Avatar",
      "AvatarGroup",
      "InlineAlert",
      "Skeleton",
      "Card",
      "Button",
      "Link",
      "ButtonGroup",
      "Breadcrumbs",
      "DropZone",
      "FileTrigger",
      "FileUpload",
      "Chart",
      "Dialog",
      "IllustratedMessage",
      "Separator",
      "Toolbar",
    ];
    expect(DISPLAY).toHaveLength(25);
    const without = DISPLAY.filter(
      (type) =>
        !Object.values(resolveCapabilities(type)).some(
          (def) => def.prop !== "style.display",
        ),
    );
    expect(without).toEqual([]);
    // (The user's report — a Meter's value — by name.)
    expect(resolveCapabilities("Meter").setValue).toMatchObject({
      prop: "value",
      value: "!param",
      param: { kind: "number" },
    });
  });

  it("(d) a choice Do has choices, and each is in the table's literal union", () => {
    const empty: string[] = [];
    const outside: string[] = [];
    for (const [type, entry] of Object.entries(CAPABILITY_REGISTRY))
      for (const def of Object.values(entry.capabilities)) {
        if (def.param?.kind !== "choice") continue;
        const contract = ACCEPTS.get(type)?.[def.prop];
        const options =
          contract &&
          deriveOptions(
            contract,
            COMPONENT_RULES_TABLE[type as keyof typeof COMPONENT_RULES_TABLE],
            { type } as never,
            def.prop,
          );
        if (!options?.length) {
          empty.push(`${type}.${def.prop}`);
          continue;
        }
        const row = oracleOf(type)?.get(def.prop);
        const literals = [...(row?.type.matchAll(/"([^"]*)"/g) ?? [])].map(
          (match) => match[1],
        );
        if (!literals.length) continue;
        for (const option of options)
          if (option.value !== "" && !literals.includes(option.value))
            outside.push(`${type}.${def.prop} = "${option.value}"`);
      }
    expect(empty).toEqual([]);
    expect(outside.sort()).toEqual(Object.keys(CHOICE_EXTENSIONS).sort());
  });

  it("(e) no derived Do writes a prop a concept of the same type writes", () => {
    const twice: string[] = [];
    for (const [type, entry] of Object.entries(CAPABILITY_REGISTRY)) {
      const defs = Object.values(entry.capabilities);
      const conceptProps = new Set(
        defs.filter((def) => !isDerived(def)).map((def) => def.prop),
      );
      for (const def of defs)
        if (isDerived(def) && conceptProps.has(def.prop))
          twice.push(`${type}.${def.prop}`);
    }
    expect(twice).toEqual([]);
  });

  it("a derived Do writes an accepted prop (the D2 gate binds accepts to the installed types)", () => {
    for (const [type, entry] of Object.entries(CAPABILITY_REGISTRY))
      for (const def of Object.values(entry.capabilities))
        if (isDerived(def))
          expect(
            ACCEPTS.get(type)?.[def.referenceProp ?? def.prop],
            `${type}.${def.prop}`,
          ).toBeDefined();
  });

  it("the own disabled · read-only Do are refused by an ancestor only (M4)", () => {
    const own = resolveCapabilities("Button").isDisabledOff;
    expect(own?.guards).toEqual(["inherited:isDisabled"]);
    expect(resolveCapabilities("TextField").isReadOnlyOff?.guards).toEqual([
      "inherited:isReadOnly",
    ]);
  });
});

describe("ADR-287 M4 — the guard tokens", () => {
  it("`inherited:isDisabled` refuses an ancestor's disabled only — the node's own release passes", () => {
    const own = { isDisabled: true };
    expect(
      declaredRefusal(["inherited:isDisabled"], own, { isDisabled: true }),
    ).toBe("isDisabled");
    expect(declaredRefusal(["inherited:isDisabled"], own, {})).toBeUndefined();
    expect(
      declaredRefusal(["inherited:isReadOnly"], { isReadOnly: true }, {}),
    ).toBeUndefined();
    expect(
      declaredRefusal(["inherited:isReadOnly"], {}, { isReadOnly: true }),
    ).toBe("isReadOnly");
  });

  it("(regression) an input Do's `isDisabled` still refuses the node's own disabled", () => {
    expect(declaredRefusal(["isDisabled"], { isDisabled: true }, {})).toBe(
      "isDisabled",
    );
  });
});
