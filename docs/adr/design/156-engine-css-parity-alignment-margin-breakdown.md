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

### 1-2. 정합 확인 영역 (회귀 기준선 — Phase 2~5 가 깨면 안 됨)

| 축                                                                                     | 조합 수 | 결과      |
| -------------------------------------------------------------------------------------- | ------: | --------- |
| flex 교차축 (direction × wrap × align-items × align-content × definite/auto × 1줄/2줄) |     384 | 전부 통과 |
| flex main 축 (direction × justify-content × gap × grow × shrink × basis)               |     288 | 전부 통과 |
| 인접 형제 마진 상쇄                                                                    |       — | 통과      |
| box-sizing border-box (명시 크기 + padding/border)                                     |       — | 통과      |
| 부모 padding 이 마진 상쇄를 차단하는 경우                                              |       — | 통과      |

### 1-3. 엔진 필드 3축 교차표 (Phase 0 산출물 — G0)

각 `NodeStyle` 필드를 **선언(tree.rs) / 소비(읽는 코드 존재) / 송신(파이프라인이 실제로 보냄)** 3축으로 전수 분류한다. 본 ADR 이 다루는 것은 **선언 O + 송신 O + 소비 X** 칸이다.

실측 확인된 「선언 O · 소비 X」 (grep `style.justify_items` / `style.align_self` / `style.justify_self` → 0 hit):

| 필드            | 선언        | 소비     | 송신 (파이프라인)                                                    |
| --------------- | ----------- | -------- | -------------------------------------------------------------------- |
| `justify_items` | tree.rs:115 | **없음** | `fullTreeLayout.ts:840` (grid branch)                                |
| `align_self`    | tree.rs:123 | **없음** | `fullTreeLayout.ts:664` (taffyStyleToRecord, 주경로) + `:849` (grid) |
| `justify_self`  | tree.rs:124 | **없음** | `fullTreeLayout.ts:665 근처` + `:850` (grid)                         |

Phase 0 은 위 3건이 전부인지(다른 미소비 필드 유무) 전수 확증한다. **잔여 미소비 필드가 발견되면 본 ADR scope 안에서 표만 갱신** — 신규 ADR fork 금지 (adr-writing.md M3: 추정 vs 실측 gap 은 Phase 0 inventory 보강으로 흡수).

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
