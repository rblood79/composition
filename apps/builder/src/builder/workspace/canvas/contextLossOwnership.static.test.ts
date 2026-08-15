// @vitest-environment node
/**
 * WebGL 컨텍스트 손실 감시 — 단일 소유자 정적 가드
 *
 * **Why (2026-08-15 실측)**: 손실 리스너를 두 곳에서 걸고 있었고, 그 중
 * `useCanvasSurfaceLifecycle` 쪽은 **한 번도 등록되지 않았다**.
 * `containerRef.current?.querySelector("canvas")` 로 캔버스를 찾는데
 * `SkiaCanvas` 가 `React.lazy` + `Suspense fallback={null}` 이라 effect 가 도는
 * 시점엔 DOM 에 없어 조기 반환했고, 유일한 재실행 신호 `appReady` 는
 * 구 application 초기화 콜백에서만 켜져 상시 false 였다.
 * 결과: `isContextLost` 가 늘 false → `WorkspaceStatusIndicator` 의
 * "⚠️ GPU 리소스 복구 중" 이 한 번도 표시되지 않았다. (렌더 복구 자체는
 * `SkiaCanvas` 의 `watchContextLoss` 가 별도로 하고 있어 무증상이었다.)
 *
 * 계약: **캔버스를 소유한 층(SkiaCanvas)만** 자기 element 에 리스너를 걸고,
 * 렌더 복구(ref)와 사용자 알림(store)을 함께 발행한다. 밖에서 DOM 조회로
 * 찾아 거는 경로는 마운트 순서에 의존해 조용히 실패하므로 금지.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const canvasDir = dirname(fileURLToPath(import.meta.url));

function collectSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSources(full));
      continue;
    }
    if (!/\.tsx?$/.test(entry)) continue;
    if (entry.includes(".test.") || entry.endsWith(".bench.ts")) continue;
    out.push(full);
  }
  return out;
}

const sources = collectSources(canvasDir);

/**
 * 리스너 등록이 허용된 파일.
 * - `skia/createSurface.ts` — 소유자가 호출하는 등록 헬퍼
 * - `gpu/CanvasKitWebGLBackend.ts` — ADR-900 §Positive 가 명시한 WebGPU 전환
 *   경로용 백엔드 추상화. 현재 미배선(인스턴스화 0건)이나 의도된 보존이다.
 */
const REGISTRATION_ALLOWLIST = new Set([
  join("skia", "createSurface.ts"),
  join("gpu", "CanvasKitWebGLBackend.ts"),
]);

describe("WebGL 컨텍스트 손실 — 단일 소유자 계약", () => {
  it("리스너 등록은 허용된 두 파일에서만 한다", () => {
    const offenders = sources
      .filter((file) =>
        readFileSync(file, "utf8").includes(
          'addEventListener("webglcontextlost',
        ),
      )
      .map((file) => relative(canvasDir, file))
      .filter((rel) => !REGISTRATION_ALLOWLIST.has(rel));

    expect(offenders).toEqual([]);
  });

  it("캔버스 소유자(SkiaCanvas)가 감시하고 store 까지 발행한다", () => {
    const src = readFileSync(join(canvasDir, "skia", "SkiaCanvas.tsx"), "utf8");

    expect(src).toContain("watchContextLoss(");
    // 렌더 복구용 ref 와 사용자 알림용 store 를 **둘 다** 갱신해야 한다.
    expect(src).toContain("contextLostRef.current");
    expect(src).toContain("setContextLost(");
  });

  it("DOM 조회로 캔버스를 찾아 리스너를 거는 경로가 없다", () => {
    // 이 패턴이 병인이었다 — lazy 마운트에서 element 를 못 찾고 조용히 실패한다.
    const offenders = sources
      .filter((file) => {
        const src = readFileSync(file, "utf8");
        return (
          src.includes('querySelector("canvas")') &&
          src.includes("webglcontext")
        );
      })
      .map((file) => relative(canvasDir, file));

    expect(offenders).toEqual([]);
  });
});
