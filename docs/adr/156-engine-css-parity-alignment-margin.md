# ADR-156: composition-engine CSS 정합 복구 — 정렬·마진 미구현 5종 + Chrome 차등 oracle 도입

## Status

Proposed — 2026-07-17

## Context

### Domain 소속

**D3 (시각 스타일)** 단독. [ssot-hierarchy.md](../../.claude/rules/ssot-hierarchy.md) 상 Builder(Skia)와 Preview/Publish(DOM+CSS)는 D3 의 **대등 symmetric consumer** 이며, 대칭은 "시각 결과의 동일성"으로 정의된다. 본 ADR 은 Skia consumer 경로의 레이아웃 엔진(`packages/composition-engine`)이 CSS consumer 와 동일한 시각 결과를 산출하는지의 문제다. D1(DOM/ARIA)·D2(Props/API) 변경 0 — 엔진은 catalog/theme 이 결정한 D3 값을 좌표로 환산할 뿐 SSOT 를 소유하지 않는다. 경계 교차 없음.

### 문제

[ADR-916](completed/916-unified-rust-engine.md)(Implemented 2026-07-06)으로 자체 Rust 엔진이 Taffy 를 대체했다. 엔진의 목적은 **CSS 레이아웃 재현** — Skia 가 CSS 와 같은 결과를 그리게 하는 것이다. 그러나 재현 여부를 검증하는 기준(oracle)이 CSS 자신이 아니었다.

2026-07-17, `display:block` body 에 등록한 Button 이 Preview 는 좌상단·Skia 는 좌중앙에 놓이는 결함이 보고됐다(수정 완료, commit `bb6ab7e40`). 원인은 엔진이 CSS 의 "single-line 컨테이너"를 `flex-wrap:nowrap`(CSS §5.2 정의)이 아니라 **결과 라인 수 1개**로 판정한 것이었다. 이 결함은 **flex 단위 테스트 34개 + `golden.rs` 15개를 전부 통과한 채** 라이브에 존재했다 (34 = 결함 존재 시점 `flex.rs` 테스트 수 — `git show bb6ab7e40~1` 실측. 현재 36개는 이 결함을 잡으려 추가한 RED 테스트 2개를 포함한 값이라 근거로 쓸 수 없다).

통과한 이유가 본 ADR 의 출발점이다. `tests/golden.rs` 는 이름과 달리 기대값이 Chrome 실측이 아니라 **"CSS 명세 손계산"** 이다 — 본문 헤더가 자인한다: _"기대값 근거 (Chrome/Taffy 실측 대신 명세 계산)"_. 즉 엔진과 테스트가 **같은 명세 해석을 공유**하므로, 해석이 틀리면 둘 다 같이 틀린다(순환 oracle). Chrome 실측 기반 독립 oracle 은 `tests/tree_golden.rs` 의 **5 fixture(N1~N5)** 뿐이다 — 같은 파일의 N6 조차 Chrome 실측이 아니라 손계산이다(헤더 자인: _"N6 는 Chrome 실측이 아니라 box-sizing:border-box 계약을 CSS 산술로 손계산 고정한 padding≠0 케이스"_). 공교롭게 N6 가 담당하는 영역이 padding≠0 이고, 본 ADR 의 **E5(root auto 높이 + padding 누락)가 정확히 그 영역에서 발견**됐다 — 손계산 oracle 이 실제로 무엇을 놓치는지의 실증.

### 실측 (2026-07-17, Chrome 차등 sweep)

실제 Chrome 을 ground truth 로 하는 차등 하니스를 구성해 엔진을 전수 대조했다(방법·재현: [breakdown §2](design/156-engine-css-parity-alignment-margin-breakdown.md)).

**정합 확인**: flex 교차축 **384 조합**(direction × wrap × align-items × align-content × definite/auto × 1줄/2줄) + main 축 **288 조합**(direction × justify-content × gap × grow × shrink × basis) 전부 통과. 인접 형제 마진 상쇄·box-sizing(명시 크기)도 정확.

**발산 5종**:

| ID  | 발산                                                          | CSS → 엔진                        | 라이브 노출                                |
| --- | ------------------------------------------------------------- | --------------------------------- | ------------------------------------------ |
| E1  | flex/grid `align-self`/`justify-self` 전면 무시               | `y` 40 → **0**                    | **사용자 도달 가능** (Inspector 정렬 피커) |
| E2  | grid `justify-items`/`align-items` 무시 + 자식 명시 크기 무시 | `x` 160 → **0**, `w` 40 → **200** | 부분 (JS DFS 가 폭만 보정)                 |
| E3  | 부모-자식 마진 상쇄 미구현 (block)                            | `mid.h` 20 → **50**               | 도달 가능                                  |
| E4  | `margin:auto` 정렬 미구현 (block + flex)                      | `x` 60 → **0**                    | 잠재 (Inspector 입력 경로 없음)            |
| E5  | **root** 노드 auto 높이가 자기 padding/border 누락            | `h` 40 → **20**                   | 잠재 (라이브 root 는 명시 높이)            |

E1 은 코드 경로가 끝까지 확증된 사용자-가시 결함이다: Inspector 정렬 피커(`TransformSection.tsx:239` `handleSelfAlignment`)가 `alignSelf`/`justifySelf` 를 store 에 쓰고 → `LAYOUT_STYLE_KEYS`(`layoutCache.ts:84`)가 style 시그니처에 포함해 캐시를 무효화하고(`createElementLayoutSignature`, `layoutCache.ts:185-190` — style 축은 `LAYOUT_STYLE_KEYS`, props 축은 별개 배열 `LAYOUT_PROP_KEYS`:112) → `taffyStyleToRecord`(`fullTreeLayout.ts:664`)가 엔진에 송신하는데 → 엔진 `NodeStyle`(`tree.rs:123`)은 필드를 **선언만 하고 읽는 코드가 0곳**이다(`grep style.align_self` → 0 hit). 결과적으로 정렬 버튼이 Preview 에서만 동작한다.

### 2차 정밀 sweep (2026-07-17 — Phase 0/G0 전수 완성)

본 ADR 작성 직후 G0 3축 교차표를 NodeStyle 49필드 전수로 완성하고 차등 하니스를 49 케이스로 확장 대조한 결과([breakdown §1-1-b, §1-3](design/156-engine-css-parity-alignment-margin-breakdown.md)):

- **미소비 필드는 3개가 아니라 8개** + 미선언 2건(`order`, `grid_template_areas` — serde silent drop). 추가 5개: `overflow_x/y`, `grid_auto_flow`/`grid_auto_columns`/`grid_auto_rows`, `aspect_ratio` — 전부 파이프라인 송신 실존 확인.
- **추가 발산 12군 (E6~E17)**. 사용자 도달 가능 축: percent height 폭 기준 오해석(E6 — Transform % 단위), 음수 margin 무시(E7), reverse 방향 3종 무시(E8 — `styleOptions.ts:80-81` 노출), position:relative offset 무시(E10), absolute stretch/static/auto-margin 미구현(E11), grid span-blind placement(E13), gridAuto\* 계열(E14), aspect-ratio(E15).
- **E5 는 root self-sizing 결함군으로 확장** — auto 높이 padding 뿐 아니라 border 누락·min/max clamp 무시·무폭 flex root 의 availW 미채움 포함. 중첩이면 전부 정합(root 한정 재확증).
- **잠복 결합 1건**: `overflow_x/y` 미소비(E17)는 현재 E3(부모-자식 상쇄) 부재가 가려준다 — Phase 4 에서 E3 구현 시 overflow BFC 상쇄 차단을 함께 구현하지 않으면 새 발산이 생긴다.
- 정합 확인 영역도 확장: grid 트랙 산술(percent/minmax/repeat/auto intrinsic)·flex min/max 재분배·fit-content·중첩 컨테이너 자기 크기 등(breakdown §1-2).

**E6~E17 의 Phase 매핑/우선순위 재편은 본 ADR 리뷰 시 확정** — 기존 Phase 2~5 의 E1~E5 담당은 유지하고, E6(도달 가능 + 근원 코드 확정 `tree.rs:905,919`/`write_block_item` 폭 ctx)은 severity 상 E1 과 동급 후보.

### Hard constraints (측정 가능)

- **시각 diff ≤ 1px** — 기존 `golden.rs`/`tree_golden.rs` 의 `TOL: f32 = 1.0` 승계
- **정합 기준선 무회귀** — 위 672 조합 + 기존 Rust 256 tests 통과 유지
- **Canvas 60fps** — 레이아웃은 pointer hot path 가 아니나 `computeLayout` 비용 증가가 프레임 예산을 침범하지 않을 것
- **live behavior 검증 1회** — test PASS 단독 종결 금지 (CLAUDE.md 완료 기준)

### Soft constraints

- **BC 영향 0%** — 저장 문서 스키마·props·토큰명 변경이 0이다. 본 ADR 은 같은 입력(`props.style`)을 엔진이 **더 정확히 해석**하게 할 뿐이라 재직렬화 대상 파일 0건. 시각 결과는 의도적으로 변한다(= CSS 와 일치하는 방향). dev 단계라 migration 자체가 불필요 (`feedback-dev-stage-no-bc-migration`)
- `playwright.config` **부재** (`test:e2e` script 만 존재), vitest 환경은 `jsdom` 이라 **레이아웃 계산이 없어 oracle 불가**
- WASM 산출물은 gitignore — Rust 수정은 `pnpm wasm:build:engine` 재빌드 없이는 live 무반영

## Alternatives Considered

### 대안 A: 발견 5종만 개별 수정 (oracle 은 기존 방식 유지)

- 설명: E1~E5 를 각각 고치고, 회귀 테스트는 기존 패턴대로 `golden.rs` 에 **명세 손계산** 기대값을 추가한다.
- 위험: 기술(**L**) / 성능(**L**) / 유지보수(**H**) / 마이그레이션(**L**)
- 유지보수 H 근거: 순환 oracle 이 그대로 남는다. 이번 `wrap` 버그가 34+15 테스트를 통과한 메커니즘이 유지되므로, **아직 발견하지 못한 영역**이 같은 방식으로 계속 통과한다. 5종은 sweep 으로 찾은 것이지 전부라는 보장이 없다.

### 대안 B: Chrome 차등 oracle 자동화 + 5종 수정

- 설명: 실제 Chrome 을 ground truth 로 하는 차등 테스트를 CI 자산으로 도입하고(Phase 1), 그 위에서 5종을 수정한다(Phase 2~5). 각 수정은 매트릭스 회귀 게이트를 통과해야 한다.
- 위험: 기술(**M**) / 성능(**L**) / 유지보수(**L**) / 마이그레이션(**L**)
- 기술 M 근거: `playwright.config` 신설이 필요하고(현재 부재), headless Chrome 버전 차이가 flaky 요인이 될 수 있다 → R1 로 관리.

### 대안 C: 자체 엔진 폐기 → 브라우저 레이아웃 위임 (오프스크린 DOM 측정)

- 설명: 레이아웃을 오프스크린 DOM 에 위임해 측정하고 그 결과를 Skia 에 반영한다. CSS 정합은 원리적으로 100%.
- 위험: 기술(**H**) / 성능(**H**) / 유지보수(**M**) / 마이그레이션(**H**)
- 성능 H 근거: 노드마다 DOM 왕복 + 강제 리플로우 → 60fps 예산 붕괴. ADR-916 이 자체 엔진을 채택하며 endgame kill criteria 3/3 을 충족한 결정을 정면 역행하고, Taffy 물리 삭제까지 끝난 상태에서 되돌리는 비용이 크다.

### 대안 D: 미구현 속성을 Inspector 에서 제거 (기능 축소로 발산 해소)

- 설명: 엔진이 지원하지 않는 `alignSelf`/`justifySelf` 편집 UI 를 제거해 발산 자체를 없앤다.
- 위험: 기술(**L**) / 성능(**L**) / 유지보수(**M**) / 마이그레이션(**M**)
- 마이그레이션 M 근거: 이미 저장된 문서의 해당 값이 무의미해진다. 무엇보다 **enterprise 노코드 빌더 목표**(`feedback-composition-enterprise-target`)에서 정렬은 기본 기능이라 기능 퇴보가 목표와 충돌한다. E3/E5 처럼 UI 가 없는 발산은 해소하지도 못한다.

### Risk Threshold Check

| 대안 | 기술  | 성능  | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :---: | :---: | :------: | :----------: | :--------: |
| A    |   L   |   L   |  **H**   |      L       |     1      |
| B    |   M   |   L   |    L     |      L       |   **0**    |
| C    | **H** | **H** |    M     |    **H**     |     3      |
| D    |   L   |   L   |    M     |      M       |     0      |

**루프 판정**: 대안 B 가 HIGH 0 으로 threshold 를 만족한다. D 도 HIGH 0 이나 목표(기능 유지)와 충돌하므로 기각 — 위험 회피용 추가 대안 유도 불필요(1회 루프에서 종료).

## Decision

**대안 B 채택** — Chrome 차등 oracle 을 자동 테스트로 도입하고, 그 위에서 발산 5종을 severity 순(E1 → E2 → E3 → E4/E5)으로 수정한다.

**위험 수용 근거**: 유일한 잔존 위험은 대안 B 의 기술 M(Playwright 신설 + headless flaky)이며, 좌표 기하만 비교하는 fixture(텍스트/폰트 미포함) + 1px tolerance + 브라우저 버전 pin 으로 통제 가능하다(R1). 반대로 대안 A 를 택하면 유지보수 H(순환 oracle 존속)가 **영구화**된다 — 이번 결함이 정확히 그 비용이었으므로 수용 불가.

**기각 사유**:

- **대안 A**: 순환 oracle 을 남긴다. 5종은 sweep 결과지 전수 보장이 아니며, 같은 구조에서 다음 결함이 또 테스트를 통과한다. 본 ADR 의 문제의식 자체를 해소하지 못함.
- **대안 C**: 성능 HIGH(DOM 왕복 리플로우 → 60fps 붕괴) + ADR-916 결정 역행. Taffy 물리 삭제 완료 상태에서 마이그레이션 HIGH.
- **대안 D**: 기능 퇴보가 enterprise 목표와 충돌하고, UI 없는 발산(E3/E5)은 해소 불가.

> 구현 상세: [156-engine-css-parity-alignment-margin-breakdown.md](design/156-engine-css-parity-alignment-margin-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |  심각도  | 대응                                                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Chrome 차등 테스트가 CI 에서 flaky (headless 버전/폰트/서브픽셀 차이)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |   MED    | 기하 전용 fixture(텍스트 미포함) + TOL 1px + 브라우저 버전 pin. G1 에서 반복 실행 안정성 확인                                                                                                                                                                                                     |
| R2  | `align_self` 구현이 기존 정합 672 조합을 회귀시킴 (`FLEX_FIELD_COUNT` 확장이 `parse_item`/golden 계약 파손)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |   MED    | G2 = 672 조합 + Rust 256 tests 무회귀. 필드 확장 시 `golden.rs`/`tree_golden.rs` 동반 갱신                                                                                                                                                                                                        |
| R3  | **grid 정렬 구현이 JS DFS 사전 폭 보정과 이중 적용 → grid 폭 붕괴**. 충돌 지점 3곳: ① `fullTreeLayout.ts:1516-1528` DFS 가 grid 컨테이너 자식의 **available width** 를 트랙 폭으로 사전 축소(`trackWidth = (childAvail.width - totalGap) / numCols`) → 그 값으로 `enrichWithIntrinsicSize` 가 자식 width 를 주입(`utils.ts:4381` `injectedStyle.width = ceiledWidth`). `layout-engine.md` §"Grid 트랙 폭 + 2-Pass 안전망" 은 이를 "자식 width 사전 조정"으로 요약하나 실제 조정 대상은 available width 이며, 주입은 enrich 단계에서 일어난다 ② `fullTreeLayout.ts:823` grid branch(`applyCommonTaffyStyle` + `justifyItems`/`alignSelf` 송신) ③ `grid.rs::grid_layout`(정렬 코드 0줄 — 현재 항상 셀 stretch)                      | **HIGH** | G3 — 책임 경계(옵션 3-a 제거 vs 3-b 존속) 를 Phase 3 착수 전 확정 + live grid 시각 회귀 0. **Phase 3 별도 ADR 분리 검토(2026-07-17)**: 분리 시 E2 만 남아 oracle(Phase 1)·회귀 기준선을 공유하지 못해 중복 비용이 커짐 → 본 ADR 안 Phase 로 유지하되 G3 를 착수 전/종료 2단 게이트로 분할         |
| R4  | 부모-자식 마진 상쇄 구현이 block 경로 전반(인접 형제 상쇄 포함)을 회귀시킴                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |   MED    | G4 — 상쇄 차단 케이스(부모 padding 보유)가 이미 통과 중이므로 이를 회귀 기준선으로 고정                                                                                                                                                                                                           |
| R5  | 하니스가 엔진을 직접 호출해 **adapter 층(taffyDisplayAdapter) 발산은 미검출** — block IFC 시뮬레이션 등                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |   MED    | 본 ADR scope 는 엔진↔CSS(Layer 1). adapter↔CSS(Layer 2) fixture 는 §Residual 기록 후 후속                                                                                                                                                                                                         |
| R6  | **`justifySelf`·`justifyItems` 가 layout 캐시 style 시그니처에 누락 → 엔진을 고쳐도 편집이 무반영**. `LAYOUT_STYLE_KEYS`(`layoutCache.ts:49-110`)에 `alignSelf`(:84)는 있으나 `justifySelf`/`justifyItems` 는 **없다**(`grep -c '"justifySelf"'` → 0). `createElementLayoutSignature`(`layoutCache.ts:185-190`)가 이 배열로 style 시그니처를 만들므로, 두 키만 바뀌면 시그니처가 그대로 → 캐시 히트 → 재배치 없음. **구체 실패 시나리오**: Inspector 9칸 피커(`SELF_ALIGN_POSITION_MAP`, `TransformSection.tsx:70-82`)에서 `leftTop`→`centerTop` 은 `vertical`(alignSelf)이 `start` 로 불변이고 `horizontal`(justifySelf)만 `start`→`center` 로 바뀐다 → Phase 2 수정 후에도 **세로 이동만 되고 가로 이동은 안 되는** 상태로 출하 | **HIGH** | G2 에 캐시 키 등재 검증 편입 — Phase 2 는 `LAYOUT_STYLE_KEYS` 에 `justifySelf` 추가(Phase 3 은 `justifyItems`)를 포함하고, live 검증을 **가로 전용 이동(leftTop→centerTop)** 으로 수행해 세로 통과에 가려지지 않게 한다. layout-engine.md §"Layout Prop 변경 → Canvas 반영" 3-심볼 체인 점검 의무 |

## Gates

| Gate | 시점                   | 통과 조건                                                                                                                                                                                                                                             | 실패 시 대안                                                                            |
| ---- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| G0   | Phase 0 종료           | 엔진 `NodeStyle` 전 필드 3축 교차표(선언/소비/송신) 확정 — 「선언 O·송신 O·소비 X」 칸이 전수 열거됨                                                                                                                                                  | 잔여 미소비 필드 발견 시 본 ADR 표 갱신으로 흡수 (신규 ADR fork 금지)                   |
| G1   | Phase 1 종료           | 차등 하니스 자동 실행 + 기존 `tree_golden` N1~N6 재현 + 672 조합 통과 + 반복 실행 flaky 0                                                                                                                                                             | 후보 1(Playwright) 불안정 시 후보 2(Chrome 실측 → 상수 freeze)로 강등                   |
| G2   | Phase 2 종료           | E1 발산 0 + 672 조합·Rust 256 무회귀 + **(R6)** `LAYOUT_STYLE_KEYS` 에 `justifySelf` 등재 + **live**: Inspector 9칸 피커 **가로 전용 이동(`leftTop`→`centerTop`)** → Skia 반영 → Preview 대칭 (Chrome MCP 1회, 세로 이동 단독 검증 금지 — R6 을 가림) | 회귀 발생 시 `align_self` 를 flex 한정으로 축소 후 grid 는 Phase 3 흡수                 |
| G3   | Phase 3 착수 전 / 종료 | (착수 전) 옵션 3-a/3-b 책임 경계 확정 · (종료) E2 발산 0 + **live grid 컴포넌트 시각 회귀 0** + JS DFS 보정과 이중 적용 없음                                                                                                                          | 이중 적용 해소 불가 시 옵션 3-b(정렬만, 크기 stretch 유지)로 축소 + 잔존 §Residual 기록 |
| G4   | Phase 4~5 종료         | E3/E4/E5 발산 0 + 상쇄 차단 케이스·672 조합 무회귀                                                                                                                                                                                                    | block 경로 회귀 시 E3 를 중첩 컨테이너 한정으로 축소 (root 탈출은 시각 무해)            |

## Consequences

### Positive

- **순환 oracle 해소** — 엔진의 CSS 해석을 CSS 자신(Chrome)과 대조하게 되어, 작성자 해석 오류가 테스트를 통과하는 구조가 끊긴다. 이번 `wrap` 결함류의 재발이 자동 차단된다.
- **사용자-가시 결함 해소** — Inspector 정렬 피커가 Skia 에서 실제로 동작한다(E1).
- **정합 기준선 확보** — 672 조합이 회귀 게이트로 고정되어, 이후 엔진 수정이 CSS 정합을 깨면 즉시 드러난다.
- 미소비 필드 3축 교차표(G0)가 `feedback-engine-declared-but-unread-style-fields` 함정의 상시 점검 자산이 된다.

### Negative

- CI 시간 증가 — 브라우저 기동 + 수백 조합 실행. 매트릭스 규모 관리 필요.
- Playwright 설정이 신규 유지보수 표면으로 추가된다(현재 config 부재).
- R3 처리 방향(옵션 3-a)을 택하면 `fullTreeLayout` DFS 사전 보정 제거까지 번져 회귀 범위가 커진다 — 옵션 3-b 로 축소 시 grid `justify-items` 의 fit-content 의미가 잔존 발산으로 남는다.
- 엔진 코드 증가(정렬·마진 상쇄)로 `computeLayout` 비용이 소폭 증가한다 (60fps 예산 내 확인 필요).
