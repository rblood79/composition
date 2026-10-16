# Chromium (cc · Blink paint) 대조 — composition Canvas (Skia wasm) 에 도입할 것 · 안 할 것

> **작성일**: 2026-10-16
> **목적**: Builder Canvas (CanvasKit wasm, `apps/builder/src/builder/workspace/canvas/skia/`) 의 **정확도 (Preview DOM 과의 시각 대칭)** 와 **최적화** 를 위해 Chromium 렌더링 스택의 어느 구조 · 알고리즘을 가져올지 판정한다.
> **방법**: ① Chromium `docs/how_cc_works.md` · `third_party/blink/renderer/core/paint/README.md` · `core/paint/box_painter_base.cc` · `core/paint/box_border_painter.cc` · `core/style/shadow_data.h` · `platform/fonts/font_platform_data.cc` 를 읽고 composition 의 현재 구현 (SkiaRenderer · renderCommands · nodePictureCache · subtreeCommandPatch · subtreeTranslate · nodeRendererBorders · nodeRendererText · effects · imageCache · styleConverter) 및 2026-07 ~ 10 측정 기록 (ADR-153 · 189 · 263 · 264 · 265, 메모리 `project-canvas-rust-baseline-2026-10` · `project-render-frame-decomposition-flush-vs-js`) 과 대조 (§1 ~ §3). ② HTML DOM · CSS2 · CSS3 의 화면 표시 기능을 **수요측** (생성 CSS 약 190 속성 · Styles 패널 약 60 속성) ↔ **공급측** (Canvas 변환기 · Skia 렌더러 · Rust 엔진 `NodeStyle`) 으로 전수 대조 (§4). ③ 격차마다 Blink 의 정답지 파일과 CanvasKit 대응을 적은 포팅 지도 (§5).
> **3-domain**: 전부 D3 (시각 스타일) 의 Builder consumer 내부. D1 · D2 · catalog 무변경. 대칭의 범위는 Chromium 이 구현한 전체 CSS 가 아니라 **Preview 가 실제로 내보내는 것** 이다.
> **방법의 한계**: 참조 파일 수 grep 은 상한 지표다 (메모리 `feedback-infra-exists-vs-wired-consumption-path`). "확정" 은 소비 경로 · Blink 소스까지 확인한 것, "확인 필요" 는 grep 0 또는 이름 충돌로 판정을 보류한 것.

---

## 결론 우선

Chromium 의 구조 대부분은 composition 이 **이미 같은 모양으로 갖고 있다** (display list ≈ render command stream · display item 캐시 ≈ node picture 캐시 · raster invalidation ≈ damage 경로 · 카메라 blit ≈ stale tile 재사용 · interest rect ≈ viewport 크기 content surface · bbox 컬링 ≈ spatial index). 가져올 가치가 있는 것은 **구조가 아니라 알고리즘 · 상수 · 속성 소비 표** 쪽이고, 측정된 성능 꼬리에 닿는 구조는 하나 (property node 분리) 뿐이다. 그리고 Preview 가 Chrome 에서 돌기 때문에 **Blink paint 코드는 명세보다 정확한 정답지** 다 — paint 는 Blink 알고리즘을 옮기고, 레이아웃은 Blink 코드 대신 Chromium 의 WPT reftest 와 Chrome 런타임 oracle 을 쓴다 (§5).

### 도입 항목 (순위)

| 순위 | 항목                                                                                                                         | 축        | 상태                    | Chromium 정답지                                                        | 한 줄 근거                                                                                                                                                 |
| ---- | ---------------------------------------------------------------------------------------------------------------------------- | --------- | ----------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | 그림자 blur → sigma 를 **radius × 0.5** 로 (box-shadow · text-shadow), `drop-shadow()` 는 변환 없음                          | 정확도    | 확정 결함               | `core/style/shadow_data.h` `BlurRadiusToStdDev`                        | `styleConverter.ts` 3 곳이 `/ 2.355` — Chrome 보다 그림자가 15 % 선명. 한 줄 수정 + cross-check                                                            |
| 2    | 이미지 샘플링 **linear + mipmap**                                                                                            | 정확도    | 확정 결함               | `platform/graphics/image.cc` (`kMedium`) · `cc::GpuImageDecodeCache`   | `nodeRendererImage.ts:176` `drawImageRect` 가 sampling 인자 없음 = nearest. 줌아웃 · 축소 이미지가 Preview 와 다르게 깨진다                                |
| 3    | `font-variant-numeric` 키 소비 (`tnum` 등)                                                                                   | 정확도    | 확정 결함               | `platform/fonts/font_description.cc` (feature 표)                      | `cssResolver.ts` 는 `fontVariant` 만 OpenType feature 로 변환. DateInput `tabular-nums` 가 Canvas 에서 떨어져 자릿수 폭이 다르다                           |
| 4    | 합성 italic · bold — `setSkewX(-0.25)` · `setEmbolden`                                                                       | 정확도    | 확인 필요               | `platform/fonts/font_platform_data.cc` `CreateSkFont`                  | Pretendard 는 italic face 가 없다. Chrome 은 합성, CanvasKit 은 face 매칭만 → upright 로 떨어질 수 있음. Select placeholder 로 1 회 대조                   |
| 5    | **BoxBorderPainter** 알고리즘 — `double · groove · ridge · inset · outset` · 변 색이 다른 모서리 miter · dash 간격 보정      | 정확도    | 격차                    | `core/paint/box_border_painter.cc` (BSD)                               | composition 은 solid · dashed · dotted 만. catalog 가 내보내는 borderStyle 분포를 센 뒤 쓰이는 것만 옮긴다                                                 |
| 6    | `outline-style` · CSS Transforms 2 개별 속성 (`rotate · scale · translate`) · `text-decoration-thickness / underline-offset` | 정확도    | 격차 (상태 선택자 위주) | `core/paint/outline_painter.cc` · `core/paint/text_decoration_info.cc` | 생성 CSS 에 있으나 거의 `:focus-visible` · `[data-pressed]` 등 상태 안이라 정적 대칭 영향은 작음. 작은 수정                                                |
| 7    | **Property node 분리** — 명령 스트림이 좌표 대신 transform · clip · scroll 노드 id 를 참조                                   | 최적화    | 설계 필요               | `cc` property trees · Blink `PaintPropertyTreeBuilder` · `PaintChunk`  | 측정된 꼬리 (ADR-264/265: 옮겨진 상자 수만큼 `subtreeTranslate` · clip 복제 · rect diff) 가 "명령에 좌표가 구워져 있어서" 다. 새 ADR + Phase 0 카운트 필수 |
| 8    | **under-invalidation checking** 을 dev 상시 assertion 으로                                                                   | 검증      | 기계 있음               | Blink `PaintController` under-invalidation checking                    | `__composition_RENDER_PATH_DEBUG__` `forceFull` oracle 을 damage 프레임마다 픽셀 비교하는 플래그로. 7 의 안전망                                            |
| 9    | 속성 → 소비자 표 static test                                                                                                 | 재발 차단 | 설계 필요               | `core/css/css_properties.json5`                                        | 1 · 3 · 6 이 전부 "생성 CSS 가 내보내는데 Canvas 소비 표에 없는 속성" 이다. `archetypeDefaultCohort.static.test.ts` 와 같은 ratchet 형식                   |
| 10   | Canvas 를 **Worker (OffscreenCanvas)** 로 — cc 의 main ↔ compositor 분리                                                     | 최적화    | 장기 · 보류             | `cc` 스레드 모델 (`ProxyMain` / `ProxyImpl`)                           | 선택 끊김 (HC3) 의 원인이 React · RAC Layers 행 렌더라 Canvas 를 옮겨도 그 비용은 그대로. 트리거가 카운트로 성립할 때 별도 ADR                             |
| —    | 타일 래스터 캐시 (`PictureLayerTiling` · `TileManager`)                                                                      | 최적화    | 보류                    | `cc/tiles`                                                             | ADR-263 재개 조건 ("A 뒤에도 flush · 래스터가 상위") 미성립 · content surface 가 이미 viewport 크기라 메모리 이득도 작음                                   |
| —    | PaintOpBuffer 연속 바이트 버퍼 · OOP raster · `cc::Scheduler` deadline · LCD text · viz · GPU raster provider                | —         | 해당 없음               | `cc/paint` · `cc/scheduler` · `viz`                                    | 단일 스레드 wasm · WebGL surface 에 대응물이 없다. `executeCommandRange` 는 ADR-263 G5 에서 프로필 상위를 벗어났다                                         |

### 엔진 · 레이아웃 격차 (Blink 코드가 아니라 테스트로 닫는다)

| #   | 격차                                                                              | 사용자 가시 결과                                                      | 크기 | 닫는 수단                                                                        |
| --- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------- |
| G4  | 인라인 텍스트 run 혼합 없음 (`block.rs` slot 18 "S4 예약")                        | 한 문단 안에 굵기 · 색이 다른 span 이 있으면 줄바꿈이 Preview 와 다름 | 큼   | catalog 가 rich inline 을 실제로 내보내는지 먼저 센다 (`Text[slot]` 은 단일 run) |
| G5  | CSS table layout 없음 — RAC Table 은 `<table>` DOM, 엔진은 열 트랙 근사 (ADR-257) | 긴 셀 내용에서 auto 열 폭 분배가 다름                                 | 큼   | 재현 케이스가 나올 때 ADR-257 범위에서. WPT `css-tables` 를 oracle 로            |

---

## 1. 구조 대응표 — "이미 있는 것"

| Chromium                                                                          | composition 대응                                                                                            | 판정                                                                                                   |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `cc::DisplayItemList` / `PaintRecord` (플랫 op 목록)                              | `renderCommands.ts` 플랫 command stream (`CMD_ELEMENT_BEGIN … END`)                                         | 동형. ADR-263 이 Proxy piece-table 비용 · 선형 skip 을 제거                                            |
| Blink `PaintController` display item 캐시 (client identity 로 재사용)             | `nodePictureCache.ts` — `SkiaNodeData` identity + size 키, 위치 제외 (ADR-153 P3)                           | 동형. Blink 는 push 식 invalidation flag, composition 은 identity 교체 — 효과 같음                     |
| Blink subsequence caching (`SubsequenceRecorder`)                                 | drag 중 `dragSubtreeCache`                                                                                  | 부분 동형. 상시 서브트리 picture 는 ADR-263 대안 B 로 기각 (편집 1회 = 층 전체 재기록)                 |
| raster invalidation (`RasterInvalidator`) + `DamageTracker`                       | ADR-189 damage 경로 (`pendingDamage` · `executeDamageRenderCommands`), ADR-263 에서 catalog scene 에 재연결 | 동형. clean · damage · full 3 상태, 실패는 full 수렴 (HC4)                                             |
| 카메라 변경 시 기존 tile scale 표시 → idle 재래스터                               | `SkiaRenderer` camera-only blit (`drawImageCubic`) + 정착 뒤 content 재렌더 (Pencil 모델)                   | 동형                                                                                                   |
| `PictureLayerTiling` interest rect                                                | content surface = viewport + `contentPaddingDevicePx` (`createContentSizedSurface`)                         | 동형 (타일 분할만 없음)                                                                                |
| `SkRTreeFactory` picture 재생 bbox 컬링                                           | Rust `spatial_index` `queryRect` 로 가시 후보 + 조상 closure 만 실행                                        | 동형 (명령 생성 전에 컬링하므로 더 세밀)                                                               |
| `cc::Scheduler` BeginFrame · deadline · latency mode                              | `frameScheduler.ts` dirty + rAF                                                                             | 단일 스레드라 성립하지 않음                                                                            |
| `GpuImageDecodeCache` (scale 별 decode · mip · GPU 상주)                          | `imageCache.ts` `MakeImageFromEncoded` 원본 해상도 1 개 · sampling 미지정                                   | **격차** → §2-2                                                                                        |
| `BoxBorderPainter` · `BoxPainterBase::PaintNormalBoxShadow / PaintInsetBoxShadow` | `nodeRendererBorders.ts` `renderBoxShadows` · `renderInnerBoxShadows`                                       | inset 구성 (EvenOdd donut + blur + 상자 clip) 은 Blink 와 같은 방식. **sigma 와 border style 만 격차** |
| property trees (transform · clip · effect · scroll 을 draw 목록에서 분리)         | 명령에 좌표 · clip · scroll 문맥이 구워짐 — 옮김은 `subtreeTranslate` 재기록, 문맥 변경은 patch 거부        | **격차** — 측정된 꼬리와 일치 → §3-1                                                                   |

---

## 2. 정확도 축 — 도입 항목 상세

### 2-1. 그림자 sigma (확정 결함)

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
- **filter: drop-shadow()**: filter-effects-1 은 셋째 값을 **standard deviation 자체** 로 정의한다. 변환 없이 σ = 값. 현재는 2.355 배 선명하다. 구현 전 Blink `core/paint/filter_effect_builder.cc` 의 `kDropShadow` 분기로 1 회 확인.
- **영향**: `box-shadow: 0 4px 12px` 에서 Canvas σ 5.1 / Preview σ 6. G3 하니스가 상자 가장자리 대역만 비교해 지금까지 잡히지 않았을 수 있다.
- **수정**: box-shadow · text-shadow → `radius * 0.5` · drop-shadow() → 변환 없음. `/cross-check` 그림자 있는 Card · Popover 1 회.

### 2-2. 이미지 샘플링 · 축소 디코드 (확정 결함)

- **Chromium**: `GpuImageDecodeCache` 가 그릴 scale 에 맞춰 decode 하고 mip 을 만든다. `<img>` 기본 `image-rendering: auto` = linear + mipmap. bicubic 이 아니다.
- **composition** `nodeRendererImage.ts:176` `canvas.drawImageRect(skImage, src, dst, paint)` — 이 오버로드는 `SkSamplingOptions()` 기본값 = **nearest**. 줌아웃 · 상자보다 큰 원본은 계단 · 반짝임.
- **수정**: `drawImageRectOptions(img, src, dst, FilterMode.Linear, MipmapMode.Linear, paint)` + 로드 시 `image.makeCopyWithDefaultMipmaps()` (원본 `delete`). `image-rendering: pixelated` 는 nearest 유지. `drawImageRectCubic` 은 Chrome 과 다르므로 쓰지 않는다.
- **메모리**: mip +33 %. 큰 원본은 Chromium 처럼 **표시 크기 × dpr × 2 상한으로 decode** (`createImageBitmap(blob, { resizeWidth, resizeQuality: "high" })` → `MakeImageFromCanvasImageSource`) 가 다음 단계 — ADR-153 이미지 캐시 상한과 같은 자리.

### 2-3. `font-variant-numeric` (확정 결함)

- `cssResolver.ts` 는 `fontVariant` 키만 OpenType feature (`tabular-nums → tnum` 등, `cascade.rs` 에도 같은 표) 로 바꾼다. CSS 속성 `fontVariantNumeric` · `fontVariantCaps` · `fontFeatureSettings` 는 참조 0.
- 생성 CSS `DateInput.css` 가 `font-variant-numeric: tabular-nums` 를 내보낸다 → Preview 는 고정폭 숫자, Canvas 는 비례폭 → 자릿수마다 폭 차이.
- **수정**: 세 키를 같은 feature 표로 흡수. 측정은 small-caps 와 같은 수법 — Canvas2D `ctx.fontVariantNumeric` 로 DOM 과 같은 폭 (메모리 `feedback-cjk-line-break-space-split-premise-three-layers` 의 small-caps 절). `scripts/generate-text-axis-matrix.mjs` 로 ADR-205 격차표 재생성 (`textAxisGate.static` 검사).

### 2-4. 합성 italic · bold (확인 필요)

- **Chromium** `platform/fonts/font_platform_data.cc` `CreateSkFont`:

  ```cpp
  font.setEmbolden(synthetic_bold_);
  font.setSkewX(synthetic_italic_ ? -SK_Scalar1 / 4 : 0);
  ```

  합성 조건은 `font_description.cc` (요청 weight ≥ 600 인데 bold face 없음 · italic 요청인데 italic face 없음).

- **composition** `nodeRendererText.ts` 는 `FontSlant.Italic` 을 TextStyle 로 넘길 뿐이다. Pretendard 는 italic face 가 없어 CanvasKit FontMgr 가 upright 를 돌려주면 그대로 upright. SkParagraph TextStyle 에는 skew 가 없다.
- **판정 방법**: Select placeholder (`font-style`) 또는 Styles 패널 `fontStyle: italic` 1 회 Compare Mode. 결함이면 italic 요청 + face 부재를 감지해 글리프 run 을 `canvas.skew(-0.25, 0)` 로 그리거나 paragraph 밖 `Font.setSkewX` 경로로 폴백.

### 2-5. BoxBorderPainter 알고리즘 (격차)

- **Chromium** `core/paint/box_border_painter.cc` (BSD): 변 4 개를 `ComplexBorderInfo` 가 alpha → style 우선순위 → side 순으로 정렬하고 같은 alpha 끼리 `OpacityGroup` 으로 묶는다. `DrawDoubleBoxSide` 는 두께 `(t + 1) / 3` 로 바깥 · 안쪽 띠, `DrawRidgeOrGrooveBoxSide` 는 반분해 inset/outset 교대, `CalculateInsetOutsetColor` 는 상대 휘도로 어둡게 · 밝게 (`kBaseDarkColorLuminance 0.0144` · `kBaseLightColorLuminance 0.8308` · `kMinimumBorderEdgeContrastRatio 1.75`). 모서리는 `ComputeMiter` 가 `kNoMiter / kSoftMiter (색 다름) / kHardMiter (double · groove · ridge · dash 불일치)` 를 고르고 hard miter 면 polygon clip. dashed · dotted 는 중심선 stroke 에 `path_length % 4 · % 6` 보정으로 양끝에 dash · dot 이 오게 하고 (`EnforceDotsAtEndpoints`), 굵은 dotted 는 zero-length dash + round cap. uniform solid 는 `FillDRRect` 한 번.
- **composition** `nodeRendererBorders.ts`: `strokeStyle: "solid" | "dashed" | "dotted"`. 변별 stroke (`renderSidedStroke`) 는 있으나 모서리 miter · 두 톤 style 이 없다. `cssDashPattern` 이 변 길이에 dash 를 맞추는지 확인 필요.
- **판정**: `COMPONENT_RULES_TABLE` 의 `borderStyle` 값 분포를 먼저 센다. 쓰이지 않는 style 은 옮기지 않는다. 변별 색이 다른 rule (Tabs indicator · Table 머리 경계) 이 있으면 모서리 1 px 대각선 차이가 난다 — G3 `approvedDifferences` 에 그런 항목이 있는지 보고 결정.

### 2-6. 상태 선택자 위주의 작은 격차

| 격차                                                           | 출처 (생성 CSS)                                                        | Canvas 상태                                        | 수정                                                                                                                                            |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `outline-style` 미소비                                         | `outline` 119 · `outline-offset` 108 (거의 `:focus-visible`)           | width · color · offset · radius 따라감, 항상 solid | `outline_painter.cc` 분기 (`auto` focus ring 2 px 이중 링 · 음수 offset) — 상태라 우선순위 낮음                                                 |
| CSS Transforms 2 개별 속성 `rotate:` · `scale:` · `translate:` | Disclosure chevron · `[data-pressed] scale: 0.97` · ListBox check 위치 | `parseTransform` 은 `transform` 함수만 파싱        | `convertToTransform` 이 세 속성을 합성 (순서: translate → rotate → scale → transform)                                                           |
| `text-decoration-thickness` · `text-underline-offset`          | Link `[data-hovered]` 1.5px                                            | `decorationThickness: 1` (폰트 값 배수)            | `text_decoration_info.cc` — `auto` → 폰트 `underlineThickness` (없으면 `font-size / 10`), 위치 `underlinePosition` + offset. 배수로 환산해 넘김 |

### 2-7. 이미 Chromium 과 같은 방식 (수정 불요)

- inset shadow: Blink inner path clip + hole EvenOdd + bounds 3σ ↔ composition `renderInnerBoxShadows` EvenOdd donut + `MakeBlur` + 상자 clip. sigma 만 2-1.
- spread · corner radius: `renderBoxShadows` 의 `max(0, r + spread)` = Blink `ApplySpreadToShadowShape`.
- 줄바꿈: Blink 는 ICU UAX #14, composition 은 Canvas2D `measureWithCanvas2D` (Intl.Segmenter · CJK · 금칙 · keep-all · small-caps 합성) 로 **브라우저 자신을 oracle 로** 쓴다 — Blink 재구현보다 정확하다.

---

## 3. 최적화 축 — 측정된 꼬리와 대조

production 꼬리 (ADR-263 ~ 265 종결 기록, 2026-10-16):

| 시나리오       | p99 (ms) | 원인 (카운트로 확정)                                                                                   |
| -------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| 중첩 5k 편집   | 24 ~ 26  | Canvas binding 의 옮김 상수 비용 — 옮겨진 상자마다 `subtreeTranslate` · overflow clip 복제 · rect diff |
| 평평 5k 줌     | 27 ~ 28  | 줌이 page grid 자동 열 수를 바꿔 `syncAutoColumns` → `scene.refresh()` 전체 재바인드                   |
| 평평 5k select | ~29      | React · RAC Layers 행 렌더 (Canvas 밖)                                                                 |

### 3-1. Property node 분리 (유일하게 꼬리에 닿는 구조)

- **Chromium 의 통찰** (`how_cc_works.md` §property trees · Blink `PaintChunk`): 그리기 목록은 **로컬 좌표** 로 한 번 기록하고 transform · clip · scroll · effect 는 **별도 노드 트리** 에 둔다. chunk 는 노드 id 만 가리킨다. 스크롤 · 이동 · clip 변경은 노드 값 갱신이고 목록은 손대지 않는다. 비용이 "바뀐 노드 수" 에 비례한다.
- **composition**: `ELEMENT_BEGIN` 에 절대 좌표가 구워지고 (`retainedParagraph.ts` 주석 — "좌표가 ELEMENT_BEGIN 에서 이미 translate 됐기 때문"), 옮김은 `subtreeTranslate` 가 서브트리 명령을 다시 쓰고, clip · scroll 문맥이 바뀌면 patch 를 거부 (`clip-context-changed` · `scroll-context-changed`). node picture 캐시는 이미 **노드-로컬 기록 + replay 시 translate** 라 절반은 와 있다.
- **설계 스케치** (ADR 대상): `ELEMENT_BEGIN` 이 `(x, y)` 대신 `transformNodeId` 를 들고 실행기가 노드 테이블에서 `(x, y, scroll offset, clip rect)` 를 읽는다. 레이아웃 이동 = 노드 테이블 갱신 + damage = 이전 ∪ 이후 bounds, 명령 재기록 0. overflow clip 도 `clipNodeId` — 스크롤 = offset 갱신 (ADR-263 #4 `catalogScrollRange` DFS 도 사라진다). patch 거부 사유 중 앞 둘은 노드 갱신으로 흡수.
- **Phase 0 카운트** (measurement-validity §5): `subtreeTranslate` 호출 수 · patch 교체 명령 수를 결정적 카운트로 잡고 중첩 5k 편집에서 RED 고정. wall-clock 은 방향만.
- **위험**: 기술 MEDIUM (실행기 · patcher · damage 가 같은 노드 테이블을 읽어야 한다 — 불일치면 stale pixel) / 유지보수 MEDIUM / 마이그레이션 MEDIUM. ADR-263 대안 B · C · D 와 다른 축이라 그 기각 사유가 적용되지 않는다.

### 3-2. under-invalidation checking (작은 비용)

Blink 는 dev 빌드에서 "캐시 없이 다시 그린 결과" 와 "캐시 결과" 를 비교해 무효화 누락을 즉시 잡는다. composition 은 같은 oracle 을 live 스크립트 (`adr263-render-path-live.mjs`) 로만 돌린다. `__composition_RENDER_PATH_DEBUG__` 에 `checkUnderInvalidation` 을 더해 damage 프레임마다 standby surface 에 full 을 그리고 damage rect 안 픽셀을 비교 → 불일치면 `console.error` + 카운터. perf 하니스 `--check-invalidation` 으로 ratchet A 에 0 등록. 3-1 의 안전망.

### 3-3. 보류 · 해당 없음

- **타일 래스터**: ADR-263 재개 조건 ("A 뒤에도 flush · 래스터가 상위") 미성립. content surface 가 이미 viewport 크기. 2026-07 줌 flush 56 % 는 `makeImageSnapshot` CoW 였고 ping-pong 으로 처리됐다.
- **Worker + OffscreenCanvas**: select 꼬리가 React 라 Canvas 를 옮겨도 그 비용은 그대로. 얻는 것은 "패널이 느릴 때 Canvas 가 같이 끊기지 않음". 문서 동기화 · hit-test · 텍스트 편집 overlay 가 전부 경계를 넘는다. 트리거 = "Canvas 프레임 drop 의 원인이 Canvas 밖 main-thread 작업" 이 카운트로 확인될 때.
- **PaintOpBuffer 바이트 버퍼**: `executeCommandRange` 가 프로필 상위에서 빠졌다 (ADR-263 G5). Rust trigger ("그리기 명령 > 8 ms/frame") 와 같은 조건으로만.
- **`cc::Scheduler` · LCD text · raster scale 휴리스틱 · viz · OOP raster**: 대응물 없음. macOS Chrome 은 grayscale AA 라 글자는 이미 같다.

---

## 4. HTML DOM · CSS2 · CSS3 화면 표시 기능 — 수요 ↔ 공급 전수 대조

수요측 = 생성 CSS `packages/shared/src/components/styles/generated/*.css` 속성 분포 (괄호는 선언 수) + Styles 패널 `panels/styles/sections/styleSectionProps.ts`. 공급측 = Canvas 변환기 · Skia 렌더러 · 엔진 `NodeStyle` · 모듈 헤더 미구현 선언.

### 4-1. 레이아웃 (CSS2 visual formatting · CSS3 box · flex · grid)

| 영역                          | 구현                                                                                                                             | 격차 (Chrome 있음 · 엔진 없음)                                                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| block (CSS 2.1 §8 · §9 · §10) | 세로 쌓임 · margin collapse (through-collapse · BFC 차단) · inline-block line box · `vertical-align` 4 종 · leafBaseline · strut | **float / clear** · **writing-mode** · BFC 내부 다단 · **순수 inline text run 혼합** (G4) · list-item marker (`li` 1 건 · list-style none 이라 무해) |
| flex (CSS-FLEXBOX-1)          | 단일 · 다중 라인 · grow/shrink · align-content · align-self · justify-self · order · aspect-ratio                                | `flex-basis: content` intrinsic 자동 측정 (content_main 폴백). 헤더의 "aspect-ratio · align-self 미구현" 은 stale (필드 존재)                        |
| grid (CSS-GRID-1)             | track sizing · repeat/minmax/areas/span · auto-flow · auto-columns/rows                                                          | subgrid · 명시 track 의 `min-content / max-content` (0 폴백) · dense 역채움 · baseline · `fit-content()`                                             |
| position · overflow           | static / relative / absolute / fixed / sticky · overflow x/y · 스크롤바 (`renderScrollbar`) · scroll offset                      | `overflow: clip` · `overflow-clip-margin` · `scrollbar-*` (생성 CSS 0 — 무해)                                                                        |
| 논리 속성                     | `cascade.rs` 가 `marginInlineEnd → marginRight` 등 물리로 변환 (LTR 고정)                                                        | RTL 반전 없음. `border-start-start-radius` · `border-block` (ListBox 1 건) 은 변환 표에 없음 → 확인 필요                                             |
| 표 · 다단                     | —                                                                                                                                | **CSS table layout 없음** (G5) · multicol 없음                                                                                                       |
| 생성 content                  | —                                                                                                                                | `::before / ::after` 없음 — 생성 CSS 의 `content:` 30 건은 전부 `justify-content` 오탐. 실제 `content:` 2 건 → 확인 필요                             |

### 4-2. 페인트 (CSS3 backgrounds · borders · effects · transforms · masking)

| 속성 (선언 수)                              | Canvas 상태                                                                                | 판정                                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `background` (592) · gradient · 다중 레이어 | color · image · linear/radial/conic/mesh · size/position/repeat · `nodeRendererFillLayers` | 구현. `background-clip / origin / attachment / blend-mode` 참조 0 — 생성 CSS 도 0 (무해)                                       |
| `border-*` (78 + 150 + 52 · radius 503)     | 변별 width/color · radius 4 모서리 · solid/dashed/dotted · 안쪽 radius (`borderGeometry`)  | **격차** §2-5                                                                                                                  |
| `box-shadow` (23)                           | 다중 · inset · spread · corner radius 규칙                                                 | **격차** §2-1                                                                                                                  |
| `outline` (119) · `outline-offset` (108)    | width · color · offset · radius (`nodeRendererBorders.ts:756`)                             | **격차** `outline-style` §2-6                                                                                                  |
| `opacity` (112) · `mix-blend-mode`          | saveLayer alpha · `toSkiaBlendMode`                                                        | 구현. `isolation` 참조 0 (생성 CSS 0)                                                                                          |
| `filter` · `backdrop-filter`                | blur · drop-shadow · color-matrix 계열 · backdrop blur                                     | drop-shadow sigma §2-1                                                                                                         |
| `transform` (3) · `transform-origin`        | 2D translate/rotate/scale/skew/matrix + origin                                             | **격차** 개별 속성 §2-6. 3D · perspective 없음 (생성 CSS 0)                                                                    |
| `clip-path` · `mask`                        | basic shape · path · `maskImage`                                                           | 구현. ListBox `mask: url(svg)` 는 iconPath 로 그릴 것 → 확인 필요. 반지름 키워드 산식은 `clip_path_clipper.cc` 와 fixture 1 회 |
| `aspect-ratio` (4) · `object-fit`           | 엔진 `aspect_ratio`                                                                        | `object-fit / object-position / image-rendering` 참조 0 → Image 축소 규칙 확인 필요 (+ §2-2)                                   |
| `visibility` · `z-index` · stacking context | `visible` · `zIndex` · `isStackingContext`                                                 | 구현. 생성 조건 표를 `computed_style.cc` `IsStackingContext` 와 1:1 대조 권장                                                  |
| `border-image`                              | —                                                                                          | 없음 (생성 CSS 0 — 무해)                                                                                                       |

### 4-3. 텍스트 (CSS Text · Fonts · Text Decoration)

| 속성                                                                                          | Canvas 상태                                                               | 판정                                                  |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------- |
| font-family / size / weight / stretch · variable axes                                         | `fontStyle: {weight, slant, width}` + `fontVariations(wght)` push         | 구현                                                  |
| `font-style: italic`                                                                          | `FontSlant.Italic` 전달                                                   | **확인 필요** §2-4                                    |
| line-height · letter/word-spacing · text-align (+justify)                                     | `heightMultiplier + halfLeading` · strut · alignOffset                    | 구현                                                  |
| `text-decoration` (5) line · style · color                                                    | underline/overline/line-through · solid/double/dotted/dashed/wavy · color | thickness · underline-offset §2-6                     |
| `text-transform` · `text-indent` · `white-space` · `word-break` · `overflow-wrap` · `hyphens` | `applyTextTransform` · Canvas2D 측정 파이프라인                           | 구현                                                  |
| `text-overflow: ellipsis`                                                                     | `maxLines: 1 + ellipsis`                                                  | 1 줄만. `-webkit-line-clamp` 없음 (생성 CSS 0 — 무해) |
| `font-variant-numeric` (DateInput 1)                                                          | 참조 0                                                                    | **격차** §2-3                                         |
| `text-shadow`                                                                                 | `TextShadow[]` + blur                                                     | sigma §2-1                                            |
| `-webkit-text-fill-color` (1) · `caret-color` · `::placeholder` · `::selection`               | caret · selection 은 편집 overlay 영역                                    | text-fill-color 는 출처 파일 0 → 무해                 |
| writing-mode · text-orientation · `tab-size` · `text-align-last`                              | —                                                                         | 없음 (생성 CSS 0 — 무해)                              |

### 4-4. HTML 요소 · 상태

- catalog 태그 17 종 (`div` 80 · `span` 5 · `section` 4 · `button` 4 · `p` 3 · `output` 3 · `nav` 3 · `kbd` 2 · `li` · `label` · `input` · `hr` · `header` · `form` · `code` · `body` · `a`) + `img` (Image) + svg 아이콘 (`iconPath`). RAC 가 unstyled 라 **native form appearance** (checkbox · radio · select · range · date · color) 재현이 필요 없다.
- 해당 없음 (catalog 에 없음): `video` · `iframe` · `canvas` · `embed` · `ul/ol` marker · `details/summary` native marker · `dialog` backdrop.
- **상태**: `CatalogStates.css` (hover · pressed · focus-visible · disabled · selected · placeholder) 중 Canvas 는 정적 기본 상태 + 문서가 든 상태 (selected · disabled · isPending 등) 만 그린다. `:focus-visible outline` 119 · `transition` 35 · `animation` (ProgressBar indeterminate) 은 상호작용 결과라 정적 대칭 범위 밖 — Preview 로 확인.
- 비시각 속성 (`cursor` 113 · `pointer-events` 103 · `user-select` · `touch-action` · `will-change` · `contain` · `forced-color-adjust` 109) 은 Canvas 소비 대상이 아니다 (ADR-223 "Canvas 저작 surface 에 대응 없는 DOM interaction").

---

## 5. Blink 코드를 정답지로 쓰는 포팅 지도

Preview 는 Chrome 에서 돈다. 따라서 Canvas 의 목표 픽셀은 명세가 아니라 **Blink 가 그리는 것** 이고, Blink 도 `cc::PaintCanvas` 로 Skia op 를 내보내므로 paint 알고리즘은 CanvasKit 호출로 거의 1:1 로 옮겨진다. 레이아웃은 그렇지 않다 (§5-3).

### 5-1. 격차 → Blink 파일 → CanvasKit 대응

| 격차                          | Blink 정답지 (`third_party/blink/renderer/`)                                                                            | 옮길 것                                                                                                                                                                                                             | CanvasKit 대응 · 주의                                                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 그림자 sigma (§2-1)           | `core/style/shadow_data.h` · `core/paint/box_painter_base.cc`                                                           | `radius × 0.5` · outer 는 상자 clip-out 뒤 spread RRect fill · inset 은 inner clip + hole EvenOdd + bounds `3σ`                                                                                                     | Blink `DrawLooperBuilder` 는 CanvasKit 에 없음 → `ImageFilter.MakeDropShadowOnly` 또는 `MaskFilter.MakeBlur(Normal, σ)`. 구조는 이미 같음 (§2-7) |
| border style · 모서리 (§2-5)  | `core/paint/box_border_painter.cc` (BSD)                                                                                | `ComplexBorderInfo` 정렬 · `DrawDoubleBoxSide (t+1)/3` · `DrawRidgeOrGrooveBoxSide` · `CalculateInsetOutsetColor` 상수 3 · `ComputeMiter` · dash `% 4 · % 6` 보정 · `EnforceDotsAtEndpoints` · uniform `FillDRRect` | `drawDRRect` 있음. miter clip 은 `clipPath(polygon)`. dash 는 `PathEffect.MakeDash` + 보정 간격                                                  |
| outline-style (§2-6)          | `core/paint/outline_painter.cc`                                                                                         | style 분기 · `auto` focus ring · 음수 offset                                                                                                                                                                        | 지금 `drawRRect` 하나 → 분기 추가                                                                                                                |
| decoration 두께 · 위치 (§2-6) | `core/paint/text_decoration_info.cc` · `decoration_line_painter.cc`                                                     | `auto` → `underlineThickness` (없으면 `font-size / 10`) · `from-font` · `underlinePosition` + offset · wavy `ComputeWavyPattern`                                                                                    | SkParagraph `decorationThickness` 는 배수 → 환산. wavy 를 같게 하려면 직접 path                                                                  |
| 합성 italic · bold (§2-4)     | `platform/fonts/font_platform_data.cc` `CreateSkFont` (LGPL) · `font_description.cc`                                    | `setSkewX(-0.25)` · `setEmbolden(true)` · 합성 조건                                                                                                                                                                 | SkParagraph TextStyle 에 skew 없음 → run 을 `canvas.skew` 로 그리거나 paragraph 밖 `Font.setSkewX` 폴백                                          |
| 이미지 · object-fit (§2-2)    | `core/paint/image_painter.cc` · `core/layout/layout_replaced.cc` `ComputeObjectFit` · `platform/graphics/image.cc`      | object-fit 5 종 · object-position 산식 · 축소 시 linear + mip · `pixelated` → nearest                                                                                                                               | `drawImageRectOptions(Linear, Linear)` · `makeCopyWithDefaultMipmaps`. cubic 금지                                                                |
| background 기하               | `core/paint/background_image_geometry.cc` · `box_background_paint_context.cc`                                           | `background-size` contain/cover · position 퍼센트 · `repeat: space / round` · clip/origin 상자                                                                                                                      | space · round · clip/origin 만 없음 — 생성 CSS 0 이라 보류                                                                                       |
| clip-path                     | `core/paint/clip_path_clipper.cc` · `core/style/basic_shapes.cc`                                                        | `inset(round)` · `circle / ellipse` 의 `closest-side / farthest-side` · polygon fill-rule · `path()` · reference box                                                                                                | `parseClipPath` 와 fixture 1 회 대조                                                                                                             |
| 그림 순서                     | `core/paint/paint_layer_paint_order_iterator.cc` · `paint_phase.h` · `core/style/computed_style.cc` `IsStackingContext` | CSS 2.1 Appendix E 순서 · stacking context 생성 조건 (`position: relative` + z-index · `opacity < 1` · `transform` · `filter` · `isolation` …)                                                                      | `isStackingContext` 판정 표와 1:1 대조                                                                                                           |

### 5-2. 포팅 규약 (D2 `d2Provenance.ts` 와 같은 꼴)

1. **코드가 아니라 알고리즘 · 상수를 옮긴다.** `core/paint/*` 는 BSD-3 라 인용 가능하지만 `platform/fonts/*` · `core/style/shadow_data.h` 는 **LGPL** — 본문 복사 금지, 상수 (`-0.25` · `(t+1)/3` · luminance 3 개) 와 분기 구조만 재구현.
2. **출처 표** `apps/builder/src/builder/workspace/canvas/skia/blinkProvenance.ts` 에 `{ feature, blinkPath, revision, portedAt, divergence }`. revision 은 Chromium commit hash 로 고정 — Blink 는 바뀐다 (2026 에 `border_shape_painter.cc` · `gap_decorations_painter.cc` 신설). 사용자 Chrome 버전 (`navigator.userAgentData`) 의 release branch 를 쓴다.
3. **판정은 Chrome 픽셀** — 통과 기준은 Blink 코드가 아니라 G3 하니스 (Canvas ↔ Preview 스크린샷). 코드를 옮기는 것은 맞출 확률을 올리는 수단이고 증명은 픽셀이다 (measurement-validity §2 #3 — 코드끼리 서로 확인하는 oracle 금지).
4. **한 격차 = 한 커밋 = cross-check 1 회.** catalog 가 내보내지 않는 Blink 분기 (`border-shape` · gap decorations) 는 옮기지 않는다 — D3 대칭은 쓰이는 값의 동일성이다.

### 5-3. 옮기지 못하는 것 — 레이아웃은 코드가 아니라 테스트를 가져온다

- **LayoutNG** (`core/layout/`) 는 `LayoutObject` · `ComputedStyle` · `ConstraintSpace` · `NGFragment` 에 묶여 함수 단위 포팅이 안 된다. inline formatting (G4 — `inline/inline_layout_algorithm.cc` · `line_breaker.cc`) 과 table (G5 — `table/table_layout_algorithm.cc`) 은 수천 줄 + HarfBuzz · ICU.
- 대신 **Chromium 이 가진 테스트를 Rust 엔진의 oracle 로 쓴다**: `third_party/blink/web_tests/external/wpt/css/CSS2/` · `css-flexbox/` · `css-grid/` · `css-inline/` · `css-tables/` reftest 를 ADR-156 차등 oracle (실 Chrome `getBoundingClientRect`) 의 fixture 로. 엔진 헤더의 "미구현 — dual-run FAIL 이 fixture" 가 이미 이 모양이다.
- 레이아웃 축의 함수 단위 대조 결과 (격차 36 · 같음 확인 · 닫는 순서) 는 [BLINK_LAYOUT_DELTA_2026-10.md](BLINK_LAYOUT_DELTA_2026-10.md).
- 줄바꿈 · `font-variant-numeric` 폭은 지금처럼 **Chrome 자신을 런타임 oracle** 로 (Canvas2D `measureWithCanvas2D` · `ctx.fontVariantNumeric`) — `line_breaker.cc` 를 옮기는 것보다 정확하고 싸다.

---

## 6. 착수 순서

| 순서 | 작업                                                                              | 크기        | 검증                                                               |
| ---- | --------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------ |
| 1    | §2-1 sigma 수정 (3 곳)                                                            | 한 커밋     | `/cross-check` Card · Popover 그림자. CHANGELOG (사용자-가시 버그) |
| 2    | §2-2 이미지 샘플링 linear + mip                                                   | 한 커밋     | 줌아웃 이미지 상자 cross-check. `getImageCacheSize` 로 mip 메모리  |
| 3    | §2-3 `font-variant-numeric` 키 소비                                               | 한 커밋     | DateInput Compare Mode. textAxisGate 재생성                        |
| 4    | §2-4 합성 italic 1 회 대조 → 결함이면 skew -0.25                                  | 작음        | Select placeholder Compare Mode                                    |
| 5    | §2-5 · §2-6 — borderStyle 분포 · outline-style · 개별 transform · decoration 두께 | 작음 ~ 중간 | 쓰이는 값만. G3 `approvedDifferences` 대조                         |
| 6    | 속성 → 소비자 표 static test (결론 표 9)                                          | 작음        | "생성 CSS 가 내보내는데 Canvas 표에 없는 속성" 0 을 ratchet        |
| 7    | §3-2 under-invalidation dev 플래그                                                | 작음        | perf 하니스 `--check-invalidation` ratchet A 0                     |
| 8    | §3-1 property node 분리 — 새 ADR (`/create-adr` 는 사용자 전용)                   | 큼          | Context 는 ADR-264/265 종결 카운트 인용. Phase 0 카운트 RED        |
| 9    | 타일 · Worker                                                                     | —           | 각각의 재개 조건이 카운트로 성립할 때                              |

## 7. 참조

- Chromium: `docs/how_cc_works.md` · `third_party/blink/renderer/core/paint/README.md` · `core/paint/box_painter_base.cc` · `core/paint/box_border_painter.cc` · `core/paint/outline_painter.cc` · `core/paint/text_decoration_info.cc` · `core/paint/image_painter.cc` · `core/style/shadow_data.h` · `platform/fonts/font_platform_data.cc` · `core/css/css_properties.json5` · `cc/paint/paint_op_buffer.h` · `cc/tiles/tile_manager.h`
- 명세: css-backgrounds-3 §"Blurring Shadow Edges" (σ = blur radius / 2) · filter-effects-1 `drop-shadow()` (셋째 값 = standard deviation)
- composition: ADR-153 · 189 · 223 · 257 · 263 · 264 · 265, [PENCIL_RENDERING_OPTIMIZATION.md](PENCIL_RENDERING_OPTIMIZATION.md), 메모리 `project-render-frame-decomposition-flush-vs-js` · `project-canvas-rust-baseline-2026-10` · `feedback-skia-only-channel-divergence-family-2026-09` · `feedback-cjk-line-break-space-split-premise-three-layers`
