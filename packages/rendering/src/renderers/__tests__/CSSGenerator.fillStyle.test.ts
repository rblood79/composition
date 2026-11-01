import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";


const here = dirname(fileURLToPath(import.meta.url));

describe("CSSGenerator fillStyle", () => {
  it("subtle fill이 outline과 같은 1px box footprint를 유지한다", () => {
    // ADR-297 3i: the variant blocks are the compiled trees — the subtle block never drops the base block's
    //   1px transparent border (`border: none`), so subtle · outline · fill keep one box size.
    const css = readFileSync(
      resolve(
        here,
        "../../../../shared/src/components/styles/generated/Badge.css",
      ),
      "utf8",
    );
    expect(css).toMatch(
      /^\.react-aria-Badge \{[\s\S]*?border: var\(--border-width-thin\) solid transparent;/m,
    );
    const subtle = [
      ...css.matchAll(/\[data-fill-style="subtle"\]\) \{([\s\S]*?)\n\}/g),
    ];
    expect(subtle.length).toBeGreaterThan(0);
    for (const [, block] of subtle) expect(block).not.toContain("border: none");
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
        // 바탕 위 글자 · 선 — accent-content (ADR-290)
        hue: "var(--accent-content)",
      },
      {
        variant: "informative",
        boldBackground: "var(--informative)",
        subtleBackground: "var(--informative-subtle)",
        boldText: "var(--color-white)",
        hue: "var(--informative)",
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
        boldBackground: "var(--positive)",
        subtleBackground: "var(--positive-subtle)",
        boldText: "var(--color-white)",
        hue: "var(--positive)",
      },
      {
        variant: "notice",
        boldBackground: "var(--notice)",
        subtleBackground: "var(--notice-subtle)",
        boldText: "var(--color-white)",
        hue: "var(--notice)",
      },
      {
        variant: "negative",
        boldBackground: "var(--negative)",
        subtleBackground: "var(--negative-subtle)",
        boldText: "var(--fg-on-negative)",
        hue: "var(--negative)",
      },
    ]) {
      expect(normalizedGeneratedCss).toContain(
        `.react-aria-Badge:where([data-variant="${variant}"]) { background: ${boldBackground}; color: ${boldText}; border-color: transparent;`,
      );
      expect(normalizedGeneratedCss).toContain(
        // (ADR-297 Phase 3: the subtle branch sets no border — the rest border (transparent) holds, as on Canvas)
        `.react-aria-Badge:where([data-variant="${variant}"][data-fill-style="subtle"]) { background: ${subtleBackground}; color: ${hue}; }`,
      );
      expect(normalizedGeneratedCss).toContain(
        `.react-aria-Badge:where([data-variant="${variant}"][data-fill-style="outline"]) { background: transparent; color: ${hue}; border-color: ${hue};`,
      );
    }
  });
});
