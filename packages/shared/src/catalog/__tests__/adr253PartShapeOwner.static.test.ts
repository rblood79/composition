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
 * control is still a trigger wrapper (ComboBox · NumberField · SearchField) follow with the Group ·
 * Button step, the `quiet` variant blocks with the quiet step.
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
});
