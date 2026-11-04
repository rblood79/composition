/**
 * Every catalog overlay scrim reads the one `overlay-backdrop` token (S2 1.8.1 `transparent-black-500`
 * — Modal's underlay and Toast's expanded list both paint it): a component points at the token, it
 * does not write its own black.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { darkColors, lightColors } from "@composition/rendering";

const STYLES = resolve(__dirname, "../../components/styles");

function declarationsOf(css: string, selector: string): string {
  const at = css.indexOf(`${selector} {`);
  expect(at, `${selector} block`).toBeGreaterThanOrEqual(0);
  return css.slice(at, css.indexOf("}", at));
}

describe("overlay scrim = overlay-backdrop token", () => {
  it("the token is S2's underlay in both color modes", () => {
    expect(lightColors["overlay-backdrop"]).toBe("#00000070");
    expect(darkColors["overlay-backdrop"]).toBe("#00000070");
  });

  it("Toast's expanded-list scrim reads the token", () => {
    const block = declarationsOf(
      readFileSync(resolve(STYLES, "Toast.css"), "utf8"),
      ".catalog-toast-backdrop",
    );
    expect(block).toContain("background-color: var(--overlay-backdrop)");
  });
});
