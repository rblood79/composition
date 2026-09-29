import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { default: pixelmatch } = await import(require.resolve("pixelmatch"));
const ckPath = require.resolve("canvaskit-wasm/bin/canvaskit.js");
const ck = await require(ckPath)({
  locateFile: (file) => ckPath.replace("canvaskit.js", file),
});
const evidenceDir = resolve(process.cwd(), "../../docs/adr/design/248-phase3-adjacent-border");
const capture = JSON.parse(readFileSync(resolve(evidenceDir, "capture.json")));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function image(name) {
  const bytes = readFileSync(resolve(evidenceDir, name));
  const decoded = ck.MakeImageFromEncoded(bytes);
  if (!decoded) throw new Error(`ADJACENT_PNG_DECODE_FAILED:${name}`);
  try {
    const width = decoded.width();
    const height = decoded.height();
    const pixels = decoded.readPixels(0, 0, {
      width,
      height,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB,
    });
    if (!pixels) throw new Error(`ADJACENT_PNG_READ_FAILED:${name}`);
    return { width, height, pixels, sha256: sha256(bytes) };
  } finally {
    decoded.delete();
  }
}

const contains = (bounds, x, y) =>
  bounds &&
  x + 0.5 >= bounds.x &&
  x + 0.5 < bounds.x + bounds.width &&
  y + 0.5 >= bounds.y &&
  y + 0.5 < bounds.y + bounds.height;

const results = capture.results.map((row) => {
  const skia = image(row.skiaPng);
  const dom = image(row.domPng);
  if (
    skia.sha256 !== row.skiaPngSha256 ||
    dom.sha256 !== row.domPngSha256 ||
    skia.width !== dom.width ||
    skia.height !== dom.height
  )
    throw new Error(`ADJACENT_PNG_IDENTITY_MISMATCH:${row.id}`);

  // The capture's text rectangle and outer-border precedence define this mask.
  const textMask = new Uint8Array(dom.width * dom.height);
  let rawDifferent = 0;
  for (let y = 0; y < dom.height; y++)
    for (let x = 0; x < dom.width; x++) {
      const pixel = y * dom.width + x;
      const outerBorder =
        x < 2 || y < 2 || x >= dom.width - 2 || y >= dom.height - 2;
      if (!outerBorder && contains(row.mask.textBounds, x, y)) {
        textMask[pixel] = 1;
        continue;
      }
      const offset = pixel * 4;
      if (
        skia.pixels[offset] !== dom.pixels[offset] ||
        skia.pixels[offset + 1] !== dom.pixels[offset + 1] ||
        skia.pixels[offset + 2] !== dom.pixels[offset + 2]
      )
        rawDifferent++;
    }

  const diffMask = new Uint8ClampedArray(dom.width * dom.height * 4);
  const fullDiffCount = pixelmatch(
    skia.pixels,
    dom.pixels,
    diffMask,
    dom.width,
    dom.height,
    { threshold: 0.1, diffMask: true },
  );
  let markedDiffCount = 0;
  let differentPixels = 0;
  let denominator = 0;
  let maxByte = 0;
  let byteDeltaSum = 0;
  let changedBytes = 0;
  const l3Pixels = [];
  for (let pixel = 0; pixel < textMask.length; pixel++) {
    const offset = pixel * 4;
    if (diffMask[offset + 3] !== 0) markedDiffCount++;
    if (textMask[pixel]) continue;
    denominator++;
    if (diffMask[offset + 3] !== 0) {
      differentPixels++;
      if (row.id === "badge") {
        const x = pixel % dom.width;
        const y = Math.floor(pixel / dom.width);
        l3Pixels.push({
          x,
          y,
          skia: Array.from(skia.pixels.subarray(offset, offset + 4)),
          dom: Array.from(dom.pixels.subarray(offset, offset + 4)),
        });
      }
    }
    for (let channel = 0; channel < 4; channel++) {
      const delta = Math.abs(
        skia.pixels[offset + channel] - dom.pixels[offset + channel],
      );
      maxByte = Math.max(maxByte, delta);
      byteDeltaSum += delta;
      if (delta !== 0) changedBytes++;
    }
  }
  if (
    markedDiffCount !== fullDiffCount ||
    rawDifferent !== row.counts.different ||
    denominator !== row.nontextDenominator
  )
    throw new Error(`ADJACENT_CAPTURE_OR_MASK_MISMATCH:${row.id}`);
  const totalBytes = denominator * 4;
  const diffRatio = differentPixels / denominator;
  const budget = { maxDiffRatio: 0.001, maxByte: 2 };
  return {
    id: row.id,
    source: row.source,
    resolved: row.resolved,
    domComputed: row.dom.computed,
    skiaCommand: row.skiaCommand,
    domPngSha256: dom.sha256,
    skiaPngSha256: skia.sha256,
    rawDifferent,
    rawNontextRatio: rawDifferent / denominator,
    ...(row.id === "badge" ? { l3Pixels } : {}),
    l3Nontext: {
      method: "pixelmatch threshold 0.1; capture text mask excluded from result and denominator",
      differentPixels,
      denominator,
      diffRatio,
      maxByte,
      meanByte: byteDeltaSum / totalBytes,
      changedBytes,
      totalBytes,
      changedFraction: changedBytes / totalBytes,
      budget,
      budgetSource: "ADR-198 INITIAL_BUDGETS.nonText",
      verdict:
        diffRatio > budget.maxDiffRatio && maxByte > budget.maxByte
          ? "FAIL"
          : "PASS_LOCAL_L3_NONTEXT_ONLY",
    },
  };
});

writeFileSync(
  resolve(evidenceDir, "l3-comparison.json"),
  `${JSON.stringify({
    head: capture.head,
    dpr: capture.dpr,
    theme: capture.theme,
    viewport: capture.viewport,
    captureScript: capture.captureScript,
    comparisonScript: "apps/builder/scripts/adr248-adjacent-border-compare.mjs",
    results,
  }, null, 2)}\n`,
);
for (const row of results)
  console.log(
    `${row.id} (${row.source}) raw=${row.rawDifferent}/${row.l3Nontext.denominator} l3=${row.l3Nontext.differentPixels}/${row.l3Nontext.denominator} maxByte=${row.l3Nontext.maxByte} verdict=${row.l3Nontext.verdict}`,
  );
