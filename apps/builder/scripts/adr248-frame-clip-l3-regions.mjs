// ADR-248 Phase 3 — Frame clip hidden/visible 두 사례의 새 Canvas↔격리 DOM 을
// ADR-198 region 규칙으로 재판정한다 (read-only: 고정 PNG 2장 + pair JSON 입력).
//
// ADR-198 규칙 (apps/builder/tests/visual-parity/harness/compare.ts · cases/scaffold.ts):
// - region 소속은 canonical node ID 로 정하고, 상자 = 노드 상자 합집합의 floor/ceil.
// - 텍스트 노드는 `text` kind (L4) 로 판정하고, non-text (L3) 는 텍스트가 아닌 노드가 소유한다.
// - 차단 = pixelmatch(threshold 0.1) diffRatio > maxDiffRatio **AND** maxByte > 상한.
// - 예산: INITIAL_BUDGETS.nonText 0.001/2 (L3). edge(L3e) 예산은 Frame 에 승인되지 않아 적용하지 않는다.
//
// Frame 사례의 자식은 `lib:definition:text` ("1") 이므로 텍스트 노드다. L3 non-text region
// = Frame 노드 상자에서 자식 텍스트 노드 상자 (ADR-198 VisualParityRegion.mask — 유한 사각형) 를 뺀 영역.
// 비교를 위해 mask 없는 Frame 상자 (현 compareLegs 실제 동작 — mask 미구현) 도 같이 기록한다.
//
// 실행: apps/builder 에서 `node scripts/adr248-frame-clip-l3-regions.mjs`
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const pixelmatch = (await import("pixelmatch")).default;
const ckPath = require.resolve("canvaskit-wasm/bin/canvaskit.js");
const ck = await require(ckPath)({
  locateFile: (file) => ckPath.replace("canvaskit.js", file),
});
const root = resolve(process.cwd(), "../..");

const design = resolve(root, "docs/adr/design");
const pair = JSON.parse(
  readFileSync(resolve(design, "248-phase3-frame-clip-pair.json"), "utf8"),
);
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
function load(name, expectedSha) {
  const bytes = readFileSync(resolve(design, name));
  if (sha(bytes) !== expectedSha)
    throw new Error(`FRAME_CLIP_PNG_SHA_MISMATCH:${name}`);
  const image = ck.MakeImageFromEncoded(bytes);
  if (!image) throw new Error(`FRAME_CLIP_PNG_DECODE_FAILED:${name}`);
  try {
    const width = image.width();
    const height = image.height();
    const data = image.readPixels(0, 0, {
      width,
      height,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB,
    });
    if (!data) throw new Error(`FRAME_CLIP_PIXEL_READ_FAILED:${name}`);
    // alpha 를 255 로 정규화 (DOM PNG 는 RGB) — 색 보정·리사이즈 없음.
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    return { width, height, data };
  } finally {
    image.delete();
  }
}
const canvas = load(
  "248-phase3-frame-clip-pair-canvas.png",
  pair.new.canvasSha256,
);
const dom = load("248-phase3-frame-clip-pair-dom.png", pair.new.domSha256);
if (canvas.width !== dom.width || canvas.height !== dom.height)
  throw new Error("FRAME_CLIP_PNG_SIZE_MISMATCH");

// 화면 변환: DOM frameRect (24,24,104,80) = Rust (30,30,130,100) × 0.8 (G0 camera).
const SCALE = 0.8;
const NON_TEXT = { maxDiffRatio: 0.001, maxByte: 2 }; // INITIAL_BUDGETS.nonText
const TEXT = { maxDiffRatio: 0.05, maxByte: 128 }; // INITIAL_BUDGETS.text (L4, 참고)

function box(rect) {
  const x = Math.floor(rect.x);
  const y = Math.floor(rect.y);
  return {
    x,
    y,
    width: Math.ceil(rect.x + rect.width) - x,
    height: Math.ceil(rect.y + rect.height) - y,
  };
}
const inside = (b, x, y) =>
  x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height;

function measure(region, mask, budget) {
  const pixels = [];
  for (let y = region.y; y < region.y + region.height; y++)
    for (let x = region.x; x < region.x + region.width; x++)
      if (!mask || !inside(mask, x, y)) pixels.push([x, y]);
  const n = pixels.length;
  const a = new Uint8ClampedArray(n * 4);
  const b = new Uint8ClampedArray(n * 4);
  let maxByte = 0;
  let sumByte = 0;
  let changedBytes = 0;
  pixels.forEach(([x, y], i) => {
    const src = (y * canvas.width + x) * 4;
    for (let c = 0; c < 4; c++) {
      a[i * 4 + c] = canvas.data[src + c];
      b[i * 4 + c] = dom.data[src + c];
      const d = Math.abs(canvas.data[src + c] - dom.data[src + c]);
      maxByte = Math.max(maxByte, d);
      sumByte += d;
      if (d) changedBytes++;
    }
  });
  // pixelmatch 는 사각형 입력을 받는다 — mask 로 뺀 픽셀은 1행 스트립으로 이어 붙인다.
  // threshold 0.1 · 기본 includeAA=false (compareLegs 와 같음). AA 판정의 이웃이 바뀌지 않도록
  // mask 있는 region 은 원래 좌표의 차이 픽셀을 따로 센다.
  const full = measureRect(region);
  const differentPixels = mask
    ? full.diffCoords.filter(([x, y]) => !inside(mask, x, y)).length
    : full.diffCoords.length;
  const diffRatio = differentPixels / n;
  return {
    box: region,
    mask: mask ?? null,
    denominator: n,
    differentPixels,
    diffRatio,
    maxByte,
    meanByte: sumByte / (n * 4),
    changedFraction: changedBytes / (n * 4),
    diffCoords: mask
      ? full.diffCoords.filter(([x, y]) => !inside(mask, x, y))
      : full.diffCoords,
    budget,
    blocked: diffRatio > budget.maxDiffRatio && maxByte > budget.maxByte,
  };
}
function measureRect(region) {
  const { width: w, height: h } = region;
  const a = new Uint8ClampedArray(w * h * 4);
  const b = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row++) {
    const src = ((region.y + row) * canvas.width + region.x) * 4;
    a.set(canvas.data.subarray(src, src + w * 4), row * w * 4);
    b.set(dom.data.subarray(src, src + w * 4), row * w * 4);
  }
  const out = new Uint8ClampedArray(w * h * 4);
  pixelmatch(a, b, out, w, h, { threshold: 0.1 });
  const diffCoords = [];
  for (let i = 0; i < w * h; i++)
    if (out[i * 4] === 255 && out[i * 4 + 1] === 0 && out[i * 4 + 2] === 0)
      diffCoords.push([region.x + (i % w), region.y + Math.floor(i / w)]);
  return { diffCoords };
}

const results = pair.results.map((r) => {
  const frame = box({
    x: r.rustFrame.x * SCALE,
    y: r.rustFrame.y * SCALE,
    width: r.rustFrame.width * SCALE,
    height: r.rustFrame.height * SCALE,
  });
  // 자식 절대 위치 = canvasHitBounds 원점 (Rust 절대 layout) — DOM childRect 와 일치 확인.
  const childAbs = {
    x: r.canvasHitBounds.x * SCALE,
    y: r.canvasHitBounds.y * SCALE,
    width: r.rustChild.width * SCALE,
    height: r.rustChild.height * SCALE,
  };
  for (const k of ["x", "y", "width", "height"])
    if (Math.abs(childAbs[k] - r.dom.childRect[k]) > 1)
      throw new Error(`FRAME_CLIP_CHILD_GEOMETRY_MISMATCH:${r.id}:${k}`);
  const textNode = box(childAbs);
  const crop = measure(r.region, null, NON_TEXT);
  const frameUnmasked = measure(frame, null, NON_TEXT);
  const frameNonText = measure(frame, textNode, NON_TEXT);
  const textRegion = measure(textNode, null, TEXT);
  if (crop.differentPixels !== r.newCanvasVsDom.differentPixels)
    throw new Error(`FRAME_CLIP_CROP_REPRO_MISMATCH:${r.id}`);
  const strip = ({ diffCoords, ...rest }) => ({
    ...rest,
    diffCoordsSample: diffCoords.slice(0, 12),
  });
  return {
    id: r.id,
    overflow: r.overflow,
    cropReproduction: strip(crop),
    l3FrameNonTextMaskedTextNode: strip(frameNonText),
    l3FrameNonTextUnmaskedCompareLegsBehavior: strip(frameUnmasked),
    l4TextNodeReference: strip(textRegion),
    l3Verdict: frameNonText.blocked ? "FAIL" : "PASS",
    l3UnmaskedVerdict: frameUnmasked.blocked ? "FAIL" : "PASS",
    l3eVerdict: "UNVERIFIED_NO_APPROVED_FRAME_EDGE_BUDGET",
    l4Note:
      "L4 text 는 이번 범위 밖 — INITIAL_BUDGETS.text 는 파일럿 초기값이며 여기서는 참고 수치만 기록",
  };
});

const out = {
  scenarioId: pair.scenarioId,
  scenarioHash: pair.scenarioHash,
  head: pair.head,
  inputs: {
    pairJson: "docs/adr/design/248-phase3-frame-clip-pair.json",
    canvasSha256: pair.new.canvasSha256,
    domSha256: pair.new.domSha256,
  },
  method: {
    source:
      "ADR-198 compareLegs region 규칙 (node ID 소속 · floor/ceil 상자 · pixelmatch 0.1 · ratio AND maxByte)",
    screenScale: SCALE,
    textNode: "child lib:definition:text children '1' → kind text (L4)",
    nonTextRegion:
      "Frame 노드 상자 − 자식 텍스트 노드 상자 (VisualParityRegion.mask 유한 사각형)",
    nonTextBudget: { ...NON_TEXT, source: "INITIAL_BUDGETS.nonText" },
    edgeBudget: "적용 안 함 — Frame 승인 예산 없음",
  },
  results,
};
writeFileSync(
  resolve(design, "248-phase3-frame-clip-l3-regions.json"),
  `${JSON.stringify(out, null, 2)}\n`,
);
for (const r of results)
  console.log(
    r.id,
    "crop",
    `${r.cropReproduction.differentPixels}/${r.cropReproduction.denominator}`,
    "| L3 masked",
    `${r.l3FrameNonTextMaskedTextNode.differentPixels}/${r.l3FrameNonTextMaskedTextNode.denominator}`,
    `maxByte ${r.l3FrameNonTextMaskedTextNode.maxByte}`,
    r.l3Verdict,
    "| L3 unmasked",
    `${r.l3FrameNonTextUnmaskedCompareLegsBehavior.differentPixels}/${r.l3FrameNonTextUnmaskedCompareLegsBehavior.denominator}`,
    `ratio ${r.l3FrameNonTextUnmaskedCompareLegsBehavior.diffRatio.toFixed(6)}`,
    `maxByte ${r.l3FrameNonTextUnmaskedCompareLegsBehavior.maxByte}`,
    r.l3UnmaskedVerdict,
    "| L4 text ref",
    `${r.l4TextNodeReference.differentPixels}/${r.l4TextNodeReference.denominator}`,
    `maxByte ${r.l4TextNodeReference.maxByte}`,
  );
