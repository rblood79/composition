/**
 * ADR-198 Phase 2 — G2 (Skia 쪽): 결정성 · 외부 요청 0 · 리소스 균형
 *
 * G1 이 "프로덕션 경로를 탔는가" 를 봤다면 여기는 "그 경로가 **재현 가능한가**" 를
 * 본다. 셋 다 통과해야 이후 픽셀 예산이 blocking 이 될 자격이 생긴다 (HC5).
 *
 * ## 왜 이 셋인가
 *
 * - **10-run 해시**: 한 번 맞는 건 우연일 수 있다. 같은 입력이 같은 바이트를 낼 때만
 *   diff 수치가 신호가 된다.
 * - **외부 요청 0**: 네트워크가 섞이면 CI 가 남의 서버 상태를 재게 된다 (HC4).
 * - **surface 균형**: 케이스를 반복해도 WASM surface 가 쌓이지 않아야 한다. 누수는
 *   느려짐이 아니라 **뒤 케이스의 실패**로 나타나서 원인 추적이 어렵다.
 *
 * 백색 프레임에서도 10-run 해시는 통과한다는 점을 기억할 것 — 그래서 liveness 가
 * 별도 layer 로 존재한다 (HC11). 여기서 결정성만 보고 "건강하다" 고 읽으면 안 된다.
 */

import { beforeAll, describe, expect, it } from "vitest";
import type { CanvasKit } from "canvaskit-wasm";
import { initCanvasKit } from "@/builder/workspace/canvas/skia/initCanvasKit";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
import { PILOT_CASES } from "../cases";
import { runSkiaLegResult } from "../harness/skiaRunner";
import { captureEnvironment } from "../harness/identity";
import { CASE_PROJECT_ID } from "../cases/scaffold";
import { rgbaHash, byteDiff, pixelVariance } from "../harness/pixels";

let ck: CanvasKit;

function optsFor(c: (typeof PILOT_CASES)[number]) {
  return {
    pageId: c.pageId,
    width: c.viewport.width,
    height: c.viewport.height,
    projectId: CASE_PROJECT_ID,
  };
}

function envFor(c: (typeof PILOT_CASES)[number]) {
  return captureEnvironment({
    canvasKitVersion: "0.42.0",
    surfaceBackend: "sw",
    viewport: { width: c.viewport.width, height: c.viewport.height },
    theme: c.theme,
  });
}

describe("ADR-198 Phase 2 / G2 (Skia) — 결정성 · 외부 요청 · 리소스", () => {
  beforeAll(async () => {
    // 레이아웃 엔진 WASM 없이는 `calculateFullTreeLayout` 이 null 을 주고
    // `getSharedLayoutMap()` 이 비어 체인이 끊긴다 — 두 WASM 을 모두 올린다.
    await initCompositionEngineWasm();
    ck = await initCanvasKit();
  }, 60_000);

  for (const c of PILOT_CASES) {
    it(`${c.id}: 10회 연속 정규화 해시 동일 + 서로 간 maxByte 0 (HC5/G2)`, () => {
      const env = envFor(c);
      const first = runSkiaLegResult(ck, c.document, optsFor(c), env);
      expect(first.pixels, "픽셀을 못 읽었다").toBeTruthy();

      const baseHash = rgbaHash(first.pixels!);
      const hashes = new Set([baseHash]);
      let worst = 0;
      for (let i = 1; i < 10; i++) {
        const next = runSkiaLegResult(ck, c.document, optsFor(c), env);
        hashes.add(rgbaHash(next.pixels!));
        worst = Math.max(worst, byteDiff(first.pixels!, next.pixels!).maxByte);
      }

      console.log(
        `[ADR-198 P2-G2] ${c.id}: distinct=${hashes.size} hash=${baseHash} ` +
          `worstMaxByte=${worst} variance=${pixelVariance(first.pixels!).toFixed(1)} ` +
          `nodes=${first.nodeOrder.length}`,
      );
      expect(hashes.size).toBe(1);
      expect(worst).toBe(0);
    }, 180_000);
  }

  /**
   * **G2 는 liveness 도 요구한다** — 결정적인 백색 프레임은 결정적일 뿐 살아 있지
   * 않다. 케이스별 실측을 그대로 고정한다:
   *
   *   basic-geometry-paint   variance 0    ← 전부 `frame` 컨테이너. 안 칠해진다.
   *   catalog-state-paint    variance 763  ← 칠해진다
   *   text-raster-resources  variance 35   ← 칠해진다
   *
   * 세 케이스가 같은 하니스·같은 경로를 타는데 하나만 비었다는 사실은 Phase 0 의
   * "Skia 백색" 후보를 좁힌다 — 전역 실패가 아니라 **`frame` 컨테이너 축**을
   * 가리킨다. 다만 케이스들은 컨테이너 타입 말고도 다른 점이 있어서(사용 컴포넌트,
   * 색 표기) 이건 **정황이지 증명이 아니다.** 원인 규명은 §7 별도 작업이고,
   * 여기서는 현재 값을 ratchet 으로 박아 어느 쪽이든 바뀌면 드러나게 한다.
   */
  it("케이스별 liveness 현재값을 고정한다 (G2 liveness / HC11)", () => {
    const rows = PILOT_CASES.map((c) => {
      const r = runSkiaLegResult(ck, c.document, optsFor(c), envFor(c));
      return { id: c.id, variance: pixelVariance(r.pixels!) };
    });
    for (const r of rows)
      console.log(
        `[ADR-198 P2-G2] liveness ${r.id}: variance=${r.variance.toFixed(1)}`,
      );

    const byId = Object.fromEntries(rows.map((r) => [r.id, r.variance]));
    // 칠해지는 두 케이스 — G2 liveness 충족
    expect(byId["catalog-state-paint"]).toBeGreaterThan(0);
    expect(byId["text-raster-resources"]).toBeGreaterThan(0);
    // 안 칠해지는 한 케이스 — 미해결. 0 이 아니게 되면 이 기대가 깨져 기록을 갱신시킨다.
    expect(byId["basic-geometry-paint"]).toBe(0);
  }, 180_000);

  it("케이스 실행 중 외부(다른 origin) 요청이 0 이다 (HC4/G2)", async () => {
    const seen: string[] = [];
    const origin = window.location.origin;

    const realFetch = window.fetch;
    const realOpen = XMLHttpRequest.prototype.open;
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      seen.push(String(input instanceof Request ? input.url : input));
      return realFetch(input as RequestInfo, init);
    }) as typeof window.fetch;
    XMLHttpRequest.prototype.open = function (
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      seen.push(String(url));
      return (realOpen as (...a: unknown[]) => void).call(
        this,
        method,
        url,
        ...rest,
      );
    } as typeof XMLHttpRequest.prototype.open;

    try {
      for (const c of PILOT_CASES) {
        runSkiaLegResult(ck, c.document, optsFor(c), envFor(c));
      }
    } finally {
      window.fetch = realFetch;
      XMLHttpRequest.prototype.open = realOpen;
    }

    const external = seen.filter((u) => {
      if (u.startsWith("/") || u.startsWith("data:") || u.startsWith("blob:"))
        return false;
      try {
        return new URL(u, origin).origin !== origin;
      } catch {
        return false;
      }
    });

    console.log(
      `[ADR-198 P2-G2] 요청 ${seen.length}건 중 외부 ${external.length}건` +
        (external.length ? ` → ${external.join(", ")}` : ""),
    );
    expect(external).toEqual([]);
  }, 180_000);

  it("케이스를 10회 반복해도 CanvasKit surface 가 균형을 유지한다 (G4 예고)", () => {
    let created = 0;
    let deleted = 0;

    const realMake = ck.MakeSurface.bind(ck);
    (ck as unknown as { MakeSurface: typeof ck.MakeSurface }).MakeSurface = ((
      w: number,
      h: number,
    ) => {
      const s = realMake(w, h);
      if (s) {
        created++;
        const realDelete = s.delete.bind(s);
        s.delete = () => {
          deleted++;
          realDelete();
        };
      }
      return s;
    }) as typeof ck.MakeSurface;

    try {
      const c = PILOT_CASES[0];
      const env = envFor(c);
      for (let i = 0; i < 10; i++) {
        runSkiaLegResult(ck, c.document, optsFor(c), env);
      }
    } finally {
      (ck as unknown as { MakeSurface: typeof ck.MakeSurface }).MakeSurface =
        realMake;
    }

    console.log(
      `[ADR-198 P2-G2] surface created=${created} deleted=${deleted} leaked=${created - deleted}`,
    );
    expect(created).toBeGreaterThan(0);
    expect(deleted).toBe(created);
  }, 180_000);
});
