import { describe, expect, it } from "vitest";
import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";

/**
 * ADR-253 G3 (정적): a part's shape is the part rule's — the rule of the component that holds the
 * part does not declare it. A parent says where the part sits (its `containerVariants` nested
 * selectors: width · flex · margin of the side label column), not what it looks like.
 *
 * Parts covered so far: Label (Phase 3 — every Label under a field · group is an instance of the
 * Label origin, sized by the Label rule at its owner's size).
 */
const LABEL_SELECTOR = ".react-aria-Label";
const LABEL_VARIABLES =
  /^--label-(font-size|font-weight|line-height|margin|color)$/;
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

describe("ADR-253 — a parent rule does not declare its Label's shape", () => {
  const rules = Object.entries(
    COMPONENT_RULES_TABLE as Record<
      string,
      { structure?: { composition?: Record<string, unknown> } }
    >,
  ).filter(([type]) => type !== "Label");

  it("no rule delegates to `.react-aria-Label`", () => {
    const owners = rules.flatMap(([type, rule]) => {
      const delegation = rule.structure?.composition?.delegation;
      return Array.isArray(delegation) &&
        delegation.some(
          (entry: { childSelector?: unknown }) =>
            typeof entry.childSelector === "string" &&
            entry.childSelector.includes(LABEL_SELECTOR) &&
            !entry.childSelector.includes(":not("),
        )
        ? [type]
        : [];
    });
    expect(owners).toEqual([]);
  });

  it("no rule sets a Label variable (`--label-*`) on its element", () => {
    const found: string[] = [];
    const visit = (type: string, value: unknown, path: string) => {
      if (!value || typeof value !== "object") return;
      for (const [key, child] of Object.entries(value)) {
        if (LABEL_VARIABLES.test(key)) found.push(`${type}${path}.${key}`);
        visit(type, child, `${path}.${key}`);
      }
    };
    for (const [type, rule] of rules)
      visit(type, rule.structure?.composition, "");
    expect(found).toEqual([]);
  });

  it("a nested selector that reaches the Label only places it", () => {
    const found: string[] = [];
    const visit = (type: string, value: unknown) => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        for (const entry of value as Nested[]) {
          const selector = entry?.selector;
          // `> .react-aria-Label` reaches the Label; `:not(.react-aria-Label, …)` reaches the rest.
          if (
            typeof selector === "string" &&
            selector.replace(/:not\([^)]*\)/g, "").includes(LABEL_SELECTOR)
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
