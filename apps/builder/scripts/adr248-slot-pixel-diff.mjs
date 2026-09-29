import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";

const require = createRequire(import.meta.url);
const { default: pixelmatch } = await import(require.resolve("pixelmatch"));
const ckPath = require.resolve("canvaskit-wasm/bin/canvaskit.js");
const ck = await require(ckPath)({
  locateFile: (file) => ckPath.replace("canvaskit.js", file),
});
const root = resolve(process.cwd(), "../..");
const design = resolve(root, "docs/adr/design");
const canvas = JSON.parse(
  readFileSync(resolve(design, "248-phase3-slot-matrix-canvas.json")),
);
const dom = JSON.parse(
  readFileSync(resolve(design, "248-phase3-slot-dom-paint-bounds.json")),
);
const domMatrix = JSON.parse(
  readFileSync(resolve(design, "248-phase3-slot-matrix-dom.json")),
);
if (canvas.scenarioHash !== dom.scenarioHash || canvas.dpr !== dom.dpr)
  throw new Error("SLOT_SCENARIO_IDENTITY_MISMATCH");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fontHash = sha(
  readFileSync(resolve(process.cwd(), "public/fonts/PretendardVariable.ttf")),
);
if (fontHash !== canvas.fontSha256 || fontHash !== dom.fontSha256)
  throw new Error("SLOT_FONT_BYTES_MISMATCH");

function image(path) {
  const bytes = readFileSync(path);
  const decoded = ck.MakeImageFromEncoded(bytes);
  if (!decoded) throw new Error(`SLOT_PNG_DECODE_FAILED:${path}`);
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
    if (!pixels) throw new Error(`SLOT_PIXEL_READ_FAILED:${path}`);
    return { width, height, pixels, sha256: sha(bytes) };
  } finally {
    decoded.delete();
  }
}

function measureL3(scene, rac, textMask, width, height) {
  const perceptualMask = new Uint8ClampedArray(width * height * 4);
  const fullDiffCount = pixelmatch(scene, rac, perceptualMask, width, height, {
    threshold: 0.1,
    diffMask: true,
  });
  let markedDiffCount = 0;
  for (let pixel = 0; pixel < textMask.length; pixel++)
    if (perceptualMask[pixel * 4 + 3] !== 0) markedDiffCount++;
  if (fullDiffCount !== markedDiffCount)
    throw new Error("L3_PIXELMATCH_MASK_COUNT_MISMATCH");
  let differentPixels = 0;
  let denominator = 0;
  let maxByte = 0;
  let byteDeltaSum = 0;
  let changedBytes = 0;
  for (let pixel = 0; pixel < textMask.length; pixel++) {
    if (textMask[pixel]) continue;
    denominator++;
    const offset = pixel * 4;
    if (perceptualMask[offset + 3] !== 0) differentPixels++;
    for (let channel = 0; channel < 4; channel++) {
      const delta = Math.abs(scene[offset + channel] - rac[offset + channel]);
      maxByte = Math.max(maxByte, delta);
      byteDeltaSum += delta;
      if (delta !== 0) changedBytes++;
    }
  }
  const totalBytes = denominator * 4;
  const diffRatio = differentPixels / denominator;
  const budget = { maxDiffRatio: 0.001, maxByte: 2 };
  return {
    method:
      "pixelmatch threshold 0.1; full aligned RGBA with existing text mask excluded from result and denominator",
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
  };
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit++)
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function pngChunk(type, payload) {
  const body = Buffer.concat([Buffer.from(type), payload]);
  let crc = 0xffffffff;
  for (const byte of body) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  const out = Buffer.alloc(12 + payload.length);
  out.writeUInt32BE(payload.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, out.length - 4);
  return out;
}
function writePng(path, width, height, rgba) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const offset = y * (1 + width * 4);
    raw[offset] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(
      raw,
      offset + 1,
    );
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk("IHDR", header),
      pngChunk("IDAT", deflateSync(raw)),
      pngChunk("IEND", Buffer.alloc(0)),
    ]),
  );
}

const contains = (bounds, x, y) =>
  bounds &&
  bounds.width > 0 &&
  bounds.height > 0 &&
  x + 0.5 >= bounds.x &&
  x + 0.5 < bounds.x + bounds.width &&
  y + 0.5 >= bounds.y &&
  y + 0.5 < bounds.y + bounds.height;
const fromCanvas = (bounds) =>
  bounds && {
    x: bounds.x - 10,
    y: bounds.y - 10,
    width: bounds.width,
    height: bounds.height,
  };
const topPairs = (counts) =>
  [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([pair, count]) => ({ pair, count }));
const categoryColors = {
  border: [160, 32, 210, 255],
  icon: [20, 90, 235, 255],
  text: [245, 155, 10, 255],
  background: [225, 35, 45, 255],
};
const rows = [];
for (const source of canvas.rows) {
  const { size, state } = source;
  const measured = dom.rows.find(
    (row) => row.size === size && row.state === state,
  );
  const pinned = domMatrix.rows.find(
    (row) => row.size === size && row.state === state,
  );
  if (!measured) throw new Error(`SLOT_DOM_BOUNDS_MISSING:${size}:${state}`);
  if (
    source.canvas.textPaintCommands.length !==
    (state === "filled" ? 1 : state === "description" ? 3 : 2)
  )
    throw new Error(`SLOT_TEXT_COMMAND_BOUNDS_MISSING:${size}:${state}`);
  if (
    source.canvas.textPaintCommands.some(
      (command) =>
        command.fontSize !== source.visual.fontSize ||
        command.lineHeight !==
          source.visual.fontSize * source.visual.lineHeight ||
        command.fontWeight !== 400,
    )
  )
    throw new Error(`SLOT_TEXT_COMMAND_FONT_MISMATCH:${size}:${state}`);
  for (const command of source.canvas.textPaintCommands) {
    const role = command.id.endsWith("::editor-name")
      ? "name"
      : command.id.endsWith("::editor-required")
        ? "required"
        : command.id.endsWith("::editor-description")
          ? "description"
          : "filled";
    const bounds =
      role === "filled"
        ? source.canvas.filledTextBounds
        : source.canvas.chromePaintBounds?.[role];
    if (
      !bounds ||
      Math.abs(bounds.width - command.width) > 0.001 ||
      Math.abs(bounds.height - command.height) > 0.001
    )
      throw new Error(
        `SLOT_TEXT_COMMAND_LAYOUT_BOUNDS_MISMATCH:${size}:${state}:${role}`,
      );
  }
  const scenePath = resolve(design, source.canvas.scenePng);
  const domPath = resolve(
    design,
    `248-phase3-slot-matrix-dom/${size}-${state}.png`,
  );
  const scene = image(scenePath);
  const rac = image(domPath);
  if (
    scene.width !== 220 ||
    scene.height !== 160 ||
    rac.width !== 160 ||
    rac.height !== source.geometry.height
  )
    throw new Error(`SLOT_PNG_GRID_MISMATCH:${size}:${state}`);
  const canvasText =
    state === "filled"
      ? [fromCanvas(source.canvas.filledTextBounds)]
      : ["name", "required", "description"].map((key) =>
          fromCanvas(source.canvas.chromePaintBounds?.[key]),
        );
  const domText = ["name", "required", "description", "filled"].map(
    (key) => measured.paintBounds[key],
  );
  const textRoleBounds = Object.fromEntries(
    ["name", "required", "description", "filled"].map((key) => [
      key,
      [
        fromCanvas(
          key === "filled"
            ? source.canvas.filledTextBounds
            : source.canvas.chromePaintBounds?.[key],
        ),
        measured.paintBounds[key],
      ].filter(Boolean),
    ]),
  );
  const textRoles = Object.fromEntries(
    Object.keys(textRoleBounds).map((key) => [
      key,
      { pixels: 0, different: 0, pairs: new Map(), examples: [] },
    ]),
  );
  const iconBounds = [
    fromCanvas(source.canvas.chromePaintBounds?.icon),
    measured.paintBounds.icon,
  ];
  const categories = Object.fromEntries(
    ["border", "icon", "text", "background"].map((key) => [
      key,
      {
        pixels: 0,
        different: 0,
        pairs: new Map(),
        examples: [],
        deltas: { "1-2": 0, "3-15": 0, "16-63": 0, "64+": 0 },
      },
    ]),
  );
  const borderEdges = { top: 0, right: 0, bottom: 0, left: 0 };
  const heatmap = new Uint8Array(rac.width * rac.height * 4);
  const alignedScene = new Uint8ClampedArray(rac.width * rac.height * 4);
  const alignedRac = new Uint8ClampedArray(rac.width * rac.height * 4);
  const textMask = new Uint8Array(rac.width * rac.height);
  const inkBounds = {
    canvas: { minX: Infinity, minY: Infinity, maxX: -1, maxY: -1 },
    rac: { minX: Infinity, minY: Infinity, maxX: -1, maxY: -1 },
  };
  let textMaskPixels = 0;
  let rawDifferent = 0;
  for (let y = 0; y < rac.height; y++)
    for (let x = 0; x < rac.width; x++) {
      const index = (y * rac.width + x) * 4;
      const sceneIndex = ((y + 10) * scene.width + x + 10) * 4;
      alignedScene.set(scene.pixels.subarray(sceneIndex, sceneIndex + 4), index);
      alignedRac.set(rac.pixels.subarray(index, index + 4), index);
      const a = Array.from(scene.pixels.slice(sceneIndex, sceneIndex + 3));
      const b = Array.from(rac.pixels.slice(index, index + 3));
      const different = a.some((value, channel) => value !== b[channel]);
      const border =
        x < 2 || y < 2 || x >= rac.width - 2 || y >= rac.height - 2;
      const icon = iconBounds.some((bounds) => contains(bounds, x, y));
      const textRole =
        !border && !icon
          ? ["filled", "required", "description", "name"].find((role) =>
              textRoleBounds[role].some((bounds) => contains(bounds, x, y)),
            )
          : undefined;
      const text = Boolean(textRole);
      if (text) textMask[y * rac.width + x] = 1;
      const key = border
        ? "border"
        : icon
          ? "icon"
          : text
            ? "text"
            : "background";
      const target = categories[key];
      target.pixels++;
      if (text) textMaskPixels++;
      if (textRole) textRoles[textRole].pixels++;
      if (text && state === "filled")
        for (const [surface, rgb] of [
          ["canvas", a],
          ["rac", b],
        ])
          if (rgb.every((value) => value < 120)) {
            const box = inkBounds[surface];
            box.minX = Math.min(box.minX, x);
            box.minY = Math.min(box.minY, y);
            box.maxX = Math.max(box.maxX, x);
            box.maxY = Math.max(box.maxY, y);
          }
      if (different) {
        rawDifferent++;
        target.different++;
        if (textRole) {
          const role = textRoles[textRole];
          role.different++;
          const pair = `${a.join(",")}→${b.join(",")}`;
          role.pairs.set(pair, (role.pairs.get(pair) ?? 0) + 1);
          if (role.examples.length < 12)
            role.examples.push({ x, y, canvas: a, rac: b });
        }
        const delta = Math.max(
          ...a.map((value, channel) => Math.abs(value - b[channel])),
        );
        target.deltas[
          delta <= 2
            ? "1-2"
            : delta <= 15
              ? "3-15"
              : delta <= 63
                ? "16-63"
                : "64+"
        ]++;
        if (border)
          borderEdges[
            y < 2
              ? "top"
              : y >= rac.height - 2
                ? "bottom"
                : x < 2
                  ? "left"
                  : "right"
          ]++;
        const pair = `${a.join(",")}→${b.join(",")}`;
        target.pairs.set(pair, (target.pairs.get(pair) ?? 0) + 1);
        if (target.examples.length < 12)
          target.examples.push({ x, y, canvas: a, rac: b });
        heatmap.set(categoryColors[key], index);
      } else heatmap.set([255, 255, 255, 255], index);
    }
  const nontextDenominator = rac.width * rac.height - textMaskPixels;
  const nontextDifferent = rawDifferent - categories.text.different;
  const l3Nontext = measureL3(
    alignedScene,
    alignedRac,
    textMask,
    rac.width,
    rac.height,
  );
  if (l3Nontext.denominator !== nontextDenominator)
    throw new Error(`SLOT_L3_DENOMINATOR_MISMATCH:${size}:${state}`);
  if (
    Object.values(textRoles).reduce((sum, role) => sum + role.different, 0) !==
    categories.text.different
  )
    throw new Error(`SLOT_TEXT_ROLE_DECOMPOSITION_MISMATCH:${size}:${state}`);
  if (rawDifferent !== pinned?.canvasDomDifferentPixels)
    throw new Error(
      `SLOT_PINNED_RAW_DIFF_MISMATCH:${size}:${state}:${rawDifferent}`,
    );
  const heatmapName = `248-phase3-slot-pixel-heatmap-${size}-${state}.png`;
  writePng(resolve(design, heatmapName), rac.width, rac.height, heatmap);
  rows.push({
    size,
    state,
    width: rac.width,
    height: rac.height,
    sceneSha256: scene.sha256,
    racSha256: rac.sha256,
    rawDifferent,
    totalPixels: rac.width * rac.height,
    textMaskPixels,
    textDifferent: categories.text.different,
    nontextDifferent,
    nontextDenominator,
    nontextRatio: nontextDifferent / nontextDenominator,
    canvasTextCommands: source.canvas.textPaintCommands,
    filledInkBounds:
      state === "filled"
        ? Object.fromEntries(
            Object.entries(inkBounds).map(([surface, box]) => [
              surface,
              {
                x: box.minX,
                y: box.minY,
                width: box.maxX - box.minX + 1,
                height: box.maxY - box.minY + 1,
              },
            ]),
          )
        : null,
    l3Nontext,
    l3eCornerBand: {
      widthCssPx: 3,
      verdict: "UNVERIFIED_NO_APPROVED_SLOT_BAND_RATIO_AND_MAXBYTE_BUDGET",
    },
    borderEdges,
    heatmap: heatmapName,
    categories: Object.fromEntries(
      Object.entries(categories).map(([key, value]) => [
        key,
        {
          pixels: value.pixels,
          different: value.different,
          deltaBuckets: value.deltas,
          topPairs: topPairs(value.pairs),
          examples: value.examples,
        },
      ]),
    ),
    textRoles: Object.fromEntries(
      Object.entries(textRoles).map(([key, value]) => [
        key,
        {
          pixels: value.pixels,
          different: value.different,
          topPairs: topPairs(value.pairs),
          examples: value.examples,
        },
      ]),
    ),
    mask: {
      definition:
        "Union of Canvas text DRAW dimensions at Rust layout positions and RAC DOM text element bounds; outer 2px border and icon union always excluded from text mask",
      canvasText,
      domText,
      iconBounds,
    },
  });
}
const outputPath = resolve(design, "248-phase3-slot-pixel-diff.json");
const prettier = require("prettier");
writeFileSync(
  outputPath,
  await prettier.format(
    JSON.stringify({
      head: canvas.head,
      scenarioId: canvas.scenarioId,
      scenarioHash: canvas.scenarioHash,
      viewport: canvas.viewport,
      dpr: canvas.dpr,
      fontSha256: fontHash,
      theme: canvas.theme,
      seed: canvas.seed,
      sceneOnly: true,
      colorSpace: "sRGB 8-bit RGB exact",
      rows,
    }),
    { ...(await prettier.resolveConfig(outputPath)), filepath: outputPath },
  ),
);
for (const row of rows)
  console.log(
    `${row.size}/${row.state} raw=${row.rawDifferent} text=${row.textDifferent} nontextRaw=${row.nontextDifferent}/${row.nontextDenominator}=${row.nontextRatio.toFixed(6)} l3=${row.l3Nontext.differentPixels}/${row.l3Nontext.denominator}=${row.l3Nontext.diffRatio.toFixed(6)} maxByte=${row.l3Nontext.maxByte} verdict=${row.l3Nontext.verdict} border=${row.categories.border.different} icon=${row.categories.icon.different} background=${row.categories.background.different}`,
  );
