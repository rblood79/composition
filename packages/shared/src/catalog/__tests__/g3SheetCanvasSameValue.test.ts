import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compileRulePartRules } from "../document/rulePartRules";

/**
 * Values the G3 harness found on one consumer only (2026-11-27): each must be in the generated sheet
 * (Preview · Publish) as well as in what the Canvas reads.
 */

const SIZES = ["S", "M", "L", "XL"] as const;
const sheet = (name: string) =>
  readFileSync(
    new URL(`../../components/styles/generated/${name}.css`, import.meta.url),
    "utf8",
  );
/** The declarations of the first block whose selector is exactly `selector`. */
function block(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} in the sheet`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start));
}

describe("LabeledValue — the value's S2 default width (`fieldInput()`)", () => {
  const WIDTH = { S: 192, M: 208, L: 224, XL: 240 } as const;

  it("the generated sheet contains it per size", () => {
    const css = sheet("LabeledValue");
    for (const size of SIZES) {
      const declarations = block(
        css,
        `.react-aria-LabeledValue[data-size="${size}"] > .react-aria-Text[slot="value"]`,
      );
      expect(declarations).toContain("contain: inline-size;");
      expect(declarations).toContain(
        `contain-intrinsic-width: ${WIDTH[size]}px;`,
      );
    }
  });

  it("the Canvas part rule reads the same block", () => {
    const parts = compileRulePartRules("LabeledValue", () => undefined);
    for (const size of SIZES) {
      const layout = parts.find(
        (part) =>
          part.childType === "Text" &&
          part.childProps?.slot === "value" &&
          part.size === size &&
          part.layout.containIntrinsicWidth !== undefined,
      )?.layout;
      expect(layout, size).toMatchObject({
        contain: "inline-size",
        containIntrinsicWidth: `${WIDTH[size]}px`,
      });
    }
  });
});

describe("Meter · ProgressBar — the side label's column gap (S2 `bar-utils.ts` `columnGap: 12`)", () => {
  for (const name of ["Meter", "ProgressBar"])
    it(`${name}: every size block keeps column-gap 12 after its 4px gap`, () => {
      const css = sheet(name);
      for (const size of SIZES) {
        const declarations = block(
          css,
          `.react-aria-${name}[data-size="${size}"]`,
        );
        const gap = declarations.lastIndexOf("gap: 4px;");
        const columnGap = declarations.lastIndexOf("column-gap: 12px;");
        expect(gap, `${name}@${size} gap`).toBeGreaterThanOrEqual(0);
        // (`gap` is the shorthand: a later `column-gap` is what the column axis keeps.)
        expect(columnGap, `${name}@${size} column-gap`).toBeGreaterThan(gap);
      }
    });
});
