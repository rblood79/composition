# Taffy 완전 제거 설계 (ADR-916 endgame)

**작성일**: 2026-07-06
**관련 ADR**: [ADR-916](../../adr/916-unified-rust-engine.md) — 자체 단일 Rust 레이아웃 엔진 통합 (Implemented 2026-07-06)
**선행 조건**: endgame kill criteria 3/3 충족 (① 독립 oracle tree_golden / ② SpatialIndex 분리 / ③ Status=Implemented)

## Goal

자체 엔진(`composition-engine`) 단독 운영으로 전환한다. Taffy 3-crate 중 2개(composition-layout, composition-wasm) + Taffy 소비 JS(로더/폴백/worker/dual-run leg)를 전면 물리 삭제하고, R4 폴백 안전망 소멸을 부트스트랩 재시도 강화로 보상한다.

## Context

### 3-domain 분류

본 작업은 D3(시각 스타일)의 **엔진 인프라 정리**다. 시각 결과(레이아웃 계산 산출) 자체는 자체 엔진이 이미 live 담당(C-2a flip 완료)하며, 본 작업은 대체된 Taffy의 잔존 물리 자산 제거다. SSOT 경계 변경 없음 — Spec은 여전히 D3 정본, 엔진은 그 consumer.

### Hard constraints

- **live 부팅 무파손**: Taffy 제거 후에도 builder가 정상 부팅 + 자체 엔진으로 layout 계산 + Canvas↔CSS 시각 정합 유지
- **type-check baseline 초과 0**: 삭제된 심볼 참조가 소스에 0건
- **자체 엔진 테스트 유지**: `composition-engine` cargo test (tree_golden 6 + lib + golden) 무손실
- **R4 소멸 보상**: 폴백 없이도 일시적 WASM 로드 실패에 견고 (15초 폴링/재시도)

### 실측 crate 인벤토리 (2026-07-06)

| crate              | 위치                                                | taffy | live 소비                                                           | 판정 |
| ------------------ | --------------------------------------------------- | ----- | ------------------------------------------------------------------- | ---- |
| composition-layout | `packages/composition-layout/` (3파일)              | 0.10  | Phase 0-A 폐기 경로 `compositionLayout` — createLayoutEngine 미소비 | 삭제 |
| composition-wasm   | `apps/builder/.../canvas/wasm/` (5파일 / 3,578라인) | 0.9   | `rustWasm.ts`→`TaffyLayout`→R4 폴백 실체                            | 삭제 |
| composition-engine | `packages/composition-engine/` (10파일)             | 없음  | live 현역                                                           | 존치 |

## 결정 (관점 lock-in)

- **Q1 (자체 엔진 로드 실패 시 동작)**: **B — 재시도 강화 후 hard fail**. 기존 15초 폴링/재시도 부트스트랩 로직을 자체 엔진에 그대로 적용, 최종 실패 시에만 `wasmLayoutFailed` 에러. 폴백 코드 신규 작성 없음(완전 제거 취지 유지).
- **Q2 (물리 삭제 범위)**: **A — 이번에 물리 삭제까지**. crate 디렉토리 `git rm` + pkg 산출물 `git rm` + build 스크립트 제거를 한 작업으로 완결. `git rm`이라 히스토리 복구 가능. 원본 crate 디렉토리 삭제 명시 승인 완료 (2026-07-06).

### 기각된 대안

- Q1-A (Hard fail + 에러 UI): 일시적 로드 실패에 취약 — 재시도 없이 즉시 에러
- Q1-C (JS 최소 폴백 유지): 새 폴백 코드 작성 = "완전 제거" 취지 상충 + 정합성 미검증
- Q2-B (crate orphan 존치): dead 디렉토리가 리포에 잔존 — 완전 제거 미완

## 삭제/변경 인벤토리 (4 그룹)

### 그룹 1 — Rust crate 물리 삭제 (`git rm`)

- `packages/composition-layout/` (전체, taffy 0.10)
- `apps/builder/src/builder/workspace/canvas/wasm/` (composition-wasm 소스, taffy 0.9)
- `apps/builder/src/builder/workspace/canvas/wasm-bindings/pkg/` (composition_wasm WASM 산출물 452K)

### 그룹 2 — JS 본체 삭제 (`git rm`)

- `wasm-bindings/taffyLayout.ts` (TaffyLayout 클래스)
- `wasm-bindings/rustWasm.ts` (composition_wasm 로더)
- `wasm-worker/` 전체 (bridge.ts / index.ts / LayoutScheduler.ts / layoutWorker.ts / protocol.ts — LAYOUT_WORKER:false, dead)
- `layout/engines/dualRunEngines.ts` (Taffy leg adapter)
- `layout/engines/dualRunHarness.ts` (dual-run 비교 하네스)
- `layout/engines/dualRunHarness.test.ts`
- `layout/engines/dualRunLive.test.ts`
- `layout/engines/persistentTaffyTree.seam.test.ts`

### 그룹 3 — JS 재배선 (edit, HIGH)

- **`layoutBridge.ts`**: `TaffyLayout` import + `new TaffyLayout()` 폴백(line 84) 제거. `createLayoutEngine()`은 자체 엔진 단독 반환. 미준비 시 throw(부트스트랩 재시도가 처리). `LayoutResult` 타입 re-export 소스를 `compositionEngine.ts`로 이전.
- **`useCanvasRuntimeBootstrap.ts`**: `isRustWasmReady`/`initRustWasm`(rustWasm) → `isCompositionEngineReady`/`initCompositionEngineWasm`(compositionEngineWasm) 심볼 치환. **폴링/재시도 15초 구조 그대로 유지 (Q1=B)**. 변수명 `wasmLayout*`는 의미 보존(자체 엔진 준비 상태).
- **`init.ts`**: 그룹1/2 로드 블록(`WASM_FLAGS.LAYOUT_ENGINE` → rustWasm, line 22-25) 제거 + LAYOUT_WORKER 블록(line 60-73) 제거. 자체 엔진 로드 블록(34-48)만 존치.
- **`featureFlags.ts`**: `LAYOUT_ENGINE`/`LAYOUT_WORKER` WASM_FLAGS 항목 제거. `USE_RUST_LAYOUT_ENGINE`는 자체 엔진이 상시 경로가 되므로 정리(제거 또는 상수 true 유지 — 소비처 영향 최소 방향). `isUnifiedFlag` 호출부 정합 확인.

### 그룹 4 — build 설정 정리 (edit)

- 루트 `package.json`: `build:layout`(composition-layout), `wasm:build`(composition-wasm), `wasm:dev`, `wasm:test` 스크립트 제거. `wasm:build:engine`(자체 엔진)만 존치.
- `apps/builder/package.json:20`: `wasm:build`(composition-wasm) 제거.

## 보존 (이름만 Taffy — taffy 의존 아님)

- `TaffyFlexEngine.ts` / `TaffyBlockEngine.ts` / `TaffyGridEngine.ts`: `elementToTaffyStyle` / `elementToTaffyBlockStyle` / `parseGridTemplate` — element→style 순수 JS 변환 유틸. `fullTreeLayout.ts:41-43` live import. 자체 엔진도 이 변환을 소비. **삭제 금지.**
- `persistentTaffyTree.ts`: 파일명은 Taffy지만 `createLayoutEngine()` 경유로 자체 엔진 주입받음. 파일 rename은 본 scope 밖(별도 판단).

## Data flow (재배선 후)

```
startup (init.ts)
  → initCompositionEngineWasm() [자체 엔진 pkg 로드]
     → initSpatialIndex() [같은 pkg]
  → initCanvasKit()

useCanvasRuntimeBootstrap
  → isCompositionEngineReady() 게이트 (기존 isRustWasmReady 대체)
  → 미준비 시 15초 폴링/재시도 → 최종 실패 시 wasmLayoutFailed

layout 계산
  → PersistentTaffyTree.constructor
     → createLayoutEngine() [layoutBridge]
        → new CompositionEngineLayout() [자체 엔진, 폴백 없음]
```

## Error handling

- 자체 엔진 WASM 미준비 (startup 전 호출 / 로드 실패): `createLayoutEngine()`이 자체 엔진 반환하되 `isAvailable()` false. 부트스트랩 폴링이 준비 대기 → 15초 초과 시 `wasmLayoutFailed=true` + 콘솔 에러. **폴백 없음** (R4 소멸).
- 기존 `TaffyLayout` 안전 폴백 경로 완전 제거.

## Testing

1. `pnpm type-check` — 삭제 심볼 참조 0 (baseline 초과 0)
2. `cargo test` (composition-engine) — tree_golden 6 + lib + golden 유지. composition-wasm/composition-layout cargo test는 삭제와 함께 소멸(정상).
3. `vitest` — 삭제된 dualRun 4 test 제외, 나머지 layout 관련 test PASS
4. **live behavior exercise (CLAUDE.md 완료 기준)** — Chrome MCP: builder 진입 → `[ADR-916] composition-engine WASM initialized` 로그 + 콘솔 에러 0 + Canvas(Skia 자체 엔진 layout)↔CSS Preview 시각 정합. **Taffy 폴백 없이 자체 엔진 단독 부팅 확증** (핵심 게이트)

## Risks

| ID  | 위험                                                                     | 심각도 | 대응                                                                        |
| --- | ------------------------------------------------------------------------ | :----: | --------------------------------------------------------------------------- |
| R1  | R4 폴백 소멸 — 자체 엔진 실패 시 폴백 없음                               |  HIGH  | Q1=B 재시도 강화(15초 폴링). live exercise로 정상 부팅 확증                 |
| R2  | 부팅 게이트 미스와이어링 (isRustWasmReady→isCompositionEngineReady 누락) |  HIGH  | type-check 미탐지 영역 — live exercise가 유일 검증. 앱 영구 로딩 여부 확인  |
| R3  | LayoutResult 타입 re-export 끊김 (taffyLayout.ts 삭제)                   |  MED   | compositionEngine.ts로 타입 소스 이전 후 소비처 import 정합                 |
| R4  | dualRunLive 감시망 소멸                                                  |  LOW   | tree_golden(Taffy-비의존 독립 oracle)이 이미 대체 담당 — endgame criteria ① |

## Consequences

### Positive

- Taffy 외부 의존 완전 제거 — 단일 엔진 SSOT 달성
- 번들 감소 (composition_wasm pkg 452K + dual-run 코드)
- 부팅 경로 단순화 (이중 WASM 로드 → 자체 엔진 단일)
- R4 폴백 이중화 HIGH 위험 소멸 (ADR-916 잔존 위험 해소)

### Negative

- 폴백 안전망 없음 — 자체 엔진 로드 실패 시 layout 전멸 (재시도로 완화하나 근본 폴백 부재)
- dualRunLive 자체-vs-Taffy 비교 검증 소멸 (tree_golden으로 대체됐으나 비교 축은 상실)
