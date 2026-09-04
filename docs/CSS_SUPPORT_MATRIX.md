# CSS Level 3 엔진 정합성 체크리스트

> **목적**: composition 레이아웃/렌더링 엔진의 CSS Level 3 속성 지원 현황 추적
> **엔진**: `packages/composition-engine` (자체 Rust 엔진, wasm) — 스타일 어댑터는
> `layout/engines/{flexStyleAdapter,blockStyleAdapter,gridStyleAdapter,displayAdapter}.ts`
> **렌더러**: CanvasKit/Skia WASM
>
> **읽는 법 (2026-09-05)**: 아래 §0 은 **코드가 생성**한다 — 엔진이 CSS 의미를 그대로 구현하지 않는
> 자리와 Chrome 격차 실측치가 여기 있고, 정본은 `layoutCapabilityMatrix.ts` 다. §1 이후의 손 편집
> 본문은 **2026-04-06 기준 스냅샷**이며 자동 갱신되지 않는다 — 그 시점의 엔진 파일명 (ADR-916 에서
> 삭제된 구 어댑터 3종) 은 현재 파일명으로 바꿔 두었으나 행 번호는 검증할 수 없어 떼었고 개별 판정은
> 재확인하지 않았다. 충돌 시 §0 과 코드가 우선한다.

---

## 0. 엔진 capability — 코드 생성

<!-- engine-matrix:begin -->

<!-- 이 블록은 `node scripts/generate-engine-matrix.mjs` 가 생성한다. 직접 편집하지 말 것 —
     정본은 layout/engines/layoutCapabilityMatrix.ts, drift 는 codex:preflight 가 잡는다. -->

| 자리 | 속성 | 값 | 엔진 구현 | 경계 정책 | 미지원 시 동작 | Chrome 격차 (px) | 후속 |
| ---- | ---- | -- | --------- | --------- | -------------- | ---------------- | ---- |
| S4 | `display` | inline | none | declared-substitution | `inline` 은 경계에 그대로 실리고 (`normalizeCssDisplay` 인식 8 값) 엔진 `parse_display` 가 {outer inline, inner flow} 로 읽지만, block 부모의 line item 판정 `is_atomic_inline_level` 이 inner=flow 를 제외해 block-level box 로 치환된다 (`tree.rs write_block_item` code 0). 순수 inline box (텍스트 run 과 섞이는 IFC) 는 없다. inline-block · inline-flex · inline-grid 는 line item (pass). | `S4-inline-text-pair` dx 41.9 · dy 19 · dw 259.2 · dh 2 | breakdown §8 S4 — store 쓰기 chokepoint + hydration 원값 보존 + 패널 DISPLAY_OPTIONS 조정 후 정규화 (persisted migration 동반). 그 전까지 declared-substitution (block 격상). |
| S7 | `float` | left \| right (clear · writing-mode · column-* 동류) | none | ignored | `EngineStyle` (layoutTypes.ts) · 엔진 `StyleInput` 에 float/clear/writing-mode/column 필드가 없어 어댑터 (`flexStyleAdapter` · `blockStyleAdapter`) 가 싣지 않는다 — 경계 record 에 키가 없고, 요소는 normal flow block 으로 쌓인다 (ADR-916 1-C 미구현). | `S7-float-left` dx 0 · dy 20 · dw 0 · dh 0 | breakdown §8 S7 — 패널 노출 없음 확인, import strip 여부 결정. ignored 선언 유지. |
| S8 | `grid-template-columns \| grid-auto-flow` | subgrid \| … dense (baseline 정렬 · intrinsic track 일부 동류) | partial | declared-substitution | `subgrid` 는 부모 트랙을 상속하지 않고 독립 grid 로 치환된다 (`parseGridTemplate` 이 토큰 `subgrid` 를 그대로 넘기고 엔진 `parse_single_track_value` 가 미인식 → auto 폴백, `grid.rs`). `grid-auto-flow: … dense` 는 값이 실리지만 (`EngineGridAutoFlow` · binary `GRID_AUTO_FLOW_MAP`) 엔진 auto-placement 가 `contains("column")` 만 읽어 **sparse 커서** 로만 놓는다 — 빈칸 역채움 없음 (`grid.rs` Phase 1 auto-placement, ADR-916 1-B 미구현 목록 그대로; round 33 이전의 "dense Δ0 = 구현" 판정은 운반되지 않는 `gridColumn` shorthand 가 만든 우연이었다). baseline 정렬은 start 로 치환. | `S8-grid-subgrid` dx 100 · dy 20 · dw 100 · dh 0<br>`S8-grid-dense` dx 100 · dy 40 · dw 0 · dh 0 | breakdown §8 S8 — declared-substitution 유지, 구현은 별도 ADR (차등 케이스로 수치 고정). |

**정책 어휘** — `pass`: 값이 경계에 실리고 엔진이 그 의미로 구현한다 · `declared-substitution`: 값이
경계에 실리지만 엔진이 다른 의미로 치환한다 (치환 내용은 동작 열) · `ignored`: 속성이 `EngineStyle` /
Rust `StyleInput` 에 없어 어댑터가 싣지 않는다 — 엔진은 읽을 기회조차 없다.

격차 수치는 `apps/builder/tests/parity/adr923CapabilityMatrixSeed.browser.test.ts` 가 DOM leg
(`getBoundingClientRect`) ↔ production 파이프라인 (`calculateFullTreeLayout`) 으로 고정한다. 수치가
바뀌면 테스트가 RED 로 알린다 — 표를 유리하게 바꿔 격차를 줄이는 방향은 금지 (수리 결과로만 갱신).

<!-- engine-matrix:end -->

---

## 상태 표기

| 표기 | 의미                       |
| ---- | -------------------------- |
| ✅   | 완전 지원                  |
| ⚠️   | 부분 지원 (제한 사항 있음) |
| ❌   | 미지원                     |

---

## 1. CSS Display Level 3

> Spec: [CSS Display Module Level 3](https://www.w3.org/TR/css-display-3/)

| 속성값         | 상태 | 엔진       | 구현 파일                                       | 비고                                                             |
| -------------- | ---- | ---------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| `block`        | ✅   | Block | `blockStyleAdapter.ts`, `displayAdapter.ts` |                                                                  |
| `inline`       | ✅   | Block | `blockStyleAdapter.ts`, `displayAdapter.ts` |                                                                  |
| `inline-block` | ✅   | Block | `blockStyleAdapter.ts`, `displayAdapter.ts` | `displayAdapter.ts INLINE_BLOCK_PARENT_CONFIG`              |
| `flex`         | ✅   | Flex  | `flexStyleAdapter.ts`                        |                                                                  |
| `inline-flex`  | ⚠️   | Flex  | `displayAdapter.ts`                        | `flex`로 정규화됨 — inline 특성(주변 텍스트와 한 줄 배치) 미반영 |
| `grid`         | ✅   | Grid  | `gridStyleAdapter.ts`                        |                                                                  |
| `inline-grid`  | ⚠️   | Grid  | `gridStyleAdapter.ts`                        | `grid`로 정규화됨 — inline 특성 미반영                           |
| `flow-root`    | ✅   | Block | `blockStyleAdapter.ts`, `displayAdapter.ts` | BFC 생성                                                         |
| `none`         | ✅   | 공통       | `flexStyleAdapter.ts`, `nodeRenderers.ts:219` | 레이아웃 제외 + 렌더 스킵                                        |
| `contents`     | ✅   | 공통       | `BuilderCanvas.tsx` pageChildrenMap 플래튼      | 자식을 부모에 직접 배치, 자체 박스 생성 안 함                    |

---

## 2. CSS Box Model Level 3

> Spec: [CSS Box Model Module Level 3](https://www.w3.org/TR/css-box-3/)

### 2.1 크기

| 속성         | 상태 | 구현 파일                                                     | 비고                                                                                                    |
| ------------ | ---- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `width`      | ✅   | `fullTreeLayout.ts buildNodeStyle()`, `utils.ts:863`          | px, %, em, rem, vh, vw, calc()                                                                          |
| `height`     | ✅   | `fullTreeLayout.ts buildNodeStyle()`, `utils.ts:864`          | 동상                                                                                                    |
| `min-width`  | ✅   | `fullTreeLayout.ts buildNodeStyle()`, `flexStyleAdapter.ts` | flex item: `enrichWithIntrinsicSize`에서 `min-width:auto` 에뮬레이션 (width 주입 시 minWidth 동시 설정) |
| `max-width`  | ✅   | `fullTreeLayout.ts buildNodeStyle()`, `flexStyleAdapter.ts` |                                                                                                         |
| `min-height` | ✅   | `fullTreeLayout.ts buildNodeStyle()`, `flexStyleAdapter.ts` |                                                                                                         |
| `max-height` | ✅   | `fullTreeLayout.ts buildNodeStyle()`, `flexStyleAdapter.ts` |                                                                                                         |

### 2.2 여백

| 속성                            | 상태 | 구현 파일                            | 비고            |
| ------------------------------- | ---- | ------------------------------------ | --------------- |
| `margin` (shorthand)            | ✅   | `utils.ts:178-196`                   | 1값/2값/3값/4값 |
| `margin-top/right/bottom/left`  | ✅   | `fullTreeLayout.ts buildNodeStyle()` |                 |
| `padding` (shorthand)           | ✅   | `utils.ts:201-217`                   | 1값/2값/3값/4값 |
| `padding-top/right/bottom/left` | ✅   | `fullTreeLayout.ts buildNodeStyle()` |                 |

### 2.3 박스 사이징

| 속성                      | 상태 | 구현 파일          | 비고                           |
| ------------------------- | ---- | ------------------ | ------------------------------ |
| `box-sizing: border-box`  | ✅   | `utils.ts:924-954` |                                |
| `box-sizing: content-box` | ⚠️   | `utils.ts:924-954` | 일부 폼 요소에서만 명시적 처리 |

---

## 3. CSS Box Sizing Level 3

> Spec: [CSS Box Sizing Module Level 3](https://www.w3.org/TR/css-sizing-3/)

| 키워드         | 상태 | 구현 파일                                                     | 비고                                                                |
| -------------- | ---- | ------------------------------------------------------------- | ------------------------------------------------------------------- |
| `auto`         | ✅   | `fullTreeLayout.ts buildNodeStyle()`, `flexStyleAdapter.ts` |                                                                     |
| `fit-content`  | ⚠️   | `fullTreeLayout.ts buildNodeStyle()`, `cssValueParser.ts:192` | 태그별 픽셀 계산 워크어라운드 — 엔진 네이티브 `fit-content` 미전달 |
| `min-content`  | ⚠️   | `cssValueParser.ts:193`, `utils.ts:1206-1227`                 | 텍스트 측정만 구현, 레이아웃 엔진에 직접 전달 안됨                  |
| `max-content`  | ⚠️   | `cssValueParser.ts:194`, `utils.ts:1241-1249`                 | 텍스트 측정만 구현, 레이아웃 엔진에 직접 전달 안됨                  |
| `aspect-ratio` | ✅   | `engines/utils.ts` `applyCommon엔진Style()`                  | Flex/Grid/Block 3경로 모두 지원                                     |

---

## 4. CSS Flexbox Level 1

> Spec: [CSS Flexible Box Layout Module Level 1](https://www.w3.org/TR/css-flexbox-1/)

### 4.1 컨테이너 속성

| 속성                             | 상태 | 구현 파일                    | 비고                                                                    |
| -------------------------------- | ---- | ---------------------------- | ----------------------------------------------------------------------- |
| `flex-direction`                 | ✅   | `flexStyleAdapter.ts-83`   | row, column, row-reverse, column-reverse                                |
| `flex-wrap`                      | ✅   | `flexStyleAdapter.ts-88`   | nowrap, wrap, wrap-reverse                                              |
| `flex-flow`                      | ✅   | `flexStyleAdapter.ts-112`  | shorthand 파싱 → flex-direction + flex-wrap 분리                        |
| `justify-content`                | ✅   | `flexStyleAdapter.ts-93`   | flex-start, flex-end, center, space-between, space-around, space-evenly |
| `align-items`                    | ✅   | `flexStyleAdapter.ts-98`   | stretch, flex-start, flex-end, center, baseline                         |
| `align-content`                  | ✅   | `flexStyleAdapter.ts-103` |                                                                         |
| `gap` / `row-gap` / `column-gap` | ✅   | `flexStyleAdapter.ts-157` |                                                                         |

### 4.2 아이템 속성

| 속성               | 상태 | 구현 파일                                                                          | 비고                                                                                                                        |
| ------------------ | ---- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `flex` (shorthand) | ✅   | `fullTreeLayout.ts buildNodeStyle()`, `engines/utils.ts applyFlexItemProperties()` | none, auto, 숫자, 3값 형식 — block/grid 자식에서도 `applyFlexItemProperties()`로 flexGrow/flexShrink/flexBasis 분해 적용    |
| `flex-grow`        | ✅   | `flexStyleAdapter.ts`                                                           |                                                                                                                             |
| `flex-shrink`      | ✅   | `flexStyleAdapter.ts`                                                           | `overflow !== visible` 부모: 명시적 flexShrink 없으면 `flexShrink: 0` 자동 주입 (fullTreeLayout Step 5.7 + 엔진FlexEngine) |
| `flex-basis`       | ✅   | `flexStyleAdapter.ts-111`                                                       |                                                                                                                             |
| `align-self`       | ✅   | `flexStyleAdapter.ts-116`                                                       |                                                                                                                             |
| `order`            | ✅   | `flexStyleAdapter.ts-122`, `compositionEngine.ts`                                     | 엔진 WASM order 전달                                                                                                       |

---

## 5. CSS Grid Layout Level 1

> Spec: [CSS Grid Layout Module Level 1](https://www.w3.org/TR/css-grid-1/)

### 5.1 컨테이너 속성

| 속성                             | 상태 | 구현 파일                    | 비고                                                  |
| -------------------------------- | ---- | ---------------------------- | ----------------------------------------------------- |
| `grid-template-columns`          | ✅   | `gridStyleAdapter.ts-361` | px, fr, auto, minmax(), repeat()                      |
| `grid-template-rows`             | ✅   | `gridStyleAdapter.ts-362` | 동상                                                  |
| `grid-template-areas`            | ✅   | `gridStyleAdapter.ts-300` | 문자열 이름 기반 영역                                 |
| `grid-auto-flow`                 | ✅   | `gridStyleAdapter.ts-368` | row, column, dense                                    |
| `grid-auto-columns`              | ✅   | `gridStyleAdapter.ts`     |                                                       |
| `grid-auto-rows`                 | ✅   | `gridStyleAdapter.ts`     |                                                       |
| `justify-items`                  | ✅   | `gridStyleAdapter.ts-376` |                                                       |
| `align-items`                    | ✅   | `gridStyleAdapter.ts-373` |                                                       |
| `gap` / `row-gap` / `column-gap` | ✅   | `gridStyleAdapter.ts-371` |                                                       |
| `place-items`                    | ✅   | `gridStyleAdapter.ts`         | shorthand 파싱 → align-items + justify-items 분리     |
| `place-content`                  | ✅   | `gridStyleAdapter.ts`         | shorthand 파싱 → align-content + justify-content 분리 |
| `repeat(auto-fill)`              | ✅   | `gridStyleAdapter.ts-163`  | containerSize 기반 동적 계산                          |
| `repeat(auto-fit)`               | ✅   | `gridStyleAdapter.ts-163`  |                                                       |
| `minmax()`                       | ✅   | `gridStyleAdapter.ts-200` |                                                       |

### 5.2 아이템 속성

| 속성                    | 상태 | 구현 파일                    | 비고             |
| ----------------------- | ---- | ---------------------------- | ---------------- |
| `grid-column`           | ✅   | `gridStyleAdapter.ts-435` | "1/3", "span 2"  |
| `grid-row`              | ✅   | `gridStyleAdapter.ts-436` |                  |
| `grid-column-start/end` | ✅   | `gridStyleAdapter.ts-450` |                  |
| `grid-row-start/end`    | ✅   | `gridStyleAdapter.ts-450` |                  |
| `grid-area`             | ✅   | `gridStyleAdapter.ts-419` | 숫자 + 이름 기반 |
| `justify-self`          | ✅   | `gridStyleAdapter.ts-458` |                  |
| `align-self`            | ✅   | `gridStyleAdapter.ts-455` |                  |

---

## 6. CSS Positioning Level 3

> Spec: [CSS Positioned Layout Module Level 3](https://www.w3.org/TR/css-position-3/)

| 속성                                | 상태 | 구현 파일                                                        | 비고                                                                                            |
| ----------------------------------- | ---- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `position: static`                  | ✅   | (기본값)                                                         |                                                                                                 |
| `position: relative`                | ✅   | `cssStackingContext.ts:23`                                       | stacking context 판정                                                                           |
| `position: absolute`                | ✅   | `fullTreeLayout.ts buildNodeStyle()`, `flexStyleAdapter.ts-59` |                                                                                                 |
| `position: fixed`                   | ⚠️   | `fullTreeLayout.ts buildNodeStyle()`                             | `absolute`로 정규화 — 뷰포트 기준 고정 동작 없음                                                |
| `position: sticky`                  | ⚠️   | `cssStackingContext.ts:22`, `layout/stickyResolver.ts`           | stacking context 생성 + post-layout 3-state 보정 (normal→stuck→limit). fullTreeLayout 연동 대기 |
| `top` / `right` / `bottom` / `left` | ✅   | `flexStyleAdapter.ts-169`                                     | absolute/relative 요소에 적용                                                                   |
| `z-index`                           | ✅   | `cssStackingContext.ts:38-43`, `nodeRenderers.ts:155`            | auto/숫자, stacking context 렌더 정렬                                                           |

---

## 7. CSS Overflow Level 3

> Spec: [CSS Overflow Module Level 3](https://www.w3.org/TR/css-overflow-3/)

| 속성                              | 상태 | 구현 파일                                                         | 비고                                                                                                                |
| --------------------------------- | ---- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `overflow: visible`               | ✅   | (기본값)                                                          | flex 자식: `min-width:auto` 에뮬레이션으로 콘텐츠 크기 이하 축소 방지                                               |
| `overflow: hidden`                | ✅   | `BoxSprite.tsx:224`, `nodeRenderers.ts:282-308`                   | CanvasKit `clipRect` + flex 자식 `flexShrink: 0` 자동 주입                                                          |
| `overflow: scroll`                | ✅   | `BoxSprite.tsx`, `scrollState.ts`, `renderCommands.ts`            | 클리핑 + 스크롤바 UI + 마우스 휠 스크롤 + flex 자식 shrink 방지 + hover guideline scroll offset 동기화 (2026-04-06) |
| `overflow: auto`                  | ✅   | `BoxSprite.tsx`, `scrollState.ts`                                 | scroll과 동일 동작 (콘텐츠 초과 시 스크롤바 표시)                                                                   |
| `overflow: clip`                  | ✅   | `BoxSprite.tsx`, `blockStyleAdapter.ts`                            | hidden과 동일한 clipRect + BFC 생성 + flex 자식 shrink 방지                                                         |
| `overflow-x` / `overflow-y`       | ✅   | `engines/utils.ts` `applyCommon엔진Style()`                      | Flex/Grid/Block 3경로 모두 지원. 축별 독립 제어                                                                     |
| **flex shrink 보정**              | ✅   | `fullTreeLayout.ts` Step 5.7, `flexStyleAdapter.ts`                | `overflow !== visible` 시 자식 `flexShrink: 0` 주입. flex-direction 축 매칭 (row→overflowX, column→overflowY)       |
| **min-width:auto 에뮬레이션**     | ✅   | `engines/utils.ts` `enrichWithIntrinsicSize()`                    | flex item에 width 주입 시 minWidth 동시 설정. CSS §4.5 min-width:auto = min-content (2026-04-06)                    |
| **hover guideline scroll 동기화** | ✅   | `skiaFrameHelpers.ts`, `renderCommands.ts`, `scrollState.ts`      | treeBoundsMap에 scrollOffset 반영 + scrollVersion 캐시 무효화 (2026-04-06)                                          |
| **에디터 UI**                     | ✅   | `panels/styles/sections/AppearanceSection.tsx`, `styleOptions.ts` | Appearance 섹션 — visible/hidden/scroll/auto/clip 셀렉터 (ADR-050, 2026-04-03)                                      |
| **해칭 시각화 (Canvas)**          | ✅   | `skia/hoverRenderer.ts`, `skiaTreeBuilder.ts`                     | 자식 선택 시 부모 클립 영역 밖 해칭 표시 (우하향 45°, MAX_HATCHING_LINES=200)                                       |

### 7.5 Replaced Element Sizing (Image)

| 속성                           | 상태 | 구현 파일                                      | 비고                                                    |
| ------------------------------ | ---- | ---------------------------------------------- | ------------------------------------------------------- |
| `object-fit: fill`             | ✅   | `ImageSprite.tsx`, `nodeRenderers.ts`          | 기본 동작, 컨테이너 전체에 늘리기                       |
| `object-fit: cover`            | ✅   | `ImageSprite.tsx`, `nodeRenderers.ts`          | 비율 유지 + 컨테이너 채움 + overflow 클리핑             |
| `object-fit: contain`          | ✅   | `ImageSprite.tsx`, `nodeRenderers.ts`          | 비율 유지 + 컨테이너 안에 맞춤                          |
| `object-fit: none`             | ✅   | `ImageSprite.tsx`, `nodeRenderers.ts`          | 원본 크기 + 중앙 정렬 + overflow 클리핑                 |
| `object-fit: scale-down`       | ❌   | —                                              |                                                         |
| `object-position`              | ❌   | —                                              | 현재 항상 중앙 정렬                                     |
| `width: fit-content` (이미지)  | ✅   | `engines/utils.ts` `enrichWithIntrinsicSize()` | `imageCache.ts` 자연 치수 동기 조회                     |
| `height: fit-content` (이미지) | ✅   | `engines/utils.ts` `enrichWithIntrinsicSize()` | `IMAGE_INTRINSIC_TAGS` Set, `invalidateLayout()` 트리거 |

> **구현 메모 (2026-03-09)**:
>
> - `element.props.objectFit`에서 값을 읽음 (style이 아닌 props)
> - `imageCache.ts`의 `dimensionsCache`는 HMR-resilient (`globalThis` 전역 저장)
> - CanvasKit `cache`에 이미지가 있으면 `dimensionsCache` 자동 복구 (fallback)
> - cover/none 시 `nodeRenderers.ts`에서 `canvas.clipRect()` overflow 클리핑 적용

---

## 8. CSS Backgrounds and Borders Level 3

> Spec: [CSS Backgrounds and Borders Module Level 3](https://www.w3.org/TR/css-backgrounds-3/)

### 8.1 배경

| 속성                                  | 상태 | 구현 파일                   | 비고                                                                        |
| ------------------------------------- | ---- | --------------------------- | --------------------------------------------------------------------------- |
| `background-color`                    | ✅   | `fills.ts:44-51`            | hex, rgb, rgba, hsl, hsla, named 색상                                       |
| `background-image: linear-gradient()` | ✅   | `fills.ts:54-74`            | `MakeLinearGradient`. G5: repeating TileMode 지원. G7: oklab 보간 모듈 준비 |
| `background-image: radial-gradient()` | ✅   | `fills.ts:76-98`            | `MakeTwoPointConicalGradient`. G6: closest-side/farthest-corner 키워드 변환 |
| `background-image: conic-gradient()`  | ✅   | `fills.ts:100-124`          | `MakeSweepGradient` (−90° 보정)                                             |
| `background-image: url()`             | ✅   | `fills.ts:126-143`          | `Image.makeShaderOptions`                                                   |
| `background-size`                     | ✅   | `fillToSkia.ts`             | cover, contain, auto, px, %                                                 |
| `background-position`                 | ✅   | `fillToSkia.ts`             | 키워드(center/top/bottom/left/right), px, %                                 |
| `background-repeat`                   | ✅   | `fillToSkia.ts`, `fills.ts` | repeat, no-repeat, repeat-x, repeat-y                                       |
| `background-attachment`               | ❌   | —                           |                                                                             |
| mesh-gradient (비표준)                | ✅   | `fills.ts:146-188`          | SkSL RuntimeEffect                                                          |

### 8.2 테두리

| 속성                                      | 상태 | 구현 파일                                                | 비고                                                                                |
| ----------------------------------------- | ---- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `border-width` (4방향)                    | ✅   | `utils.ts:226-243`, `fullTreeLayout.ts buildNodeStyle()` | shorthand + 개별                                                                    |
| `border-color` (4방향)                    | ✅   | `fullTreeLayout.ts buildNodeStyle()`                     |                                                                                     |
| `border-style: solid`                     | ✅   | `nodeRenderers.ts:449-486`                               |                                                                                     |
| `border-style: dashed`                    | ✅   | `nodeRenderers.ts:449-486`                               |                                                                                     |
| `border-style: dotted`                    | ✅   | `nodeRenderers.ts:449-486`                               |                                                                                     |
| `border-style: double`                    | ✅   | `nodeRenderers.ts` renderDoubleBorder                    | 3등분 outer/inner 선, sw<3px 시 solid 폴백                                          |
| `border-style: groove/ridge/inset/outset` | ✅   | `nodeRenderers.ts` renderGrooveRidge/InsetOutset         | colord darken/lighten 명암 계산                                                     |
| `border` (shorthand)                      | ✅   | `utils.ts` parseBorder → parseBorderShorthand            | `border: "1px solid red"` → borderWidth 추출; `cssValueParser.ts:499-535` 파서 연동 |

### 8.3 모서리

| 속성                              | 상태 | 구현 파일                                               | 비고                          |
| --------------------------------- | ---- | ------------------------------------------------------- | ----------------------------- |
| `border-radius`                   | ✅   | `styleConverter.ts:323-349`, `nodeRenderers.ts:324-386` | 단일값, 4방향, 각 모서리 path |
| `border-top-left-radius` 등 (4개) | ✅   | `styleConverter.ts:323-349`                             |                               |

### 8.4 그림자

| 속성          | 상태 | 구현 파일                                             | 비고                                                                              |
| ------------- | ---- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| `box-shadow`  | ✅   | `styleConverter.ts:458-521`, `nodeRendererBorders.ts` | 다중 shadow, inset 지원. G1: border-radius RRect 반영. G2: spread RRect 확대 처리 |
| `text-shadow` | ⚠️   | `nodeRendererText.ts`, `types.ts TextShadow`          | 2-pass 렌더링 구현. styleConverter 파싱 연동 대기                                 |

---

## 9. CSS Color Level 4

> Spec: [CSS Color Module Level 4](https://www.w3.org/TR/css-color-4/)

| 속성                                      | 상태 | 구현 파일                                   | 비고                                                |
| ----------------------------------------- | ---- | ------------------------------------------- | --------------------------------------------------- |
| `color`                                   | ✅   | `cssResolver.ts:21`, `nodeRenderers.ts:624` | 상속 가능                                           |
| `opacity`                                 | ✅   | `styleConverter.ts:405-409`                 | CanvasKit `saveLayer` (OpacityEffect)               |
| hex 색상 (`#rgb`, `#rrggbb`, `#rrggbbaa`) | ✅   | `styleConverter.ts:126-145`                 | colord 라이브러리                                   |
| `rgb()` / `rgba()`                        | ✅   | `styleConverter.ts:126-145`                 |                                                     |
| `hsl()` / `hsla()`                        | ✅   | `styleConverter.ts:126-145`                 |                                                     |
| Named colors                              | ✅   | `styleConverter.ts:126-145`                 | CSS named colors 전체                               |
| `lab()` / `lch()` / `oklch()`             | ✅   | `styleConverter.ts`                         | oklch: LMS 경유 직접 변환, lab/lch: colord 플러그인 |
| `color()` 함수                            | ✅   | `styleConverter.ts`                         | srgb, display-p3 지원 (P3→sRGB 행렬 변환)           |
| `color-mix()`                             | ✅   | `styleConverter.ts` resolveColorMix         | in srgb RGB 보간, 재귀 중첩 지원 (depth 5)          |
| `currentColor`                            | ✅   | `cssResolver.ts` preprocessStyle            | 단독 + 복합값(box-shadow 등) 내 토큰 치환           |

---

## 10. CSS Fonts Level 3

> Spec: [CSS Fonts Module Level 3](https://www.w3.org/TR/css-fonts-3/)

| 속성               | 상태 | 구현 파일                                                | 비고                                                                       |
| ------------------ | ---- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| `font-family`      | ✅   | `cssResolver.ts:22`, `nodeRenderers.ts:621`              | 상속 가능, fallback 목록                                                   |
| `font-size`        | ✅   | `cssResolver.ts:121-135`                                 | em/rem 상속 기반 해석                                                      |
| `font-weight`      | ✅   | `cssResolver.ts:23`, `nodeRenderers.ts:595-606`          | 100-900, normal, bold — CanvasKit FontWeight 매핑                          |
| `font-style`       | ✅   | `cssResolver.ts:24`, `nodeRenderers.ts:608-615`          | normal, italic, oblique                                                    |
| `font` (shorthand) | ✅   | `cssValueParser.ts` parseFontShorthand, `cssResolver.ts` | style/weight/size/line-height/family 분리, 개별 속성 우선                  |
| `font-variant`     | ✅   | `cssResolver.ts`, `nodeRenderers.ts`                     | small-caps, oldstyle-nums 등 → CanvasKit fontFeatures                      |
| `font-stretch`     | ✅   | `cssResolver.ts`, `nodeRenderers.ts`                     | condensed~expanded → CanvasKit FontWidth 매핑                              |
| `line-height`      | ✅   | `utils.ts:1019-1052`, `nodeRenderers.ts:537`             | 배수, px, normal: fontBoundingBox 기반 (`measureFontMetrics().lineHeight`) |

---

## 11. CSS Text Level 3

> Spec: [CSS Text Module Level 3](https://www.w3.org/TR/css-text-3/)

| 속성                          | 상태 | 구현 파일                                        | 비고                                                                                                    |
| ----------------------------- | ---- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `text-align`                  | ✅   | `cssResolver.ts:28`, `nodeRenderers.ts:581-591`  | left, center, right, justify (상속)                                                                     |
| `text-decoration`             | ✅   | `nodeRenderers.ts:627-633`                       | underline, overline, line-through (비트마스크)                                                          |
| `text-decoration-style`       | ✅   | `nodeRenderers.ts`                               | solid, dashed, dotted, double, wavy — CanvasKit DecorationStyle 매핑                                    |
| `text-decoration-color`       | ✅   | `nodeRenderers.ts`                               | colord 파싱 → Float32Array RGBA                                                                         |
| `text-transform`              | ✅   | `cssResolver.ts:29`, `styleConverter.ts:276-289` | uppercase, lowercase, capitalize (상속)                                                                 |
| `text-overflow`               | ✅   | `nodeRenderers.ts`                               | ParagraphStyle maxLines:1 + ellipsis:'...'                                                              |
| `white-space`                 | ✅   | `cssResolver.ts:33`, `utils.ts:1143-1188`        | normal, nowrap, pre, pre-wrap, pre-line (상속)                                                          |
| `word-break`                  | ✅   | `cssResolver.ts:31`                              | normal, break-all, keep-all (상속)                                                                      |
| `overflow-wrap` / `word-wrap` | ✅   | `cssResolver.ts`                                 | 상속 가능, CanvasKit breakStrategy API 대기                                                             |
| `letter-spacing`              | ✅   | `cssResolver.ts:27`, `nodeRenderers.ts:625`      | 상속 가능                                                                                               |
| `word-spacing`                | ✅   | `cssResolver.ts`, `nodeRenderers.ts`             | 상속 가능, ParagraphStyle wordSpacing                                                                   |
| `text-indent`                 | ✅   | `cssResolver.ts`, `nodeRenderers.ts`             | 상속 가능, canvas.drawParagraph x 오프셋                                                                |
| `vertical-align`              | ⚠️   | `utils.ts:983-1007`, `utils.ts:1334-1374`        | baseline(FontMetrics ascent 기반), top, bottom, middle — text-top/text-bottom/super/sub은 baseline 폴백 |

---

## 12. CSS Transforms Level 1

> Spec: [CSS Transforms Module Level 1](https://www.w3.org/TR/css-transforms-1/)

| 함수 / 속성                                           | 상태 | 구현 파일                   | 비고                                                   |
| ----------------------------------------------------- | ---- | --------------------------- | ------------------------------------------------------ |
| `translate(x, y)`                                     | ✅   | `styleConverter.ts:609-613` |                                                        |
| `translateX()` / `translateY()`                       | ✅   | `styleConverter.ts:615-621` |                                                        |
| `rotate()`                                            | ✅   | `styleConverter.ts:623-625` | deg, rad, turn, grad                                   |
| `scale()`                                             | ✅   | `styleConverter.ts:627-631` |                                                        |
| `scaleX()` / `scaleY()`                               | ✅   | `styleConverter.ts:633-641` |                                                        |
| `skew()`                                              | ✅   | `styleConverter.ts:643-647` |                                                        |
| `skewX()` / `skewY()`                                 | ✅   | `styleConverter.ts:649-655` |                                                        |
| `matrix()`                                            | ✅   | `styleConverter.ts:661-673` | CSS matrix(a,b,c,d,e,f) → CanvasKit row-major 3x3 변환 |
| `transform-origin`                                    | ✅   | `styleConverter.ts:679-728` | px, %, 키워드(left/center/right/top/bottom)            |
| 다중 함수 조합                                        | ✅   | `styleConverter.ts:594-668` | 3x3 행렬 곱셈 (좌→우)                                  |
| 3D transforms (`matrix3d`, `perspective`, `rotate3d`) | ❌   | —                           |                                                        |

---

## 13. CSS Transitions / Animations

> Spec: [CSS Transitions Level 1](https://www.w3.org/TR/css-transitions-1/), [CSS Animations Level 1](https://www.w3.org/TR/css-animations-1/)

| 속성                     | 상태 | 구현 파일                  | 비고                                                                                               |
| ------------------------ | ---- | -------------------------- | -------------------------------------------------------------------------------------------------- |
| `transition`             | ⚠️   | `skia/transitionEngine.ts` | cubic-bezier + lerp + 5종 easing (ease/ease-in/ease-out/ease-in-out/linear). 상태 시스템 연동 대기 |
| `animation`              | ❌   | —                          |                                                                                                    |
| `@keyframes`             | ❌   | —                          |                                                                                                    |
| `transition-*` 개별 속성 | ⚠️   | `skia/transitionEngine.ts` | parseEasing + computeTransitionValue 구현. 렌더 루프 연동 대기                                     |

---

## 14. CSS Filter Effects Level 1

> Spec: [Filter Effects Module Level 1](https://www.w3.org/TR/filter-effects-1/)

| 속성                      | 상태 | 구현 파일                                                  | 비고                                                                  |
| ------------------------- | ---- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| `filter: blur()`          | ✅   | `styleConverter.ts:421-426`                                | LayerBlurEffect (전경 블러). G3: sigma=radius/2.355 (W3C Gaussian)    |
| `filter: brightness()`    | ✅   | `styleConverter.ts:792-800`, `styleConverter.ts:982-990`   | SVG 사양 4x5 색상 행렬, CanvasKit ColorFilter                         |
| `filter: contrast()`      | ✅   | `styleConverter.ts:808-817`, `styleConverter.ts:993-1001`  | SVG 사양 4x5 색상 행렬, CanvasKit ColorFilter                         |
| `filter: grayscale()`     | ✅   | `styleConverter.ts:884-902`, `styleConverter.ts:1026-1036` | SVG Filter Effects Level 1 사양 4x5 색상 행렬, CanvasKit ColorFilter  |
| `filter: saturate()`      | ✅   | `styleConverter.ts:825-839`, `styleConverter.ts:1004-1013` | SVG 사양 feColorMatrix saturate, CanvasKit ColorFilter                |
| `filter: sepia()`         | ✅   | `styleConverter.ts:932-952`, `styleConverter.ts:1048-1058` | SVG Filter Effects Level 1 사양 4x5 색상 행렬, CanvasKit ColorFilter  |
| `filter: invert()`        | ✅   | `styleConverter.ts:909-924`, `styleConverter.ts:1038-1047` | 4x5 색상 행렬, CanvasKit ColorFilter                                  |
| `filter: hue-rotate()`    | ✅   | `styleConverter.ts:847-878`, `styleConverter.ts:1015-1024` | SVG 사양 feColorMatrix hueRotate, CanvasKit ColorFilter               |
| `filter: drop-shadow()`   | ✅   | `styleConverter.ts` parseCSSFilter                         | CanvasKit DropShadowImageFilter                                       |
| `backdrop-filter: blur()` | ✅   | `styleConverter.ts:429-434`, `effects.ts`                  | BackgroundBlurEffect + BackdropFilterEffect (SaveLayer + blur behind) |

---

## 15. CSS Visual Effects

| 속성                   | 상태 | 구현 파일                                                                 | 비고                                                                                                                                                             |
| ---------------------- | ---- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `visibility: visible`  | ✅   | (기본값)                                                                  |                                                                                                                                                                  |
| `visibility: hidden`   | ✅   | `BoxSprite.tsx:223`, `cssResolver.ts:30`                                  | 상속 가능, 렌더 스킵                                                                                                                                             |
| `visibility: collapse` | ✅   | `BoxSprite.tsx`, `TextSprite.tsx`, `ImageSprite.tsx`                      | hidden과 동일 처리 (렌더 스킵)                                                                                                                                   |
| `mix-blend-mode`       | ✅   | `blendModes.ts:33-61`                                                     | 18종 (multiply, screen, overlay, darken, lighten, color-dodge, color-burn, hard-light, soft-light, difference, exclusion, hue, saturation, color, luminosity 등) |
| `cursor`               | ✅   | `BoxSprite.tsx`, `TextSprite.tsx`, `ImageSprite.tsx`, `ElementSprite.tsx` | PixiJS Container cursor 매핑                                                                                                                                     |
| `pointer-events`       | ✅   | `BoxSprite.tsx`, `TextSprite.tsx`, `ImageSprite.tsx`, `ElementSprite.tsx` | CSS → PixiJS eventMode 매핑 (none→passive, auto→static)                                                                                                          |
| `clip-path`            | ✅   | `styleConverter.ts` parseClipPath, `nodeRenderers.ts` buildClipPath       | inset, circle, ellipse, polygon — CanvasKit clipPath                                                                                                             |
| `mask` / `mask-image`  | ❌   | —                                                                         |                                                                                                                                                                  |

---

## 16. CSS Values and Units Level 3

> Spec: [CSS Values and Units Module Level 3](https://www.w3.org/TR/css-values-3/)

### 16.1 단위

| 단위                             | 상태 | 구현 파일                            | 비고                                        |
| -------------------------------- | ---- | ------------------------------------ | ------------------------------------------- |
| `px`                             | ✅   | `cssValueParser.ts:217-220`          |                                             |
| `%`                              | ✅   | `cssValueParser.ts:254-263`          | containerSize 기준                          |
| `em`                             | ✅   | `cssValueParser.ts:223-230`          | 부모 fontSize 상속 기반                     |
| `rem`                            | ✅   | `cssValueParser.ts:232-237`          | rootFontSize 기반                           |
| `vw` / `vh`                      | ✅   | `cssValueParser.ts:239-253`          |                                             |
| `vmin` / `vmax`                  | ✅   | `cssValueParser.ts` resolveUnitValue | Math.min/max(viewportWidth, viewportHeight) |
| `ch` / `ex`                      | ✅   | `cssValueParser.ts` resolveUnitValue | fontSize×0.5 근사치                         |
| `cm` / `mm` / `in` / `pt` / `pc` | ✅   | `cssValueParser.ts` resolveUnitValue | 1in=96px 기준 물리 단위 변환                |

### 16.2 값 함수

| 함수                          | 상태 | 구현 파일                                                | 비고                                    |
| ----------------------------- | ---- | -------------------------------------------------------- | --------------------------------------- |
| `calc()`                      | ✅   | `cssValueParser.ts:297-381`                              | +, −, ×, ÷, 괄호 중첩, 혼합 단위        |
| `var()`                       | ✅   | `cssValueParser.ts:98-143`                               | 중첩, fallback, 순환 참조 방지          |
| `min()` / `max()` / `clamp()` | ✅   | `cssValueParser.ts:204-218`, `cssValueParser.ts:339-437` | CSS Values Level 4 준수, 혼합 단위 지원 |
| `env()`                       | ✅   | `cssValueParser.ts` resolveEnv                           | safe-area-inset → 0, fallback 지원      |

---

## 17. CSS Cascade Level 4

> Spec: [CSS Cascading and Inheritance Level 4](https://www.w3.org/TR/css-cascade-4/)

| 기능             | 상태 | 구현 파일                              | 비고                                                                                                                                                                        |
| ---------------- | ---- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 속성 상속        | ✅   | `cssResolver.ts:21-33, 44-58`          | 13종: color, font-family, font-size, font-weight, font-style, text-align, letter-spacing, text-transform, visibility, word-break, line-height, white-space, text-decoration |
| `inherit` 키워드 | ✅   | `cssResolver.ts:114`                   |                                                                                                                                                                             |
| `initial` 키워드 | ✅   | `cssResolver.ts` resolveCascadeKeyword | CSS_INITIAL_VALUES 매핑 (30+ 속성)                                                                                                                                          |
| `unset` 키워드   | ✅   | `cssResolver.ts` resolveCascadeKeyword | 상속 가능 → inherit, 아니면 → initial                                                                                                                                       |
| `revert` 키워드  | ✅   | `cssResolver.ts` resolveCascadeKeyword | initial로 폴백 (UA stylesheet 미지원)                                                                                                                                       |
| `!important`     | ✅   | `cssResolver.ts` preprocessImportant   | inline !important > inline normal > inherited                                                                                                                               |
| `@layer`         | ❌   | —                                      |                                                                                                                                                                             |

---

## 18. CSS Logical Properties Level 1

> Spec: [CSS Logical Properties and Values Level 1](https://www.w3.org/TR/css-logical-1/)

| 속성                                 | 상태 | 비고                                      |
| ------------------------------------ | ---- | ----------------------------------------- | --------------------------------------- |
| `margin-inline-start/end`            | ✅   | `cssResolver.ts` resolveLogicalProperties | LTR 가정 → marginLeft/Right 매핑        |
| `margin-block-start/end`             | ✅   | `cssResolver.ts` resolveLogicalProperties | → marginTop/Bottom 매핑                 |
| `padding-inline-start/end`           | ✅   | `cssResolver.ts` resolveLogicalProperties | → paddingLeft/Right 매핑                |
| `padding-block-start/end`            | ✅   | `cssResolver.ts` resolveLogicalProperties | → paddingTop/Bottom 매핑                |
| `border-inline-*` / `border-block-*` | ✅   | `cssResolver.ts` resolveLogicalProperties | width/color/style 포함 28개 매핑        |
| `inset-inline` / `inset-block`       | ✅   | `cssResolver.ts` resolveLogicalProperties | shorthand → left/right, top/bottom 분리 |
| `inline-size` / `block-size`         | ✅   | `cssResolver.ts` resolveLogicalProperties | → width/height + min/max 포함           |

---

## 요약

### 카테고리별 지원율

| #   | CSS Spec Module             | ✅      | ⚠️     | ❌    | 지원율  |
| --- | --------------------------- | ------- | ------ | ----- | ------- |
| 1   | Display Level 3             | 9       | 2      | 0     | 82%     |
| 2   | Box Model Level 3           | 13      | 1      | 0     | 96%     |
| 3   | Box Sizing Level 3          | 2       | 3      | 0     | 40%     |
| 4   | Flexbox Level 1             | 14      | 0      | 0     | 100%    |
| 5   | Grid Layout Level 1         | 19      | 0      | 0     | 100%    |
| 6   | Positioning Level 3         | 5       | 2      | 0     | 86%     |
| 7   | Overflow Level 3            | 4       | 0      | 2     | 67%     |
| 8   | Backgrounds/Borders Level 3 | 20      | 1      | 0     | 95%     |
| 9   | Color Level 4               | 10      | 0      | 0     | 100%    |
| 10  | Fonts Level 3               | 8       | 0      | 0     | 100%    |
| 11  | Text Level 3                | 12      | 1      | 0     | 96%     |
| 12  | Transforms Level 1          | 10      | 0      | 1     | 91%     |
| 13  | Transitions/Animations      | 0       | 2      | 2     | 25%     |
| 14  | Filter Effects Level 1      | 10      | 0      | 0     | 100%    |
| 15  | Visual Effects              | 7       | 0      | 1     | 88%     |
| 16  | Values/Units Level 3        | 12      | 0      | 0     | 100%    |
| 17  | Cascade Level 4             | 6       | 0      | 1     | 86%     |
| 18  | Logical Properties Level 1  | 7       | 0      | 0     | 100%    |
|     | **합계**                    | **167** | **12** | **8** | **90%** |

> **변경 내역 (2026-04-06 v2.0 갱신 — ADR-100 Phase 3 CSS3 렌더링 확장):**
>
> - G3: `filter: blur()` sigma 공식 수정: `radius/2` → `radius/2.355` (W3C Gaussian)
> - G1+G2: `box-shadow` border-radius RRect 반영 + spread를 RRect 확대로 처리
> - G4: `text-shadow` 2-pass 렌더링 구현 (❌ → ⚠️, styleConverter 연동 대기)
> - G5: `repeating-linear/radial/conic-gradient` TileMode.Repeat 지원
> - G6: `radial-gradient` 키워드 변환 (closest-side/farthest-side/closest-corner/farthest-corner)
> - G7: oklab 색상 보간 모듈 (`oklabInterpolation.ts`)
> - `backdrop-filter`: BackdropFilterEffect 타입 + effects.ts SaveLayer 구현
> - `position: sticky`: stickyResolver.ts 3-state 보정 (normal→stuck→limit)
> - `transition` / `transition-*`: transitionEngine.ts cubic-bezier + 5종 easing (❌ → ⚠️)
> - 합계: ✅167 ⚠️12 ❌8 → 지원율 88% → **90%**
>
> **변경 내역 (2026-02-19 v1.1 갱신):**
>
> - `matrix()` transform: ❌ → ✅ (`styleConverter.ts:661-673`)
> - `grayscale()` filter: ❌ → ✅ (`styleConverter.ts:884-902, 1026-1036`)
> - `sepia()` filter: ❌ → ✅ (`styleConverter.ts:932-952, 1048-1058`)
> - `invert()` filter: ❌ → ✅ (`styleConverter.ts:909-924, 1038-1047`)
> - `min()` / `max()` / `clamp()`: ❌ → ✅ (`cssValueParser.ts:204-218, 339-437`)
> - `vertical-align` 비고 갱신: FontMetrics ascent 기반 baseline 정밀 계산 반영
> - 총 지원 속성: 113 → **118** (⚠️ 유지, ❌ 감소: 61 → **56**)
>
> **변경 내역 (2026-02-19 v1.2 갱신):**
>
> - `brightness()` filter: ❌ → ✅ (`styleConverter.ts:792-800, 982-990`) — v1.1에서 구현 누락 확인
> - `contrast()` filter: ❌ → ✅ (`styleConverter.ts:808-817, 993-1001`)
> - `saturate()` filter: ❌ → ✅ (`styleConverter.ts:825-839, 1004-1013`)
> - `hue-rotate()` filter: ❌ → ✅ (`styleConverter.ts:847-878, 1015-1024`)
> - 총 지원 속성: 118 → **122** (지원율: 68% → **72%**). ※ v1.3에서 집계 보정 완료
>
> **변경 내역 (2026-02-21 v1.3 갱신):**
>
> - `border` (shorthand) 레이아웃 지원: ⚠️ → ✅ (`utils.ts:parseBorder()` → `parseBorderShorthand()` 연동)
> - `line-height: normal` 정밀도 개선: `fontSize * 1.2` → `measureFontMetrics().lineHeight` (fontBoundingBox 기반)
> - `enrichWithIntrinsicSize` INLINE_BLOCK_TAGS border-box 수정: padding+border 항상 포함 (layoutInlineRun 호환)
> - `LayoutContext.getChildElements` 추가: 컨테이너 자식 Element 접근 (ToggleButtonGroup width/height 계산)
> - `calculateContentWidth/Height` childElements 파라미터 추가: 자식 Element 기반 intrinsic size 계산
> - 최종 갱신일: 2026-02-21
>
> **변경 내역 (2026-02-21 v1.4 갱신 — Switch/Toggle label 줄바꿈 수정):**
>
> - `INLINE_FORM_INDICATOR_WIDTHS` switch/toggle 값 수정: 26/34/42 → 36/44/52 (spec trackWidth 기준 동기화)
> - `INLINE_FORM_GAPS` 테이블 신규 추가: switch/toggle은 8/10/12, checkbox/radio는 6/8/10 (sm/md/lg)
> - `calculateContentHeight` column 방향 switch/toggle gap을 `INLINE_FORM_GAPS` 기준으로 수정
> - 수정 파일: `engines/utils.ts`
>
> **변경 내역 (2026-02-21 v1.5 갱신 — Card props→children 텍스트 동기화 수정):**
>
> - **문제**: Properties Panel에서 Card의 Title/Description 텍스트 변경 시 WebGL Canvas에 미반영
> - **근본 원인**: `CardEditor`가 `Card.props.heading/description`을 업데이트하지만 WebGL `TextSprite`는 자식 `Heading.props.children`을 읽음 — Card.props → 자식 요소 props 동기화 부재
> - **해결 1**: `BuilderCanvas.tsx` `createContainerChildRenderer` — Card 자식 렌더링 시 `Card.props.heading/title/description`을 자식 Heading/Description 요소의 `props.children`에 주입 (Tabs `_tabLabels` 패턴과 동일)
> - **해결 2**: `packages/shared/src/renderers/LayoutRenderers.tsx` — CSS Preview Card 렌더러에 누락된 `heading`, `subheading`, `footer` props 전달 추가 → CSS Preview와 WebGL 간 heading 소스 일치
> - **우선순위 주입**: `cardProps.heading ?? cardProps.title` → Heading child, `cardProps.description` → Description child
> - 수정 파일: `BuilderCanvas.tsx`, `packages/shared/src/renderers/LayoutRenderers.tsx`
>
> **변경 내역 (2026-02-22 v1.6 갱신 — Slider Complex Component 전환 + 렌더링 버그 수정):**
>
> - Slider: Complex Component 등록 완료 (`complexComponents`, `ComponentFactory`, `FormComponents.createSliderDefinition()`)
> - Slider: DOM 구조 확정 — `Slider > Label + SliderOutput + SliderTrack > SliderThumb`
> - Slider: `Slider.css` class selector → data-attribute selector 전환 완료, spec dimensions 정확히 반영
> - Slider: `Slider.spec.ts` TokenRef (`'{typography.text-sm}'`) → `resolveToken()` 변환 완료 (NaN → track/thumb 미렌더링 수정)
> - Slider: `ElementSprite.tsx` specHeight 보정 로직 추가 (`SLIDER_DIMENSIONS` 기반: label + gap + thumbSize)
> - Slider: `_hasLabelChild` 체크에 Slider 추가하여 label 중복 렌더링 방지
> - Slider: `SliderOutput` 위치 수정 — `x: width` → `x: 0 + maxWidth: width` (컨테이너 내 우측 정렬 패턴)
> - 수정 파일: `Slider.spec.ts`, `useElementCreator.ts`, `ComponentFactory.ts`, `FormComponents.ts`, `Slider.css`, `ElementSprite.tsx`

### P0 개선 대상 (캔버스 렌더링 정합성 핵심)

| 우선순위 | 항목                          | 이유                                                                               |
| -------- | ----------------------------- | ---------------------------------------------------------------------------------- |
| P0       | `overflow: scroll/auto`       | 클리핑+오프셋+store 인프라 존재, 스크롤바 UI + 이벤트 바인딩만 추가 필요 → Phase E |
| ~~P0~~   | ~~`text-overflow: ellipsis`~~ | ✅ v1.3에서 구현 완료                                                              |
| P0       | `position: fixed`             | 뷰포트 고정 UI 미동작                                                              |

### P2 개선 대상 (컴포넌트 Indicator 캔버스 정합성)

| 우선순위 | 항목                          | 이유                                                                                                                                                       |
| -------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2       | ToggleButtonGroup `indicator` | 웹 Preview에서 SelectionIndicator가 동작하나 캔버스에서 미구현. [구현 계획](features/completed/TOGGLEBUTTONGROUP.md#캔버스-selectionindicator-구현-계획) |

> **참고**: Tabs, Switch, Checkbox, Radio, Badge의 indicator는 이미 캔버스에서 구현됨.
> 캔버스는 정적 렌더링이므로 CSS transition 기반 슬라이드 애니메이션은 재현 대상이 아님 (§13 참조).

### P1 개선 대상 (사용 빈도 높은 속성)

| 우선순위 | 항목                                                                | 이유                                        |
| -------- | ------------------------------------------------------------------- | ------------------------------------------- |
| P1       | `fit-content` / `min-content` / `max-content` 네이티브              | 현재 워크어라운드, 엔진 네이티브 전달 필요 |
| ~~P1~~   | ~~`background-size` / `background-position`~~                       | ✅ v1.3에서 구현 완료                       |
| ~~P1~~   | ~~`cursor` / `pointer-events`~~                                     | ✅ v1.3에서 구현 완료                       |
| ~~P1~~   | ~~`filter` 함수 확장 (brightness, contrast, saturate, hue-rotate)~~ | ✅ 구현 완료 (v1.1에서 누락 확인)           |
| ~~P1~~   | ~~`currentColor`~~                                                  | ✅ v1.3에서 구현 완료                       |

---

## 실행 계획 (Checklist Improvement Plan)

> **목표**: 지원율 72% → 85%+ (52 ❌ 중 ~27개 해소)
> **결과**: ✅ Phase 1-9 완료 — 42개 ❌→✅ 전환, 지원율 72% → **88%** (목표 85% 초과 달성)
> **전략**: 난이도 낮은 항목부터 병렬 실행, Phase별 커밋

### Phase 1: Quick Wins (즉시 구현 가능, 5개)

| #   | 항목                    | 대상 파일                            | 난이도 |
| --- | ----------------------- | ------------------------------------ | ------ |
| 1   | `filter: drop-shadow()` | `styleConverter.ts` parseCSSFilter   | 🟢     |
| 2   | `vmin` / `vmax` 단위    | `cssValueParser.ts` resolveUnitValue | 🟢     |
| 3   | `overflow: clip`        | `BoxSprite.tsx`, engines             | 🟢     |
| 4   | `visibility: collapse`  | `BoxSprite.tsx`, cssResolver         | 🟢     |
| 5   | `order` (flex)          | `flexStyleAdapter.ts`                 | 🟢     |

### Phase 2: Shorthand Parsers + CSS Wiring (5개)

| #   | 항목                         | 대상 파일                               | 난이도 |
| --- | ---------------------------- | --------------------------------------- | ------ |
| 6   | `flex-flow` shorthand        | `cssValueParser.ts`, engines            | 🟢     |
| 7   | `place-items` shorthand      | `cssValueParser.ts`, engines            | 🟢     |
| 8   | `place-content` shorthand    | `cssValueParser.ts`, engines            | 🟢     |
| 9   | `word-spacing` CSS→Skia 연결 | `styleConverter.ts`, `nodeRenderers.ts` | 🟡     |
| 10  | `overflow-wrap` 렌더러 연결  | `cssResolver.ts`, `nodeRenderers.ts`    | 🟡     |

### Phase 3: Text Enhancement (4개)

| #   | 항목                           | 대상 파일                            | 난이도 |
| --- | ------------------------------ | ------------------------------------ | ------ |
| 11  | `text-overflow: ellipsis` (P0) | `nodeRenderers.ts`, Skia text        | 🟡     |
| 12  | `text-decoration-style`        | `nodeRenderers.ts`                   | 🟡     |
| 13  | `text-decoration-color`        | `nodeRenderers.ts`                   | 🟡     |
| 14  | `text-indent`                  | `cssResolver.ts`, `nodeRenderers.ts` | 🟡     |

### Phase 4: Background Properties (3개)

| #   | 항목                  | 대상 파일  | 난이도 |
| --- | --------------------- | ---------- | ------ |
| 15  | `background-size`     | `fills.ts` | 🟡     |
| 16  | `background-position` | `fills.ts` | 🟡     |
| 17  | `background-repeat`   | `fills.ts` | 🟡     |

### Phase 5: Cascade & Color (4개)

| #   | 항목                | 대상 파일                             | 난이도 |
| --- | ------------------- | ------------------------------------- | ------ |
| 18  | `currentColor` (P1) | `cssResolver.ts`, `styleConverter.ts` | 🟡     |
| 19  | `initial` keyword   | `cssResolver.ts`                      | 🟢     |
| 20  | `unset` keyword     | `cssResolver.ts`                      | 🟢     |
| 21  | `revert` keyword    | `cssResolver.ts`                      | 🟡     |

### Phase 6: Interaction (2개)

| #   | 항목                  | 대상 파일               | 난이도 |
| --- | --------------------- | ----------------------- | ------ |
| 22  | `cursor` (P1)         | PixiJS Container cursor | 🟡     |
| 23  | `pointer-events` (P1) | PixiJS eventMode 매핑   | 🟡     |

### Deferred (29개, 인프라 변경 필요)

| 카테고리               | 항목 수 | 이유                                     |
| ---------------------- | ------- | ---------------------------------------- |
| Transitions/Animations | 4       | 프레임 기반 애니메이션 인프라 필요       |
| Logical Properties     | 7       | writing-mode/direction 지원 필요         |
| 3D transforms          | 1       | 4x4 matrix + perspective 필요            |
| 고급 색상 공간         | 3       | lab/oklch/color-mix 라이브러리 필요      |
| 복잡한 cascade         | 2       | !important / @layer                      |
| 단위/함수              | 3       | ch/ex, 물리 단위, env()                  |
| 복잡한 파싱/렌더       | 9       | display:contents, font/clip-path/mask 등 |

---

## 컴포넌트 수준 정합성 로드맵 (CSS 웹 ↔ 캔버스)

> **작성일**: 2026-02-19
> **현재 전체 정합성**: 약 62% (66개 컴포넌트 가중 평균)
> **목표**: ~93% (v2 보정: Phase A~G + QW + M-2~6. M-1 제거 — 이미 동작 확인)

### 카테고리별 현황 (v2 코드 검증 기반 보정)

| 카테고리                    | 컴포넌트 수 | v1 추정 | v2 보정 | Δ   | 주요 갭                   | 보정 근거                                                                                                       |
| --------------------------- | ----------- | ------- | ------- | --- | ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Primitives (Box/Text/Image) | 3           | 88%     | **90%** | +2  | spec image skip           | multi-shadow 이미 동작 확인                                                                                     |
| Basic UI                    | 12          | 75%     | **72%** | -3  | 아이콘, focus ring, 상태  | icon/focus 갭 정밀 반영                                                                                         |
| Form Controls               | 11          | 75%     | **71%** | -4  | 드롭다운, 아이콘          | ComboBox/Select dropdown 갭 정밀 반영                                                                           |
| Layout                      | 7           | 70%     | **69%** | -1  | chevron 아이콘, expand    | —                                                                                                               |
| Navigation                  | 3           | 65%     | **66%** | +1  | —                         | border-style 렌더링 확인                                                                                        |
| Misc                        | 5           | 56%     | **57%** | +1  | scrollbar UI              | scroll clipping 인프라 확인                                                                                     |
| Data Display                | 8           | 49%     | **52%** | +3  | 컬렉션 아이템 미생성      | Card elevated multi-shadow 확인; Card 컨테이너 렌더링 + Description TextSprite + border-box 정합성 (2026-02-21) |
| Overlay                     | 5           | 49%     | **51%** | +2  | arrow, backdrop           | Dialog/Popover shadow multi-layer 확인                                                                          |
| Date/Time                   | 5           | 45%     | **44%** | -1  | 날짜 셀 미렌더링          | —                                                                                                               |
| Color                       | 7           | 41%     | **40%** | -1  | 2D/원형 그라디언트 미지원 | —                                                                                                               |

### 피처 차원별 현황 (v2 코드 검증 기반 보정)

| 차원                                  | v1 추정 | v2 보정 | Δ      | 비고                                                                                                                                                    |
| ------------------------------------- | ------- | ------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 구조/레이아웃                         | 85%     | **85%** | 0      | 엔진 단일 엔진 (Block/Flex/Grid). CSS 엔진 88%. ⚠️ [7건 구조적 근본 원인](#레이아웃-엔진-구조적-근본-원인-7건-전수-코드-검증-완료) 해결 시 93~97% |
| 색상/Variant                          | 80%     | **80%** | 0      | Spec variant + CSS variable reader                                                                                                                      |
| 타이포그래피                          | 80%     | **82%** | +2     | CanvasKit Paragraph API — font-variant, font-stretch 포함 확인                                                                                          |
| 렌더링 정밀도 (shadow/outline/border) | 60%     | **65%** | **+5** | **multi-shadow ✅ 이미 동작**, border 8종 ✅ 확인. 잔존 갭: focus ring, shadow spread, spec border-style 패스스루                                       |
| 시각 장식 (아이콘/pseudo)             | 50%     | **50%** | 0      | 아이콘 폰트 도입으로 해결 가능                                                                                                                          |
| 상태 표현                             | 35%     | **33%** | **-2** | **62개 spec 중 20개만 state 활용 (32%)**, 42개는 `_state` unused                                                                                        |
| 애니메이션                            | 5%      | **5%**  | 0      | 최후순위 (§13 참조)                                                                                                                                     |

### 개선 로드맵

> **원칙**: 애니메이션은 최후순위. 상태 표현은 기존 CSS 웹 방식을 따름.

#### 기존 로드맵 (기능 단위)

| Phase | 작업                                                                                                             | 예상 향상  | 누적 목표  | 우선순위      |
| ----- | ---------------------------------------------------------------------------------------------------------------- | ---------- | ---------- | ------------- |
| **A** | **상태 표현 연결** — ElementSprite `'default'` 하드코딩 → `ComponentState` 전달. 스타일 패널 state selector 추가 | **+5~6%**  | **67~68%** | P1            |
| **B** | **아이콘 폰트 도입** — Pencil 방식: Icon Font Node + CanvasKit Paragraph. Lucide/Material Symbols 지원           | **+5~6%**  | **72~74%** | P1            |
| **C** | **컬렉션 아이템 Shape 생성** — Table/ListBox/Menu/Tree/Calendar 자식 렌더링                                      | **+6~8%**  | **78~82%** | P2            |
| **D** | **FancyButton 제거** — Button의 엄밀한 부분집합, gradient variant로 대체                                         | 코드 정리  | —          | P2            |
| **E** | **overflow: scroll/auto 완성** — 스크롤바 UI + wheel/touch 이벤트 (엔진 인프라 이미 존재)                        | **+1~2%**  | **79~84%** | P2            |
| **F** | **Overlay 개선** — arrow, backdrop 렌더링                                                                        | **+2~3%**  | **~84%**   | P3            |
| **G** | **Color 그라디언트** — ColorArea/ColorWheel 2D/원형 그라디언트 (**Phase F 선행 필수**)                           | **+3~4%**  | **~86%**   | P3            |
| **Z** | **애니메이션 인프라** — transition/keyframe 프레임 기반 (최후순위)                                               | **+5~10%** | **~95%**   | **P4 (최후)** |

#### 추가 개선 방안: Quick Win (렌더링 정밀도)

> specShapeConverter / nodeRenderers / effects 레벨의 누락 전달 수정.
> 개별 컴포넌트 수정 불필요, 전체 Spec 컴포넌트에 일괄 적용됨.

| Phase    | 작업                                                                                                                                                                              | 예상 향상 | 난이도 | 우선순위 |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------ | -------- |
| **QW-1** | **border style 전달** — `specShapeConverter`에서 `BorderShape.style` (dashed/dotted) → `SkiaNodeData.box.strokeStyle` 전달. 현재 1줄 누락                                         | **+1.5%** | 🟢 1줄 | P1       |
| **QW-2** | **disabled opacity 일괄 적용** — `state === 'disabled'` 시 `saveLayer(opacity: 0.38)` effect 추가. 모든 Spec 공통. ⚠️ **Phase A 선행 필수** (state 하드코딩 해제 후 동작)         | **+2.5%** | 🟢     | P1       |
| **QW-3** | **focus ring 렌더링** — `SkiaNodeData.box`에 `outline` 필드 추가 → `nodeRenderers`에서 외곽 stroke. 50+ 컴포넌트 영향. ⚠️ **Phase A 선행 필수** (focusVisible state 전달 후 동작) | **+3.5%** | 🟡     | P1       |

#### 추가 개선 방안: Medium (렌더링 정밀도 + 인프라)

| Phase       | 작업                                                                                                                                                                                                                                                                                                                                        | 예상 향상                  | 난이도      | 우선순위 |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ----------- | -------- |
| ~~**M-1**~~ | ~~multi-layer shadow~~ — **v2 코드 검증에서 이미 동작 확인**: `effects.ts:31` `for (const effect of effects)` 루프가 shadow 배열 전체를 순회하며 `saveLayer()` 호출. `styleConverter.ts:1040-1045` `parseAllBoxShadows()`가 콤마 구분 다중 shadow를 정확히 파싱. `specShapeConverter.ts:370-391`에서도 각 ShadowShape를 개별 effect로 추가. | ~~+5~8%~~ → **+0% (제거)** | ✅ 완료     | —        |
| **M-2**     | **shadow spread radius** — `ShadowShape.spread` 렌더러 전달. CanvasKit 네이티브 미지원 → sigma 확장 워크어라운드                                                                                                                                                                                                                            | **+2~3%**                  | 🟡          | P2       |
| **M-3**     | **image shape 렌더링** — `specShapeConverter` `case 'image'` skip → `getSkImage()` + `drawImageRect()` 구현. imageCache 재활용                                                                                                                                                                                                              | **+3~5%**                  | 🟡          | P2       |
| **M-4**     | **CSS variable 실시간 캐시** — `:root` 전체 `--*` 변수 메모리 캐시 + 테마 변경 시 무효화. hardcoded fallback 의존 탈피                                                                                                                                                                                                                      | **+2~3%**                  | 🟡          | P3       |
| **M-5**     | **state 파라미터 일관성 강제** — 62개 spec 중 42개 `_state` 미사용 (v2 검증) → 공통 `applyStateEffect()` 헬퍼 추출                                                                                                                                                                                                                          | **+2%**                    | 🟡 반복작업 | P3       |
| **M-6**     | **partial border 지원** — `BorderShape.sides` (top/right/bottom/left) → 개별 Line 렌더링                                                                                                                                                                                                                                                    | **+1%**                    | 🟡          | P3       |

### Phase A 상세: 상태 표현 연결

Spec에 이미 `state: ComponentState` 파라미터가 존재하며, 각 컴포넌트 render.shapes()가 state별 색상을 반환함.

**변경 대상:**

| #   | 파일                           | 변경 내용                                                         | 난이도 |
| --- | ------------------------------ | ----------------------------------------------------------------- | ------ |
| 1   | `ElementSprite.tsx`            | `'default'` → `previewState` 변수로 교체                          | 🟢     |
| 2   | Zustand store (신규 또는 기존) | `previewState: ComponentState` 상태 추가                          | 🟢     |
| 3   | `StylesPanel.tsx`              | State selector UI (Default\|Hover\|Pressed\|Disabled\|Focus) 추가 | 🟡     |

**동작 방식:**

- **스타일 패널**: 사용자가 state 전환 → store 업데이트 → render.shapes(…, state) 호출 → 캔버스 갱신
- **캔버스 인터랙션**: PixiJS pointerOver/pointerDown → ComponentState 변환 → CSS 웹과 동일한 상태 전환

### Phase B 상세: 아이콘 폰트 도입 (Pencil 방식 참조)

**Pencil의 아이콘 렌더링 파이프라인:**

```
Icon Name ("activity") → Codepoint (57400) → String.fromCodePoint()
→ CanvasKit ParagraphBuilder (font: "Lucide") → Skia render
→ getFillPath() → 벡터 경로 캐싱
```

**composition 적용 방안:**

| #   | 작업                                   | 비고                                                |
| --- | -------------------------------------- | --------------------------------------------------- |
| 1   | 아이콘 폰트 번들 (Lucide WOFF, ~100KB) | CanvasKit fontManager에 등록                        |
| 2   | `icon_font` Shape 타입 추가            | specShapeConverter에 codepoint → text 변환          |
| 3   | Spec shapes에 아이콘 적용              | Select chevron, Disclosure chevron, Dialog close 등 |
| 4   | 아이콘 피커 UI (선택사항)              | Pencil 방식: GridVirtuoso + Fuse.js 검색            |

### Phase D 상세: FancyButton 제거

FancyButton은 Button의 **엄밀한 부분집합** (variants 4/8, sizes 3/5, 특수 기능 0개). 템플릿/프리셋 참조 0건.

**제거 대상 파일:**

- `packages/specs/src/components/FancyButton.spec.ts`
- `apps/builder/src/builder/workspace/canvas/ui/PixiFancyButton.tsx`
- `ElementSprite.tsx` 내 `UI_FANCYBUTTON_TAGS` + dispatch
- index.ts export 3곳

gradient 효과가 필요하면 Button에 `variant: 'gradient'` 추가.

### Phase E 상세: overflow: scroll/auto 완성

현재 인프라 현황:

| 레이어              | 상태 | 구현 파일                                         |
| ------------------- | ---- | ------------------------------------------------- |
| 클리핑              | ✅   | BoxSprite `clipChildren` + CanvasKit `clipRect()` |
| scroll offset       | ✅   | `canvas.translate(-scrollLeft, -scrollTop)`       |
| 콘텐츠 측정         | ✅   | `computeContentBounds()` → maxScroll 계산         |
| Zustand store       | ✅   | `scrollState.ts` (scrollTop/Left/max)             |
| 엔진 overflow 전달 | ❌   | 엔진Style에 타입 있으나 엔진에서 미전달          |
| **스크롤바 UI**     | ❌   | 미구현                                            |
| **이벤트 바인딩**   | ❌   | wheel/touch → scrollBy() 미연결                   |

**필요 작업**: 스크롤바 Skia 렌더링 + wheel 이벤트 바인딩 + 엔진에 overflow 전달

### Quick Win 상세: 렌더링 정밀도 개선

> 개별 컴포넌트 수정 없이, specShapeConverter/nodeRenderers 레벨에서 **전체 Spec 컴포넌트에 일괄 적용**되는 수정.

#### QW-1: border style 전달 (1줄)

`BorderShape`에 `style?: 'solid' | 'dashed' | 'dotted'` 타입이 존재하나 렌더러에 전달되지 않음.

```typescript
// specShapeConverter.ts — BorderShape 처리부에 1줄 추가
if (shape.style) {
  targetNode.box.strokeStyle = shape.style;
}
```

| 대상 파일 | `specShapeConverter.ts` (line ~265)                              |
| --------- | ---------------------------------------------------------------- |
| 영향      | Separator(dashed), DropZone(dashed border), TextField(underline) |

#### QW-2: disabled opacity 일괄 적용 (⚠️ Phase A 선행 필수)

모든 Spec이 `disabled: { opacity: 0.38 }` 정의. 캔버스에서 미적용.

> **의존성**: `state === 'disabled'` 조건이므로 ElementSprite의 `'default'` 하드코딩이 해제(Phase A)된 후에만 동작.

```typescript
// specShapeConverter.ts — specShapesToSkia() 함수 끝부분
function specShapesToSkia(shapes, theme, width, height, state?: ComponentState): SkiaNodeData {
  const root = convertShapes(shapes, ...);
  if (state === 'disabled') {
    root.effects = [...(root.effects || []), { type: 'opacity', value: 0.38 }];
  }
  return root;
}
```

| 대상 파일 | `specShapeConverter.ts`, `ElementSprite.tsx` (isDisabled → state 전달) |
| --------- | ---------------------------------------------------------------------- |
| 영향      | 전체 66개 컴포넌트 disabled 상태                                       |

#### QW-3: focus ring / outline 렌더링 (⚠️ Phase A 선행 필수)

50+ 컴포넌트가 `focusVisible: { outline: '2px solid var(--primary)', outlineOffset: '2px' }` 정의. 캔버스에서 outline 렌더링 **제로**.

> **의존성**: focus ring은 `state === 'focusVisible'`일 때만 표시. Phase A(state 연결)이 선행되어야 동작.

```typescript
// types.ts — SkiaNodeData.box 확장
interface SkiaBox {
  // ... 기존 필드
  outline?: {
    color: Float32Array;
    width: number;
    offset: number;
  };
}

// nodeRenderers.ts — renderBoxNode() 끝부분
if (node.box.outline) {
  const { color, width, offset } = node.box.outline;
  const outlinePaint = new ck.Paint();
  outlinePaint.setStyle(ck.PaintStyle.Stroke);
  outlinePaint.setStrokeWidth(width);
  outlinePaint.setColor(color);
  const outlineRect = ck.LTRBRect(
    -offset,
    -offset,
    node.width + offset,
    node.height + offset,
  );
  canvas.drawRRect(
    ck.RRectXY(
      outlineRect,
      node.box.borderRadius + offset,
      node.box.borderRadius + offset,
    ),
    outlinePaint,
  );
}
```

| 대상 파일 | `types.ts`, `specShapeConverter.ts`, `nodeRenderers.ts`        |
| --------- | -------------------------------------------------------------- |
| 영향      | 전체 interactive 컴포넌트 (Button, Input, Select, Checkbox...) |

### Medium 상세: 렌더링 인프라 확장

#### ~~M-1: multi-layer shadow~~ (v2 코드 검증: 이미 동작 — 제거)

> **v2 검증 결과**: `effects.ts:31` `for (const effect of effects)` 루프가 shadow 배열 전체를 순회하며 `saveLayer()` 호출. `styleConverter.ts:1040-1045` `parseAllBoxShadows()`가 콤마 구분 다중 shadow를 정확히 파싱. `specShapeConverter.ts:370-391`에서도 각 ShadowShape를 개별 effect로 추가.
>
> **잔존 이슈**: `cssVariableReader.ts` 하드코딩 fallback 값이 다중 shadow를 포함하는지 여부 → M-4 (CSS variable 캐시)에서 일괄 해결.

#### M-2: shadow spread radius

`ShadowShape`에 `spread?: number` 필드 존재하나 렌더러에서 무시.

| 항목         | 상세                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| 타입 정의    | `packages/specs/src/types/shape.types.ts:147` — `ShadowShape.spread?: number`                                  |
| 렌더 경로    | `specShapeConverter.ts:370-391` — shadow case, `382-383`에서 `sigmaX/Y = shape.blur / 2` 계산 시 spread 미반영 |
| 워크어라운드 | CanvasKit에 네이티브 spread 없음 → `adjustedSigma = sigma + abs(spread) * 0.2`                                 |

#### M-3: image shape 렌더링

`specShapeConverter.ts`에서 `case 'image'`를 skip 처리 중. imageCache + CanvasKit Image API 이미 존재.

| 항목      | 상세                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------- |
| skip 위치 | `specShapeConverter.ts:462-464` — `case 'image': // Skip - not supported in simple box rendering` |
| 타입 정의 | `packages/specs/src/types/shape.types.ts:284-293` — `ImageShape` 인터페이스                       |
| 영향      | Avatar, Badge(이미지 배경), Card(커버 이미지)                                                     |

```typescript
// specShapeConverter.ts:463 — 현재
case 'image': // Skip — not supported

// 수정
case 'image': {
  const skImage = imageCache.get(shape.src);
  if (skImage) {
    children.push({
      type: 'image',
      x: shape.x, y: shape.y,
      width: resolve(shape.width), height: resolve(shape.height),
      image: { skImage, contentWidth: skImage.width(), contentHeight: skImage.height() },
    });
  }
  break;
}
```

#### M-4: CSS variable 실시간 캐시

`cssVariableReader.ts`(4,470줄)가 하드코딩 fallback에 의존. 테마 변경 시 캔버스에 미반영.

| 항목           | 상세                                                               |
| -------------- | ------------------------------------------------------------------ |
| fallback 위치  | `cssVariableReader.ts:180-195` — `FALLBACK_COLORS` 상수 (하드코딩) |
| label fallback | `cssVariableReader.ts:216-220` — `LABEL_STYLE_FALLBACKS` 상수      |
| 영향           | 전체 컴포넌트 색상 정확도 + 커스텀 테마 지원                       |

```typescript
// cssVariableReader.ts — 캐시 레이어 추가
const CSS_VAR_CACHE = new Map<string, string>();

export function cacheCSSVariables(): void {
  const computed = getComputedStyle(document.documentElement);
  for (const prop of computed) {
    if (prop.startsWith("--")) {
      CSS_VAR_CACHE.set(prop, computed.getPropertyValue(prop).trim());
    }
  }
}

// 테마 변경 이벤트 시 → cacheCSSVariables() 호출
```

#### M-5: state 파라미터 일관성 강제

62개 spec 중 42개가 `_state` (underscore = unused, v2 검증 보정). 20개만 state 활용 (32%). 공통 헬퍼 추출로 일관성 확보.

| 항목            | 상세                                                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| state 활용 예시 | `packages/specs/src/components/Button.spec.ts:169` — `shapes: (props, variant, size, state = 'default') => {` (state 사용) |
| 미사용 예시     | 42개 spec에서 `_state` 패턴으로 무시됨                                                                                     |
| 신규 파일       | `packages/specs/src/utils/stateEffect.ts`                                                                                  |
| 영향            | Phase A(상태 연결) 선행 필수 — 42개 spec 리팩터                                                                            |

```typescript
// packages/specs/src/utils/stateEffect.ts (신규)
export function applyStateToShapes(
  shapes: Shape[],
  state: ComponentState,
): Shape[] {
  if (state === "disabled") return shapes.map((s) => ({ ...s, opacity: 0.38 }));
  if (state === "hover") return shapes.map((s) => applyHoverColor(s));
  if (state === "pressed") return shapes.map((s) => applyPressedColor(s));
  if (state === "focusVisible") return shapes.map((s) => addFocusOutline(s));
  return shapes;
}
```

#### M-6: partial border 지원

`BorderShape`에 `sides?: { top?, right?, bottom?, left? }` 타입 존재하나 미구현.

| 항목      | 상세                                                                                           |
| --------- | ---------------------------------------------------------------------------------------------- |
| 타입 정의 | `packages/specs/src/types/shape.types.ts:191-196` — `sides?: { top?, right?, bottom?, left? }` |
| 변환 경로 | `specShapeConverter.ts:251-292` — border case 처리 (sides 미참조)                              |
| 렌더 경로 | `nodeRenderers.ts:748-763` — border 렌더링 (전 변 동일 적용)                                   |
| 영향      | Separator(top-only), TextField(bottom-only underline)                                          |

### 정합성 도달 예측 (v2 보정)

> **v2 핵심 보정**: M-1 제거 (이미 동작), QW-2/QW-3 → Phase A 선행 필수

```
현재 기준 (v2 코드 검증)                            62%

Phase A + Quick Win (의존성 반영):
  QW-1. border style 전달 (독립)                    +1.5%
  A. 상태 표현 연결 (QW-2/3 선행조건)               +5~6% (중간값 5.0%)
  QW-2. disabled opacity (Phase A 이후)             +2.5%
  QW-3. focus ring (Phase A 이후)                   +3.5%
                                           소계 ≈ +11.5%

기능 로드맵 (Phase B~G):
  B. 아이콘 폰트                                    +5%
  C. 컬렉션 아이템                                  +7%
  E. overflow scroll                                +1.5%
  F. Overlay 개선                                   +4%
  G. Color 그라디언트                                  (F에 통합)
                                           소계 ≈ +17.5%

Medium (M-2~6, M-1 제거):
  M-2. shadow spread                                +2~3%
  M-3. image shape                                  +3~5%
  M-4. CSS var 캐시                                  +2~3%
  M-5. state 일관성 (42개 spec)                      +2%
  M-6. partial border                               +1%
                                           소계 ≈ +2% (중복 감안)

※ M-1(multi-layer shadow) 제거: v2 코드 검증에서 이미 동작 확인
```

| 단계 | 작업                        | 증분  | 누적      | 비고                      |
| ---- | --------------------------- | ----- | --------- | ------------------------- |
| 현재 | —                           | —     | **62%**   | v2 코드 검증 후 기준 동일 |
| 1    | QW-1 (border-style)         | +1.5% | **63.5%** | 유일한 독립 Quick Win     |
| 2    | Phase A (state 연결)        | +4%   | **67.5%** | **QW-2/QW-3 선행 조건**   |
| 3    | QW-2 + QW-3                 | +6%   | **73.5%** | Phase A 이후 가능         |
| 4    | Phase B (icon font)         | +5%   | **78.5%** | 독립                      |
| 5    | Phase C (collection items)  | +7%   | **85.5%** | 독립                      |
| 6    | Phase E (overflow scroll)   | +1.5% | **87%**   | 독립                      |
| 7    | Phase F+G (overlay + color) | +4%   | **91%**   | —                         |
| 8    | M-2~M-6                     | +2%   | **93%**   | M-1 제거 (이미 동작)      |
| 9    | Phase Z (animation)         | +3%   | **~96%**  | 최후순위                  |

### 권장 실행 순서 (v2 보정)

> **v1 → v2 변경 요약**: Phase A를 1단계로 앞당김 (QW-2/QW-3 선행조건), M-1 제거

```
v1 (이전):                                  v2 (보정):
─────────────────────                      ─────────────────────
1단계: QW-1→QW-2→QW-3  (1~2일)           1단계: QW-1 → Phase A → QW-2 → QW-3  (3~4일)
2단계: Phase A→B        (1주)              2단계: Phase B                         (3~4일)
3단계: M-1→M-3→C→E     (2주)              3단계: M-3 → Phase C → Phase E         (2주)
4단계: M-2→M-4~6→F→G   (2주)              4단계: M-2 → M-4~6 → F → G            (2주)
5단계: Phase Z          (최후)              5단계: Phase Z                         (최후)
```

### Phase 의존성 그래프

```
QW-1 (border-style)  ────────────── 독립 ✅ (즉시 실행)
Phase A (state 연결) ────────────── 독립 ✅ (즉시 실행)
  ├── QW-2 (disabled opacity) ──── Phase A 이후 ⚠️
  └── QW-3 (focus ring)      ──── Phase A 이후 ⚠️
Phase B (icon font)  ────────────── 독립 ✅
Phase C (collection) ────────────── 독립 ✅
M-1 (multi-shadow)   ────────────── 이미 동작 ✅ (제거)
M-3 (image shape)    ────────────── 독립 ✅
M-5 (state 일관성)   ────────────── Phase A 이후 권장
```

> **Phase A를 1단계로 앞당기는 이유**: QW-2(disabled opacity, +2.5%)와 QW-3(focus ring, +3.5%)의 합산 **+6%** 효과가 Phase A 없이는 발생하지 않음. Phase A 자체 비용(ElementSprite 1줄 + store 추가)이 낮아 선행 실행이 효율적.

---

## 레이아웃 엔진 구조적 근본 원인 (7건, 전수 코드 검증 완료)

> **상세 분석**: (삭제됨 — git history 참조: `docs/analysis/webgl-layout-root-cause-2026-02.md`)
> **검증일**: 2026-02-19 | **검증 결과**: 7건 전항목 ✅ CONFIRMED

CSS Level 3 속성 지원(88%)과 별도로, **레이아웃 계산 파이프라인 자체**에 구조적 불일치가 존재한다.
이 문제들은 개별 CSS 속성 구현과 무관하게 모든 컴포넌트의 배치·크기 계산에 영향을 준다.

### 불변식 위반 요약

| 불변식                                 | 기대 동작                            | 실제 구현                                        |
| -------------------------------------- | ------------------------------------ | ------------------------------------------------ |
| **A. Available Space 모델 일치**       | 부모/자식 동일한 sizing 모델 사용    | 부모는 Definite 고정, 자식은 auto/intrinsic 혼합 |
| **B. Display 변경 시 자식 의미 보존**  | blockification 후에도 자식 의도 유지 | 엔진 경계에서 내부/외부 display 의미 변질        |
| **C. Intrinsic 키워드 엔진 간 일관성** | auto/fit-content 동일 규칙 해석      | Block: fit-content → auto 정규화            |

### 7건 근본 원인 목록

| #        | 근본 원인                           | 관련 파일                                                  | 심각도 | 구조/레이아웃 차원 영향                    |
| -------- | ----------------------------------- | ---------------------------------------------------------- | ------ | ------------------------------------------ |
| **RC-1** | AvailableSpace 항상 Definite 고정   | `flexStyleAdapter.ts-439`, `BuilderCanvas.tsx:720-725`  | HIGH   | stretch/overflow/min-content 왜곡          |
| **RC-2** | 부모 height 무조건 강제 주입        | `flexStyleAdapter.ts-439`, `gridStyleAdapter.ts-631` | HIGH   | cross-axis stretch, auto height 무시       |
| **RC-3** | CSS 단위 px 중심 `parseFloat` 축소  | `flexStyleAdapter.ts-216`                               | HIGH   | rem/em/vh/vw/calc 전역 오차                |
| **RC-4** | 2-pass 트리거 비교 기준 부정확      | `flexStyleAdapter.ts`                                   | HIGH   | 과/미재계산 → 텍스트 줄바꿈 높이 불일치    |
| **RC-5** | inline-run baseline ≈ middle 단순화 | `displayAdapter.ts`                                   | MEDIUM | y-offset 누적, line break 불연속           |
| **RC-6** | auto/fit-content 엔진별 분기 처리   | `displayAdapter.ts`                                   | HIGH   | enrichment 실패 시 width/height 0 붕괴     |
| **RC-7** | blockification 경계 처리 불완전     | `index.ts:131-144, 193-221`                                | MEDIUM | display 전환 시 자식 shrink/stretch 불일치 |

> ※ **권장 실행 순서**: 1단계 RC-3 → 2단계 RC-1+RC-2 → 3단계 RC-6+RC-4 → 4단계 RC-7 → RC-5
> ※ RC-4는 RC-1 및 RC-6 완료를 전제로 하며, RC-7은 RC-1/RC-2 완료를 전제로 한다.

### 구조/레이아웃 차원 영향도

현재 **구조/레이아웃 차원 85%** (피처 차원별 현황 참조)에서 이 7건의 근본 원인이 해결되면:

| 원인 그룹                                   | 해결 시 예상 향상 | 비고                                                        |
| ------------------------------------------- | ----------------- | ----------------------------------------------------------- |
| RC-1 + RC-2 (available space / height 주입) | +3~5%             | 가장 광범위한 영향. stretch/auto height 정확도 회복         |
| RC-3 (단위 정규화 통합)                     | +2~3%             | `cssValueParser.resolveCSSSizeValue()` 연결만으로 해결 가능 |
| RC-4 (2-pass 기준)                          | +1~2%             | flex row + inline-block 조합에서 가시적 개선                |
| RC-6 (intrinsic 통합)                       | +1~2%             | fit-content 0 붕괴 방지                                     |
| RC-5 + RC-7 (inline-run / blockification)   | +1%               | 엣지 케이스, 장기 개선                                      |

> **합계 예상**: 구조/레이아웃 차원 85% → **93~97%** (전체 정합성에 +3~5% 기여)

### 권장 실행 순서 (RC 기반)

```
1단계: RC-3 (단위 정규화) — 최소 비용 최대 효과 (cssValueParser 연결)
2단계: RC-1 + RC-2 (available space / height) — 엔진 계약 수정
3단계: RC-6 (intrinsic 통합) + RC-4 (2-pass 기준)
4단계: RC-7 (blockification 경계) + RC-5 (inline formatting 고도화)
```

---

## 변경 이력

| 날짜       | 버전    | 설명                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-02-18 | 1.0     | 최초 작성 — CSS Level 3 기준 전체 속성 지원 현황 조사                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-02-19 | 1.1     | Wave 3-4 구현 반영: matrix() transform, grayscale/sepia/invert filter, min()/max()/clamp() 함수, FontMetrics 기반 baseline 갱신. 총 지원 속성 113 → 118                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-02-19 | 1.2     | 기존 구현 누락 확인: brightness/contrast/saturate/hue-rotate filter 4종 ❌→✅. 총 지원 속성 118 → 122 (72%)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-02-19 | 1.3     | Phase 1-6 일괄 구현 (23개 ❌→✅): drop-shadow filter, vmin/vmax, overflow:clip, visibility:collapse, order, flex-flow, place-items/content, word-spacing, overflow-wrap, text-overflow, text-decoration-style/color, text-indent, background-size/position/repeat, currentColor, initial/unset/revert, cursor, pointer-events. 집계 보정 포함: ✅144, ⚠️11, ❌31 (77%)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-02-19 | 1.4     | Phase 7 추가 구현 (7개 ❌→✅): cm/mm/in/pt/pc 물리 단위, ch/ex 단위, font shorthand, border-style double/groove/ridge/inset/outset, clip-path 기본 도형, color-mix(). 총 ✅151, ⚠️11, ❌24 (81%)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-02-19 | 1.5     | display:contents 구현: pageChildrenMap 플래튼, depthMap 보정, ElementSprite/BoxSprite 렌더 스킵. ✅152, ⚠️11, ❌23 (82%)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-02-19 | 1.6     | Phase 9 구현 (12개 ❌→✅): Logical Properties 7종 (LTR→물리 매핑), font-variant (fontFeatures), font-stretch (FontWidth), lab/lch/oklch (색상 공간 변환), color() 함수, env() (safe-area), !important 우선순위. 총 ✅164, ⚠️11, ❌11 (**88%**) — 목표 85% 초과 달성                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-02-19 | 1.7     | **컴포넌트 수준 정합성 로드맵** 추가 (CSS 웹 ↔ 캔버스 62% → 목표 80%). Phase A~Z 개선 계획: 상태 표현 연결, 아이콘 폰트 도입 (Pencil 방식), 컬렉션 아이템 생성, FancyButton 제거, overflow scroll 완성, 애니메이션 최후순위 확정. P0 overflow 설명 갱신 (인프라 존재 확인)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-02-19 | 1.8     | **추가 개선 방안** 추가: Quick Win 3개 (border style 전달, disabled opacity, focus ring) + Medium 6개 (multi-shadow, shadow spread, image shape, CSS var 캐시, state 일관성, partial border). 목표 상향 80% → **92%**. 정합성 도달 예측 + 권장 실행 순서 추가                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-02-19 | **1.9** | **v2 코드 검증 기반 보정**: (1) M-1 multi-shadow 이미 동작 확인 → 제거 (2) QW-2/QW-3 → Phase A 선행 필수 발견 → 실행 순서 변경 (3) state 활용 spec 20/62개(32%) 정밀 측정 (4) 카테고리별·차원별 수치 보정 (5) Phase 의존성 그래프 추가. 목표 상향 92% → **93%**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-02-19 | **2.0** | **레이아웃 엔진 구조적 근본 원인 7건 추가** (분석 문서 전수 코드 검증): RC-1~7 전항목 CONFIRMED. 불변식 위반 요약, 심각도·영향도 분류, 구조/레이아웃 차원 85%→93~97% 예측, RC 기반 실행 순서 추가                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-02-21 | **2.1** | **CSS 레이아웃 엔진 수정 반영**: `border` (shorthand) ⚠️→✅ (`utils.ts:parseBorder()` → `parseBorderShorthand()` 연동). `line-height: normal` 정밀도 개선 (fontBoundingBox 기반 `measureFontMetrics().lineHeight`). `enrichWithIntrinsicSize` INLINE_BLOCK_TAGS border-box 수정. `LayoutContext.getChildElements` 추가. `calculateContentWidth/Height` childElements 파라미터 추가. 총 ✅165, ⚠️10, ❌11                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-02-21 | **2.2** | **Tabs 컨테이너 렌더링 완성**: CONTAINER_TAGS 등록 + 활성 Panel 필터링. Panel `calculateContentHeight` 케이스를 childElements 블록 밖으로 이동. `Tabs.spec.ts` fontSize TokenRef → 숫자 변환 (NaN 방지). Tabs 높이 공식 확정: tabBarHeight(sm=25/md=30/lg=35) + tabPanelPadding×2(32) + panelBorderBox. `effectiveElementWithTabs`: `_tabLabels` 동적 주입으로 spec shapes 탭 레이블 렌더링. 수정 파일 5개 (Tabs.spec.ts, utils.ts, BuilderCanvas.tsx, PixiTabs.tsx, ElementSprite.tsx)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-02-21 | **2.3** | **Card 컨테이너 렌더링 완성**: (1) RC-6 연계 — `enrichWithIntrinsicSize`에서 treatAsBorderBox 대상(Card/Box/Section)에 padding+border 포함 높이 주입하여 border-box 정합성 확보. (2) Description `TEXT_TAGS` 추가로 TextSprite 렌더링 활성화. (3) PixiCard: Heading(TextSprite) + Description(TextSprite), childElements 높이 계산 반영. Data Display 카테고리 Card 보정 근거 갱신                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-02-21 | **2.4** | **Switch/Toggle label 줄바꿈 버그 수정**: (1) `INLINE_FORM_INDICATOR_WIDTHS`의 switch/toggle 값이 spec trackWidth보다 10px 작아 라벨이 불필요하게 줄바꿈되는 현상 수정 — 26/34/42 → 36/44/52 (sm/md/lg). (2) `INLINE_FORM_GAPS` 테이블 신규 추가 — switch/toggle: 8/10/12, checkbox/radio: 6/8/10 (sm/md/lg). (3) `calculateContentHeight` column 방향 gap 계산을 `INLINE_FORM_GAPS` 기준으로 통일. 수정 파일: `engines/utils.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-02-21 | **2.5** | **Card 텍스트 변경 미반영 버그 수정**: Properties Panel에서 Card Title/Description 변경 시 WebGL Canvas 미반영 문제 해결. 근본 원인: `CardEditor`가 `Card.props.heading/description` 업데이트 → WebGL `TextSprite`는 자식 `Heading.props.children` 참조 → Card.props→자식 동기화 부재. `BuilderCanvas.tsx` `createContainerChildRenderer`에서 `cardProps.heading ?? cardProps.title` → Heading child, `cardProps.description` → Description child 주입 (Tabs `_tabLabels` 패턴 동일). `LayoutRenderers.tsx` CSS Preview Card 렌더러에 `heading`/`subheading`/`footer` props 전달 추가로 CSS Preview↔WebGL heading 소스 일치. 수정 파일 2개: `BuilderCanvas.tsx`, `LayoutRenderers.tsx`                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-02-22 | **2.6** | **TagGroup label 두 줄 렌더링 버그 수정**: (1) `TagGroup.spec.ts` — `render.shapes`에서 label 텍스트 shape 제거. label은 자식 Label 엘리먼트(fontSize:14)가 렌더링하므로 spec shapes(fontSize:12) 중복 렌더가 두 줄처럼 보이는 현상 제거. (2) `engines/utils.ts` line 759-760 — `calculateContentWidth` 일반 텍스트 경로에 Canvas 2D→CanvasKit 폭 측정 보정 추가: `Math.ceil(calculateTextWidth(...)) + 2`. INLINE_FORM 경로(line 718-719)에만 존재하던 보정을 일반 텍스트 경로에도 동일 패턴으로 적용. CanvasKit paragraph API가 Canvas 2D `measureText` 결과(65px)보다 더 넓은 폭을 요구하여 텍스트가 wrapping되던 근본 원인 해결.                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-02-22 | **2.7** | **Slider Complex Component 전환 + 렌더링 버그 수정**: (1) `Slider.spec.ts` — `render.shapes`에서 `size.fontSize`를 TokenRef 문자열(`'{typography.text-sm}'`)로 숫자 연산에 직접 사용하던 버그 수정 → `resolveToken()` 적용 (NaN → track/thumb 미렌더링 현상 해결). (2) Slider를 Complex Component로 전환: `useElementCreator.ts` complexComponents에 'Slider' 추가, `ComponentFactory.ts` Slider creator 등록, `FormComponents.ts` `createSliderDefinition()` 팩토리 추가. DOM 구조: `Slider > Label + SliderOutput + SliderTrack > SliderThumb`. (3) `Slider.css` class selector → data-attribute selector 전환, spec dimensions 정확히 반영. (4) `ElementSprite.tsx` — `SLIDER_DIMENSIONS` 기반 specHeight 보정 로직 추가 (label + gap + thumbSize), `_hasLabelChild` 체크에 Slider 추가하여 중복 렌더링 방지. (5) `SliderOutput` 위치 수정: `x: width` → `x: 0 + maxWidth: width`로 컨테이너 내 우측 정렬 패턴 적용. 수정 파일: `Slider.spec.ts`, `useElementCreator.ts`, `ComponentFactory.ts`, `FormComponents.ts`, `Slider.css`, `ElementSprite.tsx` |
| 2026-02-23 | **2.8** | **Breadcrumbs CONTAINER_TAGS 전환**: (1) `calculateContentHeight` — Breadcrumbs 높이 핸들러 추가 (sm:16, md:24, lg:24). (2) `enrichWithIntrinsicSize` — `SPEC_SHAPES_INPUT_TAGS`에 'breadcrumbs' 추가 (early return 방지). (3) `Breadcrumbs.spec.ts` — `resolveToken` 기반 fontSize 해석 적용, sizes height CSS 값과 일치하도록 보정 (32→24). (4) `ElementSprite.tsx` — `_crumbs` prop 주입 패턴 추가 (자식 Breadcrumb 텍스트 배열). (5) `BuilderCanvas.tsx` — `CONTAINER_TAGS`에 'Breadcrumbs' 추가.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-03-01 | **2.9** | **fullTreeLayout.ts 속성 커버리지 확장**: (1) `aspect-ratio` ❌→✅ — `applyCommon엔진Style()`에 추가, Flex/Grid/Block 3경로 모두 지원. (2) `overflow-x/overflow-y` ⚠️→✅ — `applyCommon엔진Style()`에 추가, BFC 계산 전용에서 3경로 공통 지원으로 승격. (3) `flex` shorthand — block/grid 경로에서도 `applyFlexItemProperties()`로 flexGrow/flexShrink/flexBasis 분해 적용 (`buildNodeStyle()` `parentDisplay` 파라미터 추가). (4) `height: auto` 컨테이너 enrichment — 엔진 자동 계산 허용 (enrichment height 제거). 수정 파일: `engines/fullTreeLayout.ts`, `engines/utils.ts`. 총 ✅167, ⚠️9, ❌11                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-03-03 | **3.0** | **Phase 11 반영: Dropflow → Block 전환 완료, 엔진 참조/파일 경로 일괄 갱신, styleToLayout.ts → fullTreeLayout.ts 정정**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

### v1 → v2 기준 변경 사유

v1.0(2026-02-18)에서 v2.0(2026-02-19)으로의 수치 변동은 **측정 기준 엄격화**에 의한 것이며, 실제 코드 회귀가 아님:

| 변경 항목        | v1.x 기준           | v2.0 기준                                                                        | 이유                                      |
| ---------------- | ------------------- | -------------------------------------------------------------------------------- | ----------------------------------------- |
| CSS 속성 지원율  | API 존재 여부 판정  | **코드 경로 실행 검증** (실제 parseCSSProp 호출 → 엔진 WASM 입력까지 전달 확인) | 선언만 있고 미연결된 속성 제외            |
| 컴포넌트 정합성  | Spec 파일 존재 기준 | **state 활용 + 렌더 경로 비교** (CSS Preview ↔ Canvas 시각 비교 기반)            | 62 Spec 중 state 활용 20개(32%) 정밀 측정 |
| Quick Win 분류   | 독립 실행 가정      | **의존성 그래프 기반** (QW-2/QW-3은 Phase A 선행 필수 발견)                      | 실행 순서 보정                            |
| M-1 multi-shadow | ❌ 미지원           | **이미 동작 확인 → 항목 제거**                                                   | 코드 검증으로 오보 정정                   |

---

## 구현 학습 사례 (Lessons Learned)

> 컴포넌트 구현 및 버그 수정 과정에서 발견된 반복 패턴과 주의사항.
> 동일한 실수를 방지하기 위한 팀 공유용 참조 문서.

### LS-1: spec shapes 내 TokenRef 숫자 연산 주의

**발견 시점**: 2026-02-22 (Slider.spec.ts TokenRef offsetY 버그)

**현상**: `size.fontSize` 등 spec shapes 내 수치 필드에 TokenRef 문자열(`'{typography.text-sm}'`)이 직접 할당되어 있을 때, 이를 숫자 연산(`+ offsetY` 등)에 그대로 사용하면 NaN이 발생하여 track/thumb 등 shape가 미렌더링됨.

**원인**: spec의 `size` 객체는 디자인 토큰 참조값을 그대로 포함할 수 있으며, 숫자가 필요한 위치에서 `resolveToken()` 없이 사용하면 문자열 연산이 됨.

**올바른 패턴**:

```typescript
// 잘못된 패턴 — size.fontSize가 TokenRef 문자열일 경우 NaN
const offsetY = size.fontSize + 4;

// 올바른 패턴 — resolveToken()으로 실제 숫자값 획득 후 연산
const fontSize = resolveToken(size.fontSize, tokens);
const offsetY = fontSize + 4;
```

**적용 범위**: spec shapes 내에서 `size.*`, `props.*` 등 외부 주입값을 숫자 연산에 사용하는 모든 경우.

---

### LS-2: 우측 정렬 텍스트 배치 패턴

**발견 시점**: 2026-02-22 (Slider SliderOutput 위치 수정)

**현상**: 컨테이너 우측 끝에 텍스트를 정렬하기 위해 `x: containerWidth`를 사용하면, 텍스트 width만큼 컨테이너 바깥으로 넘쳐 클리핑되거나 레이아웃이 깨짐.

**원인**: `x: containerWidth`는 텍스트의 left edge를 컨테이너 right edge에 맞추므로, 텍스트 전체가 컨테이너 밖으로 배치됨.

**올바른 패턴**:

```typescript
// 잘못된 패턴 — 텍스트가 컨테이너 밖으로 overflow
{ x: containerWidth, textAlign: 'right' }

// 올바른 패턴 — x: 0 + maxWidth로 컨테이너 내 우측 정렬
{ x: 0, maxWidth: containerWidth, textAlign: 'right' }
```

**적용 범위**: SliderOutput 값 표시, Badge count, 기타 컨테이너 우측 끝 정렬이 필요한 모든 텍스트 shape.

---

### LS-3: Complex Component 전환 체크리스트

**발견 시점**: 2026-02-22 (Slider Complex Component 전환)

**배경**: 단순 spec 렌더 컴포넌트를 React-Aria 기반 Complex Component로 전환할 때 누락 없이 처리해야 하는 등록 포인트 목록.

| 순서 | 파일                                          | 작업 내용                                         |
| ---- | --------------------------------------------- | ------------------------------------------------- |
| 1    | `useElementCreator.ts`                        | `complexComponents` 배열에 컴포넌트 태그 추가     |
| 2    | `ComponentFactory.ts`                         | creator 함수 등록                                 |
| 3    | `FormComponents.ts` (또는 해당 카테고리 파일) | `create<Name>Definition()` 팩토리 함수 추가       |
| 4    | `<Name>.css`                                  | class selector → data-attribute selector 전환     |
| 5    | `ElementSprite.tsx`                           | specHeight 보정 로직 + `_hasLabelChild` 체크 추가 |
| 6    | spec 파일                                     | DOM 구조(부모 > 자식) 확정 후 shapes 검증         |

**주의**: `_hasLabelChild` 체크를 누락하면 spec shapes의 label 텍스트와 자식 Label 엘리먼트의 TextSprite가 동시에 렌더링되어 두 줄처럼 보이는 중복 렌더링 현상이 발생함 (TagGroup 버그와 동일한 패턴).

---

## Compositional Architecture 전환 체크리스트

> Monolithic(Spec Shapes 기반) → Compositional(Card 패턴) 전환 시 레이아웃 파이프라인 검증 항목.
> Select 전환에서 발견된 9건의 버그를 기반으로 작성.

### 레이아웃 파이프라인 검증

```
[parseBoxModel] → [enrichWithIntrinsicSize] → [calculateContentHeight] → [엔진 WASM] → [BuilderCanvas]
     ↑                    ↑                           ↑                                            ↑
  isFormElement     SPEC_SHAPES_INPUT_TAGS        자식 순회 브랜치                          implicit style 주입
  제외 필요          제외 필요                     Card 패턴 참조                            ?? 패턴 사용
```

### 필수 체크 항목

| 단계            | 파일                                       | 체크 포인트                                                                  |
| --------------- | ------------------------------------------ | ---------------------------------------------------------------------------- |
| 1. 분류         | `utils.ts` `parseBoxModel`                 | `isFormElement` 배열에서 제거 (container ≠ form element)                     |
| 2. Enrichment   | `utils.ts` `enrichWithIntrinsicSize`       | `SPEC_SHAPES_INPUT_TAGS`에서 제거 (CSS padding 경로 사용)                    |
| 3. 높이 계산    | `utils.ts` `calculateContentHeight`        | 전용 브랜치 추가 — 실제 visible 자식 순회 (Card 패턴)                        |
| 4. 자식 필터링  | `BuilderCanvas.tsx`                        | Web preview 비표시 조건 일치 (label prop, hidden items 등)                   |
| 5. Style 주입   | `BuilderCanvas.tsx`                        | `??` 패턴으로 기본값 주입 (사용자 CSS 값 우선)                               |
| 6. Factory      | `*Components.ts`                           | Web CSS와 동일한 display/flexDirection/gap 설정                              |
| 7. 높이 상수    | `utils.ts` `DEFAULT_ELEMENT_HEIGHTS`       | TEXT_LEAF_TAGS는 제거 → 동적 계산 (fontSize \* lineHeight)                   |
| 8. SpriteType   | `ElementSprite.tsx` `UI_SELECT_CHILD_TAGS` | 자식 태그 등록 → `'selectChild'` → `isUIComponent=true` → spec shapes 렌더링 |
| 9. TAG_SPEC_MAP | `ElementSprite.tsx` `TAG_SPEC_MAP`         | 자식 태그 → Spec 매핑 등록 (기존 Spec 재사용 가능)                           |

### CSS 값 파싱 주의사항

```typescript
// gap/padding 등 0이 유효한 CSS 속성:
const parsed = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
const value = isNaN(parsed) ? defaultValue : parsed; // ✅ 0은 유효

// shorthand + longhand 통합 감지:
const hasUserValue =
  style.padding !== undefined || // shorthand
  style.paddingTop !== undefined || // longhand
  style.paddingBottom !== undefined;
const pad = hasUserValue ? parsePadding(style) : null; // ✅ 통합 파싱
```

### 엔진 0.9 Box Model

| 속성                    | 의미                                                          |
| ----------------------- | ------------------------------------------------------------- |
| `style.size`            | **border-box** (padding+border 포함)                          |
| `layout.size`           | **border-box** 반환                                           |
| `applyCommon엔진Style` | 변환 불필요 — composition `box-sizing:border-box` 그대로 전달 |

### Spec Shapes 배경색 검증

| #   | 체크 항목                                                    | 위험                                |
| --- | ------------------------------------------------------------ | ----------------------------------- |
| 1   | Factory에 `backgroundColor: 'transparent'` 없는지            | spec variant override → 배경 투명화 |
| 2   | Spec shapes에서 `'transparent'` 방어 처리                    | 기존 DB 요소 호환 필수              |
| 3   | 토큰 이름이 colors.ts에 정의되어 있는지                      | 미정의 → silent 검은색 렌더링       |
| 4   | CSS `background` 있는 컴포넌트에 spec `roundRect` shape 포함 | 배경 누락                           |
| 5   | CSS 변수 → Spec 토큰 매핑 검증 (variant별)                   | 색상 불일치                         |

```typescript
// Spec shapes 배경색 방어 패턴
const userBg = props.style?.backgroundColor;
const bgColor =
  userBg != null && userBg !== "transparent" ? userBg : variant.background; // spec variant 사용
```
