/**
 * WASM 모듈 통합 초기화
 *
 * Phase 0-5 WASM 모듈을 병렬로 초기화한다.
 *
 * @see docs/RENDERING_ARCHITECTURE.md §WASM 초기화 통합
 */

let wasmReady = false;

export async function initAllWasm(): Promise<void> {
  if (wasmReady) return;

  try {
    const { WASM_FLAGS } = await import("./featureFlags");
    const tasks: Promise<void>[] = [];

    // Phase 1-2: Rust WASM 모듈 (SpatialIndex, Layout Engine)
    if (WASM_FLAGS.SPATIAL_INDEX || WASM_FLAGS.LAYOUT_ENGINE) {
      const { initRustWasm, isRustWasmReady } = await import("./rustWasm");
      tasks.push(
        initRustWasm().then(async () => {
          if (isRustWasmReady() && WASM_FLAGS.SPATIAL_INDEX) {
            const { initSpatialIndex } = await import("./spatialIndex");
            initSpatialIndex();
          }
        }),
      );
    }

    // ADR-916 Phase 2-B seam C-2a: composition-engine(자체 taffy-free 엔진) WASM.
    // flag(USE_RUST_LAYOUT_ENGINE) 활성 시에만 로드 — createLayoutEngine()(동기)이
    // 전역 캐시를 읽으려면 startup 에서 먼저 await 돼 있어야 한다. flag false 면
    // 로드 자체를 skip(번들/init 비용 0, live 영향 0).
    {
      const { isUnifiedFlag } = await import("./featureFlags");
      if (isUnifiedFlag("USE_RUST_LAYOUT_ENGINE")) {
        const { initCompositionEngineWasm } =
          await import("./compositionEngineWasm");
        tasks.push(initCompositionEngineWasm());
      }
    }

    // Phase 5: CanvasKit/Skia WASM (메인 렌더러)
    if (WASM_FLAGS.CANVASKIT_RENDERER) {
      const { initCanvasKit } = await import("../skia/initCanvasKit");
      tasks.push(initCanvasKit().then(() => {}));
    }

    await Promise.all(tasks);
    wasmReady = true;

    // Phase 4: Layout Worker (Rust WASM 초기화 후)
    if (WASM_FLAGS.LAYOUT_WORKER) {
      const { isRustWasmReady } = await import("./rustWasm");
      if (isRustWasmReady()) {
        try {
          const { initLayoutWorker } = await import("../wasm-worker");
          await initLayoutWorker();
        } catch (err) {
          console.warn(
            "[WASM] Layout Worker 초기화 실패, 메인 스레드 폴백:",
            err,
          );
        }
      }
    }
  } catch (error) {
    console.error("[WASM] 초기화 실패, JS 폴백 사용:", error);
  }
}

export function isWasmReady(): boolean {
  return wasmReady;
}
