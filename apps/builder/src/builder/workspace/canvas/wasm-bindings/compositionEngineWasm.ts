/**
 * composition-engine WASM 모듈 초기화 래퍼 (ADR-916 Phase 2-B seam C-2a)
 *
 * 엔진 없는 자체 레이아웃 엔진(`packages/composition-engine`)의 wasm-pack
 * `--target bundler` 산출물(`composition-engine-pkg/`)을 전역 로드한다.
 * 비동기 로드로 전역 캐시를 채우고, 동기 wrapper(`CompositionEngineLayout`)
 * 가 그 캐시에서 `new LayoutEngine()` 을 즉시 생성한다.
 *
 * ## 왜 전역 캐시 + 동기 wrapper 인가
 *
 * `createLayoutEngine()`(layoutBridge.ts)은 **동기** factory 다 — PersistentLayoutTree
 * 생성자가 동기적으로 엔진을 요구한다. 그러나 WASM 로드는 비동기다. 이 갭은
 * `initCompositionEngineWasm()` 을 startup(init.ts)에서 호출해 전역 캐시를 채우고,
 * wrapper 는 캐시에서 즉시 생성하는 구조로 해소한다.
 *
 * @see docs/adr/916-unified-rust-engine.md §Status log (C-2a)
 */

// wasm-pack bundler 산출물의 `LayoutEngine` 클래스 타입(camelCase 16-메서드 계약).
// 자체 pkg 는 `LayoutEngineAPI`(layoutBridge.ts)와 이름 일치 — raw 반환(Uint32Array/
// Float32Array)만 wrapper 에서 number[]/Map 으로 변환한다.
export interface RawCompositionLayoutEngine {
  isAvailable(): boolean;
  buildTreeBatch(nodesJson: string): Uint32Array;
  buildTreeBatchBinary(data: Uint8Array): Uint32Array;
  hasBinaryProtocol(): boolean;
  /** strict 입력 토글 — 하니스·진단 전용 (기본 false). */
  setStrictInput(enabled: boolean): void;
  /** 엔진이 읽지 않는 키 진단 — `[{index, keys}]` JSON 문자열. hot path 금지. */
  inspectUnknownKeys(nodesJson: string): string;
  createNodeRaw(styleJson: string): number;
  updateStyleRaw(handle: number, styleJson: string): void;
  setChildren(handle: number, children: Uint32Array): void;
  markDirty(handle: number): void;
  removeNode(handle: number): void;
  computeLayout(root: number, availW: number, availH: number): void;
  getLayoutsBatch(handles: Uint32Array): Float32Array;
  getLayout(handle: number): string;
  // ADR-183 판정 트레이스 (디버그 채널) — 배치 payload 와 별도 API (HC3).
  enableLayoutTrace(enabled: boolean): void;
  getLayoutTrace(handle: number): string;
  clear(): void;
  nodeCount(): number;
  free(): void;
}

// SpatialIndex 클래스 타입 — hit-test/viewport culling 공간 인덱스.
// ADR-916 SpatialIndex crate 분리(2026-07-05): 기존 composition_wasm(Taffy) crate 에서
// composition-engine(taffy-free) crate 로 이동 — endgame Taffy 완전 제거의 crate
// 물리 결합 해소(kill criteria ③). SpatialIndex 는 taffy 의존 0 + 코드 결합 0 이라
// 자체 엔진 crate 로 clean 이동. LayoutEngine 과 같은 pkg 에서 로드된다.
export interface RawSpatialIndex {
  upsert(id: number, x: number, y: number, w: number, h: number): void;
  batch_upsert(data: Float32Array): void;
  query_viewport(
    left: number,
    top: number,
    right: number,
    bottom: number,
  ): Uint32Array;
  query_rect(
    left: number,
    top: number,
    right: number,
    bottom: number,
  ): Uint32Array;
  query_point(px: number, py: number): Uint32Array;
  remove(id: number): void;
  clear(): void;
  count(): number;
  free(): void;
}

interface CompositionEngineModule {
  LayoutEngine: { new (): RawCompositionLayoutEngine };
  SpatialIndex: { new (cellSize: number): RawSpatialIndex };
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
      // ES 모듈로 로드하면 import 시점에 자동 초기화된다(__wbg_init
      // default export 없음). 정적 import 경로를 유지해 production에서도
      // JS/WASM 자산이 번들에 포함되도록 한다.
      //
      // 경로는 apps/builder **내부** 상대 경로. wasm-pack out-dir 을
      // `composition-engine-pkg/`(dev 서버 root
      // 안)로 지정한다 — `/packages/composition-engine/pkg/...` 절대 URL 은 dev
      // 서버 root(apps/builder)를 벗어나 fetch 실패하기 때문. `package.json`
      // `wasm:build:engine` 스크립트가 이 out-dir 로 빌드한다.
      //
      // @vite-ignore 를 붙이지 않는다 (2026-09-06 판독 오탐 정정) — 붙이면
      // Vite 가 이 경로를 번들에 넣지 않아 production 에서 404 로 부팅이 95%
      // 에 멈춘다. 산출물이 gitignored 라 빌드가 깨진다는 지적이 있었으나,
      // deploy.yml 은 build 전에 `pnpm wasm:build:engine` 을 돌리고 fresh
      // clone 도 같은 순서가 필수다 (CLAUDE.md §명령·환경).
      const mod =
        (await import("./composition-engine-pkg/composition_engine.js")) as unknown as CompositionEngineModule;

      if (!mod?.LayoutEngine || typeof mod.LayoutEngine !== "function") {
        engineModule = null;
        if (import.meta.env.DEV) {
          console.warn(
            "[composition-engine] WASM 모듈 불완전 — LayoutEngine 미포함 (폴백 없음, 부트스트랩 재시도 대기)",
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
          "[ADR-916] composition-engine WASM 초기화 실패 (폴백 없음, 부트스트랩 재시도 대기):",
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
