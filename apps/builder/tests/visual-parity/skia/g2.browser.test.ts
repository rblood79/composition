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
   * 않다.
   *
   * 2026-08-31 이전에는 `basic-geometry-paint` 만 `variance 0` 이었고 (전부
   * `frame` 컨테이너), 그 값을 ratchet 으로 박아 두었다. 정황이 가리킨 대로
   * 원인은 **`frame` 축**이 맞았다 — `FrameSpec.render.shapes()` 가 `props.style`
   * 을 읽지 않아 배경 shape 자체를 만들지 않았고, 거기에 hex8 채널 시프트가
   * 겹쳐 있었다 (ADR-198 §7 별도 작업으로 수리).
   *
   * 이제 세 케이스 모두 살아 있다. 개별 수치를 다시 박지 않는 이유: 고정값은
   * fixture 를 조금만 손대도 깨지면서 정작 "죽은 프레임" 은 못 잡는다. G2 가
   * 실제로 요구하는 것은 **모든 케이스가 0 보다 크다** 이므로 그것만 단언하고,
   * 실측치는 로그로 남긴다.
   */
  it("모든 케이스가 살아 있는 프레임을 낸다 (G2 liveness / HC11)", () => {
    const rows = PILOT_CASES.map((c) => {
      const r = runSkiaLegResult(ck, c.document, optsFor(c), envFor(c));
      return { id: c.id, variance: pixelVariance(r.pixels!) };
    });
    for (const r of rows)
      console.log(
        `[ADR-198 P2-G2] liveness ${r.id}: variance=${r.variance.toFixed(1)}`,
      );

    for (const r of rows) expect.soft(r.variance).toBeGreaterThan(0);
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
