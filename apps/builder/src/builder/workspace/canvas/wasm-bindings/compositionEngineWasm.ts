/**
 * composition-engine WASM 모듈 초기화 래퍼 (ADR-916 Phase 2-B seam C-2a)
 *
 * Taffy 없는 자체 레이아웃 엔진(`packages/composition-engine`)의 wasm-pack
 * `--target bundler` 산출물(`pkg/`)을 전역 로드한다. taffy `rustWasm.ts` 와 동일
 * 패턴 — 비동기 로드로 전역 캐시를 채우고, 동기 wrapper(`CompositionEngineLayout`)
 * 가 그 캐시에서 `new LayoutEngine()` 을 즉시 생성한다.
 *
 * ## 왜 전역 캐시 + 동기 wrapper 인가
 *
 * `createLayoutEngine()`(layoutBridge.ts)은 **동기** factory 다 — PersistentTaffyTree
 * 생성자가 동기적으로 엔진을 요구한다. 그러나 WASM 로드는 비동기다. taffy 는 이
 * 갭을 `initRustWasm()`(startup 비동기) → `getRustWasm()`(동기 캐시 read) 으로
 * 해소한다. 자체 엔진도 동일 구조를 따른다: `initCompositionEngineWasm()` 을
 * startup(init.ts)에서 호출해 전역 캐시를 채우고, wrapper 는 캐시에서 즉시 생성.
 *
 * ## dual-run proof 전제 (no-dormant-foundation)
 *
 * 본 배선의 소비 경로(`createLayoutEngine` flag true)는 dualRunLive.test.ts
 * 12/12(B2 4 + C-1 3 + C-2b 5, 실전 대표 8형상 diff 0) proof 확보 후에만 켠다.
 * 배선 존재 ≠ flag 전환 — flag(`USE_RUST_LAYOUT_ENGINE`) flip 은 별도 gate.
 *
 * @see docs/adr/916-unified-rust-engine.md §Status log (C-2a)
 * @see apps/builder/.../wasm-bindings/rustWasm.ts (taffy 대응 패턴)
 */

// wasm-pack bundler 산출물의 `LayoutEngine` 클래스 타입(camelCase 16-메서드 계약).
// 자체 pkg 는 `LayoutEngineAPI`(layoutBridge.ts)와 이름 일치 — raw 반환(Uint32Array/
// Float32Array)만 wrapper 에서 number[]/Map 으로 변환한다.
export interface RawCompositionLayoutEngine {
  isAvailable(): boolean;
  buildTreeBatch(nodesJson: string): Uint32Array;
  buildTreeBatchBinary(data: Uint8Array): Uint32Array;
  hasBinaryProtocol(): boolean;
  createNodeRaw(styleJson: string): number;
  updateStyleRaw(handle: number, styleJson: string): void;
  setChildren(handle: number, children: Uint32Array): void;
  markDirty(handle: number): void;
  removeNode(handle: number): void;
  computeLayout(root: number, availW: number, availH: number): void;
  getLayoutsBatch(handles: Uint32Array): Float32Array;
  getLayout(handle: number): string;
  clear(): void;
  nodeCount(): number;
  free(): void;
}

interface CompositionEngineModule {
  LayoutEngine: { new (): RawCompositionLayoutEngine };
}

let engineModule: CompositionEngineModule | null = null;
let initPromise: Promise<void> | null = null;

/**
 * composition-engine WASM 모듈을 전역 로드한다.
 * startup(init.ts)에서 flag(USE_RUST_LAYOUT_ENGINE) 활성 시 1회 호출.
 * 중복 호출은 no-op(idempotent).
 */
export async function initCompositionEngineWasm(): Promise<void> {
  if (engineModule) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // wasm-pack --target bundler 산출물 — vite-plugin-wasm 이 .wasm 바이너리를
      // ES 모듈로 로드하면 import 시점에 자동 초기화된다(taffy 와 동일, __wbg_init
      // default export 없음). @vite-ignore 로 정적 분석 우회 + 런타임 동적 로드.
      //
      // 경로는 apps/builder **내부** 상대 경로(taffy `rustWasm.ts` 의 `./pkg/...`
      // 선례 미러링). wasm-pack out-dir 을 `composition-engine-pkg/`(dev 서버 root
      // 안)로 지정한다 — `/packages/composition-engine/pkg/...` 절대 URL 은 dev
      // 서버 root(apps/builder)를 벗어나 fetch 실패하기 때문. `package.json`
      // `wasm:build:engine` 스크립트가 이 out-dir 로 빌드한다.
      const mod = (await import(
        /* @vite-ignore */
        "./composition-engine-pkg/composition_engine.js"
      )) as unknown as CompositionEngineModule;

      if (!mod?.LayoutEngine || typeof mod.LayoutEngine !== "function") {
        engineModule = null;
        if (import.meta.env.DEV) {
          console.warn(
            "[composition-engine] WASM 모듈 불완전 — LayoutEngine 미포함, Taffy 폴백",
          );
        }
        return;
      }

      engineModule = mod;

      if (import.meta.env.DEV) {
        console.log("[ADR-916] composition-engine WASM initialized");
      }
    } catch (err) {
      engineModule = null; // HMR 잔류 방지
      if (import.meta.env.DEV) {
        console.warn(
          "[ADR-916] composition-engine WASM 초기화 실패, Taffy 폴백:",
          err,
        );
      }
    }
  })();

  return initPromise;
}

/** 로드된 모듈 반환(동기 캐시 read). 미로드 시 null. */
export function getCompositionEngineWasm(): CompositionEngineModule | null {
  return engineModule;
}

/** 엔진 사용 가능 여부(WASM 로드 성공 시 true). */
export function isCompositionEngineReady(): boolean {
  return engineModule !== null;
}
