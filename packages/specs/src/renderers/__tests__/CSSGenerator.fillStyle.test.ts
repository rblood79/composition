import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { ComponentSpec } from "../../types/spec.types";
import type { TokenRef } from "../../types/token.types";
import { generateCSS } from "../CSSGenerator";
import { variantToVisual } from "../utils/resolveComponentVisual";

const here = dirname(fileURLToPath(import.meta.url));

function makeFillStyleSpec(): ComponentSpec {
  return {
    name: "TestBadge",
    archetype: "simple",
    element: "span",
    defaultVariant: "accent",
    defaultSize: "sm",
    variants: {
      accent: {
        fill: {
          default: { base: "{color.accent}" as TokenRef },
          subtle: { base: "{color.accent-subtle}" as TokenRef },
        },
        text: "{color.on-accent}" as TokenRef,
        border: "{color.transparent}" as TokenRef,
        subtleText: "{color.accent}" as TokenRef,
      },
    },
    sizes: {
      sm: {
        height: 0,
        paddingX: 8,
        paddingY: 2,
        fontSize: "{typography.text-xs}" as TokenRef,
        lineHeight: "{typography.text-xs--line-height}" as TokenRef,
        borderRadius: "{radius.full}" as TokenRef,
        borderWidth: 1,
      },
    },
  } as ComponentSpec;
}

describe("CSSGenerator fillStyle", () => {
  it("subtle fill이 outline과 같은 1px box footprint를 유지한다", () => {
    const spec = makeFillStyleSpec();
    const visual = variantToVisual(spec.variants!.accent);

    const css = generateCSS(spec, { accent: visual }) ?? "";
    const subtleRule = css.match(
      /\[data-fill-style="subtle"\] \{([\s\S]*?)\n\}/,
    )?.[1];

    expect(subtleRule).toContain("border-color: transparent;");
    expect(subtleRule).not.toContain("border: none;");
  });

  it("Badge의 variant/fill/size 선택자는 generated CSS만 소유한다", () => {
    const manualCss = readFileSync(
      resolve(here, "../../../../shared/src/components/styles/Badge.css"),
      "utf8",
    );

    const generatedCss = readFileSync(
      resolve(
        here,
        "../../../../shared/src/components/styles/generated/Badge.css",
      ),
      "utf8",
    );
    const normalizedGeneratedCss = generatedCss.replace(/\s+/g, " ");

    expect(manualCss).not.toMatch(
      /\.react-aria-Badge\[data-(?:variant|fill-style|size)/,
    );
    for (const { variant, boldBackground, subtleBackground, boldText, hue } of [
      {
        variant: "accent",
        boldBackground: "var(--accent)",
        subtleBackground: "var(--accent-subtle)",
        boldText: "var(--fg-on-accent)",
        hue: "var(--accent)",
      },
      {
        variant: "informative",
        boldBackground: "var(--color-info-600)",
        subtleBackground: "var(--color-info-100)",
        boldText: "var(--color-white)",
        hue: "var(--color-info-600)",
      },
      {
        variant: "neutral",
        boldBackground: "var(--fg)",
        subtleBackground: "var(--bg-muted)",
        boldText: "var(--bg)",
        hue: "var(--fg)",
      },
      {
        variant: "positive",
        boldBackground: "var(--color-green-600)",
        subtleBackground: "var(--color-green-100)",
        boldText: "var(--color-white)",
        hue: "var(--color-green-600)",
      },
      {
        variant: "notice",
        boldBackground: "var(--color-warning-600)",
        subtleBackground: "var(--color-warning-100)",
        boldText: "var(--color-white)",
        hue: "var(--color-warning-600)",
      },
      {
        variant: "negative",
        boldBackground: "var(--negative)",
        subtleBackground: "var(--color-error-100)",
        boldText: "var(--color-white)",
        hue: "var(--negative)",
      },
    ]) {
      expect(normalizedGeneratedCss).toContain(
        `.react-aria-Badge[data-variant="${variant}"] { background: ${boldBackground}; color: ${boldText}; border-color: transparent;`,
      );
      expect(normalizedGeneratedCss).toContain(
        `.react-aria-Badge[data-variant="${variant}"][data-fill-style="subtle"] { background: ${subtleBackground}; color: ${hue}; border-color: transparent;`,
      );
      expect(normalizedGeneratedCss).toContain(
        `.react-aria-Badge[data-variant="${variant}"][data-fill-style="outline"] { background: transparent; color: ${hue}; border-color: ${hue};`,
      );
    }
  });
});
