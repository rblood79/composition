import { describe, expect, it } from "vitest";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * ADR-253 G3 (정적): a part's shape is the part rule's — the rule of the component that holds the
 * part does not declare it. A parent says where the part sits (its `containerVariants` nested
 * selectors: width · flex · margin of the side label column), not what it looks like.
 *
 * Parts covered so far (Phase 3): Label · FieldError · Description — every one under a field · group
 * is an instance of its origin, sized by its own rule at its owner's size — and the Input of the
 * fields whose control is their Input node (TextField · TextArea · ColorField). The fields whose
 * control is a wrapper around part instances (ComboBox · NumberField · SearchField) and the date
 * fields (the DateInput origin) are covered below, and the `quiet` shape of a field's box (the
 * box part's own state).
 */
const LABEL_SELECTOR = ".react-aria-Label";
const PART_VARIABLES =
  /^--(label-(font-size|font-weight|line-height|margin|color)|error-(font-size|margin))$/;
/** Declarations a parent may give its Label: where it sits. */
const PLACEMENT_KEYS: ReadonlySet<string> = new Set([
  "width",
  "min-width",
  "max-width",
  "flex",
  "flex-basis",
  "flex-shrink",
  "flex-grow",
  "grid-area",
  "grid-column",
  "grid-row",
  "align-self",
  "justify-self",
  "text-align",
  // (The side column's alignment of the inline-flex Label's text — `text-align`'s twin.)
  "justify-content",
  "margin",
  "margin-top",
  "margin-bottom",
  "margin-inline-start",
  "margin-inline-end",
  "padding-top",
  "order",
]);

type Styles = Record<string, unknown>;
interface Nested {
  selector?: string;
  styles?: Styles;
}

describe("ADR-253 — a parent rule does not declare its parts' shape", () => {
  const rules = Object.entries(
    COMPONENT_RULES_TABLE as Record<
      string,
      { structure?: { composition?: Record<string, unknown> } }
    >,
  ).filter(([type]) => !["Label", "FieldError", "Description"].includes(type));
  /** Part → the selector token a parent reaches it with. */
  const PARTS: Record<string, string> = {
    Label: LABEL_SELECTOR,
    FieldError: ".react-aria-FieldError",
    Description: '[slot="description"]',
  };
  /**
   * Not a field part: a DropZone's description is its own composed content (the upload text
   * under its icon), drawn by the DropZone.
   */
  const OWN_CONTENT: ReadonlySet<string> = new Set(["DropZone Description"]);

  for (const [part, token] of Object.entries(PARTS))
    it(`no rule delegates declarations to its ${part}`, () => {
      const owners = rules.flatMap(([type, rule]) => {
        if (OWN_CONTENT.has(`${type} ${part}`)) return [];
        const delegation = rule.structure?.composition?.delegation;
        return Array.isArray(delegation) &&
          delegation.some(
            (entry: { childSelector?: unknown; bridges?: unknown }) =>
              typeof entry.childSelector === "string" &&
              // The owner's own part: one compound selector (`.react-aria-SelectValue
              // [slot="description"]` is the selected item's description inside the value).
              !/\S\s+\S/.test(entry.childSelector.replace(/,\s+/g, ",")) &&
              entry.childSelector
                .replace(/:not\([^)]*\)/g, "")
                .includes(token) &&
              // A declaration-only entry places the part (a side label field's per-size
              // `--{prefix}-gap`, read by the hint indent): it declares no property.
              entry.bridges !== undefined,
          )
          ? [type]
          : [];
      });
      expect(owners).toEqual([]);
    });

  it("a field whose control is its Input node only places it", () => {
    const found: string[] = [];
    for (const type of ["TextField", "TextArea", "ColorField"]) {
      const delegation = (
        COMPONENT_RULES_TABLE as Record<
          string,
          { structure?: { composition?: { delegation?: unknown } } }
        >
      )[type]?.structure?.composition?.delegation;
      for (const entry of (Array.isArray(delegation)
        ? delegation
        : []) as Array<{
        childSelector?: string;
        bridges?: Styles;
        states?: unknown;
      }>) {
        if (
          !/\.react-aria-(Input|TextArea)(?![\w-])/.test(
            entry.childSelector ?? "",
          )
        )
          continue;
        // The Input rule's own sheet declares its states (hover · focus · invalid · disabled).
        if (entry.states !== undefined)
          found.push(`${type} ${entry.childSelector} { states }`);
        for (const key of Object.keys(entry.bridges ?? {}))
          if (!PLACEMENT_KEYS.has(key) && key !== "box-sizing")
            found.push(`${type} ${entry.childSelector} { ${key} }`);
      }
    }
    expect(found).toEqual([]);
  });

  // A field whose control is a wrapper (its Group) around part instances — the Input and Button
  // origins': the wrapper and the parts are only placed (their size on the wrapper's axis is
  // placement — a stepper is a square of the control's height). No part shape, no part state.
  it("a field whose control is a wrapper only places the wrapper and its parts", () => {
    const WRAPPED_PLACEMENT = new Set([
      ...PLACEMENT_KEYS,
      "display",
      "align-items",
      "height",
      "box-sizing",
      // The room a part leaves for the one laid over it (a ComboBox's button over its Input's
      // end, a SearchField's glyph over its start).
      "padding-right",
      "padding-left",
    ]);
    const found: string[] = [];
    for (const type of ["NumberField", "ComboBox", "SearchField"]) {
      const composition = (
        COMPONENT_RULES_TABLE as Record<
          string,
          { structure?: { composition?: Record<string, unknown> } }
        >
      )[type]?.structure?.composition;
      const delegation = composition?.delegation;
      for (const entry of (Array.isArray(delegation)
        ? delegation
        : []) as Array<{
        childSelector?: string;
        bridges?: Styles;
        states?: unknown;
      }>) {
        if (
          !/\.(react-aria-(Group|Input|Button|Icon)|combobox-container|searchfield-container)(?![\w-])/.test(
            entry.childSelector ?? "",
          )
        )
          continue;
        if (entry.states !== undefined)
          found.push(`${type} ${entry.childSelector} { states }`);
        for (const key of Object.keys(entry.bridges ?? {}))
          if (!WRAPPED_PLACEMENT.has(key))
            found.push(`${type} ${entry.childSelector} { ${key} }`);
      }
      // The disabled field fades once, at its root: no variant re-paints the wrapper.
      const variants = composition?.containerVariants as
        Record<string, unknown> | undefined;
      if (variants?.disabled !== undefined)
        found.push(`${type} containerVariants.disabled`);
    }
    expect(found).toEqual([]);
  });

  // A date field's box is an instance of the DateInput origin: its field only places it (and a
  // picker its FieldButton). No DateInput shape and no DateSegment declaration in a field rule —
  // the DateInput rule's sheet has both. A DateRangePicker's Group is its box (the pair inside
  // carries none): the field turns the pair's focus ring off, the Group shows it.
  it("a date field only places its DateInput and its button", () => {
    const DATE_PLACEMENT = new Set([
      ...PLACEMENT_KEYS,
      "display",
      "align-items",
      "height",
      "box-sizing",
      "padding-right",
      "padding-left",
    ]);
    const PAIR_FOCUS_OFF = JSON.stringify({
      "[data-focus-within]": { outline: "none" },
    });
    const found: string[] = [];
    for (const type of [
      "DateField",
      "TimeField",
      "DatePicker",
      "DateRangePicker",
    ]) {
      const delegation = (
        COMPONENT_RULES_TABLE as Record<
          string,
          { structure?: { composition?: Record<string, unknown> } }
        >
      )[type]?.structure?.composition?.delegation;
      for (const entry of (Array.isArray(delegation)
        ? delegation
        : []) as Array<{
        childSelector?: string;
        bridges?: Styles;
        states?: unknown;
      }>) {
        const selector = entry.childSelector ?? "";
        if (/\.react-aria-DateSegment/.test(selector))
          found.push(`${type} ${selector}`);
        const placed =
          /\.react-aria-(DateInput|Button)(?![\w-])/.test(selector) ||
          (type === "DatePicker" && /\.react-aria-Group/.test(selector));
        if (!placed) continue;
        const pairFocusOff =
          type === "DateRangePicker" &&
          selector === ".react-aria-DateInput" &&
          JSON.stringify(entry.states) === PAIR_FOCUS_OFF;
        if (entry.states !== undefined && !pairFocusOff)
          found.push(`${type} ${selector} { states }`);
        for (const key of Object.keys(entry.bridges ?? {}))
          if (!DATE_PLACEMENT.has(key))
            found.push(`${type} ${selector} { ${key} }`);
      }
    }
    expect(found).toEqual([]);
  });

  /**
   * ADR-254: a container's title and description are instances of the Heading · Description
   * origins, drawn by their own rules (an InlineAlert's at its size, `CATALOG_SIZE_STEP`). The
   * container's rule declares neither their font (the generator's old `headingFontSize` ·
   * `descFontSize` size keys) nor a selector that reaches them.
   */
  it("a container rule does not declare its title's or description's shape", () => {
    const PART_SIZE_KEY = /^(heading|desc)[A-Z]/;
    const PART_SELECTOR =
      /react-aria-Heading|alert-heading|react-aria-Description|card-description|slot="description"/;
    const found: string[] = [];
    // (Not the Card — ADR-256 Phase 10, 사용자 결정 「S2 그대로」: its title · description are Text
    // nodes in its S2 Content, styled by the Card's `TextContext` as S2's — the Card rule's `[slot]`
    // selectors, not Heading · Description instances.)
    for (const type of [
      "Dialog",
      "Popover",
      "Content",
      "InlineAlert",
      "Tooltip",
    ]) {
      const rule = (
        COMPONENT_RULES_TABLE as unknown as Record<
          string,
          {
            sizes?: Record<string, Styles>;
            structure?: { composition?: unknown };
          }
        >
      )[type]!;
      for (const [size, values] of Object.entries(rule.sizes ?? {}))
        for (const key of Object.keys(values))
          if (PART_SIZE_KEY.test(key)) found.push(`${type} ${size}.${key}`);
      if (PART_SELECTOR.test(JSON.stringify(rule.structure?.composition ?? {})))
        found.push(`${type} composition`);
    }
    expect(found).toEqual([]);
  });

  it("no rule sets a part variable (`--label-*` · `--error-*`) on its element", () => {
    const found: string[] = [];
    const visit = (type: string, value: unknown, path: string) => {
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (PART_VARIABLES.test(key)) found.push(`${type}${path}.${key}`);
        visit(type, child, `${path}.${key}`);
      }
    };
    for (const [type, rule] of rules)
      visit(type, rule.structure?.composition, "");
    expect(found).toEqual([]);
  });

  it("a nested selector that reaches a part only places it", () => {
    const found: string[] = [];
    const visit = (type: string, value: unknown) => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        for (const entry of value as Nested[]) {
          const selector = entry?.selector;
          // `> .react-aria-Label` reaches the Label; `:not(.react-aria-Label, …)` reaches the rest.
          if (
            typeof selector === "string" &&
            Object.values(PARTS).some((token) =>
              selector.replace(/:not\([^)]*\)/g, "").includes(token),
            )
          )
            for (const key of Object.keys(entry.styles ?? {}))
              if (!PLACEMENT_KEYS.has(key))
                found.push(`${type} ${selector} { ${key} }`);
          visit(type, entry);
        }
        return;
      }
      for (const child of Object.values(value)) visit(type, child);
    };
    for (const [type, rule] of rules) visit(type, rule.structure?.composition);
    expect(found).toEqual([]);
  });

  /**
   * RSP `isQuiet`: the underline shape of a quiet field's box is the box part's own state
   * (`&[data-quiet]` in the Input · DateInput rule) — one definition. No field rule repeats it for
   * the part (a Select's trigger and a range picker's Group are those fields' own boxes).
   */
  it("the quiet shape of a field's box is the box part's state", () => {
    const found: string[] = [];
    for (const [type, rule] of rules) {
      const variants = (
        rule.structure?.composition as
          { containerVariants?: Record<string, unknown> } | undefined
      )?.containerVariants;
      const text = JSON.stringify(variants?.quiet ?? {});
      for (const token of [".react-aria-Input", ".react-aria-DateInput"])
        if (text.includes(token)) found.push(`${type} quiet ${token}`);
    }
    expect(found).toEqual([]);
    for (const [type, focus] of [
      ["Input", "data-focused"],
      ["DateInput", "data-focus-within"],
    ] as const) {
      const selectors = (
        (COMPONENT_RULES_TABLE as Record<string, (typeof rules)[number][1]>)[
          type
        ].structure?.composition as
          { rootSelectors?: Record<string, { styles?: Styles }> } | undefined
      )?.rootSelectors;
      expect(selectors?.["&[data-quiet]"]?.styles).toMatchObject({
        background: "transparent",
        "border-bottom": "1px solid var(--border)",
        "border-radius": "0",
      });
      expect(
        selectors?.[`&[data-quiet][${focus}]`]?.styles?.["border-bottom-color"],
      ).toBe("var(--accent)");
      expect(
        selectors?.["&[data-quiet][data-invalid]"]?.styles?.[
          "border-bottom-color"
        ],
      ).toBe("var(--negative)");
    }
  });
});
