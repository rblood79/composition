# 외부 프로젝트 패턴 대조 — fulgur · pretext (2026-09-03)

> 두 외부 프로젝트를 라이브러리·플러그인으로 도입하지 않고, **적용 가치가 있는 설계·규칙만** composition 의 현재 상태 (before) 와 적용 후 형태 (after) 로 판정한 문서. 근거는 양쪽 저장소의 파일·행 번호와 Chrome 실측.
>
> - **A. fulgur** — [fulgur-rs/fulgur](https://github.com/fulgur-rs/fulgur) main (0.40.0). Blitz(Stylo · Taffy · Parley) 위에 자체 페이지 분할과 Krilla PDF 출력을 얹은 Rust HTML→PDF 엔진. 코드 구조와 검증 체계의 이론을 대조. 아티팩트 판: https://claude.ai/code/artifact/8619a00c-71bd-45d3-8969-bdf66eab6bb2
> - **B. pretext** — [chenglou/pretext](https://github.com/chenglou/pretext) v0.0.4 (2026-04-02, [PRETEXT_ANALYSIS.md](PRETEXT_ANALYSIS.md) 분석 시점) → v0.0.8 + main `ac49b09` (2026-06-22). 원리 내재화 경로 (ADR-051 대안 B) 를 유지한 채, upstream 이 그 사이 고친 텍스트 줄바꿈 규칙 중 우리 `canvas2dSegmentCache.ts` 에 없는 것을 Chrome 실측으로 골라냄.
>
> 이전 개별 문서 `FULGUR_PATTERN_DELTA_2026-09.md` · `PRETEXT_UPSTREAM_DELTA_2026-09.md` 를 이 문서로 통합 (2026-09-03).

## 0. 요약

| 출처    | 판정                                                                                                                                                                                                                                                                                                                              | 절차                                                                                                        |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| fulgur  | **권장 5** — ① TS 단위 브랜드 타입 (CSS px · scene · device px) ② wasm 입력 strict 모드 (`deny_unknown_fields`) ③ 결정성 기준선 축 (커밋 golden + update 플래그 + 엔진 run-twice) ④ CanvasKit 어댑터 격리 ⑤ CSS 지원 매트릭스 문서를 `layoutCapabilityMatrix.ts` 에서 생성 + Taffy 잔재 주석 sweep · 조건부 2 · 동등 3 · 비적용 6 | 전부 **동작 변경 0** (`.claude/rules/review-loop-closure.md` §3 — 원복 RED 는 새 게이트 행만, live 생략 가) |
| pretext | **반영 제안 3** — ① Tier 3 preprocessing 규칙 5 + computeLines 1 (Chrome 오라클 16 케이스 일치 프로토타입 있음) ② 이모지 canvas 폭 보정 ③ letterSpacing fallback 축소 (선택). 라이브러리 직접 도입 · Tier 2 제거 · Rust 이관은 보류                                                                                               | ①②③ 모두 **동작 변경** (원복 RED 전량 · live 필수 · evidence/README/CHANGELOG)                              |

두 대조에서 같이 나온 원칙 (§C): 외부 upstream 규칙은 주기적으로 대조한다 · 단위 fixture 는 실경로 (`tokenize()`) 로 만든다 (손 fixture 가 dead 규칙을 가렸다) · 성능 리스크는 패턴이 아니라 구현 선택에 있다 · 문서 drift 2건 (`CSS_SUPPORT_MATRIX.md` 04-06 정지 · ADR-051 breakdown "Phase 0 대기") · 오라클은 명세 손계산이 아니라 Chrome 실측.

**착수 순서 통합** (§D, 2026-09-04 가치 순 개정): pretext ① (A — 결함 10 케이스 현재 코드 재현) → fulgur ⑤ sweep (B) → fulgur ② strict (B — `order` 무음 드롭 실증) → pretext ③ → pretext ②. fulgur ③ · ④ · ① 은 C 등급 — 트리거 (토큰 회귀 1건 · `canvaskit-wasm` bump/ADR-921 · 단위 혼동 버그 1건) 전 보류.

---

# A. fulgur

## A1. 코드 사실 — fulgur

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

## A2. 코드 사실 — composition

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

## A3. 판정 요약

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

## A4. 권장 5 — 적용 방식과 before / after

### A4-0. 전체

| #   | 패턴                  | 변경 위치                                                                                     | 파일 규모                 | 닫힘 증명                               |
| --- | --------------------- | --------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------- |
| 1   | 단위 브랜드 타입      | `skia/units.ts` 신설 + 스칼라 변환 12곳                                                       | 신설 1 · 수정 ~9          | tsc 0 + G2 10회 해시 무변화             |
| 2   | wasm 입력 strict 모드 | `tree.rs:183, 303` 구조체 · `wasm.rs` 플래그 · 하니스 2곳                                     | Rust 2 · TS 3             | 미지 키 unit RED + parity 46 파일 GREEN |
| 3   | 결정성 기준선 축      | `visual-parity/goldens/` 신설 · `compare.ts` · `visual-parity-gate.mjs` · 엔진 테스트 1       | 신설 9 · 수정 2           | 토큰 1개 변경 시 RED, 원복 GREEN        |
| 4   | CanvasKit 어댑터      | `skia/ck/index.ts` 신설 · import 경로 50 파일 · 정적 게이트 1                                 | 신설 2 · 수정 50 (경로만) | 정적 게이트 0건 + G2 해시 무변화        |
| 5   | 지원 매트릭스 생성    | 생성 스크립트 1 · `CSS_SUPPORT_MATRIX.md` 엔진 절 · preflight drift 검사 · 주석 sweep 35 파일 | 신설 1 · 수정 2 + 주석 35 | preflight drift 0 + `Taffy` grep 0건    |

### A4-1. 단위 브랜드 타입

| 항목   | 내용                                                                                                                                                                                                                                                     |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 적용   | `type CssPx = number & { __u: "css" }` · `ScenePx` · `DevicePx` 3종. 함수는 fulgur 어휘 그대로 — `asCss(raw)` 태깅, `cssToDevice(v, dpr)` · `cssToScene(v, zoom)` 변환, `toNumber(v)` 는 CanvasKit 호출 직전에만                                         |
| 대상   | `skiaFramePlan.ts:310` · `skiaOverlayBuilder.ts:689, 721, 885` · `hoverRenderer.ts:111, 156, 284` · `workflowRenderer.ts` · `workflowMinimap.ts` · `guideHitTest.ts:71` · `export.ts:75-77` · `SkiaRenderer.ts:161, 163, 573, 697`. 행렬 경로 4곳은 제외 |
| Before | `const screenW = skiaCanvasWidth / dpr` — 결과가 어느 공간인지 이름으로만. `padCss + thresholdScenePx` 같은 교차 덧셈이 컴파일된다                                                                                                                       |
| After  | `const screenW: CssPx = deviceToCss(asDevice(skiaCanvasWidth), dpr)`. `CssPx + DevicePx` 는 tsc 오류. diff 의 첫 hop (`asDevice`) 이 "외부 raw 값" 임을 말한다                                                                                           |
| 규칙   | 경계에서 한 번만 곱하고 `+` 안으로 분배 금지 (재결합 → sub-ULP → 해시 흔들림). Rust 엔진은 단위가 CSS px 하나라 newtype 이득 없음 — 단위가 만나는 곳은 TS 경계                                                                                           |

### A4-2. wasm 입력 strict 모드

| 항목   | 내용                                                                                                                                                                                                                                                                    |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 적용   | `tree.rs` 의 `Deserialize` 구조체 2개에 `deny_unknown_fields` 변형 (별도 타입) 추가. `wasm.rs` 에 `setStrictInput(bool)`. `tests/parity/harness.ts` · `visual-parity/skia/doctor` 는 strict=true. 미지 키 목록은 dev 전용 일회성 진단 호출 (`inspectUnknownKeys(json)`) |
| Before | `{"gap":"8px","borderTopWidth":"1px"}` → 엔진이 조용히 버림 → rect 불일치 → 엔진 결함으로 오판 (메모리 `project-engine-css-parity-differential-oracle`: 1차 sweep 오탐 132/288)                                                                                         |
| After  | strict: `unknown field 'gap', expected one of rowGap, columnGap, …` 로 하니스 즉시 실패. dev 빌더: `__layoutExplain` 옆에 버려진 키 목록 — 파이프라인 정규화 (`applyCommonEngineStyle`) 누락을 그 자리에서 본다                                                         |
| 첫 run | production 에 어떤 미지 키가 도달하는지 인벤토리가 없다. strict 를 켠 첫 parity run 이 그 인벤토리 — 그래서 production 은 경고, 하니스만 오류                                                                                                                           |

### A4-3. 결정성 기준선 축

| 항목   | 내용                                                                                                                                                                                                                                                                                                                                      |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 적용   | SMOKE 8 케이스의 SW raster · DPR 1 · HC4 PNG 를 `tests/visual-parity/goldens/<caseId>.png` 에 커밋. `compare.ts` 에 `compareToBaseline`. runner 에 `PARITY_UPDATE=1` (전체) / `=failing` (실패분만). 실패 시 `.artifacts/<case>.actual.png` + diff. `composition-engine/tests/determinism.rs`: 같은 batch 2회 solve → `Float32` bit-equal |
| Before | 2축 — Skia↔Preview 대칭 비교, Skia 10회 자기 일치. 카탈로그 토큰 회귀로 양쪽이 같이 변하면 통과. golden 미커밋, 갱신 절차 없음. 엔진 run-to-run 테스트 없음                                                                                                                                                                               |
| After  | 3축 — 대칭 · 자기 일치 · 지난 커밋과 일치. 의도된 시각 변경은 `PARITY_UPDATE=failing` 으로 PNG 갱신 커밋 → diff 리뷰 가능. 엔진 비결정성이 계약 위반으로 잡힌다                                                                                                                                                                           |
| 검증   | 토큰 1개를 일부러 바꿔 RED, 원복 GREEN. update 플래그로 golden 갱신 후 GREEN                                                                                                                                                                                                                                                              |

### A4-4. CanvasKit 어댑터

| 항목   | 내용                                                                                                                                                                                                                                                                                                                    |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 적용   | `skia/ck/index.ts` — `export type { Canvas, Paint, Path, SkPicture, FontMgr, Image, CanvasKit } from "canvaskit-wasm"` + 초기화 시 1회 해석한 enum 상수 (`CK.stroke = ck.PaintStyle.Stroke`). 50 파일 import 경로 교체. 정적 게이트 `canvaskitImportBoundary.static.test.ts`: `skia/ck/` 밖 `from "canvaskit-wasm"` 0건 |
| Before | 51 파일 `import type { Canvas, Paint } from "canvaskit-wasm"`. `paint.setStyle(ck.PaintStyle.Stroke)` 직접 참조 115곳. 0.x 버전 업에서 enum 이름 변경 시 51 파일 diff                                                                                                                                                   |
| After  | `import type { Canvas, Paint } from "../ck"`. `paint.setStyle(CK.stroke)`. 버전 업 diff 가 `ck/` 한 디렉터리. `renderCommands.ts` 에서 Skia 타입을 빼는 ADR-921 다음 단계의 진입점                                                                                                                                      |
| 순서   | 타입 재수출 먼저 (가치 절반, 위험 0) → enum 매칭 자리만 상수화                                                                                                                                                                                                                                                          |

### A4-5. 지원 매트릭스 생성 + Taffy 잔재 sweep

| 항목   | 내용                                                                                                                                                                                                                                                                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 적용   | 생성 스크립트가 `layoutCapabilityMatrix.ts` (import 0 인 자족 파일) 를 읽어 `docs/CSS_SUPPORT_MATRIX.md` 의 `<!-- engine-matrix:begin/end -->` 블록을 생성. 행: property · value · `native/partial/none` · 정책 · 미지원 시 동작 · Chrome gap(px) · oracle 테스트 경로. Taffy 인용 행 삭제. `codex:preflight` 에 "생성 후 git diff 0" 검사 |
| 확장   | `COMPONENT_SPEC.md` 의 Taffy 서술 정정. builder 비테스트 35 파일 주석의 "Taffy" → "레이아웃 엔진" sweep 1회 + 정적 게이트 (`grep Taffy apps/builder/src` 비테스트 0건). `legacy/` · `bug/` · `reference/audits/` 는 시점 기록이라 그대로                                                                                                   |
| Before | 손 편집 1,275행, 2026-04-06 정지. 엔진 열이 "TaffyFlexEngine (Taffy WASM)", `TaffyBlockEngine.ts` 인용 (ADR-916 제거 · ADR-923 6a rename 이후 존재하지 않음). 상태는 ✅⚠️❌ 만. 사라진 라이브러리 이름이 주석에 남아 "엔진 제약" 처럼 읽힌 오판 2회 (메모리 `feedback-stale-dependency-comment-is-not-engine-constraint`)                  |
| After  | 엔진 절은 코드가 쓴다. 행마다 `ignored` / `declared-substitution` 동작 명시 (fulgur `css-support.md` 의 "inset 은 warn 후 skip" 형식). 문서 정체 = preflight 실패. 주석 재유입은 정적 게이트가 막는다                                                                                                                                      |
| 검증   | 생성 스크립트 unit 1 + preflight drift 0 + `grep -c Taffy docs/CSS_SUPPORT_MATRIX.md` = 0                                                                                                                                                                                                                                                  |

## A5. 성능 리스크 — 패턴이 아니라 구현 선택에 있다

| #   | 패턴                       | 닿는 경로                                                               | 잘못 구현하면                                                                                                             | 비용 0 인 구현 조건                                                                                                                                       | 측정                                                                    |
| --- | -------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | 단위 브랜드 타입           | overlay flush · pointer hit-test (프레임당)                             | 값을 `class Px { v }` 로 감싸면 프레임당 수백 개 할당 → GC. 패널 리사이즈 지연의 원인이 GC 였다 (109→31 MB/s)             | 브랜드 **원시값** 만. 변환 함수는 순수·인라인 가능한 한 줄, 객체·클로저 생성 금지. tsc 출력에서 타입이 전부 지워지는지 확인                               | `pnpm perf:baseline -- --lane frame` 600 요소 p95 + 힙 할당률 전후 동일 |
| 2   | wasm strict 입력           | `buildTreeBatch` JSON 파싱 — 변이 1회 205ms/35MB (5k 요소) 의 비용 중심 | "버려진 키 수집" 을 `#[serde(flatten)] HashMap` 이나 `serde_json::Value` 선파싱으로 하면 파싱 2배 또는 노드당 buffer 할당 | `deny_unknown_fields` 는 serde 가 이미 하는 키 매칭에 분기 하나 — 0. strict 는 별도 구조체, 기본 경로 코드 무변경. 미지 키 목록은 hot path 밖 일회성 진단 | `benches/tree_solve.rs` + `buildTreeBatch` 왕복 (600·5k) 전후 동일      |
| 3   | 결정성 기준선 축           | 없음 — 테스트·CI 만                                                     | smoke 90초 wall budget 초과 시 게이트 실패                                                                                | 케이스 8 × PNG decode + 픽셀 1회 비교 ≈ 수 초. golden 8 장 PNG 는 저장소 수 MB                                                                            | gate 실행 시간 (budget `visual-parity-gate.mjs:79`)                     |
| 4   | CanvasKit 어댑터           | 그리기 실행 — enum 접근 115곳, 재기록 시 노드당 호출                    | 헬퍼가 매 호출 문자열 `switch` 를 돌거나 `Paint` 를 래핑 객체로 감싸면 노드당 비용·할당                                   | 타입 재수출은 지워진다. enum 은 초기화 시 1회 해석해 상수 객체로 캐시 → hot path 는 지금과 같은 프로퍼티 접근. 객체 래핑·Proxy 금지                       | G2 해시 무변화 + frame lane p95 전후 동일                               |
| 5   | 매트릭스 생성 + 주석 sweep | 없음 — preflight·문서                                                   | 생성기가 builder 모듈 그래프를 끌어오면 preflight 지연                                                                    | `layoutCapabilityMatrix.ts` 는 import 0 — 그 파일만 읽으면 canvaskit·store 를 안 건드린다. 주석 교체는 코드 무변경                                        | preflight 시간 전후                                                     |

측정 규칙: 유리한 경우만 재지 않는다 — idle 프레임이 아니라 600 요소 + 선택 fan-out 상태 (메모리 `feedback-perf-gate-favorable-case-only-measurement`). 사용자 Chrome 은 CPU throttle 4x 라 체감은 하니스 값의 약 4배로 읽는다.

부수 관찰: `NodeStyle` (`tree.rs:183`) 은 필드 전부가 `Option<String>` 이라 노드당 문자열 할당이 파싱 비용의 본체다. 이번 5개와 무관한 기존 상태이며, 변이 비용을 줄일 때의 레버는 strict 모드가 아니라 이 구조체 (enum · `&str` 화 또는 stub 으로 있는 binary protocol) 다.

## A6. 조건부 · 동등 · 비적용

### A6-1. 조건부

- **외부 reftest 코퍼스 (WPT) + expectations 판정.** 엔진은 HTML 을 받지 않으므로 fulgur 처럼 test/ref 픽셀 비교가 아니라 차등 형태로 쓴다: WPT test 페이지를 브라우저에 로드 → 요소별 `getComputedStyle` 을 엔진 style JSON 으로 정규화 (기존 `applyCommonEngineStyle` 재사용) → `buildTreeBatch` → rect 대조. 범위는 엔진이 주장하는 모듈만 (css-flexbox · css-grid · css-sizing · CSS2 box). 텍스트가 있는 테스트는 측정 채널이 폭만 있어 (ADR-165) SKIP 규칙에 명시. 가치는 "손 격자는 자기가 열거한 축만 증명한다" (메모리 `reference-parity-grid-needs-control-arm`) 의 한계를 외부 코퍼스가 채우는 것, 비용은 computed style → 엔진 JSON 어댑터가 곧 두 번째 정규화 파이프라인이라는 것 (A4-2 strict 모드가 선행 조건). 착수 조건: 다음 엔진 결함이 손 격자 밖에서 발견될 때.
- **알려진 결함의 항목별 선언.** `knownDefects` 를 `{ caseId, regionId, code, adr, role: "primary" | "net" }` 배열로, 판정은 fulgur `judge` 와 같은 4갈래. 지금 결함 목록이 짧아 이득이 작다 — 위 항목을 하게 되면 같은 파일 형식으로 합친다.

### A6-2. 이미 동등

- **기하 1회 기록 후 재사용** — `getSharedLayoutMap()` 버전 memo · 페이지 서명 캐시 · 엔진 `markDirty` 증분이 fulgur 의 `PaginationGeometryTable` 원리를 더 세밀하게 갖고 있다.
- **순환 오라클 차단** — leg 1 이 live Chromium 인 점은 fulgur 의 WPT ref 와 동급. 차이는 코퍼스 출처뿐.
- **스파이크·오진 기록** — ADR Phase 0 코드 사실 표 (경로:행 + 확인 명령) 와 메모리 정정 기록 (`feedback-*` 의 Why 절) 이 같은 역할. fulgur 의 `Result<(), T>` "실패 시 값 반환" 규칙처럼 리뷰어 반복 지적을 규칙 파일로 선차단하는 방식도 `.claude/rules` 와 동일 관행.

### A6-3. 비적용 (fulgur 고유)

- 페이지 분할 · 조판 (GCPM, margin box, running header) — 웹 빌더에 페이지 개념이 없다. publish 인쇄 출력이 생기면 `pagination_layout.rs` 의 "기하 표를 걷는 분할" 이 참조.
- Krilla PDF · Tagged PDF / PDF-UA — 출력 형식이 다르다. 접근성은 D1 (RAC) 소유.
- MiniJinja 템플릿 + JSON 데이터 — composition 의 데이터 바인딩은 catalog binding accepts.
- fontconfig 핀 · 시스템 폰트 폴백 결정성 — Skia leg 는 `fontManager.ts` 가 폰트를 공급. 번들 폰트만 쓰는지는 미확인 (`harness/identity.ts` 의 `environmentChecksum` 이 폰트 집합을 포함하는지 확인할 가치 있음).
- CLI 플러그인 · npm/PyPI/RubyGems 배포 · release-plz · beads — 프로세스 도구. composition 은 ADR + `.agent/task-state.json` + CHANGELOG 규칙.
- `LayoutPartialTree` 래퍼로 한 CSS 기능만 자체 레이아웃에 라우팅 — Taffy 위에서만 의미. 반대편인 TS Step 4.5 → 엔진 measure callback 보류안 A (`fullTreeLayout.ts:2827`) 가 같은 발상이며 재개 조건 (2-pass 비용) 은 그대로.

## A7. 미확인

- parity gate `full` 모드의 파일 해석 (`visual-parity-gate.mjs:239` 가 빈 배열을 넘기고 config include glob 에 의존).
- 케이스별 `maxDiffRatio` / `maxByte` 수치 (`tests/visual-parity/cases/*.ts`).
- `composition-engine/tests/layout_trace.rs` 에 run-to-run 결정성 단언이 있는지.
- Skia leg 폰트가 번들만 쓰는지.

---

# B. pretext — Canvas 2D 텍스트 측정 내재화 경로의 upstream 규칙 대조

## B0. 요약

- **현재 상태**: ADR-051 대안 B 는 `USE_CANVAS2D_MEASURE = true` (`wasm-bindings/featureFlags.ts:35`) 로 **live** 다. 측정 (`canvaskitTextMeasurer.ts:209/295`) 과 Break Hint 주입 (`nodeRendererText.ts:539`) 양쪽이 Canvas 2D 경로를 탄다. 문서 ("Phase 0 대기") 와 메모리는 낡았다 (B6).
- **멈춘 지점** (근거 있는 것만): Phase E 후보 (EngineProfile·이모지 보정) 미구현 · Tier 2 `verifyLines` 잔존 · `needsFallback()` 5종 (letterSpacing / wordSpacing / whiteSpace≠normal / break-all / fontVariant) 은 CanvasKit 유지 · ADR-916 2-E "Rust 이관 제외" · ADR-042 "±2px 텍스트 기인 오차 수용".
- **upstream 변화**: 5 릴리스, 135 커밋. 3 브라우저 7,680 케이스 전부 일치 (`status/dashboard.json`). 변경의 대부분이 **prepare 단계 preprocessing 규칙** (우리 Tier 3 에 해당) 이다.
- **대조 결과**: Chrome 152 (macOS, DPR 2) 오라클로 **결함 9종 확정 + 잠재 1 + 미검증 2**. 우리가 옮긴 upstream 규칙은 4개 (라틴 trailing 구두점 · 행두 금칙 · 행말 금칙 · pending space) 인데 그중 **행말 금칙 규칙은 조건 오류로 한 번도 동작하지 않았다** (B3 G/H).
- **제안**: preprocessing 5건 + computeLines 1건을 1 phase (동작 변경) 로 반영 → 이모지 보정 → letterSpacing 은 선택. 라이브러리 직접 도입·Tier 2 제거·Rust 이관은 그대로 보류 (B5).

## B1. 현황 — 코드 사실

| 사실                                                                                              | 경로                                                     |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Canvas 2D 게이트 상시 on                                                                          | `canvas/wasm-bindings/featureFlags.ts:35`                |
| 측정 (`measureWidth` / `measureWrapped`) 가 `!needsFallback` 이면 Canvas 2D                       | `canvas/utils/canvaskitTextMeasurer.ts:209, 295`         |
| 렌더가 `measureWithCanvas2D().hintedText` 를 `\n` hard break 로 CanvasKit 에 강제                 | `canvas/skia/nodeRendererText.ts:539-551`                |
| 파이프라인: tokenize → preprocessTokens → 캐시 → computeLines(ε 0.015) → verifyLines → hintedText | `canvas/utils/canvas2dSegmentCache.ts:585-644`           |
| fallback 5종: letterSpacing · wordSpacing · whiteSpace≠normal · break-all · fontVariant           | 같은 파일 `needsFallback()` (fontVariant 는 ADR-151 B18) |
| 렌더 전 공백 정규화는 `[ \t]+` 만 (`\n` 미정규화), 측정 경로는 정규화 없음                        | `nodeRendererText.ts:164-166`                            |
| 파이프라인 JS 오버헤드 sub-0.01 ms (ADR-916 2-E 벤치)                                             | `canvas/skia/textMeasure.bench.ts` 헤더                  |
| letterSpacing 은 Styles 패널에서 사용자가 설정 가능 → fallback 경로가 production 에 노출됨        | `panels/styles/sections/TypographySection.tsx:276`       |
| 기본 폰트 Pretendard, 체인에 `system-ui` 포함                                                     | `builder/fonts/customFonts.ts:296, 330`                  |

## B2. upstream 변경 이력 (2026-04-02 이후)

| 버전 (날짜)   | 항목                                                                                                                                                                     | 우리 구현과의 관계                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 0.0.5 (04-09) | `wordBreak: 'keep-all'` 정식 지원 · CJK+숫자 혼합 · keep-all 혼합 스크립트 경계 · 긴 breakable run 선형화 · 반복 구두점 quadratic 제거                                   | keep-all 혼합 스크립트 **결함** (B3 N/N2)                         |
| 0.0.6 (04-21) | 수치 `letterSpacing` 지원 (#108, #156) · CJK 뒤 여는 괄호 주석이 줄 끝에 남던 문제 (#148)                                                                                | 여는 괄호 **결함** (B3 G/H) · letterSpacing 은 fallback 축소 후보 |
| 0.0.7 (05-10) | keep-all no-space 혼합 · 비-ASCII no-space 구두점 체인 · 여는 구두점 `¡ ¿ „` (#165) · 숫자 접두/접미 `$ % € + − °` (#105) · soft-hyphen · terminal letter spacing (#171) | `$100` **결함** (B3 A) · 여는 따옴표 **결함** (B3 L/O)            |
| 0.0.8 (06-11) | 단어 내부 기호 run (`user@host`, `a/b`, `foo_bar`) 은 브라우저처럼 붙여 둠 (#169) · 과장 하이픈 run 의 dash 우선 break (#89)                                             | 이메일·경로·URL **결함** (B3 E/F/F2)                              |
| main 06-22    | `PLATFORM_BUGS.md` 신설 — Chrome/Firefox macOS 이모지 canvas 폭 과대 (Chromium #489494015) · `system-ui` 광학 변형 불일치 · Safari ε 1/64 · Safari keep-all 구두점 shim  | 이모지 보정 **결함** (B3 emoji) · `system-ui` 경고                |

측정 모델 자체 (2-phase, SoA, greedy, 세그먼트 캐시) 는 변하지 않았다. `RESEARCH.md` 는 여전히 full-line verification 을 기각 상태로 둔다.

## B3. 대조 결과 — Chrome 152 오라클

**방법**: `example.com` 탭에서 `16px Arial`, 폭 = `measureText(접두어) + 1.5px` 로 div 를 만들고 `Range.getClientRects()` 로 코드포인트별 줄을 추출 (스크립트 B7). 같은 입력을 현재 `tokenize → preprocessTokens → computeLines` 에 fake 등폭 (10px/grapheme) 으로 통과시켜 **break 기회** 를 대조했다. 폭 값이 아니라 "어디서 끊을 수 있는가" 를 보는 것이므로 폰트 무관.

| #                      | 입력 (접두어)                                                          | Chrome                                    | 현재 구현                                                    | 원인                                                                                     | upstream 규칙                              | 판정                                                 |
| ---------------------- | ---------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| A                      | `Price $100 today` (`Price $`)                                         | `Price` / `$100 today`                    | `Price $` / `100 today`                                      | `$` 가 non-breakable 단독 토큰 → 앞 줄 끝에 남음                                         | numeric affix PR/PO 병합 (#105)            | **결함**                                             |
| C                      | `call (주)회사 now` (`call (`)                                         | `call` / `(주)회사`                       | `call (` / `주)회사`                                         | 라틴 `(` 가 forward-sticky 목록에 없음                                                   | `kinsokuEnd` 에 `" ( [ { ¡ ¿ “ ‘ « ‹`      | **결함**                                             |
| E                      | `mail support@example.com now`                                         | `support@example.com` 한 단위             | `support@` / `example.com`                                   | `@` 뒤 word-like 앞에서 break 허용                                                       | no-space word chain (#169)                 | **결함**                                             |
| F                      | `see foo_bar/baz_qux here`                                             | `foo_bar/baz_qux` 한 단위                 | `foo_bar/` / `baz_qux`                                       | 위와 같음 (`/`)                                                                          | 같음                                       | **결함**                                             |
| F2                     | `go https://example.com/path/to now`                                   | URL 한 단위                               | `https://example.com/` / …                                   | 위와 같음                                                                                | `mergeUrlRuns`                             | **결함**                                             |
| G                      | `彼は「こんにちは」…` (`彼は「`)                                       | `彼は` / `「こん`                         | `彼は「` / `こんに`                                          | `KINSOKU_TAIL` 규칙이 `token.breakable` 조건 — 구두점은 항상 non-breakable 이라 **dead** | forward-sticky carry (역방향 패스)         | **결함**                                             |
| H                      | `漢字（注）です` (`漢字（`)                                            | `漢字` / `（注）`                         | `漢字（` / `注）で`                                          | 같음 (#148 케이스)                                                                       | 같음                                       | **결함**                                             |
| L                      | `he said "hello world" ok`                                             | `he said` / `"hello`                      | `he said "` / `hello`                                        | 여는 따옴표 dangling (곧은·둥근 모두)                                                    | `kinsokuEnd` 따옴표                        | **결함**                                             |
| O                      | `it's 'quoted' text`                                                   | `it's` / `'quoted'`                       | `it's '` / `quoted'`                                         | 아포스트로피 forward glue 없음                                                           | `forwardStickyGlue` `' ’`                  | **결함**                                             |
| N                      | `한글abc123 다음` keep-all (`한글`)                                    | `한글abc123` 한 단위                      | `한글` / `abc123`                                            | keep-all 이 CJK 분할 억제만 하고 인접 세그먼트 병합 없음                                 | `mergeKeepAllTextSegments`                 | **결함**                                             |
| N2                     | `価格1200円です` keep-all                                              | 전체 한 단위                              | `価格` / `1200` / `円`                                       | 같음                                                                                     | 같음                                       | **결함**                                             |
| D                      | `Save / Cancel` 폭 99.61, 컨테이너 99.11                               | 줄바꿈                                    | computeLines 는 "fits" (폭 20% 누락) → Tier 2 가 잡아 줄바꿈 | 연속 non-breakable 토큰이 `pendingSpace` 를 **덮어써** `/` 와 공백 하나가 폭에서 사라짐  | 공백만 hangable, 나머지는 즉시 가산        | **잠재** (Tier 2 가 가림; `maxLineWidth` 는 틀린 채) |
| emoji                  | `😀` 12/14/16/20/24/28px Arial                                         | canvas−DOM = +3 / +4 / +4 / +2 / 0 / 0 px | 보정 없음                                                    | Chromium #489494015 가 이 환경에서 재현                                                  | 폰트당 1회 DOM 보정 (`getEmojiCorrection`) | **결함** (이모지 포함 텍스트 24px 미만)              |
| I / M / M2 / P / Q / R | 한글+라틴 normal · 하이픈 · 전화번호 · `Save /` · `Wait...` · `(note)` | —                                         | Chrome 과 일치                                               | —                                                                                        | —                                          | 정상                                                 |
| ws                     | `a  b\nc` (white-space: normal)                                        | 공백 1개로 collapse, `\n` 도 공백         | 측정 경로: `"  "` 2칸 폭, `\n` 은 hard break                 | 측정 경로에 정규화 없음, 렌더는 `[ \t]+` 만                                              | `normalizeWhitespaceNormal`                | **미검증** (Preview 의 `\n` 처리 확인 필요)          |
| ε                      | line-fit epsilon                                                       | Chrome 0.005 / Safari 1/64                | 고정 0.015                                                   | Chrome 에서 0.01px 만큼 관대                                                             | `EngineProfile.lineFitEpsilon`             | 미검증 (실측 불일치 사례 없음)                       |

한글 산문·영문 산문·구두점 병합·CJK 문자 분할 등 기존 4 규칙이 맞는 범위는 그대로 맞는다. 결함은 전부 "단위를 어디까지 붙이느냐" 의 Tier 3 층이고, upstream 이 4~6월에 브라우저 sweep 으로 고친 항목과 1:1 로 겹친다.

## B4. 적용 가치가 있는 규칙 — Before / After

프로토타입 (`preprocessV2` + `computeLinesV2`) 을 같은 16 케이스에 돌려 Chrome 결과와 전부 일치시켰다 (M2 는 첫 시도에서 upstream 의 `'-' + 숫자` forward 규칙을 잘못 옮겨 틀렸고, 제거 후 일치). 아래는 그 규칙을 현재 코드 구조에 맞춘 형태다.

### B4-1. forward-sticky — 행말 금칙 조건 수정 + 라틴 여는 괄호·따옴표·아포스트로피 (G · H · C · L · O)

**Before** (`canvas2dSegmentCache.ts:180-193`):

```ts
// 행말 금칙: breakable 단일 문자 → 후속 토큰에 병합
if (token.breakable && token.text.length === 1 && KINSOKU_TAIL.has(token.text) && i + 1 < toks.length) {
```

`Intl.Segmenter` 는 괄호·따옴표를 `isWordLike: false` 로 내므로 `tokenize()` 가 만든 토큰에서는 이 분기가 절대 참이 아니다. 단위 테스트 (`canvas2dSegmentCache.test.ts:156`) 는 `breakable: true` fixture 를 손으로 만들어 통과하고 있어 dead 규칙을 가린다.

**After**:

```ts
/** 줄 끝에 남을 수 없는 문자 — 후속 토큰에 병합 (upstream kinsokuEnd + forwardStickyGlue) */
const FORWARD_STICKY = new Set([
  '"',
  "(",
  "[",
  "{",
  "¡",
  "¿",
  "“",
  "‘",
  "‚",
  "„",
  "«",
  "‹",
  "⸘",
  "'",
  "’",
  "（",
  "〔",
  "〈",
  "《",
  "「",
  "『",
  "【",
  "〖",
  "〘",
  "〚",
]);

// preprocessTokens 안 — 역방향 패스로 교체 (여러 개 연속 `("` 도 한 번에 carry)
let carry = "";
for (let i = toks.length - 1; i >= 0; i--) {
  const t = toks[i];
  const next = toks[i + 1];
  const isForward =
    !t.breakable &&
    !isWhitespace(t.text) &&
    next &&
    !isWhitespace(next.text) &&
    [...t.text].every((c) => FORWARD_STICKY.has(c) || NUMERIC_PREFIX.test(c));
  if (isForward) {
    carry = t.text + carry;
    continue;
  }
  if (carry) {
    toks[i + 1].text = carry + toks[i + 1].text;
    carry = "";
  }
}
```

병합된 토큰의 `breakable` 은 후속 토큰 것을 따른다 (`「こん` 은 breakable). 아포스트로피는 `don't` 처럼 단어 내부일 때 `Intl.Segmenter` 가 이미 한 세그먼트로 주므로 이 규칙은 단어 앞 `'quoted'` 에만 닿는다.

### B4-2. numeric affix — `$ € ₩ + −` 앞붙임, `% ° ‰` 뒤붙임 (A · B)

**Before**: `LATIN_TRAILING_PUNCT = /^[.,;:!?)\]'"}’”]$/` 에 `%` 없음, 접두 기호 규칙 없음.

**After**: UAX #14 PR/PO 클래스 일부를 표로 두고 B4-1 (접두) · 기존 trailing 병합 (접미) 양쪽에 합류.

```ts
const NUMERIC_PREFIX = /^[$+\\¢£¤¥€₩₹₽−±]$/u; // PR — 후속 토큰에 병합
const NUMERIC_POSTFIX = /^[%‰°]$/u; // PO — 선행 토큰에 병합
const LATIN_TRAILING_PUNCT = /^[.,;:!?)\]'"}’”%‰°…]$/u;
```

upstream 은 UAX #14 표 전체 (`lineBreakNumericAffixRanges`, 약 70 코드포인트) 를 쓴다. 우리는 통화·퍼센트·각도만 넣어도 builder 텍스트 범위는 덮인다.

### B4-3. no-space word chain — 이메일 · 경로 · URL · 식별자 (E · F · F2)

**Before**: `support` `@` `example.com` 이 3 토큰, `@` 뒤 word-like 앞에서 break 허용.

**After** (upstream `canJoinNoSpaceWordBoundary` 축약):

```ts
/** ASCII 기호 run — '-' 제외 (하이픈 뒤 break 는 브라우저도 허용, M/M2 케이스) */
const isSymbolRun = (s: string) =>
  /^[!-\/:-@\[-`{-~]+$/.test(s) && !s.includes("-");

// preprocessTokens 마지막 패스: [word][symbol][word] 가 공백 없이 붙어 있으면 한 단위 (CJK 는 제외)
for (const t of toks) {
  const prev = out[out.length - 1];
  const joinable =
    prev &&
    !isWhitespace(prev.text) &&
    !isWhitespace(t.text) &&
    !isCJK(prev.text) &&
    !isCJK(t.text) &&
    ((!t.breakable && isSymbolRun(t.text)) || // word + symbol
      (t.breakable &&
        isSymbolRun(prev.text.at(-1)!) &&
        prev.text.at(-1) !== "-")); // symbol + word
  if (joinable) {
    prev.text += t.text;
    prev.breakable ||= t.breakable;
    continue;
  }
  out.push(t);
}
```

`overflow-wrap: break-word` 경로는 그대로 grapheme 분할이 열리므로 긴 URL 이 컨테이너를 넘칠 때의 동작은 유지된다 (Chrome 도 `normal` 에서는 넘친다 — F2 오라클).

### B4-4. keep-all — 공백 없이 인접한 CJK 포함 그룹 병합 (N · N2)

**Before** (`tokenize()`): keep-all 은 CJK 세그먼트를 문자로 쪼개지 않을 뿐, `한글` `abc123` 은 별개 breakable 토큰.

**After** (upstream `mergeKeepAllTextSegments`):

```ts
if (wordBreak === "keep-all") {
  // 공백/구두점 경계 없이 이어진 text 토큰 그룹에 CJK 가 하나라도 있으면 한 단위
  for (const t of toks) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.breakable &&
      t.breakable &&
      (isCJK(prev.text) || isCJK(t.text))
    ) {
      prev.text += t.text;
      continue;
    }
    out.push(t);
  }
}
```

upstream 은 여기에 Safari 전용 `breakKeepAllAfterPunctuation` shim 이 붙지만 (WebKit #312099, 수정 upstream 반영 대기) Chrome 기준이면 불필요.

### B4-5. computeLines — 연속 non-breakable 토큰의 폭 누락 (D)

**Before** (`canvas2dSegmentCache.ts:389-394`):

```ts
if (!token.breakable) {
  pendingSpace = w; // ← 직전 pendingSpace 를 덮어쓴다: "Save" " " "/" " " 에서 "/" 와 공백 하나가 사라짐
  lines[lines.length - 1].push(token.text);
  continue;
}
```

**After**: hangable 은 **공백** 뿐이고 (CSS trailing space hang), 구두점·기호는 즉시 줄 폭에 들어간다.

```ts
if (isWhitespace(token.text)) {
  pendingSpace += w;
  lines.at(-1)!.push(token.text);
  continue;
}
if (!token.breakable) {
  lineW += pendingSpace + w;
  pendingSpace = 0;
  lines.at(-1)!.push(token.text);
  continue;
}
```

B4-1~B4-3 을 반영하면 non-breakable 단독 토큰 자체가 드물어져 이 분기는 안전망이 되지만, `maxLineWidth` (fit-content 폭) 가 맞아지는 것은 이 수정에서만 온다. 현재는 Tier 2 `verifyLines` 가 줄 수만 구제한다.

### B4-6. 이모지 canvas 폭 보정 (emoji)

**Before**: 없음. `😀` 하나당 Chrome 152 / DPR 2 에서 +3~4px (24px 미만) 과대 → CSS 보다 이른 줄바꿈.

**After** (upstream `getEmojiCorrection`, 폰트당 1회):

```ts
const emojiCorrectionCache = new Map<string, number>(); // fontString → px
function getEmojiCorrection(fontString: string, fontSize: number): number {
  const hit = emojiCorrectionCache.get(fontString);
  if (hit !== undefined) return hit;
  const ctx = getCtx();
  ctx.font = fontString;
  const canvasW = ctx.measureText("\u{1F600}").width;
  let correction = 0;
  if (canvasW > fontSize + 0.5 && typeof document !== "undefined") {
    const span = document.createElement("span");
    span.style.cssText = `font:${fontString};display:inline-block;position:absolute;visibility:hidden`;
    span.textContent = "\u{1F600}";
    document.body.appendChild(span);
    const domW = span.getBoundingClientRect().width;
    span.remove();
    if (canvasW - domW > 0.5) correction = canvasW - domW;
  }
  emojiCorrectionCache.set(fontString, correction);
  return correction;
}
// measureWithCanvas2D: /\p{Emoji_Presentation}|️/u.test(text) 일 때만 토큰 폭에서 (이모지 grapheme 수 × correction) 차감
```

DOM read 가 폰트당 1회 (`loadingdone` 에서 캐시 clear). 렌더 hot path 밖이라 canvas-rendering.md 의 RAF 규칙과 충돌하지 않는다. `document.fonts` 미로드 상태에서는 측정을 미뤄야 한다 (`getOrMeasureWidth` 의 `fonts.check` 와 같은 조건).

### B4-7. letterSpacing — fallback 축소 (선택)

**Before**: `letterSpacing` 이 0 이 아니면 CanvasKit Paragraph 로 측정 → CSS Preview 와 다른 엔진 (ADR-051 표의 "~90%"). Styles 패널이 노출하는 값이라 production 경로다.

**After**: upstream 0.0.6 방식 — 세그먼트 폭은 그대로 두고 **grapheme 간격 수 × letterSpacing** 을 산술로 가산, 줄 끝 마지막 grapheme 뒤 간격은 Chrome 처럼 paint 폭에 포함 (#171 `getTerminalLetterSpacing`). `Intl.Segmenter({granularity:"grapheme"})` 로 토큰별 grapheme 수를 prepare 시 1회 세어 캐시.

```ts
// computeLines 진입 전
const spacing = style.letterSpacing ?? 0;
const graphemeCounts = spacing
  ? tokens.map((t) => countGraphemes(t.text))
  : null;
// 토큰 폭 = widths[i] + spacing * graphemeCounts[i]  (줄 첫 토큰은 선행 간격 없음)
```

`needsFallback()` 에서 letterSpacing 조건을 지우면 CSS 정합 범위가 늘고 CanvasKit 측정 경로 하나가 준다. `wordSpacing` 은 upstream 도 미지원 — 유지.

### B4-8. EngineProfile epsilon (보류)

현재 0.015 는 Safari 값 (1/64) 에 가깝고 Chrome (0.005) 보다 0.01px 관대하다. 실측 불일치 사례가 없고 upstream `TODO.md` 도 "런타임 보정 가능한가" 를 열린 질문으로 둔다. UA 분기 도입은 근거가 생길 때.

### B4-9. 공백 정규화 (미검증)

`measureWrapped()` 에 들어오는 원문은 정규화되지 않아 `"a  b"` 가 두 칸 폭으로 측정된다. `\n` 은 렌더에서 hard break 로 남는다. Preview 가 Text content 의 `\n` 을 어떻게 내는지 (`<br>` / `pre-line` / collapse) 를 먼저 실측한 뒤 판정. upstream `normalizeWhitespaceNormal` 은 `[ \t\n]+ → " "`.

### B4-10. 적용 요약표 — 파이프라인 단계별 Before / After

| 단계                        | 위치                                   | Before                                                                                | After                                                                                                                   |
| --------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| tokenize                    | `tokenize()`                           | Intl.Segmenter → word-like = breakable, 그 외 non-breakable. CJK 세그먼트는 문자 분할 | 변경 없음 — keep-all 병합은 preprocess 로 이동                                                                          |
| preprocess ① left-sticky    | `preprocessTokens()` 기존 분기         | 라틴 trailing 구두점 단일 문자 + 행두 금칙 → 선행 토큰 병합                           | `% ‰ °` postfix affix 추가                                                                                              |
| preprocess ② forward-sticky | `preprocessTokens()` 역방향 패스       | `KINSOKU_TAIL` 10자, `token.breakable` 조건이라 **dead**                              | 라틴 `" ( [ {` · 둥근 따옴표 · `¡ ¿` · `' ’` · CJK 여는 괄호 · `$ € ₩ + −` prefix 를 후속 토큰에 carry (연속 `("` 포함) |
| preprocess ③ no-space chain | 신규 패스                              | 없음                                                                                  | 공백 없이 `[word][symbol][word]` 는 한 단위 (`-` · CJK 제외) — 이메일·경로·URL·식별자                                   |
| preprocess ④ keep-all       | 신규 패스 (`wordBreak === "keep-all"`) | 없음                                                                                  | 공백 경계 없이 이어진 breakable 그룹에 CJK 가 있으면 한 단위                                                            |
| computeLines                | `computeLines()` non-breakable 분기    | 모든 non-breakable 토큰이 `pendingSpace = w` (덮어쓰기) — 기호도 공백처럼 hang        | 공백만 `pendingSpace += w` (누적), 구두점·기호는 `lineW` 즉시 가산                                                      |
| verifyLines (Tier 2)        | `verifyLines()`                        | 줄 수 결함의 실질 구제 수단 (D 케이스)                                                | 유지 — 잔여 안전망. 1 phase 뒤 miss 0 이면 제거 재검토                                                                  |
| 이모지 보정                 | 신규 `getEmojiCorrection()`            | 없음 → 이모지당 +3~4px (24px 미만, DPR 2)                                             | 폰트당 1회 DOM span 대조, 이모지 grapheme 수 × 보정 차감 (이모지 포함 텍스트만)                                         |
| letterSpacing (선택)        | `needsFallback()` + `computeLines()`   | ≠0 이면 CanvasKit 측정 (엔진 불일치)                                                  | grapheme 수 × spacing 산술 가산 + 줄 끝 terminal spacing → fallback 조건 제거                                           |
| epsilon                     | `LINE_FIT_EPSILON`                     | 0.015 고정                                                                            | 변경 없음 (보류)                                                                                                        |

### B4-11. 케이스별 결과 — Chrome 오라클 · Before · After (fake 등폭 시뮬레이션, `/` = 줄 경계)

| #                      | 입력 (word-break)                                                      | Chrome                           | Before                                 | After                            | 적용 규칙      |
| ---------------------- | ---------------------------------------------------------------------- | -------------------------------- | -------------------------------------- | -------------------------------- | -------------- |
| A                      | `Price $100 today`                                                     | Price / $100 today               | Price $ / 100 today                    | Price / $100 today               | ② prefix affix |
| C                      | `call (주)회사 now`                                                    | call / (주)회사                  | call ( / 주)회사                       | call / (주)회사                  | ② `(`          |
| E                      | `mail support@example.com now`                                         | mail / support@example.com       | mail support@ / example.com            | mail / support@example.com       | ③              |
| F                      | `see foo_bar/baz_qux here`                                             | see / foo_bar/baz_qux            | see foo_bar/ / baz_qux                 | see / foo_bar/baz_qux            | ③              |
| F2                     | `go https://example.com/path/to`                                       | go / https://example.com/path/to | go https://example.com/ / path/to      | go / https://example.com/path/to | ③              |
| G                      | `彼は「こんにちは」と言った`                                           | 彼は / 「こん                    | 彼は「 / こんに                        | 彼は / 「こん                    | ② `「`         |
| H                      | `漢字（注）です`                                                       | 漢字 / （注） / です             | 漢字（ / 注）で / す                   | 漢字 / （注） / です             | ② `（`         |
| L                      | `he said "hello world" ok`                                             | he said / "hello                 | he said " / hello                      | he said / "hello                 | ② `"`          |
| O                      | `it's 'quoted' text here`                                              | it's / 'quoted'                  | it's ' / quoted'                       | it's / 'quoted'                  | ② `'`          |
| N                      | `한글abc123 다음` (keep-all)                                           | 한글abc123 / 다음                | 한글 / abc123 / 다음                   | 한글abc123 / 다음                | ④              |
| N2                     | `価格1200円です` (keep-all)                                            | 価格1200円です                   | 価格 / 1200 / 円 / です                | 価格1200円です                   | ④              |
| D                      | `Save / Cancel` (컨테이너 = 실폭 − 0.5)                                | Save / ⏎ Cancel                  | fits 로 판정 (폭 누락, Tier 2 가 구제) | Save / ⏎ Cancel (Tier 2 불요)    | computeLines   |
| I · M · M2 · P · Q · R | 한글+라틴 normal · 하이픈 · 전화번호 · `Save /` · `Wait...` · `(note)` | —                                | Chrome 과 일치                         | 변화 없음                        | —              |

### B4-12. 시스템 영향

| 항목                            | Before                                   | After                                                                                                                       |
| ------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Tier 3 결함 (16 케이스)         | 11 불일치                                | 16/16 일치 (Chrome 오라클 기준)                                                                                             |
| Skia 렌더 (hintedText)          | 틀린 위치의 `\n` → Skia 만 dangling·분리 | Preview 와 같은 줄 위치                                                                                                     |
| `maxLineWidth` (fit-content 폭) | 연속 기호·공백 누락 → 과소               | 정확                                                                                                                        |
| Tier 2 의존                     | 줄 수 정확성이 `verifyLines` 에 의존     | preprocessing 만으로 정확, Tier 2 는 안전망                                                                                 |
| Canvas 2D 적용 범위             | letterSpacing 텍스트는 CanvasKit         | (B4-7 적용 시) letterSpacing 도 Canvas 2D                                                                                   |
| 이모지 텍스트 (<24px)           | CSS 보다 이른 줄바꿈                     | 폰트당 1회 보정으로 일치                                                                                                    |
| 성능                            | sub-0.01 ms                              | 선형 패스 3개 추가, 같은 자릿수. 이모지 보정은 폰트당 DOM read 1회                                                          |
| 테스트                          | 손으로 만든 fixture (dead 규칙 가림)     | `tokenize()` 실경로 fixture + Chrome 기대값 16 케이스 고정                                                                  |
| 변경 파일                       | —                                        | `canvas2dSegmentCache.ts` (상수 표 · `preprocessTokens` · `computeLines` · 이모지) + 테스트. `needsFallback` 은 B4-7 시에만 |

### B4-13. 퍼포먼스 리스크 점검 (Node 24 마이크로벤치, 500 텍스트 batch, 라벨·영문·한글·일문·keep-all 혼합)

`measureText` 는 stub (JS 파이프라인 오버헤드와 호출 횟수만 측정 — `textMeasure.bench.ts` 와 같은 방법). V2 는 정규식 per-token 없이 코드포인트·Set 조회로 구현한 값.

| 단계                                | Before (µs/text) | After (µs/text) | 변화                                |
| ----------------------------------- | ---------------: | --------------: | ----------------------------------- |
| tokenize (Intl.Segmenter, 공통)     |            10.13 |           10.13 | 0                                   |
| preprocessTokens                    |             1.06 |            3.50 | +2.44                               |
| computeLines                        |             0.24 |            0.59 | +0.35                               |
| 합계 (tokenize+pre+lines)           |            11.61 |           14.72 | **+27%** (+3.1 µs)                  |
| 이모지 사전검사 regex (텍스트당)    |                — |            0.52 | 신규                                |
| grapheme 수 세기 — letterSpacing 시 |                — |           49.18 | **캐시 없이 쓰면 파이프라인의 4배** |
| 토큰 수 = cold `measureText` 호출   |           24,644 |          21,330 | **−13.4%**                          |
| 고유 세그먼트 캐시 키               |              142 |             134 | −6% (메모리 중립)                   |

**호출 빈도 (코드 사실)**: 렌더 경로는 `resolveRetainedParagraph` hit 이면 `measureWithCanvas2D` 에 닿지 않는다 (`nodeRendererText.ts:380` → 520 은 miss 경로) — **프레임당 실행 아님**. 측정 경로 `measureWrapped()` 의 Canvas 2D 분기는 결과 캐시가 없어 layout enrich 호출마다 전체 파이프라인을 다시 돈다 (기존 사실, 이번 변경과 무관).

| 리스크                                         | 판정      | 근거·완화                                                                                                                                                                                         |
| ---------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| preprocess +2.4 µs · computeLines +0.35 µs     | 무시      | 500 텍스트 전량 재측정해도 +1.6 ms, 프레임당이 아니라 편집·리사이즈 pass 당. 토큰 −13% 로 cold `measureText` (실측 비용의 주 항목) 는 오히려 준다                                                 |
| 이모지 보정 DOM read (`getBoundingClientRect`) | 낮음      | 폰트 문자열당 1회 강제 reflow. 사전검사 regex 통과 (이모지 포함) 텍스트에서만 실행, `loadingdone` 시 캐시 clear. 첫 측정이 layout pass 중이면 1회 hitch — font 로드 시 pre-warm 으로 옮길 수 있다 |
| letterSpacing grapheme 수 세기                 | **있음**  | 텍스트당 49 µs 는 수용 불가. 세그먼트 캐시 엔트리에 `graphemeCount` 를 lazy 저장 (upstream `SegmentMetrics` 방식) → 고유 토큰 134개만 1회 계산, 이후 Map 조회. letterSpacing ≠ 0 일 때만          |
| 세그먼트 캐시 무상한                           | 기존      | 병합으로 고유 키가 늘지 않는다 (142→134). 상한 부재는 이번 변경 전부터의 상태                                                                                                                     |
| Tier 2 `verifyLines` (줄당 `measureText`)      | 기존      | 비용 불변. 1 phase 뒤 제거하면 줄 수 × measureText 만큼 절감                                                                                                                                      |
| NBSP 처리                                      | 구현 주의 | 프로토타입 `isWs` 는 ` ` 을 공백으로 봤다 — CSS 에서는 glue (hang 불가). 구현 시 제외                                                                                                             |

**더 큰 레버 (이번 변경과 별개, 기존 gap)**: upstream 은 prepare (tokenize+preprocess+measure) 1회 / layout (산술) 반복의 2-phase 인데, 우리 `measureWrapped()` 는 폭만 바뀌어도 tokenize 10 µs 부터 다시 돈다. `(fontKey, text, wordBreak)` 키의 prepared 토큰·폭 캐시를 두면 리사이즈·Step 4.5 재측정에서 파이프라인 14.7 µs → computeLines 0.6 µs 로 줄어 이번 +3 µs 를 상쇄하고 남는다. 단 content 키 캐시는 상한·refcount 없이는 죽지 않는다 (메모리 `feedback-content-key-cache-has-no-natural-death`) — 도입 시 상한 필수.

## B5. 도입 제안

| 순서 | 내용                                                              | 종류        | 검증                                                                                                                                                                                                                                                                                                     |
| ---- | ----------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | B4-1 · B4-2 · B4-3 · B4-4 · B4-5 (Tier 3 규칙 5 + computeLines 1) | 동작 변경   | 단위 fixture 는 **`tokenize()` 실경로로 생성** (손으로 만든 `breakable:true` 구두점 fixture 금지 — G 의 dead 규칙을 가린 원인). B3 표의 16 케이스를 `canvas2dSegmentCache.test.ts` 에 Chrome 기대값으로 고정. `/cross-check` Text · live 는 빌더 Text 에 A/E/G/L/N 문자열을 넣고 Preview 와 줄 위치 대조 |
| 2    | B4-6 이모지 보정                                                  | 동작 변경   | 이모지 포함 Text 14px 에서 Skia↔Preview 줄 수 대조 (DPR 2 헤드 환경에서만 재현 — headless DPR 1 은 무효, `PLATFORM_BUGS.md` "Retina retest")                                                                                                                                                             |
| 3    | B4-7 letterSpacing                                                | 동작 변경   | letter-spacing 2px Text 의 Skia↔Preview 폭·줄 수 대조                                                                                                                                                                                                                                                    |
| —    | Tier 2 `verifyLines` 제거                                         | 보류        | upstream 은 기각했지만 우리 오버헤드는 sub-0.01ms 로 이득이 없고, D 케이스처럼 안전망이 실제로 동작 중. 1 반영 후 한 phase 지나 miss 0 이면 재검토                                                                                                                                                       |
| —    | `@chenglou/pretext` 직접 도입                                     | 보류        | 여전히 0.0.x, `system-ui` 미지원 (우리 폰트 체인에 포함), hintedText→CanvasKit 결합이 우리 고유. 대안 A 기각 사유 중 "#89/#96/#98 미해결" 은 0.0.7/0.0.8 로 해소됐으나 도입 비용 구조는 그대로                                                                                                           |
| —    | Rust 이관                                                         | 유지 (제외) | ADR-916 2-E 판정 그대로 — 측정은 브라우저 폰트 엔진이어야 CSS 정합                                                                                                                                                                                                                                       |

1 은 `src` 동작 변경이므로 review-loop-closure.md §3 "동작 변경" 행 (원복 RED 전량 · 관련 스위트 · live 필수 · evidence/README/CHANGELOG). 판독 프롬프트에는 "production 재현 시나리오가 없는 커버리지 지적은 LOW deferred" 문구.

## B6. 문서 drift

- `docs/adr/design/051-canvas2d-text-measurement-breakdown.md` 상태 "설계 완료, Phase 0 대기" — 코드는 2026-04-05 `ed3a67ac3` 부터 live.
- 메모리 `adr051-pretext-integration.md` "상태: Proposed, Phase 0 대기" — 같은 drift (이 문서와 함께 갱신).
- `PRETEXT_ANALYSIS.md` 는 v0.0.4 기준. `measureNaturalWidth` 는 0.0.5 에서 복귀, `inline-flow.ts` 는 `rich-inline.ts` 로 개명, `EngineProfile` 에서 `preferEarlySoftHyphenBreak` 제거·`breakKeepAllAfterPunctuation` 추가.

## B7. 재현 자료

**Chrome 오라클** (아무 https 페이지 콘솔에서 — `about:blank` 는 Chrome MCP 가 막는다):

```js
const font = "16px Arial",
  cv = document.createElement("canvas").getContext("2d");
cv.font = font;
const M = (s) => cv.measureText(s).width;
function lines(text, width, css = "") {
  const d = Object.assign(document.createElement("div"), { textContent: text });
  d.style.cssText = `position:absolute;font:${font};line-height:24px;width:${width}px;white-space:normal;overflow-wrap:normal;${css}`;
  document.body.appendChild(d);
  const tn = d.firstChild,
    byTop = new Map();
  let i = 0;
  for (const cp of Array.from(text)) {
    const r = document.createRange();
    r.setStart(tn, i);
    r.setEnd(tn, i + cp.length);
    const rs = r.getClientRects(),
      top = Math.round((rs[rs.length - 1] ?? r.getBoundingClientRect()).top);
    byTop.set(top, (byTop.get(top) ?? "") + cp);
    i += cp.length;
  }
  d.remove();
  return [...byTop.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1]);
}
lines("Price $100 today", M("Price $") + 1.5); // → ["Price", " $100", " today"]
lines("한글abc123 다음", M("한글") + 1.5, "word-break:keep-all"); // → ["한글abc123", " 다음"]
```

**현재 구현 시뮬레이션**: `node --experimental-strip-types` 로 `canvas2dSegmentCache.ts` 의 `tokenize / preprocessTokens / computeLines` 를 직접 import 하고 fake 등폭 (10px/grapheme) 을 넣는다 — `import.meta.hot` 과 `document` 가드가 있어 그대로 실행된다. 프로토타입 규칙은 B4 코드 그대로.

**함정**: upstream 의 `'-' + 숫자` forward-sticky 를 그대로 옮기면 전화번호 `010-1234` 가 `010|-1234` 로 틀린다 — upstream 은 `mergeNumericRuns` 가 다시 쪼개 상쇄한다. 하이픈은 좌측 부착 + 뒤 break 허용이 Chrome 동작. 이모지 canvas/DOM 폭 차이는 헤드 DPR 2 에서만 재현 (headless DPR 1 무효).

---

# C. 두 대조에서 같이 나온 원칙

| 원칙                                        | fulgur 에서                                             | pretext 에서                                                            | composition 적용                                                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 오라클은 명세 손계산이 아니라 브라우저 실측 | WPT ref · Chromium golden                               | `Range.getClientRects()` 코드포인트별 줄 추출                           | tests/parity leg 1 (Chromium) 은 이미 그렇다. `golden.rs` 는 순환 오라클이라 근거로 쓰지 않는다                                                    |
| 단위 fixture 는 실경로로 만든다             | VRT 만으로 덮은 경로는 lib 테스트도 함께 (PR #244 교훈) | 손으로 만든 `breakable:true` fixture 가 dead 규칙 (행말 금칙) 을 가렸다 | fixture 는 `tokenize()` · production 진입점을 실행해 생성. 정적 값 fixture 는 결선을 못 잡는다 (`feedback-functional-gate-vs-static-wiring-check`) |
| 외부 upstream 규칙은 주기적으로 대조한다    | 없음 (fulgur 자체가 upstream)                           | 4~6월 브라우저 sweep 이 우리 결함 9종과 1:1                             | 원리 내재화 경로 (ADR-051 B) 는 upstream preprocessing 변경을 분기마다 대조. fulgur 는 검증 체계 변경 시 재대조 (fulgur-wpt · units)               |
| 성능 리스크는 패턴이 아니라 구현 선택       | newtype 은 `repr(transparent)` 라 0                     | +3 µs/text 는 무시, grapheme 세기 49 µs 는 캐시 없이는 불가             | A5 · B4-13 의 "비용 0 조건" 을 구현 phase 의 게이트로 (perf:baseline frame lane · textMeasure.bench)                                               |
| 문서 drift 는 코드 정본에서 생성으로 막는다 | `css-support.md` 기능별 버전·미지원 동작                | ADR-051 breakdown "Phase 0 대기" 가 5개월 live 코드와 어긋남            | `CSS_SUPPORT_MATRIX.md` 엔진 절 생성 (A4-5). ADR-051 breakdown 상태와 메모리 `adr051-pretext-integration` 갱신 (B6)                                |
| 커밋 golden 이 드리프트 축을 잡는다         | run-twice ≠ golden 비교                                 | Chrome 기대값 16 케이스를 테스트에 고정                                 | visual-parity golden 8 케이스 커밋 (A4-3) · canvas2dSegmentCache 16 케이스 고정 (B5-1)                                                             |

# D. 착수 순서 통합 — 도입 가치 순 (2026-09-04 개정)

> 2026-09-03 초판은 "동작 변경 0 먼저" 라는 절차 편의로 순서를 세웠다. 2026-09-04 코드 실측 (현재 `tokenize → preprocessTokens → computeLines` 를 node 로 직접 실행 · `order` 키 wasm 경계 대조 · `canvaskit-wasm` bump 이력 · git 단위 혼동 버그 이력) 으로 **도입 가치** 기준으로 재정렬한다. 등급: **A** = 지금 production 코드에서 재현되는 결함을 고친다 · **B** = 기록된 사고가 있고 재발을 막는다 · **C** = 예방·위생 (사고 기록 없음, 트리거 성립 시만 가치).

| 순서 | 항목                                                       | 등급 | 실측 근거                                                                                                                                                                                                                                                                     | 종류          | phase / 트리거                                           |
| ---- | ---------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------- |
| 1 ✅ | pretext ① Tier 3 규칙 5 + computeLines 1                   | A    | B3 결함 10 케이스 (A·C·E·F·G·H·L·O·N·N2) 전부 현재 코드에서 재현. 행말 금칙 dead 확정 (`tokenize` 가 `「 ( " '` 을 `breakable:false` 로 냄). D 케이스 폭 누락 재현 (토큰 폭 합 130 vs `maxLineWidth` 110). `nodeRendererText.ts:539` hintedText 로 Skia 에 직결 — 사용자-가시 | **동작 변경** | 1 · live 필수 (빌더 Text 에 A/E/G/L/N 문자열)            |
| 2    | fulgur ⑤ Taffy 주석 sweep + 매트릭스 생성                  | B    | 비테스트 src 35 파일 · `CSS_SUPPORT_MATRIX.md` 04-06 정지 · Taffy 71건 · 오판 2회 기록 (메모리 `feedback-stale-dependency-comment-is-not-engine-constraint`). 가치 본체는 sweep — 생성 스크립트는 `layoutCapabilityMatrix.ts` (참조 = 테스트 1개) 가 정본인지 먼저 확인       | 동작 변경 0   | 1 · sweep 선행, 생성은 정본 확인 후                      |
| 3    | fulgur ② wasm strict 입력                                  | B    | 오탐 132/288 기록. 추가 실증: TS 가 `order` 를 지금도 전송 (`utils.ts:5872`) 하지만 `NodeStyle` 미선언 → 무음 드롭, `tree.rs:296` guard 주석은 "유입 경로 생기면 선언" 이라 계약 guard 가 유입을 이미 놓침 (동작 영향 0 — `fullTreeLayout.ts:1824` 가 TS 에서 pre-sort)       | 동작 변경 0   | 1 · 첫 run 이 미지 키 인벤토리                           |
| 4    | pretext ③ letterSpacing fallback 축소                      | B    | `needsFallback():384` + `TypographySection.tsx:276` 노출 — production 경로. grapheme 수 캐시 없으면 텍스트당 49 µs (B4-13) 라 캐시가 착수 조건                                                                                                                                | **동작 변경** | 1 · 1 이후 · grapheme 수 캐시                            |
| 5    | pretext ② 이모지 보정                                      | B−   | B3 emoji 실측 (Chrome 152 · DPR 2) 은 문서 기록뿐, 09-04 재확인 안 함. headless DPR 1 무효                                                                                                                                                                                    | **동작 변경** | 1 · DPR 2 헤드 환경에서 재현 확인 후                     |
| —    | fulgur ③ 결정성 기준선 축                                  | C+   | 논리는 성립 (양 leg 가 catalog 파생 → 토큰 회귀는 대칭 통과). gate 는 pre-push + `deploy.yml` 실행이라 3축 추가 시 실효. 그러나 "게이트가 놓친 회귀" 사고 기록 없음                                                                                                           | 동작 변경 0   | 대칭 통과한 토큰 회귀가 실제로 1건 발생할 때             |
| —    | fulgur ④ CanvasKit 어댑터                                  | C    | 49 파일 (비테스트 35) 직접 import 는 사실. `canvaskit-wasm ^0.42.0` 은 도입 후 bump 0회 (git log 1 commit). 지금 하면 50 파일 경로 diff 만 남는다                                                                                                                             | 동작 변경 0   | `canvaskit-wasm` bump 또는 ADR-921 (Proposed 08-17) 착수 |
| —    | fulgur ① 단위 브랜드 타입                                  | C    | `/dpr` `/zoom` 변환 70곳. git 에 단위 공간 혼동 버그 이력 0건. A2 가 든 근거 2건 (border-box 메모리 · ADR-198 R14) 은 box 계약 · 하니스 스크린샷 배율 문제라 단위 공간 혼동이 아님 — 근거 가장 약함                                                                           | 동작 변경 0   | 단위 공간 혼동 버그 1건 발생 시                          |
| —    | fulgur 조건부 2 (WPT 코퍼스 · knownDefects 항목화)         | —    | A6-1 그대로                                                                                                                                                                                                                                                                   | —             | 다음 엔진 결함이 손 격자 밖에서 나올 때                  |
| —    | pretext 보류 3 (Tier 2 제거 · 라이브러리 도입 · Rust 이관) | —    | B5 표 그대로                                                                                                                                                                                                                                                                  | —             | B5 표 조건                                               |

동작 변경 0 항목 (2·3) 은 review-loop-closure §3 축소 절차, 동작 변경 항목 (1·4·5) 은 원복 RED 전량 · live 필수 · evidence/README/CHANGELOG. 판독 프롬프트 필수 문구는 §4 그대로. C 등급 3건은 트리거 성립 전 착수하지 않는다 — 초판 순서 (② → ④ → ⑤ → ①) 는 절차 편의였고 가치 순서가 아니었다.

**반영 이력**: 순서 1 (pretext ①) 은 2026-09-05 `ba579c7a6` 로 반영 완료 — 원복 RED 13/18 → 18/18 GREEN,
회귀 538건, 빌더 Skia ↔ Chrome DOM 줄 위치 live 대조 일치. 근거
[docs/adr/evidence/051-tier3-upstream-rules-live.md](../../adr/evidence/051-tier3-upstream-rules-live.md).
§B6 의 ADR-051 breakdown 상태 drift 도 같이 정정했다. 다음은 순서 2 (fulgur ⑤ Taffy 주석 sweep).

문서 drift 추가 확인 (09-04): A2 "51 파일" 은 49 (비테스트 35). ADR-051 breakdown "Phase 0 대기" 는 `featureFlags.ts:35` `USE_CANVAS2D_MEASURE = true` 와 어긋남 (B6 그대로).
