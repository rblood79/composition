# fulgur 설계 패턴 대조 — composition 적용 판정 (2026-09-03)

> 대상: [fulgur-rs/fulgur](https://github.com/fulgur-rs/fulgur) main (0.40.0, shallow clone). Blitz(Stylo · Taffy · Parley) 위에 자체 페이지 분할과 Krilla PDF 출력을 얹은 Rust HTML→PDF 엔진. 라이브러리·CLI 플러그인으로 쓰지 않고 **코드 구조와 검증 체계의 이론**만 골라 composition 의 현재 상태 (before) 와 적용 후 형태 (after) 로 판정했다. 근거는 양쪽 저장소의 파일·행 번호. 아티팩트 판: https://claude.ai/code/artifact/8619a00c-71bd-45d3-8969-bdf66eab6bb2

## 0. 요약

- **판정**: 적용 권장 5 · 조건부 2 · 이미 동등 3 · 비적용 6. 권장 5 는 전부 **동작 변경 0 절차** (원복 RED 는 새 게이트가 반응하는 행만, live 생략 가 — `.claude/rules/review-loop-closure.md` §3) 로 닫힌다.
- **권장 5**: ① TS 단위 브랜드 타입 (CSS px · scene · device px) ② wasm 입력 strict 모드 (`deny_unknown_fields`) ③ 결정성 기준선 축 (커밋 golden + update 플래그 + 엔진 run-twice) ④ CanvasKit 어댑터 격리 (51 파일 직접 import → `skia/ck/`) ⑤ CSS 지원 매트릭스 문서를 `layoutCapabilityMatrix.ts` 에서 생성 + Taffy 잔재 주석 sweep.
- **성능**: 5개 모두 런타임 hot path 를 바꾸지 않는 구현 형태가 있고, 그 형태를 벗어나면 내려가는 지점이 각각 하나 (§5).
- **부수 발견**: `docs/CSS_SUPPORT_MATRIX.md` (1,275행) 가 2026-04-06 에 멈춰 제거된 Taffy 엔진 파일 경로를 71건 인용한다. builder 비테스트 코드 35 파일의 주석에도 "Taffy" 가 남아 있다 (식별자는 ADR-923 6a 로 전부 rename 됨).
- **순서 제안**: ② → ④ → ⑤ (서로 독립, 각 1 phase) → ③ (golden 커밋 결정 필요) → ① (스칼라 변환 12곳으로 한정하면 1 phase, 렌더러 행렬까지 넓히면 별도 ADR).

## 1. 코드 사실 — fulgur

| 사실                                                                                                                                                                                                         | 경로                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `Px(f32)` / `Pt(f32)` newtype, `#[repr(transparent)]`, 교차 단위 연산은 `compile_fail` doctest 로 컴파일 거부. `PX_TO_PT = 0.75` 는 crate 에 한 곳                                                           | `crates/fulgur/src/units.rs`                                     |
| 변환 어휘 — `.as_px()` (raw f32 태깅) · `.in_pt()` (변환) · `.to_f32()` (FFI 경계에서만). diff 의 "첫 hop" 으로 값의 출처를 읽는다                                                                           | `units.rs` 모듈 doc · `.claude/rules/coordinate-system.md`       |
| 이 계열 버그를 "4/3× 또는 3/4× 스케일 버그" 로 명명. 타입이 private 인 동안 이관을 끝내고 공개는 한 번만. byte-neutral 레시피: 경계에서 한 번 곱하고 `+` 안으로 분배 금지, 증명 = golden 무변화              | `docs/plans/2026-06-27-engine-layout-api-design.md` §5, §7       |
| Blitz 타입을 `pub use blitz_dom::{BaseDocument, Node, NodeData}` 로 재수출, enum 매칭은 헬퍼로 감싸 upstream rename 을 한 파일에서 흡수 (7.2k LOC)                                                           | `crates/fulgur/src/blitz_adapter.rs`                             |
| `Drawables` = 관심사별 `BTreeMap<NodeId, _>`, 중앙 DrawOp enum 없음. `TrackedMap` 이 삽입 로그로 "mark 이후 삽입된 키" 를 O(k) 로 복구. 결정성 위해 HashMap 대신 BTreeMap                                    | `crates/fulgur/src/drawables.rs` · `CLAUDE.md` Gotchas           |
| 기하를 `PaginationGeometryTable` 에 1회 기록, 분할 중 재레이아웃 금지 ("Taffy 를 다시 돌리면 sub-pixel 드리프트로 바이트 비교가 깨진다")                                                                     | `crates/fulgur/src/pagination_layout.rs` 헤더                    |
| `LayoutOutput { drawables, geometry }` `#[non_exhaustive]`, `layout()` 과 `render()` 가 같은 `layout_to_drawables` 를 탄다 (레이아웃 경로 1본). `target-*` 교차 참조는 2-pass                                | `crates/fulgur/src/engine.rs:48-53, 757`                         |
| fulgur-wpt: WPT 서브디렉터리를 자체 러너로. `expectations/<subdir>.txt` 에 `PASS / FAIL / SKIP`, `judge(declared, observed)` → Ok / Regression (CI 실패) / Promotion (경고) / Skipped / UnknownTest          | `crates/fulgur-wpt/src/expectations.rs` · `runner.rs`            |
| css-page 초기 seed: 84 PASS · 139 FAIL · 34 SKIP / 257. `expectations/lists/*.txt` 마다 `build.rs` 가 `#[test]` 생성. `bugs.txt` 는 결함별 블록 — FAIL = primary repro, PASS = regression net, issue id 병기 | `crates/fulgur-wpt/expectations/`                                |
| WPT `<meta name="fuzzy">` 를 그대로 tolerance 로. PR CI 는 `continue-on-error`, nightly 는 `regressions.json` 비어 있지 않으면 issue 자동 생성                                                               | `crates/fulgur-wpt/src/harness.rs:87-108` · `README.md`          |
| fulgur-vrt: PDF 바이트 동일 비교 vs 커밋된 `goldens/**/*.pdf`. `FULGUR_VRT_UPDATE=1` (전체) / `=failing` (실패분만). 실패 시 pdftocairo diff PNG + actual.pdf 를 `target/vrt-diff/` 에                       | `crates/fulgur-vrt/README.md` · `src/diff.rs`                    |
| run-twice (`examples_determinism.rs`) 와 golden 비교를 구분: "run-twice 는 비결정성을 잡고 값 드리프트는 못 잡는다. golden-vs-baseline 이 byte-neutrality 의 실질 증명"                                      | `docs/plans/2026-06-27-engine-layout-api-design.md` Spike 절     |
| fulgur-wasm 옵션 구조체 `#[serde(rename_all = "camelCase", deny_unknown_fields)]`                                                                                                                            | `crates/fulgur-wasm/src/lib.rs`                                  |
| `docs/css-support.md`: 기능별 도입 버전 (`box-shadow (v0.4.5+)`), Supported / Not yet supported, 미지원 시 동작 (`inset` 은 `log::warn!` 후 skip)                                                            | `docs/css-support.md`                                            |
| 스파이크 문서에 두 경로를 같은 fixture 10개로 돌린 비교표. thread-safety 조사는 틀린 결론을 지우지 않고 "같은 오진 반복 방지" 배너와 함께 보존                                                               | `docs/plans/2026-04-28-*spike.md` · `2026-04-11-*thread-safety*` |

## 2. 코드 사실 — composition

| 사실                                                                                                                                                                                                          | 경로                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 자체 Rust 엔진 17k LOC, Taffy 의존 없음 ("부재가 존재 이유 — 추가 금지"). deps: wasm-bindgen · js-sys · serde · serde_json                                                                                    | `packages/composition-engine/Cargo.toml:5, 15-19`                                                                                                                      |
| `deny_unknown_fields` 0건. `Deserialize` 구조체 2개, `buildTreeBatch` 가 JSON 문자열을 `serde_json::from_str` 로 읽음. `NodeStyle` 필드 전부 `Option<String>`                                                 | `src/tree.rs:183, 303, 728`                                                                                                                                            |
| wasm 출력 = stride-5 `Float32Array` `[x, y, w, h, baseline]`, 단일 노드는 손으로 만든 JSON 문자열. binary protocol 은 stub (`hasBinaryProtocol` false)                                                        | `src/wasm.rs:80-91, 145-169`                                                                                                                                           |
| HashMap 은 `spatial_index.rs:14-18` · `trace.rs:165-167` 조회 전용. cascade 는 순회 결정성 위해 BTreeMap (주석 명시)                                                                                          | `src/cascade.rs:380-384`                                                                                                                                               |
| 좌표 세 공간 (CSS px · zoom scene · device px) 전부 bare `number`. 구분은 이름만 — `contentPaddingCssPx` / `contentPaddingDevicePx`, `thresholdScenePx`                                                       | `skia/SkiaRenderer.ts:161, 163` · `interaction/guideHitTest.ts:71`                                                                                                     |
| 캔버스 변환 `scale(dpr)` → `scale(zoom)` 4곳 반복, blit 경로는 다른 식으로 유도. 역변환 `/ dpr` 손계산 6곳+, `1/zoom` 스트로크 보정 overlay 3 파일                                                            | `SkiaRenderer.ts:605, 710, 841, 1128, 789-799` · `skiaFramePlan.ts:310` · `skiaOverlayBuilder.ts:689, 721, 885` · `hoverRenderer.ts:111, 156, 284` · `export.ts:75-77` |
| 이름 접미사 계약이 깨진 이력: content-box 반환 계약이 border-box 로 어긋나 density 4px 가 행 높이 16px 로 증폭. ADR-198 R14 는 0.804 배 스케일 불일치                                                         | 메모리 `feedback-borderbox-return-plus-engine-padding-double-count` · `docs/adr/198-*.md:373`                                                                          |
| `skia/` 121 파일 중 51 파일이 `canvaskit-wasm` 직접 import (비테스트 35). 감싸는 것은 `createSurface.ts` (73) · `initCanvasKit.ts` (100) 초기화만. `RenderCommandStream` 도 Skia 타입을 import                | `skia/renderCommands.ts:11-17, 265, 718-755`                                                                                                                           |
| enum 접근 (`ck.PaintStyle.*`, `ck.BlendMode.*` 등) 그리기 경로 115곳                                                                                                                                          | `skia/**/*.ts` (비테스트)                                                                                                                                              |
| 레이아웃 재사용: `getSharedLayoutMap()` 버전 memo, 페이지 서명 캐시, 엔진 `markDirty` 증분                                                                                                                    | `layout/engines/fullTreeLayout.ts:489-500` · `scene/layoutCache.ts:207-243` · `src/lib.rs:52-56`                                                                       |
| visual-parity: Skia SW raster `readPixels` vs Preview DOM 스크린샷, region 별 `maxDiffRatio` AND `maxByte`, pixelmatch 0.1. **golden 미커밋** (`.artifacts/.gitignore` = `*`), runner 에 update 플래그 없음   | `tests/visual-parity/harness/{skiaRunner,domCapture,compare}.ts` · `scripts/visual-parity-gate.mjs`                                                                    |
| 결정성 게이트 = 10회 연속 RGBA 해시 동일 + `maxByte 0` + liveness 가드 (run-twice 축만). 엔진 레이아웃 출력에는 run-to-run 테스트 없음                                                                        | `visual-parity/skia/productionLeg.browser.test.ts:170-187` · `doctor:136` · `g2:49-79`                                                                                 |
| `knownDefects.ts` 는 결함을 정확 개수로 고정 (고쳐져도 악화돼도 실패). ledger `APPROVED_EXCEPTIONS` 비어 있음                                                                                                 | `visual-parity/harness/knownDefects.ts:1-38` · `ledger.ts:8-9`                                                                                                         |
| tests/parity 46 파일 15,379 LOC. leg 1 = live Chromium `getBoundingClientRect`, leg 2 = 엔진 wasm — "golden.rs 의 순환 oracle 을 끊는다". WPT 미사용                                                          | `tests/parity/harness.ts:9-24`                                                                                                                                         |
| `docs/CSS_SUPPORT_MATRIX.md` 1,275행, 최종 갱신 2026-04-06, "Taffy" 71건 (`TaffyFlexEngine.ts:210` 등 존재하지 않는 경로). `layoutCapabilityMatrix.ts` (144 LOC, import 0) + 대조 테스트 353 LOC 는 살아 있음 | `docs/CSS_SUPPORT_MATRIX.md:5, 24-36` · `layout/engines/layoutCapabilityMatrix.ts` · `tests/parity/adr923CapabilityMatrixSeed.browser.test.ts`                         |
| builder 비테스트 코드 35 파일 주석에 "Taffy" 잔존 ("Skia/Taffy", "Taffy/Dropflow 엔진", "Taffy 레이아웃 결과")                                                                                                | `canvas/elementRegistry.ts:64` · `layoutContext.ts:4` · `skia/useSkiaNode.ts:93` · `buildSkiaNodeData.ts:32` · `StoreRenderBridge.ts:1701`                             |
| TS 2-pass: Step 4.5 height-for-width 재측정, 보류안 A (엔진 measure callback) 재개 조건 = 2-pass 비용                                                                                                         | `fullTreeLayout.ts:2820-2827`                                                                                                                                          |

## 3. 판정 요약

| #   | 패턴                                                               | fulgur 의 형태                                         | composition 현재                                           | 판정   |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------- | ------ |
| 1   | 단위 newtype 과 diff 어휘                                          | `Px`/`Pt` newtype, 교차 연산 컴파일 거부               | CSS px · scene · device px 전부 bare number, 이름 접미사만 | 권장   |
| 2   | wasm 입력 경계의 미지 키 거부                                      | `deny_unknown_fields`                                  | 0건, 미지 키 무음 드롭 (parity 오탐 132/288 이력)          | 권장   |
| 3   | 결정성 2축 분리                                                    | run-twice + 커밋 golden 바이트 비교, update 플래그     | 10회 해시 동일만, golden 미커밋, update 플래그 없음        | 권장   |
| 4   | 외부 API 어댑터 격리                                               | `blitz_adapter.rs` 한 파일로 재수출                    | skia/ 51 파일이 `canvaskit-wasm` 직접 import               | 권장   |
| 5   | 지원 매트릭스 문서의 정본화                                        | `docs/css-support.md` 기능별 버전·미지원 동작 명시     | 1,275행 문서가 2026-04-06 에 멈춤, 삭제된 Taffy 엔진 인용  | 권장   |
| 6   | 외부 reftest 코퍼스 + expectations 판정                            | WPT 서브셋, PASS/FAIL/SKIP 파일, Regression/Promotion  | 손으로 쓴 46 파일 코퍼스, WPT 미사용                       | 조건부 |
| 7   | 알려진 결함의 항목별 선언                                          | bugs.txt: primary repro (FAIL) + regression net (PASS) | `knownDefects.ts` 정확 개수 고정 (손실 키)                 | 조건부 |
| 8   | 기하 1회 기록 후 재사용                                            | `PaginationGeometryTable`, 재레이아웃 금지             | `getSharedLayoutMap` 버전 memo + 서명 캐시 + `markDirty`   | 동등   |
| 9   | 순환 오라클 차단                                                   | WPT ref + Chromium golden                              | tests/parity 가 live Chromium 을 leg 1 로                  | 동등   |
| 10  | 스파이크·오진 기록 보존                                            | 비교 하니스 표, 틀린 결론을 배너와 함께 남김           | ADR Phase 0 코드 사실 표 · 메모리 정정 기록                | 동등   |
| 11  | 페이지 분할 · PDF · Tagged PDF · MiniJinja · fontconfig · 플러그인 | fulgur 고유                                            | 해당 없음                                                  | 비적용 |

## 4. 권장 5 — 적용 방식과 before / after

### 4-0. 전체

| #   | 패턴                  | 변경 위치                                                                                     | 파일 규모                 | 닫힘 증명                               |
| --- | --------------------- | --------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------- |
| 1   | 단위 브랜드 타입      | `skia/units.ts` 신설 + 스칼라 변환 12곳                                                       | 신설 1 · 수정 ~9          | tsc 0 + G2 10회 해시 무변화             |
| 2   | wasm 입력 strict 모드 | `tree.rs:183, 303` 구조체 · `wasm.rs` 플래그 · 하니스 2곳                                     | Rust 2 · TS 3             | 미지 키 unit RED + parity 46 파일 GREEN |
| 3   | 결정성 기준선 축      | `visual-parity/goldens/` 신설 · `compare.ts` · `visual-parity-gate.mjs` · 엔진 테스트 1       | 신설 9 · 수정 2           | 토큰 1개 변경 시 RED, 원복 GREEN        |
| 4   | CanvasKit 어댑터      | `skia/ck/index.ts` 신설 · import 경로 50 파일 · 정적 게이트 1                                 | 신설 2 · 수정 50 (경로만) | 정적 게이트 0건 + G2 해시 무변화        |
| 5   | 지원 매트릭스 생성    | 생성 스크립트 1 · `CSS_SUPPORT_MATRIX.md` 엔진 절 · preflight drift 검사 · 주석 sweep 35 파일 | 신설 1 · 수정 2 + 주석 35 | preflight drift 0 + `Taffy` grep 0건    |

### 4-1. 단위 브랜드 타입

| 항목   | 내용                                                                                                                                                                                                                                                     |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 적용   | `type CssPx = number & { __u: "css" }` · `ScenePx` · `DevicePx` 3종. 함수는 fulgur 어휘 그대로 — `asCss(raw)` 태깅, `cssToDevice(v, dpr)` · `cssToScene(v, zoom)` 변환, `toNumber(v)` 는 CanvasKit 호출 직전에만                                         |
| 대상   | `skiaFramePlan.ts:310` · `skiaOverlayBuilder.ts:689, 721, 885` · `hoverRenderer.ts:111, 156, 284` · `workflowRenderer.ts` · `workflowMinimap.ts` · `guideHitTest.ts:71` · `export.ts:75-77` · `SkiaRenderer.ts:161, 163, 573, 697`. 행렬 경로 4곳은 제외 |
| Before | `const screenW = skiaCanvasWidth / dpr` — 결과가 어느 공간인지 이름으로만. `padCss + thresholdScenePx` 같은 교차 덧셈이 컴파일된다                                                                                                                       |
| After  | `const screenW: CssPx = deviceToCss(asDevice(skiaCanvasWidth), dpr)`. `CssPx + DevicePx` 는 tsc 오류. diff 의 첫 hop (`asDevice`) 이 "외부 raw 값" 임을 말한다                                                                                           |
| 규칙   | 경계에서 한 번만 곱하고 `+` 안으로 분배 금지 (재결합 → sub-ULP → 해시 흔들림). Rust 엔진은 단위가 CSS px 하나라 newtype 이득 없음 — 단위가 만나는 곳은 TS 경계                                                                                           |

### 4-2. wasm 입력 strict 모드

| 항목   | 내용                                                                                                                                                                                                                                                                    |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 적용   | `tree.rs` 의 `Deserialize` 구조체 2개에 `deny_unknown_fields` 변형 (별도 타입) 추가. `wasm.rs` 에 `setStrictInput(bool)`. `tests/parity/harness.ts` · `visual-parity/skia/doctor` 는 strict=true. 미지 키 목록은 dev 전용 일회성 진단 호출 (`inspectUnknownKeys(json)`) |
| Before | `{"gap":"8px","borderTopWidth":"1px"}` → 엔진이 조용히 버림 → rect 불일치 → 엔진 결함으로 오판 (메모리 `project-engine-css-parity-differential-oracle`: 1차 sweep 오탐 132/288)                                                                                         |
| After  | strict: `unknown field 'gap', expected one of rowGap, columnGap, …` 로 하니스 즉시 실패. dev 빌더: `__layoutExplain` 옆에 버려진 키 목록 — 파이프라인 정규화 (`applyCommonEngineStyle`) 누락을 그 자리에서 본다                                                         |
| 첫 run | production 에 어떤 미지 키가 도달하는지 인벤토리가 없다. strict 를 켠 첫 parity run 이 그 인벤토리 — 그래서 production 은 경고, 하니스만 오류                                                                                                                           |

### 4-3. 결정성 기준선 축

| 항목   | 내용                                                                                                                                                                                                                                                                                                                                      |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 적용   | SMOKE 8 케이스의 SW raster · DPR 1 · HC4 PNG 를 `tests/visual-parity/goldens/<caseId>.png` 에 커밋. `compare.ts` 에 `compareToBaseline`. runner 에 `PARITY_UPDATE=1` (전체) / `=failing` (실패분만). 실패 시 `.artifacts/<case>.actual.png` + diff. `composition-engine/tests/determinism.rs`: 같은 batch 2회 solve → `Float32` bit-equal |
| Before | 2축 — Skia↔Preview 대칭 비교, Skia 10회 자기 일치. 카탈로그 토큰 회귀로 양쪽이 같이 변하면 통과. golden 미커밋, 갱신 절차 없음. 엔진 run-to-run 테스트 없음                                                                                                                                                                               |
| After  | 3축 — 대칭 · 자기 일치 · 지난 커밋과 일치. 의도된 시각 변경은 `PARITY_UPDATE=failing` 으로 PNG 갱신 커밋 → diff 리뷰 가능. 엔진 비결정성이 계약 위반으로 잡힌다                                                                                                                                                                           |
| 검증   | 토큰 1개를 일부러 바꿔 RED, 원복 GREEN. update 플래그로 golden 갱신 후 GREEN                                                                                                                                                                                                                                                              |

### 4-4. CanvasKit 어댑터

| 항목   | 내용                                                                                                                                                                                                                                                                                                                    |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 적용   | `skia/ck/index.ts` — `export type { Canvas, Paint, Path, SkPicture, FontMgr, Image, CanvasKit } from "canvaskit-wasm"` + 초기화 시 1회 해석한 enum 상수 (`CK.stroke = ck.PaintStyle.Stroke`). 50 파일 import 경로 교체. 정적 게이트 `canvaskitImportBoundary.static.test.ts`: `skia/ck/` 밖 `from "canvaskit-wasm"` 0건 |
| Before | 51 파일 `import type { Canvas, Paint } from "canvaskit-wasm"`. `paint.setStyle(ck.PaintStyle.Stroke)` 직접 참조 115곳. 0.x 버전 업에서 enum 이름 변경 시 51 파일 diff                                                                                                                                                   |
| After  | `import type { Canvas, Paint } from "../ck"`. `paint.setStyle(CK.stroke)`. 버전 업 diff 가 `ck/` 한 디렉터리. `renderCommands.ts` 에서 Skia 타입을 빼는 ADR-921 다음 단계의 진입점                                                                                                                                      |
| 순서   | 타입 재수출 먼저 (가치 절반, 위험 0) → enum 매칭 자리만 상수화                                                                                                                                                                                                                                                          |

### 4-5. 지원 매트릭스 생성 + Taffy 잔재 sweep

| 항목   | 내용                                                                                                                                                                                                                                                                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 적용   | 생성 스크립트가 `layoutCapabilityMatrix.ts` (import 0 인 자족 파일) 를 읽어 `docs/CSS_SUPPORT_MATRIX.md` 의 `<!-- engine-matrix:begin/end -->` 블록을 생성. 행: property · value · `native/partial/none` · 정책 · 미지원 시 동작 · Chrome gap(px) · oracle 테스트 경로. Taffy 인용 행 삭제. `codex:preflight` 에 "생성 후 git diff 0" 검사 |
| 확장   | `COMPONENT_SPEC.md` 의 Taffy 서술 정정. builder 비테스트 35 파일 주석의 "Taffy" → "레이아웃 엔진" sweep 1회 + 정적 게이트 (`grep Taffy apps/builder/src` 비테스트 0건). `legacy/` · `bug/` · `reference/audits/` 는 시점 기록이라 그대로                                                                                                   |
| Before | 손 편집 1,275행, 2026-04-06 정지. 엔진 열이 "TaffyFlexEngine (Taffy WASM)", `TaffyBlockEngine.ts` 인용 (ADR-916 제거 · ADR-923 6a rename 이후 존재하지 않음). 상태는 ✅⚠️❌ 만. 사라진 라이브러리 이름이 주석에 남아 "엔진 제약" 처럼 읽힌 오판 2회 (메모리 `feedback-stale-dependency-comment-is-not-engine-constraint`)                  |
| After  | 엔진 절은 코드가 쓴다. 행마다 `ignored` / `declared-substitution` 동작 명시 (fulgur `css-support.md` 의 "inset 은 warn 후 skip" 형식). 문서 정체 = preflight 실패. 주석 재유입은 정적 게이트가 막는다                                                                                                                                      |
| 검증   | 생성 스크립트 unit 1 + preflight drift 0 + `grep -c Taffy docs/CSS_SUPPORT_MATRIX.md` = 0                                                                                                                                                                                                                                                  |

## 5. 성능 리스크 — 패턴이 아니라 구현 선택에 있다

| #   | 패턴                       | 닿는 경로                                                               | 잘못 구현하면                                                                                                             | 비용 0 인 구현 조건                                                                                                                                       | 측정                                                                    |
| --- | -------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | 단위 브랜드 타입           | overlay flush · pointer hit-test (프레임당)                             | 값을 `class Px { v }` 로 감싸면 프레임당 수백 개 할당 → GC. 패널 리사이즈 지연의 원인이 GC 였다 (109→31 MB/s)             | 브랜드 **원시값** 만. 변환 함수는 순수·인라인 가능한 한 줄, 객체·클로저 생성 금지. tsc 출력에서 타입이 전부 지워지는지 확인                               | `pnpm perf:baseline -- --lane frame` 600 요소 p95 + 힙 할당률 전후 동일 |
| 2   | wasm strict 입력           | `buildTreeBatch` JSON 파싱 — 변이 1회 205ms/35MB (5k 요소) 의 비용 중심 | "버려진 키 수집" 을 `#[serde(flatten)] HashMap` 이나 `serde_json::Value` 선파싱으로 하면 파싱 2배 또는 노드당 buffer 할당 | `deny_unknown_fields` 는 serde 가 이미 하는 키 매칭에 분기 하나 — 0. strict 는 별도 구조체, 기본 경로 코드 무변경. 미지 키 목록은 hot path 밖 일회성 진단 | `benches/tree_solve.rs` + `buildTreeBatch` 왕복 (600·5k) 전후 동일      |
| 3   | 결정성 기준선 축           | 없음 — 테스트·CI 만                                                     | smoke 90초 wall budget 초과 시 게이트 실패                                                                                | 케이스 8 × PNG decode + 픽셀 1회 비교 ≈ 수 초. golden 8 장 PNG 는 저장소 수 MB                                                                            | gate 실행 시간 (budget `visual-parity-gate.mjs:79`)                     |
| 4   | CanvasKit 어댑터           | 그리기 실행 — enum 접근 115곳, 재기록 시 노드당 호출                    | 헬퍼가 매 호출 문자열 `switch` 를 돌거나 `Paint` 를 래핑 객체로 감싸면 노드당 비용·할당                                   | 타입 재수출은 지워진다. enum 은 초기화 시 1회 해석해 상수 객체로 캐시 → hot path 는 지금과 같은 프로퍼티 접근. 객체 래핑·Proxy 금지                       | G2 해시 무변화 + frame lane p95 전후 동일                               |
| 5   | 매트릭스 생성 + 주석 sweep | 없음 — preflight·문서                                                   | 생성기가 builder 모듈 그래프를 끌어오면 preflight 지연                                                                    | `layoutCapabilityMatrix.ts` 는 import 0 — 그 파일만 읽으면 canvaskit·store 를 안 건드린다. 주석 교체는 코드 무변경                                        | preflight 시간 전후                                                     |

측정 규칙: 유리한 경우만 재지 않는다 — idle 프레임이 아니라 600 요소 + 선택 fan-out 상태 (메모리 `feedback-perf-gate-favorable-case-only-measurement`). 사용자 Chrome 은 CPU throttle 4x 라 체감은 하니스 값의 약 4배로 읽는다.

부수 관찰: `NodeStyle` (`tree.rs:183`) 은 필드 전부가 `Option<String>` 이라 노드당 문자열 할당이 파싱 비용의 본체다. 이번 5개와 무관한 기존 상태이며, 변이 비용을 줄일 때의 레버는 strict 모드가 아니라 이 구조체 (enum · `&str` 화 또는 stub 으로 있는 binary protocol) 다.

## 6. 조건부 · 동등 · 비적용

### 6-1. 조건부

- **외부 reftest 코퍼스 (WPT) + expectations 판정.** 엔진은 HTML 을 받지 않으므로 fulgur 처럼 test/ref 픽셀 비교가 아니라 차등 형태로 쓴다: WPT test 페이지를 브라우저에 로드 → 요소별 `getComputedStyle` 을 엔진 style JSON 으로 정규화 (기존 `applyCommonEngineStyle` 재사용) → `buildTreeBatch` → rect 대조. 범위는 엔진이 주장하는 모듈만 (css-flexbox · css-grid · css-sizing · CSS2 box). 텍스트가 있는 테스트는 측정 채널이 폭만 있어 (ADR-165) SKIP 규칙에 명시. 가치는 "손 격자는 자기가 열거한 축만 증명한다" (메모리 `reference-parity-grid-needs-control-arm`) 의 한계를 외부 코퍼스가 채우는 것, 비용은 computed style → 엔진 JSON 어댑터가 곧 두 번째 정규화 파이프라인이라는 것 (패턴 2 strict 모드가 선행 조건). 착수 조건: 다음 엔진 결함이 손 격자 밖에서 발견될 때.
- **알려진 결함의 항목별 선언.** `knownDefects` 를 `{ caseId, regionId, code, adr, role: "primary" | "net" }` 배열로, 판정은 fulgur `judge` 와 같은 4갈래. 지금 결함 목록이 짧아 이득이 작다 — 위 항목을 하게 되면 같은 파일 형식으로 합친다.

### 6-2. 이미 동등

- **기하 1회 기록 후 재사용** — `getSharedLayoutMap()` 버전 memo · 페이지 서명 캐시 · 엔진 `markDirty` 증분이 fulgur 의 `PaginationGeometryTable` 원리를 더 세밀하게 갖고 있다.
- **순환 오라클 차단** — leg 1 이 live Chromium 인 점은 fulgur 의 WPT ref 와 동급. 차이는 코퍼스 출처뿐.
- **스파이크·오진 기록** — ADR Phase 0 코드 사실 표 (경로:행 + 확인 명령) 와 메모리 정정 기록 (`feedback-*` 의 Why 절) 이 같은 역할. fulgur 의 `Result<(), T>` "실패 시 값 반환" 규칙처럼 리뷰어 반복 지적을 규칙 파일로 선차단하는 방식도 `.claude/rules` 와 동일 관행.

### 6-3. 비적용 (fulgur 고유)

- 페이지 분할 · 조판 (GCPM, margin box, running header) — 웹 빌더에 페이지 개념이 없다. publish 인쇄 출력이 생기면 `pagination_layout.rs` 의 "기하 표를 걷는 분할" 이 참조.
- Krilla PDF · Tagged PDF / PDF-UA — 출력 형식이 다르다. 접근성은 D1 (RAC) 소유.
- MiniJinja 템플릿 + JSON 데이터 — composition 의 데이터 바인딩은 catalog binding accepts.
- fontconfig 핀 · 시스템 폰트 폴백 결정성 — Skia leg 는 `fontManager.ts` 가 폰트를 공급. 번들 폰트만 쓰는지는 미확인 (`harness/identity.ts` 의 `environmentChecksum` 이 폰트 집합을 포함하는지 확인할 가치 있음).
- CLI 플러그인 · npm/PyPI/RubyGems 배포 · release-plz · beads — 프로세스 도구. composition 은 ADR + `.agent/task-state.json` + CHANGELOG 규칙.
- `LayoutPartialTree` 래퍼로 한 CSS 기능만 자체 레이아웃에 라우팅 — Taffy 위에서만 의미. 반대편인 TS Step 4.5 → 엔진 measure callback 보류안 A (`fullTreeLayout.ts:2827`) 가 같은 발상이며 재개 조건 (2-pass 비용) 은 그대로.

## 7. 미확인

- parity gate `full` 모드의 파일 해석 (`visual-parity-gate.mjs:239` 가 빈 배열을 넘기고 config include glob 에 의존).
- 케이스별 `maxDiffRatio` / `maxByte` 수치 (`tests/visual-parity/cases/*.ts`).
- `composition-engine/tests/layout_trace.rs` 에 run-to-run 결정성 단언이 있는지.
- Skia leg 폰트가 번들만 쓰는지.
