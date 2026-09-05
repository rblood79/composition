/**
 * ADR-198 Phase 4a — 계층 비교 계측기 (test-only)
 *
 * breakdown §3.6 의 순서를 그대로 실행한다: **live → L0 → L1 → L2 → L3/L3e → L4**.
 * 앞 층이 갈리면 뒤 층은 안 본다 — 다른 문서를 본 두 leg 의 픽셀 diff 는 "발산" 이
 * 아니라 harness error 이고, 그 수치를 읽는 것 자체가 오도다 (R1).
 *
 * ## 두 가지 설계 선택
 *
 * 1. **건너뛴 층을 통과로 세지 않는다.** `layers` 에 `skip` 과 사유를 남긴다.
 *    L2 는 Skia leg 이 style 을 못 내므로 지금 구조적으로 skip 인데, 그걸 조용히
 *    통과로 만들면 "6개 층 통과" 라는 문장이 거짓이 된다.
 * 2. **비율 단독 차단 금지 (HC6).** region 은 `maxDiffRatio` 와 `maxByte` 를 둘 다
 *    갖고, **둘 다** 넘어야 실패한다. §2.4 실측이 근거다 — blur 는 프레임의 19.6%
 *    가 다르지만 maxByte 3, AA hairline 은 1.2% 인데 maxByte 59. 비율만 보면 이
 *    둘의 심각도가 뒤집힌다.
 *
 * 같은 rasterizer 끼리의 대조(결정성·negative probe)는 `exactSameRasterizer` 로
 * `maxByte 0` 정확 일치를 요구한다 — 지각 임계를 쓰지 않는다 (§3.6 마지막 문단).
 */

import pixelmatch from "pixelmatch";
import type {
  EnvironmentManifest,
  LegResult,
  ParityCode,
  ParityFailure,
  Rect,
  VisualParityCase,
  VisualParityRegion,
} from "./types";
import { byteDiff, pixelVariance } from "./pixels";

export type LayerId = "env" | "live" | "L0" | "L1" | "L2" | "L3" | "L4";

export interface LayerOutcome {
  layer: LayerId;
  status: "pass" | "fail" | "skip";
  /** skip 이면 반드시 사유가 있다 — 침묵 skip 금지 */
  reason?: string;
}

export interface RegionMetric {
  regionId: string;
  kind: VisualParityRegion["kind"];
  box: Rect;
  /** pixelmatch 가 센 다른 픽셀 비율 (threshold 0.1) */
  diffRatio: number;
  maxByte: number;
  meanByte: number;
  changedFraction: number;
  budget: { maxDiffRatio?: number; maxByte?: number };
  blocked: boolean;
}

export interface ParityReport {
  caseId: string;
  ok: boolean;
  layers: LayerOutcome[];
  failures: ParityFailure[];
  regions: RegionMetric[];
}

export interface LegInput {
  leg: LegResult;
  env: EnvironmentManifest;
}

export interface CompareOptions {
  /** 같은 rasterizer 끼리의 대조 — maxByte 0 정확 일치를 요구한다 */
  exactSameRasterizer?: boolean;
  /**
   * 감도 probe 모드. 두 입력이 **일부러 다른 문서**일 때 켠다.
   *
   * 이때 L0 의 문서 체크섬 요구가 뒤집힌다 — 같으면 통과가 아니라 **실패**다.
   * 변형이 문서를 실제로 바꾸지 못했는데 probe 가 "잡았다" 고 말하는 경우를
   * 막는다 (no-op 변형은 계측기가 아니라 probe 의 결함이다).
   */
  expectMutation?: boolean;
  /** liveness 분산 하한 (HC11). 단색 프레임은 일치가 아니다 */
  varianceFloor?: number;
  /** 프레임 크기 — region 크롭에 필요 */
  frame: { width: number; height: number };
}

/** region 이 차지하는 상자 = 소속 노드 상자의 합집합 (프레임으로 clamp). */
function regionBox(
  region: VisualParityRegion,
  geometry: Record<string, Rect>,
  frame: { width: number; height: number },
): Rect | null {
  const boxes = region.nodeIds
    .map((id) => geometry[id])
    .filter((b): b is Rect => Boolean(b));
  if (boxes.length === 0) return null;

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x);
    y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.width);
    y1 = Math.max(y1, b.y + b.height);
  }
  const x = Math.max(0, Math.floor(x0));
  const y = Math.max(0, Math.floor(y0));
  const w = Math.min(frame.width, Math.ceil(x1)) - x;
  const h = Math.min(frame.height, Math.ceil(y1)) - y;
  if (w <= 0 || h <= 0) return null;
  return { x, y, width: w, height: h };
}

function crop(pixels: Uint8Array, frameWidth: number, box: Rect): Uint8Array {
  const out = new Uint8Array(box.width * box.height * 4);
  for (let row = 0; row < box.height; row++) {
    const src = ((box.y + row) * frameWidth + box.x) * 4;
    out.set(pixels.subarray(src, src + box.width * 4), row * box.width * 4);
  }
  return out;
}

function codeForKind(kind: VisualParityRegion["kind"]): ParityCode {
  return kind === "text" ? "PARITY-L4-TEXT" : "PARITY-L3-PIXEL";
}

/**
 * 계층 비교. 앞 층이 실패하면 뒤 층은 `skip` 으로 남기고 실행하지 않는다.
 */
export function compareLegs(
  c: VisualParityCase,
  a: LegInput,
  b: LegInput,
  opts: CompareOptions,
): ParityReport {
  const layers: LayerOutcome[] = [];
  const failures: ParityFailure[] = [];
  const regions: RegionMetric[] = [];

  const fail = (
    layer: LayerId,
    code: ParityCode,
    first: string,
    detail: string,
  ) => {
    failures.push({
      code,
      layer: layer === "env" ? "env" : layer === "live" ? "live" : layer,
      first,
      detail,
    });
  };

  const stop = (from: LayerId, reason: string): ParityReport => {
    const order: LayerId[] = ["env", "live", "L0", "L1", "L2", "L3", "L4"];
    for (const l of order.slice(order.indexOf(from) + 1)) {
      layers.push({ layer: l, status: "skip", reason });
    }
    return { caseId: c.id, ok: false, layers, failures, regions };
  };

  // ── env ──────────────────────────────────────────────────────────────
  // Skia leg 은 결정성을 위해 SW 로 래스터해야 한다 (HC4). backend 는 환경
  // 체크섬에서 제외되므로 (leg 마다 다른 게 정상) 여기서 따로 본다.
  // `.find` 로 첫 하나만 보면 안 된다 — 대조군 실행은 **양쪽이 다 Skia** 라
  // 두 번째 leg 의 backend 가 조용히 통과한다 (probe 6 이 이걸 잡았다).
  for (const side of [a, b]) {
    if (side.leg.legId === "skia" && side.env.surfaceBackend !== "sw") {
      fail(
        "env",
        "PARITY-ENV",
        "surfaceBackend",
        `Skia leg 이 "${side.env.surfaceBackend}" 로 래스터됐다 — 게이트는 "sw" 만 인정한다`,
      );
    }
  }
  if (failures.length > 0) {
    layers.push({ layer: "env", status: "fail" });
    return stop("env", "env 실패로 이후 층 미실행");
  }
  layers.push({ layer: "env", status: "pass" });

  // ── live ─────────────────────────────────────────────────────────────
  // 빈 프레임끼리는 완벽히 "일치" 한다. 그래서 픽셀보다 먼저 본다 (HC11/R11).
  const floor = opts.varianceFloor ?? 0;
  for (const side of [a, b]) {
    if (side.leg.paintedNodeCount < 1) {
      fail(
        "live",
        "PARITY-LIVE",
        side.leg.legId,
        `${side.leg.legId} 가 노드를 하나도 칠하지 않았다`,
      );
    } else if (side.leg.pixels) {
      const v = pixelVariance(side.leg.pixels);
      if (v <= floor) {
        fail(
          "live",
          "PARITY-LIVE",
          side.leg.legId,
          `${side.leg.legId} 프레임 분산 ${v.toFixed(3)} ≤ 하한 ${floor} — 단색 프레임은 일치가 아니다`,
        );
      }
    }
  }
  if (failures.length > 0) {
    layers.push({ layer: "live", status: "fail" });
    return stop("live", "liveness 실패로 이후 층 미실행");
  }
  layers.push({ layer: "live", status: "pass" });

  // ── L0 identity ──────────────────────────────────────────────────────
  if (opts.expectMutation) {
    if (a.leg.fixtureChecksum === b.leg.fixtureChecksum) {
      fail(
        "L0",
        "PARITY-L0-IDENTITY",
        "fixtureChecksum",
        `양쪽 체크섬이 ${a.leg.fixtureChecksum} 로 같다 — 변형이 문서를 바꾸지 못했다 (no-op probe)`,
      );
    }
  } else if (a.leg.fixtureChecksum !== b.leg.fixtureChecksum) {
    fail(
      "L0",
      "PARITY-L0-IDENTITY",
      "fixtureChecksum",
      `${a.leg.fixtureChecksum} vs ${b.leg.fixtureChecksum} — 두 leg 이 다른 문서를 봤다`,
    );
  }
  if (a.leg.environmentChecksum !== b.leg.environmentChecksum) {
    fail(
      "L0",
      "PARITY-ENV",
      "environmentChecksum",
      `${a.leg.environmentChecksum} vs ${b.leg.environmentChecksum}`,
    );
  }
  for (const side of [a, b]) {
    const missing = c.expectedNodeIds.filter(
      (id) => !side.leg.nodeOrder.includes(id),
    );
    if (missing.length > 0) {
      fail(
        "L0",
        "PARITY-L0-IDENTITY",
        missing[0],
        `${side.leg.legId} 에 기대 노드 ${missing.length}개 없음: ${missing.join(", ")}`,
      );
    }
  }
  const orderOf = (l: LegResult) =>
    l.nodeOrder.filter((id) => c.expectedNodeIds.includes(id));
  if (orderOf(a.leg).join(">") !== orderOf(b.leg).join(">")) {
    fail(
      "L0",
      "PARITY-L0-IDENTITY",
      "nodeOrder",
      `[${orderOf(a.leg).join(",")}] vs [${orderOf(b.leg).join(",")}]`,
    );
  }
  if (failures.length > 0) {
    layers.push({ layer: "L0", status: "fail" });
    return stop("L0", "identity 실패로 이후 층 미실행");
  }
  layers.push({ layer: "L0", status: "pass" });

  // ── L1 geometry ──────────────────────────────────────────────────────
  // 각 delta ≤ 1 CSS px (§3.6). 1px 오프셋은 여기서 잡혀야 하고, 픽셀 층까지
  // 내려가면 "왜 다른지" 를 못 말한다.
  for (const id of c.expectedNodeIds) {
    const ra = a.leg.geometry[id];
    const rb = b.leg.geometry[id];
    if (!ra || !rb) continue;
    const deltas: [string, number][] = [
      ["x", Math.abs(ra.x - rb.x)],
      ["y", Math.abs(ra.y - rb.y)],
      ["width", Math.abs(ra.width - rb.width)],
      ["height", Math.abs(ra.height - rb.height)],
    ];
    const worst = deltas.filter(([, d]) => d > 1);
    if (worst.length > 0) {
      fail(
        "L1",
        "PARITY-L1-GEOMETRY",
        `${id}.${worst[0][0]}`,
        worst.map(([k, d]) => `${k} Δ${d.toFixed(2)}px`).join(", ") +
          ` (${a.leg.legId} vs ${b.leg.legId})`,
      );
    }
  }
  if (failures.length > 0) {
    layers.push({ layer: "L1", status: "fail" });
    return stop("L1", "geometry 실패로 이후 층 미실행");
  }
  layers.push({ layer: "L1", status: "pass" });

  // ── L2 resolved style ────────────────────────────────────────────────
  // 두 leg 이 모두 style 을 낼 때만 성립한다. Skia leg 은 catalog 해석 결과를
  // style 로 내지 않으므로 지금은 구조적 skip 이고, 그 사실을 남긴다.
  if (a.leg.styles && b.leg.styles) {
    for (const id of c.expectedNodeIds) {
      const sa = a.leg.styles[id];
      const sb = b.leg.styles[id];
      if (!sa || !sb) continue;
      for (const key of Object.keys(sa)) {
        if (sa[key] !== sb[key]) {
          fail(
            "L2",
            "PARITY-L2-STYLE",
            `${id}.${key}`,
            `${a.leg.legId}="${sa[key]}" vs ${b.leg.legId}="${sb[key]}"`,
          );
        }
      }
    }
    if (failures.length > 0) {
      layers.push({ layer: "L2", status: "fail" });
      return stop("L2", "style 실패로 이후 층 미실행");
    }
    layers.push({ layer: "L2", status: "pass" });
  } else {
    layers.push({
      layer: "L2",
      status: "skip",
      reason:
        "한쪽 leg 이 정규화 style 을 내지 않는다 — Skia 쪽 catalog 해석 어댑터는 미구현",
    });
  }

  // ── L3 / L3e / L4 pixels ─────────────────────────────────────────────
  if (!a.leg.pixels || !b.leg.pixels) {
    layers.push({
      layer: "L3",
      status: "skip",
      reason: "한쪽 leg 이 픽셀을 내지 않았다",
    });
    layers.push({ layer: "L4", status: "skip", reason: "L3 미실행" });
    return {
      caseId: c.id,
      ok: failures.length === 0,
      layers,
      failures,
      regions,
    };
  }

  const { width, height } = opts.frame;
  let textFailed = false;
  let pixelFailed = false;

  for (const region of c.regions) {
    if (region.kind === "geometry") continue; // L1 이 이미 봤다
    const box = regionBox(region, a.leg.geometry, { width, height });
    if (!box) continue;

    const ca = crop(a.leg.pixels, width, box);
    const cb = crop(b.leg.pixels, width, box);
    const d = byteDiff(ca, cb);

    // pixelmatch 는 지각 거리(threshold 0.1)로 "다른 픽셀 수" 를 센다. 차단
    // 판정은 이 비율 **과** byte 진폭이 함께 넘을 때만 (HC6).
    const diffPixels = pixelmatch(
      new Uint8ClampedArray(ca.buffer.slice(0)),
      new Uint8ClampedArray(cb.buffer.slice(0)),
      undefined,
      box.width,
      box.height,
      { threshold: 0.1 },
    );
    const diffRatio = diffPixels / (box.width * box.height);

    const budget = {
      maxDiffRatio: region.maxDiffRatio,
      maxByte: region.maxByte,
    };

    const blocked = opts.exactSameRasterizer
      ? d.maxByte > 0
      : budget.maxDiffRatio !== undefined &&
        budget.maxByte !== undefined &&
        diffRatio > budget.maxDiffRatio &&
        d.maxByte > budget.maxByte;

    regions.push({
      regionId: region.id,
      kind: region.kind,
      box,
      diffRatio,
      maxByte: d.maxByte,
      meanByte: d.meanByte,
      changedFraction: d.changedFraction,
      budget,
      blocked,
    });

    if (blocked) {
      const code = codeForKind(region.kind);
      if (code === "PARITY-L4-TEXT") textFailed = true;
      else pixelFailed = true;
      fail(
        code === "PARITY-L4-TEXT" ? "L4" : "L3",
        code,
        region.id,
        `kind=${region.kind} diffRatio=${diffRatio.toFixed(5)} maxByte=${d.maxByte} ` +
          `(예산 ratio ${budget.maxDiffRatio ?? "-"} / byte ${budget.maxByte ?? "-"})`,
      );
    }
  }

  layers.push({ layer: "L3", status: pixelFailed ? "fail" : "pass" });
  layers.push({ layer: "L4", status: textFailed ? "fail" : "pass" });

  return {
    caseId: c.id,
    ok: failures.length === 0,
    layers,
    failures,
    regions,
  };
}
