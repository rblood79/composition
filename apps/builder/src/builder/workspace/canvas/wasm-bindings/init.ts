/**
 * WASM 모듈 통합 초기화
 *
 * composition-engine(자체 layout 엔진 + SpatialIndex)과 CanvasKit 을 병렬로
 * 초기화한다.
 *
 * ADR-916 Taffy 완전 제거 (2026-07-06): Taffy pkg(rustWasm) 로드 블록 +
 * Layout Worker(LAYOUT_WORKER:false, dead) 블록 삭제 — 자체 엔진 단일 로드.
 *
 * @see docs/RENDERING_ARCHITECTURE.md §WASM 초기화 통합
 */

let wasmReady = false;

export async function initAllWasm(): Promise<void> {
  if (wasmReady) return;

  try {
    const { WASM_FLAGS } = await import("./featureFlags");
    const tasks: Promise<void>[] = [];

    // composition-engine(자체 taffy-free 엔진) WASM.
    // createLayoutEngine()(동기)이 전역 캐시를 읽으려면 startup 에서 먼저
    // await 돼 있어야 한다. SpatialIndex(같은 pkg 에 crate 분리 편입) 초기화도
    // 여기서 — 한 번의 로드로 둘 다 준비된다.
    {
      const { isUnifiedFlag } = await import("./featureFlags");
      if (isUnifiedFlag("USE_RUST_LAYOUT_ENGINE")) {
        const { initCompositionEngineWasm, isCompositionEngineReady } =
          await import("./compositionEngineWasm");
        tasks.push(
          initCompositionEngineWasm().then(async () => {
            if (isCompositionEngineReady() && WASM_FLAGS.SPATIAL_INDEX) {
              const { initSpatialIndex } = await import("./spatialIndex");
              initSpatialIndex();
            }
          }),
        );
      }
    }

    // CanvasKit/Skia WASM (메인 렌더러)
    if (WASM_FLAGS.CANVASKIT_RENDERER) {
      const { initCanvasKit } = await import("../skia/initCanvasKit");
      tasks.push(initCanvasKit().then(() => {}));
    }

    await Promise.all(tasks);
    wasmReady = true;
  } catch (error) {
    console.error("[WASM] 초기화 실패:", error);
  }
}

export function isWasmReady(): boolean {
  return wasmReady;
}
