import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { COMPONENT_RULES_TABLE } from "../../../packages/shared/src/catalog/generated/componentRulesTable.ts";
import { resolveCatalogPaint } from "../../../packages/shared/src/catalog/resolvers/resolveCatalogPaint.ts";
import { resolveBorderWidthPx, resolveToken } from "../../../packages/specs/src/renderers/utils/tokenResolver.ts";
import { renderBox } from "../src/builder/workspace/canvas/skia/nodeRendererBorders.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const requireBuilder = createRequire(join(root, "apps/builder/package.json"));
const { chromium } = requireBuilder("playwright");
const ckPath = requireBuilder.resolve("canvaskit-wasm/bin/canvaskit.js");
const ck = await requireBuilder(ckPath)({ locateFile: (file: string) => join(dirname(ckPath), file) });
const token = (value: unknown): string | number | undefined =>
  typeof value === "string" && value.startsWith("{")
    ? resolveToken(value as Parameters<typeof resolveToken>[0], "light")
    : value as string | number | undefined;
const color = (value: string): Float32Array => {
  if (value === "transparent") return Float32Array.of(0, 0, 0, 0);
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`COLOR_UNSUPPORTED:${value}`);
  return Float32Array.of(
    parseInt(value.slice(1, 3), 16) / 255,
    parseInt(value.slice(3, 5), 16) / 255,
    parseInt(value.slice(5, 7), 16) / 255,
    1,
  );
};
type ProbeVisual = {
  id: string;
  source: "catalog" | "forced-control";
  variant?: string;
  size?: string;
  fill: string;
  fillAlpha: number;
  borderColor: string;
  borderWidth: number;
  borderStyle: "solid" | "dashed";
  radius: number;
};
function catalogVisual(type: "InlineAlert" | "Badge", variantName: string, sizeName: string, fillStyle?: "outline"): ProbeVisual {
  const rule = COMPONENT_RULES_TABLE[type];
  const variant = rule.variants[variantName];
  const size = rule.sizes[sizeName];
  if (!variant || !size) throw new Error(`CATALOG_CASE_MISSING:${type}`);
  const paint = resolveCatalogPaint({
    variant,
    size,
    props: fillStyle ? { fillStyle } : {},
    style: undefined,
    interactionState: "default",
  });
  const fill = token(paint.backgroundColor);
  const borderColor = token(paint.borderColor);
  const radius = token(size.borderRadius);
  if (typeof fill !== "string" || typeof borderColor !== "string" || typeof radius !== "number")
    throw new Error(`CATALOG_VISUAL_UNRESOLVED:${type}`);
  return {
    id: type === "InlineAlert" ? "alert" : "badge",
    source: "catalog",
    variant: variantName,
    size: sizeName,
    fill,
    fillAlpha: paint.backgroundAlpha,
    borderColor,
    borderWidth: resolveBorderWidthPx(size.borderWidth),
    borderStyle: variant.borderStyle === "dashed" ? "dashed" : "solid",
    radius,
  };
}
const actual: ProbeVisual[] = [
  catalogVisual("InlineAlert", "info", "sm"),
  catalogVisual("Badge", "accent", "sm", "outline"),
];
const forced: ProbeVisual = {
  id: "solid-control",
  source: "forced-control",
  fill: "#e5e5e5",
  fillAlpha: 0.5,
  borderColor: "#e5e7eb",
  borderWidth: 1,
  borderStyle: "solid",
  radius: 6,
};
const cssAlert = readFileSync(join(root, "packages/shared/src/components/styles/generated/InlineAlert.css"), "utf8");
const cssBadge = readFileSync(join(root, "packages/shared/src/components/styles/generated/Badge.css"), "utf8");
const evidenceDir = join(root, "docs/adr/design/248-phase3-adjacent-border");
mkdirSync(evidenceDir, { recursive: true });
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const vars = {
  "informative-subtle": token("{color.informative-subtle}"),
  informative: token("{color.informative}"),
  accent: token("{color.accent}"),
  "radius-md": `${token("{radius.md}")}px`,
  "radius-lg": `${token("{radius.lg}")}px`,
  "radius-full": `${token("{radius.full}")}px`,
  "border-width-thin": `${token("{border.width.thin}")}px`,
  "text-sm": `${token("{typography.text-sm}")}px`,
  "text-xs": `${token("{typography.text-xs}")}px`,
  "text-xs--line-height": `${token("{typography.text-xs--line-height}")}px`,
  "font-sans": "sans-serif",
  fg: "#171717",
  "fg-on-accent": "#ffffff",
};
const rootVariables = Object.entries(vars).map(([key, value]) => `--${key}:${value};`).join("");
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: "light" });
  const page = await context.newPage();
  await page.setContent(
    `<style>@layer shared-tokens,components;:root{${rootVariables}}body{margin:0;background:white;font-family:sans-serif}${cssAlert}${cssBadge}</style>` +
    `<div style="width:160px;margin:20px"><div id="alert" class="react-aria-InlineAlert" data-variant="info" data-size="sm"><span>Info</span></div></div>` +
    `<div style="margin:20px"><span id="badge" class="react-aria-Badge" data-badge data-variant="accent" data-size="sm" data-fill-style="outline"><span>Badge</span></span></div>` +
    `<div id="solid-control" style="margin:20px;display:block;box-sizing:border-box;width:160px;height:40px;background-color:rgb(229 229 229 / 0.5);border:1px solid rgb(229 231 235);border-radius:6px"></div>`,
  );
  const results = [];
  for (const visual of [...actual, forced]) {
    const locator = page.locator(`#${visual.id}`);
    const dom = await locator.evaluate((element: Element) => {
      const r = element.getBoundingClientRect();
      const s = getComputedStyle(element);
      const child = element.querySelector("span")?.getBoundingClientRect();
      return {
        rect: { x: r.x, y: r.y, width: r.width, height: r.height },
        text: child ? { x: child.x - r.x, y: child.y - r.y, width: child.width, height: child.height } : null,
        computed: { backgroundColor: s.backgroundColor, borderColor: s.borderTopColor, borderWidth: s.borderTopWidth, borderStyle: s.borderTopStyle, borderRadius: s.borderTopLeftRadius },
      };
    });
    if (dom.computed.borderWidth !== `${visual.borderWidth}px` || dom.computed.borderStyle !== visual.borderStyle || dom.computed.borderRadius !== `${visual.radius}px`)
      throw new Error(`DOM_CATALOG_BORDER_MISMATCH:${visual.id}:${JSON.stringify(dom.computed)}`);
    const expectedColor = (value: string, alpha = 1) => {
      if (value === "transparent") return "rgba(0, 0, 0, 0)";
      const c = color(value);
      const r = Math.round(c[0] * 255), g = Math.round(c[1] * 255), b = Math.round(c[2] * 255);
      return alpha === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };
    if (dom.computed.borderColor !== expectedColor(visual.borderColor) || dom.computed.backgroundColor !== expectedColor(visual.fill, visual.fillAlpha))
      throw new Error(`DOM_CATALOG_COLOR_MISMATCH:${visual.id}:${JSON.stringify(dom.computed)}:${expectedColor(visual.fill, visual.fillAlpha)}`);
    const png = await locator.screenshot({ animations: "disabled" });
    const domPng = `${visual.id}-dom.png`;
    writeFileSync(join(evidenceDir, domPng), png);
    const image = ck.MakeImageFromEncoded(png);
    if (!image) throw new Error(`DOM_IMAGE_UNAVAILABLE:${visual.id}`);
    const width = image.width(), height = image.height();
    const cssPixels = image.readPixels(0, 0, { width, height, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB });
    if (!cssPixels) throw new Error(`DOM_PIXELS_UNAVAILABLE:${visual.id}`);
    const surface = ck.MakeSurface(width, height);
    if (!surface) throw new Error(`SKIA_SURFACE_UNAVAILABLE:${visual.id}`);
    const node = {
      type: "box" as const, elementId: visual.id, x: 0, y: 0,
      width: dom.rect.width, height: dom.rect.height, visible: true,
      box: {
        fillColor: color(visual.fill),
        borderRadius: visual.radius,
        strokeColor: color(visual.borderColor),
        strokeWidth: visual.borderWidth,
        strokeStyle: visual.borderStyle,
      },
    };
    node.box.fillColor[3] *= visual.fillAlpha;
    const skiaCanvas = surface.getCanvas();
    skiaCanvas.clear(ck.WHITE);
    renderBox(ck, skiaCanvas, node);
    surface.flush();
    const skiaPng = `${visual.id}-skia.png`;
    const skiaImage = surface.makeImageSnapshot();
    const skiaBytes = skiaImage.encodeToBytes();
    if (!skiaBytes) throw new Error(`SKIA_PNG_UNAVAILABLE:${visual.id}`);
    writeFileSync(join(evidenceDir, skiaPng), skiaBytes);
    skiaImage.delete();
    const skiaPixels = skiaCanvas.readPixels(0, 0, { width, height, colorType: ck.ColorType.RGBA_8888, alphaType: ck.AlphaType.Unpremul, colorSpace: ck.ColorSpace.SRGB });
    if (!skiaPixels) throw new Error(`SKIA_PIXELS_UNAVAILABLE:${visual.id}`);
    const counts = { masked: 0, corner: 0, border: 0, flatInterior: 0, different: 0 };
    const effectiveRadius = Math.min(visual.radius, dom.rect.width / 2, dom.rect.height / 2) + 2;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const text = dom.text;
      const outerBorder = x < 2 || y < 2 || x >= width - 2 || y >= height - 2;
      const masked = text && !outerBorder && x + 0.5 >= text.x && x + 0.5 < text.x + text.width && y + 0.5 >= text.y && y + 0.5 < text.y + text.height;
      if (masked) { counts.masked++; continue; }
      const i = (y * width + x) * 4;
      if (skiaPixels[i] === cssPixels[i] && skiaPixels[i + 1] === cssPixels[i + 1] && skiaPixels[i + 2] === cssPixels[i + 2]) continue;
      counts.different++;
      const corner =
        (x < effectiveRadius || x >= width - effectiveRadius) &&
        (y < effectiveRadius || y >= height - effectiveRadius);
      if (corner) counts.corner++;
      else if (outerBorder) counts.border++;
      else counts.flatInterior++;
    }
    results.push({
      id: visual.id, source: visual.source, variant: visual.variant, size: visual.size,
      resolved: visual, dom, skiaCommand: { type: node.type, width: node.width, height: node.height, box: { fillColor: Array.from(node.box.fillColor), borderRadius: node.box.borderRadius, strokeColor: Array.from(node.box.strokeColor), strokeWidth: node.box.strokeWidth, strokeStyle: node.box.strokeStyle } },
      pngGrid: { width, height }, counts,
      domPng,
      skiaPng,
      domPngSha256: sha256(png),
      skiaPngSha256: sha256(skiaBytes),
      mask: { definition: "DOM child text rect; outer 2px border is never masked", textBounds: dom.text },
      nontextDenominator: width * height - counts.masked,
      rawNontextRatio: counts.different / (width * height - counts.masked),
    });
    surface.delete();
    image.delete();
  }
  const pinnedRaw = { alert: [64, 5072], badge: [117, 618], "solid-control": [54, 6400] } as const;
  for (const row of results) {
    const expected = pinnedRaw[row.id as keyof typeof pinnedRaw];
    if (row.counts.different !== expected[0] || row.nontextDenominator !== expected[1])
      throw new Error(`ADJACENT_RAW_PINNED_MISMATCH:${row.id}`);
  }
  const report = {
    head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    dpr: 1,
    theme: "default-light",
    colorSpace: "sRGB 8-bit RGB exact",
    viewport: { width: 1440, height: 900 },
    chromiumVersion: browser.version(),
    renderer: "shared nodeRendererBorders.renderBox",
    scope: "catalog tokens and generated CSS root versus box-only shared Skia paint; not full component consumer parity",
    captureScript: "apps/builder/scripts/adr248-adjacent-border-capture.mts",
    results,
    priorDashedControl: { different: 319, denominator: 6400, ratio: 0.04984375 },
  };
  writeFileSync(join(evidenceDir, "capture.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(results.map((row) => ({ id: row.id, raw: row.counts.different, denominator: row.nontextDenominator, domPng: row.domPng, skiaPng: row.skiaPng }))));
} finally {
  await browser.close();
}
