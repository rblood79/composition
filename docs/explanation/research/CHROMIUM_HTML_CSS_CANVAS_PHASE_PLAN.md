# Chromium 구현 참조·이식 기반 HTML·CSS Canvas 지원 Phase Plan

> 작성일: 2026-10-16  
> 상태: 계획 작성 완료 · 구현 및 Phase gate 미착수  
> Composition 조사 기준: `45026d1d84bdeceb61b5df7ef3f09ed0ac5e5693`  
> Chromium 참조 기준: `33688427bc1a316cecb28d5651ad25208ba9ab53`  
> 목적: HTML의 화면 표현과 CSS2·CSS3 계열 기능을 CanvasKit/Skia에서 정확하게 구현하고, 검증된 표현 의미를 보존하면서 증분 렌더링 비용을 줄인다.

## 1. 목표와 구현 원칙

이 계획의 작업 단위는 **속성·값·요소·상태별 Chromium 구현 대조 → 필요한 알고리즘과 테스트 이식 → Composition 소비 경로 연결 → 정합성 검증**이다. 새로운 렌더링 구조를 먼저 만드는 방식으로 진행하지 않는다.

1. Chromium의 함수 본문뿐 아니라 입력 값의 의미, 호출부, 적용 순서, 인접 테스트를 함께 확인한다.
2. 독립적인 계산과 페인트 알고리즘은 TypeScript 또는 Rust로 이식한다. Blink의 DOM·GC·스타일 객체에 묶인 구현은 동작 계약과 테스트를 추출하여 기존 엔진에 반영한다.
3. CanvasKit이 이미 제공하는 기능은 활용한다. 동일한 Skia 기능을 별도 WASM 모듈로 중복 구현하지 않는다.
4. `CatalogGraph`는 문서 정본이다. 새 paint metadata·property state·index·cache는 파생 상태이며 저장 문서에 섞지 않는다.
5. 시각 값의 정본은 catalog + theme/tokens다. Canvas와 DOM Preview는 대등한 소비자다. DOM·접근성·폼 동작의 기존 React Aria 계약은 유지한다.
6. Chromium 소스는 구현 참고이자 비교 대상이다. 웹 표준보다 우선하는 규격으로 취급하지 않는다. Chromium 특유의 동작·버그·플래그 의존성은 별도로 기록한다.
7. 구현이 존재하거나 단위 테스트가 통과했다는 이유만으로 지원 완료를 선언하지 않는다. 실제 저작·변경·Preview·저장/재열기 경로를 확인한다.

관련 분석: [Chromium cc·Blink paint 대조](CHROMIUM_CC_BLINK_PAINT_DELTA_2026-10.md). 해당 문서의 결함·격차 판정은 구현 착수 시 현재 코드와 실제 화면에서 재검증한다. 샘플링 정책이나 폰트 합성 경로처럼 버전·backend에 의존하는 결론을 그대로 구현 지시로 사용하지 않는다.

## 2. HTML·CSS 지원 범위

### 2.1 범위 정의

- **HTML 지원:** 요소·콘텐츠·기본 표시 의미를 catalog와 DOM 소비자에 대응시키고 Canvas에서 같은 화면을 만든다. Canvas 픽셀로 DOM 접근성, 브라우저 탐색, 스크립트 실행을 대체한다는 뜻이 아니다.
- **CSS2 지원:** 화면용 cascade·상속·box model·normal flow·inline·positioning·float·table·list·텍스트·페인트를 기능별로 조사하고 구현한다.
- **CSS3 지원:** 하나의 고정된 규격 집합으로 취급하지 않는다. CSS Snapshot과 각 모듈의 버전·기능·값을 지원표에 고정한다. Flexbox, Grid, Fonts, Text, Backgrounds, Transforms, Masking, Filter Effects 등 서로 다른 모듈을 별도 판정한다.
- **기존 기능 정합:** 현재 catalog·Styles 패널·generated CSS·상태 스타일·import 경로가 실제로 내보내는 기능은 우선 수리 대상이다.
- **지원 확장:** 아직 저작할 수 없는 HTML 요소나 CSS 값도 지원표에서 제거하지 않는다. schema·authoring·DOM·Canvas 확장을 포함한 후속 작업으로 배정한다. 완료 전에는 `planned` 또는 `unsupported`로 표시한다.
- **별도 제품 범위:** 임의 웹페이지 URL 복제, 완전한 HTML parser/JS 실행 환경, 브라우저 전체 재구현은 이 계획의 자동 전제가 아니다. 임의 stylesheet·HTML import가 필요하면 P0에서 그 진입 경로를 명시하고 P2·P3에 추가한다.

### 2.2 기능군과 담당 Phase

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

### 2.3 지원 상태와 완료 표현

지원표의 상태는 `unverified`, `planned`, `implemented-unverified`, `verified`, `unsupported`, `deferred`로 구분한다. `unsupported/deferred`에는 이유·대체 표현·담당 후속 Phase를 적는다. `partial` 한 단어 대신 미지원 값과 조합을 개별 행으로 분리한다.

| 기능 ID                  | 요소/속성/값                        | 표준 모듈             | 저작·저장 | resolve/layout | Canvas | Preview | 상태·반응형 | Chromium 함수·테스트 | 판정·근거  |
| ------------------------ | ----------------------------------- | --------------------- | --------- | -------------- | ------ | ------- | ----------- | -------------------- | ---------- |
| 예: paint.shadow.outer   | box-shadow / blur·spread·offset     | Backgrounds & Borders | 조사      | 조사           | 조사   | 조사    | 조사        | P0에서 고정          | unverified |
| 예: layout.width.percent | width / %                           | Sizing·CSS2           | 조사      | 조사           | 조사   | 조사    | 조사        | P0에서 고정          | unverified |
| 예: text.numeric.tabular | font-variant-numeric / tabular-nums | Fonts                 | 조사      | 조사           | 조사   | 조사    | 조사        | P0에서 고정          | unverified |

지원률을 보고할 때는 분모가 되는 feature manifest 버전을 함께 적는다. 미구현 항목을 분모에서 빼서 완료율을 올리지 않는다. 이 계획 문서만으로 HTML/CSS 전체 지원을 선언하지 않는다.

## 3. 속성별 참조·이식 절차

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

### 이식 방식

| 방식             | 적용 조건                                | 예시                                   |
| ---------------- | ---------------------------------------- | -------------------------------------- |
| 직접 번역 이식   | 의존성이 작은 수식·기하 알고리즘         | shadow 입력 해석, border corner 분할   |
| 계약 기반 재구현 | Blink 내부 객체 의존성이 큼              | containing block, inline fragment 처리 |
| 기존 API 연결    | CanvasKit/엔진이 필요한 동작을 이미 제공 | sampling 옵션, shape/paragraph 기능    |
| 테스트 이식      | 구현 구조가 달라도 출력 의미를 비교 가능 | flex/grid sizing, bidi·line breaking   |
| 명시적 대체·보류 | 공개 API나 현재 제품 모델로 구현 불가    | native popup, 외부 iframe 내부 paint   |

코드를 복사·번역하거나 테스트를 재사용할 때 파일별 license와 third-party 의존성을 확인하고 필요한 copyright·notice·출처를 보존한다. Chromium 저장소 전체를 단일 라이선스로 간주하지 않는다. vendor 복사 대신 알고리즘을 재구현하더라도 출처와 설계 차이는 추적 가능하게 남긴다.

## 4. 참조 지도와 Composition 수정 경계

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

## 5. 전체 Phase와 의존 관계

기존 계획 번호를 재정렬했다. 이 문서의 Phase 번호를 이후 실행 기준으로 사용한다. 표의 모든 Phase는 현재 미착수다.

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

## 6. Phase별 작업과 완료 조건

### P0 — 지원 manifest·참조 버전·production 기준선

**목적:** 전체 범위를 속성명보다 작은 값·상태·조합 단위로 고정한다.

- [ ] catalog typed fields·bindings·generated CSS·Styles 패널·상태 선택자·import 경로에서 실제 입력을 수집한다.
- [ ] §2의 HTML·CSS2·CSS 모듈군과 대조하여 현재 노출되지 않은 기능도 manifest에 기록한다.
- [ ] Chromium 함수·테스트·spec 절·필요 CanvasKit API·현재 consumer를 source ledger에 기록한다.
- [ ] 기존 조사 문서의 shadow·image sampling·font feature·border·decoration 후보를 최소 fixture로 재현한다.
- [ ] Chromium 소스 SHA와 비교 브라우저 버전을 별도로 기록한다. 서로 다른 revision의 결과를 동일 구현으로 가정하지 않는다.
- [ ] flat/nested 600·5k, 필요 시 10k 문서의 edit/drag/zoom/scroll/select 기준선을 수집한다.
- [ ] 문서 처리·layout·binding·record·raster/flush·React/RAC 패널 비용을 구분한다.
- [ ] 비교 fixture·측정 횟수·노이즈 판정·성능 목표를 구현 전에 고정한다.

**산출물:** feature manifest, source ledger, 최소 재현 모음, 환경·commit·dirty diff를 포함한 baseline.

**G0:** manifest의 모든 행에 상태와 담당 Phase가 있다. 성능 기대치는 실측·가설을 구분한다. ADR-265 종결 기록을 현재 측정으로 대체하지 않는다.

### P1 — 독립 검증 기반과 이식 테스트 하니스

**목적:** 최적화의 오류와 CSS 의미의 오류를 별도로 검출한다.

- [ ] 같은 문서·resource generation에서 catalog/layout/binding/command를 fresh build하는 대조군을 만든다.
- [ ] picture·surface 캐시, spatial 후보 제한, 실행기 AABB 컬링을 각각 우회할 수 있게 한다.
- [ ] 실제 production 경로와 독립 대조군의 geometry·command metadata·paint pixels를 비교한다.
- [ ] DOM Preview의 computed style·rect·line metrics·screenshot을 feature ID와 함께 기록한다.
- [ ] WPT 원본 중 직접 실행한 사례와 catalog fixture로 번역한 사례를 구분한다. 번역본 통과를 원본 WPT 통과라고 부르지 않는다.
- [ ] animation 시간·font/image readiness·DPR·zoom을 고정한다.
- [ ] stale cache, 누락 invalidation, 잘못된 bounds를 주입한 negative test가 실패하는지 확인한다.
- [ ] 인터셉트·단계별 replay 개념을 사용해 최초로 달라지는 draw 단위를 찾을 수 있게 한다.

**G1:** 알려진 오류를 검출하고 재현 artifact를 남긴다. 같은 backend의 결정적 대조는 픽셀 동치를 목표로 하며 DOM 비교는 geometry·text·AA·색 공간 차이를 분리한다. 전체 화면에 넓은 tolerance를 적용해 의미 오류를 숨기지 않는다.

### P2 — CSS 값 해석·상속·상태 입력 계약

**참조:** Blink `core/css`, `core/style`, 값 변환의 실제 호출부.

- [ ] authored → resolved/computed → used value 단계와 각 값의 소유자를 정의한다.
- [ ] shorthand/longhand, initial/inherited values, global keywords, custom property fallback·cycle·invalid value 처리를 조사·구현한다.
- [ ] 단위·percentage basis·calc/min/max/clamp·currentColor·색 함수의 전달을 확인한다.
- [ ] logical/physical 속성, direction/writing-mode에 따른 매핑을 정리한다.
- [ ] catalog rule·instance override·theme·state·breakpoint의 우선순위를 Canvas/DOM에서 대조한다.
- [ ] CSS selector·cascade layer·specificity가 필요한 authoring/import 경로는 범위와 resolver를 명시한다. 이미 resolve된 catalog만 소비하는 경로에 별도 CSS 엔진을 중복 삽입하지 않는다.
- [ ] 지원 값 추가 시 schema·validation·serialization·CSS generator·Canvas binding을 함께 연결한다.

**G2:** 선택한 속성 값이 양쪽 consumer에 같은 의미로 도달한다. 미지원 값은 조용히 기본값으로 사라지지 않고 manifest에 기록된다. 이 단계에서 arbitrary CSS 전체 파싱을 구현했다고 선언하지 않는다.

### P3 — HTML 요소·기본 표시·콘텐츠 모델

**참조:** Blink `core/html`, UA style 자료, 요소별 layout/paint 경로와 HTML 테스트.

- [ ] block/inline·heading/paragraph·pre/code·link·line break·semantic wrapper의 catalog 대응표를 만든다.
- [ ] 익명 text box·anonymous wrapper·generated content를 authored node와 구분하는 파생 모델을 정한다.
- [ ] 목록 marker/counter, table section/row/cell, form label/value/placeholder의 소유권을 명시한다.
- [ ] hidden, disabled, readonly, checked, indeterminate 등 HTML/RAC 상태의 표시 의미를 연결한다.
- [ ] 기본 UA style과 catalog가 의도적으로 덮는 시각 값을 구분한다. 네이티브 브라우저 컨트롤의 외형을 catalog에 강제로 적용하지 않는다.
- [ ] image/SVG/video/canvas/iframe/object/embed는 직접 렌더·리소스 프레임·DOM 위임·미지원 중 전략을 기록한다. CORS·격리로 읽을 수 없는 콘텐츠를 읽을 수 있다고 가정하지 않는다.
- [ ] new element가 필요한 경우 component-design 계약에 따라 DOM/RAC·Props·catalog·Canvas·Preview를 함께 확장한다.

**G3:** 요소마다 정상·빈 콘텐츠·fallback·상태 전환 fixture가 있다. 접근성·포커스·입력은 기존 DOM/RAC 또는 편집 overlay 계약을 유지하고 Canvas 표현과 값이 일치한다.

### P4 — CSS2 box·normal flow·위치·표·목록 레이아웃

**참조:** Blink `core/layout`, table·block 관련 구현, CSS2/WPT layout tests.

- [ ] content/border box, margin/padding, min/max, auto·percentage·intrinsic size의 입력과 출력 계약을 정리한다.
- [ ] block·inline-block·BFC·margin collapse·float/clear·anonymous box의 필요한 알고리즘을 기존 Rust 엔진에 반영한다.
- [ ] relative/absolute/fixed/sticky, containing block, inset, scroll owner, overflow-x/y를 검증한다.
- [ ] list marker 위치, table auto/fixed sizing, colspan/rowspan, caption·cell alignment·border spacing을 검증한다.
- [ ] border-collapse conflict resolution의 기하·페인트 경계는 P7과 연결한다.
- [ ] writing-mode·logical axis·multicolumn/fragmentation 항목은 구현 묶음을 명시하고 미구현 상태를 숨기지 않는다.
- [ ] P5에서 확정한 inline line metrics·baseline·intrinsic 값으로 회귀를 재검증한다.

**G4:** 지원한 CSS2 layout fixture의 used geometry가 기준과 일치한다. full solve와 incremental solve가 동치이며 변경된 형제·조상·absolute descendant에 stale geometry가 없다. P5와 맞물린 inline 항목은 양쪽 gate 후 닫는다.

### P5 — 텍스트·폰트·Inline Layout·편집 통합

**참조:** LayoutNG inline, HarfBuzz shaping/fallback 호출부, text painter·decoration 관련 구현.

- [ ] 공백 정규화 → script/bidi segmentation → shaping/fallback → line breaking → line box 생성의 계약을 정한다.
- [ ] 측정과 페인트가 같은 font family·weight/style/stretch·variation·feature·synthesis 정책을 사용하게 한다.
- [ ] font-variant-numeric/caps, font-feature-settings, letter/word spacing, line-height, vertical-align, text-indent·alignment를 대조한다.
- [ ] white-space, word-break, overflow-wrap, hyphens·locale, ellipsis·line clamp의 지원 값과 조합을 확정한다.
- [ ] 현재 Canvas 2D break hint와 Paragraph 경로를 값별로 비교한 뒤 통합한다. hint를 일괄 삭제하거나 단순 폭 보정으로 통과시키지 않는다.
- [ ] min/max-content와 최종 폭 제약의 결과를 구분하되 같은 shaping 입력·CSS 정책을 공유한다.
- [ ] glyph/decoration/text-shadow의 실제 paint 영역을 확보하거나 보수적 unknown으로 표시한다.
- [ ] 편집 overlay의 baseline·줄바꿈 폭·origin·선택·IME를 새 계약에 연결한다.
- [ ] 측정용 Paragraph 객체의 전역 캐시를 도입하지 않는다. 렌더 Paragraph의 노드 소유·공유 FontCollection·지연 해제를 보존한다.

**G5:** 한글·영문·emoji·RTL 혼합, 긴 URL, variable font, font fallback, 좁은 폭, font loading 전후의 줄·baseline·geometry가 일치한다. 편집 시작/종료·Undo/Redo·저장/재열기에서 글자가 이동하거나 사라지지 않는다.

### P6 — Flexbox·Grid·Intrinsic Sizing

**참조:** Blink flex/grid 알고리즘과 인접 테스트, 해당 CSS 모듈의 WPT.

- [ ] flex basis·grow/shrink·auto min-size·wrap·reverse·order·auto margin·baseline·stretch를 값별로 대조한다.
- [ ] grid explicit/implicit tracks, auto placement, minmax/fr/repeat, gap, span, alignment와 intrinsic contribution을 검증한다.
- [ ] definite/indefinite size, percentage, aspect ratio, nested flex/grid에서의 used value를 검증한다.
- [ ] subgrid·auto-fit/auto-fill 등 추가 기능은 manifest에 독립 기능으로 두고 전체 지원 상태와 분리한다.
- [ ] Chromium 알고리즘에서 추출한 수식·조건을 기존 Rust 구조에 반영하고 regression fixture를 이식한다.
- [ ] 최종 layout을 사용하는 drag/drop·resize·span·overlay·hit 소비자도 검증한다.

**G6:** full/incremental engine 결과와 DOM geometry가 정합하다. Canvas 편집 도구의 placement/span 계약도 유지된다. layout 알고리즘을 바꿨다는 이유로 엔진 전체를 재작성하지 않는다.

### P7 — Background·Border·Outline·Shadow 속성별 이식

**참조:** `BoxPainterBase`, `BoxBorderPainter`, `OutlinePainter`, `ShadowData` 및 인접 테스트.

- [ ] 다중 background의 순서·repeat·size·position·origin·clip과 gradient 보간을 대조한다.
- [ ] border의 변별 색·폭·style, radius 정규화, corner 분할·AA, double/groove/ridge/inset/outset을 구현한다.
- [ ] outline style/offset·focus 상태와 table collapsed border의 충돌 규칙을 연결한다.
- [ ] outer/inset·다중 box-shadow와 text-shadow의 blur·spread·offset 의미를 원문과 비교한다.
- [ ] CSS shadow의 blur radius와 filter drop-shadow의 입력 의미를 구분한다. 같은 상수를 모든 blur 파서에 일괄 적용하지 않는다.
- [ ] Sizing·색 해석이 같은 입력을 사용하도록 converter와 painter의 중복 계산을 정리한다.
- [ ] 검증된 rendering 계산을 P10 bounds 계산에서 재사용할 수 있게 경계를 마련한다.

**G7:** 내부 fill뿐 아니라 외부 shadow·outline·corner·반투명 겹침을 포함한 픽셀 비교를 통과한다. DPR·fractional position·zoom·dark/light 상태를 포함한다.

### P8 — 이미지·SVG·대체 콘텐츠

**참조:** Blink image paint, Skia sampling 호출부, `cc/paint`, image decode cache.

- [ ] intrinsic dimensions·aspect-ratio·object-fit/position·src/dst clipping을 대조한다.
- [ ] image-rendering 값과 실제 Chromium/CanvasKit sampling 동작을 버전별로 확인한다. 모든 auto 이미지에 동일 mipmap 정책이 적용된다고 단정하지 않는다.
- [ ] alpha·orientation·색 프로필·sRGB/wide-gamut 정책을 명시한다.
- [ ] SVG path·fill/stroke·cap/join·viewBox·gradient·mask의 지원 범위를 기록하고 vector/raster 전략을 정한다.
- [ ] animated image·video·외부 canvas·iframe은 P3 전략에 맞춰 갱신·fallback·격리 계약을 구현한다.
- [ ] placeholder→loaded, 실패→재시도, source 교체에 따른 layout·paint·cache 갱신을 연결한다.

**G8:** 축소·확대·crop·투명 이미지·SVG fixture가 정합하다. 비동기 완료 후 사용자 편집 없이 갱신되며, 미지원 embedded content를 지원 완료로 표시하지 않는다. 해상도별 캐시 최적화는 P13에서 측정 후 수행한다.

### P9 — Stacking·Transform·Clip·Mask·Filter·합성

**참조:** Blink paint properties·paint order·effect 상태와 compositor 경계.

- [ ] z-index·stacking context·top layer·isolation을 문서 paint 순서에 맞춘다.
- [ ] transform/origin 및 개별 translate/rotate/scale의 결합 순서·좌표계를 정한다.
- [ ] perspective·preserve-3d·backface 등 3D 항목은 개별 지원 판정과 테스트를 둔다.
- [ ] clip-path·rounded overflow·mask-mode/composite·alpha/luminance 의미를 이식한다.
- [ ] 그룹 opacity·blend·filter·backdrop-filter의 합성 단위와 입력 의존성을 분리한다.
- [ ] filter input/output bounds, 배경 읽기 영역, mask 자원 참조를 기록할 경계를 만든다.
- [ ] 저장된 효과가 Preview에도 같은 의미로 도달하는지 확인한다.

**G9:** 겹치는 자식·반투명 그룹·배경 변경·노드 순서 변경·mask 로딩의 결과가 정합하다. CanvasKit API의 foreground filter와 backdrop filter를 같은 기능으로 취급하지 않는다. 안전한 부분 실행이 불가한 효과는 full/group fallback을 유지한다.

### P10 — 실제 Paint Bounds·효과 의존성 도입

**참조:** `GeometryMapper`, `RasterInvalidator`, effect property의 영역 변환.

- [ ] layout/hit/self paint/subtree paint bounds를 분리한다.
- [ ] bounds의 empty/known/unknown, invalidation의 clean/partial/full 상태를 정의한다.
- [ ] P5~P9의 실제 paint 의미로 primitive·text·effect 영역을 계산한다.
- [ ] transform·clip·effect 순서와 overflow 자식까지 포함한 subtree 영역을 집계한다.
- [ ] 변경 전·후 bounds와 effect 입력 의존성으로 damage를 구한다.
- [ ] 초기에는 기존 renderer 선택을 유지한 채 metadata를 계산·대조한다.
- [ ] bounds가 unknown이면 빈 영역으로 해석하지 않고 안전한 fallback 사유를 전파한다.

**G10:** 렌더 픽셀이 conservative bounds 밖으로 빠지지 않는다. 삭제·축소 뒤 조상 영역도 줄어들고, hit 영역은 그림자 때문에 확대되지 않는다. 최적화 활성화 이전에 metadata 동치가 확보된다.

### P11 — 갱신 경로·Paint Index·컬링·부분 재그리기

- [ ] full/subtree/self build, preview/commit patch, translateSubtree/placeRegion에 P10 metadata를 연결한다.
- [ ] 삭제·재정렬·page root 이동·theme/breakpoint·font/image·context restore·dispose 경로를 갱신한다.
- [ ] hit index와 독립된 paint index 및 ID mapping 수명을 정의한다. 기존 Rust index 인스턴스 재사용 가능성을 먼저 검토한다.
- [ ] viewport 후보 검색과 실행기 내부 AABB 컬링을 함께 수정한다.
- [ ] 후보의 조상 state·합성 그룹·effect 입력을 추가하고 원래 paint 순서를 보존한다.
- [ ] 새 명령·metadata·index가 같은 scene/resource/presentation 상태를 나타내게 한다.
- [ ] old/new paint bounds로 damage를 만들고 camera/DPR에 따라 surface 범위를 보수적으로 변환한다.
- [ ] pending full 우선순위·ping-pong 동기화·실패 시 full 복구·flush 후 자원 해제를 보존한다.
- [ ] 검증된 기능만 활성화해 장면 전체 unsafe fallback을 점진적으로 줄인다.

**G11:** 화면 밖 상자의 그림자, 부모 밖 자식, clip 경계 이동, 삭제·투명화·그림자 제거에서 잔상·누락이 없다. fresh build와 명령·metadata·index·pixel이 동치다. 실제 효과 포함 fixture에서 fallback·실행량 감소와 총비용을 함께 측정한다.

### P12 — 상태·반응형·Animation·Preview·저장 통합

- [ ] hover/pressed/focus-visible/selected/disabled/invalid 등 catalog·RAC 상태를 속성 소비표에 연결한다.
- [ ] pseudo-element·generated content·counter 등 채택 기능의 상태 변경과 소유권을 검증한다.
- [ ] breakpoint·media/container query·viewport·writing-mode 변경에서 재해석 범위를 확인한다.
- [ ] transition/animation의 보간 값·transform·effect·text 변화와 hit/overlay를 같은 표시 시점에 맞춘다.
- [ ] reduced-motion, font/image 완료, animation 중 삭제·Undo·page 전환을 확인한다.
- [ ] 편집 preview→commit→Reset→Undo/Redo→autosave→reload→Preview 복제본 경로를 검증한다.
- [ ] Preview iframe의 기존 origin 검증·postMessage 경로를 유지한다.

**G12:** 중간 프레임과 최종 프레임이 모두 정합하다. 저장 문서에는 파생 bounds/cache가 들어가지 않으며 재로드 후 같은 authored state로 같은 화면이 복원된다. 각 앞선 Phase의 기본 상태 검증을 이 단계까지 미루지 않는다.

### P13 — 측정 기반 Property 상태·자원 최적화

**정확도 gate를 유지한 상태에서 다음 두 묶음을 별도로 판정한다.**

#### P13-A: 이동·geometry 비용

- [ ] P11 이후 프로필에서 subtree translation·clip 복제·rect diff·index upsert의 비용을 재측정한다.
- [ ] 유의미한 비용이 남으면 page root 또는 큰 이동 그룹에 property-state 참조를 시험 적용한다.
- [ ] 로컬 bounds·누적 transform/clip 캐시·그룹 공간 검색을 연결한다.
- [ ] draw/hit/overlay가 동일 geometry를 쓰며 비용이 다음 프레임·pick 경로로 이동하지 않았는지 확인한다.

#### P13-B: 이미지·메모리 비용

- [ ] 이미지 표시 크기·DPR·zoom별 decode/upload 비용과 live-set을 측정한다.
- [ ] 필요할 때만 scale별 자원·visible 우선순위·동시 decode 제한을 적용한다.
- [ ] mip·추가 surface·picture·Paragraph를 포함한 메모리 비용과 eviction을 기록한다.
- [ ] 캐시 교체·page 왕복·context loss·장시간 편집에서 수명 오류를 검증한다.

**G13:** 각 최적화는 production A/B에서 사전 정의한 목표를 충족하고 정확도·메모리 gate를 유지한다. 비용이 작으면 해당 묶음은 근거를 남기고 보류한다. property 노드 하나를 갱신한다는 이유만으로 전체 동작이 O(1)이라고 주장하지 않는다.

### P14 — 전체 지원·회귀·성능 종결

- [ ] feature manifest의 모든 항목을 verified/unsupported/deferred 등 명시 상태로 정리한다.
- [ ] 기존 authoring이 실제 노출하는 기능의 누락을 우선 닫고, 확장 기능 미완료는 별도로 남긴다.
- [ ] Canvas↔DOM, optimized↔fresh, full layout↔incremental layout의 세 축을 재검증한다.
- [ ] 실제 Builder에서 추가·편집·preview drag·resize·scroll·zoom·텍스트 입력·Undo/Redo·저장/재열기를 확인한다.
- [ ] production 비교·메모리·초기 번들·카운트 ratchet를 판정한다.
- [ ] CHANGELOG·지원표·source ledger·이식 notice·검증 기록·향후 제한을 갱신한다.
- [ ] 적용 범위의 typecheck·tests·WASM build·format check·preflight를 완료한다.

**G14:** 정확도 완료, 성능 목표 달성, 미지원 범위를 각각 보고한다. 수치 목표 미달을 문서 상태 변경으로 통과 처리하지 않는다. 일부 기능만 완료한 경우 feature manifest 버전과 검증된 범위를 명시한다.

### P15 — 조건부 타일·Worker·Rust 확장

| 후보                           | 착수 조건                                          | 추가 검증                                                  |
| ------------------------------ | -------------------------------------------------- | ---------------------------------------------------------- |
| Tile raster cache              | viewport surface 이후에도 raster/flush가 주요 병목 | tile seam·scale 전환·GPU 메모리·효과 경계                  |
| OffscreenCanvas/Worker         | Canvas main-thread 작업이 입력 지연의 주요 원인    | 메시지 비용·atomic publish·input/overlay 지연·context 복구 |
| Rust geometry/command planning | 관련 계산·WASM 경계 비용이 production 상위         | JS↔Rust 동치·경계 직렬화·자원 소유·WASM 크기               |
| 명령 바이너리화                | 기록·해석·전송 비용의 독립적인 병목 확인           | command 검증·버전·디버깅·전송 안전성                       |

**G15:** 별도 실측과 제한된 prototype으로 go/no-go를 판정한다. P14의 필수 완료 조건이 아니며, 이 계획만으로 대규모 이전을 실행 승인한 것으로 해석하지 않는다.

## 7. 공통 검증 계약

### 7.1 세 개의 비교 기준

| 비교                              | 검출 대상                                      | 한계                                  |
| --------------------------------- | ---------------------------------------------- | ------------------------------------- |
| 최적화 Canvas ↔ 독립 fresh Canvas | cache·patch·bounds·culling·resource 오류       | 같은 CSS 알고리즘 오류는 공유 가능    |
| Canvas ↔ DOM Preview              | layout·텍스트·paint·합성 의미 차이             | backend·OS·font·AA 차이를 통제해야 함 |
| 구현 ↔ 표준·Chromium/WPT 사례     | 브라우저와 공통으로 잘못 구현한 의미·edge case | 번역 fixture는 원본 test와 구분 필요  |

픽셀 차이만 측정하지 않는다. computed/used value, geometry, line metrics, 선택·편집 결과를 함께 비교한다. backend별 tolerance는 baseline에서 분리·고정하며, 실패를 없애기 위해 사후에 넓히지 않는다.

### 7.2 필수 시나리오

- 기본값과 비기본값, 유효/무효 값, 단위·상속·Reset.
- standalone과 grouped/instance/slot 내부, 자식 있음/없음.
- light/dark·state·breakpoint·font loading 전후.
- DPR 1/2 및 fractional zoom·위치, viewport 가장자리.
- overflow 자식, 그림자만 보이는 요소, clip/transform/filter 조합.
- 그룹 opacity·blend 뒤 배경 변경, mask/image 완료.
- delete·reorder·reparent·Undo/Redo·save/reopen.
- pointer drag 중간 상태와 commit, 텍스트 편집·IME·focus.
- 평평한 문서와 nested flex/grid, 600·5k 및 근거가 필요한 10k.

### 7.3 성능·비용 판정

- 기준선과 수정본은 같은 환경·fixture·resource 상태에서 교대 비교한다.
- wall-clock profile과 결정적 call-count 계측을 별도 실행한다.
- p95/p99·dropped frames·long task 외에 layout/binding/record/flush 구간, 후보 수, 명령 수, index 갱신 수, cache miss, 메모리를 기록한다.
- 기존 중첩 5k 편집 목표 `p99 ≤ 20 ms`, `drop < 1%`는 해당 scenario가 동일할 때 승계 검토한다. 이것은 전체 HTML/CSS 기능의 공통 frame budget이 아니다.
- Canvas 변경으로 RAC/React 패널 비용까지 해결했다고 주장하지 않는다.
- cold/warm, WebGL/software fallback은 구분한다. 실제 GPU timer를 수집하지 못했다면 JS flush 호출 시간을 GPU 실행 시간으로 보고하지 않는다.
- ratchet 성공·warning·lowerable 항목·예외를 별도로 확인한다. 성능 기준을 구현 후 유리하게 변경하지 않는다.

### 7.4 구현 시 로컬 gate

- Node/Turbo/pnpm 명령은 repo root의 pnpm script로 실행한다.
- 변경 모듈의 인접 Vitest; TS 변경 시 `pnpm run codex:typecheck`.
- Rust 변경 시 인접 engine test와 `pnpm run wasm:build:engine` 후 관련 gate.
- UI·상태·렌더링 변경 시 실제 foreground Builder 및 Preview 확인.
- 기본 완료 gate는 `pnpm run codex:preflight`; 동시 변경이 있으면 `.agents/README.md`에 따라 자신의 범위만 검증한다.
- 포맷은 검사하며 다른 작업자의 파일을 수정하지 않는다. 문서만 바뀐 Phase plan 작성에는 제품 typecheck·브라우저 실행을 성과로 요구하지 않는다.
- commit/push는 별도 명시 요청이 있을 때만 수행한다.

## 8. 산출물·이식 기록·마일스톤

### 8.1 기능 작업별 필수 기록

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

### 8.2 완료 단위

| 단위 | 범위    | 의미                                        |
| ---- | ------- | ------------------------------------------- |
| M0   | P0~P1   | 지원 범위와 검증 기준 확보                  |
| M1   | P2~P6   | HTML·CSS 값·기본 및 현대 layout·텍스트 정합 |
| M2   | P7~P9   | 속성별 웹 페인트·이미지·합성 정합           |
| M3   | P10~P12 | 정확한 증분 렌더링·상태·저장 통합           |
| M4   | P13~P14 | 근거가 있는 최적화와 종합 종결              |

P7의 독립적인 기존 속성 수리는 M1 전체 종료를 기다리지 않고 M0 및 해당 입력 계약이 준비되면 진행할 수 있다. 작은 정확도 수정과 큰 구조 변경을 같은 변경 단위로 묶지 않는다.

### 8.3 중단·재판정 조건

- Chromium 알고리즘이 기존 catalog 계약과 충돌하면 원문 추종 전에 intended behavior와 표준·Preview를 확인한다.
- API·저장 schema·DOM 구조 확장이 필요하면 영향 범위를 공개하고 해당 기능 작업에 포함한다. renderer 내부 수정으로 숨기지 않는다.
- 부분 렌더링이 정확하지 않으면 그 기능의 fallback을 유지하고 원인을 해결한다.
- performance gate가 미달하면 정확도 완료와 성능 미완료를 분리한다.
- reference code에 의존하는 외부 라이브러리·빌드 설정 변경은 구체 대상과 필요성을 확인한 뒤 별도 처리한다.
- ADR이 필요한 구조 결정은 이 계획을 근거로 작성할 수 있으나, 본 문서는 새 ADR 생성·승격 또는 구현 승인을 대신하지 않는다.

## 9. 참조

### Chromium 고정 소스

- [Repository snapshot][chromium]
- [Blink core paint][core-paint]
- [Paint artifact·property tree·invalidation][platform-paint]
- [LayoutNG inline][inline]
- [BoxPainterBase][box-painter]
- [BoxBorderPainter][border-painter]
- [ShadowData][shadow]
- [GeometryMapper][geometry]
- [RasterInvalidator][invalidation]
- [PaintUnderInvalidationChecker][under-invalidation]
- [cc paint][cc-paint]
- [GPU image decode cache][image-cache]
- [cc 동작 설명][cc-how]
- [Blink web tests][web-tests]

### 표준·기존 프로젝트 근거

- [CSS 2.1][css2] — CSS2 화면 기능의 기본 분류와 의미 확인.
- [CSS Snapshot 2025][css-snapshot] — CSS3 이후 모듈을 포함한 기능군 분류의 기준점. 각 기능의 실제 명세 버전은 manifest에서 고정한다.
- [HTML Living Standard][html] — HTML 요소·상태·기본 표시 의미의 표준 참조. 구현 시작 시 해당 절과 조회일을 기록한다.
- [CanvasKit 공식 문서][canvaskit] — 노출 API·backend 범위 확인; 설치 버전의 타입·실행 결과를 함께 확인한다.
- [ADR-263: 그리기 명령 패치·실행 비용](../../adr/completed/263-render-command-patch-execute-cost.md)
- [ADR-264: 이동 subtree·page grid 갱신](../../adr/completed/264-moved-subtree-translate-page-grid-rebind.md)
- [ADR-265: 문서 층 편집·선택 비용](../../adr/completed/265-document-layer-edit-select-cost.md)

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
