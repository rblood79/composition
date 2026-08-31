/**
 * ADR-198 Phase 1 / G1 — identity half
 *
 * G1 이 묻는 것은 픽셀이 아니라 **두 leg 이 같은 것을 봤는가** 다: 같은 문서
 * checksum, 같은 환경 checksum, 같은 노드 identity/order. 이게 어긋난 채로 낸
 * diff 수치는 "발산" 이 아니라 harness error 이므로, L0 는 픽셀 비교보다 **먼저**
 * 돌아야 한다 (breakdown §3.1, R1).
 *
 * Skia leg 이 현재 백색 프레임을 낸다는 사실(원인 미규명, §7)은 여기 판정과
 * 무관하다 — identity 는 픽셀과 독립이다. 그래서 Skia 의 `paintedNodeCount` 는
 * scene/registry 기준 노드 수로 센다.
 */

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { CanvasKit } from "canvaskit-wasm";

import { initCanvasKit } from "@/builder/workspace/canvas/skia/initCanvasKit";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";

import { PILOT_CASES } from "./cases";
import { CASE_PROJECT_ID } from "./cases/scaffold";
import { PreviewDriver } from "./harness/previewDriver";
import { runSkiaLegResult } from "./harness/skiaRunner";
import {
  knownDefectHits,
  unexplainedErrors,
} from "./harness/knownDefects";
import {
  captureEnvironment,
  checkIdentity,
  checkLiveness,
  environmentChecksum,
  stableChecksum,
} from "./harness/identity";
import type { LegResult, ParityVerdict } from "./harness/types";

const CANVASKIT_VERSION = "0.42.0";

function envFor(c: (typeof PILOT_CASES)[number], backend: "sw" | "gl") {
  return captureEnvironment({
    canvasKitVersion: CANVASKIT_VERSION,
    surfaceBackend: backend,
    viewport: { width: c.viewport.width, height: c.viewport.height },
    theme: c.theme,
  });
}

function describeVerdict(v: ParityVerdict): string {
  return v.ok
    ? "ok"
    : v.failures.map((f) => `${f.code}@${f.first}`).join(" | ");
}

/** LegResult 를 직접 구성한다 — 순수 L0 판정 로직만 시험하는 negative 용. */
function syntheticLeg(over: Partial<LegResult>): LegResult {
  return {
    legId: "preview",
    fixtureChecksum: "aaaaaaaa",
    environmentChecksum: "bbbbbbbb",
    nodeOrder: ["n1", "n2", "n3"],
    geometry: {},
    paintedNodeCount: 3,
    consoleErrors: [],
    ...over,
  };
}

describe("ADR-198 Phase 1 / G1 — identity half", () => {
  let ck: CanvasKit;
  let preview: PreviewDriver;

  beforeAll(async () => {
    await initCompositionEngineWasm();
    ck = await initCanvasKit();
    preview = new PreviewDriver();
    // 가장 큰 케이스에 맞춰 한 번만 띄운다 — 케이스마다 재기동하면 느리고,
    // revision 이 단조 증가하므로 재사용해도 이전 문서가 섞이지 않는다.
    await preview.start({ width: 320, height: 240 });
  }, 180_000);

  afterAll(() => preview?.stop());

  /**
   * 케이스별 두 leg 실행 결과를 한 번만 만들어 두고 아래 두 테스트가 공유한다 —
   * Skia 체인 + Preview 왕복을 케이스당 두 번 돌릴 이유가 없다.
   */
  const measured = new Map<string, { skia: LegResult; preview: LegResult }>();

  async function measure(c: (typeof PILOT_CASES)[number]) {
    const cached = measured.get(c.id);
    if (cached) return cached;

    const skia = runSkiaLegResult(
      ck,
      c.document,
      {
        pageId: c.pageId,
        width: c.viewport.width,
        height: c.viewport.height,
        projectId: CASE_PROJECT_ID,
      },
      envFor(c, "sw"),
    );
    const previewLeg = await preview.render(
      c.document,
      CASE_PROJECT_ID,
      envFor(c, "gl"),
    );

    const pair = { skia, preview: previewLeg };
    measured.set(c.id, pair);
    return pair;
  }

  for (const c of PILOT_CASES) {
    it(`${c.id}: 두 leg 이 같은 문서/환경을 보고 각각 살아 있다`, async () => {
      const { skia, preview: previewLeg } = await measure(c);

      const identity = checkIdentity(skia, previewLeg, c.expectedNodeIds);
      const skiaLive = checkLiveness(skia);
      const previewLive = checkLiveness(previewLeg);

      console.log(
        `[ADR-198 P1] ${c.id}\n` +
          `  expected  = [${c.expectedNodeIds.join(", ")}]\n` +
          `  skia      = [${skia.nodeOrder.join(", ")}] (checksum ${skia.fixtureChecksum}/${skia.environmentChecksum}, painted ${skia.paintedNodeCount})\n` +
          `  preview   = [${previewLeg.nodeOrder.join(", ")}] (checksum ${previewLeg.fixtureChecksum}/${previewLeg.environmentChecksum}, painted ${previewLeg.paintedNodeCount})\n` +
          `  identity  = ${describeVerdict(identity)}\n` +
          `  liveness  = skia:${describeVerdict(skiaLive)} preview:${describeVerdict(previewLive)}`,
      );

      // HC2 — 두 leg 이 **같은 문서**를 봤다. G1 identity 의 절반이고, 이건 성립한다.
      expect(skia.fixtureChecksum).toBe(stableChecksum(c.document));
      expect(previewLeg.fixtureChecksum).toBe(skia.fixtureChecksum);

      // HC4 — 같은 환경 조건. backend 는 체크섬에서 제외되므로 SW/GL 차이는 무해하다.
      expect(previewLeg.environmentChecksum).toBe(skia.environmentChecksum);

      // HC11 — 어느 쪽도 빈 프레임이 아니다. (Skia 는 백색이지만 scene 노드는 있다 —
      // paintedNodeCount 는 registry/scene 기준이라 픽셀과 독립이다.)
      expect(skiaLive.ok, describeVerdict(skiaLive)).toBe(true);
      expect(previewLive.ok, describeVerdict(previewLive)).toBe(true);
    }, 180_000);

    /**
     * **G1 identity half — 아티보드를 뺀 콘텐츠 노드 기준.**
     *
     * Skia 의 `nodeOrder` 는 `content.sharedScene.treeBoundsMap` 에 상자가 있는
     * 노드만 담아서 page 노드가 없다. Preview 는 DOM 컨테이너가 필요해 page 를
     * `<div data-element-id>` 로 낸다. 두 leg 은 **같은 시각 결과를 서로 다르게
     * 표현**하는 것이고, ssot-hierarchy 의 대칭 정의("구현 방법이 아니라 시각
     * 결과의 동일성")상 아티보드는 비교 대상이 아니라 **비교의 기준틀**이다.
     * §3.6 normalization 도 아티보드를 "두 leg 을 같은 경계로 crop" 하는 축으로
     * 쓴다 — 콘텐츠가 아니다.
     *
     * 그래서 `artboardNodeId` 를 케이스에 **명시 선언**하고 `expectedNodeIds` 에서
     * 뺐다. 기대를 슬쩍 낮춘 게 아니라 계약을 적은 것이며, 두 장치가 이 제외가
     * 진짜 발산을 가리지 못하게 막는다:
     *
     * 1. 콘텐츠 노드가 하나라도 빠지거나 순서가 어긋나면 여전히
     *    `PARITY-L0-IDENTITY` 다 — negative (c)/(d) 가 그걸 증명한다.
     * 2. 아티보드의 **시각 속성**(배경·크기)은 identity 축이 아니라 §3.6 의
     *    artboard crop + 배경 처리가 덮어야 한다. Phase 4 가 이 항목을 실제로
     *    구현했는지 확인해야 한다 (아래 잔여 기록).
     */
    it(`${c.id}: 두 leg 의 콘텐츠 노드 identity/order 가 일치한다 (G1)`, async () => {
      const { skia, preview: previewLeg } = await measure(c);

      // 알려진 프로덕션 결함(knownDefects.ts)은 identity 판정에서 제외한다 —
      // leg 산출물 자체는 걸러지지 않고, 무엇을 알면서 넘어가는지는 여기서
      // 명시된다. 정확한 횟수는 아래 ratchet 이 따로 잡는다.
      const identity = checkIdentity(
        skia,
        {
          ...previewLeg,
          consoleErrors: unexplainedErrors(c.id, previewLeg.consoleErrors),
        },
        c.expectedNodeIds,
      );
      expect(identity.ok, describeVerdict(identity)).toBe(true);

      // ratchet — 결함이 고쳐지거나 늘어나면 여기서 깨진다.
      for (const { defect, hits } of knownDefectHits(
        c.id,
        previewLeg.consoleErrors,
      )) {
        expect(hits, `ratchet 불일치 — ${defect.note}`).toBe(defect.count);
      }
    }, 180_000);

    /**
     * 아티보드 제외가 **선언된 것과 같은지** 고정한다. Skia 가 아티보드 노드를
     * 내기 시작하거나 Preview 가 안 내기 시작하면 이 기대가 깨져서 위 계약을
     * 다시 보게 만든다 (ratchet).
     */
    it(`${c.id}: 아티보드는 Preview 만 노드로 낸다 — 제외 근거를 고정`, async () => {
      const { skia, preview: previewLeg } = await measure(c);
      expect(skia.nodeOrder).not.toContain(c.artboardNodeId);
      expect(previewLeg.nodeOrder).toContain(c.artboardNodeId);
    }, 180_000);
  }

  // ── negative — L0 가 픽셀 비교 **전에** 잡아야 하는 4가지 ──────────────

  it("negative (a) 서로 다른 문서 → PARITY-L0-IDENTITY", async () => {
    const [c1, c2] = PILOT_CASES;
    const env = envFor(c1, "sw");

    const skia = runSkiaLegResult(
      ck,
      c1.document,
      {
        pageId: c1.pageId,
        width: c1.viewport.width,
        height: c1.viewport.height,
        projectId: CASE_PROJECT_ID,
      },
      env,
    );
    // Preview 에는 **다른 케이스의 문서**를 먹인다
    const previewLeg = await preview.render(
      c2.document,
      CASE_PROJECT_ID,
      envFor(c1, "gl"),
    );

    const v = checkIdentity(skia, previewLeg, c1.expectedNodeIds);
    console.log(`[ADR-198 P1] negative(a) 다른 문서 → ${describeVerdict(v)}`);

    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.failures.some((f) => f.code === "PARITY-L0-IDENTITY")).toBe(true);
    expect(v.failures[0].first).toBe("fixtureChecksum");
  }, 180_000);

  it("negative (b) 서로 다른 theme → PARITY-ENV", async () => {
    const c = PILOT_CASES[0];

    const skia = runSkiaLegResult(
      ck,
      c.document,
      {
        pageId: c.pageId,
        width: c.viewport.width,
        height: c.viewport.height,
        projectId: CASE_PROJECT_ID,
      },
      envFor(c, "sw"),
    );
    // 같은 문서, 같은 뷰포트 — theme 만 dark
    const darkEnv = captureEnvironment({
      canvasKitVersion: CANVASKIT_VERSION,
      surfaceBackend: "gl",
      viewport: { width: c.viewport.width, height: c.viewport.height },
      theme: "dark",
    });
    const previewLeg = await preview.render(
      c.document,
      CASE_PROJECT_ID,
      darkEnv,
    );

    const v = checkIdentity(skia, previewLeg, c.expectedNodeIds);
    console.log(
      `[ADR-198 P1] negative(b) theme light↔dark → ${describeVerdict(v)} ` +
        `(env ${skia.environmentChecksum} vs ${environmentChecksum(darkEnv)})`,
    );

    expect(v.ok).toBe(false);
    if (v.ok) return;
    expect(v.failures.some((f) => f.code === "PARITY-ENV")).toBe(true);
  }, 180_000);

  it("negative (c) 기대 노드 누락 → PARITY-L0-IDENTITY", () => {
    const a = syntheticLeg({ legId: "skia" });
    const b = syntheticLeg({ nodeOrder: ["n1", "n3"] }); // n2 없음

    const v = checkIdentity(a, b, ["n1", "n2", "n3"]);
    console.log(`[ADR-198 P1] negative(c) 노드 누락 → ${describeVerdict(v)}`);

    expect(v.ok).toBe(false);
    if (v.ok) return;
    const hit = v.failures.find((f) => f.code === "PARITY-L0-IDENTITY");
    expect(hit).toBeDefined();
    expect(hit!.first).toBe("n2");
  });

  it("negative (d) 노드 순서 불일치 → PARITY-L0-IDENTITY", () => {
    const a = syntheticLeg({ legId: "skia" });
    const b = syntheticLeg({ nodeOrder: ["n1", "n3", "n2"] }); // 순서 뒤바뀜

    const v = checkIdentity(a, b, ["n1", "n2", "n3"]);
    console.log(`[ADR-198 P1] negative(d) 순서 불일치 → ${describeVerdict(v)}`);

    expect(v.ok).toBe(false);
    if (v.ok) return;
    const hit = v.failures.find((f) => f.detail.includes("노드 순서 불일치"));
    expect(hit).toBeDefined();
    expect(hit!.code).toBe("PARITY-L0-IDENTITY");
    expect(hit!.first).toBe("n2");
  });
});
