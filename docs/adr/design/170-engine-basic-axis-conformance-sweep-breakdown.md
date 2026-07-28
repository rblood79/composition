# ADR-170 Design Breakdown: 엔진 기본 축 전수 정합 격자 (display×size conformance sweep)

> 본문: [ADR-170](../170-engine-basic-axis-conformance-sweep.md)
> 구현 상세 전용 문서 — Phase 목록 / 축 설계 / 커버리지 맵 / 사각 목록 / 체크리스트는 여기에만 둔다.

## §0. 배경 요약

- 엔진↔Chrome 발산이 **반응형 발견** (라이브 증상 → 역추적 → 좁은 fixture → 수정) 으로만 해소되어 잔여 규모를 모른다. 최근 30일 engine 34 + layout 19 fix 가 이 사이클의 산출.
- components 페이지 공통 컴포넌트는 테스트 수준 (사용자 확인 2026-07-28, memory `project-components-page-origins-are-test-level`) — 라이브 증상이 오라클이 못 되고, 증상마다 엔진/데이터 귀속 판정 비용이 붙는다.
- 실증 전례: `flexSweep.browser.test.ts` 1152 조합이 정렬 결함 3계열 (라인 cross 승격 `max` / 위치 정렬 클램프 / 미결정 main 센티넬) 을 일괄 적발. 결정적 격자가 반응형 발견을 대체할 수 있음을 보여줬다.
- 후속 관계: 본 ADR 의 격자 green 이 "공통 컴포넌트 완성형 재구축" (후속 별도 ADR, 미작성) 의 전제다 — 흔들리는 기반 위에서 컴포넌트를 재저작하면 우회 스타일 굽기가 재발한다.

## §1. 격자 설계 원칙

1. **Chrome = differential oracle** — 기대값을 손으로 쓰지 않는다. `harness.ts` 의 `domLeg` 가 오라클, `engineLeg`(엔진 직접) + 선별 `pipelineLeg`(TS 공급층 포함) 가 피험체. 기존 `diffCase` 좌표 대조 재사용.
2. **발견과 수정의 분리** — Phase 1 은 수정 0. 발산은 **ratchet 목록**으로 잠가 스위트를 green 으로 유지한다 (구체 형식 §3.5). 수정 wave (Phase 2) 가 목록에서 항목을 지워 간다. red 방치 금지.
3. **축 분해로 조합 폭발 관리** — 전체 직교곱 1개가 아니라 부분 격자 여러 개 (flexSweep 이 교차축 576 + main 576 으로 분해한 방식). 각 부분 격자는 자기 축만 전수, 나머지 축은 대표값 고정.
4. **사각 명시** — 격자는 자신이 열거한 축만 증명한다 (flexSweep 이 미결정 main 을 못 잡았던 실증 — `crossAxisOverflow.browser.test.ts` `INDEFINITE_MAIN_CASES` 가 유일 감시자였음). "격자가 못 여는 축" 목록 (§4) 을 Phase 0 에 freeze 하고 layout-engine.md 에 문서화한다.
5. **스펙 조문 병기** — 발산 판정 시 Chrome 특이 동작(quirk) 을 스펙으로 오인하지 않도록, 군집 보고서에 CSS 조문 (CSS-SIZING-3 / FLEXBOX-1 / GRID-1 §번호) 대조를 병기한다 (layout-engine.md 기존 관행).

## §2. 기존 커버리지 맵 — 실측 확정 (Phase 0, 2026-07-28)

> 목적: 신규 격자가 이미 잠긴 축을 중복 열거하지 않게 한다. 케이스 수는 vitest `it` 단위 실측 (`--reporter=json`), **조합 수**는 파일이 루프로 도는 실제 케이스 수 (flexSweep 만 둘이 크게 갈린다).

| 기존 fixture (케이스)                    | 커버 축                                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| `flexSweep` (2 it / **1152 조합**)       | flex 정렬 3축 × wrap × 여유 부호 — **컨테이너 main 항상 확정** (사각, R1 근거)   |
| `crossAxisOverflow` (62)                 | 음수 여유 정렬 좌표 명시 + **미결정 main 센티넬** (`INDEFINITE_MAIN_CASES` 유일) |
| `gridItemBox` (116)                      | grid item 상자 모델 — 명시 크기 / margin / min·max / 넘침                        |
| `autoMargin` (79) / `reverseMargin` (44) | flex auto margin 흡수 (라인 단위) / `*-reverse` margin 축 스왑                   |
| `percentSize` (76)                       | `%` 해소의 축별 definite 조건 + shrink-wrap 부모                                 |
| `gridTrackContribution` (69)             | 트랙 content 기여 (§12.5) + §6.6 clamp + TS 공급 3결함                           |
| `gridAutoTrackStretch` (67)              | §12.8 auto 트랙 stretch + 암묵 행 `grid-auto-rows`                               |
| `gridContainerIntrinsic` (66)            | 그리드 자신의 min/max-content (§12.5~§12.7.1) + flex item 으로서의 그리드        |
| `shrinkToFitInline` (49)                 | shrink-to-fit 확정 뒤 `%` 재해소 + 암묵 열                                       |
| `gridMinmaxTracks` (48)                  | §12.6 minmax 상한 성장 + freeze 재분배                                           |
| `gridContainerBlockSize` (47)            | 행 트랙 extent = 컨테이너 블록 크기 + 배치 매핑                                  |
| `gridAlignContent` (25)                  | grid `align-content` × definite 게이트                                           |
| `containerIntrinsic` (22)                | 컨테이너 flex item 의 측정 모드 intrinsic (ADR-169)                              |
| `autoMin` (16)                           | §4.5 automatic minimum size (overflow × 축 × grid no-op)                         |
| `bodyViewportBox` (14)                   | body `min-height` 주입 + clamp 뒤 3축 재분배                                     |
| `phase3a-align` (12) / `phase3a` (8)     | grid per-item align/justify (2-layer)                                            |
| `containerAlign` (11)                    | 비-stretch 교차축 shrink-to-fit (엔진 + 파이프라인)                              |
| `flexItemDimContract` (11)               | 배치 직렬화 계약 (숫자/문자열)                                                   |
| `engineCssParity` (10)                   | `tree_golden` 재현 — 차등 하니스 자체의 회귀 가드                                |
| `intrinsicSizing` (10)                   | 측정 스칼라 × CSS-SIZING-3 §5 공식 (engine 6 + pipeline 4)                       |
| `phase5` (9)                             | root 자기 크기(E5) / margin auto(E4) / **aspect-ratio(E15, 2케이스)**            |
| `phase2` (8)                             | align-self(E1) / percent height(E6)                                              |
| `phase3` (8)                             | span 배치(E13) / 트랙 정렬(E12) / auto-flow(E14) / per-item align(E2)            |
| `phase4` (8)                             | margin 상쇄(E3) / overflow BFC(E17) / 음수 margin(E7) / reverse(E8)              |
| `phase4_5` (5)                           | relative offset(E10) / **absolute** stretch·static·margin-auto(E11) / `%` inset  |
| `slotPercentChild` (5)                   | 프레임 슬롯 `%` 폭의 containing block                                            |
| `layer2` (4)                             | 파이프라인 block-height 위임 + BFC                                               |
| **합계**                                 | **29파일 / 911 it / 실 조합 ≈ 2,061**                                            |

관찰 — 신규 격자의 대상이 되는 구멍:

- 기존 커버는 **결함이 발견된 곳** 중심의 점 커버다. `display` 5종 × `width` 6종 × `height` 3종을 **직교로** 훑은 파일이 하나도 없다.
- `min-width`/`max-width`/`min-height`/`max-height` 는 grid item (`gridItemBox`) 과 body clamp (`bodyViewportBox`) 에만 있고, **컨테이너 자기 크기 축에서의 clamp** 는 미열거.
- `margin` 은 auto (`autoMargin`) 와 음수·상쇄 (`phase4`) 만 있고 **일반 px/% margin × 부모 display** 직교는 미열거.
- 한 단계 전파 (조부→중간→leaf) 를 크기 축으로 훑은 파일 없음 (`slotPercentChild` 가 `%` 폭 1축만).

## §3. 신규 격자 축 설계 — 확정 (Phase 0 freeze)

### §3.0 하니스 계약 (Phase 1 저작 전 필독)

`harness.ts` 실측으로 확정된 제약. 어기면 엔진 결함이 아니라 **하니스 산출물**을 측정하게 된다.

| 계약                                                                                                                                | 근거                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **피험 컨테이너는 root 가 아니라 중첩** — root 는 `compute_layout(root, w, -1)` 의 자기 크기 경로(E5)라 별개 축이다                 | `flexSweep.nestUnderRoot` 주석 / `phase5` E5                                  |
| **부모 컨텍스트는 케이스 트리 안의 wrapper 노드로 표현** — `availH` 는 DOM leg 에 대응물이 없다 (`domLeg` wrapper 는 width 만 설정) | `harness.ts:63-67`                                                            |
| `availH: -1` 고정. 블록 축 definite 는 **wrapper 의 명시 height** 로만 만든다                                                       | 엔진도 `explicit_h > 0.0` 만 definite 로 본다 (layout-engine.md §백분율 크기) |
| leaf 는 텍스트 대신 **측정 스칼라 + `domAtoms`** — 정수 오라클                                                                      | `harness.ts:39-45`, `containerAlign.atom` 패턴                                |
| 모든 노드 `box-sizing: border-box`, margin/padding/border 0 리셋 — 케이스가 준 값만 유효                                            | `harness.ts:70-75`                                                            |
| gap 은 longhand, `flexGrow`/`flexShrink` 는 숫자, grid track 은 배열                                                                | `harness.ts:19-24` 계약 차이                                                  |

**부모 컨텍스트 2종** (전 부분 격자 공용):

- `definite` — `{ display: "block", width: "300px", height: "200px" }` : 인라인 축 stretch + 블록 축 확정
- `shrink-to-fit` — `{ display: "flex", flexDirection: "column", alignItems: "center", width: "300px" }` : 인라인 available 미결정 (`INDEFINITE_AVAIL`)

### 부분 격자 1 — 컨테이너 자기 크기 (`basicAxisContainerSize`)

| 축            | 값 (확정)                                                                        |  수 |
| ------------- | -------------------------------------------------------------------------------- | --: |
| display       | `block` / `flex-row` / `flex-column` / `grid(auto auto)` / `grid(1fr 1fr)`       |   5 |
| width         | auto / `120px` / `50%` / `min-content` / `max-content` / `fit-content`           |   6 |
| height        | auto / `80px` / `50%`                                                            |   3 |
| min/max       | 없음 / `minWidth:200px` / `maxWidth:60px` / `minHeight:120px` / `maxHeight:40px` |   5 |
| 부모 컨텍스트 | definite / shrink-to-fit                                                         |   2 |

자식은 스칼라 leaf 2개 고정 (`contentMinWidth:40`/`contentMaxWidth:90` + `height:30px`, `domAtoms:[40,50]`) — 컨테이너 크기가 자식 content 로부터 나오는 경로 (`min-content`/`fit-content`/auto) 를 관측 가능하게 한다. **5×6×3×5×2 = 900**.

**aspect-ratio 소블록** (같은 파일, 별도 describe): display 5 × 명시 축 3 (`width:120px` / `height:60px` / 둘 다 auto) × clamp 2 (없음 / `maxWidth:60px`) = **30**. 축으로 곱하지 않고 소블록으로 분리 — 엔진 지원은 확인됐고 (`tree.rs::apply_aspect_to_dims`) 기존 커버가 2케이스뿐이라 (`phase5` E15) 얇은 축을 닫는 것이 목적이다.

### 부분 격자 2 — 자식 크기 (`basicAxisChildSize`)

| 축           | 값 (확정)                                                    |  수 |
| ------------ | ------------------------------------------------------------ | --: |
| 부모 display | `block` / `flex-row` / `flex-column` / `grid(auto auto)`     |   4 |
| 자식 width   | auto / `60px` / `50%` / `fit-content` / `max-content`        |   5 |
| 자식 height  | auto / `30px` / `50%`                                        |   3 |
| 자식 margin  | 0 / `marginLeft:10px` / `marginLeft:10%` / `marginLeft:auto` |   4 |
| 자식 min/max | 없음 / `minWidth:100px` / `maxWidth:40px`                    |   3 |

부모는 `{ width:"300px", height:"150px" }` definite 고정 (미결정 부모는 부분 격자 1·3 담당). 자식 2개 중 첫째만 축을 받고 둘째는 고정 스칼라 leaf — 형제 좌표가 첫째의 크기·margin 을 증명한다. **4×5×3×4×3 = 720**.

### 부분 격자 3 — 중첩 전파 (`basicAxisNesting`)

| 축            | 값 (확정)                                |  수 |
| ------------- | ---------------------------------------- | --: |
| 조부 컨텍스트 | definite / shrink-to-fit (§3.0 2종)      |   2 |
| 중간 display  | `block` / `flex-row` / `grid(auto auto)` |   3 |
| 중간 크기     | auto / `width:150px` / `width:50%`       |   3 |
| leaf 크기     | auto / `width:50%`                       |   2 |

검증 대상: available / percentage base 의 **한 단계 전파** (조부→중간→leaf). **2×3×3×2 = 36**.

### §3.5 known-divergence 잠금 형식 (ratchet)

부분 격자마다 `it` 1개가 전 조합을 돌고, 발산 **키 집합**을 frozen 배열과 정확 비교한다:

```ts
const failures = runSweep(cases); // flexSweep 동형 — 케이스명 + 발산 필드
const keys = failures.map(shortKey).sort(); // "display=grid-1fr|w=50%|…" 형태
expect(keys).toEqual(KNOWN_DIVERGENCES); // 정확 일치 (superset/subset 모두 red)
```

- **정확 일치**라 양방향 ratchet 이 된다: 신규 발산 = 회귀로 red, 해소된 발산 = 목록에서 지우라고 red.
- 발산 **수치**는 §7 인벤토리에 기록한다 (테스트 파일에는 키만) — 수치까지 단언하면 무관한 엔진 변경마다 갱신 대상이 된다.
- 단건 잔존은 기존 관행대로 `it("잔존 — … (실측 스냅샷)")` 로 수치까지 단언 (8파일 선례: `containerIntrinsic`/`gridItemBox`/`shrinkToFitInline` 등).

### §3.6 leg 배정

| leg           | 범위                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| `engineLeg`   | 전 조합 (1,686) — TS 공급층과 격리된 엔진 자체 정합                                                                 |
| `pipelineLeg` | 부분 격자 1·2 의 **대표 부분집합** (display × width 직교, min/max·margin 은 대표 1값) ≈ 30+20 = 50 — TS 마스킹 감시 |

### §3.7 총량과 상한

- 확정 총 **1,686 조합** (900 + 30 + 720 + 36). 기존 실 조합 ≈ 2,061 대비 0.8배.
- **실행 시간 상한 (HC3 절대 수치)** — 2026-07-28 실측: 기존 parity 전체 (29파일 / 911 it / ≈2,061 조합) 가 **4.8초** wall (warm cache, `vitest run --config vitest.browser.config.ts`, 조합당 ≈0.7ms). 이에 근거해 상한을 고정한다:
  - 신규 격자 3파일 합산 단일 실행 **≤ 30초** wall
  - 신규 포함 parity 전체 **≤ 60초** wall
  - 선형 외삽 예상치는 +1.2초 (1,686 × 0.7ms) 라 약 20배 여유. 초과 시 축 축소가 케이스 삭제보다 우선하고, 축소 내역은 §4 사각 목록에 편입 (침묵 축소 금지).
- 추정 vs 실측 gap 은 절차 보강으로 흡수하고 전제 재검토 trigger 로 삼지 않는다 (adr-writing.md M3).

## §4. 사각 목록 — 확정 (격자가 못 여는 축, Phase 3 에서 layout-engine.md 이관)

| 사각                                                 | 사유 / 담당                                                                                                                                           |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 텍스트 실측정 sub-pixel                              | 스칼라 leaf 로 대체 — CanvasKit↔DOM 폰트 측정 차이는 별도 축 (nodeRendererText 교정 경로). `intrinsicSizing` pipeline leg 이 실텍스트 담당            |
| `position: absolute` 의 **조상 체인 / fixed**        | 기본형은 `phase4_5` E11 이 커버. ADR-164 Phase 0 의 **의도적 미지원 2건** (positioned ancestor 탐색 / viewport 기준 fixed) 만 사각 — 재개 조건 기정의 |
| overflow / scroll 상호작용                           | 렌더·히트 축 (canvas-rendering.md §8) — 레이아웃 격자 대상 아님. `autoMin` 이 overflow 를 §4.5 게이트로만 사용                                        |
| flex wrap 다중 라인                                  | `flexSweep` 담당 (WRAPS × LINE_COUNTS). 신규 격자는 nowrap 고정                                                                                       |
| 정렬 속성 (`justify-*`/`align-*`)                    | `flexSweep` (1152) + `crossAxisOverflow` + `gridAlignContent` 담당. 신규 격자는 부모 컨텍스트 신호로만 사용 (`alignItems:center`)                     |
| 중첩 2단 이상                                        | 부분 격자 3 은 1단 전파만 — 2단+ 는 조합 폭발, 1단 정합이면 귀납 가정                                                                                 |
| `writing-mode` / `direction` / `float` / inline flow | 엔진 미지원 표면 (NodeStyle 부재)                                                                                                                     |
| grid `%` 트랙 **내부 배분**                          | 기존 명시 이연 (layout-engine.md §그리드 자신의 min/max-content 잔존 — 실사용 0건). 트랙 sizing 2-pass 재설계 필요                                    |
| grid `auto-flow: column` 의 행 extent                | 기존 명시 잔존 (`shrinkToFitInline` `[잔존]`) — 신규 격자는 row-flow 고정                                                                             |
| `gap` / `padding` / `border` 조합                    | 기본 축 밖 — 격자는 0 리셋 고정 (`gridTrackContribution`/`gridMinmaxTracks` 가 부분 커버)                                                             |

> **판정 변경 (초안 대비)**: `aspect-ratio` 는 사각이 **아니다** — 엔진 지원 확인 (`tree.rs:4063 apply_aspect_to_dims`) + 기존 2케이스 (`phase5` E15). 얇은 커버라 부분 격자 1 의 소블록 30 조합으로 **편입**한다.

## §5. Phase 목록

### Phase 0 — 격자 설계 freeze (수정 0, 문서만) — 완료 2026-07-28

- [x] 기존 29 fixture 의 축 커버리지 맵 실측 확정 (§2 — `--reporter=json` 케이스 수 + 축 상수 추출)
- [x] 부분 격자 1~3 축 배열 + 케이스 수 확정 (§3 — 총 1,686 조합) + 하니스 계약 §3.0 / ratchet 형식 §3.5 / leg 배정 §3.6
- [x] 사각 목록 확정 (§4 — `aspect-ratio` 는 편입 판정, absolute 는 ADR-164 미지원 2건으로 축소)
- [x] 기존 parity 스위트 실행 시간 실측 (4.8초) → HC3 상한을 절대 수치로 고정 (§3.7) + ADR 본문 HC3 갱신
- [x] **G1**: 본 breakdown freeze

### Phase 1 — 격자 구현 + 발산 인벤토리 (엔진 수정 0)

- [ ] `apps/builder/tests/parity/basicAxisContainerSize.browser.test.ts` (부분 격자 1 + aspect 소블록)
- [ ] `apps/builder/tests/parity/basicAxisChildSize.browser.test.ts` (부분 격자 2)
- [ ] `apps/builder/tests/parity/basicAxisNesting.browser.test.ts` (부분 격자 3)
- [ ] harness 재사용 — 신규 harness 헬퍼가 필요하면 `harness.ts` 에 추가 (별도 harness 금지)
- [ ] 첫 실행 → 발산 전수 수집 → **ratchet 목록으로 잠금** (§3.5, 스위트 green 유지)
- [ ] 발산 군집화 보고: 군집별 {대표 케이스, 발산 수치, 추정 거처 (엔진 solve\_\* / TS 공급 / 스펙 조문), 케이스 수} — §7 부록에 기록
- [ ] 기존 parity 전체 (911 it) 회귀 0 + 실행 시간 HC3 상한 내 확인
- [ ] **G2**: 격자 green + 인벤토리 보고 완료

### Phase 2 — 군집별 수정 wave

- [ ] 군집당: 원인 확정 (스펙 조문 병기) → 엔진(`tree.rs`/`flex.rs`/`grid.rs`) 또는 TS(`fullTreeLayout.ts`/`utils.ts`) 수정 → 해당 키를 ratchet 목록에서 제거 → 민감도 (수정 되돌리면 red N건) → 커밋 1개
- [ ] 이연 판정 군집: 사유 필수 (실사용 0건 / 미지원 표면 편입 등) + 목록 유지 + §4 사각 목록 편입
- [ ] cargo 유닛 + layout 유닛 회귀 0 유지 + **엔진 마이크로벤치 회귀 0** (ADR-164 G3 벤치 — `packages/composition-engine/benches/{flex_shrink,tree_solve}.rs`. 수정 wave 는 재진입 pass 추가 등 perf-relevant — ADR-164/165 관행 승계)
- [ ] **G3**: ratchet 잔여 전건이 "명시 이연 + 사유" 상태
- 군집 수·수정 규모는 Phase 1 실측이 확정 — 비대 시 군집 단위로 커밋 분할 (phase 분할 원칙), wave 자체의 별도 ADR 분리는 하지 않는다 (결정 지점 아님)

### Phase 3 — 종결

- [ ] layout-engine.md: 사각 목록 절 + 수정 wave 에서 나온 신규 규칙 절 (기존 문서 관행대로 조문·실측·민감도 병기)
- [ ] CHANGELOG 엔트리 (Architecture — 격자 도입 + 군집 수정 요약)
- [ ] README 대시보드 갱신 + **G4**: live 1회 exercise (실제 builder 에서 기본 축 편집 시나리오 1건 — 완료 기준 규칙) 후 Implemented 승격

## §6. 파일 변경표

| 파일                                                                                      | Phase | 변경                          |
| ----------------------------------------------------------------------------------------- | ----- | ----------------------------- |
| `apps/builder/tests/parity/basicAxis{ContainerSize,ChildSize,Nesting}.browser.test.ts`    | 1     | 신규 (격자 3파일)             |
| `apps/builder/tests/parity/harness.ts`                                                    | 1     | 필요 시 헬퍼 추가만           |
| `packages/composition-engine/src/{tree,flex,grid}.rs`                                     | 2     | 군집별 수정 (인벤토리가 확정) |
| `apps/builder/src/builder/workspace/canvas/layout/**` (`fullTreeLayout.ts`/`utils.ts` 등) | 2     | TS 공급 군집 해당 시          |
| `.claude/rules/layout-engine.md`                                                          | 3     | 사각 목록 + 신규 규칙 절      |
| `docs/CHANGELOG.md` / `docs/adr/README.md`                                                | 3     | 종결 기록                     |

## §7. 발산 인벤토리 (Phase 1 산출 — 착수 전 공란)

> Phase 1 종료 시 군집 표를 여기에 기록한다. 형식:
>
> | 군집 | 대표 케이스 | Chrome | 엔진 | 추정 거처 | 케이스 수 | 판정 (수정/이연) |

## §8. 검증 계획

- 실행: `apps/builder` 에서 `npx vitest run --config vitest.browser.config.ts tests/parity/basicAxis*` (Playwright/Chromium)
- 회귀: 기존 parity 전체 + `cargo test` (composition-engine) + layout/canonical 유닛 + 엔진 마이크로벤치 (`cargo bench` — flex_shrink/tree_solve, Phase 2 한정)
- 실행 시간: 신규 3파일 ≤ 30초 / 전체 ≤ 60초 (§3.7 — 기존 4.8초 실측 기준)
- 민감도: Phase 2 각 군집 커밋 메시지에 "되돌리면 red N건" 명시 (기존 관행)
- G4 live: components 페이지가 아닌 **신규 빈 페이지** 에서 기본 축 편집 시나리오 (테스트 수준 공통 컴포넌트를 오라클로 쓰지 않는다 — memory 정본)
