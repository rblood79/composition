import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pixelmatch from "pixelmatch";
import { renderBox } from "../src/builder/workspace/canvas/skia/nodeRendererBorders.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const evidenceDir = join(root, "docs/adr/design/248-phase3-adjacent-border");
const capture = JSON.parse(readFileSync(join(evidenceDir, "capture.json"), "utf8"));
const badge = capture.results.find((row: { id: string }) => row.id === "badge");
if (!badge) throw new Error("BADGE_CAPTURE_MISSING");
const requireBuilder = createRequire(join(root, "apps/builder/package.json"));
const ckPath = requireBuilder.resolve("canvaskit-wasm/bin/canvaskit.js");
const ck = await requireBuilder(ckPath)({ locateFile: (file: string) => join(dirname(ckPath), file) });
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function readImage(name: string, expectedHash: string) {
  const bytes = readFileSync(join(evidenceDir, name));
  if (sha256(bytes) !== expectedHash) throw new Error(`BADGE_PNG_HASH_CHANGED:${name}`);
  const image = ck.MakeImageFromEncoded(bytes);
  if (!image) throw new Error(`BADGE_PNG_DECODE_FAILED:${name}`);
  const width = image.width(), height = image.height();
  const pixels = image.readPixels(0, 0, {
    width, height,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB,
  });
  image.delete();
  if (!pixels) throw new Error(`BADGE_PNG_READ_FAILED:${name}`);
  return { width, height, pixels };
}
const dom = readImage(badge.domPng, badge.domPngSha256);
const pinnedSkia = readImage(badge.skiaPng, badge.skiaPngSha256);
if (dom.width !== pinnedSkia.width || dom.height !== pinnedSkia.height) throw new Error("BADGE_GRID_CHANGED");
const text = badge.mask.textBounds;
const textMask = new Uint8Array(dom.width * dom.height);
for (let y = 0; y < dom.height; y++) for (let x = 0; x < dom.width; x++) {
  const outer = x < 2 || y < 2 || x >= dom.width - 2 || y >= dom.height - 2;
  if (!outer && x + 0.5 >= text.x && x + 0.5 < text.x + text.width && y + 0.5 >= text.y && y + 0.5 < text.y + text.height)
    textMask[y * dom.width + x] = 1;
}

function render(width: number, radius: number, translateX: number) {
  const surface = ck.MakeSurface(dom.width, dom.height);
  if (!surface) throw new Error("BADGE_SURFACE_UNAVAILABLE");
  const canvas = surface.getCanvas();
  canvas.clear(ck.WHITE);
  canvas.translate(translateX, 0);
  renderBox(ck, canvas, {
    type: "box", elementId: "badge-probe", x: 0, y: 0,
    width, height: badge.dom.rect.height, visible: true,
    box: {
      fillColor: Float32Array.from(badge.skiaCommand.box.fillColor),
      borderRadius: radius,
      strokeColor: Float32Array.from(badge.skiaCommand.box.strokeColor),
      strokeWidth: badge.skiaCommand.box.strokeWidth,
      strokeStyle: badge.skiaCommand.box.strokeStyle,
    },
  });
  surface.flush();
  const pixels = canvas.readPixels(0, 0, {
    width: dom.width, height: dom.height,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB,
  });
  surface.delete();
  if (!pixels) throw new Error("BADGE_RENDER_READ_FAILED");
  return pixels;
}

function compare(skia: Uint8Array) {
  const diffMask = new Uint8ClampedArray(dom.width * dom.height * 4);
  pixelmatch(skia, dom.pixels, diffMask, dom.width, dom.height, { threshold: 0.1, diffMask: true });
  let perceptual = 0, raw = 0, maxByte = 0, rightEdge = 0, nontext = 0;
  const edgeBand3 = { pixels: 0, different: 0, maxByte: 0 };
  const interior3 = { pixels: 0, different: 0, maxByte: 0 };
  const points = [];
  for (let pixel = 0; pixel < textMask.length; pixel++) {
    if (textMask[pixel]) continue;
    nontext++;
    const offset = pixel * 4;
    const x = pixel % dom.width, y = Math.floor(pixel / dom.width);
    const region = x < 3 || y < 3 || x >= dom.width - 3 || y >= dom.height - 3 ? edgeBand3 : interior3;
    region.pixels++;
    if (diffMask[offset + 3] !== 0) {
      perceptual++;
      region.different++;
      if (x === dom.width - 1) rightEdge++;
      points.push([x, y]);
    }
    if (skia[offset] !== dom.pixels[offset] || skia[offset + 1] !== dom.pixels[offset + 1] || skia[offset + 2] !== dom.pixels[offset + 2]) raw++;
    for (let ch = 0; ch < 4; ch++) {
      const delta = Math.abs(skia[offset + ch] - dom.pixels[offset + ch]);
      maxByte = Math.max(maxByte, delta);
      region.maxByte = Math.max(region.maxByte, delta);
    }
  }
  return { perceptual, nontext, raw, maxByte, rightEdge, edgeBand3, interior3, points };
}

const baseline = render(badge.skiaCommand.width, badge.skiaCommand.box.borderRadius, 0);
const originalDifferentBytes = baseline.reduce((count: number, value: number, index: number) => count + Number(value !== pinnedSkia.pixels[index]), 0);
if (originalDifferentBytes !== 0) throw new Error(`BADGE_RENDER_NOT_REPRODUCED:${originalDifferentBytes}`);
const variants = [
  ["captured", 54.6875, 9999, 0],
  ["integer-width", 55, 9999, 0],
  ["css-outer-radius", 54.6875, 11, 0],
  ["css-center-radius", 54.6875, 10.5, 0],
  ["integer-width-outer-radius", 55, 11, 0],
  ["translate-left-0.3125", 54.6875, 9999, -0.3125],
  ["translate-right-0.3125", 54.6875, 9999, 0.3125],
] as const;
const results = variants.map(([id, width, radius, translateX]) => ({ id, width, radius, translateX, ...compare(render(width, radius, translateX)) }));
if (results[0].perceptual !== 10 || results[0].nontext !== 618 || results[0].raw !== 117 || results[0].maxByte !== 74)
  throw new Error("BADGE_CAPTURE_METRICS_NOT_REPRODUCED");
writeFileSync(join(evidenceDir, "badge-boundary-probe.json"), `${JSON.stringify({
  head: capture.head,
  badgeDomSha256: badge.domPngSha256,
  badgeSkiaSha256: badge.skiaPngSha256,
  domRect: badge.dom.rect,
  pngGrid: badge.pngGrid,
  skiaCommand: badge.skiaCommand,
  originalDifferentBytes,
  method: "Existing PNG and text mask; Skia renderBox variant parameters only; pixelmatch threshold 0.1; diagnostic, not budget approval",
  results,
}, null, 2)}\n`);
console.log(JSON.stringify(results.map(({ id, perceptual, raw, maxByte, rightEdge }) => ({ id, perceptual, raw, maxByte, rightEdge }))));
