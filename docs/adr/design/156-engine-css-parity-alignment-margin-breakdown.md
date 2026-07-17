# ADR-156 구현 상세 — composition-engine CSS 정합 복구

> 본 문서는 [ADR-156](../156-engine-css-parity-alignment-margin.md) 의 구현 상세다. 결정/위험/Gate 는 본문 참조.

## 1. Phase 0 inventory — 실측 기준선 (freeze 대상)

### 1-1. 발산 5종 실측 (2026-07-17, Chrome 차등 하니스)

각 행은 root-상대 좌표, TOL 1px. 재현 fixture 는 §2 참조.

| ID  | 발산                                                          | 최소 재현                                                          | CSS → 엔진                            | 라이브 노출                           |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------- | ------------------------------------- |
| E1  | flex/grid `align-self` / `justify-self` 전면 무시             | `align-items:flex-start` 컨테이너(h 100) + 자식 `alignSelf:center` | `k.y` 40 → **0**                      | **사용자 도달 가능** (Inspector 피커) |
| E2  | grid `justify-items`/`align-items` 무시 + 자식 명시 크기 무시 | `grid` 1fr + 자식 `width:40px`, `justifyItems:end`                 | `c.x` 160 → **0**, `c.w` 40 → **200** | 부분 (JS DFS 가 폭만 보정)            |
| E3  | 부모-자식 마진 상쇄 미구현                                    | `block` mid + 자식 `marginTop:30px`                                | `k.y` 0 → **30**, `mid.h` 20 → **50** | 도달 가능 (block 컨테이너)            |
| E4  | `margin:auto` 정렬 미구현 (block + flex)                      | `block` mid + 자식 `marginLeft/Right:auto`, `width:80px`           | `k.x` 60 → **0**                      | 잠재 (Inspector 입력 경로 없음)       |
| E5  | **root** 노드 auto 높이가 자기 padding/border 누락            | root `height:auto` + `padding:10px`                                | `root.h` 40 → **20**                  | 잠재 (라이브 root 는 명시 높이)       |

**E5 범위 한정 (중요)**: 같은 padding 노드가 **중첩(비-root)** 이면 통과한다(실측 확인). `compute_layout(root, w, -1)` 의 root 자기 auto 높이 계산에만 결함. 명시 높이 root 는 통과 → 엔진의 border-box 계약 자체는 정상.

### 1-1-b. 2차 정밀 sweep 발산 (2026-07-17, 하니스 49 케이스 — G0 전수 완성분)

정적 3축 교차표 전수 완성(§1-3) + 확장 매트릭스 실측에서 **추가 발산 12군(E6~E17)** 이 확인됐다. "도달 가능" = Inspector 편집 경로 실존을 grep 으로 확인한 것.

| ID  | 발산                                                                                                                                                            | 최소 재현 (케이스)                                            | CSS → 엔진                                                                  | 라이브 노출                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| E6  | percent height 를 **폭 기준으로 해석** — block 은 `write_block_item` 단일 폭 ctx(`tree.rs:1066`), flex column 은 `laid_out_main` 의 폭 `ctx`(`tree.rs:905,919`) | block root(h300) + 자식 `height:50%` (BP-1/2)                 | `k.h` 150 → **100** (=50%×폭200). auto 부모: CSS 0 vs 엔진 100 (PH-1, FP-1) | **도달 가능** (Transform 섹션 % 단위)                       |
| E7  | 음수 margin 을 flow 배치에서 무시 (absolute translate 패턴만 지원)                                                                                              | 형제 `marginTop:-10px`/`marginLeft:-20px` (BM-1)              | `b.x` -20 → **0**, `b.y` 10 → **20**                                        | **도달 가능** (Inspector 음수 입력)                         |
| E8  | `row-reverse`/`column-reverse`/`wrap-reverse` 전면 무시 (정방향으로 배치)                                                                                       | row-reverse 2자식 (FRV-1/2, FWR-1)                            | `a.x` 160 → **0**                                                           | **도달 가능** (`styleOptions.ts:80-81` Direction 옵션 노출) |
| E9  | `align-items:baseline` 미구현 (flex-start fallback — 빈 박스 baseline=하단 조차 미적용)                                                                         | h20/h50 형제 baseline (BL-1)                                  | `a.y` 30 → **0**                                                            | 잠재                                                        |
| E10 | `position:relative` inset offset 무시 (in-flow 취급은 정상, 시각 offset 만 소실)                                                                                | relative + top10/left15 (REL-1)                               | `k.x` 15 → **0**, `k.y` 10 → **0**                                          | 도달 가능 (left/top → inset 송신 확인)                      |
| E11 | absolute 3종 미구현 — ① 양측 inset 지정 시 크기 stretch(ABS-1/4) ② inset 무지정 static position(ABS-3) ③ `margin:auto` 중앙(ABS-5)                              | left+right 지정 + width auto                                  | `k.w` 180 → **0** / `k.y` 30 → **0** / `k.x` 80 → **0**                     | 도달 가능                                                   |
| E12 | grid 컨테이너 트랙 정렬 `justify-content`/`align-content` 무시 + **auto 트랙 align-content:stretch 미구현** (definite 높이의 잉여 공간 분배 없음)               | justifyContent:center 고정 트랙 (GJC-1, GAC-1, GAR-2)         | `c0.x` 50 → **0** / implicit 행 100 → **30**                                | 부분 (E2 인접 — grid.rs 정렬 0줄의 컨테이너 축)             |
| E13 | grid auto-placement 가 **span 을 무시** (placement 커서가 점유 셀을 스킵하지 않음)                                                                              | column/row span 2 + 후속 자식 (GSP-1/2)                       | `c1.y` 30 → **0** (span 아래가 아니라 옆에 배치)                            | 도달 가능                                                   |
| E14 | `gridAutoFlow`/`gridAutoColumns`/`gridAutoRows` 미소비 — flow:column 이 row 로, 명시 auto 트랙 크기가 intrinsic 으로 degrade                                    | flow:column + autoColumns 60px (GAF-1), autoRows 40px (GAR-1) | `c2.x` 60 → **0**, 행 40 → **0**                                            | 도달 가능                                                   |
| E15 | `aspect_ratio` 미소비 (한 축 명시 + ratio 파생 크기 전면 소실)                                                                                                  | `width:100px` + `aspectRatio:2` (AR-1/2/3)                    | `k.h` 50 → **0**                                                            | 도달 가능 (Image 계열 유입 경로)                            |
| E16 | `order` — NodeStyle **선언조차 없음** (serde silent drop). 송신은 존재(`taffyStyleToRecord` order emit)                                                         | `order:-1` 중간 자식 (ORD-1)                                  | `b.x` 0 → **40** (재배열 무시)                                              | 잠재 (Inspector 편집 UI 없음)                               |
| E17 | `overflow_x/y` 미소비 — **현재는 E3 부재가 가림** (overflow BFC 의 상쇄 차단과 "상쇄 자체 미구현"이 우연 일치, BC-2 diff 0)                                     | overflowY:hidden + 자식 marginTop (BC-2)                      | 현재 diff 0 (**잠복**)                                                      | Phase 4 (E3) 구현 시 BFC 차단 조건 결합 의무                |

**E5 확장 — root self-sizing 결함군 재정의 (2026-07-17)**: E5 는 "root auto 높이 + padding 누락" 단건이 아니라 **root 자기 크기 경로 전반의 결함군**이다. 실측: ① border 도 동일 누락 (RT-1, h 30→20) ② 무폭 flex/grid root 가 availW 를 채우지 않고 fit-content 로 수축 (RT-2, w 200→40) ③ root 자기 min/maxHeight clamp 무시 (MH-1 30→80 미달, MH-2 100→50 초과). **중첩이면 4형상 전부 정합** (NST-1~4: 무폭 fill·minHeight·maxHeight·grid fill) — 라이브 root(body)는 명시 크기라 전부 잠재이나, Phase 5 (E5) 작업 시 이 결함군 전체를 함께 정합할 것.

### 1-2. 정합 확인 영역 (회귀 기준선 — Phase 2~5 가 깨면 안 됨)

| 축                                                                                                    | 조합 수 | 결과                                 |
| ----------------------------------------------------------------------------------------------------- | ------: | ------------------------------------ |
| flex 교차축 (direction × wrap × align-items × align-content × definite/auto × 1줄/2줄)                |     384 | 전부 통과                            |
| flex main 축 (direction × justify-content × gap × grow × shrink × basis)                              |     288 | 전부 통과                            |
| 인접 형제 마진 상쇄                                                                                   |       — | 통과                                 |
| box-sizing border-box (명시 크기 + padding/border)                                                    |       — | 통과                                 |
| 부모 padding 이 마진 상쇄를 차단하는 경우                                                             |       — | 통과                                 |
| grid 트랙 산술 — percent / minmax(40px,1fr) / repeat(2,1fr) / auto intrinsic (2차 sweep GT-1~4)       |       4 | 통과                                 |
| grid gap 위치 산술 rowGap/columnGap (GGAP-1 위치 축)                                                  |       — | 통과                                 |
| percent padding/margin 폭 기준 해석 — block+flex (BP-3/4, FPM-1)                                      |       — | 통과                                 |
| flex item min/max clamp 재분배 + flexBasis % (FMM-1/2, FB-1)                                          |       — | 통과                                 |
| fit-content (+minWidth clamp) / inline-block 형제 / display:none 제외 (FIT-1/2, IB-1, DN-1)           |       — | 통과                                 |
| **중첩** 컨테이너 자기 크기 — 무폭 fill·min/maxHeight clamp·grid fill (NST-1~4)                       |       4 | 통과 (root 만 결함 — §1-1-b E5 확장) |
| absolute % inset / space-between+margin / wrap+rowGap / 인접 상쇄 비대칭 (ABS-2, FJC-1, FWG-1, BMB-1) |       — | 통과                                 |

### 1-3. 엔진 필드 3축 교차표 (Phase 0 산출물 — G0)

각 `NodeStyle` 필드를 **선언(tree.rs) / 소비(읽는 코드 존재) / 송신(파이프라인이 실제로 보냄)** 3축으로 전수 분류한다. 본 ADR 이 다루는 것은 **선언 O + 송신 O + 소비 X** 칸이다.

**전수 확증 완료 (2026-07-17 2차 sweep)** — NodeStyle 49필드 전체를 `.{field}` 접근 grep 으로 분류한 결과, 「선언 O · 송신 O · 소비 X」 는 3건이 아니라 **8건**이며, 「선언 X · 송신 O」(serde silent drop) 2건이 별도로 존재한다:

| 필드                  | 선언            | 소비     | 송신 (파이프라인)                                                                             | 발산 ID |
| --------------------- | --------------- | -------- | --------------------------------------------------------------------------------------------- | ------- |
| `justify_items`       | tree.rs:115     | **없음** | `fullTreeLayout.ts:840` (grid branch)                                                         | E2      |
| `align_self`          | tree.rs:123     | **없음** | `fullTreeLayout.ts:664` (taffyStyleToRecord, 주경로) + `:849` (grid)                          | E1      |
| `justify_self`        | tree.rs:124     | **없음** | `fullTreeLayout.ts:665 근처` + `:850` (grid)                                                  | E1      |
| `overflow_x`/`_y`     | tree.rs:108-109 | **없음** | `fullTreeLayout.ts:645-646` + `utils.ts:4934-4938`                                            | E17     |
| `grid_auto_flow`      | tree.rs:129     | **없음** | `fullTreeLayout.ts:673-674` + `:832`                                                          | E14     |
| `grid_auto_columns`   | tree.rs:130     | **없음** | `fullTreeLayout.ts:675-676` + `:833-834`                                                      | E14     |
| `grid_auto_rows`      | tree.rs:131     | **없음** | `fullTreeLayout.ts:677-678` + `:835`                                                          | E14     |
| `aspect_ratio`        | tree.rs:172     | **없음** | `fullTreeLayout.ts:734-741` + `utils.ts:4942-4948`                                            | E15     |
| `order`               | **선언 없음**   | —        | `taffyStyleToRecord` order emit (serde silent drop)                                           | E16     |
| `grid_template_areas` | **선언 없음**   | —        | `applyBatchStyle` array passthrough (기지 — factory 숫자 line 병기로 완화, tree.rs 헤더 자인) | —       |

나머지 39필드는 소비 존재를 확인했다. 단 소비 ≠ 정합 — 소비되면서도 해석이 틀린 축(E6 percent height 폭 ctx, E7 음수 margin, E8 reverse 계열, E12 grid 컨테이너 정렬 등)은 §1-1-b 동적 실측이 담당한다. grid 커널은 min/max clamp 소비가 0 (flex/block 만 구현 — E2 인접).

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

## 2. Phase 1 — Chrome 차등 하니스 자동화 (G1)

### 2-1. 원리

기존 `tests/golden.rs`(15) 는 이름과 달리 **Chrome 실측이 아니라 CSS 명세 손계산**이다 (본문 헤더 자인: "기대값 근거 (Chrome/Taffy 실측 대신 명세 계산)"). 엔진과 테스트가 **같은 해석**을 공유 → 해석이 틀리면 둘 다 틀린다(순환 oracle). `tests/tree_golden.rs`(11 test / 6 fixture) 만 Chrome 실측 기반이나 fixture 가 6종이다.

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

후보 1 채택 시 실행 게이트는 "기존 tree_golden N1~N6 재현 + §1-2 의 672 조합 통과".

### 2-4. 하니스 자체 캘리브레이션 (필수)

하니스가 틀리면 모든 결과가 무의미하다. **기존 Chrome 검증 fixture(N1 flex-in-flex)를 하니스로 재현해 통과**시키는 것을 Phase 1 완료 조건에 포함한다 (세션에서 1회 확인 완료).

## 3. Phase 2 — align-self / justify-self (G2)

**대상**: E1. 사용자 도달 가능 유일 결함 — 우선 착수.

사슬 (실측 확인):

```
Inspector 정렬 피커 (TransformSection.tsx:239 handleSelfAlignment)
  → updateStylesImmediate({ alignSelf: pos.vertical, justifySelf: pos.horizontal })
  → store props.style
  → LAYOUT_PROP_KEYS 포함 (layoutCache.ts:84) — 캐시 무효화는 정상
  → taffyStyleToRecord (fullTreeLayout.ts:664) 가 엔진에 송신
  → 엔진 NodeStyle.align_self 선언 (tree.rs:123)
  → 읽는 코드 0곳  ← 여기서 소멸
  → Skia 무반응 / Preview(CSS) 는 정상 적용 → 비대칭
```

작업:

1. `flex.rs` — `place_line_cross_axis` 가 per-item `align_self` 를 받아 컨테이너 `align_items` 를 override. `auto` = 컨테이너 값 상속 (CSS 기본).
2. `tree.rs` — flex 자식 파싱 시 `style.align_self` → FlexItem 필드 주입 (`FLEX_FIELD_COUNT` 확장 시 `parse_item`/`golden.rs`/`tree_golden.rs` 동반 갱신 주의).
3. `justify_self` 는 flex 에서 **무효** (CSS: flex item 에 justify-self 미적용) — grid 전용이므로 Phase 3 에서 처리. flex 경로에서는 의도적 무시임을 주석 명시.

회귀 기준: §1-2 의 672 조합 + 기존 Rust 256 tests.

## 4. Phase 3 — grid 정렬 (G3, HIGH)

**대상**: E2.

`grid.rs` 는 정렬 처리가 **0줄**이다 (grep `justify|align` → 0 hit). 현재 grid 자식은 항상 셀 크기로 stretch 되며 **자식의 명시 width/height 마저 덮어쓴다**.

**HIGH 위험 (R3)**: JS 레이어가 이미 엔진의 grid 한계를 우회 보정하고 있다 — `layout-engine.md` §"Grid 트랙 폭 + 2-Pass 안전망": _"DFS에서 grid 컨테이너 자식 width를 `(contentWidth - totalGap) / numCols`로 사전 조정"_. 엔진이 자식 크기를 존중하도록 고치면 **JS 사전 조정과 이중 적용**되어 폭이 붕괴할 수 있다.

따라서 Phase 3 은 **책임 경계를 먼저 확정**한다:

- 옵션 3-a: 엔진이 CSS 대로 자식 크기/정렬을 처리 → JS DFS 사전 조정 **제거**. (근본적, 회귀 범위 큼)
- 옵션 3-b: 엔진은 정렬(위치)만 추가하고 크기 stretch 는 유지 → JS 사전 조정 존속. (범위 작음, `justify-items:start` 의 fit-content 의미는 여전히 발산)

G3 통과 조건에 **live builder grid 컴포넌트 시각 회귀 0** 을 포함한다 (ProgressBar 등 grid 사용처 — `project-adr916-grid-gap-offset-succession-bug` 이력 있는 영역).

## 5. Phase 4 — 부모-자식 마진 상쇄 (G4)

**대상**: E3.

`block.rs` 는 인접 형제 상쇄는 구현했으나(실측 통과), **부모-자식 상쇄**(첫 자식의 margin-top / 마지막 자식의 margin-bottom 이 부모 밖으로 탈출)는 미구현이다. 엔진은 항상 "상쇄 차단" 처럼 동작한다.

CSS 규칙: 부모에 `padding-top`/`border-top`/BFC 생성 요인이 없으면 첫 자식의 top margin 이 부모와 상쇄된다. **부모에 padding 이 있으면 차단** — 이 경우는 엔진이 이미 정확하다(실측 통과).

주의: root 노드에서의 탈출은 **시각적으로 무해**할 수 있다 (탈출한 마진이 root 자체를 밀어 결과적으로 같은 위치). 실질 발산은 **중첩 컨테이너의 높이**(`mid.h` 20 vs 50)와 그로 인한 형제 위치 전파다. 수정 범위 판단 시 이 구분 유지.

## 6. Phase 5 — margin auto + root auto height (G4)

**대상**: E4, E5. 둘 다 라이브 노출이 잠재적이라 후순위.

- E4 `margin:auto`: block 은 가로 중앙(남는 공간 균등 분배), flex 는 main/cross 축 auto 마진이 free space 를 흡수(justify-content 보다 우선). Inspector 입력 경로가 없어 현재는 잠재 — 다만 pencil import / 향후 정렬 기능이 유입 경로.
- E5 root auto height: `compute_layout(root, w, -1)` 에서 root 자기 padding/border 를 auto 높이에 합산. 중첩 경로는 이미 정확하므로 **root 분기만** 정합.

## 7. Phase 6 — 종결

- CHANGELOG 반영 (사용자-가시 수정 — E1 최소)
- README 표 Implemented 승격
- 미해결 잔여를 본문 §Residual 에 기록 (옵션 3-b 채택 시 grid fit-content 잔존 등)

## 8. 검증 계약 (전 Phase 공통)

- Rust: `cargo test --lib` + `cargo test --test golden --test tree_golden`
- 차등: §1-2 의 672 조합 + 5종 fixture 발산 0
- **live behavior 필수** (CLAUDE.md 완료 기준): Phase 2/3 은 실제 빌더에서 Inspector 정렬 조작 → Skia 반영 → Preview 대칭을 Chrome MCP 로 1회 exercise. test PASS 단독 종결 금지.
- `pnpm type-check` baseline 무증가
- **WASM 재빌드 필수**: `pnpm wasm:build:engine` — 산출물(`composition-engine-pkg/`)은 gitignore 라 Rust 만 고치고 재빌드를 빠뜨리면 live 무변화 (`feedback-cargo-stale-binary-mtime-after-sed-revert`).
