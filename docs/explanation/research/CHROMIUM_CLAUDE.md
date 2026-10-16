# Chromium 대조 통합 — composition Canvas (Skia wasm) 의 페인트 · 레이아웃 · 최적화 · 실행 절차

> **작성일**: 2026-10-16 · **Chromium 참조 revision**: `33688427bc1a316cecb28d5651ad25208ba9ab53` · **composition 기준**: `45026d1d8`
> **통합한 문서 3 개**
>
> | 원본                                       | 작성        | 성격                                                     | 이 문서의 위치     |
> | ------------------------------------------ | ----------- | -------------------------------------------------------- | ------------------ |
> | `CHROMIUM_CC_BLINK_PAINT_DELTA_2026-10.md` | Claude Code | 판정 — 페인트 · 구조 · CSS 전수 대조 · Blink 포팅 지도   | Part A (§1 ~ §5)   |
> | `BLINK_LAYOUT_DELTA_2026-10.md`            | Claude Code | 판정 — 레이아웃 함수 단위 대조 (격차 36 · 같음 확인)     | Part B (§6 ~ §11)  |
> | `CHROMIUM_HTML_CSS_CANVAS_PHASE_PLAN.md`   | Codex       | 절차 — 범위 · 이식 절차 · P0 ~ P15 Phase · gate · ledger | Part C (§12 ~ §18) |
>
> **이 문서가 정본이다.** 원본 3 개는 2026-10-17 통합 뒤 삭제했다 — 원본 이력은 커밋 `a6ce961a4` (페인트 문서의 마지막 수정분은 이 통합본에만 있다).
>
> 두 분석의 교차 검증 (서로 나은 점 · 빠진 점 · 합치는 방법) 은 Part D (§19). 통합하며 고친 것은 §0-3.
>
> **목적**: Builder Canvas (CanvasKit wasm, `apps/builder/src/builder/workspace/canvas/skia/`) + Rust 레이아웃 엔진 (`packages/engine/src/`) 이 Preview (Chrome DOM) 와 **같은 화면** 을 더 정확하고 더 싸게 그리도록, Chromium 의 어느 구조 · 알고리즘 · 상수 · 테스트를 가져올지 판정하고 (Part A · B), 그 작업을 어떤 순서 · 검증으로 진행할지 정한다 (Part C).
> **3-domain**: 전부 D3 (시각 스타일) 의 Builder consumer 내부. D1 · D2 · catalog 무변경. 대칭의 범위는 Chromium 이 구현한 CSS 전체가 아니라 **Preview 가 실제로 내보내는 값** 이다 — Codex 문서의 더 넓은 범위 (table · float · 상태 · 애니메이션) 는 사용자 결정 대기 (§19-2).
> **판정 oracle**: Blink 코드가 아니라 **Chrome 픽셀 (G3 하니스) · `getBoundingClientRect` (ADR-156 차등 oracle)**. 코드 대조는 어디를 재야 하는지 가리키는 지도다 (measurement-validity §2 #3 — 코드끼리 서로 확인하는 oracle 금지).
> **방법의 한계**: 참조 파일 수 grep 은 상한 지표다 (메모리 `feedback-infra-exists-vs-wired-consumption-path`). "확정" = 소비 경로 · Blink 소스까지 확인, "확인 필요" = grep 0 또는 이름 충돌로 판정 보류.
> **ID 체계**: `S*` = 페인트 · 최적화 항목 (Part A) · `B* · F* · G* · X*` = 레이아웃 block · flex · grid · 박스 모델 (Part B) · `I1 · T1` = 엔진 미구현 축 (§4-1) · `P0 ~ P15` · `G0 ~ G15` = Codex Phase · gate (Part C — 레이아웃 grid 의 `G1 ~ G18` 과 겹치므로 gate 는 항상 "gate G*" 로 적는다).

---

## 0. 결론

### 0-1. 한 단락 요약

Chromium 의 **구조** 대부분 (display list · display item 캐시 · raster invalidation · stale tile 재사용 · interest rect · bbox 컬링) 은 composition 이 **이미 같은 모양으로 갖고 있다** (§1). 가져올 가치가 있는 것은 구조가 아니라 **페인트 알고리즘 · 상수** (그림자 sigma · 이미지 샘플링 판정 · border style · 합성 italic) 와 **레이아웃 명세 절** (grid 최소 기여 · span 분배 · placement 커서 · absolute static position) 이고, 측정된 성능 꼬리에 닿는 구조는 하나 (property node 분리, §3-1) 뿐이다. 레이아웃에는 알고리즘이 아니라 **배선 회귀** 2 건 (baseline · strut 미전송, sticky · fixed 미전송) 이 있어 가장 먼저 닫는다. Preview 가 Chrome 에서 돌기 때문에 **Blink paint 코드는 명세보다 정확한 정답지** 다 — paint 는 Blink 알고리즘을 옮기고, layout 은 Blink 의 분기 순서 · 상수 + Chromium WPT reftest 를 fixture 로 쓴다 (§5).

Codex 문서는 **절차** (범위 정의 · 9 단계 이식 절차 · P0 ~ P15 · gate · ledger 11 필드 · 세 비교축) 를 제공하고 확인된 격차는 없다. Claude Code 두 분석은 **판정** (확정 격차 · 같음 · 순서) 이다. 둘은 서로 대체하지 않는다 — Part A · B 의 격차 표가 Codex P0 manifest 의 초기 행이고, Part C 의 절차 · gate 가 각 격차를 닫는 방식이다 (§19-3).

### 0-2. 통합 착수 순서

오른쪽 끝 열은 Codex Phase (Part C) 중 그 작업이 속하는 곳.

| 순서 | ID                           | 작업                                                                                                                             | 종류        | 크기        | 검증                                                                             | Codex Phase         |
| ---- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------- | -------------------------------------------------------------------------------- | ------------------- |
| 0    | —                            | Codex P0 manifest · source ledger 형식 확정 — 초기 행 = 이 표 + §4 · §6 ~ §9 격차 (상태 `verified-divergent` 류)                 | 기반        | 작음        | 기존 기준선 인용 (§3) · 재측정 금지                                              | P0                  |
| 1    | B1 · B2                      | `styleOf` 가 `lineHeight` (px) · `leafBaseline` · `strutBaseline` 을 내보냄 (옛 `f1ec24e53` · `3a1b3200d` 계산을 catalog 경로로) | 배선 회귀   | 중간        | ADR-156 차등 oracle — block frame 안 크기 다른 Button 둘 · 작은 inline 하나      | P4 · P5             |
| 2    | S1                           | 그림자 sigma — box-shadow · text-shadow `radius × 0.5`, `drop-shadow()` 변환 없음 (3 곳)                                         | 확정 결함   | 한 커밋     | `/cross-check` Card · Popover 그림자. CHANGELOG                                  | P7 (조기 착수 허용) |
| 3    | X8                           | sticky (· fixed) 배선 — `styleOf` 전송 + 엔진 sticky (`ComputeStickyPositionConstraints` 계약)                                   | 배선 회귀   | 중간        | rule 2건 (`componentRulesTable.ts:5599 · 6903`) live + Compare Mode 스크롤       | P4                  |
| 4    | S2                           | 이미지 샘플링 — `ComputeInterpolationQuality` 판정 함수 이식 (일괄 linear + mip 아님)                                            | 확정 결함   | 한 커밋     | 줌아웃 · 축소 이미지 cross-check. `getImageCacheSize` 로 mip 메모리              | P8                  |
| 5    | S3                           | `font-variant-numeric` (+ `fontVariantCaps` · `fontFeatureSettings`) 키 소비                                                     | 확정 결함   | 한 커밋     | DateInput Compare Mode · `textAxisGate` 재생성                                   | P5                  |
| 6    | G1 · G2                      | grid 최소 기여 (`CalculateIntrinsicMinimumContribution`)                                                                         | 알고리즘    | 작음        | WPT `css-grid/grid-items/grid-item-min-auto-size-*` · 1fr 텍스트 말줄임          | P6                  |
| 7    | F4                           | flex row definite item §4.5 content 측정 복원                                                                                    | 알고리즘    | 중간        | ADR-204 perf 사유를 ADR-246 ratchet 카운트로 재판정                              | P6                  |
| 8    | S4                           | 합성 italic · bold 1 회 대조 → 결함이면 skew −0.25 · embolden                                                                    | 확인 필요   | 작음        | Select placeholder Compare Mode                                                  | P5                  |
| 9    | G3 · G4 · G7 · G8            | grid span 기여 · placement 커서                                                                                                  | 알고리즘    | 중간        | WPT `grid-definition/grid-flexible-track-*` · `grid-items/grid-auto-placement-*` | P6                  |
| 10   | X3 · X4 · X1 · X2 · X5       | absolute static position · relative `%` · 음수 잉여 margin auto                                                                  | 알고리즘    | 작음        | WPT `css-position/static-position/*` · `position-relative-*`                     | P4                  |
| 11   | S5 · S6                      | borderStyle 분포 → 쓰이는 style 만 BoxBorderPainter 이식 · outline-style · 개별 transform · decoration 두께                      | 격차        | 작음 ~ 중간 | 쓰이는 값만. G3 하니스 `approvedDifferences` 대조                                | P7 · P9 · P5        |
| 12   | X9                           | `em · ch · ex` — `ctx_for` 에 자기 font-size · `ch` 측정                                                                         | 알고리즘    | 작음        | `maxWidth` 의 `ch` 측정 경로 (`compositionRoot.ts:1215-1229`) 를 `width` 로 확장 | P2 · P4             |
| 13   | B4 · X10 · G16 · X6 · X7     | vertical-align 확장 · aspect-ratio 3 건                                                                                          | 알고리즘    | 중간        | WPT `css-inline/vertical-align-*` · `css-sizing/aspect-ratio/*`                  | P5 · P6             |
| 14   | S9                           | 속성 → 소비자 표 static test (= 기능 ledger, §18-1)                                                                              | 재발 차단   | 작음        | "생성 CSS 가 내보내는데 Canvas 표에 없는 속성" 0 ratchet                         | P0 · P14            |
| 15   | S8                           | under-invalidation dev 플래그                                                                                                    | 검증        | 작음        | perf 하니스 `--check-invalidation` ratchet A 0                                   | P1                  |
| 16   | —                            | 낡은 헤더 · 주석 · 규칙 문서 6 곳 정정 (§0-4)                                                                                    | 문서        | 작음        | `pnpm docs:stale-symbols`                                                        | —                   |
| 17   | S7                           | property node 분리 — 새 ADR (`/create-adr` 는 사용자 전용)                                                                       | 최적화 구조 | 큼          | Context = ADR-264/265 종결 카운트. Phase 0 카운트 RED                            | P13-A               |
| 18   | 드문 입력 24 · I1 · T1 · S10 | 레이아웃 드문 입력 · inline run 혼합 · table · 타일 · Worker                                                                     | 보류        | —           | 입력을 만들 수 있게 되는 날 WPT fixture 일괄 · 각 재개 조건이 카운트로 성립할 때 | P4 · P5 · P15       |

원칙: **한 격차 = 한 커밋 = 원복 RED 1 + cross-check (또는 live) 1.** catalog 가 내보내지 않는 Blink 분기는 옮기지 않는다.

### 0-3. 통합하며 고친 것

- 페인트 문서 결론 표 · §5-1 · §6 에 남아 있던 "이미지 샘플링 = 일괄 linear + mipmap" 을 §2-2 의 판정 함수 이식으로 맞췄다 (§2-2 본문은 이미 정정돼 있었다).
- 페인트 문서의 엔진 격차 `G4` (inline run 혼합) · `G5` (table) 가 레이아웃 문서의 grid `G4` · `G5` 와 ID 가 겹쳐 **`I1` · `T1`** 로 바꿨다.
- 페인트 문서 §4-1 이 block 행에 `leafBaseline · strut` 를 "구현" 으로 적었으나, 엔진은 받되 production 이 보내지 않는다 (B1 · B2) — "엔진 구현 · 배선 끊김" 으로 고쳤다.
- 같은 문서 §4-1 position 행의 `fixed / sticky` "구현" 도 X8 에 맞춰 "엔진 미전송 (in-flow static)" 으로 고쳤다.
- 페인트 문서의 항목 번호 1 ~ 10 은 Codex Phase `P0 ~ P15` 와 겹치지 않게 **`S1 ~ S10`** 으로 바꿨다. 레이아웃 문서의 "닫는 순서" 와 페인트 문서의 "착수 순서" 는 §0-2 하나로 합쳤다.
- Codex 문서 본문 (Part C) 은 내용을 바꾸지 않고 옮겼다. 판정이 다른 자리에는 **`> 통합 주석`** 을 달아 Part A · B · D 로 이었다.

### 0-4. 낡은 문서 · 주석 (코드는 맞는데 설명이 틀린 것)

- `flex.rs:25-28` 헤더 "미구현: aspect-ratio · align-self · auto margin" — 셋 다 구현됨 (슬롯 17 · 20 · 22).
- `grid.rs:25-29` 헤더 "미구현: min-content / max-content / fit-content()" — `tree.rs:5785 · 5887` 이 해소함. `dense` 만 실제 미구현.
- `tree.rs:4350` "auto-repeat 자체는 scope 밖" — 바로 아래 4355 에서 펼친다.
- `tree.rs:4050-4052` "TS 는 'normal' 을 보내지 않는다" — px 도 보내지 않는다 (B1).
- `.claude/rules/layout-engine.md` "`position: fixed` 는 absolute 근사" — 실제로는 `styleOf` 가 떨어뜨려 in-flow static.
- 메모리 `feedback-inline-line-box-inflation-missing-leaf-baseline` — "`f1ec24e53` 이 공급한다" 는 옛 파이프라인 얘기 (2026-10-16 갱신 완료).

---

# Part A. 페인트 · 최적화 (Chromium cc · Blink paint)

> **방법**: Chromium `docs/how_cc_works.md` · `core/paint/README.md` · `box_painter_base.cc` · `box_border_painter.cc` · `shadow_data.h` · `font_platform_data.cc` 를 읽고 composition 구현 (SkiaRenderer · renderCommands · nodePictureCache · subtreeCommandPatch · subtreeTranslate · nodeRendererBorders · nodeRendererText · effects · imageCache · styleConverter) 및 2026-07 ~ 10 측정 기록 (ADR-153 · 189 · 263 · 264 · 265) 과 대조 (§1 ~ §3). HTML · CSS 화면 기능을 수요측 (생성 CSS 약 190 속성 · Styles 패널 약 60 속성) ↔ 공급측 (Canvas 변환기 · Skia 렌더러 · 엔진 `NodeStyle`) 으로 전수 대조 (§4). 격차마다 Blink 정답지 · CanvasKit 대응 (§5).

## 1. 구조 대응표 — "이미 있는 것"

| Chromium                                                                                                                                                           | composition 대응                                                                                            | 판정                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `cc::DisplayItemList` / `PaintRecord` (플랫 op 목록)                                                                                                               | `renderCommands.ts` 플랫 command stream (`CMD_ELEMENT_BEGIN … END`)                                         | 동형. ADR-263 이 Proxy piece-table 비용 · 선형 skip 을 제거                                            |
| Blink `PaintController` display item 캐시 (client identity 로 재사용)                                                                                              | `nodePictureCache.ts` — `SkiaNodeData` identity + size 키, 위치 제외 (ADR-153 P3)                           | 동형. Blink 는 push 식 invalidation flag, composition 은 identity 교체 — 효과 같음                     |
| Blink subsequence caching (`SubsequenceRecorder`)                                                                                                                  | drag 중 `dragSubtreeCache`                                                                                  | 부분 동형. 상시 서브트리 picture 는 ADR-263 대안 B 로 기각 (편집 1회 = 층 전체 재기록)                 |
| raster invalidation (`RasterInvalidator`) + `DamageTracker`                                                                                                        | ADR-189 damage 경로 (`pendingDamage` · `executeDamageRenderCommands`), ADR-263 에서 catalog scene 에 재연결 | 동형. clean · damage · full 3 상태, 실패는 full 수렴 (HC4)                                             |
| 카메라 변경 시 기존 tile scale 표시 → idle 재래스터                                                                                                                | `SkiaRenderer` camera-only blit (`drawImageCubic`) + 정착 뒤 content 재렌더 (Pencil 모델)                   | 동형                                                                                                   |
| `PictureLayerTiling` interest rect                                                                                                                                 | content surface = viewport + `contentPaddingDevicePx` (`createContentSizedSurface`)                         | 동형 (타일 분할만 없음)                                                                                |
| `SkRTreeFactory` picture 재생 bbox 컬링                                                                                                                            | Rust `spatial_index` `queryRect` 로 가시 후보 + 조상 closure 만 실행                                        | 동형 (명령 생성 전에 컬링하므로 더 세밀)                                                               |
| `cc::Scheduler` BeginFrame · deadline · latency mode                                                                                                               | `frameScheduler.ts` dirty + rAF                                                                             | 단일 스레드라 성립하지 않음                                                                            |
| `GpuImageDecodeCache` (scale 별 decode · mip · GPU 상주)                                                                                                           | `imageCache.ts` `MakeImageFromEncoded` 원본 해상도 1 개 · sampling 미지정                                   | **격차** → S2                                                                                          |
| `BoxBorderPainter` · `BoxPainterBase::PaintNormalBoxShadow / PaintInsetBoxShadow`                                                                                  | `nodeRendererBorders.ts` `renderBoxShadows` · `renderInnerBoxShadows`                                       | inset 구성 (EvenOdd donut + blur + 상자 clip) 은 Blink 와 같은 방식. **sigma 와 border style 만 격차** |
| property trees (transform · clip · effect · scroll 을 draw 목록에서 분리)                                                                                          | 명령에 좌표 · clip · scroll 문맥이 구워짐 — 옮김은 `subtreeTranslate` 재기록, 문맥 변경은 patch 거부        | **격차** — 측정된 꼬리와 일치 → S7 (§3-1)                                                              |
| LayoutNG 알고리즘 큰 틀 (margin collapse · BFC · shrink-to-fit · min/max clamp 순서 · flex 동결 기계 · grid fr 가상 크기 루프 · auto-repeat · absolute inset 해소) | Rust `block.rs` · `flex.rs` · `grid.rs` · `tree.rs`                                                         | 동형 — 세부 "같음 확인" 은 §6 ~ §9 각 절 끝                                                            |

---

## 2. 페인트 정확도 — 도입 항목

| ID  | 항목                                                                                                                         | 축        | 상태                    | Chromium 정답지                                                                         | 한 줄 근거                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | 그림자 blur → sigma 를 **radius × 0.5** 로 (box-shadow · text-shadow), `drop-shadow()` 는 변환 없음                          | 정확도    | 확정 결함               | `core/style/shadow_data.h` `BlurRadiusToStdDev`                                         | `styleConverter.ts` 3 곳이 `/ 2.355` — Chrome 보다 그림자가 15 % 선명. 한 줄 수정 + cross-check                                                            |
| S2  | 이미지 샘플링 — **`ComputeInterpolationQuality` 판정 이식** (크기별 nearest / linear / linear + mip)                         | 정확도    | 확정 결함               | `platform/graphics/graphics_context.cc` · `cc/paint/paint_flags.cc`                     | `nodeRendererImage.ts:176` `drawImageRect` 가 sampling 인자 없음 = 항상 nearest. 줌아웃 · 축소 이미지가 Preview 와 다르게 깨진다                           |
| S3  | `font-variant-numeric` 키 소비 (`tnum` 등)                                                                                   | 정확도    | 확정 결함               | `platform/fonts/font_description.cc` (feature 표)                                       | `cssResolver.ts` 는 `fontVariant` 만 OpenType feature 로 변환. DateInput `tabular-nums` 가 Canvas 에서 떨어져 자릿수 폭이 다르다                           |
| S4  | 합성 italic · bold — `setSkewX(-0.25)` · `setEmbolden`                                                                       | 정확도    | 확인 필요               | `platform/fonts/font_platform_data.cc` `CreateSkFont`                                   | Pretendard 는 italic face 가 없다. Chrome 은 합성, CanvasKit 은 face 매칭만 → upright 로 떨어질 수 있음                                                    |
| S5  | **BoxBorderPainter** 알고리즘 — `double · groove · ridge · inset · outset` · 변 색이 다른 모서리 miter · dash 간격 보정      | 정확도    | 격차                    | `core/paint/box_border_painter.cc` (BSD)                                                | composition 은 solid · dashed · dotted 만. catalog 가 내보내는 borderStyle 분포를 센 뒤 쓰이는 것만 옮긴다                                                 |
| S6  | `outline-style` · CSS Transforms 2 개별 속성 (`rotate · scale · translate`) · `text-decoration-thickness / underline-offset` | 정확도    | 격차 (상태 선택자 위주) | `core/paint/outline_painter.cc` · `core/paint/text_decoration_info.cc`                  | 생성 CSS 에 있으나 거의 `:focus-visible` · `[data-pressed]` 등 상태 안이라 정적 대칭 영향은 작음                                                           |
| S7  | **Property node 분리** — 명령 스트림이 좌표 대신 transform · clip · scroll 노드 id 를 참조                                   | 최적화    | 설계 필요               | `cc` property trees · Blink `PaintPropertyTreeBuilder` · `PaintChunk`                   | 측정된 꼬리 (ADR-264/265: 옮겨진 상자 수만큼 `subtreeTranslate` · clip 복제 · rect diff) 가 "명령에 좌표가 구워져 있어서" 다. 새 ADR + Phase 0 카운트 필수 |
| S8  | **under-invalidation checking** 을 dev 상시 assertion 으로                                                                   | 검증      | 기계 있음               | `platform/graphics/paint/paint_under_invalidation_checker.cc` · `raster_invalidator.cc` | `__composition_RENDER_PATH_DEBUG__` `forceFull` oracle 을 damage 프레임마다 픽셀 비교하는 플래그로. S7 의 안전망                                           |
| S9  | 속성 → 소비자 표 static test                                                                                                 | 재발 차단 | 설계 필요               | `core/css/css_properties.json5`                                                         | S1 · S3 · S6 이 전부 "생성 CSS 가 내보내는데 Canvas 소비 표에 없는 속성" 이다. `archetypeDefaultCohort.static.test.ts` 와 같은 ratchet 형식                |
| S10 | Canvas 를 **Worker (OffscreenCanvas)** 로 — cc 의 main ↔ compositor 분리                                                     | 최적화    | 장기 · 보류             | `cc` 스레드 모델 (`ProxyMain` / `ProxyImpl`)                                            | 선택 끊김 (HC3) 의 원인이 React · RAC Layers 행 렌더라 Canvas 를 옮겨도 그 비용은 그대로                                                                   |
| —   | 타일 래스터 캐시 (`PictureLayerTiling` · `TileManager`)                                                                      | 최적화    | 보류                    | `cc/tiles`                                                                              | ADR-263 재개 조건 ("A 뒤에도 flush · 래스터가 상위") 미성립 · content surface 가 이미 viewport 크기                                                        |
| —   | PaintOpBuffer 연속 바이트 버퍼 · OOP raster · `cc::Scheduler` deadline · LCD text · viz · GPU raster provider                | —         | 해당 없음               | `cc/paint` · `cc/scheduler` · `viz`                                                     | 단일 스레드 wasm · WebGL surface 에 대응물이 없다. `executeCommandRange` 는 ADR-263 G5 에서 프로필 상위를 벗어났다                                         |

### 2-1. S1 그림자 sigma (확정 결함)

- **Chromium** `core/style/shadow_data.h`:

  ```cpp
  static inline float BlurRadiusToStdDev(float radius) {
    // Per spec, sigma is exactly half the blur radius:
    // https://www.w3.org/TR/css-backgrounds-3/#shadow-blur
    return radius * 0.5f;
  }
  float BlurAsSigma() const { return BlurRadiusToStdDev(BlurValue()); }
  ```

  `box_painter_base.cc` 는 outer · inset 둘 다 `shadow.BlurAsSigma()` 를 `DrawLooperBuilder::AddShadow` 에 넘기고, inset 은 bounds 를 `3 × sigma` 만큼 넓힌다. text-shadow 도 같은 `ShadowData`.

- **composition** `styleConversion/styleConverter.ts` 3 곳 (box-shadow 파서 · filter drop-shadow 파서 · text-shadow 파서) 이 `sigma = blurRadius / 2.355`. 주석의 "W3C" 인용이 틀렸다 — 명세는 "standard deviation equal to half the blur radius".
- **filter: drop-shadow()**: filter-effects-1 은 셋째 값을 **standard deviation 자체** 로 정의한다. 변환 없이 σ = 값. 현재는 2.355 배 선명하다. 구현 전 Blink `core/paint/filter_effect_builder.cc` 의 `kDropShadow` 분기로 1 회 확인. box-shadow 와 drop-shadow 는 입력 의미가 달라 **같은 상수를 일괄 적용하지 않는다** (Codex 문서와 같은 결론).
- **영향**: `box-shadow: 0 4px 12px` 에서 Canvas σ 5.1 / Preview σ 6. G3 하니스가 상자 가장자리 대역만 비교해 지금까지 잡히지 않았을 수 있다.
- **수정**: box-shadow · text-shadow → `radius * 0.5` · drop-shadow() → 변환 없음. `/cross-check` 그림자 있는 Card · Popover 1 회.

### 2-2. S2 이미지 샘플링 · 축소 디코드 (확정 결함)

- **Chromium** (고정 SHA 에서 사슬 전체 확인): `image-rendering: auto` → `ComputedStyle::GetInterpolationQuality` (`core/style/computed_style.cc:1318`) → `GetDefaultInterpolationQuality()` = **kMedium** (`platform/graphics/graphics_context_types.cc:33`, `UseLowQualityInterpolation` 플래그면 Low). 그 다음 `GraphicsContext::ComputeFilterQuality` 가 src/dest 크기로 **낮춘다** (`graphics_context.cc:89-177` `ComputeInterpolationQuality`):

  | 조건                     | 결과                        |
  | ------------------------ | --------------------------- |
  | src 와 dest 가 같은 크기 | None (nearest)              |
  | 어느 한 변 ≤ 8px         | None (dest 가 비정수면 Low) |
  | 한 축만 ≥ 3× 확대        | None                        |
  | 양축 ≥ 3× 확대           | Low                         |
  | 크기 차 < 2.5 %          | None                        |
  | 로딩 중                  | Low                         |
  | 그 외                    | Medium                      |

  마지막으로 `ComputeSamplingOptions` (`graphics_context.h:482`) 가 양축 확대면 `kUpscale`, 아니면 `kUnknown` 을 붙여 `cc::PaintFlags::FilterQualityToSkSamplingOptions` (`cc/paint/paint_flags.cc`) 로 — Medium + Unknown/Upscale = **`(Linear, MipmapMode::kLinear)`**, Medium + Default = `(Linear, kNearest)`, Low = `(Linear, None)`, None = `(Nearest, None)`. Blink 의 enum 에는 High 가 없어 `<img>` 는 **cubic 을 쓰지 않는다**. `GpuImageDecodeCache` 는 그 뒤 cc 래스터에서 scale 별 decode · mip 을 만든다.
  `image-rendering: pixelated · crisp-edges` → None · `-webkit-optimize-contrast` → Low.

- **composition** `nodeRendererImage.ts:176` `canvas.drawImageRect(skImage, src, dst, paint)` — 이 오버로드는 `SkSamplingOptions()` 기본값 = **nearest**. 줌아웃 · 상자보다 큰 원본은 계단 · 반짝임.
- **수정**: 위 판정 함수를 그대로 옮긴다. Medium 이면 `drawImageRectOptions(img, src, dst, FilterMode.Linear, MipmapMode.Linear, paint)` + 로드 시 `image.makeCopyWithDefaultMipmaps()` (원본 `delete`), Low 는 `(Linear, None)`, None 은 `(Nearest, None)`. src/dest 비교는 **CSS px 기준** (Canvas 카메라 zoom 은 DOM 에 대응이 없으므로 zoom 1 이 parity 케이스 — zoom 중에는 dest 에 zoom 을 곱한 값으로 같은 규칙). `drawImageRectCubic` 은 Chrome `<img>` 경로에 없으므로 쓰지 않는다.
- **버전 의존**: 이 정책은 Chromium revision · backend 의존이다 (Codex 지적). 옮길 때 `blinkProvenance.ts` (§5-2) 에 revision 을 적는다.
- **메모리**: mip +33 %. 큰 원본은 Chromium 처럼 **표시 크기 × dpr × 2 상한으로 decode** (`createImageBitmap(blob, { resizeWidth, resizeQuality: "high" })` → `MakeImageFromCanvasImageSource`) 가 다음 단계 — ADR-153 이미지 캐시 상한과 같은 자리.

### 2-3. S3 `font-variant-numeric` (확정 결함)

- `cssResolver.ts` 는 `fontVariant` 키만 OpenType feature (`tabular-nums → tnum` 등, `cascade.rs` 에도 같은 표) 로 바꾼다. CSS 속성 `fontVariantNumeric` · `fontVariantCaps` · `fontFeatureSettings` 는 참조 0.
- 생성 CSS `DateInput.css` 가 `font-variant-numeric: tabular-nums` 를 내보낸다 → Preview 는 고정폭 숫자, Canvas 는 비례폭 → 자릿수마다 폭 차이.
- **수정**: 세 키를 같은 feature 표로 흡수. 측정은 small-caps 와 같은 수법 — Canvas2D `ctx.fontVariantNumeric` 로 DOM 과 같은 폭 (메모리 `feedback-cjk-line-break-space-split-premise-three-layers` 의 small-caps 절). `scripts/generate-text-axis-matrix.mjs` 로 ADR-205 격차표 재생성 (`textAxisGate.static` 검사).

### 2-4. S4 합성 italic · bold (확인 필요)

- **Chromium** `platform/fonts/font_platform_data.cc` `CreateSkFont`:

  ```cpp
  font.setEmbolden(synthetic_bold_);
  font.setSkewX(synthetic_italic_ ? -SK_Scalar1 / 4 : 0);
  ```

  합성 조건은 `font_description.cc` (요청 weight ≥ 600 인데 bold face 없음 · italic 요청인데 italic face 없음).

- **composition** `nodeRendererText.ts` 는 `FontSlant.Italic` 을 TextStyle 로 넘길 뿐이다. Pretendard 는 italic face 가 없어 CanvasKit FontMgr 가 upright 를 돌려주면 그대로 upright. SkParagraph TextStyle 에는 skew 가 없다.
- **판정 방법**: Select placeholder (`font-style`) 또는 Styles 패널 `fontStyle: italic` 1 회 Compare Mode. 결함이면 italic 요청 + face 부재를 감지해 글리프 run 을 `canvas.skew(-0.25, 0)` 로 그리거나 paragraph 밖 `Font.setSkewX` 경로로 폴백.

### 2-5. S5 BoxBorderPainter 알고리즘 (격차)

- **Chromium** `core/paint/box_border_painter.cc` (BSD): 변 4 개를 `ComplexBorderInfo` 가 alpha → style 우선순위 → side 순으로 정렬하고 같은 alpha 끼리 `OpacityGroup` 으로 묶는다. `DrawDoubleBoxSide` 는 두께 `(t + 1) / 3` 로 바깥 · 안쪽 띠, `DrawRidgeOrGrooveBoxSide` 는 반분해 inset/outset 교대, `CalculateInsetOutsetColor` 는 상대 휘도로 어둡게 · 밝게 (`kBaseDarkColorLuminance 0.014443844` · `kBaseLightColorLuminance 0.83077` · `kMinimumBorderEdgeContrastRatio 1.75`). 모서리는 `ComputeMiter` 가 `kNoMiter / kSoftMiter (색 다름) / kHardMiter (double · groove · ridge · dash 불일치)` 를 고르고 hard miter 면 polygon clip. dashed · dotted 는 중심선 stroke 에 `path_length % 4 · % 6` 보정으로 양끝에 dash · dot 이 오게 하고 (`EnforceDotsAtEndpoints`), 굵은 dotted 는 zero-length dash + round cap. uniform solid 는 `FillDRRect` 한 번.
- **composition** `nodeRendererBorders.ts`: `strokeStyle: "solid" | "dashed" | "dotted"`. 변별 stroke (`renderSidedStroke`) 는 있으나 모서리 miter · 두 톤 style 이 없다. `cssDashPattern` 이 변 길이에 dash 를 맞추는지 확인 필요.
- **판정**: `COMPONENT_RULES_TABLE` 의 `borderStyle` 값 분포를 먼저 센다. 쓰이지 않는 style 은 옮기지 않는다. 변별 색이 다른 rule (Tabs indicator · Table 머리 경계) 이 있으면 모서리 1 px 대각선 차이가 난다 — G3 `approvedDifferences` 에 그런 항목이 있는지 보고 결정.

### 2-6. S6 상태 선택자 위주의 작은 격차

| 격차                                                           | 출처 (생성 CSS)                                                        | Canvas 상태                                        | 수정                                                                                                                                            |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `outline-style` 미소비                                         | `outline` 119 · `outline-offset` 108 (거의 `:focus-visible`)           | width · color · offset · radius 따라감, 항상 solid | `outline_painter.cc` 분기 (`auto` focus ring 2 px 이중 링 · 음수 offset) — 상태라 우선순위 낮음                                                 |
| CSS Transforms 2 개별 속성 `rotate:` · `scale:` · `translate:` | Disclosure chevron · `[data-pressed] scale: 0.97` · ListBox check 위치 | `parseTransform` 은 `transform` 함수만 파싱        | `convertToTransform` 이 세 속성을 합성 (순서: translate → rotate → scale → transform)                                                           |
| `text-decoration-thickness` · `text-underline-offset`          | Link `[data-hovered]` 1.5px                                            | `decorationThickness: 1` (폰트 값 배수)            | `text_decoration_info.cc` — `auto` → 폰트 `underlineThickness` (없으면 `font-size / 10`), 위치 `underlinePosition` + offset. 배수로 환산해 넘김 |

### 2-7. 이미 Chromium 과 같은 방식 (수정 불요)

- inset shadow: Blink inner path clip + hole EvenOdd + bounds 3σ ↔ composition `renderInnerBoxShadows` EvenOdd donut + `MakeBlur` + 상자 clip. sigma 만 S1.
- spread · corner radius: `renderBoxShadows` 의 `max(0, r + spread)` = Blink `ApplySpreadToShadowShape`.
- 줄바꿈: Blink 는 ICU UAX #14, composition 은 Canvas2D `measureWithCanvas2D` (Intl.Segmenter · CJK · 금칙 · keep-all · small-caps 합성) 로 **브라우저 자신을 oracle 로** 쓴다 — Blink 재구현보다 정확하다.

---

## 3. 최적화 — 측정된 꼬리와 대조

production 꼬리 (ADR-263 ~ 265 종결 기록, 2026-10-16):

| 시나리오       | p99 (ms) | 원인 (카운트로 확정)                                                                                   |
| -------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| 중첩 5k 편집   | 24 ~ 26  | Canvas binding 의 옮김 상수 비용 — 옮겨진 상자마다 `subtreeTranslate` · overflow clip 복제 · rect diff |
| 평평 5k 줌     | 27 ~ 28  | 줌이 page grid 자동 열 수를 바꿔 `syncAutoColumns` → `scene.refresh()` 전체 재바인드                   |
| 평평 5k select | ~29      | React · RAC Layers 행 렌더 (Canvas 밖)                                                                 |

기준선 원본: `.agent/runs/2026-10-15-canvas-rust-baseline/` · ADR-263 ~ 265 breakdown · [CANVAS_RUST_DECISION_2026-10.md](CANVAS_RUST_DECISION_2026-10.md). 새로 재지 않고 인용한다.

### 3-1. S7 Property node 분리 (유일하게 꼬리에 닿는 구조)

- **Chromium 의 통찰** (`how_cc_works.md` §property trees · Blink `PaintChunk`): 그리기 목록은 **로컬 좌표** 로 한 번 기록하고 transform · clip · scroll · effect 는 **별도 노드 트리** 에 둔다. chunk 는 노드 id 만 가리킨다. 스크롤 · 이동 · clip 변경은 노드 값 갱신이고 목록은 손대지 않는다. 비용이 "바뀐 노드 수" 에 비례한다.
- **composition**: `ELEMENT_BEGIN` 에 절대 좌표가 구워지고 (`retainedParagraph.ts` 주석 — "좌표가 ELEMENT_BEGIN 에서 이미 translate 됐기 때문"), 옮김은 `subtreeTranslate` 가 서브트리 명령을 다시 쓰고, clip · scroll 문맥이 바뀌면 patch 를 거부 (`clip-context-changed` · `scroll-context-changed`). node picture 캐시는 이미 **노드-로컬 기록 + replay 시 translate** 라 절반은 와 있다.
- **설계 스케치** (ADR 대상): `ELEMENT_BEGIN` 이 `(x, y)` 대신 `transformNodeId` 를 들고 실행기가 노드 테이블에서 `(x, y, scroll offset, clip rect)` 를 읽는다. 레이아웃 이동 = 노드 테이블 갱신 + damage = 이전 ∪ 이후 bounds, 명령 재기록 0. overflow clip 도 `clipNodeId` — 스크롤 = offset 갱신 (ADR-263 #4 `catalogScrollRange` DFS 도 사라진다). patch 거부 사유 중 앞 둘은 노드 갱신으로 흡수.
- **Phase 0 카운트** (measurement-validity §5): `subtreeTranslate` 호출 수 · patch 교체 명령 수를 결정적 카운트로 잡고 중첩 5k 편집에서 RED 고정. wall-clock 은 방향만.
- **위험**: 기술 MEDIUM (실행기 · patcher · damage 가 같은 노드 테이블을 읽어야 한다 — 불일치면 stale pixel) / 유지보수 MEDIUM / 마이그레이션 MEDIUM. ADR-263 대안 B · C · D 와 다른 축이라 그 기각 사유가 적용되지 않는다.
- **순서**: Codex P13-A 와 같은 제안이고, Codex 의 "측정 뒤" 순서가 맞다 — 단 ADR-264/265 종결 카운트가 이미 그 측정이다.

### 3-2. S8 under-invalidation checking (작은 비용)

Blink 는 dev 빌드에서 "캐시 없이 다시 그린 결과" 와 "캐시 결과" 를 비교해 무효화 누락을 즉시 잡는다 (`paint_under_invalidation_checker.cc` · `raster_invalidator.cc` · `geometry_mapper`). composition 은 같은 oracle 을 live 스크립트 (`adr263-render-path-live.mjs`) 로만 돌린다. `__composition_RENDER_PATH_DEBUG__` 에 `checkUnderInvalidation` 을 더해 damage 프레임마다 standby surface 에 full 을 그리고 damage rect 안 픽셀을 비교 → 불일치면 `console.error` + 카운터. perf 하니스 `--check-invalidation` 으로 ratchet A 에 0 등록. S7 의 안전망.

Codex P10 의 "실제 paint bounds (그림자 · filter · overflow 자식) 를 계산해 damage 에 쓴다" 는 지금의 "unsafe → full 수렴" (ADR-263 HC4) 보다 한 단계 나아간 제안이다 — ADR-263 재개 조건처럼 측정이 먼저.

### 3-3. 보류 · 해당 없음

- **타일 래스터**: ADR-263 재개 조건 ("A 뒤에도 flush · 래스터가 상위") 미성립. content surface 가 이미 viewport 크기. 2026-07 줌 flush 56 % 는 `makeImageSnapshot` CoW 였고 ping-pong 으로 처리됐다.
- **S10 Worker + OffscreenCanvas**: select 꼬리가 React 라 Canvas 를 옮겨도 그 비용은 그대로. 얻는 것은 "패널이 느릴 때 Canvas 가 같이 끊기지 않음". 문서 동기화 · hit-test · 텍스트 편집 overlay 가 전부 경계를 넘는다. 트리거 = "Canvas 프레임 drop 의 원인이 Canvas 밖 main-thread 작업" 이 카운트로 확인될 때 별도 ADR.
- **PaintOpBuffer 바이트 버퍼**: `executeCommandRange` 가 프로필 상위에서 빠졌다 (ADR-263 G5). Rust trigger ("그리기 명령 > 8 ms/frame") 와 같은 조건으로만.
- **`cc::Scheduler` · LCD text · raster scale 휴리스틱 · viz · OOP raster**: 대응물 없음. macOS Chrome 은 grayscale AA 라 글자는 이미 같다.

---

## 4. HTML DOM · CSS2 · CSS3 화면 표시 기능 — 수요 ↔ 공급 전수 대조

수요측 = 생성 CSS `packages/shared/src/components/styles/generated/*.css` 속성 분포 (괄호는 선언 수) + Styles 패널 `panels/styles/sections/styleSectionProps.ts`. 공급측 = Canvas 변환기 · Skia 렌더러 · 엔진 `NodeStyle` · 모듈 헤더 미구현 선언.

### 4-1. 레이아웃 (CSS2 visual formatting · CSS3 box · flex · grid)

| 영역                          | 구현                                                                                                                                                                              | 격차 (Chrome 있음 · 엔진 없음)                                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| block (CSS 2.1 §8 · §9 · §10) | 세로 쌓임 · margin collapse (through-collapse · BFC 차단) · inline-block line box · `vertical-align` 4 종. leafBaseline · strut 는 **엔진 구현 · production 배선 끊김** (B1 · B2) | **float / clear** · **writing-mode** · BFC 내부 다단 · **순수 inline text run 혼합** (I1) · list-item marker (`li` 1 건 · list-style none 이라 무해) |
| flex (CSS-FLEXBOX-1)          | 단일 · 다중 라인 · grow/shrink · align-content · align-self · justify-self · order · aspect-ratio                                                                                 | `flex-basis: content` intrinsic 자동 측정 (content_main 폴백). 헤더의 "aspect-ratio · align-self 미구현" 은 stale (필드 존재). 세부는 §7             |
| grid (CSS-GRID-1)             | track sizing · repeat/minmax/areas/span · auto-flow · auto-columns/rows                                                                                                           | subgrid · dense 역채움 · baseline. 세부는 §8                                                                                                         |
| position · overflow           | static / relative / absolute · overflow x/y · 스크롤바 (`renderScrollbar`) · scroll offset. **sticky · fixed 는 `styleOf` 미전송 → in-flow static** (X8)                          | `overflow: clip` · `overflow-clip-margin` · `scrollbar-*` (생성 CSS 0 — 무해)                                                                        |
| 논리 속성                     | `cascade.rs` 가 `marginInlineEnd → marginRight` 등 물리로 변환 (LTR 고정)                                                                                                         | RTL 반전 없음. `border-start-start-radius` · `border-block` (ListBox 1 건) 은 변환 표에 없음 → 확인 필요                                             |
| 표 · 다단                     | —                                                                                                                                                                                 | **CSS table layout 없음** (T1) · multicol 없음                                                                                                       |
| 생성 content                  | —                                                                                                                                                                                 | `::before / ::after` 없음 — 생성 CSS 의 `content:` 30 건은 전부 `justify-content` 오탐. 실제 `content:` 2 건 → 확인 필요                             |

엔진 미구현 축 두 개 (Blink 코드가 아니라 테스트로 닫는다):

| ID  | 격차                                                                              | 사용자 가시 결과                                                      | 크기 | 닫는 수단                                                                        |
| --- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------- |
| I1  | 인라인 텍스트 run 혼합 없음 (`block.rs` slot 18 "S4 예약")                        | 한 문단 안에 굵기 · 색이 다른 span 이 있으면 줄바꿈이 Preview 와 다름 | 큼   | catalog 가 rich inline 을 실제로 내보내는지 먼저 센다 (`Text[slot]` 은 단일 run) |
| T1  | CSS table layout 없음 — RAC Table 은 `<table>` DOM, 엔진은 열 트랙 근사 (ADR-257) | 긴 셀 내용에서 auto 열 폭 분배가 다름                                 | 큼   | 재현 케이스가 나올 때 ADR-257 범위에서. WPT `css-tables` 를 oracle 로            |

### 4-2. 페인트 (CSS3 backgrounds · borders · effects · transforms · masking)

| 속성 (선언 수)                              | Canvas 상태                                                                                | 판정                                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `background` (592) · gradient · 다중 레이어 | color · image · linear/radial/conic/mesh · size/position/repeat · `nodeRendererFillLayers` | 구현. `background-clip / origin / attachment / blend-mode` 참조 0 — 생성 CSS 도 0 (무해)                                       |
| `border-*` (78 + 150 + 52 · radius 503)     | 변별 width/color · radius 4 모서리 · solid/dashed/dotted · 안쪽 radius (`borderGeometry`)  | **격차** S5                                                                                                                    |
| `box-shadow` (23)                           | 다중 · inset · spread · corner radius 규칙                                                 | **격차** S1                                                                                                                    |
| `outline` (119) · `outline-offset` (108)    | width · color · offset · radius (`nodeRendererBorders.ts:756`)                             | **격차** `outline-style` S6                                                                                                    |
| `opacity` (112) · `mix-blend-mode`          | saveLayer alpha · `toSkiaBlendMode`                                                        | 구현. `isolation` 참조 0 (생성 CSS 0)                                                                                          |
| `filter` · `backdrop-filter`                | blur · drop-shadow · color-matrix 계열 · backdrop blur                                     | drop-shadow sigma S1                                                                                                           |
| `transform` (3) · `transform-origin`        | 2D translate/rotate/scale/skew/matrix + origin                                             | **격차** 개별 속성 S6. 3D · perspective 없음 (생성 CSS 0)                                                                      |
| `clip-path` · `mask`                        | basic shape · path · `maskImage`                                                           | 구현. ListBox `mask: url(svg)` 는 iconPath 로 그릴 것 → 확인 필요. 반지름 키워드 산식은 `clip_path_clipper.cc` 와 fixture 1 회 |
| `aspect-ratio` (4) · `object-fit`           | 엔진 `aspect_ratio`                                                                        | `object-fit / object-position / image-rendering` 참조 0 → Image 축소 규칙 확인 필요 (+ S2)                                     |
| `visibility` · `z-index` · stacking context | `visible` · `zIndex` · `isStackingContext`                                                 | 구현. 생성 조건 표를 `computed_style.cc` `IsStackingContext` 와 1:1 대조 권장                                                  |
| `border-image`                              | —                                                                                          | 없음 (생성 CSS 0 — 무해)                                                                                                       |

### 4-3. 텍스트 (CSS Text · Fonts · Text Decoration)

| 속성                                                                                          | Canvas 상태                                                               | 판정                                                    |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------- |
| font-family / size / weight / stretch · variable axes                                         | `fontStyle: {weight, slant, width}` + `fontVariations(wght)` push         | 구현                                                    |
| `font-style: italic`                                                                          | `FontSlant.Italic` 전달                                                   | **확인 필요** S4                                        |
| line-height · letter/word-spacing · text-align (+justify)                                     | `heightMultiplier + halfLeading` · strut · alignOffset                    | 구현 (텍스트 노드 안). 컨테이너 line box 의 strut 는 B1 |
| `text-decoration` (5) line · style · color                                                    | underline/overline/line-through · solid/double/dotted/dashed/wavy · color | thickness · underline-offset S6                         |
| `text-transform` · `text-indent` · `white-space` · `word-break` · `overflow-wrap` · `hyphens` | `applyTextTransform` · Canvas2D 측정 파이프라인                           | 구현                                                    |
| `text-overflow: ellipsis`                                                                     | `maxLines: 1 + ellipsis`                                                  | 1 줄만. `-webkit-line-clamp` 없음 (생성 CSS 0 — 무해)   |
| `font-variant-numeric` (DateInput 1)                                                          | 참조 0                                                                    | **격차** S3                                             |
| `text-shadow`                                                                                 | `TextShadow[]` + blur                                                     | sigma S1                                                |
| `-webkit-text-fill-color` (1) · `caret-color` · `::placeholder` · `::selection`               | caret · selection 은 편집 overlay 영역                                    | text-fill-color 는 출처 파일 0 → 무해                   |
| writing-mode · text-orientation · `tab-size` · `text-align-last`                              | —                                                                         | 없음 (생성 CSS 0 — 무해)                                |

### 4-4. HTML 요소 · 상태

- catalog 태그 17 종 (`div` 80 · `span` 5 · `section` 4 · `button` 4 · `p` 3 · `output` 3 · `nav` 3 · `kbd` 2 · `li` · `label` · `input` · `hr` · `header` · `form` · `code` · `body` · `a`) + `img` (Image) + svg 아이콘 (`iconPath`). RAC 가 unstyled 라 **native form appearance** (checkbox · radio · select · range · date · color) 재현이 필요 없다.
- 해당 없음 (catalog 에 없음): `video` · `iframe` · `canvas` · `embed` · `ul/ol` marker · `details/summary` native marker · `dialog` backdrop.
- **상태**: `CatalogStates.css` (hover · pressed · focus-visible · disabled · selected · placeholder) 중 Canvas 는 정적 기본 상태 + 문서가 든 상태 (selected · disabled · isPending 등) 만 그린다. `:focus-visible outline` 119 · `transition` 35 · `animation` (ProgressBar indeterminate) 은 상호작용 결과라 정적 대칭 범위 밖 — Preview 로 확인.
- 비시각 속성 (`cursor` 113 · `pointer-events` 103 · `user-select` · `touch-action` · `will-change` · `contain` · `forced-color-adjust` 109) 은 Canvas 소비 대상이 아니다 (ADR-223 "Canvas 저작 surface 에 대응 없는 DOM interaction").

---

## 5. Blink 코드를 정답지로 쓰는 포팅 지도

Preview 는 Chrome 에서 돈다. 따라서 Canvas 의 목표 픽셀은 명세가 아니라 **Blink 가 그리는 것** 이고, Blink 도 `cc::PaintCanvas` 로 Skia op 를 내보내므로 paint 알고리즘은 CanvasKit 호출로 거의 1:1 로 옮겨진다. 레이아웃은 그렇지 않다 (§5-3).

### 5-1. 격차 → Blink 파일 → CanvasKit 대응

| 격차                      | Blink 정답지 (`third_party/blink/renderer/`)                                                                                                                                              | 옮길 것                                                                                                                                                                                                             | CanvasKit 대응 · 주의                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| S1 그림자 sigma           | `core/style/shadow_data.h` · `core/paint/box_painter_base.cc`                                                                                                                             | `radius × 0.5` · outer 는 상자 clip-out 뒤 spread RRect fill · inset 은 inner clip + hole EvenOdd + bounds `3σ`                                                                                                     | Blink `DrawLooperBuilder` 는 CanvasKit 에 없음 → `ImageFilter.MakeDropShadowOnly` 또는 `MaskFilter.MakeBlur(Normal, σ)`. 구조는 이미 같음 (§2-7) |
| S5 border style · 모서리  | `core/paint/box_border_painter.cc` (BSD)                                                                                                                                                  | `ComplexBorderInfo` 정렬 · `DrawDoubleBoxSide (t+1)/3` · `DrawRidgeOrGrooveBoxSide` · `CalculateInsetOutsetColor` 상수 3 · `ComputeMiter` · dash `% 4 · % 6` 보정 · `EnforceDotsAtEndpoints` · uniform `FillDRRect` | `drawDRRect` 있음. miter clip 은 `clipPath(polygon)`. dash 는 `PathEffect.MakeDash` + 보정 간격                                                  |
| S6 outline-style          | `core/paint/outline_painter.cc`                                                                                                                                                           | style 분기 · `auto` focus ring · 음수 offset                                                                                                                                                                        | 지금 `drawRRect` 하나 → 분기 추가                                                                                                                |
| S6 decoration 두께 · 위치 | `core/paint/text_decoration_info.cc` · `decoration_line_painter.cc`                                                                                                                       | `auto` → `underlineThickness` (없으면 `font-size / 10`) · `from-font` · `underlinePosition` + offset · wavy `ComputeWavyPattern`                                                                                    | SkParagraph `decorationThickness` 는 배수 → 환산. wavy 를 같게 하려면 직접 path                                                                  |
| S4 합성 italic · bold     | `platform/fonts/font_platform_data.cc` `CreateSkFont` (LGPL) · `font_description.cc`                                                                                                      | `setSkewX(-0.25)` · `setEmbolden(true)` · 합성 조건                                                                                                                                                                 | SkParagraph TextStyle 에 skew 없음 → run 을 `canvas.skew` 로 그리거나 paragraph 밖 `Font.setSkewX` 폴백                                          |
| S2 이미지 · object-fit    | `platform/graphics/graphics_context.cc` (`ComputeInterpolationQuality`) · `cc/paint/paint_flags.cc` · `core/paint/image_painter.cc` · `core/layout/layout_replaced.cc` `ComputeObjectFit` | 샘플링 판정 표 (§2-2) · object-fit 5 종 · object-position 산식 · `pixelated` → nearest                                                                                                                              | `drawImageRectOptions(Linear, Linear)` (Medium) · `(Linear, None)` (Low) · `(Nearest, None)` · `makeCopyWithDefaultMipmaps`. cubic 금지          |
| background 기하           | `core/paint/background_image_geometry.cc` · `box_background_paint_context.cc`                                                                                                             | `background-size` contain/cover · position 퍼센트 · `repeat: space / round` · clip/origin 상자                                                                                                                      | space · round · clip/origin 만 없음 — 생성 CSS 0 이라 보류                                                                                       |
| clip-path                 | `core/paint/clip_path_clipper.cc` · `core/style/basic_shapes.cc`                                                                                                                          | `inset(round)` · `circle / ellipse` 의 `closest-side / farthest-side` · polygon fill-rule · `path()` · reference box                                                                                                | `parseClipPath` 와 fixture 1 회 대조                                                                                                             |
| 그림 순서                 | `core/paint/paint_layer_paint_order_iterator.cc` · `paint_phase.h` · `core/style/computed_style.cc` `IsStackingContext`                                                                   | CSS 2.1 Appendix E 순서 · stacking context 생성 조건 (`position: relative` + z-index · `opacity < 1` · `transform` · `filter` · `isolation` …)                                                                      | `isStackingContext` 판정 표와 1:1 대조                                                                                                           |

### 5-2. 포팅 규약 (D2 `d2Provenance.ts` 와 같은 꼴)

1. **코드가 아니라 알고리즘 · 상수를 옮긴다.** `core/paint/*` 는 BSD-3 라 인용 가능하지만 `platform/fonts/*` · `core/style/shadow_data.h` 는 **LGPL** — 본문 복사 금지, 상수 (`-0.25` · `(t+1)/3` · luminance 3 개) 와 분기 구조만 재구현. Chromium 저장소 전체를 단일 라이선스로 보지 않는다 (Codex §14 와 같음).
2. **출처 표** `apps/builder/src/builder/workspace/canvas/skia/blinkProvenance.ts` 에 `{ feature, blinkPath, revision, portedAt, divergence }`. revision 은 Chromium commit hash 로 고정 — Blink 는 바뀐다 (2026 에 `border_shape_painter.cc` · `gap_decorations_painter.cc` 신설). 사용자 Chrome 버전 (`navigator.userAgentData`) 의 release branch 를 쓴다. Codex ledger 11 필드 (§18-1) 가 이 표의 상위 형식이다.
3. **판정은 Chrome 픽셀** — 통과 기준은 Blink 코드가 아니라 G3 하니스 (Canvas ↔ Preview 스크린샷). 코드를 옮기는 것은 맞출 확률을 올리는 수단이고 증명은 픽셀이다.
4. **한 격차 = 한 커밋 = cross-check 1 회.** catalog 가 내보내지 않는 Blink 분기 (`border-shape` · gap decorations) 는 옮기지 않는다 — D3 대칭은 쓰이는 값의 동일성이다.

### 5-3. 옮기지 못하는 것 — 레이아웃은 코드가 아니라 테스트를 가져온다

- **LayoutNG** (`core/layout/`) 는 `LayoutObject` · `ComputedStyle` · `ConstraintSpace` · `NGFragment` 에 묶여 함수 단위 포팅이 안 된다. inline formatting (I1 — `inline/inline_layout_algorithm.cc` · `line_breaker.cc`) 과 table (T1 — `table/table_layout_algorithm.cc`) 은 수천 줄 + HarfBuzz · ICU.
- 대신 **Chromium 이 가진 테스트를 Rust 엔진의 oracle 로 쓴다**: `third_party/blink/web_tests/external/wpt/css/CSS2/` · `css-flexbox/` · `css-grid/` · `css-inline/` · `css-tables/` reftest 를 ADR-156 차등 oracle (실 Chrome `getBoundingClientRect`) 의 fixture 로. 엔진 헤더의 "미구현 — dual-run FAIL 이 fixture" 가 이미 이 모양이다. 번역한 fixture 통과를 원본 WPT 통과라 부르지 않는다 (Codex §17-1).
- 줄바꿈 · `font-variant-numeric` 폭은 지금처럼 **Chrome 자신을 런타임 oracle** 로 (Canvas2D `measureWithCanvas2D` · `ctx.fontVariantNumeric`) — `line_breaker.cc` 를 옮기는 것보다 정확하고 싸다.

---

# Part B. 레이아웃 (Blink LayoutNG 함수 단위 대조)

> **방법**: 영역별 4개 병렬 감사 (block · flex · grid · 박스 모델) 가 Blink `main` 소스를 받아 composition 소스 (Rust `packages/engine/src/{block,flex,grid,tree,display,style,cascade}.rs` + TS 직렬화 `packages/shared/src/catalog/runtime/compositionRoot.ts` `styleOf`) 와 줄 단위로 대조했고, production 재현 가능 항목은 메인 세션이 composition 쪽 file:line 을 직접 다시 열어 확인했다. Blink 파일 경로는 `third_party/blink/renderer/` 기준.
> **판정 기준**: "격차" 는 양쪽 코드가 다른 결과를 내는 것. 엔진 모듈 헤더가 **미구현** 이라 선언한 것 (float · writing-mode · subgrid 등) 은 격차로 세지 않고 §11 에 모았다. 생성 CSS · Styles 패널이 그 입력을 만들 수 없으면 "재현 불가" 로 적었다.

**수동 구현의 큰 틀 (margin collapse · BFC · shrink-to-fit · min/max clamp 순서 · flex 동결 기계 · grid fr 가상 크기 루프 · auto-repeat · absolute inset 해소) 은 Blink 와 같다.** 격차는 두 종류다.

1. **회귀 — 엔진은 받는데 production 이 보내지 않는 입력.** `78469745d` (2026-10-05 옛 TS 파이프라인 삭제) 가 `leafBaseline` · `strutBaseline` · `lineHeight` 공급자 (`f1ec24e53` · `3a1b3200d`) 를 같이 지웠고 catalog 경로 `styleOf` 에 다시 연결되지 않았다. `position: sticky` · `fixed` 도 `styleOf` 가 떨어뜨려 in-flow static 이 된다. 알고리즘이 아니라 **배선 문제** 라 가장 먼저 닫는다.
2. **알고리즘 격차 — Blink 가 명세의 한 절을 구현했고 composition 이 근사한 자리.** production 에서 흔한 입력으로 드러나는 것 12 건, 드문 입력 24 건.

### 우선순위 (production 재현 가능 · 흔한 순 — 닫는 순서는 §0-2 에 합침)

| 순위 | 영역  | 격차                                                                                                                         | 사용자 가시 결과                                                                                                        | 닫는 수단                                                                         |
| ---- | ----- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1    | block | **B1 · B2** `leafBaseline · strutBaseline · lineHeight` 미전송 → 모든 atomic inline 이 바닥 정렬 · strut 0                   | block frame 안 크기 다른 Button 둘이 글자선이 아니라 바닥에 맞고, 작은 inline 하나면 frame 높이가 line-height 보다 낮다 | `styleOf` 가 세 키를 내보냄 (옛 `f1ec24e53` 의 계산을 catalog 경로로)             |
| 2    | box   | **X8** `position: sticky` 엔진 미전송 + Canvas 보정 (`isSticky · stickyTop`) 생산자 없음                                     | catalog rule 2건 (`componentRulesTable.ts:5599 · 6903`) 과 Styles `sticky` 가 Canvas 에서 흘러간다                      | `styleOf` 전송 + 엔진 sticky (Blink `ComputeStickyPositionConstraints` 계약)      |
| 3    | grid  | **G1 · G2** 최소 기여 — 명시 `min-width: 0` 은 올리기만, scroll container 판정 없음                                          | `1fr 1fr` 열 안 긴 텍스트 + `min-width:0` / `overflow:hidden` 이 트랙을 못 줄여 넘친다                                  | `track_contribution` 에 Blink `CalculateIntrinsicMinimumContribution` 규칙        |
| 4    | flex  | **F4** row definite 컨테이너 item 의 §4.5 content size suggestion 생략 (ADR-204 perf 이연)                                   | 좁은 row 에서 자식 보유 고정 폭 Button/Frame 이 min-content 아래로 줄어든다                                             | 2-b 에서 min-content 측정 복원 (perf 는 ADR-246 카운트로 재판정)                  |
| 5    | grid  | **G3 · G4** span 아이템 — fr 트랙을 지나면 기여 폐기 · 고정 트랙에도 균등 분배                                               | `span 2` 아이템이 넘치거나 (fr) 고정 px 열이 커진다                                                                     | §12.5 step 3 (flex factor 비례) + `IsContributionAppliedToSet` (intrinsic 트랙만) |
| 6    | grid  | **G7 · G8** 명시 placement 커서 — step 1/2 순서 · 행별 minor 커서 · "col < cursor → 다음 행"                                 | 행만 고정한 아이템이 겹치거나 엉뚱한 열에 놓인다                                                                        | `grid_placement.cc` 의 3 단계 + `AutoPlacementCursor`                             |
| 7    | box   | **X3 · X4** absolute static position — flex/grid 부모의 justify/align 무시 · 선행 형제 margin-bottom 미포함                  | inset 없는 absolute 자식이 flex center 부모에서 (0, 0) 근처에 놓인다                                                    | `HandleOutOfFlowPositionedItems` (sole item 규칙) · margin strut 가산             |
| 8    | box   | **X9** `em` = 항상 16 · `ch · ex` = fontSize × 0.5 근사                                                                      | `fontSize 24` 노드 `width: 2em` → 32 (Chrome 48)                                                                        | `ctx_for` 에 자기 computed font-size 전달 · `ch` 는 "0" advance 측정              |
| 9    | box   | **X1 · X2** `position: relative` `%` inset 기준 — 가로는 부모 available, 세로는 auto 높이도 definite                         | padding 큰 부모 안 `left: 50%` 가 크게 틀린다                                                                           | `relative_utils.cc` `ComputeRelativeOffset` 계약                                  |
| 10   | block | **B4** `vertical-align: middle` x-height 보정 없음 · **X10** `sub · super · text-top · text-bottom · <length>` 전부 baseline | middle 이 ~4 px 낮다                                                                                                    | `inline_box_state.cc` `ApplyBaselineShift` (x-height/2 · 폰트 metrics)            |
| 11   | grid  | **G16** aspect-ratio 아이템 + implicit stretch 가 양축 stretch                                                               | `aspect-ratio: 2` 아이템이 셀을 다 채운다 (Chrome 은 ratio 유지)                                                        | `ComputeBlockSizeForFragmentInternal` 순서 (explicit stretch → ratio → implicit)  |
| 12   | box   | **X6 · X7** aspect-ratio 자동 최소 높이가 leaf 에 미적용 · min/max 전송 없음                                                 | 3 줄 Text 에 `aspect-ratio: 4` 면 글자가 잘린다 · `max-height` 가 폭으로 안 넘어간다                                    | `length_utils.cc` §5.2.1 · §5.2.2                                                 |

나머지 (드문 입력 24 건) 은 §6 ~ §9 표의 "재현" 열이 "드묾 · 낮음" 인 행이다 — 입력을 만들 수 있는 날 WPT fixture 로 한 번에 닫는다.

---

## 6. Block · inline-block · margin collapse · baseline (Blink `core/layout/block_layout_algorithm.cc` · `geometry/margin_strut` · `inline/inline_box_state.cc` · `inline/line_breaker.cc` · `logical_box_fragment.cc`)

### 6-1. 격차

| #   | 축                                | composition                                                                                                                                                                                                    | Blink                                                                                                                                                                                                            | fixture                                                                                                      | 재현    |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------- |
| B1  | strut (컨테이너 line-height 하한) | `block.rs:440-455` `strut_line_height >= 0` 일 때만 참여. production 은 `styleOf` 가 `lineHeight` 를 엔진 키로 안 내보내 (`compositionRoot.ts` — 텍스트 binding `:743` 에만) `tree.rs:4053` → -1 → **strut 0** | `inline_box_state.cc:346-353 OnBeginPlaceItems` 모든 line box 에 strut (`ComputeTextMetrics` + `CalculateLeadingSpace`, ascent 쪽 leading `Floor()` `line_utils.cc:35-44`)                                       | `display:block; line-height:24px` 안 `inline-block` 12px → Chrome 24 / 엔진 12                               | **yes** |
| B2  | atomic inline 의 baseline         | `tree.rs:2248-2255` `leaf_baseline` 입력에서만; 생산 지점은 `layoutTypes.ts:197` 타입 선언뿐 (`78469745d` 가 `f1ec24e53` · `3a1b3200d` 공급 삭제) → `block.rs:269` bottom margin edge 폴백                     | `line_breaker.cc:3130-3133` atomic inline `kInlineBlock` baseline · `block_layout_algorithm.cc:3802-3860` 마지막 line box / block 자식 baseline 전파 · `logical_box_fragment.cc:59-63` 없을 때만 margin box 바닥 | block frame 안 size S Button (h24 · baseline ≈17) + size L (h40 · ≈27) → Chrome 글자선 정렬 / 엔진 바닥 정렬 | **yes** |
| B3  | `line-height: normal` 값          | Canvas2D 폴백 `textMeasure.ts:438-452` `fontBoundingBoxAscent + Descent` (lineGap 없음 · 반올림 없음) · CanvasKit 경로 `paragraph.height`                                                                      | `computed_style.cc:2417-2421` → `FontMetrics::LineSpacing()` = `lroundf(ascent) + lroundf(descent) + lroundf(line_gap)` (`simple_font_data.cc:176-178`)                                                          | 자기 · 조상 모두 lineHeight 없는 Text                                                                        | unknown |
| B4  | `vertical-align: middle`          | `block.rs:463-468 · 497-501` margin box 중심을 baseline 에 (x-height 0)                                                                                                                                        | `inline_box_state.cc:1339-1346` `(ascent − descent)/2 − xHeight/2`                                                                                                                                               | 16px 폰트 부모 안 `inline-block; height:40px; vertical-align:middle` → Chrome ≈4px 위                        | **yes** |
| B5  | line box `text-align`             | `block.rs:191 · 288-303` 왼쪽 고정, `NodeStyle` 에 `text_align` 없음                                                                                                                                           | `inline_layout_algorithm.cc:373 · 937-963` `ApplyTextAlign`                                                                                                                                                      | block frame `textAlign:center` + inline-flex Button                                                          | unknown |
| B6  | `white-space: nowrap` 줄바꿈 억제 | `block.rs:272` 무조건 wrap; `whiteSpace` 는 경계에서 버림 (`tree.rs:397`)                                                                                                                                      | `line_breaker.cc:1183-1188` `if (!auto_wrap_) return false`                                                                                                                                                      | width 100 nowrap frame 에 50px inline-flex 셋                                                                | unknown |
| B7  | first vs last baseline            | `NodeLayout.baseline` 하나 = last (`tree.rs:4110-4168`), flex `align-items: baseline` 도 이 값 (`:6366`)                                                                                                       | `block_layout_algorithm.cc:3808-3810` `SetFirstBaseline` + `SetLastBaseline` 분리                                                                                                                                | flex row baseline 안 2줄 Text block                                                                          | unknown |
| B8  | scroll container baseline clamp   | `tree.rs:4143-4155` 자식 baseline 그대로 전파                                                                                                                                                                  | `logical_box_fragment.h:49-52 · 66-69` `IsScrollContainer` 면 `clamp(0, BlockSize)`                                                                                                                              | `overflow:hidden; height:10px` 안 24px 줄                                                                    | unknown |

### 6-2. 같음 확인

margin collapse 집합 (`margin_strut.cc:22-33` ↔ `block.rs:524-557`) · 부모-자식 top collapse 차단 (block-start border/padding · 새 FC — `block_layout_algorithm.cc:905-915` ↔ `tree.rs:3963`) · bottom 차단 (padding · 새 FC · definite block-size · min/max 바인딩 — `:1316-1377 · 1471-1483` ↔ `tree.rs:3981-3982 · 4185-4194`) · self-collapsing 판정 · 위치 (`:1497-1506 · 3134-3150` ↔ `tree.rs:4252-4258` · `block.rs:329`) · BFC 자식의 margin 은 형제 · 부모와 collapse (`:1895-1902 · 2953-3006` ↔ `block.rs:359-381`) · line box 가 margin 을 끝냄 (`inline_layout_algorithm.cc:1504-1509` ↔ `block.rs:280-286`) · atomic inline 은 margin box 로 참여 · scroll container inline-block → block-end margin edge, clip 제외 (`:3851-3857` + `physical_box_fragment.h:170-174` ↔ `tree.rs:3999-4003 · 6281-6284`) · vertical-align top/bottom (`inline_box_state.cc:1448-1458` ↔ `block.rs:461-476`) · inline-block auto 폭 = shrink-to-fit (`tree.rs:1795-1803`) · 인접 atomic inline 사이 break 기회 · quirks 무관 (`<!doctype html>`).

---

## 7. Flex (Blink `core/layout/flex/flex_layout_algorithm.cc` · `line_flexer.cc` · `flex_line_breaker.cc` · `length_utils.cc`)

> Blink 의 옛 `flexible_box_algorithm.cc` · `flex_item.cc` · `flex_line.cc` 는 삭제됐다 (404). §4.5 는 `FlexLayoutAlgorithm::ConstructAndAppendFlexItems` 안에 inline 돼 있고 §9.7 은 `line_flexer.cc`, §9.3 은 `flex_line_breaker.cc`.

### 7-1. 격차

| #   | 축                                           | composition                                                                                                                                                                                                 | Blink                                                                                                                                                                            | fixture                                                                                                   | 재현                                                    |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| F1  | §9.7 flex factor 합 < 1                      | `flex.rs:758-762` **매 라운드 remaining** × grow_sum, 크기 비교 없음 (shrink `:776-780` 동형)                                                                                                               | `line_flexer.cc:99-104` `fractional = initial_free_space × total_flex_factor; if (abs(fractional) < abs(free_space)) free_space = fractional` — **initial free space** · 작은 쪽 | width 100 > A `flex:.3 1 0; max-width:10px` · B `flex:.3 1 0` → Blink B 30 / 엔진 27                      | 가능 (Styles `flexGrow` 소수) · 드묾                    |
| F2  | §8.1 main auto margin + 음수 여유            | `flex.rs:1153-1155` auto margin 하나라도 있으면 부호 무관 justify 무효                                                                                                                                      | `flex_layout_algorithm.cc:1877-1888` `main_axis_auto_margin_count && free_space > 0` 일 때만; 음수면 justify center/end 동작                                                     | width 100 `justify-content:center` > `width:300px; margin-left:auto` → Blink x −100 / 엔진 0              | 가능                                                    |
| F3  | `align-content: space-evenly`                | `tree.rs:5610-5623` arm 없음 → 0 = stretch (`flex.rs:205-216` 상수 없음)                                                                                                                                    | `:1717-1736` `kSpaceEvenly: free / (n + 1)`                                                                                                                                      | wrap · height 200 · space-evenly · 2줄 × 50 → Blink y 33.3 / 116.7 · 엔진 줄 높이 100                     | 가능 (`layout.alignContent` 텍스트)                     |
| F4  | §4.5 row definite item 의 content suggestion | `flex.rs:376-394` definite 주축 item 은 스칼라 (off 19) 가 있을 때만 floor; `tree.rs:3148-3151` 2-b 가 `data[off+1] != -1` 이면 min-content 측정 생략 (ADR-204 perf 이연 주석) → 자식 보유 item 자동 최소 0 | `:1027-1109` 모든 non-scroll item 에 `specified_size_suggestion` · `content_size_suggestion` 둘 다 구해 `min`                                                                    | width 200 > `div{width:200px}` ×2 각 min-content 150 → Blink 150/150 (넘침) / 엔진 100/100                | **가능** — 고정 폭 Button/Frame 이 좁은 row 에서 shrink |
| F5  | §4.5 column definite item 범위               | `tree.rs:3225-3241` 자식 border-box 아래만 (bottom margin 제외, 주석 "보수적")                                                                                                                              | `:936-947` `IntrinsicBlockSize()` = BFC root content 높이 (마지막 자식 bottom margin 포함)                                                                                       | column height 100 > item `height:80` ⊃ `height:60; margin-bottom:30` · item 80 → Blink 80/20 · 엔진 60/40 | 가능 · 드묾                                             |
| F6  | `row-gap` `%` 기준 축                        | `tree.rs:2901-2902` 둘 다 content **폭**                                                                                                                                                                    | `:156-160 · 186-190` row-gap 은 **block** 크기                                                                                                                                   | wrap 400×200 `row-gap:10%` → Blink 20 / 엔진 40                                                           | 어려움 (`visual.gap` 은 px)                             |
| F7  | `flex-basis` intrinsic 키워드                | `tree.rs:7197-7200` `fit-content` → CONTENT(max-content), `min-content`/`max-content` → auto                                                                                                                | `:1009-1016` → `length_utils.cc:113-117` `kMinContent` = min · `kFitContent` = clamp                                                                                             | `flex-basis:min-content; flex-shrink:0` "aaa bbb" → Blink 30 / 엔진 60                                    | 가능 · 드묾                                             |
| F8  | `justify-content: start/end/right` + reverse | `tree.rs:5502-5513` start = flex-start 로 접은 뒤 reverse 를 기하 반사                                                                                                                                      | `:1693-1704` `kStart` 는 reverse 무시 · `:228-236` column 의 `left/right` → start                                                                                                | `row-reverse; justify-content:start` → Blink x 0 / 엔진 200                                               | 가능 · 드묾                                             |
| F9  | `last baseline`                              | `tree.rs:5528 · 5559` first 그룹으로 접음, 슬롯 21 은 first baseline 뿐                                                                                                                                     | `:376-399` `LastBaselineOrSynthesize` · `BlockSize − baseline` · `:1997-2006` minor 그룹 cross-end                                                                               | `align-items:last baseline` 2줄 + 1줄                                                                     | 가능 · 드묾                                             |
| F10 | `%` min-size + indefinite base               | `tree.rs:5236-5243` −1 센티넬 × % → 음수 → `None` → AUTO → §4.5 켜짐                                                                                                                                        | `length_utils.cc:200-213` `kMin` 이면 base 0 → min 0 · `HasAuto()` false 라 자동 최소 없음                                                                                       | column `max-height:100px` > item ×2 content 80 `min-height:10%` → Blink 50/50 / 엔진 80/80                | 가능 · 드묾                                             |
| F11 | 반올림                                       | f32 · `RESOLVE_EPS 0.5` (`tree.rs:3323 · 3570 · 3639`)                                                                                                                                                      | `LayoutUnit` 1/64 px · `LayoutUnitDiffuser` 나머지 흩뿌림                                                                                                                        | `flex:1` ×3 in 100 → Blink 33.328/33.344/33.328 · 엔진 33.333 ×3                                          | 서브픽셀만                                              |

### 7-2. 같음 확인

flex-basis 해소 순서 (명시 → width → aspect 전송 → content · `%` + indefinite → content) · §4.5 scroll container → 0 (`:423-452` ↔ `flex.rs:371-375` + `tree.rs:6273-6283`) · max-main clamp (`length_utils.cc:779-782` ↔ `flex.rs:403`) · §9.7 동결 기계 전부 (방향 · inflexible · shrink 가중 · violation · min 이 max 를 이김) · §9.3 라인 수집 (`flex_line_breaker.cc:276-285 · 413-415` ↔ `flex.rs:853-862`) · align-content (nowrap 무효 · stretch 는 여유 ≥ 0 · space-* 음수 폴백) · stretch 조건 (cross auto · 미해소 `%` 는 stretch 아님 csswg #4312 · 단일 라인 definite cross) · cross 축 auto margin · main 축 auto margin (양의 여유) · `%` main + indefinite · baseline 그룹 (first) · safe 접두 · 음수 grow/shrink → 0.

---

## 8. Grid (Blink `core/layout/grid/grid_track_sizing_algorithm.cc` · `grid_layout_algorithm.cc` · `grid_placement.cc` · `grid_line_resolver.cc` · `grid_track_collection.cc` · `grid_layout_utils.cc`)

### 8-1. 격차

| #   | 축                                             | composition                                                                                                        | Blink                                                                                                                                                                                                 | fixture                                                                                                          | 재현                                                         |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| G1  | 최소 기여 — 명시 `min-width: 0`                | `tree.rs:1356-1357` `w = w.max(mn)` 올리기만; `col_contribution` (`:1458-1461`) 은 min-content 를 base 로          | `grid_layout_utils.cc` `CalculateIntrinsicMinimumContribution`: `!min_length.HasAuto()` 면 **min-width 를 그대로 해소** (0 이면 0 + pad/border/margin)                                                | `width:200px; 1fr 1fr` · A `min-width:0` + 텍스트 min-content 150 · B 50 → Blink 100/100 / 엔진 150/50           | **yes** — 1fr 열 텍스트 말줄임 표준 패턴                     |
| G2  | 최소 기여 — scroll container                   | `measure_intrinsic_width` (`:1687~`) 에 overflow 판정 없음                                                         | 같은 함수 `is_track_scroll_container` (`IsOverflowValueScrollableInline`) → auto min = 0                                                                                                              | 위 A 를 `overflow:hidden` 으로                                                                                   | **yes**                                                      |
| G3  | span 아이템이 fr 트랙을 지날 때 (§12.5 step 3) | `tree.rs:6024` `.filter(!any(flex))` — 기여 자체를 버림 (정해진 축)                                                | `ResolveIntrinsicTrackSizes` 가 flex 를 지나는 아이템을 마지막에 처리 · `DistributeExtraSpaceToSets` 가 flex factor 비례로 fr base 를 키움 → `ExpandFlexibleTracks` 가 base > 몫 트랙을 inflexible 로 | 600 · `repeat(3,1fr)` · `width:500px; span 2` → Blink 250/250/100 / 엔진 200/200/200 (넘침)                      | **yes** — 2026-10-16 「grid 칸이 늘어난다」 수정이 반대 극단 |
| G4  | span 기여를 고정 트랙에도 균등 분배            | `tree.rs:6036-6037 · 6081-6082` `sizes[i] += extra / count` px 포함 (정해진 축은 몫 증발 · 미결정 축은 px 가 커짐) | `IsContributionAppliedToSet`: intrinsic minimum 은 `HasIntrinsicMinTrackBreadth()` 세트에만 · growth limit 먼저                                                                                       | `100px auto` + span-2 300 → Blink auto 200 / 엔진 100 · rows `30px auto` + span-2 100 → Blink 30/70 / 엔진 65/35 | **yes**                                                      |
| G5  | 역순 라인 `3 / 1`                              | `grid.rs:947` `(Some(s), Some(e)) => (Some(s), (e−s).max(1))` → 라인 3 · span 1                                    | `grid_line_resolver.cc` `if (end < start) swap`                                                                                                                                                       | `grid-column: 3 / 1` → Blink 1~2열 / 엔진 3열 1칸                                                                | **yes**                                                      |
| G6  | 없는 라인 이름                                 | `tree.rs:5194-5200` · `grid.rs:144` → `None` → auto 배치                                                           | `LookAheadForNamedGridLine` — 명시 grid 다음 암묵 라인으로                                                                                                                                            | `[a] 1fr [b] 1fr` · `grid-column-start: zzz` → Blink 3열 / 엔진 1열                                              | yes (손 입력)                                                |
| G7  | 배치 step 1 ↔ 2 순서 · 행별 minor 커서         | `grid.rs:1190-1205` source 순서로 양축 · 행 확정 아이템 섞음 · `first_free_col` (`:996`) 항상 1열부터              | `grid_placement.cc` `PlaceNonAutoGridItems` → `PlaceGridItemsLockedToMajorAxis` 행별 `minor_cursors`                                                                                                  | child1 `grid-row:1`, child2 `grid-row:1; grid-column:1` → Blink child1 2열 / 엔진 둘 다 1열 **겹침**             | **yes**                                                      |
| G8  | 커서 — definite col < cursor → 다음 행         | `grid.rs:1260-1266` 규칙 없음 (`:1178` 주석은 있다고 적음)                                                         | `AutoPlacementCursor::MoveToMinorLine` `if (minor < current) ++major`                                                                                                                                 | 3열 [auto, `grid-column:3`, `grid-column:2`] → Blink 셋째 (2행,2열) / 엔진 (1행,2열)                             | **yes**                                                      |
| G9  | content 정렬 overflow (unsafe 기본)            | `grid.rs:1318` `free <= 0.5` → start                                                                               | `ComputeFirstSetGeometry` `kSafe` 아니면 음수 허용 → center `free/2`                                                                                                                                  | 300 · `400px` · `justify-content:center` → Blink x −50 / 엔진 0                                                  | **yes**                                                      |
| G10 | `space-between` 단일 트랙                      | `grid.rs:1328` `(free/2, 0)` center                                                                                | `if (track_count < 2 …) return` — start                                                                                                                                                               | 300 · `100px` · space-between → Blink 0 / 엔진 100                                                               | **yes**                                                      |
| G11 | `safe …` · `left` · `right`                    | `grid.rs:1340` `_ => (0, 0)`                                                                                       | left/right → start/end · safe 는 clamp 만                                                                                                                                                             | `justify-content:right` 여유 200 → Blink 200 / 엔진 0                                                            | yes                                                          |
| G12 | `row-gap` `%` 축                               | `tree.rs:4323` 폭 기준                                                                                             | `CalculateGutterSize` row 는 block                                                                                                                                                                    | 400×200 `row-gap:10%` → 20 / 40                                                                                  | yes (% gap)                                                  |
| G13 | 행 축 auto-fit collapse                        | `tree.rs:4371` 범위 버림 · `:4390` collapse 는 col 만                                                              | `GridRangeBuilder::FinalizeRanges` 양축                                                                                                                                                               | `height:300px; repeat(auto-fit,50px)` rows · 아이템 2 · `align-content:end`                                      | 드묾                                                         |
| G14 | auto-repeat — 미결정 축 + definite min/max     | `grid.rs:287 · tree.rs:4355` 컨테이너 ≤ 0 → 1                                                                      | `CalculateAutomaticRepetitions` indefinite 면 `min_available_size`                                                                                                                                    | flex row 안 `min-width:450px; repeat(auto-fill,100px)` → Blink 5 / 엔진 1                                        | 드묾                                                         |
| G15 | `0fr`                                          | `grid.rs:208 · tree.rs:5917` → 1fr 폴백                                                                            | factor 0 세트는 inflexible, base 그대로                                                                                                                                                               | `1fr 0fr` → Blink 300/0 / 엔진 150/150                                                                           | 드묾                                                         |
| G16 | aspect-ratio 아이템 + implicit stretch         | `tree.rs:4905-4912 · 6581 · 6845` 양축 stretch                                                                     | `length_utils.cc` `ComputeBlockSizeForFragmentInternal`: explicit stretch → ratio → implicit stretch 순                                                                                               | cols 200 rows 300 · `aspect-ratio:2` → Blink 200×100 / 엔진 200×300                                              | **yes** (ADR-224)                                            |
| G17 | intrinsic 0 아이템 강제 stretch                | `tree.rs:6581` `\|\| real_size <= 0`                                                                               | `AxisEdgeFromItemPosition` start 그대로 (폭 0)                                                                                                                                                        | 빈 div `justify-self:start`                                                                                      | yes — ADR-156 §Residual 의도적 폴백                          |
| G18 | 반올림                                         | f32 · 여유 ≤ 0.5 무시                                                                                              | `LayoutUnit` + `leftover_size` 이월                                                                                                                                                                   |                                                                                                                  | 서브픽셀만                                                   |

### 8-2. 같음 확인

fr 가상 크기 루프 (`grid.rs:455-584` ↔ `ExpandFlexibleTracks`) · 단독 `fr` = `minmax(auto, fr)` · 미결정 축 fr · auto 트랙 min/max + §6.6 clamp (Chrome 실측 4줄 일치) · §12.6 maximize · §12.8 stretch auto · auto-fill/auto-fit 개수 식 · 열 축 auto-fit collapse · 미결정 컨테이너 `%` 트랙 → auto · `%` gap 미결정 → 0 · column gap 포함 · 라인 해소 (`-1` · `span N / span M` · `auto / N` · `N / N` · 라인 0) · 명시 크기 · intrinsic 키워드가 stretch 를 이김 · auto margin safe · 셀 넘침 미절단 · 암묵 트랙 순환 · fully-auto sparse 커서 · §12.1 순서.

---

## 9. 박스 모델 · 크기 · display · position (Blink `core/layout/length_utils.cc` · `absolute_utils.cc` · `relative_utils.cc` · `out_of_flow_layout_part.cc` · `layout_box_model_object.cc` · `core/css/style_adjuster.cc` · `css_properties.json5` · `core/html/resources/html.css`)

> 전제: Preview 는 Tailwind preflight (`App.css:7-21`: `box-sizing: border-box; border: 0; margin: 0; padding: 0`) 위에 서므로 Blink UA 시트의 margin · padding · border 기본값은 Preview 에서 이미 0 이다. 아래 "Blink" 는 레이아웃 알고리즘을 뜻하고 UA 시트는 X13 (publish 리셋 범위) 에만 나온다.

### 9-1. 격차

| #   | 축                                                                 | composition                                                                                                                                                                                                                                                                                        | Blink                                                                                                                                                                           | fixture                                                                                                      | 재현                                                               |
| --- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| X1  | relative `%` inset 기준 (가로)                                     | `tree.rs:2332 · 2470` `ctx_for(avail_w)` = 부모에게서 받은 available (= 조부모 content 폭)                                                                                                                                                                                                         | `relative_utils.cc:18-40` containing block (부모) content box                                                                                                                   | 부모 `width:200px; padding:50px` 가 content 1000 조상 안 · 자식 `relative; left:50%` → Chrome 50 / 엔진 ≈500 | 가능 (Styles `position` + `left`)                                  |
| X2  | relative `%` inset 기준 (세로 · auto 높이)                         | `tree.rs:2471` `ctx_for(container_h)` — 배치 끝난 `ch` 라 항상 definite                                                                                                                                                                                                                            | `:33-35` `HasPercent && size == kIndefinite → nullopt` (0)                                                                                                                      | auto 부모 (내용 400) 안 `relative; top:50%` → Chrome 0 / 엔진 200                                            | 가능                                                               |
| X3  | absolute static position — flex/grid 부모                          | `tree.rs:2568-2590` 부모 display 무관 block 근사 (`static_x = pb_start_x` · 선행 형제 누적 하단)                                                                                                                                                                                                   | `flex_layout_algorithm.cc:509-600` `HandleOutOfFlowPositionedItems` — justify/align 으로 "sole flex item" 위치, 형제 무관                                                       | flex center 400×200 + 형제 h50 + absolute 40×40 → Chrome (180, 80) / 엔진 (0, 50)                            | 가능 (Styles `absolute`, inset 없음)                               |
| X4  | absolute static position — 선행 형제 margin-bottom                 | `tree.rs:2585` border-box 하단만                                                                                                                                                                                                                                                                   | `block_layout_algorithm.cc:1696-1703` `+= margin_strut.Sum()`                                                                                                                   | 형제 `height:50; margin-bottom:30` 뒤 absolute → Chrome y 80 / 엔진 50                                       | 가능                                                               |
| X5  | absolute 양측 inset + 명시 크기 + `margin:auto` · 음수 잉여 (가로) | `tree.rs:7003-7012` 부호 무관 반분                                                                                                                                                                                                                                                                 | `absolute_utils.cc:299-313` 가로 음수면 start 0                                                                                                                                 | cb 200 · `left:0; right:0; width:300px; margin:0 auto` → Chrome x 0 / 엔진 −50                               | 가능 (`margin: 0 auto` 텍스트)                                     |
| X6  | aspect-ratio 자동 최소 높이 (§5.2.2) — leaf                        | `tree.rs:2160-2172` `floor_applies = !children.is_empty() && …` → leaf 는 content 하한 없음 (`:2232-2236`)                                                                                                                                                                                         | `length_utils.cc:845-862 · 886` 자식 유무 조건 없음 — `MinIntrinsic`                                                                                                            | Text `width:120px; aspect-ratio:4` 3줄 (content 60) → Chrome 60 / 엔진 30                                    | 가능 (Styles `aspectRatio`)                                        |
| X7  | aspect-ratio 전송 min/max (§5.2.1)                                 | 없음 — `tree.rs:2088-2095` 자기 축 min/max 만 · `:2164 · 2177` 크기만 전송                                                                                                                                                                                                                         | `length_utils.cc:695-735` `ComputeTransferredMinMaxInlineSizes/BlockSizes`                                                                                                      | block leaf `width:auto (400); aspect-ratio:2; max-height:100px` → Chrome 200×100 / 엔진 폭 400               | 가능 (`maxHeight`)                                                 |
| X8  | `position: sticky` · `fixed`                                       | `compositionRoot.ts:1265-1270` `relative` · `absolute` 만 전송 → sticky/fixed 는 in-flow static. Canvas 보정 `renderCommands.ts:1644-1700` 이 읽는 `isSticky · stickyTop` 은 **생산자 0** (`stickyResolver.ts` 타입뿐). 보정이 돌아도 top/left 만 · `containerBottom = parent.height` (border-box) | `layout_box_model_object.cc:596-690` containing block = padding box − padding (content) · sticky 요소 margin 제외 · 양쪽 inset · 공간 부족 시 `max_inset += free`               | `overflow:auto; height:200px; padding-bottom:40px` 안 `sticky; top:0` 헤더 → Preview 고정 / Canvas 흘러감    | **yes** — rule 2건 (`componentRulesTable.ts:5599 · 6903`) + Styles |
| X9  | `em` · `ch` · `ex`                                                 | `tree.rs:5236-5244` `parent_size: None, root_font_size: None` → `style.rs:349-355` `em` = 16 고정 · `rem` 16 · `ch/ex` = fontSize × 0.5                                                                                                                                                            | `em` = 자기 computed font-size (font-size 만 부모) · `ch` = "0" advance · `ex` = x-height · `rem` = root                                                                        | `fontSize:24` `width:2em` → Chrome 48 / 엔진 32 · `10ch` → ≈9x / 80                                          | 가능 (`width` 텍스트 통과 — `maxWidth` 의 `ch` 만 측정)            |
| X10 | `vertical-align` 키워드 범위                                       | `tree.rs:6903-6910` top · middle · bottom 외 전부 baseline                                                                                                                                                                                                                                         | `css_properties.json5` `sub · super · text-top · text-bottom · <length> · <percentage>`                                                                                         | `vertical-align: text-bottom` / `-6px`                                                                       | 가능 (`verticalAlign` ITEM_LAYOUT)                                 |
| X11 | 초기값 표 (`outline-color` · `border-*-color/width`)               | `cascade.rs:81-134` `borderColor #000 · borderWidth 0 · outlineColor invert`                                                                                                                                                                                                                       | `currentColor` · `3 (medium)` · `currentColor`                                                                                                                                  | `border-color: initial`                                                                                      | 낮음 — dormant 표 (production 호출 0)                              |
| X12 | 상속 표 누락                                                       | `cascade.rs:57-78` 17종 — `textShadow · cursor · userSelect · tabSize · direction · writingMode · hyphens · fontFeatureSettings · …` 없음                                                                                                                                                          | 전부 `inherited: true`                                                                                                                                                          | 부모 `text-shadow` 자식 Text                                                                                 | 낮음 — dormant (상속은 catalog resolver)                           |
| X13 | UA 시트 — publish 리셋 범위                                        | `apps/publish/src/styles/index.css:17-24` `box-sizing` + `margin: 0` 만 (padding · border 리셋 없음)                                                                                                                                                                                               | `html.css:876-889 button padding 1px 6px · border 2px outset` · `:488-500 input` · `:463-476 textarea` · `:1221 select` · `:320 ul padding-inline-start 40px` · `:396 fieldset` | 생성 CSS 가 padding · border 를 덮지 않는 `<button>` · `<input>` 등이 publish 에 있으면 UA 값이 남는다       | 조건부 — publish 한정, 요소별 미확인                               |
| X14 | aspect-ratio 전송값의 pad/border 하한                              | `tree.rs:2164 · 2177` 하한 없음                                                                                                                                                                                                                                                                    | `length_utils.cc:281-290` `max(border_padding, …)`                                                                                                                              | `height:20; aspect-ratio:.5; padding:0 20px` → Chrome 40 / 엔진 10                                           | 낮음                                                               |

### 9-2. 같음 확인

min/max clamp 순서 (`min_max_sizes.h:52-54` ↔ `tree.rs:2102-2109 · 6641-6650 · 6990-6999`) · `%` 블록 크기 + 미확정 cb (`length_utils.cc:200-220` ↔ `resolve_dimension_opt`) · `%` 인라인 + 미확정 · `min-width/height: auto` = 0 (block) · `fit-content` 공식 · absolute 양측 inset + auto 크기 → stretch · clamp 순서 · 한쪽 auto margin 흡수 · over-constrained start 유지 · 양측 inset auto → static · absolute cb = padding box · relative 충돌 해소 · blockify (`style_adjuster.cc:773-777 · 251-300` ↔ `display.rs:132-139`) · BFC 원인 · box-sizing (Preview · publish 가 `*` 에 border-box · Styles 에 `boxSizing` 키 없음 → content-box 문서 불가 → 결과 동일) · `display: none · contents` · atomic inline 판정 · 초기값 (`line-height normal · white-space · overflow · position · z-index · display inline`).

---

## 10. 이번에 확인하지 못한 것

- `line-height` 상속 단위 — Styles 는 px 입력을 비율로 저장 (`styleFields.ts:240-243`) 하고 DOM 에 `ratio × fontSize` px 로 낸다. Blink 는 `<length>` 는 px 상속 · 숫자는 비율 상속 (`style_builder_converter.cc:2219-2236`). Canvas 의 `inheritedText` 가 어느 쪽인지 미확인 — 부모 `line-height: 24px` + 자식 다른 fontSize fixture 로 갈린다.
- Blink `AlignBlockContent` · `ResolveInlineAutoMargins` · `ConstrainByMinMax` 본문 (block 감사가 호출 지점만 확인).
- absolute containing block 의 Blink `ContainingBlockInfo` 생성부 (sticky 의 `PhysicalPaddingBoxRect()` 사용만 확인).
- X13 의 요소별 생성 CSS 덮음 여부.

## 11. 엔진이 미구현을 명시한 것 (격차로 세지 않음)

- block: float · clear · writing-mode · 다단 (`block.rs:34-37`) · 순수 `inline` 혼합 (`tree.rs:6845-6849` "S4 까지") · `vertical-align` 확장 키워드 (`tree.rs:6901-6902` "capability matrix seed") · strut 실폰트 채널 "S4/Phase 5" (`block.rs:426-428`).
- flex: `transfer_aspect_basis_from_stretch` 의 wrap 제외 (`flex.rs:634-639`) · column 방향 baseline 그룹 (`:584`) · `order` (`layout-engine.md` — `NodeEntry.children` 이 정본) · content-box (`tree.rs:6322-6329` 전역 border-box 계약) · `contain: size` · `flex-wrap: balance` (NodeStyle 부재).
- grid: subgrid · dense 역채움 · baseline 정렬 (`grid.rs:25-29`) · 명시 grid 앞쪽 암묵 트랙 (`grid.rs:906`) · 암묵 라인 이름 · `grid-template-areas` (파서는 있으나 `tree.rs` 가 `""` 로 넘김 — NodeStyle 에 area 필드 없음) · `MAX_GRID_LINE` 10,000.
- box: `position: fixed` viewport 기준 (`layout-engine.md:67` — 단, 실제는 absolute 근사가 아니라 in-flow static) · absolute 조상 체인 (위치 미지정 부모) · `vw/vh` = page 크기 (`set_viewport`) · table · list-item display → block 폴백 (`display.rs:71-93`).

**원칙** (§5-2 와 같다): Blink 코드는 어디를 재야 하는지 가리키는 지도이고, 통과 판정은 실 Chrome `getBoundingClientRect` (ADR-156) 다. LayoutNG 는 함수 단위 포팅이 안 되므로 (`LayoutObject · ConstraintSpace` 결합) 명세 절 + Blink 의 분기 순서 · 상수를 옮기고 WPT reftest 를 fixture 로 쓴다. 한 격차 = 한 커밋 = 원복 RED 1 + live 1.

---

# Part C. 실행 절차 (Codex 분석 — `CHROMIUM_HTML_CSS_CANVAS_PHASE_PLAN.md`)

> 원본 상태: 계획 작성 완료 · 구현 및 Phase gate 미착수. 본문은 원본 그대로이고, 절 번호를 §12 ~ §18 로, gate 이름을 "gate G*" 로 바꿨다 (레이아웃 grid 격차 G1 ~ G18 과 구분). Part A · B 의 판정과 갈리거나 이어지는 자리에 **통합 주석** 을 달았다.

## 12. 목표와 구현 원칙

이 계획의 작업 단위는 **속성·값·요소·상태별 Chromium 구현 대조 → 필요한 알고리즘과 테스트 이식 → Composition 소비 경로 연결 → 정합성 검증**이다. 새로운 렌더링 구조를 먼저 만드는 방식으로 진행하지 않는다.

1. Chromium의 함수 본문뿐 아니라 입력 값의 의미, 호출부, 적용 순서, 인접 테스트를 함께 확인한다.
2. 독립적인 계산과 페인트 알고리즘은 TypeScript 또는 Rust로 이식한다. Blink의 DOM·GC·스타일 객체에 묶인 구현은 동작 계약과 테스트를 추출하여 기존 엔진에 반영한다.
3. CanvasKit이 이미 제공하는 기능은 활용한다. 동일한 Skia 기능을 별도 WASM 모듈로 중복 구현하지 않는다.
4. `CatalogGraph`는 문서 정본이다. 새 paint metadata·property state·index·cache는 파생 상태이며 저장 문서에 섞지 않는다.
5. 시각 값의 정본은 catalog + theme/tokens다. Canvas와 DOM Preview는 대등한 소비자다. DOM·접근성·폼 동작의 기존 React Aria 계약은 유지한다.
6. Chromium 소스는 구현 참고이자 비교 대상이다. 웹 표준보다 우선하는 규격으로 취급하지 않는다. Chromium 특유의 동작·버그·플래그 의존성은 별도로 기록한다.
7. 구현이 존재하거나 단위 테스트가 통과했다는 이유만으로 지원 완료를 선언하지 않는다. 실제 저작·변경·Preview·저장/재열기 경로를 확인한다.

관련 분석: 이 문서 Part A · B (원본 `CHROMIUM_CC_BLINK_PAINT_DELTA_2026-10.md` · `BLINK_LAYOUT_DELTA_2026-10.md`). 해당 문서의 결함·격차 판정은 구현 착수 시 현재 코드와 실제 화면에서 재검증한다. 샘플링 정책이나 폰트 합성 경로처럼 버전·backend에 의존하는 결론을 그대로 구현 지시로 사용하지 않는다.

## 13. HTML·CSS 지원 범위

### 13-1. 범위 정의

- **HTML 지원:** 요소·콘텐츠·기본 표시 의미를 catalog와 DOM 소비자에 대응시키고 Canvas에서 같은 화면을 만든다. Canvas 픽셀로 DOM 접근성, 브라우저 탐색, 스크립트 실행을 대체한다는 뜻이 아니다.
- **CSS2 지원:** 화면용 cascade·상속·box model·normal flow·inline·positioning·float·table·list·텍스트·페인트를 기능별로 조사하고 구현한다.
- **CSS3 지원:** 하나의 고정된 규격 집합으로 취급하지 않는다. CSS Snapshot과 각 모듈의 버전·기능·값을 지원표에 고정한다. Flexbox, Grid, Fonts, Text, Backgrounds, Transforms, Masking, Filter Effects 등 서로 다른 모듈을 별도 판정한다.
- **기존 기능 정합:** 현재 catalog·Styles 패널·generated CSS·상태 스타일·import 경로가 실제로 내보내는 기능은 우선 수리 대상이다.
- **지원 확장:** 아직 저작할 수 없는 HTML 요소나 CSS 값도 지원표에서 제거하지 않는다. schema·authoring·DOM·Canvas 확장을 포함한 후속 작업으로 배정한다. 완료 전에는 `planned` 또는 `unsupported`로 표시한다.
- **별도 제품 범위:** 임의 웹페이지 URL 복제, 완전한 HTML parser/JS 실행 환경, 브라우저 전체 재구현은 이 계획의 자동 전제가 아니다. 임의 stylesheet·HTML import가 필요하면 P0에서 그 진입 경로를 명시하고 P2·P3에 추가한다.

> **통합 주석**: 범위 판정은 두 분석이 다르다. Part A · B 는 "Preview 가 실제로 내보내는 값" (ssot-hierarchy D3) 만 대칭 대상으로 보고 생성 CSS 0 건인 축을 "무해" 로 뒀다. 위 "지원 확장" 줄과 §13-2 의 table · list · float · multicol · video · iframe · hover/transition/animation 을 Phase 작업으로 배정하는 것은 **사용자가 승인한 scope 의 확장** (결정 지점 ④) 이라 사용자 결정 전에는 `planned` 행으로만 둔다 (§19-2).

### 13-2. 기능군과 담당 Phase

아래는 구현 대상군이다. 속성별 현재 지원 상태를 뜻하지 않으며, 정확한 longhand·값·조합 목록은 P0 산출물로 만든다.

| 기능군                  | 대상 예시                                                                                                                                                                   | 담당                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| HTML 구조·텍스트        | body, div, section, heading, paragraph, span, br, strong/em, code/pre, link                                                                                                 | P3·P4·P5                                                   |
| HTML 목록·표            | ul/ol/li, marker, table/thead/tbody/tr/td/th, colspan/rowspan                                                                                                               | P3·P4·P7                                                   |
| HTML 폼·상태            | button, input, textarea, select, label, placeholder, checked, disabled, readonly, required, invalid, indeterminate                                                          | P3·P12                                                     |
| HTML 이미지·대체 콘텐츠 | img, intrinsic size, aspect ratio, fallback, SVG·video·canvas·iframe의 표현 경계                                                                                            | P3·P8                                                      |
| Cascade·값 해석         | specificity, source order, layers, inheritance, initial/inherit/unset/revert/revert-layer, custom properties, shorthand                                                     | P2                                                         |
| 단위·계산               | px, %, em/rem, viewport units, calc/min/max/clamp, currentColor, 논리 속성                                                                                                  | P2·P4                                                      |
| Box·normal flow         | display, box-sizing, width/height, min/max, margin/padding, margin collapse, block/inline/inline-block, BFC                                                                 | P4                                                         |
| 위치·overflow           | relative/absolute/fixed/sticky, inset, containing block, float/clear, overflow-x/y, clipping, scroll                                                                        | P4·P9                                                      |
| 표·목록 레이아웃        | table-layout, border-collapse/spacing, caption, 셀 정렬, list-style, counter                                                                                                | P4·P7                                                      |
| Flex·Grid               | direction/wrap/order, grow/shrink/basis, alignment, gap, auto placement, repeat/minmax/fr, span, intrinsic tracks                                                           | P6                                                         |
| 확장 레이아웃           | writing-mode, logical dimensions, multicolumn, fragmentation, subgrid 등 범위별 항목                                                                                        | P0 분류 후 P4·P6 하위 작업                                 |
| 글꼴·텍스트             | font family/weight/style/stretch/variation/features, synthesis, white-space, line-height, word/letter spacing, word-break, overflow-wrap, bidi, alignment, indent, ellipsis | P5                                                         |
| 텍스트 장식             | underline/overline/line-through, thickness/offset/style, text-shadow, emphasis 등 채택 항목                                                                                 | P5·P7                                                      |
| 배경·테두리             | 다중 background, gradient, repeat/size/position/origin/clip, radius, side별 border, solid/dashed/dotted/double/groove/ridge/inset/outset, outline, box-shadow               | P7                                                         |
| 이미지 표현             | object-fit/position, image-rendering, image orientation·색 프로필, SVG viewBox·path·paint                                                                                   | P8                                                         |
| 합성                    | stacking context, z-index, opacity, isolation, blend, transform/origin, 개별 translate/rotate/scale, perspective·3D 범위                                                    | P9                                                         |
| 효과                    | filter, backdrop-filter, clip-path, mask image/mode/composite, SVG filter 연계 범위                                                                                         | P9                                                         |
| 색                      | alpha, 색 공간, 색 함수·gradient 보간, sRGB·wide-gamut 출력 정책                                                                                                            | P2·P7·P8·P9                                                |
| 상태·선택자             | hover/active/focus-visible, RAC data-state, pseudo-element, content/counter, selector 조합                                                                                  | P2·P3·P12                                                  |
| 반응형·시간             | breakpoint, media/container query의 채택 범위, transition, animation, reduced-motion, font/image 비동기 완료                                                                | P12                                                        |
| 비화면·브라우저 서비스  | print/paged media, speech, navigation, network, script, native popup, 권한이 필요한 embedded content                                                                        | Canvas 직접 구현 여부를 P0에서 명시; 기본 화면 gate와 분리 |

### 13-3. 지원 상태와 완료 표현

지원표의 상태는 `unverified`, `planned`, `implemented-unverified`, `verified`, `unsupported`, `deferred`로 구분한다. `unsupported/deferred`에는 이유·대체 표현·담당 후속 Phase를 적는다. `partial` 한 단어 대신 미지원 값과 조합을 개별 행으로 분리한다.

| 기능 ID                  | 요소/속성/값                        | 표준 모듈             | 저작·저장 | resolve/layout | Canvas | Preview | 상태·반응형 | Chromium 함수·테스트 | 판정·근거  |
| ------------------------ | ----------------------------------- | --------------------- | --------- | -------------- | ------ | ------- | ----------- | -------------------- | ---------- |
| 예: paint.shadow.outer   | box-shadow / blur·spread·offset     | Backgrounds & Borders | 조사      | 조사           | 조사   | 조사    | 조사        | P0에서 고정          | unverified |
| 예: layout.width.percent | width / %                           | Sizing·CSS2           | 조사      | 조사           | 조사   | 조사    | 조사        | P0에서 고정          | unverified |
| 예: text.numeric.tabular | font-variant-numeric / tabular-nums | Fonts                 | 조사      | 조사           | 조사   | 조사    | 조사        | P0에서 고정          | unverified |

지원률을 보고할 때는 분모가 되는 feature manifest 버전을 함께 적는다. 미구현 항목을 분모에서 빼서 완료율을 올리지 않는다. 이 계획 문서만으로 HTML/CSS 전체 지원을 선언하지 않는다.

## 14. 속성별 참조·이식 절차

모든 기능 작업은 다음 절차를 따른다.

1. **입력 고정:** 요소·속성·값·상태·단위·상속·viewport·font/resource 조건을 최소 fixture로 만든다.
2. **원문 추적:** 고정 Chromium SHA에서 parser/resolver → used value → layout 또는 painter → Skia 호출까지 필요한 경로를 읽는다.
3. **반례 추출:** 인접 C++ 테스트와 WPT/reftest 중 해당 의미를 검증하는 사례를 선정한다. 파일 이름·test ID·원본 revision을 기록한다.
4. **차이 분류:** 미노출, 저장 누락, 값 해석 오류, layout 오류, paint 오류, invalidation 오류, backend 제약을 구분한다.
5. **최소 이식:** 독립 수식·알고리즘·처리 순서를 기존 TS/Rust 소유 모듈에 넣는다. Blink 전체 객체 모델을 복제하지 않는다.
6. **소비 경로 연결:** authoring → catalog → resolve → layout/paint → DOM/Canvas → preview/commit/reset/history/save/load를 확인한다.
7. **정확도 검증:** fixture의 computed style·geometry·line metrics·pixels를 적합한 기준으로 비교한다.
8. **성능·수명 검증:** 수정으로 새 순회·할당·GPU layer·cache·resource 누수가 생기지 않았는지 측정한다.
9. **출처·지원표 갱신:** 원문과 달라진 부분, 이유, 테스트, 미지원 조합을 기록한다.

### 14-1. 이식 방식

| 방식             | 적용 조건                                | 예시                                   |
| ---------------- | ---------------------------------------- | -------------------------------------- |
| 직접 번역 이식   | 의존성이 작은 수식·기하 알고리즘         | shadow 입력 해석, border corner 분할   |
| 계약 기반 재구현 | Blink 내부 객체 의존성이 큼              | containing block, inline fragment 처리 |
| 기존 API 연결    | CanvasKit/엔진이 필요한 동작을 이미 제공 | sampling 옵션, shape/paragraph 기능    |
| 테스트 이식      | 구현 구조가 달라도 출력 의미를 비교 가능 | flex/grid sizing, bidi·line breaking   |
| 명시적 대체·보류 | 공개 API나 현재 제품 모델로 구현 불가    | native popup, 외부 iframe 내부 paint   |

코드를 복사·번역하거나 테스트를 재사용할 때 파일별 license와 third-party 의존성을 확인하고 필요한 copyright·notice·출처를 보존한다. Chromium 저장소 전체를 단일 라이선스로 간주하지 않는다. vendor 복사 대신 알고리즘을 재구현하더라도 출처와 설계 차이는 추적 가능하게 남긴다.

## 15. 참조 지도와 Composition 수정 경계

Chromium 경로의 기준 prefix는 `third_party/blink/renderer/`이다. 아래 directory는 탐색 시작점이며, 구체 함수·테스트는 해당 Phase 시작 시 source ledger에 고정한다.

| 작업                 | Chromium 참조                                                                                               | Composition 주요 경계                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| HTML 기본 표시·style | `core/html/`, `core/html/resources/`, `core/css/`, `core/style/`                                            | catalog bindings/rules, shared runtime, generated CSS                  |
| CSS2 layout          | `core/layout/`, `core/layout/inline/`, `core/layout/table/`                                                 | shared `compositionRoot.ts`, `packages/engine/src/`                    |
| Flex·Grid            | `core/layout/flex/`, `core/layout/grid/`                                                                    | Rust layout·intrinsic 입력·engine golden tests                         |
| 텍스트               | `core/layout/inline/`, `platform/fonts/`, `platform/fonts/shaping/`, `core/paint/text_*`                    | `textMeasure.ts`, `nodeRendererText.ts`, `textParagraphKey.ts`, editor |
| Box 페인트           | `core/paint/box_painter_base.cc`, `box_border_painter.cc`, `outline_painter.cc`, `core/style/shadow_data.h` | `styleConverter.ts`, `nodeRendererBorders.ts`, `nodeRendererShapes.ts` |
| 이미지               | `platform/graphics/image*`, `cc/paint/`, `cc/tiles/`                                                        | `nodeRendererImage.ts`, `imageCache.ts`                                |
| 합성·geometry        | `core/paint/`, `platform/graphics/paint/`, `platform/graphics/compositing/`                                 | `effects.ts`, clip/mask, `renderCommands.ts`                           |
| 무효화               | `paint/geometry_mapper.*`, `raster_invalidator.*`, `paint_under_invalidation_checker.*`                     | command patch/translate, bounds, renderer, 테스트 하니스               |
| 동적 표현            | `core/animation/`, `core/css/`, property state·scroll 관련 구현                                             | runtime previews, transition/animation, frame presentation             |
| 사례·회귀            | 인접 `*_test.cc`, `third_party/blink/web_tests/`, 그 안의 WPT                                               | 인접 Vitest·Rust test·Builder/Preview fixture                          |

`graph`·transaction·저장 형식은 renderer 개선의 기본 수정 대상이 아니다. 새 속성을 저작·저장할 필요가 확인된 경우에만 typed schema·validation·default·migration을 별도 작업으로 포함한다. DOM 구조·API가 바뀌는 HTML 요소 확장은 D1/D2까지 영향을 분석하고 해당 컴포넌트 계약을 따른다.

## 16. 전체 Phase와 의존 관계

기존 계획 번호를 재정렬했다. 이 Phase 번호를 이후 실행 기준으로 사용한다. 표의 모든 Phase는 현재 미착수다.

| Phase | 결과                                       | 선행                                              |
| ----- | ------------------------------------------ | ------------------------------------------------- |
| P0    | 지원 manifest·source ledger·기준선         | 없음                                              |
| P1    | 독립 전체 재생성·DOM/WPT 검증 기반         | P0                                                |
| P2    | 속성 값·상속·상태 입력 계약                | P1                                                |
| P3    | HTML 요소·콘텐츠·기본 표시 대응            | P2                                                |
| P4    | CSS2 box·flow·position·table/list layout   | P3; inline 상세는 P5와 공동 종결                  |
| P5    | CSS 텍스트·글꼴·inline·편집 정합           | P2·P3; P4와 공동 종결                             |
| P6    | Flex·Grid·intrinsic sizing 정합            | P4·P5                                             |
| P7    | Background·border·outline·shadow 이식      | P2·P3; 검증 가능한 기존 geometry로 조기 착수 가능 |
| P8    | 이미지·SVG·대체 콘텐츠 표현                | P3·P7; 크기 정합은 P4·P6 결과 소비                |
| P9    | Stacking·transform·clip·mask·filter 합성   | P4·P5·P7·P8                                       |
| P10   | 실제 paint bounds·효과 의존성              | P9의 기능별 계약                                  |
| P11   | 증분 갱신·paint index·컬링·부분 재그리기   | P10                                               |
| P12   | 상태·반응형·animation·비동기 통합          | P2~P11; 각 Phase의 기본 상태 검증은 선행 실시     |
| P13   | 측정 기반 property 상태·이미지 자원 최적화 | 관련 정확도 gate·P11                              |
| P14   | 전체 지원표·회귀·성능·문서 종결            | P0~P13; 보류 최적화는 사유 기록                   |
| P15   | 조건부 타일·Worker·Rust 확대               | P14에서 병목 입증                                 |

권장 실행 흐름은 `P0 → P1 → P2 → P3 → P4/P5 → P6 → P7 → P8 → P9 → P10 → P11 → P12 → P13 → P14`다. P7의 독립적인 기존 속성 수리는 P2·P3 이후 먼저 완료할 수 있다. 이것은 작업 의존성 설명이며 병렬 에이전트 실행을 지시하지 않는다.

### 16-1. Phase별 작업과 완료 조건

#### P0 — 지원 manifest·참조 버전·production 기준선

**목적:** 전체 범위를 속성명보다 작은 값·상태·조합 단위로 고정한다.

- [ ] catalog typed fields·bindings·generated CSS·Styles 패널·상태 선택자·import 경로에서 실제 입력을 수집한다.
- [ ] §13의 HTML·CSS2·CSS 모듈군과 대조하여 현재 노출되지 않은 기능도 manifest에 기록한다.
- [ ] Chromium 함수·테스트·spec 절·필요 CanvasKit API·현재 consumer를 source ledger에 기록한다.
- [ ] 기존 조사 문서의 shadow·image sampling·font feature·border·decoration 후보를 최소 fixture로 재현한다.
- [ ] Chromium 소스 SHA와 비교 브라우저 버전을 별도로 기록한다. 서로 다른 revision의 결과를 동일 구현으로 가정하지 않는다.
- [ ] flat/nested 600·5k, 필요 시 10k 문서의 edit/drag/zoom/scroll/select 기준선을 수집한다.

> **통합 주석**: 기준선은 이미 있다 — `.agent/runs/2026-10-15-canvas-rust-baseline/` · ADR-263 ~ 265 breakdown · [CANVAS_RUST_DECISION_2026-10.md](CANVAS_RUST_DECISION_2026-10.md). 재측정하지 않고 인용한다 (gate G0 의 "ADR-265 종결 기록을 현재 측정으로 대체하지 않는다" 와 같은 뜻). manifest 초기 행 = §0-2 표 + §4 · §6 ~ §9 격차.

- [ ] 문서 처리·layout·binding·record·raster/flush·React/RAC 패널 비용을 구분한다.
- [ ] 비교 fixture·측정 횟수·노이즈 판정·성능 목표를 구현 전에 고정한다.

**산출물:** feature manifest, source ledger, 최소 재현 모음, 환경·commit·dirty diff를 포함한 baseline.

**gate G0:** manifest의 모든 행에 상태와 담당 Phase가 있다. 성능 기대치는 실측·가설을 구분한다. ADR-265 종결 기록을 현재 측정으로 대체하지 않는다.

#### P1 — 독립 검증 기반과 이식 테스트 하니스

**목적:** 최적화의 오류와 CSS 의미의 오류를 별도로 검출한다.

> **통합 주석**: P1 의 대부분은 이미 있다 — `__composition_RENDER_PATH_DEBUG__` (`forceFull · setDamageOff · setLinearOnly`) · `adr263-render-path-live.mjs` · `adr264-subtree-translate-live.mjs` · G3 하니스 (`approvedDifferences.ts`) · ADR-156 차등 oracle (`adr923ChromeDifferential.browser.test.ts`) · ADR-189 damage (`damageUnsafeElementIds` · `hasTextPaintOverflow`) · ADR-246 ratchet. P1 은 "만든다" 가 아니라 "있는 oracle 을 feature ID 로 묶는다" + S8 (under-invalidation 플래그) 추가.

- [ ] 같은 문서·resource generation에서 catalog/layout/binding/command를 fresh build하는 대조군을 만든다.
- [ ] picture·surface 캐시, spatial 후보 제한, 실행기 AABB 컬링을 각각 우회할 수 있게 한다.
- [ ] 실제 production 경로와 독립 대조군의 geometry·command metadata·paint pixels를 비교한다.
- [ ] DOM Preview의 computed style·rect·line metrics·screenshot을 feature ID와 함께 기록한다.
- [ ] WPT 원본 중 직접 실행한 사례와 catalog fixture로 번역한 사례를 구분한다. 번역본 통과를 원본 WPT 통과라고 부르지 않는다.
- [ ] animation 시간·font/image readiness·DPR·zoom을 고정한다.
- [ ] stale cache, 누락 invalidation, 잘못된 bounds를 주입한 negative test가 실패하는지 확인한다.
- [ ] 인터셉트·단계별 replay 개념을 사용해 최초로 달라지는 draw 단위를 찾을 수 있게 한다.

**gate G1:** 알려진 오류를 검출하고 재현 artifact를 남긴다. 같은 backend의 결정적 대조는 픽셀 동치를 목표로 하며 DOM 비교는 geometry·text·AA·색 공간 차이를 분리한다. 전체 화면에 넓은 tolerance를 적용해 의미 오류를 숨기지 않는다.

#### P2 — CSS 값 해석·상속·상태 입력 계약

**참조:** Blink `core/css`, `core/style`, 값 변환의 실제 호출부.

> **통합 주석**: production 은 catalog resolver 가 resolve 한 값만 소비하고 엔진 `cascade.rs` · TS `cssResolver.ts` 의 cascade · 상속 · 초기값 표는 dormant 다 (X11 · X12). P2 는 "값 해석 · 단위 · 논리 속성" 으로 좁히는 것이 위 마지막에서 두 번째 줄 ("이미 resolve된 catalog만 소비하는 경로에 별도 CSS 엔진을 중복 삽입하지 않는다") 과 맞다. 이 Phase 의 확정 격차: X9 (`em` = 16 고정).

- [ ] authored → resolved/computed → used value 단계와 각 값의 소유자를 정의한다.
- [ ] shorthand/longhand, initial/inherited values, global keywords, custom property fallback·cycle·invalid value 처리를 조사·구현한다.
- [ ] 단위·percentage basis·calc/min/max/clamp·currentColor·색 함수의 전달을 확인한다.
- [ ] logical/physical 속성, direction/writing-mode에 따른 매핑을 정리한다.
- [ ] catalog rule·instance override·theme·state·breakpoint의 우선순위를 Canvas/DOM에서 대조한다.
- [ ] CSS selector·cascade layer·specificity가 필요한 authoring/import 경로는 범위와 resolver를 명시한다. 이미 resolve된 catalog만 소비하는 경로에 별도 CSS 엔진을 중복 삽입하지 않는다.
- [ ] 지원 값 추가 시 schema·validation·serialization·CSS generator·Canvas binding을 함께 연결한다.

**gate G2:** 선택한 속성 값이 양쪽 consumer에 같은 의미로 도달한다. 미지원 값은 조용히 기본값으로 사라지지 않고 manifest에 기록된다. 이 단계에서 arbitrary CSS 전체 파싱을 구현했다고 선언하지 않는다.

#### P3 — HTML 요소·기본 표시·콘텐츠 모델

**참조:** Blink `core/html`, UA style 자료, 요소별 layout/paint 경로와 HTML 테스트.

- [ ] block/inline·heading/paragraph·pre/code·link·line break·semantic wrapper의 catalog 대응표를 만든다.
- [ ] 익명 text box·anonymous wrapper·generated content를 authored node와 구분하는 파생 모델을 정한다.
- [ ] 목록 marker/counter, table section/row/cell, form label/value/placeholder의 소유권을 명시한다.
- [ ] hidden, disabled, readonly, checked, indeterminate 등 HTML/RAC 상태의 표시 의미를 연결한다.
- [ ] 기본 UA style과 catalog가 의도적으로 덮는 시각 값을 구분한다. 네이티브 브라우저 컨트롤의 외형을 catalog에 강제로 적용하지 않는다.
- [ ] image/SVG/video/canvas/iframe/object/embed는 직접 렌더·리소스 프레임·DOM 위임·미지원 중 전략을 기록한다. CORS·격리로 읽을 수 없는 콘텐츠를 읽을 수 있다고 가정하지 않는다.
- [ ] new element가 필요한 경우 component-design 계약에 따라 DOM/RAC·Props·catalog·Canvas·Preview를 함께 확장한다.

**gate G3:** 요소마다 정상·빈 콘텐츠·fallback·상태 전환 fixture가 있다. 접근성·포커스·입력은 기존 DOM/RAC 또는 편집 overlay 계약을 유지하고 Canvas 표현과 값이 일치한다.

#### P4 — CSS2 box·normal flow·위치·표·목록 레이아웃

**참조:** Blink `core/layout`, table·block 관련 구현, CSS2/WPT layout tests.

> **통합 주석**: 확정 격차 (Part B): **B1 · B2 배선 회귀** (§6) · **X8 sticky · fixed 미전송** · X1 ~ X5 (relative `%` · absolute static position · 음수 잉여) · X6 · X7 · X14 (aspect-ratio) · B5 ~ B8 (§6 · §9). float · table (T1) · multicol 은 scope 결정 대기.

- [ ] content/border box, margin/padding, min/max, auto·percentage·intrinsic size의 입력과 출력 계약을 정리한다.
- [ ] block·inline-block·BFC·margin collapse·float/clear·anonymous box의 필요한 알고리즘을 기존 Rust 엔진에 반영한다.
- [ ] relative/absolute/fixed/sticky, containing block, inset, scroll owner, overflow-x/y를 검증한다.
- [ ] list marker 위치, table auto/fixed sizing, colspan/rowspan, caption·cell alignment·border spacing을 검증한다.
- [ ] border-collapse conflict resolution의 기하·페인트 경계는 P7과 연결한다.
- [ ] writing-mode·logical axis·multicolumn/fragmentation 항목은 구현 묶음을 명시하고 미구현 상태를 숨기지 않는다.
- [ ] P5에서 확정한 inline line metrics·baseline·intrinsic 값으로 회귀를 재검증한다.

**gate G4:** 지원한 CSS2 layout fixture의 used geometry가 기준과 일치한다. full solve와 incremental solve가 동치이며 변경된 형제·조상·absolute descendant에 stale geometry가 없다. P5와 맞물린 inline 항목은 양쪽 gate 후 닫는다.

#### P5 — 텍스트·폰트·Inline Layout·편집 통합

**참조:** LayoutNG inline, HarfBuzz shaping/fallback 호출부, text painter·decoration 관련 구현.

> **통합 주석**: 확정 · 후보 격차: S3 `font-variant-numeric` · S4 합성 italic · S6 decoration 두께 · B3 `line-height: normal` · B4 · X10 vertical-align · I1 inline run 혼합. 줄바꿈은 Canvas2D 측정이 Chrome 자신을 oracle 로 쓰므로 `line_breaker.cc` 이식보다 낫다 (§2-7 · §5-3).

- [ ] 공백 정규화 → script/bidi segmentation → shaping/fallback → line breaking → line box 생성의 계약을 정한다.
- [ ] 측정과 페인트가 같은 font family·weight/style/stretch·variation·feature·synthesis 정책을 사용하게 한다.
- [ ] font-variant-numeric/caps, font-feature-settings, letter/word spacing, line-height, vertical-align, text-indent·alignment를 대조한다.
- [ ] white-space, word-break, overflow-wrap, hyphens·locale, ellipsis·line clamp의 지원 값과 조합을 확정한다.
- [ ] 현재 Canvas 2D break hint와 Paragraph 경로를 값별로 비교한 뒤 통합한다. hint를 일괄 삭제하거나 단순 폭 보정으로 통과시키지 않는다.
- [ ] min/max-content와 최종 폭 제약의 결과를 구분하되 같은 shaping 입력·CSS 정책을 공유한다.
- [ ] glyph/decoration/text-shadow의 실제 paint 영역을 확보하거나 보수적 unknown으로 표시한다.
- [ ] 편집 overlay의 baseline·줄바꿈 폭·origin·선택·IME를 새 계약에 연결한다.
- [ ] 측정용 Paragraph 객체의 전역 캐시를 도입하지 않는다. 렌더 Paragraph의 노드 소유·공유 FontCollection·지연 해제를 보존한다.

**gate G5:** 한글·영문·emoji·RTL 혼합, 긴 URL, variable font, font fallback, 좁은 폭, font loading 전후의 줄·baseline·geometry가 일치한다. 편집 시작/종료·Undo/Redo·저장/재열기에서 글자가 이동하거나 사라지지 않는다.

#### P6 — Flexbox·Grid·Intrinsic Sizing

**참조:** Blink flex/grid 알고리즘과 인접 테스트, 해당 CSS 모듈의 WPT.

> **통합 주석**: 함수 단위 대조는 끝났다 — flex F1 ~ F11 (§7) · grid G1 ~ G18 (§8) 과 "같음 확인" 목록이 이 Phase 의 입력이다. 흔한 입력 순: G1 · G2 → F4 → G3 · G4 · G7 · G8 → G16.

- [ ] flex basis·grow/shrink·auto min-size·wrap·reverse·order·auto margin·baseline·stretch를 값별로 대조한다.
- [ ] grid explicit/implicit tracks, auto placement, minmax/fr/repeat, gap, span, alignment와 intrinsic contribution을 검증한다.
- [ ] definite/indefinite size, percentage, aspect ratio, nested flex/grid에서의 used value를 검증한다.
- [ ] subgrid·auto-fit/auto-fill 등 추가 기능은 manifest에 독립 기능으로 두고 전체 지원 상태와 분리한다.
- [ ] Chromium 알고리즘에서 추출한 수식·조건을 기존 Rust 구조에 반영하고 regression fixture를 이식한다.
- [ ] 최종 layout을 사용하는 drag/drop·resize·span·overlay·hit 소비자도 검증한다.

**gate G6:** full/incremental engine 결과와 DOM geometry가 정합하다. Canvas 편집 도구의 placement/span 계약도 유지된다. layout 알고리즘을 바꿨다는 이유로 엔진 전체를 재작성하지 않는다.

#### P7 — Background·Border·Outline·Shadow 속성별 이식

**참조:** `BoxPainterBase`, `BoxBorderPainter`, `OutlinePainter`, `ShadowData` 및 인접 테스트.

> **통합 주석**: 확정 격차: S1 sigma (`/ 2.355` → `× 0.5`, drop-shadow 는 변환 없음 — §2-1) · S5 border style (§2-5) · S6 outline-style (§2-6). Blink 상수는 §2-5 · §5-1.

- [ ] 다중 background의 순서·repeat·size·position·origin·clip과 gradient 보간을 대조한다.
- [ ] border의 변별 색·폭·style, radius 정규화, corner 분할·AA, double/groove/ridge/inset/outset을 구현한다.
- [ ] outline style/offset·focus 상태와 table collapsed border의 충돌 규칙을 연결한다.
- [ ] outer/inset·다중 box-shadow와 text-shadow의 blur·spread·offset 의미를 원문과 비교한다.
- [ ] CSS shadow의 blur radius와 filter drop-shadow의 입력 의미를 구분한다. 같은 상수를 모든 blur 파서에 일괄 적용하지 않는다.
- [ ] Sizing·색 해석이 같은 입력을 사용하도록 converter와 painter의 중복 계산을 정리한다.
- [ ] 검증된 rendering 계산을 P10 bounds 계산에서 재사용할 수 있게 경계를 마련한다.

**gate G7:** 내부 fill뿐 아니라 외부 shadow·outline·corner·반투명 겹침을 포함한 픽셀 비교를 통과한다. DPR·fractional position·zoom·dark/light 상태를 포함한다.

#### P8 — 이미지·SVG·대체 콘텐츠

**참조:** Blink image paint, Skia sampling 호출부, `cc/paint`, image decode cache.

> **통합 주석**: S2 — 고정 SHA 에서 판정 사슬을 끝까지 확인했다 (§2-2 표). 둘째 줄의 경고 ("모든 auto 이미지에 동일 mipmap 정책") 가 맞았고, 그 결과가 판정 함수 이식이다.

- [ ] intrinsic dimensions·aspect-ratio·object-fit/position·src/dst clipping을 대조한다.
- [ ] image-rendering 값과 실제 Chromium/CanvasKit sampling 동작을 버전별로 확인한다. 모든 auto 이미지에 동일 mipmap 정책이 적용된다고 단정하지 않는다.
- [ ] alpha·orientation·색 프로필·sRGB/wide-gamut 정책을 명시한다.
- [ ] SVG path·fill/stroke·cap/join·viewBox·gradient·mask의 지원 범위를 기록하고 vector/raster 전략을 정한다.
- [ ] animated image·video·외부 canvas·iframe은 P3 전략에 맞춰 갱신·fallback·격리 계약을 구현한다.
- [ ] placeholder→loaded, 실패→재시도, source 교체에 따른 layout·paint·cache 갱신을 연결한다.

**gate G8:** 축소·확대·crop·투명 이미지·SVG fixture가 정합하다. 비동기 완료 후 사용자 편집 없이 갱신되며, 미지원 embedded content를 지원 완료로 표시하지 않는다. 해상도별 캐시 최적화는 P13에서 측정 후 수행한다.

#### P9 — Stacking·Transform·Clip·Mask·Filter·합성

**참조:** Blink paint properties·paint order·effect 상태와 compositor 경계.

> **통합 주석**: S6 개별 transform 속성 (`translate → rotate → scale → transform` 합성) · stacking context 생성 조건 대조 (§5-1 "그림 순서").

- [ ] z-index·stacking context·top layer·isolation을 문서 paint 순서에 맞춘다.
- [ ] transform/origin 및 개별 translate/rotate/scale의 결합 순서·좌표계를 정한다.
- [ ] perspective·preserve-3d·backface 등 3D 항목은 개별 지원 판정과 테스트를 둔다.
- [ ] clip-path·rounded overflow·mask-mode/composite·alpha/luminance 의미를 이식한다.
- [ ] 그룹 opacity·blend·filter·backdrop-filter의 합성 단위와 입력 의존성을 분리한다.
- [ ] filter input/output bounds, 배경 읽기 영역, mask 자원 참조를 기록할 경계를 만든다.
- [ ] 저장된 효과가 Preview에도 같은 의미로 도달하는지 확인한다.

**gate G9:** 겹치는 자식·반투명 그룹·배경 변경·노드 순서 변경·mask 로딩의 결과가 정합하다. CanvasKit API의 foreground filter와 backdrop filter를 같은 기능으로 취급하지 않는다. 안전한 부분 실행이 불가한 효과는 full/group fallback을 유지한다.

#### P10 — 실제 Paint Bounds·효과 의존성 도입

**참조:** `GeometryMapper`, `RasterInvalidator`, effect property의 영역 변환.

> **통합 주석**: P10 · P11 은 ADR-263 ~ 265 가 **종결** 한 영역 (damage 경로 · spatial index 컬링 · patch · translateSubtree) 과 겹친다. 그 종결 기록을 Context 로 두고 남은 꼬리 (patch 영역 크기 · 줌 auto-columns 재바인드 · Canvas binding 옮김 상수 — §3) 만 다룬다. "실제 paint bounds" 는 지금의 "unsafe → full 수렴" (ADR-263 HC4) 보다 나아간 제안 — 측정이 먼저.

- [ ] layout/hit/self paint/subtree paint bounds를 분리한다.
- [ ] bounds의 empty/known/unknown, invalidation의 clean/partial/full 상태를 정의한다.
- [ ] P5~P9의 실제 paint 의미로 primitive·text·effect 영역을 계산한다.
- [ ] transform·clip·effect 순서와 overflow 자식까지 포함한 subtree 영역을 집계한다.
- [ ] 변경 전·후 bounds와 effect 입력 의존성으로 damage를 구한다.
- [ ] 초기에는 기존 renderer 선택을 유지한 채 metadata를 계산·대조한다.
- [ ] bounds가 unknown이면 빈 영역으로 해석하지 않고 안전한 fallback 사유를 전파한다.

**gate G10:** 렌더 픽셀이 conservative bounds 밖으로 빠지지 않는다. 삭제·축소 뒤 조상 영역도 줄어들고, hit 영역은 그림자 때문에 확대되지 않는다. 최적화 활성화 이전에 metadata 동치가 확보된다.

#### P11 — 갱신 경로·Paint Index·컬링·부분 재그리기

- [ ] full/subtree/self build, preview/commit patch, translateSubtree/placeRegion에 P10 metadata를 연결한다.
- [ ] 삭제·재정렬·page root 이동·theme/breakpoint·font/image·context restore·dispose 경로를 갱신한다.
- [ ] hit index와 독립된 paint index 및 ID mapping 수명을 정의한다. 기존 Rust index 인스턴스 재사용 가능성을 먼저 검토한다.
- [ ] viewport 후보 검색과 실행기 내부 AABB 컬링을 함께 수정한다.
- [ ] 후보의 조상 state·합성 그룹·effect 입력을 추가하고 원래 paint 순서를 보존한다.
- [ ] 새 명령·metadata·index가 같은 scene/resource/presentation 상태를 나타내게 한다.
- [ ] old/new paint bounds로 damage를 만들고 camera/DPR에 따라 surface 범위를 보수적으로 변환한다.
- [ ] pending full 우선순위·ping-pong 동기화·실패 시 full 복구·flush 후 자원 해제를 보존한다.
- [ ] 검증된 기능만 활성화해 장면 전체 unsafe fallback을 점진적으로 줄인다.

**gate G11:** 화면 밖 상자의 그림자, 부모 밖 자식, clip 경계 이동, 삭제·투명화·그림자 제거에서 잔상·누락이 없다. fresh build와 명령·metadata·index·pixel이 동치다. 실제 효과 포함 fixture에서 fallback·실행량 감소와 총비용을 함께 측정한다.

#### P12 — 상태·반응형·Animation·Preview·저장 통합

> **통합 주석**: Canvas 는 저작 surface 라 hover · pressed · focus-visible · transition · animation 은 Preview 소속이다 (메모리 `feedback-skia-builder-not-frontend-interaction-belongs-to-preview` · ADR-223). 문서가 든 상태 (selected · disabled · isPending) 만 Canvas 가 그린다. 이 Phase 는 scope 결정 (§19-2) 뒤에만.

- [ ] hover/pressed/focus-visible/selected/disabled/invalid 등 catalog·RAC 상태를 속성 소비표에 연결한다.
- [ ] pseudo-element·generated content·counter 등 채택 기능의 상태 변경과 소유권을 검증한다.
- [ ] breakpoint·media/container query·viewport·writing-mode 변경에서 재해석 범위를 확인한다.
- [ ] transition/animation의 보간 값·transform·effect·text 변화와 hit/overlay를 같은 표시 시점에 맞춘다.
- [ ] reduced-motion, font/image 완료, animation 중 삭제·Undo·page 전환을 확인한다.
- [ ] 편집 preview→commit→Reset→Undo/Redo→autosave→reload→Preview 복제본 경로를 검증한다.
- [ ] Preview iframe의 기존 origin 검증·postMessage 경로를 유지한다.

**gate G12:** 중간 프레임과 최종 프레임이 모두 정합하다. 저장 문서에는 파생 bounds/cache가 들어가지 않으며 재로드 후 같은 authored state로 같은 화면이 복원된다. 각 앞선 Phase의 기본 상태 검증을 이 단계까지 미루지 않는다.

#### P13 — 측정 기반 Property 상태·자원 최적화

**정확도 gate를 유지한 상태에서 다음 두 묶음을 별도로 판정한다.**

##### P13-A: 이동·geometry 비용

> **통합 주석**: S7 property node 분리 (§3-1) 와 같은 제안. ADR-264/265 종결 카운트가 이미 "P11 이후 프로필" 에 해당한다 — 새 ADR (`/create-adr`, 사용자 전용) 의 Context 로 인용.

- [ ] P11 이후 프로필에서 subtree translation·clip 복제·rect diff·index upsert의 비용을 재측정한다.
- [ ] 유의미한 비용이 남으면 page root 또는 큰 이동 그룹에 property-state 참조를 시험 적용한다.
- [ ] 로컬 bounds·누적 transform/clip 캐시·그룹 공간 검색을 연결한다.
- [ ] draw/hit/overlay가 동일 geometry를 쓰며 비용이 다음 프레임·pick 경로로 이동하지 않았는지 확인한다.

##### P13-B: 이미지·메모리 비용

- [ ] 이미지 표시 크기·DPR·zoom별 decode/upload 비용과 live-set을 측정한다.
- [ ] 필요할 때만 scale별 자원·visible 우선순위·동시 decode 제한을 적용한다.
- [ ] mip·추가 surface·picture·Paragraph를 포함한 메모리 비용과 eviction을 기록한다.
- [ ] 캐시 교체·page 왕복·context loss·장시간 편집에서 수명 오류를 검증한다.

**gate G13:** 각 최적화는 production A/B에서 사전 정의한 목표를 충족하고 정확도·메모리 gate를 유지한다. 비용이 작으면 해당 묶음은 근거를 남기고 보류한다. property 노드 하나를 갱신한다는 이유만으로 전체 동작이 O(1)이라고 주장하지 않는다.

#### P14 — 전체 지원·회귀·성능 종결

- [ ] feature manifest의 모든 항목을 verified/unsupported/deferred 등 명시 상태로 정리한다.
- [ ] 기존 authoring이 실제 노출하는 기능의 누락을 우선 닫고, 확장 기능 미완료는 별도로 남긴다.
- [ ] Canvas↔DOM, optimized↔fresh, full layout↔incremental layout의 세 축을 재검증한다.
- [ ] 실제 Builder에서 추가·편집·preview drag·resize·scroll·zoom·텍스트 입력·Undo/Redo·저장/재열기를 확인한다.
- [ ] production 비교·메모리·초기 번들·카운트 ratchet를 판정한다.
- [ ] CHANGELOG·지원표·source ledger·이식 notice·검증 기록·향후 제한을 갱신한다.
- [ ] 적용 범위의 typecheck·tests·WASM build·format check·preflight를 완료한다.

**gate G14:** 정확도 완료, 성능 목표 달성, 미지원 범위를 각각 보고한다. 수치 목표 미달을 문서 상태 변경으로 통과 처리하지 않는다. 일부 기능만 완료한 경우 feature manifest 버전과 검증된 범위를 명시한다.

#### P15 — 조건부 타일·Worker·Rust 확장

> **통합 주석**: S10 Worker · 타일 래스터 · PaintOpBuffer 의 보류 사유와 재개 조건은 §3-3. 같은 결론.

| 후보                           | 착수 조건                                          | 추가 검증                                                  |
| ------------------------------ | -------------------------------------------------- | ---------------------------------------------------------- |
| Tile raster cache              | viewport surface 이후에도 raster/flush가 주요 병목 | tile seam·scale 전환·GPU 메모리·효과 경계                  |
| OffscreenCanvas/Worker         | Canvas main-thread 작업이 입력 지연의 주요 원인    | 메시지 비용·atomic publish·input/overlay 지연·context 복구 |
| Rust geometry/command planning | 관련 계산·WASM 경계 비용이 production 상위         | JS↔Rust 동치·경계 직렬화·자원 소유·WASM 크기               |
| 명령 바이너리화                | 기록·해석·전송 비용의 독립적인 병목 확인           | command 검증·버전·디버깅·전송 안전성                       |

**gate G15:** 별도 실측과 제한된 prototype으로 go/no-go를 판정한다. P14의 필수 완료 조건이 아니며, 이 계획만으로 대규모 이전을 실행 승인한 것으로 해석하지 않는다.

## 17. 공통 검증 계약

### 17-1. 세 개의 비교 기준

| 비교                              | 검출 대상                                      | 한계                                  |
| --------------------------------- | ---------------------------------------------- | ------------------------------------- |
| 최적화 Canvas ↔ 독립 fresh Canvas | cache·patch·bounds·culling·resource 오류       | 같은 CSS 알고리즘 오류는 공유 가능    |
| Canvas ↔ DOM Preview              | layout·텍스트·paint·합성 의미 차이             | backend·OS·font·AA 차이를 통제해야 함 |
| 구현 ↔ 표준·Chromium/WPT 사례     | 브라우저와 공통으로 잘못 구현한 의미·edge case | 번역 fixture는 원본 test와 구분 필요  |

픽셀 차이만 측정하지 않는다. computed/used value, geometry, line metrics, 선택·편집 결과를 함께 비교한다. backend별 tolerance는 baseline에서 분리·고정하며, 실패를 없애기 위해 사후에 넓히지 않는다.

### 17-2. 필수 시나리오

- 기본값과 비기본값, 유효/무효 값, 단위·상속·Reset.
- standalone과 grouped/instance/slot 내부, 자식 있음/없음.
- light/dark·state·breakpoint·font loading 전후.
- DPR 1/2 및 fractional zoom·위치, viewport 가장자리.
- overflow 자식, 그림자만 보이는 요소, clip/transform/filter 조합.
- 그룹 opacity·blend 뒤 배경 변경, mask/image 완료.
- delete·reorder·reparent·Undo/Redo·save/reopen.
- pointer drag 중간 상태와 commit, 텍스트 편집·IME·focus.
- 평평한 문서와 nested flex/grid, 600·5k 및 근거가 필요한 10k.

### 17-3. 성능·비용 판정

- 기준선과 수정본은 같은 환경·fixture·resource 상태에서 교대 비교한다.
- wall-clock profile과 결정적 call-count 계측을 별도 실행한다.
- p95/p99·dropped frames·long task 외에 layout/binding/record/flush 구간, 후보 수, 명령 수, index 갱신 수, cache miss, 메모리를 기록한다.
- 기존 중첩 5k 편집 목표 `p99 ≤ 20 ms`, `drop < 1%`는 해당 scenario가 동일할 때 승계 검토한다. 이것은 전체 HTML/CSS 기능의 공통 frame budget이 아니다.
- Canvas 변경으로 RAC/React 패널 비용까지 해결했다고 주장하지 않는다.
- cold/warm, WebGL/software fallback은 구분한다. 실제 GPU timer를 수집하지 못했다면 JS flush 호출 시간을 GPU 실행 시간으로 보고하지 않는다.
- ratchet 성공·warning·lowerable 항목·예외를 별도로 확인한다. 성능 기준을 구현 후 유리하게 변경하지 않는다.

### 17-4. 구현 시 로컬 gate

- Node/Turbo/pnpm 명령은 repo root의 pnpm script로 실행한다.
- 변경 모듈의 인접 Vitest; TS 변경 시 `pnpm run codex:typecheck`.

> **통합 주석**: `pnpm run codex:typecheck` · `.agents/README.md` 는 존재한다. Claude Code 쪽 같은 gate 는 `pnpm type-check` · `/verify` (CLAUDE.md).

- Rust 변경 시 인접 engine test와 `pnpm run wasm:build:engine` 후 관련 gate.
- UI·상태·렌더링 변경 시 실제 foreground Builder 및 Preview 확인.
- 기본 완료 gate는 `pnpm run codex:preflight`; 동시 변경이 있으면 `.agents/README.md`에 따라 자신의 범위만 검증한다.
- 포맷은 검사하며 다른 작업자의 파일을 수정하지 않는다. 문서만 바뀐 Phase plan 작성에는 제품 typecheck·브라우저 실행을 성과로 요구하지 않는다.
- commit/push는 별도 명시 요청이 있을 때만 수행한다.

## 18. 산출물·이식 기록·마일스톤

### 18-1. 기능 작업별 필수 기록

```text
feature_id:
element/property/value/state:
spec_module_and_section:
chromium_commit/path/symbol/test_id:
license_and_notice:
composition_producer/resolver/layout/paint/DOM_consumers:
port_strategy_and_differences:
invalidation_and_resource_dependencies:
fixture_and_negative_test:
geometry/text/pixel/live/performance_evidence:
support_status_and_known_limits:
```

위 ledger는 새 파일·typed registry 중 적합한 형식으로 P0에서 정한다. 본 문서의 예시 이름을 기존 시스템에 이미 있는 API로 취급하지 않는다.

### 18-2. 완료 단위

| 단위 | 범위    | 의미                                        |
| ---- | ------- | ------------------------------------------- |
| M0   | P0~P1   | 지원 범위와 검증 기준 확보                  |
| M1   | P2~P6   | HTML·CSS 값·기본 및 현대 layout·텍스트 정합 |
| M2   | P7~P9   | 속성별 웹 페인트·이미지·합성 정합           |
| M3   | P10~P12 | 정확한 증분 렌더링·상태·저장 통합           |
| M4   | P13~P14 | 근거가 있는 최적화와 종합 종결              |

P7의 독립적인 기존 속성 수리는 M1 전체 종료를 기다리지 않고 M0 및 해당 입력 계약이 준비되면 진행할 수 있다. 작은 정확도 수정과 큰 구조 변경을 같은 변경 단위로 묶지 않는다.

### 18-3. 중단·재판정 조건

- Chromium 알고리즘이 기존 catalog 계약과 충돌하면 원문 추종 전에 intended behavior와 표준·Preview를 확인한다.
- API·저장 schema·DOM 구조 확장이 필요하면 영향 범위를 공개하고 해당 기능 작업에 포함한다. renderer 내부 수정으로 숨기지 않는다.
- 부분 렌더링이 정확하지 않으면 그 기능의 fallback을 유지하고 원인을 해결한다.
- performance gate가 미달하면 정확도 완료와 성능 미완료를 분리한다.
- reference code에 의존하는 외부 라이브러리·빌드 설정 변경은 구체 대상과 필요성을 확인한 뒤 별도 처리한다.
- ADR이 필요한 구조 결정은 이 계획을 근거로 작성할 수 있으나, 본 문서는 새 ADR 생성·승격 또는 구현 승인을 대신하지 않는다.

---

# Part D. 교차 검증 — Claude Code 분석 ↔ Codex 분석

## 19. 두 분석의 차이와 합치는 방법

Codex 문서는 **절차** (P0 ~ P15 · gate · ledger 형식) 이고 Claude Code 두 문서는 **판정** (확인된 격차 · 같음 · 순서) 이다. 서로 대체하지 않는다.

### 19-1. Codex 분석이 더 나은 점 (Part A · B 에 반영함)

| 항목                                                                                                                    | 반영                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chromium · composition revision 고정 (`33688427…` · `45026d1d8`)                                                        | 머리말에 같은 SHA. 페인트 원본은 §5-2 규약 2 를 쓰면서 정작 본문이 `main` 이었다                                                                                                                                                                  |
| "샘플링 정책은 버전 · backend 의존 — 그대로 구현 지시로 쓰지 않는다"                                                    | **맞는 지적**. S2 (§2-2) 를 고정 SHA 의 사슬 (`GetDefaultInterpolationQuality` → `ComputeInterpolationQuality` → `FilterQualityToSkSamplingOptions`) 로 다시 썼다 — 일괄 linear + mip 이 아니라 같은 크기 · 8px 이하 · 단축 3× · 2.5 % 는 nearest |
| "box-shadow blur 와 filter drop-shadow 입력 의미 구분, 같은 상수 일괄 적용 금지"                                        | S1 (§2-1) 과 같은 결론 (box · text × 0.5, drop-shadow 변환 없음)                                                                                                                                                                                  |
| under-invalidation 의 정확한 파일 (`paint_under_invalidation_checker.cc` · `raster_invalidator.cc` · `geometry_mapper`) | S8 출처를 그 경로로                                                                                                                                                                                                                               |
| 세 비교축 (최적화 Canvas ↔ fresh Canvas · Canvas ↔ DOM · 구현 ↔ 표준/WPT) 과 "번역 fixture 통과 ≠ 원본 WPT 통과"        | §17-1 을 따른다. §5-3 에 인용                                                                                                                                                                                                                     |
| 기능 ledger 11 필드 · 상태 어휘 (`unverified / planned / implemented-unverified / verified / unsupported / deferred`)   | S9 "속성 → 소비자 표" 의 구체 형식으로 채택 (§18-1)                                                                                                                                                                                               |
| P10 "실제 paint bounds (그림자 · filter · overflow 자식) 를 계산해 damage 에 쓴다"                                      | Part A 는 "unsafe → full 수렴" (ADR-263 HC4) 까지만 적었다. 한 단계 나아간 제안 — 다만 측정이 먼저                                                                                                                                                |
| 9 단계 이식 절차 (§14) · 이식 방식 5 종 (§14-1)                                                                         | Part A · B 의 "한 격차 = 한 커밋" 이 이 절차의 4 ~ 9 단계를 줄인 것. 절차는 §14 를 따른다                                                                                                                                                         |

### 19-2. Codex 분석에서 빠졌거나 어긋난 것

| 항목                                                                                                                                                         | 판정                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **확인된 결함 · 격차가 없다** — 전부 P0 "조사" 로 미룬다                                                                                                     | Part A · B 가 이미 소스 · Blink 로 확정한 것 (sigma `/2.355` · `drawImageRect` nearest · `font-variant-numeric` 미소비 · 레이아웃 배선 회귀 2 · 알고리즘 격차 36) 을 P0 manifest 의 **초기 행** 으로 넣어야 P0 가 같은 조사를 반복하지 않는다. Codex 는 레이아웃 분석을 보지 못했다 (뒤에 작성)  |
| **이미 있는 인프라를 새로 만들겠다고 적음** — P1 "독립 fresh build 대조군 · 캐시 우회 · 단계별 replay", P10 · P11 "paint bounds · 컬링 · 부분 재그리기"      | `__composition_RENDER_PATH_DEBUG__` · live 스크립트 2 · G3 하니스 · ADR-156 차등 oracle · ADR-189 damage · spatial index 컬링 · ADR-246 ratchet 이 전부 있다 (P1 통합 주석). ADR-263 ~ 265 가 **종결** 한 영역을 P10 · P11 이 다시 연다 — 남은 꼬리는 §3 의 셋이지 컬링 · 부분 재그리기가 아니다 |
| **범위가 D3 대칭보다 넓다** — §13-1 "아직 저작할 수 없는 HTML 요소 · CSS 값도 지원표에 둔다", P4 table · list · float · multicol, P3 video · iframe · canvas | 이 저장소의 대칭은 "Preview 가 실제로 내보내는 값" 이다 (ssot-hierarchy D3). Codex 도 `planned / unsupported` 로 분리하긴 하지만 P4 · P7 에 작업으로 배정했다 — **사용자가 승인한 scope 의 확장** 이라 결정 지점 ④. §4 는 생성 CSS 0 건인 축을 "무해" 로 뒀다                                    |
| **P12 가 hover · pressed · transition · animation 을 Canvas 범위에 넣음**                                                                                    | Canvas 는 저작 surface 라 상호작용 상태 · 시간 축은 Preview 소속. P12 는 범위 재판정 뒤에만                                                                                                                                                                                                      |
| **P2 cascade · custom property · layer · specificity 를 구현 대상처럼 서술**                                                                                 | production 은 resolve 된 catalog 만 소비, cascade 표는 dormant (X11 · X12). P2 는 "값 해석 · 단위 · 논리 속성" 으로 좁혀야 Codex 자신의 원칙과도 맞다                                                                                                                                            |
| **P0 기준선 재수집** (`flat/nested 600 · 5k`)                                                                                                                | `.agent/runs/2026-10-15-canvas-rust-baseline/` · ADR-263 ~ 265 breakdown 이 보유 — 인용                                                                                                                                                                                                          |
| 레이아웃 축의 함수 단위 대조가 없음 (P4 · P6 이 "조사 · 반영" 한 줄)                                                                                         | Part B 의 36 격차 · 같음 확인 · 낡은 헤더 6 곳 (§0-4) 이 P4 · P5 · P6 의 입력                                                                                                                                                                                                                    |
| `.agents/README.md` · `pnpm run codex:typecheck` 인용                                                                                                        | 둘 다 존재 — 문제 없음                                                                                                                                                                                                                                                                           |

### 19-3. 합치는 방법

1. Codex P0 manifest 의 초기 행 = §0-2 표 + §4 격차 + §6 ~ §9 격차 (상태는 `implemented-unverified` 가 아니라 격차가 확정된 행임을 나타내는 값 — 어휘는 P0 에서 정한다).
2. P1 은 "만든다" 가 아니라 "있는 oracle 을 feature ID 로 묶는다" + S8.
3. P10 · P11 은 ADR-263 ~ 265 종결 기록을 Context 로 두고 남은 꼬리만.
4. 범위 (table · float · multicol · 대체 콘텐츠 · 상태 · 애니메이션) 는 사용자 결정 뒤에 P4 · P8 · P12 에 넣는다.
5. 실행 순서는 §0-2 를 따른다 — Codex 의 `P0 → P1 → … → P14` 직렬 흐름 대신 확정 격차부터 (Codex 도 "P7 의 독립적인 기존 속성 수리는 먼저 완료할 수 있다" 고 허용).

---

## 20. 참조

- **Chromium (Part A)**: `docs/how_cc_works.md` · `third_party/blink/renderer/core/paint/README.md` · `core/paint/box_painter_base.cc` · `core/paint/box_border_painter.cc` · `core/paint/outline_painter.cc` · `core/paint/text_decoration_info.cc` · `core/paint/image_painter.cc` · `core/style/shadow_data.h` · `core/style/computed_style.cc` · `platform/graphics/graphics_context.cc` · `platform/graphics/graphics_context_types.cc` · `platform/fonts/font_platform_data.cc` · `core/css/css_properties.json5` · `cc/paint/paint_flags.cc` · `cc/paint/paint_op_buffer.h` · `cc/tiles/tile_manager.h`
- **Blink layout (Part B)**: `core/layout/block_layout_algorithm.cc` · `geometry/margin_strut.cc` · `inline/inline_box_state.cc` · `inline/inline_layout_algorithm.cc` · `inline/line_breaker.cc` · `logical_box_fragment.cc` · `flex/flex_layout_algorithm.cc` · `flex/line_flexer.cc` · `flex/flex_line_breaker.cc` · `grid/grid_track_sizing_algorithm.cc` · `grid/grid_layout_algorithm.cc` · `grid/grid_placement.cc` · `grid/grid_line_resolver.cc` · `grid/grid_track_collection.cc` · `grid/grid_layout_utils.cc` · `length_utils.cc` · `min_max_sizes.h` · `absolute_utils.cc` · `relative_utils.cc` · `out_of_flow_layout_part.cc` · `layout_box_model_object.cc` · `core/css/style_adjuster.cc` · `core/html/resources/html.css` · `platform/fonts/simple_font_data.cc`
- **Chromium 고정 소스 링크 (Part C)**: [Repository snapshot][chromium] · [Blink core paint][core-paint] · [Paint artifact·property tree·invalidation][platform-paint] · [LayoutNG inline][inline] · [BoxPainterBase][box-painter] · [BoxBorderPainter][border-painter] · [ShadowData][shadow] · [GeometryMapper][geometry] · [RasterInvalidator][invalidation] · [PaintUnderInvalidationChecker][under-invalidation] · [cc paint][cc-paint] · [GPU image decode cache][image-cache] · [cc 동작 설명][cc-how] · [Blink web tests][web-tests]
- **명세**: css-backgrounds-3 §"Blurring Shadow Edges" (σ = blur radius / 2) · filter-effects-1 `drop-shadow()` (셋째 값 = standard deviation) · [CSS 2.1][css2] · [CSS Snapshot 2025][css-snapshot] · [HTML Living Standard][html] · [CanvasKit 공식 문서][canvaskit]
- **composition**: ADR-153 · 156 · 164 · 189 · 204 · 206 · 223 · 224 · 246 · 256 · 257 · [263](../../adr/completed/263-render-command-patch-execute-cost.md) · [264](../../adr/completed/264-moved-subtree-translate-page-grid-rebind.md) · [265](../../adr/completed/265-document-layer-edit-select-cost.md) · 916 · 923 · `.claude/rules/layout-engine.md` · `layout-css-parity-ledger.md` · [PENCIL_RENDERING_OPTIMIZATION.md](PENCIL_RENDERING_OPTIMIZATION.md) · [CANVAS_RUST_DECISION_2026-10.md](CANVAS_RUST_DECISION_2026-10.md)
- **메모리**: `project-render-frame-decomposition-flush-vs-js` · `project-canvas-rust-baseline-2026-10` · `project-blink-layout-delta-2026-10` · `feedback-skia-only-channel-divergence-family-2026-09` · `feedback-cjk-line-break-space-split-premise-three-layers` · `feedback-inline-line-box-inflation-missing-leaf-baseline`

[chromium]: https://github.com/chromium/chromium/tree/33688427bc1a316cecb28d5651ad25208ba9ab53
[core-paint]: https://github.com/chromium/chromium/blob/33688427bc1a316cecb28d5651ad25208ba9ab53/third_party/blink/renderer/core/paint/README.md
[platform-paint]: https://github.com/chromium/chromium/blob/33688427bc1a316cecb28d5651ad25208ba9ab53/third_party/blink/renderer/platform/graphics/paint/README.md
[inline]: https://github.com/chromium/chromium/blob/33688427bc1a316cecb28d5651ad25208ba9ab53/third_party/blink/renderer/core/layout/inline/README.md
[box-painter]: https://github.com/chromium/chromium/blob/33688427bc1a316cecb28d5651ad25208ba9ab53/third_party/blink/renderer/core/paint/box_painter_base.cc
[border-painter]: https://github.com/chromium/chromium/blob/33688427bc1a316cecb28d5651ad25208ba9ab53/third_party/blink/renderer/core/paint/box_border_painter.cc
[shadow]: https://github.com/chromium/chromium/blob/33688427bc1a316cecb28d5651ad25208ba9ab53/third_party/blink/renderer/core/style/shadow_data.h
[geometry]: https://github.com/chromium/chromium/blob/33688427bc1a316cecb28d5651ad25208ba9ab53/third_party/blink/renderer/platform/graphics/paint/geometry_mapper.h
[invalidation]: https://github.com/chromium/chromium/blob/33688427bc1a316cecb28d5651ad25208ba9ab53/third_party/blink/renderer/platform/graphics/paint/raster_invalidator.cc
[under-invalidation]: https://github.com/chromium/chromium/blob/33688427bc1a316cecb28d5651ad25208ba9ab53/third_party/blink/renderer/platform/graphics/paint/paint_under_invalidation_checker.cc
[cc-paint]: https://github.com/chromium/chromium/blob/33688427bc1a316cecb28d5651ad25208ba9ab53/cc/paint/README.md
[image-cache]: https://github.com/chromium/chromium/blob/33688427bc1a316cecb28d5651ad25208ba9ab53/cc/tiles/gpu_image_decode_cache.h
[cc-how]: https://github.com/chromium/chromium/blob/33688427bc1a316cecb28d5651ad25208ba9ab53/docs/how_cc_works.md
[web-tests]: https://github.com/chromium/chromium/tree/33688427bc1a316cecb28d5651ad25208ba9ab53/third_party/blink/web_tests
[css2]: https://www.w3.org/TR/CSS2/
[css-snapshot]: https://www.w3.org/TR/css-2025/
[html]: https://html.spec.whatwg.org/multipage/
[canvaskit]: https://skia.org/docs/user/modules/canvaskit/
