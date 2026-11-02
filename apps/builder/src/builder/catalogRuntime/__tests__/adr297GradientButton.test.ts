import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { buildCatalogShapes } from "@composition/rendering";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { resolveCatalogPaint } from "../../../../../../packages/shared/src/catalog/resolvers/resolveCatalogPaint";
import { catalogTypeDefinition } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import {
  cssCornerGradientLine,
  paintGradientCss,
  parsePaintGradientCss,
} from "../../../../../../packages/shared/src/catalog/rule/rulePaintTree";
import type { SkiaNodeData } from "../../workspace/canvas/skia/nodeRendererTypes";
import { applyCatalogAuthoredPaint } from "../authoredPaintCanvas";

/**
 * ADR-297 후속 ⑥ — premium · genai Button 의 그라데이션 = 설치 S2 1.8.1 (`Button.tsx` `gradient` 요소). oracle 은 설치본의
 * 빌드 CSS (`dist/private/Button.css` — `--g0..2` 의 light 값 · `background-image` 정지점 %) 이고, 두 consumer 가 rule 의
 * `paint.backgroundImage` 트리 하나를 읽는다: Canvas = `resolveCatalogPaint` → `buildCatalogShapes` gradient shape,
 * DOM = 생성 `Button.css` 의 `background-image` 블록.
 */
const require = createRequire(import.meta.url);
const s2Css = readFileSync(
  join(
    dirname(require.resolve("@react-spectrum/s2/package.json")),
    "dist/private/Button.css",
  ),
  "utf8",
);
const generatedCss = readFileSync(
  resolve(
    __dirname,
    "../../../../../../packages/shared/src/components/styles/generated/Button.css",
  ),
  "utf8",
);

type Interaction = "default" | "hover" | "pressed";
function paint(
  variant: string,
  props: Record<string, unknown> = {},
  interactionState: Interaction = "default",
  style?: Record<string, unknown>,
) {
  const rule = COMPONENT_RULES_TABLE.Button!;
  return resolveCatalogPaint({
    variant: rule.variants[variant],
    size: undefined,
    props,
    style,
    interactionState,
    fillStyleValues: rule.fillStyleValues,
  });
}
const colors = (
  variant: string,
  ...args: Parameters<typeof paint> extends [string, ...infer R] ? R : never
) => paint(variant, ...args).backgroundImage?.stops.map(([color]) => color);

describe("ADR-297 후속 ⑥ — premium · genai gradient = S2", () => {
  // S2 의 빌드 CSS 순서: premium 휴지 → 정지점 → hover, genai 휴지 → 정지점 → hover.
  const triples: string[][] = [];
  let current: string[] = [];
  for (const match of s2Css.matchAll(
    /--g([012]): light-dark\((#[0-9a-f]+),/g,
  )) {
    current[Number(match[1])] = match[2]!;
    if (match[1] === "2") {
      triples.push(current);
      current = [];
    }
  }
  const percents = [
    ...s2Css.matchAll(
      /linear-gradient\(to bottom right, var\(--g0\) (\d+)%,var\(--g1\) (\d+)%,var\(--g2\) (\d+)%\)/g,
    ),
  ].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);

  it("the oracle reads two variants (rest · hover triples and stops)", () => {
    expect(triples).toHaveLength(4);
    expect(percents).toHaveLength(2);
  });

  it("Canvas: rest = 900 stops, hover · pressed = 1000, disabled = none", () => {
    for (const [index, variant] of (["premium", "genai"] as const).entries()) {
      const [rest, hover] = [triples[index * 2]!, triples[index * 2 + 1]!];
      expect(colors(variant)).toEqual(rest);
      expect(colors(variant, {}, "hover")).toEqual(hover);
      expect(colors(variant, {}, "pressed")).toEqual(hover);
      expect(
        paint(variant).backgroundImage?.stops.map(([, percent]) => percent),
      ).toEqual(percents[index]);
      expect(paint(variant).backgroundImage?.to).toBe("bottom right");
      expect(
        paint(variant, { isDisabled: true }).backgroundImage,
      ).toBeUndefined();
    }
  });

  it("Canvas: gray-100 under it, no border, white text; disabled · static · outline as S2", () => {
    expect(paint("genai")).toMatchObject({
      backgroundColor: "{color.neutral-subtle}",
      color: "{color.white}",
      borderColor: "{color.transparent}",
    });
    // (S2 outline premium · genai = the fill look — gray-100, white, border 0, the gradient)
    expect(paint("genai", { fillStyle: "outline" })).toMatchObject({
      backgroundColor: "{color.neutral-subtle}",
      color: "{color.white}",
      borderColor: "{color.transparent}",
    });
    expect(paint("genai", { fillStyle: "outline" }).backgroundImage).toEqual(
      paint("genai").backgroundImage,
    );
    expect(paint("premium", { isDisabled: true })).toMatchObject({
      backgroundColor: "{color.disabled}",
      color: "{color.neutral-subdued}",
    });
    expect(
      paint("premium", { isDisabled: true, fillStyle: "outline" })
        .backgroundColor,
    ).toBe("{color.neutral-subtle}");
    // (static: transparent-overlay-100 under the gradient, which stays; disabled text overlay-400)
    const statics = paint("genai", { staticColor: "white" });
    expect(statics.backgroundColor).toBe("rgba(255, 255, 255, 0.11)");
    expect(statics.color).toBe("#ffffff");
    expect(statics.backgroundImage).toEqual(paint("genai").backgroundImage);
    expect(
      paint("genai", { staticColor: "black", isDisabled: true }).color,
    ).toBe("rgba(0, 0, 0, 0.21)");
  });

  it("an authored background turns the gradient off; other variants have none", () => {
    expect(
      paint("genai", {}, "default", { backgroundColor: "#ff0000" })
        .backgroundImage,
    ).toBeUndefined();
    for (const variant of ["accent", "primary", "secondary", "negative"])
      expect(paint(variant).backgroundImage).toBeUndefined();
  });

  it("Canvas shapes: a full-box gradient over the background, none when disabled", () => {
    const shapesOf = (props: Record<string, unknown>) =>
      buildCatalogShapes(
        undefined,
        paint("genai", props),
        { ...props, _hasChildren: true },
        {
          height: 32,
          paddingX: 0,
          paddingY: 0,
          fontSize: 14,
          borderRadius: 16,
        } as never,
      );
    const gradient = shapesOf({}).find((shape) => shape.type === "gradient");
    expect(gradient).toMatchObject({
      x: 0,
      y: 0,
      width: "auto",
      height: "auto",
      gradient: {
        type: "linear",
        to: "bottom right",
        stops: [
          { offset: 0, color: triples[2]![0] },
          { offset: 0.33, color: triples[2]![1] },
          { offset: 1, color: triples[2]![2] },
        ],
      },
    });
    expect(
      shapesOf({ isDisabled: true }).some((shape) => shape.type === "gradient"),
    ).toBe(false);
  });

  it("the CSS corner line: the 0% · 100% lines pass the top-left · bottom-right corners", () => {
    for (const [w, h] of [
      [100, 32],
      [40, 40],
      [24, 180],
    ] as const) {
      const { start, end } = cssCornerGradientLine(w, h);
      const dx = end[0] - start[0];
      const dy = end[1] - start[1];
      const at = (x: number, y: number) =>
        ((x - start[0]) * dx + (y - start[1]) * dy) / (dx * dx + dy * dy);
      expect(at(0, 0)).toBeCloseTo(0, 9);
      expect(at(w, h)).toBeCloseTo(1, 9);
      // (the other two corners sit on the 50% line — perpendicular to their diagonal)
      expect(at(w, 0)).toBeCloseTo(0.5, 9);
      expect(at(0, h)).toBeCloseTo(0.5, 9);
    }
  });

  it("DOM: the generated sheet compiles the same tree after the color blocks", () => {
    const genaiImage = generatedCss.indexOf(
      '.react-aria-Button:where([data-variant="genai"]) {\n  background-image: linear-gradient(to bottom right, #d73220 0%, #d92361 33%, #7155fa 100%);\n  background-origin: border-box;',
    );
    expect(genaiImage).toBeGreaterThan(0);
    // (the color is the `background` shorthand — it resets the image, so every color block comes first)
    expect(generatedCss.lastIndexOf("background:")).toBeLessThan(genaiImage);
    expect(generatedCss).toMatch(
      /\.react-aria-Button:where\(\[data-variant="premium"\]\[data-disabled\]\) \{\s*background-image: none;/,
    );
    expect(generatedCss).toMatch(
      /\.react-aria-Button:where\(\[data-variant="genai"\]\[data-hovered\]\) \{\s*background-image: linear-gradient\(to bottom right, #b72818 0%, #ba1650 33%, #6338ee 100%\);/,
    );
  });

  it("the Button definition carries the tree's gradient per resting input and state (Canvas record)", () => {
    const definition = catalogTypeDefinition("Button") as unknown as {
      propVisualRules: { variant: Record<string, Record<string, unknown>> };
      conditionalRules: {
        when: Record<string, unknown>;
        state?: string;
        visual: Record<string, unknown>;
      }[];
    };
    const genai = paint("genai").backgroundImage!;
    expect(definition.propVisualRules.variant.genai!.backgroundImage).toBe(
      paintGradientCss(genai),
    );
    expect(definition.propVisualRules.variant.accent!.backgroundImage).toBe(
      undefined,
    );
    const rule = (when: Record<string, unknown>, state?: string) =>
      definition.conditionalRules.find(
        (r) =>
          r.state === state &&
          JSON.stringify(r.when) === JSON.stringify(when) &&
          "backgroundImage" in r.visual,
      )?.visual.backgroundImage;
    expect(rule({ variant: "genai", fillStyle: "fill" }, "hover")).toBe(
      paintGradientCss(paint("genai", {}, "hover").backgroundImage!),
    );
    expect(
      rule({ variant: "premium", fillStyle: "fill", isDisabled: true }),
    ).toBe("none");
    expect(parsePaintGradientCss(paintGradientCss(genai))).toEqual(genai);
    expect(parsePaintGradientCss("url(a.png)")).toBeUndefined();
  });

  it("Canvas: a record gradient lies over the fill as a child box (the fill stays)", () => {
    const rect = { x: 0, y: 0, width: 100, height: 32 };
    const base: SkiaNodeData = {
      type: "box",
      elementId: "n",
      ...rect,
      visible: true,
      box: { fillColor: Float32Array.of(0.9, 0.9, 0.9, 1), borderRadius: 16 },
    };
    const css = paintGradientCss(paint("genai").backgroundImage!);
    const node = (backgroundImage: string) => ({
      id: "n",
      visual: { backgroundImage, fill: "#e5e5e5" },
      fills: undefined,
    });
    const data = applyCatalogAuthoredPaint(node(css) as never, base, rect);
    expect(Array.from(data.box!.fillColor)).toEqual(
      Array.from(base.box!.fillColor),
    );
    const layer = data.children![0]!;
    expect(layer.box!.borderRadius).toBe(16);
    const fill = layer.box!.fill as {
      type: string;
      start: number[];
      end: number[];
      positions: number[];
    };
    expect(fill.type).toBe("linear-gradient");
    expect(fill.positions).toEqual([0, 0.33, 1]);
    const line = cssCornerGradientLine(100, 32);
    expect([fill.start, fill.end]).toEqual([line.start, line.end]);
    // (`none` — disabled — paints nothing and keeps the fill)
    const none = applyCatalogAuthoredPaint(node("none") as never, base, rect);
    expect(none.children ?? []).toEqual([]);
    expect(Array.from(none.box!.fillColor)).toEqual(
      Array.from(base.box!.fillColor),
    );
  });
});
