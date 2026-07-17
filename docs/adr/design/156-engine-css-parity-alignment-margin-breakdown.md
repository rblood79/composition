# ADR-156 구현 상세 — composition-engine CSS 정합 복구

> 본 문서는 [ADR-156](../156-engine-css-parity-alignment-margin.md) 의 구현 상세다. 결정/위험/Gate 는 본문 참조.

## 1. Phase 0 inventory — 실측 기준선 (freeze 대상)

### 1-1. 1차 발산 5종 실측 (2026-07-17, Chrome 차등 하니스)

각 행은 root-상대 좌표, TOL 1px. 재현 fixture 는 §2 참조.

| ID  | 발산                                                          | 최소 재현                                                          | CSS → 엔진                            | 라이브 노출                           |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------- | ------------------------------------- |
| E1  | flex/grid `align-self` / `justify-self` 전면 무시             | `align-items:flex-start` 컨테이너(h 100) + 자식 `alignSelf:center` | `k.y` 40 → **0**                      | **사용자 도달 가능** (Inspector 피커) |
| E2  | grid `justify-items`/`align-items` 무시 + 자식 명시 크기 무시 | `grid` 1fr + 자식 `width:40px`, `justifyItems:end`                 | `c.x` 160 → **0**, `c.w` 40 → **200** | 부분 (JS DFS 가 폭만 보정)            |
| E3  | 부모-자식 마진 상쇄 미구현                                    | `block` mid + 자식 `marginTop:30px`                                | `k.y` 0 → **30**, `mid.h` 20 → **50** | 도달 가능 (block 컨테이너)            |
| E4  | `margin:auto` 정렬 미구현 (block + flex)                      | `block` mid + 자식 `marginLeft/Right:auto`, `width:80px`           | `k.x` 60 → **0**                      | 잠재 (Inspector 입력 경로 없음)       |
| E5  | **root** 자기 크기 경로 결함군 (§1-1-b 하단 확장 참조)        | root `height:auto` + `padding:10px`                                | `root.h` 40 → **20**                  | 잠재 (라이브 root 는 명시 높이)       |

**E5 범위 한정 (중요)**: 같은 padding 노드가 **중첩(비-root)** 이면 통과한다(실측 확인). `compute_layout(root, w, -1)` 의 root 자기 크기 계산에만 결함. 명시 높이 root 는 통과 → 엔진의 border-box 계약 자체는 정상.

### 1-1-b. 2차 정밀 sweep 발산 (2026-07-17, 하니스 49 케이스 — G0 전수 완성분)

정적 3축 교차표 전수 완성(§1-3) + 확장 매트릭스 실측에서 **추가 발산 12군(E6~E17)** 이 확인됐다. "도달 가능" = Inspector 편집 경로 실존을 grep 으로 확인한 것. **Phase 열은 round 2 리뷰(2026-07-17) 확정** — 본문 §"Phase 매핑 확정" 과 1:1.

| ID  | 발산                                                                                                                                                            | 최소 재현 (케이스)                                            | CSS → 엔진                                                                  | 라이브 노출                                                 | Phase           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------- |
| E6  | percent height 를 **폭 기준으로 해석** — block 은 `write_block_item` 단일 폭 ctx(`tree.rs:1066`), flex column 은 `laid_out_main` 의 폭 `ctx`(`tree.rs:905,919`) | block root(h300) + 자식 `height:50%` (BP-1/2)                 | `k.h` 150 → **100** (=50%×폭200). auto 부모: CSS 0 vs 엔진 100 (PH-1, FP-1) | **도달 가능** (Transform 섹션 % 단위)                       | **2** (E1 동급) |
| E7  | 음수 margin 을 flow 배치에서 무시 (absolute translate 패턴만 지원)                                                                                              | 형제 `marginTop:-10px`/`marginLeft:-20px` (BM-1)              | `b.x` -20 → **0**, `b.y` 10 → **20**                                        | **도달 가능** (Inspector 음수 입력)                         | 4               |
| E8  | `row-reverse`/`column-reverse`/`wrap-reverse` 전면 무시 (정방향으로 배치)                                                                                       | row-reverse 2자식 (FRV-1/2, FWR-1)                            | `a.x` 160 → **0**                                                           | **도달 가능** (`styleOptions.ts:80-81` Direction 옵션 노출) | 4               |
| E9  | `align-items:baseline` 미구현 (flex-start fallback — 빈 박스 baseline=하단 조차 미적용)                                                                         | h20/h50 형제 baseline (BL-1)                                  | `a.y` 30 → **0**                                                            | 잠재                                                        | §Residual       |
| E10 | `position:relative` inset offset 무시 (in-flow 취급은 정상, 시각 offset 만 소실)                                                                                | relative + top10/left15 (REL-1)                               | `k.x` 15 → **0**, `k.y` 10 → **0**                                          | 도달 가능 (left/top → inset 송신 확인)                      | 4.5             |
| E11 | absolute 3종 미구현 — ① 양측 inset 지정 시 크기 stretch(ABS-1/4) ② inset 무지정 static position(ABS-3) ③ `margin:auto` 중앙(ABS-5)                              | left+right 지정 + width auto                                  | `k.w` 180 → **0** / `k.y` 30 → **0** / `k.x` 80 → **0**                     | 도달 가능                                                   | 4.5             |
| E12 | grid 컨테이너 트랙 정렬 `justify-content`/`align-content` 무시 + **auto 트랙 align-content:stretch 미구현** (definite 높이의 잉여 공간 분배 없음)               | justifyContent:center 고정 트랙 (GJC-1, GAC-1, GAR-2)         | `c0.x` 50 → **0** / implicit 행 100 → **30**                                | 부분 (E2 인접 — grid.rs 정렬 0줄의 컨테이너 축)             | 3               |
| E13 | grid auto-placement 가 **span 을 무시** (placement 커서가 점유 셀을 스킵하지 않음)                                                                              | column/row span 2 + 후속 자식 (GSP-1/2)                       | `c1.y` 30 → **0** (span 아래가 아니라 옆에 배치)                            | 도달 가능                                                   | 3               |
| E14 | `gridAutoFlow`/`gridAutoColumns`/`gridAutoRows` 미소비 — flow:column 이 row 로, 명시 auto 트랙 크기가 intrinsic 으로 degrade                                    | flow:column + autoColumns 60px (GAF-1), autoRows 40px (GAR-1) | `c2.x` 60 → **0**, 행 40 → **0**                                            | 도달 가능                                                   | 3               |
| E15 | `aspect_ratio` 미소비 (한 축 명시 + ratio 파생 크기 전면 소실)                                                                                                  | `width:100px` + `aspectRatio:2` (AR-1/2/3)                    | `k.h` 50 → **0**                                                            | 도달 가능 (Image 계열 유입 경로)                            | 5               |
| E16 | `order` — NodeStyle **선언조차 없음** (serde silent drop). 송신은 존재(`taffyStyleToRecord` order emit)                                                         | `order:-1` 중간 자식 (ORD-1)                                  | `b.x` 0 → **40** (재배열 무시)                                              | 잠재 (Inspector 편집 UI 없음)                               | §Residual       |
| E17 | `overflow_x/y` 미소비 — **현재는 E3 부재가 가림** (overflow BFC 의 상쇄 차단과 "상쇄 자체 미구현"이 우연 일치, BC-2 diff 0)                                     | overflowY:hidden + 자식 marginTop (BC-2)                      | 현재 diff 0 (**잠복**)                                                      | E3 구현 시 즉시 노출                                        | **4 (E3 동시)** |

**E5 확장 — root self-sizing 결함군 재정의 (2026-07-17)**: E5 는 "root auto 높이 + padding 누락" 단건이 아니라 **root 자기 크기 경로 전반의 결함군**이다. 실측: ① border 도 동일 누락 (RT-1, h 30→20) ② 무폭 flex/grid root 가 availW 를 채우지 않고 fit-content 로 수축 (RT-2, w 200→40) ③ root 자기 min/maxHeight clamp 무시 (MH-1 30→80 미달, MH-2 100→50 초과). **중첩이면 4형상 전부 정합** (NST-1~4: 무폭 fill·minHeight·maxHeight·grid fill) — 라이브 root(body)는 명시 크기라 전부 잠재이나, Phase 5 작업 시 이 결함군 전체를 함께 정합할 것.

### 1-2. 정합 확인 영역 (회귀 기준선 — Phase 2~5 가 깨면 안 됨)

본 표 12행 전체가 본문 Hard constraint 의 "정합 기준선 무회귀" 대상이다 (672 조합 단독 아님).

| 축                                                                                                    | 조합 수 | 결과                                           |
| ----------------------------------------------------------------------------------------------------- | ------: | ---------------------------------------------- |
| flex 교차축 (direction × wrap × align-items × align-content × definite/auto × 1줄/2줄)                |     384 | 전부 통과                                      |
| flex main 축 (direction × justify-content × gap × grow × shrink × basis)                              |     288 | 전부 통과                                      |
| 인접 형제 마진 상쇄                                                                                   |       — | 통과                                           |
| box-sizing border-box (명시 크기 + padding/border)                                                    |       — | 통과                                           |
| 부모 padding 이 마진 상쇄를 차단하는 경우                                                             |       — | 통과 (R4 회귀 기준선)                          |
| grid 트랙 산술 — percent / minmax(40px,1fr) / repeat(2,1fr) / auto intrinsic (2차 sweep GT-1~4)       |       4 | 통과                                           |
| grid gap 위치 산술 rowGap/columnGap (GGAP-1 위치 축)                                                  |       — | 통과                                           |
| **percent padding/margin 폭 기준 해석** — block+flex (BP-3/4, FPM-1)                                  |       — | 통과 (**R8 회귀 기준선** — 폭 기준이 CSS 정답) |
| flex item min/max clamp 재분배 + flexBasis % (FMM-1/2, FB-1)                                          |       — | 통과                                           |
| fit-content (+minWidth clamp) / inline-block 형제 / display:none 제외 (FIT-1/2, IB-1, DN-1)           |       — | 통과                                           |
| **중첩** 컨테이너 자기 크기 — 무폭 fill·min/maxHeight clamp·grid fill (NST-1~4)                       |       4 | 통과 (root 만 결함 — §1-1-b E5 확장)           |
| absolute % inset / space-between+margin / wrap+rowGap / 인접 상쇄 비대칭 (ABS-2, FJC-1, FWG-1, BMB-1) |       — | 통과                                           |

### 1-3. 엔진 필드 3축 교차표 (Phase 0 산출물 — G0)

각 `NodeStyle` 필드를 **선언(tree.rs) / 소비(읽는 코드 존재) / 송신(파이프라인이 실제로 보냄)** 3축으로 전수 분류한다. 본 ADR 이 다루는 것은 **선언 O + 송신 O + 소비 X** 칸이다.

**전수 확증 완료 (2026-07-17 2차 sweep)** — NodeStyle **49필드** 전체를 `.{field}` 접근 grep 으로 분류한 결과, 「선언 O · 송신 O · 소비 X」 는 3건이 아니라 **9필드**(아래 표 8행 — `overflow_x`/`_y` 를 1행으로 합산 표기)이며, 「선언 X · 송신 O」(serde silent drop) 2건이 별도로 존재한다:

| 필드                  | 선언            | 소비     | 송신 (파이프라인)                                                                             | 발산 ID |
| --------------------- | --------------- | -------- | --------------------------------------------------------------------------------------------- | ------- |
| `justify_items`       | tree.rs:115     | **없음** | `fullTreeLayout.ts:840` (grid branch)                                                         | E2      |
| `align_self`          | tree.rs:123     | **없음** | `fullTreeLayout.ts:664` (taffyStyleToRecord, 주경로) + `:849` (grid)                          | E1      |
| `justify_self`        | tree.rs:124     | **없음** | `fullTreeLayout.ts:665` + `:850` (grid)                                                       | E1      |
| `overflow_x`/`_y`     | tree.rs:108-109 | **없음** | `fullTreeLayout.ts:645-646` + `utils.ts:4934-4938`                                            | E17     |
| `grid_auto_flow`      | tree.rs:129     | **없음** | `fullTreeLayout.ts:673-674` + `:832`                                                          | E14     |
| `grid_auto_columns`   | tree.rs:130     | **없음** | `fullTreeLayout.ts:675-676` + `:833-834`                                                      | E14     |
| `grid_auto_rows`      | tree.rs:131     | **없음** | `fullTreeLayout.ts:677-678` + `:835`                                                          | E14     |
| `aspect_ratio`        | tree.rs:172     | **없음** | `fullTreeLayout.ts:734-741` + `utils.ts:4942-4948`                                            | E15     |
| `order`               | **선언 없음**   | —        | `taffyStyleToRecord` order emit (serde silent drop)                                           | E16     |
| `grid_template_areas` | **선언 없음**   | —        | `applyBatchStyle` array passthrough (기지 — factory 숫자 line 병기로 완화, tree.rs 헤더 자인) | —       |

**산술**: 49 = 소비 있음 **40** + 미소비 **9**. 미선언 2건(`order` / `grid_template_areas`)은 49 에 포함되지 않는다(struct 에 존재하지 않으므로).

소비 있음 40필드도 **소비 ≠ 정합** — 소비되면서도 해석이 틀린 축(E6 percent height 폭 ctx, E7 음수 margin, E8 reverse 계열, E12 grid 컨테이너 정렬 등)은 §1-1-b 동적 실측이 담당한다. grid 커널은 min/max clamp 소비가 0 (flex/block 만 구현 — E2 인접).

**stale 위험**: 본 표는 문서 산출물이라 필드 추가 시 자동으로 갱신되지 않는다 → **R7 / G6 의 정적 가드**가 상시성의 근거다.

### 1-3-b. 캐시 키 등재 축 (R6 — 4번째 축)

`LAYOUT_STYLE_KEYS`(`layoutCache.ts:49-110`, 60키)는 `createElementLayoutSignature`(`:185-190`)의 style 시그니처 입력이다. **여기 없으면 해당 키만 바뀐 편집이 캐시 히트로 흡수되어 재배치 자체가 일어나지 않는다** — 엔진을 고쳐도 무반영. 발산 필드의 등재 현황:

| 필드                                                                                                                                                                        | LAYOUT_STYLE_KEYS |          관련 발산           | 조치 Phase |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------: | :--------------------------: | :--------: |
| `alignSelf`                                                                                                                                                                 |     O (`:84`)     |              E1              |     —      |
| `justifySelf`                                                                                                                                                               |     **없음**      |              E1              |   **2**    |
| `justifyItems`                                                                                                                                                              |     **없음**      |              E2              |   **3**    |
| `gridAutoColumns` / `gridAutoRows`                                                                                                                                          |     **없음**      |             E14              |   **3**    |
| `gridColumnStart` / `gridRowStart`                                                                                                                                          |     **없음**      |             E13              |   **3**    |
| `overflowX` / `overflowY`                                                                                                                                                   |     **없음**      |             E17              |   **4**    |
| `order`                                                                                                                                                                     |     **없음**      |             E16              | §Residual  |
| `gridAutoFlow` / `gridColumn` / `gridRow` / `overflow` / `aspectRatio` / `flexDirection` / `position` / `top`·`left`·`right`·`bottom` / `height` / `marginTop`·`marginLeft` |         O         | E14/E13/E17/E15/E8/E10/E6/E7 |     —      |

주의 2건:

- `gridColumn`/`gridRow` **shorthand 만** 등재 — 그러나 `layout-engine.md` §"Grid area 이름 해석" 은 factory 에 **`gridColumnStart`/`End` + `gridRowStart`/`End` 숫자 line 병기**를 요구한다. 즉 규칙이 권장하는 형태로 쓰면 캐시 키에 걸리지 않는다 (E13 수정 시 노출).
- `overflow` shorthand 는 등재됐으나 파이프라인은 `overflowX`/`overflowY` 를 송신한다(`utils.ts:4934-4938`).

`NON_LAYOUT_PROPS_UPDATE`(`elementUpdate.ts`) 블랙리스트에는 위 키가 전부 **미등재 = 정상** (blacklist 제외 방식이므로 layout 영향으로 판정됨). 즉 문제는 layoutVersion 증가가 아니라 **페이지 레이아웃 캐시 시그니처**다.

### 1-4. 계약 차이 (버그 아님 — 하니스 작성 시 필수 지식)

차등 테스트 작성 시 아래를 혼동하면 **가짜 실패**가 난다. 실제로 초기 sweep 에서 132/288 가짜 실패를 유발했다.

| 항목                  | CSS(DOM) leg       | 엔진 leg                              | 정규화 위치                           |
| --------------------- | ------------------ | ------------------------------------- | ------------------------------------- |
| gap                   | `gap`              | `rowGap`/`columnGap` 만               | `utils.ts:4925` applyCommonTaffyStyle |
| padding / margin      | shorthand 가능     | longhand 4방향만                      | 동일                                  |
| border                | `borderTopWidth`   | **`borderTop`**                       | `utils.ts:4911`                       |
| grid track            | `"1fr 1fr"` string | **`["1fr","1fr"]` array**             | `parseGridTemplate` (TaffyGridEngine) |
| flexGrow / flexShrink | 문자열 허용        | **f32 숫자만** (문자열 = parse error) | —                                     |

미지 필드는 serde 가 **조용히 버린다** (`deny_unknown_fields` 없음) → 오타/키 불일치가 silent no-op.

**하니스 함정 2종** (2차 sweep 실측): ① `display:none` 노드의 `getBoundingClientRect` 는 0-rect 라 root-상대 정규화에서 host offset 이 노출된다 → 해당 노드 자신의 좌표는 비교 제외 ② 케이스의 `css:`/`eng:` override 는 **위 계약 차이 보정 전용** — 검증 대상 속성을 한 leg 에만 넣으면 당연히 diff 가 나며 엔진 결함으로 잘못 판정된다(NST-5 오탐 실측).

## 2. Phase 1 — Chrome 차등 하니스 자동화 (G1)

### 2-1. 원리

기존 `tests/golden.rs`(15) 는 이름과 달리 **Chrome 실측이 아니라 CSS 명세 손계산**이다 (본문 헤더 자인: "기대값 근거 (Chrome/Taffy 실측 대신 명세 계산)"). 엔진과 테스트가 **같은 해석**을 공유 → 해석이 틀리면 둘 다 틀린다(순환 oracle).

`tests/tree_golden.rs` 는 **11 test / 10 fixture(N1~N10)** + `field_contract_guard` 1 으로 구성되나, **Chrome 실측 기반은 N1~N5 5개뿐**이다 — 헤더가 "fixture 원본: dualRunLive.test.ts C-2b N1~N5" 로 한정하고, N6 는 "Chrome 실측이 아니라 box-sizing:border-box 계약을 CSS 산술로 손계산 고정" 이라고 자인한다. N7~N10 은 근거 주석이 없어 실측 여부 불명 → **독립 oracle 로 셈하지 않되 회귀 기준선으로는 전수 유지**(G1).

본 Phase 는 **실제 Chrome 을 ground truth 로 하는 자동 차등 테스트**를 도입한다.

### 2-2. 하니스 구조 (세션 검증 완료 — scratchpad 프로토타입 존재)

```
case = { name, availW, availH(-1=auto), nodes: [...] }   // post-order, root 마지막
node = { label, style(공통), css(DOM 전용 키), eng(엔진 전용 키), children:[idx] }

leg 1 (ground truth) : DOM 생성 → 리셋(margin/padding/border 0 + box-sizing:border-box)
                       → getBoundingClientRect → root-상대 정규화
leg 2 (engine)       : LayoutEngine.buildTreeBatch(JSON) → computeLayout(root, availW, availH)
                       → getLayoutsBatch → 조상 offset 누적(절대화) → root-상대 정규화
diff                 : |css - eng| > 1.0px 인 (node, field) 나열
```

좌표 규약은 `tree_golden.rs::layout_relative` 와 **동일** — 엔진 좌표는 부모 content-box 상대이므로 조상 누적이 소비처 책임 (`project-adr916-tree-golden-independent-oracle` 계약).

### 2-3. 실행 형태 결정 (Phase 1 에서 확정)

`playwright.config` 가 현재 **부재**하고 (`test:e2e` script 만 존재), vitest 환경은 `jsdom` 이라 **레이아웃 계산이 없어 oracle 이 될 수 없다**. 후보:

- **후보 1 (권장)**: Playwright config 신설 → dev 서버 기동 → 엔진 WASM 을 페이지에서 import → 매트릭스 in-page 실행 → 실패 목록 assert. 두 leg 가 한 번에 돌아 상수 고정 불필요.
- 후보 2: Chrome 실측 결과를 `tree_golden.rs` 상수로 freeze (기존 패턴 답습). 자동 회귀는 되나 **fixture 추가 때마다 수동 측정** — 순환 oracle 은 끊되 확장 비용이 남는다.

실행 게이트(G1): "기존 tree_golden **N1~N10 전수** 재현 + §1-2 의 12행(672 조합 포함) 통과 + 반복 실행 flaky 0".

### 2-4. 하니스 자체 캘리브레이션 (필수)

하니스가 틀리면 모든 결과가 무의미하다. **기존 Chrome 검증 fixture(N1 flex-in-flex)를 하니스로 재현해 통과**시키는 것을 Phase 1 완료 조건에 포함한다 (세션에서 1회 확인 완료).

### 2-5. 진행 상태 — 1차 land (2026-07-18, commit `614bbd3c3`, → §2-6 에서 완결)

vehicle 확정 + 하니스 핵심 land 완료:

- **vehicle = `@vitest/browser` + Playwright(Chromium)** (후보 1 변형 — dev 서버 대신 vitest 가 엔진 WASM 을 직접 번들). `apps/builder/vitest.browser.config.ts` + `tests/parity/engineCssParity.browser.test.ts` + `pnpm -F @composition/builder test:parity`. 의존 `@vitest/browser-playwright@4.1.9` + chromium-1228.
- **leg 1** 실 DOM `getBoundingClientRect`(리셋 후 root-상대) / **leg 2** `buildTreeBatch → computeLayout → getLayoutsBatch` + `tree_golden.rs::layout_relative` 조상 offset 누적 이식. diff > 1px.
- **tree_golden N1~N10 전수 재현 10/10 PASS** — N6~N10 손계산 기준선을 실 DOM 으로 재확증. flaky 0 (3회).

### 2-6. G1 매트릭스 재도출 완결 (2026-07-18)

§1-2 672 조합 파라메트릭 매트릭스를 재도출해 land. 원본 생성기(scratchpad 소실)의 축 값 열거를 §1-3 소비 판정 + 조합 수(384/288)로 역산:

- **교차축 384** = direction(2) × wrap(2) × alignItems(4: flex-start/end/center/stretch) × alignContent(6: +space-between/around) × crossSize(2: definite/auto) × lines(2). 전부 **소비 O 필드**(align_self=E1 등 미소비 9필드 제외).
- **main 축 288** = direction(2) × justifyContent(6) × gap(2) × grow(2) × shrink(2) × basis(3: auto/0/50px).
- 구조: 테스트 컨테이너를 definite `root`(200×500 block) 아래 **중첩** — root 자기 크기(E5) 격리. `tests/parity/{harness.ts, flexSweep.browser.test.ts}`.
- **결과: 384/384 + 288/288 + tree_golden 10/10 = 전부 PASS, flaky 0 (3회)**. **G1 충족 → Phase 1 완결**.

**하니스가 표면화한 잠복 발산 2종 (문서화 17군 밖, 비-라이브 → 후속 판정)**:

1. **nested block-level flex 컨테이너 `width:auto`** — CSS 는 block inline 채움(부모 200), 엔진은 shrink-to-fit(70). `display:block` 부모 명시로도 재현 → 실 발산. **비-라이브**: catalog `containerStyles` 가 항상 width(px/100%) 주입 → builder 도달 불가. 매트릭스는 builder-정확 패턴 `width:100%`(N10 계약, 양쪽 채움)로 구성.
2. **overflow flex 정렬** (`justify-content`/`align-content` = flex-end·center + 음수 free space) — CSS 는 unsafe 음수 offset(시작 밖 overflow), 엔진은 0 클램프. **비-라이브**: 정합 region 은 양수 free space. 매트릭스는 컨테이너를 children 합보다 크게 구성해 회피.

두 발산 모두 「선언 O · 송신 O · 소비 O 이나 해석 상이」 축(§1-3 40필드 중)에 해당 — E-list 미등재. 라이브 도달 경로 확인 시 후속 ADR 또는 §Residual 편입 판정.

## 3. Phase 2 — align-self / justify-self + percent height (G2)

**대상**: E1 (사용자 도달 가능 유일 1차 결함) + **E6** (round 2 승격 — E1 동급 severity).

### 3-1. E1 사슬 (실측 확인)

```
Inspector 정렬 피커 (TransformSection.tsx:235 handleSelfAlignment)
  → updateStylesImmediate({ alignSelf: pos.vertical, justifySelf: pos.horizontal })
  → store props.style
  → LAYOUT_STYLE_KEYS: alignSelf 는 등재(layoutCache.ts:84) / justifySelf 는 미등재 ← R6
  → taffyStyleToRecord (fullTreeLayout.ts:664-665) 가 엔진에 송신
  → 엔진 NodeStyle.align_self 선언 (tree.rs:123)
  → 읽는 코드 0곳  ← 여기서 소멸
  → Skia 무반응 / Preview(CSS) 는 정상 적용 → 비대칭
```

작업:

1. **`layoutCache.ts` — `LAYOUT_STYLE_KEYS` 에 `justifySelf` 추가 (R6, 필수 선행)**. 이것 없이 엔진만 고치면 9칸 피커의 **가로 이동이 캐시 히트로 흡수**되어 무반응 (`leftTop`→`centerTop` 은 alignSelf 불변·justifySelf 만 변경).
2. `flex.rs` — `place_line_cross_axis` 가 per-item `align_self` 를 받아 컨테이너 `align_items` 를 override. `auto` = 컨테이너 값 상속 (CSS 기본).
   - 주의: `parse_align_items`(`tree.rs:1477-1485`)는 `stretch/normal/기타 → 0` 이라 **`auto` 를 표현할 값이 없다**. align_self 용 센티넬(예: 4=auto)을 추가하거나 `Option<u8>` 로 구분할 것 — 그대로 재사용하면 `auto` 가 강제 stretch 로 잘못 매핑된다.
   - 값 어휘는 확인 완료: 파서가 `Some("flex-start") | Some("start")` 양쪽 수용 → Inspector 의 `start`/`center`/`end` 그대로 통과.
3. `tree.rs` — flex 자식 파싱 시 `style.align_self` → FlexItem 필드 주입 (`FLEX_FIELD_COUNT` 확장 시 `golden.rs:368` 의 `assert_eq!(FLEX_FIELD_COUNT, 17)` 이 즉시 RED → `golden.rs`/`tree_golden.rs` 동반 갱신 — R2).
4. `justify_self` 는 flex 에서 **무효** (CSS: flex item 에 justify-self 미적용) — grid 전용이므로 Phase 3 에서 처리. flex 경로에서는 의도적 무시임을 주석 명시. 단 **캐시 키 등재는 Phase 2 에서** (위 1번 — grid 도달 전에 피커가 이미 두 키를 함께 쓰므로).

### 3-2. E6 — percent height 폭 기준 오해석 (R8)

근원: `ctx_for(avail)`(`tree.rs:1350-1358`)가 `container_size: Some(avail)` **단일 축**만 담는다. 소비처가 이 ctx 하나로 가로·세로 percent 를 모두 해석:

- block: `write_block_item(&mut data, i, &cstyle, cw, ch, &ctx)` (`tree.rs:1066`) — `ctx` 는 `ctx_for(child_avail_w)` (폭)
- flex column: `resolve_dimension_opt(main_raw, &ctx)` (`tree.rs:905,919`) — `main_raw` 가 height 인데 ctx 는 폭

작업:

1. `CssValueContext` 에 세로 기준축 추가 (또는 `resolve_dimension_opt` 에 축 파라미터 도입).
2. **축 분리는 `height`/`minHeight`/`maxHeight`/`top`/`bottom` 계열에만 적용**. `padding`/`margin` 의 percent 는 **폭 기준이 CSS 정답**이며 §1-2 의 `BP-3/4`·`FPM-1` 에서 이미 정합 확인됐다 — 세로축 도입이 이를 폭→높이로 바꾸면 즉시 회귀 (R8).
3. auto 높이 부모의 percent 자식: CSS 는 **미해결(auto 취급)** — 실측상 CSS 0 vs 엔진 100 (PH-1, FP-1). auto 부모에서는 percent height 를 auto 로 처리.

회귀 기준: §1-2 전 12행 (672 조합 + 2차 sweep 정합 영역) + Rust 283 (`--lib` 256 / golden 15 / tree_golden 11 / doc 1).

live 검증(G2): Inspector 9칸 피커 **가로 전용 이동**(`leftTop`→`centerTop`) → Skia 반영 → Preview 대칭 + Transform % 높이 편집 → Skia 반영. **세로 이동 단독 검증 금지** (R6 을 가림).

### 3-3. 진행 상태 — Phase 2 반영 완료 (2026-07-18, commit `6a2c50d0b`)

**E1 + E6 land 완료, G2 충족.**

- **E1 align-self**: `flex.rs` `FLEX_FIELD_COUNT` 17→18 (off 17=align_self, **0=auto 상속** = zero-init·CSS 기본값이라 기존 golden/테스트 배열 무변경). `place_line_cross_axis` 가 per-item `align_self` 를 `resolve_self_align` 로 해소해 컨테이너 `align_items` override. `tree.rs` `parse_align_self` + `write_flex_item` off 17 주입. `justify_self` 는 flex 무효(grid 전용, Phase 3)라 캐시 키만 등재 — 소비는 Phase 3.
- **R6**: `layoutCache.ts` `LAYOUT_STYLE_KEYS` 에 `justifySelf` 등재.
- **E6 percent height**: `main_ctx`(column=height)·min/max·`write_block_item`(신규 `height_ctx` 파라미터) 를 축별 ctx 로 라우팅. **컨테이너 height 명시 definite 일 때만 실축, auto 면 INDEFINITE→percent auto**(CSS §10.5) — `write_block_item`(height_ctx)·leaf `resolve_self_size`(solve_block 의 `child_containing_h`) 양 경로 동일 게이트. padding/margin percent 는 폭 기준 유지(R8).
- **필드 계약(R2)**: `golden.rs:368` assert 17→18, `flex_item` 헬퍼 `[f32; 18]`(off 17=0=auto → golden 기대값 무변경).
- **검증**: cargo test **288**(`--lib` 261 = 기존 256 + 신규 align_self 5 / golden 15 / tree_golden 11 / doc 1) · Chrome 차등 파리티 `tests/parity/phase2.browser.test.ts` 8 fixture(E1 4 + E6 4) + 672 sweep 무회귀 + N1~N10, **flaky 0**(3회) · type-check baseline 63 무증가 · **live**(Chrome MCP): 빌더 store 편집 → align-self 3자식 cross 0·40·80px 계단(flex-start/center/end) + alignSelf 편집 시 relayout(+80 이동, R6 캐시 키 정상) + `height:50%`→150(=50%×300), 테스트 요소 6개 제거 후 프로젝트 원복.
- **회귀 기준선 수치 갱신**: Rust 283→**288** (align_self 5 추가). 본 breakdown §8 · 본문 Hard constraint 의 "283" 은 이 값으로 승계.

## 4. Phase 3 — grid 커널 (G3, HIGH)

**대상**: E2 + **E12/E13/E14** (round 2 흡수 — 근원이 동일 커널).

`grid.rs` 는 정렬 처리가 **0줄**이다 (grep `justify|align` → 0 hit). 현재 grid 자식은 항상 셀 크기로 stretch 되며 **자식의 명시 width/height 마저 덮어쓴다**. 여기에 컨테이너 축 정렬(E12)·span 인지 placement(E13)·auto 트랙 계열(E14)이 모두 같은 커널에 얹힌다.

**HIGH 위험 (R3)**: JS 레이어가 이미 엔진의 grid 한계를 우회 보정하고 있다 — `fullTreeLayout.ts:1516-1528` 이 grid 컨테이너 자식의 **available width** 를 `(childAvail.width - totalGap) / numCols` 로 사전 축소하고, 그 값으로 `enrichWithIntrinsicSize` 가 자식 width 를 주입한다(`utils.ts:4381`). 엔진이 자식 크기를 존중하도록 고치면 **이중 적용**되어 폭이 붕괴할 수 있다.

따라서 Phase 3 은 **책임 경계를 먼저 확정**한다:

- 옵션 3-a: 엔진이 CSS 대로 자식 크기/정렬을 처리 → JS DFS 사전 조정 **제거**. (근본적, 회귀 범위 큼)
- 옵션 3-b: 엔진은 정렬(위치)만 추가하고 크기 stretch 는 유지 → JS 사전 조정 존속. (범위 작음, `justify-items:start` 의 fit-content 의미는 여전히 발산)

작업 순서:

1. **캐시 키 등재 (R6 선행)**: `LAYOUT_STYLE_KEYS` 에 `justifyItems` · `gridAutoColumns` · `gridAutoRows` · `gridColumnStart` · `gridRowStart` 추가. `gridColumn`/`gridRow` shorthand 만 등재된 현 상태는 `layout-engine.md` 가 factory 에 요구하는 **숫자 line 병기** 형태와 어긋난다.
2. 옵션 확정 후 `grid.rs` 에 자식 정렬(E2: `justify-items`/`align-items`/`align-self`/`justify-self`) 구현.
3. 컨테이너 트랙 정렬(E12: `justify-content`/`align-content`) + auto 트랙 stretch 구현.
4. placement 커서를 span 인지로 교정(E13) — 점유 셀 스킵.
5. `grid_auto_flow`/`grid_auto_columns`/`grid_auto_rows` 소비(E14).
6. grid 커널은 현재 min/max clamp 소비가 0 → E2 구현 시 함께 도입 검토.

G3 통과 조건에 **live builder grid 컴포넌트 시각 회귀 0** 을 포함한다 (ProgressBar 등 grid 사용처 — `project-adr916-grid-gap-offset-succession-bug` 이력 있는 영역).

### 4-1. 진행 상태 — Phase 3 반영 완료 (2026-07-18, 옵션 3-b 채택)

**책임 경계 확정 = 옵션 3-b** (사용자 승인): 엔진은 정렬(위치)만 추가하고 크기 stretch 유지, JS DFS 사전 조정(`fullTreeLayout.ts:1516` 트랙 폭 강제) 존속. E2 + E12 + E13 + E14 반영, G3 충족. 4 sub-commit:

- **3-α (R6+E13, `efb73aebc`)**: `LAYOUT_STYLE_KEYS` 에 `justifyItems`·`gridAutoColumns/Rows`·`gridColumnStart/RowStart` 등재. E13 = CSS-GRID-1 §8.5 **2-phase occupancy 배치**(Phase 0 명시 row 먼저 → Phase 1 auto 커서) — 구 `child_index%cols` 가 span 점유를 무시하던 것(row-span 아이템과 auto 아이템 열 뒤바뀜)을 정정. `parse_grid_line` → `parse_axis_placement`(위치 명시/span 분리).
- **3-β (E12, `9da71d972`)**: `track_distribution`(start/center/end/space-\*) 로 고정 트랙셋을 컨테이너 안 정렬(justify-content 열 / align-content 행). fr/auto 는 free≈0 → 무영향.
- **3-γ (E14, `0a235507d`)**: `place_children` flow-aware(column-major 커서), flow:column 시 gridAutoColumns 로 암시 열 확장.
- **3-δ (E2, `7d391f78d`)**: `grid_block_align` 로 **비-stretch align(세로)** 시 자식 실제 height 로 셀 세로 배치. 기본 stretch 유지.

**검증**: cargo **293**(신규 grid: span occupancy / axis placement / justify center·space-between / fr-no-offset / auto-flow column / align) · Chrome 차등 파리티 `tests/parity/phase3.browser.test.ts` **8 fixture**(E13 2 + E12 3 + E14 1 + E2 2) + 기존 20 무회귀, flaky 0 · type-check baseline 63 무증가 · **live**(Chrome MCP): 기본 stretch grid 2×2 셀 채움(회귀 0) + align-items:center 자식 y=30(중앙)·edit→start y=0(relayout) + column span 2 뒤 자식 2행 밀림, 테스트 11요소 제거 후 원복.

**§Residual (옵션 3-b 계약 — 후속 판정)**:

- **justify-items/justify-self (가로 배치·크기)** — JS DFS 가 grid 자식 폭을 트랙 폭으로 강제하므로 엔진이 justify 를 더해도 live 에서 이중 적용/무효. 옵션 3-a(엔진 크기 respect + JS DFS 제거)로만 해소 가능. 파리티(엔진 직접 경로)에선 정합하나 live 는 미달 → E2 justify 축 fixture 미추가.
- **align:stretch 하 explicit-height 자식 축소** — CSS 는 explicit-height grid item 을 stretch 안 하나(자기 크기 유지), 옵션 3-b 는 stretch 유지(`grid_implicit_auto_row_multi_row_max_height` 등 live 의존 테스트). 옵션 3-a 영역.
- **gridAutoRows override(flow:row 암시 행)** — tree.rs `solve_grid` intrinsic 측정이 암시 행 크기를 소유. gridAutoRows px 로 override 하려면 tree.rs intrinsic 분기 수정 필요 → `grid_layout` 의 `auto_rows` 파라미터 현재 미소비(`let _ = auto_rows`).

## 5. Phase 4 — block/flex flow (G4)

**대상**: E3 + **E7**(음수 margin) + **E8**(reverse) + **E17**(overflow BFC — E3 와 동시 필수).

### 5-1. E3 부모-자식 마진 상쇄

`block.rs` 는 인접 형제 상쇄는 구현했으나(실측 통과), **부모-자식 상쇄**(첫 자식의 margin-top / 마지막 자식의 margin-bottom 이 부모 밖으로 탈출)는 미구현이다. 엔진은 항상 "상쇄 차단" 처럼 동작한다.

CSS 규칙: 부모에 `padding-top`/`border-top`/BFC 생성 요인이 없으면 첫 자식의 top margin 이 부모와 상쇄된다. **부모에 padding 이 있으면 차단** — 이 경우는 엔진이 이미 정확하다(실측 통과 → R4 회귀 기준선).

주의: root 노드에서의 탈출은 **시각적으로 무해**할 수 있다 (탈출한 마진이 root 자체를 밀어 결과적으로 같은 위치). 실질 발산은 **중첩 컨테이너의 높이**(`mid.h` 20 vs 50)와 그로 인한 형제 위치 전파다. 수정 범위 판단 시 이 구분 유지.

### 5-2. E17 overflow BFC (E3 와 **동시 구현 필수**)

`overflow: hidden/scroll/auto` 는 BFC 를 생성해 **부모-자식 상쇄를 차단**한다. 현재 `overflow_x`/`overflow_y` 는 소비 0이지만, "상쇄 자체가 미구현" 이라 결과가 우연히 일치한다(BC-2 diff 0 — 잠복).

**E3 만 구현하고 E17 을 빠뜨리면**: overflow 컨테이너에서 상쇄가 일어나 **새 발산이 생긴다**. 따라서 G4 는 E3 단독 통과를 인정하지 않는다.

작업: ① `LAYOUT_STYLE_KEYS` 에 `overflowX`/`overflowY` 등재 (R6) ② `block.rs` 상쇄 로직에 BFC 차단 조건(padding/border/overflow≠visible)을 함께 판정.

### 5-3. E7 음수 margin / E8 reverse

- E7: flow 배치에서 음수 margin 을 좌표 산술에 반영 (현재 absolute translate 패턴만 지원). 형제 위치·컨테이너 크기 양쪽 영향.
- E8: `flex_direction` 의 `row-reverse`/`column-reverse` 와 `flex_wrap` 의 `wrap-reverse` 소비. 현재 `parse_flex_wrap`(`tree.rs`)이 `wrap-reverse` → `WRAP_WRAP` 로 **정규화하며 reverse 정보를 버린다** — 파서와 배치 양쪽 수정 필요. `flexDirection` 은 캐시 키에 이미 등재됨(추가 작업 없음).

### 5-4. 진행 상태 — Phase 4 반영 완료 (2026-07-18, commit `6abd83aac`)

**구현 (엔진 = `packages/composition-engine/src`)**:

- **E7 음수 margin**: `write_flex_item`/`write_block_item` 의 margin 4필드를 `resolve_dimension`(음수 `n >= 0.0` 필터로 0-clamp) → `resolve_signed`(음수 보존)로 교체. block.rs `collapse_margins`(mixed/음수 정확) + flex.rs `place_line_main_axis` cursor 가 이미 음수를 처리해, 형제 당김(flex b.x 30)·auto-width 확장(block b.w = avail − m_left − m_right = 320)이 복원됐다.
- **E8 reverse**: `solve_flex` 배치 직후 **순수 기하 reflection** 후처리. row/column-reverse 는 main 물리축, wrap-reverse 는 cross 물리축을 반사한다. 정의역은 definite 컨테이너 크기(없으면 forward content extent). `flex_direction_is_reverse`/`flex_wrap_is_reverse` 헬퍼 추가. flex.rs 커널·golden 계약 무변경 → R2 회피. 3종 전부 파리티 + live 반영(a.x 160 / c.y 170).
- **E3 부모-자식 상쇄 + E17 overflow BFC**: `solve_block` 이 차단 요인(`overflow_creates_bfc` / top·bottom `pad_border` / flex·grid item = `parent_is_flex_or_grid`) 부재 시 `can_collapse_top`/`bottom` 을 활성화해 `block::block_layout` 에 전달. metadata(first/lastChildMargin)로 탈출 margin 을 회수 — 자식 y 에서 `escaped_top` 차감(content 원점 정렬) + 컨테이너 height 에서 제외 + `TreeNode.escaped_mt/mb` 로 조상 hoist(상쇄 chain 전파). `block::collapse_margins` pub 화, `node_establishes_bfc`(자식 BFC → bfc_flag), `pad_border_end` 헬퍼 추가.
- **R6**: `LAYOUT_STYLE_KEYS`(`layoutCache.ts`)에 `overflowX`/`overflowY` 등재.

**검증**: `cargo test` 293(266 lib + 15 golden + 11 tree_golden + 1 doc — Phase 4 는 파리티로 검증, Rust 단위 무증가) / 파리티 `phase4.browser.test.ts` 8/8 + 전체 스위트 36 flaky 0 / type-check baseline 63 무증가.

**§Residual (E3/E17 block height live 마스킹)**: 엔진은 정확(파리티 + live 직접 호출 mid.h=20)하나, 빌더 파이프라인이 auto-height block 컨테이너 높이를 **JS 선계산**(`calculateContentHeight`/`enrichWithIntrinsicSize`, utils.ts — 마진 상쇄 미구현)으로 주입해 live Skia 는 mid.h=50(상쇄 전)을 그린다 → 엔진 변경이 block 경로에서 live-inert(회귀 0). ADR §Residual + R5 Layer 2 후속에 구체 항목으로 등재. flex 경로(E7-flex, E8)는 엔진 결과가 Skia 까지 도달해 live 반영됨.

## 5.5. Phase 4.5 — 좌표계 (G4)

**대상**: E10(`position:relative` inset offset) + E11(absolute 3종).

flow 수정(Phase 4)과 축이 독립적이라 분리한다. `position`/`top`/`left`/`right`/`bottom` 은 캐시 키에 이미 등재됐다.

- E10: relative 는 in-flow 취급이 정상이고 **시각 offset 만 소실** → 배치 후 offset 적용 단계 추가.
- E11: ① 양측 inset 지정 + 크기 auto → stretch (`k.w` 180 vs 0) ② inset 무지정 → static position 유지 (`k.y` 30 vs 0) ③ `margin:auto` + 양측 inset → 중앙 (`k.x` 80 vs 0). ABS-2(% inset)는 이미 정합이므로 회귀 기준선.

## 6. Phase 5 — margin auto + root self-sizing + aspect-ratio (G5)

**대상**: E4, E5(결함군 전체), **E15**(round 2 흡수). 전부 라이브 노출이 잠재적이라 후순위.

- E4 `margin:auto`: block 은 가로 중앙(남는 공간 균등 분배), flex 는 main/cross 축 auto 마진이 free space 를 흡수(justify-content 보다 우선). Inspector 입력 경로가 없어 현재는 잠재 — 다만 pencil import / 향후 정렬 기능이 유입 경로. E11 ③ 과 로직 공유 가능.
- E5 root 결함군: `compute_layout(root, w, -1)` 의 root 자기 크기 경로에서 ① padding/border 를 auto 높이에 합산 ② 무폭 flex/grid root 가 availW 를 채우도록 ③ 자기 min/max clamp 적용. **중첩 경로는 이미 정확**하므로 root 분기만 정합하고, NST-1~4(중첩 4형상)를 회귀 기준선으로 고정.
- E15 `aspect_ratio`: 한 축 명시 + ratio 로 다른 축 파생. 캐시 키 등재됨(추가 작업 없음). `tree.rs:172` 선언은 있으나 소비 0.

## 7. Phase 6 — 종결 (G6)

- **(R7) `NodeStyle` 정적 가드 신설** — 기존 `golden.rs:368` 의 `assert_eq!(FLEX_FIELD_COUNT, 17)` 패턴을 승계해:
  - `NodeStyle` 필드 수 assert (현재 49)
  - **미소비 allowlist** 를 코드 상수로 고정하고 §Residual 잔존(E16 `order` 등)과 1:1 일치 검증
  - 필드 추가 시 가드가 RED → §1-3 교차표 갱신을 강제 (문서 표 단독은 stale 화 — 본 ADR 이 발견한 미소비 9필드가 현재 어떤 테스트에도 걸리지 않는다는 사실이 근거)
- CHANGELOG 반영 (사용자-가시 수정 — E1/E6/E7/E8 최소)
- README 표 Implemented 승격 + 요약 갱신
- 미해결 잔여를 본문 §Residual 에 기록 (옵션 3-b 채택 시 grid fit-content 잔존 등)

## 8. 검증 계약 (전 Phase 공통)

- Rust: `cargo test` — 총 **283** (`--lib` 256 / `--test golden` 15 / `--test tree_golden` 11 / doc 1)
- 차등: §1-2 의 **12행 전체**(672 조합 포함) 무회귀 + 담당 Phase 의 발산 fixture 0
- **(R6) 캐시 키 등재**: 해당 Phase 의 §1-3-b 행이 `LAYOUT_STYLE_KEYS` 에 반영됐는지 확인 — 미등재 상태의 live 검증은 "무반응" 을 엔진 결함으로 잘못 판정하게 한다
- **live behavior 필수** (CLAUDE.md 완료 기준): Phase 2/3 은 실제 빌더에서 Inspector 조작 → Skia 반영 → Preview 대칭을 Chrome MCP 로 1회 exercise. **해당 키만 변하는 조작으로 수행** (Phase 2 = 가로 전용 이동). test PASS 단독 종결 금지.
- `pnpm type-check` baseline 무증가
- **WASM 재빌드 필수**: `pnpm wasm:build:engine` — 산출물(`composition-engine-pkg/`)은 gitignore 라 Rust 만 고치고 재빌드를 빠뜨리면 live 무변화 (`feedback-cargo-stale-binary-mtime-after-sed-revert`).
