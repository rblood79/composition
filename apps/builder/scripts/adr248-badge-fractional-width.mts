import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pixelmatch from "pixelmatch";
import { COMPONENT_RULES_TABLE } from "../../../packages/shared/src/catalog/generated/componentRulesTable.ts";
import { resolveCatalogPaint } from "../../../packages/shared/src/catalog/resolvers/resolveCatalogPaint.ts";
import { resolveBorderWidthPx, resolveToken } from "../../../packages/specs/src/renderers/utils/tokenResolver.ts";
import { renderBox } from "../src/builder/workspace/canvas/skia/nodeRendererBorders.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const evidenceDir = join(root, "docs/adr/design/248-phase3-adjacent-border/fractional-width");
mkdirSync(evidenceDir, { recursive: true });
const requireBuilder = createRequire(join(root, "apps/builder/package.json"));
const { chromium } = requireBuilder("playwright");
const ckPath = requireBuilder.resolve("canvaskit-wasm/bin/canvaskit.js");
const ck = await requireBuilder(ckPath)({ locateFile: (file: string) => join(dirname(ckPath), file) });
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const token = (value: unknown): string | number | undefined =>
  typeof value === "string" && value.startsWith("{")
    ? resolveToken(value as Parameters<typeof resolveToken>[0], "light")
    : value as string | number | undefined;
const color = (hex: string): Float32Array => {
  if (hex === "transparent") return Float32Array.of(0, 0, 0, 0);
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`UNSUPPORTED_COLOR:${hex}`);
  return Float32Array.of(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
    1,
  );
};
const rule = COMPONENT_RULES_TABLE.Badge;
const variant = rule.variants.accent;
const size = rule.sizes.sm;
const paint = resolveCatalogPaint({ variant, size, props: { fillStyle: "outline" }, style: undefined, interactionState: "default" });
const fill = token(paint.backgroundColor);
const border = token(paint.borderColor);
const radius = token(size.borderRadius);
if (typeof fill !== "string" || typeof border !== "string" || typeof radius !== "number") throw new Error("BADGE_CATALOG_UNRESOLVED");
const borderWidth = resolveBorderWidthPx(size.borderWidth);
const rootVariables = Object.entries({
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
}).map(([key, value]) => `--${key}:${value};`).join("");
const cssAlert = readFileSync(join(root, "packages/shared/src/components/styles/generated/InlineAlert.css"), "utf8");
const cssBadge = readFileSync(join(root, "packages/shared/src/components/styles/generated/Badge.css"), "utf8");
const fixedCapture = JSON.parse(readFileSync(join(root, "docs/adr/design/248-phase3-adjacent-border/capture.json"), "utf8"));
const fixedBadge = fixedCapture.results.find((row: { id: string }) => row.id === "badge");
if (!fixedBadge) throw new Error("FIXED_BADGE_CAPTURE_MISSING");

function decode(bytes: Uint8Array) {
  const image = ck.MakeImageFromEncoded(bytes);
  if (!image) throw new Error("PNG_DECODE_FAILED");
  const width = image.width(), height = image.height();
  const pixels = image.readPixels(0, 0, {
    width, height,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB,
  });
  image.delete();
  if (!pixels) throw new Error("PNG_PIXELS_MISSING");
  return { width, height, pixels };
}
function render(pngWidth: number, pngHeight: number, dpr: number, layoutWidth: number, paintWidth: number) {
  const surface = ck.MakeSurface(pngWidth, pngHeight);
  if (!surface) throw new Error("SKIA_SURFACE_MISSING");
  const canvas = surface.getCanvas();
  canvas.clear(ck.WHITE);
  canvas.scale(dpr, dpr);
  renderBox(ck, canvas, {
    type: "box", elementId: "badge", x: 0, y: 0,
    // The scenario's layoutWidth remains unchanged; only this test paint copy differs.
    width: paintWidth, height: 22, visible: true,
    box: {
      fillColor: color(fill),
      borderRadius: radius,
      strokeColor: color(border),
      strokeWidth: borderWidth,
      strokeStyle: "solid",
    },
  });
  surface.flush();
  const image = surface.makeImageSnapshot();
  const bytes = image.encodeToBytes();
  image.delete();
  surface.delete();
  if (!bytes) throw new Error("SKIA_PNG_MISSING");
  return { bytes, ...decode(bytes), layoutWidth, paintWidth };
}
function compare(skia: Uint8Array, dom: Uint8Array, width: number, height: number, dpr: number, text: { x: number; y: number; width: number; height: number }) {
  const diffMask = new Uint8ClampedArray(width * height * 4);
  pixelmatch(skia, dom, diffMask, width, height, { threshold: 0.1, diffMask: true });
  const left = { pixels: 0, different: 0, maxByte: 0 };
  const right = { pixels: 0, different: 0, maxByte: 0 };
  let denominator = 0, different = 0, maxByte = 0, masked = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const outer = x < 2 * dpr || y < 2 * dpr || x >= width - 2 * dpr || y >= height - 2 * dpr;
    const textPixel = !outer && x + 0.5 >= text.x * dpr && x + 0.5 < (text.x + text.width) * dpr && y + 0.5 >= text.y * dpr && y + 0.5 < (text.y + text.height) * dpr;
    if (textPixel) { masked++; continue; }
    denominator++;
    const offset = (y * width + x) * 4;
    const mismatch = diffMask[offset + 3] !== 0;
    if (mismatch) different++;
    let pixelMax = 0;
    for (let ch = 0; ch < 4; ch++) pixelMax = Math.max(pixelMax, Math.abs(skia[offset + ch] - dom[offset + ch]));
    maxByte = Math.max(maxByte, pixelMax);
    if (x < 3 * dpr) { left.pixels++; if (mismatch) left.different++; left.maxByte = Math.max(left.maxByte, pixelMax); }
    if (x >= width - 3 * dpr) { right.pixels++; if (mismatch) right.different++; right.maxByte = Math.max(right.maxByte, pixelMax); }
  }
  return { different, denominator, ratio: different / denominator, maxByte, masked, left, right };
}

const browser = await chromium.launch({ headless: true });
const cases = [];
try {
  for (const dpr of [1, 2]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr, colorScheme: "light" });
    const page = await context.newPage();
    await page.setContent(
      `<style>@layer shared-tokens,components;:root{${rootVariables}}body{margin:0;background:white;font-family:sans-serif}${cssAlert}${cssBadge}</style>` +
      `<div style="width:160px;margin:20px"><div id="alert" class="react-aria-InlineAlert" data-variant="info" data-size="sm"><span>Info</span></div></div>` +
      `<div style="margin:20px"><span id="badge" class="react-aria-Badge" data-badge data-variant="accent" data-size="sm" data-fill-style="outline"><span>Badge</span></span></div>` +
      `<div id="solid-control" style="margin:20px;display:block;box-sizing:border-box;width:160px;height:40px;background-color:rgb(229 229 229 / 0.5);border:1px solid rgb(229 231 235);border-radius:6px"></div>`,
    );
    await page.locator("#alert").screenshot({ animations: "disabled" });
    const locator = page.locator("#badge");
    for (const targetWidth of [54.6875, 54.25, 55.25]) {
      await locator.evaluate((element: HTMLElement, width: number) => { element.style.width = width === 54.6875 ? "" : `${width}px`; }, targetWidth);
      const measured = await locator.evaluate((element: Element) => {
        const rect = element.getBoundingClientRect();
        const inner = element.querySelector("span")!.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
          text: { x: inner.x - rect.x, y: inner.y - rect.y, width: inner.width, height: inner.height },
          computed: {
            width: style.width, height: style.height, boxSizing: style.boxSizing,
            borderWidth: style.borderTopWidth, borderStyle: style.borderTopStyle, borderColor: style.borderTopColor, borderRadius: style.borderTopLeftRadius,
            backgroundColor: style.backgroundColor, fontFamily: style.fontFamily, fontSize: style.fontSize, lineHeight: style.lineHeight, fontWeight: style.fontWeight,
          },
        };
      });
      if (Math.abs(measured.rect.width - targetWidth) > 1 / 64 || measured.rect.height !== 22) throw new Error(`BADGE_GEOMETRY_CHANGED:${dpr}:${targetWidth}:${JSON.stringify(measured.rect)}`);
      if (measured.computed.borderWidth !== `${borderWidth}px` || measured.computed.borderStyle !== "solid" || measured.computed.borderRadius !== `${radius}px` || measured.computed.borderColor !== "rgb(21, 93, 252)" || measured.computed.backgroundColor !== "rgba(0, 0, 0, 0)")
        throw new Error(`BADGE_STYLE_CHANGED:${dpr}:${targetWidth}:${JSON.stringify(measured.computed)}`);
      const domPng = await locator.screenshot({ animations: "disabled" });
      if (dpr === 1 && targetWidth === 54.6875 && sha256(domPng) !== fixedBadge.domPngSha256) {
        const previous = decode(readFileSync(join(root, "docs/adr/design/248-phase3-adjacent-border", fixedBadge.domPng)));
        const current = decode(domPng);
        const changedBytes = current.pixels.reduce((sum: number, value: number, index: number) => sum + Number(value !== previous.pixels[index]), 0);
        throw new Error(`FIXED_BADGE_DOM_PNG_CHANGED:${sha256(domPng)}:${current.width}x${current.height}:${changedBytes}:${JSON.stringify(measured)}`);
      }
      const dom = decode(domPng);
      const snappedPaintWidth = Math.round(measured.rect.width * dpr) / dpr;
      const captureCeilPaintWidth = Math.ceil(measured.rect.width * dpr) / dpr;
      const exact = render(dom.width, dom.height, dpr, measured.rect.width, measured.rect.width);
      const snapped = render(dom.width, dom.height, dpr, measured.rect.width, snappedPaintWidth);
      const captureCeil = render(dom.width, dom.height, dpr, measured.rect.width, captureCeilPaintWidth);
      if (dpr === 1 && targetWidth === 54.6875 && sha256(exact.bytes) !== fixedBadge.skiaPngSha256) throw new Error("FIXED_BADGE_SKIA_PNG_CHANGED");
      const id = `dpr${dpr}-width${String(targetWidth).replace(".", "_")}`;
      const files = { dom: `${id}-dom.png`, exact: `${id}-exact.png`, snap: `${id}-snap.png`, captureCeil: `${id}-capture-ceil.png` };
      writeFileSync(join(evidenceDir, files.dom), domPng);
      writeFileSync(join(evidenceDir, files.exact), exact.bytes);
      writeFileSync(join(evidenceDir, files.snap), snapped.bytes);
      writeFileSync(join(evidenceDir, files.captureCeil), captureCeil.bytes);
      cases.push({
        id, dpr, targetWidth, layoutWidth: measured.rect.width,
        exactPaintWidth: measured.rect.width, snappedPaintWidth, captureCeilPaintWidth,
        dom: measured, crop: { pngWidth: dom.width, pngHeight: dom.height, cssX: measured.rect.x, cssY: measured.rect.y, physicalX: measured.rect.x * dpr, physicalY: measured.rect.y * dpr },
        files, hashes: { dom: sha256(domPng), exact: sha256(exact.bytes), snap: sha256(snapped.bytes), captureCeil: sha256(captureCeil.bytes) },
        exact: compare(exact.pixels, dom.pixels, dom.width, dom.height, dpr, measured.text),
        snap: compare(snapped.pixels, dom.pixels, dom.width, dom.height, dpr, measured.text),
        captureCeil: compare(captureCeil.pixels, dom.pixels, dom.width, dom.height, dpr, measured.text),
      });
    }
    await context.close();
  }
} finally {
  await browser.close();
}
if (cases.length !== 6) throw new Error(`BADGE_CASE_COUNT:${cases.length}`);
const report = {
  head: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  source: "catalog Badge accent/outline/sm; layout geometry unchanged between exact/snap paint probes",
  resolved: { fill, border, borderWidth, radius },
  viewport: { width: 1440, height: 900 }, theme: "default-light", colorScheme: "light", font: "computed sans-serif; no external font file loaded",
  browserVersion: browser.version(), cssBadgeSha256: sha256(Buffer.from(cssBadge)),
  skiaSourceSha256: sha256(readFileSync(join(root, "apps/builder/src/builder/workspace/canvas/skia/nodeRendererBorders.ts"))),
  canvasKitJsSha256: sha256(readFileSync(ckPath)),
  fixedBadgeDomPngSha256: fixedBadge.domPngSha256,
  fixedBadgeSkiaPngSha256: fixedBadge.skiaPngSha256,
  mask: "DOM child text rect; outer 2 CSS px never masked; physical pixels scale with DPR; 3 CSS px left/right diagnostic bands",
  comparator: "pixelmatch threshold 0.1; maxByte over unmasked RGBA; no budget or gate change",
  cases,
};
writeFileSync(join(evidenceDir, "comparison.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(cases.map(({ id, crop, exact, snap, captureCeil, snappedPaintWidth, captureCeilPaintWidth }) => ({ id, grid: [crop.pngWidth, crop.pngHeight], snappedPaintWidth, captureCeilPaintWidth, exact: [exact.different, exact.denominator, exact.maxByte, exact.left.different, exact.right.different], snap: [snap.different, snap.denominator, snap.maxByte, snap.left.different, snap.right.different], captureCeil: [captureCeil.different, captureCeil.denominator, captureCeil.maxByte, captureCeil.left.different, captureCeil.right.different] }))));
