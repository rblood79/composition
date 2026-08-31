/**
 * ADR-198 Phase 4a — negative probe 6종: 계측기가 무엇을 잡는가
 *
 * ## 왜 같은 leg 끼리 비교하는가 (대조군)
 *
 * 두 leg 을 대조하면 "계측기가 이 변화를 잡았다" 와 "두 렌더러가 원래 다르다" 가
 * 섞여서, 무엇을 증명했는지 말할 수 없다. 그래서 **같은 Skia leg 에 원본과 변형본을
 * 각각 태워** 비교한다 — 차이의 원인이 변형 하나로 고정된다
 * (measurement-validity §1 Q3: oracle 독립성).
 *
 * 같은 rasterizer 끼리이므로 판정은 `exactSameRasterizer` = `maxByte 0` 정확 일치다
 * (§3.6 마지막 문단). 지각 임계로 무르게 하지 않는다.
 *
 * ## 이 파일이 증명하는 것과 증명하지 않는 것
 *
 * 증명: 각 변형이 **의도한 층에서, 의도한 코드로** 차단된다.
 * 증명 안 함: 두 leg 의 실제 픽셀 발산이 예산 안에 있는가 (G3 positive) — 그건
 * Skia 발산 수리 뒤로 유보됐다 (사용자 결정 2026-08-31).
 */

import { beforeAll, describe, expect, it } from "vitest";
import type { CanvasKit } from "canvaskit-wasm";
import { initCanvasKit } from "@/builder/workspace/canvas/skia/initCanvasKit";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import { catalogStatePaint, textRasterResources } from "../cases";
import { CASE_PROJECT_ID } from "../cases/scaffold";
import { captureEnvironment } from "../harness/identity";
import { runSkiaLegResult } from "../harness/skiaRunner";
import {
  compareLegs,
  type LegInput,
  type ParityReport,
} from "../harness/compare";
import {
  changeFillColor,
  changeProps,
  changeTextMetrics,
  emptyBody,
  shiftBy,
  thickenBorder,
} from "../harness/mutations";
import type { CompositionDocument } from "@composition/shared";
import type { EnvironmentManifest, VisualParityCase } from "../harness/types";

let ck: CanvasKit;

function envFor(
  c: VisualParityCase,
  backend: EnvironmentManifest["surfaceBackend"] = "sw",
): EnvironmentManifest {
  return captureEnvironment({
    canvasKitVersion: "0.42.0",
    surfaceBackend: backend,
    viewport: { width: c.viewport.width, height: c.viewport.height },
    theme: c.theme,
  });
}

/** 한 문서를 Skia leg 으로 실행해 비교 입력으로 만든다. */
function leg(
  c: VisualParityCase,
  doc: CompositionDocument,
  backend: EnvironmentManifest["surfaceBackend"] = "sw",
): LegInput {
  const env = envFor(c, backend);
  return {
    leg: runSkiaLegResult(
      ck,
      doc,
      {
        pageId: c.pageId,
        width: c.viewport.width,
        height: c.viewport.height,
        projectId: CASE_PROJECT_ID,
      },
      env,
    ),
    env,
  };
}

function run(
  c: VisualParityCase,
  mutated: CompositionDocument,
  backend: EnvironmentManifest["surfaceBackend"] = "sw",
): ParityReport {
  const base = leg(c, c.document);
  const other = leg(c, mutated, backend);
  return compareLegs(c, base, other, {
    exactSameRasterizer: true,
    // 변형 probe 는 **일부러 다른 문서**를 태운다. 이 모드에서 L0 은 체크섬이
    // 같으면 실패시킨다 — 변형이 no-op 이면 probe 가 먼저 무너져야 한다.
    expectMutation: mutated !== c.document,
    varianceFloor: 0,
    frame: { width: c.viewport.width, height: c.viewport.height },
  });
}

/** 실패 코드 · 층 · 처음 갈린 자리를 한 줄로 — 진단에 필요한 최소 정보 (§3.7). */
function describeReport(r: ParityReport): string {
  const layers = r.layers
    .map(
      (l) => `${l.layer}:${l.status}${l.status === "skip" ? `(${l.reason})` : ""}`,
    )
    .join(" ");
  const fails = r.failures
    .map((f) => `${f.code}@${f.layer}/${f.first} — ${f.detail}`)
    .join(" | ");
  return `layers=[${layers}] failures=[${fails}]`;
}

describe("ADR-198 Phase 4a — negative probe (계측기 대조군 검증)", () => {
  beforeAll(async () => {
    await initCompositionEngineWasm();
    ck = await initCanvasKit();
  }, 60_000);

  // 파일럿 케이스 중 Skia leg 이 실제로 칠하는 것을 쓴다. `basic-geometry-paint`
  // 는 Skia 가 백색이라 liveness 에서 먼저 걸려 다른 층을 시험할 수 없다
  // (Phase 0/3 실측 — 원인 규명은 별도 작업).
  const C = catalogStatePaint;

  it("probe 1 — 1px 오프셋: L1 허용치 안이라 픽셀 층이 잡는다 (경계 실측)", () => {
    // §3.6 의 L1 규칙은 "각 delta ≤ 1 CSS px" 다. 그래서 **1px 오프셋은 정의상
    // L1 을 통과한다** — breakdown 이 이 probe 를 "1px geometry offset" 이라
    // 부르면서 L1 을 기대하는 것은 규칙과 어긋난다. 여기서는 실제로 무슨 일이
    // 일어나는지 고정한다: 상자는 정확히 1px 움직이고, L1 은 통과하며, 변화는
    // 픽셀 층이 잡는다. L1 자체의 감도는 probe 1b 가 따로 증명한다.
    const mut = shiftBy(C.document, "state-button-enabled", 1);
    const g0 = leg(C, C.document).leg.geometry["state-button-enabled"];
    const g1 = leg(C, mut).leg.geometry["state-button-enabled"];
    console.log(
      `[ADR-198 P4a-probe1] geo base=${JSON.stringify(g0)} mutated=${JSON.stringify(g1)}`,
    );
    // 변형이 실제로 상자를 움직였다 — no-op probe 가 아니다
    expect(Math.abs(g1.x - g0.x)).toBeGreaterThan(0);
    expect(Math.abs(g1.x - g0.x)).toBeLessThanOrEqual(1);

    const r = run(C, mut);
    console.log(`[ADR-198 P4a-probe1] ${describeReport(r)}`);
    expect(r.ok).toBe(false);
    expect(r.layers.find((l) => l.layer === "L1")?.status).toBe("pass");
    expect(r.failures.some((f) => f.code === "PARITY-L3-PIXEL")).toBe(true);
  }, 120_000);

  it("probe 1b — 허용치를 넘는 오프셋은 L1 에서 PARITY-L1-GEOMETRY 로 막힌다", () => {
    // L1 이 무언가를 잡는다는 것을 증명한다. 이게 없으면 "L1 통과" 는 그냥
    // 아무것도 안 보는 층일 수도 있다.
    const r = run(C, shiftBy(C.document, "state-button-enabled", 4));
    console.log(`[ADR-198 P4a-probe1b] ${describeReport(r)}`);
    expect(r.ok).toBe(false);
    expect(r.failures[0].code).toBe("PARITY-L1-GEOMETRY");
    expect(r.failures[0].layer).toBe("L1");
    expect(r.failures[0].first).toMatch(/^state-button-enabled\./);
    // L1 에서 멈춰야 한다 — 기하가 갈린 뒤의 픽셀 diff 는 해석 불가다
    expect(r.layers.find((l) => l.layer === "L3")?.status).toBe("skip");
  }, 120_000);

  it("probe 2 — 의미 토큰(variant) 1단계 변경은 픽셀 층에서 막힌다", () => {
    // catalog 의 의미 축을 움직인다 (accent → negative). 색을 style 로 직접
    // 쓰지 않고 토큰으로 바꾸는 것이 D3 에서 실제로 일어나는 변화다.
    const r = run(
      C,
      changeProps(C.document, "state-button-enabled", { variant: "negative" }),
    );
    console.log(`[ADR-198 P4a-probe2] ${describeReport(r)}`);
    console.log(
      `[ADR-198 P4a-probe2] regions=` +
        r.regions
          .map(
            (x) =>
              `${x.regionId}(ratio=${x.diffRatio.toFixed(5)},maxByte=${x.maxByte},blocked=${x.blocked})`,
          )
          .join(" "),
    );
    expect(r.ok).toBe(false);
    expect(r.failures.some((f) => f.code === "PARITY-L3-PIXEL")).toBe(true);
    // 진폭으로도 잡혀야 한다 — 비율만으로 판정하면 저대비 변화가 흡수된다 (§3.6)
    const blocked = r.regions.filter((x) => x.blocked);
    expect(blocked.length).toBeGreaterThan(0);
    expect(Math.max(...blocked.map((x) => x.maxByte))).toBeGreaterThan(2);
  }, 120_000);

  it("실측 — Skia leg 은 frame 의 backgroundColor 를 픽셀로 내지 않는다", () => {
    // 단일 변수 실험이다: frame 하나의 fill 만 바꾼다. 결과가 **byte 동일**이면
    // 그 채널이 Skia 픽셀에 도달하지 않는다는 뜻이고, 이는 Phase 0/3 의
    // "basic-geometry-paint (전부 frame) 만 백색" 과 같은 축을 가리킨다.
    //
    // 계측기 결함이 아니다 — 같은 계측기가 probe 1b/2 에서는 변화를 잡는다.
    // 수정은 Phase 4a scope 밖(프로덕션 Skia)이므로 현재 값을 못박는다.
    const r = run(C, changeFillColor(C.document, "state-clip", "#00FF00"));
    console.log(`[ADR-198 P4a-frame-fill] ${describeReport(r)}`);
    console.log(
      `[ADR-198 P4a-frame-fill] regions=` +
        r.regions
          .map((x) => `${x.regionId}(maxByte=${x.maxByte})`)
          .join(" "),
    );
    // 초록(#00FF00)으로 바꿔도 한 바이트도 안 변한다
    expect(r.regions.every((x) => x.maxByte === 0)).toBe(true);
    expect(r.ok).toBe(true);
  }, 120_000);

  it("probe 3 — border 1px + radius 1px 은 픽셀 층에서 막힌다", () => {
    const r = run(C, thickenBorder(C.document, "state-clip"));
    console.log(`[ADR-198 P4a-probe3] ${describeReport(r)}`);
    expect(r.ok).toBe(false);
    expect(
      r.failures.some(
        (f) => f.code === "PARITY-L3-PIXEL" || f.code === "PARITY-L1-GEOMETRY",
      ),
    ).toBe(true);
  }, 120_000);

  it("probe 4 — 폰트 크기/행간 변경은 텍스트 층에서 막힌다", () => {
    const T = textRasterResources;
    const base = leg(T, T.document);
    const other = leg(T, changeTextMetrics(T.document, "textraster-paragraph"));
    const r = compareLegs(T, base, other, {
      exactSameRasterizer: true,
      expectMutation: true,
      varianceFloor: 0,
      frame: { width: T.viewport.width, height: T.viewport.height },
    });
    console.log(`[ADR-198 P4a-probe4] ${describeReport(r)}`);
    expect(r.ok).toBe(false);
    expect(
      r.failures.some(
        (f) =>
          f.code === "PARITY-L4-TEXT" ||
          f.code === "PARITY-L1-GEOMETRY" ||
          f.code === "PARITY-L3-PIXEL",
      ),
    ).toBe(true);
  }, 120_000);

  it("probe 5 — 두 leg 이 나란히 비면 PARITY-LIVE 다 (일치 아님)", () => {
    // 같은 빈 문서를 양쪽에 태운다. 픽셀은 **완벽히 같다** — 그래서 픽셀 층만
    // 있으면 이건 만점짜리 통과가 된다. liveness 가 앞에 있어야 하는 이유다.
    const blank = emptyBody(C.document);
    const a = leg(C, blank);
    const b = leg(C, blank);
    const r = compareLegs(C, a, b, {
      exactSameRasterizer: true,
      // 하한 0 이면 "분산 > 0" 만 요구한다. 빈 body 도 배경은 칠하므로
      // 파일럿 프레임의 실제 분산보다 충분히 낮은 값을 하한으로 둔다.
      varianceFloor: 100,
      frame: { width: C.viewport.width, height: C.viewport.height },
    });
    console.log(`[ADR-198 P4a-probe5] ${describeReport(r)}`);
    expect(r.ok).toBe(false);
    expect(r.failures.every((f) => f.code === "PARITY-LIVE")).toBe(true);
    // liveness 가 앞이라 뒤 층은 실행되지 않아야 한다 — 빈 프레임의 diff 0 을
    // "통과" 로 읽는 경로가 없어야 한다.
    expect(r.layers.filter((l) => l.layer === "L3")[0].status).toBe("skip");
  }, 120_000);

  it("probe 6 — Skia leg 이 sw 가 아니면 PARITY-ENV 로 즉시 막힌다", () => {
    const r = run(C, C.document, "gl");
    console.log(`[ADR-198 P4a-probe6] ${describeReport(r)}`);
    expect(r.ok).toBe(false);
    expect(r.failures[0].code).toBe("PARITY-ENV");
    expect(r.failures[0].first).toBe("surfaceBackend");
    // env 가 앞이라 liveness 조차 실행되지 않는다
    expect(r.layers.find((l) => l.layer === "live")?.status).toBe("skip");
  }, 120_000);

  it("대조군 — 변형이 없으면 통과한다 (probe 들이 vacuous 하지 않다)", () => {
    const r = run(C, C.document);
    console.log(`[ADR-198 P4a-control] ${describeReport(r)}`);
    expect(r.ok, describeReport(r)).toBe(true);
    // L2 는 지금 구조적으로 skip 이다 — 통과로 세지 않는다
    expect(r.layers.find((l) => l.layer === "L2")?.status).toBe("skip");
  }, 120_000);
});
