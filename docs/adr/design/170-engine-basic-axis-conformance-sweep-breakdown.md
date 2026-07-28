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
2. **발견과 수정의 분리** — Phase 1 은 수정 0. 발산은 **known-divergence 스냅샷** (기존 fixture 의 `[잔존]` describe 패턴과 동형 — 발산 수치 자체를 단언) 으로 잠가 스위트는 항상 green 을 유지한다. 수정 wave (Phase 2) 가 스냅샷을 parity 단언으로 교체해 간다. red 방치 금지.
3. **축 분해로 조합 폭발 관리** — 전체 직교곱 1개가 아니라 부분 격자 여러 개 (flexSweep 이 교차축 576 + main 576 으로 분해한 방식). 각 부분 격자는 자기 축만 전수, 나머지 축은 대표값 고정.
4. **사각 명시** — 격자는 자신이 열거한 축만 증명한다 (flexSweep 이 미결정 main 을 못 잡았던 실증 — `crossAxisOverflow.browser.test.ts` `INDEFINITE_MAIN_CASES` 가 유일 감시자였음). "격자가 못 여는 축" 목록 (§4) 을 Phase 0 에 freeze 하고 layout-engine.md 에 문서화한다.
5. **스펙 조문 병기** — 발산 판정 시 Chrome 특이 동작(quirk) 을 스펙으로 오인하지 않도록, 군집 보고서에 CSS 조문 (CSS-SIZING-3 / FLEXBOX-1 / GRID-1 §번호) 대조를 병기한다 (layout-engine.md 기존 관행).

## §2. 기존 커버리지 맵 — 초안 (Phase 0 에서 실측 freeze)

> 목적: 신규 격자가 이미 잠긴 축을 중복 열거하지 않게 한다. 아래는 파일 헤더 기반 초안이며 Phase 0 에서 케이스 단위 실측으로 확정한다.

| 기존 fixture                                                                                                                          | 커버 축                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `flexSweep` (1152)                                                                                                                    | flex 정렬 3축 (justify/align-items/align-content) × 양·음 여유 — **main 항상 확정** (사각) |
| `crossAxisOverflow`                                                                                                                   | 음수 여유 정렬 좌표 명시 + 미결정 main 센티넬                                              |
| `autoMargin` (79) / `reverseMargin` (44)                                                                                              | flex auto margin 흡수 / `*-reverse` margin 축 스왑                                         |
| `percentSize` / `slotPercentChild`                                                                                                    | `%` 해소의 축별 definite 조건                                                              |
| `autoMin` (8) / `intrinsicSizing`                                                                                                     | §4.5 automatic minimum + 측정 스칼라                                                       |
| `containerIntrinsic` / `gridContainerIntrinsic`                                                                                       | 컨테이너 intrinsic 측정 모드 (flex item / grid 키워드)                                     |
| `gridContainerBlockSize` / `gridItemBox` / `gridMinmaxTracks` / `gridTrackContribution` / `gridAutoTrackStretch` / `gridAlignContent` | grid 트랙 sizing (§12.5~§12.8) + item 상자 모델                                            |
| `shrinkToFitInline` (49)                                                                                                              | shrink-to-fit 확정 후 재해소 + 암묵 열                                                     |
| `containerAlign`                                                                                                                      | 비-stretch 교차축 shrink-to-fit                                                            |
| `bodyViewportBox`                                                                                                                     | body min-height 주입 + 3축 clamp 재분배                                                    |
| `flexItemDimContract`                                                                                                                 | 배치 직렬화 (숫자/문자열 계약)                                                             |
| `phase2~5` / `layer2` / `engineCssParity`                                                                                             | ADR-156 발산 17군 역사적 축                                                                |

관찰: 기존 커버는 **결함이 발견된 곳** 중심의 점 커버다. "결함이 발견되지 않은 조합" 을 체계 열거한 적이 없다 — 그 구멍이 신규 격자의 대상이다.

## §3. 신규 격자 축 설계 (Phase 0 에서 배열 freeze)

공통: 케이스 생성은 flexSweep 의 축 배열 × 생성 함수 패턴. 자식 leaf 는 측정 스칼라 (`contentMinWidth`/`contentMaxWidth` + `domAtoms`) 로 텍스트 실측정을 배제 (정수 오라클).

### 부분 격자 1 — 컨테이너 자기 크기 (`basicAxisContainerSize`)

| 축            | 값                                                                        |
| ------------- | ------------------------------------------------------------------------- |
| display       | `block` / `flex-row` / `flex-column` / `grid(auto)` / `grid(1fr 1fr)`     |
| width         | 미지정(auto) / `px` / `%` / `min-content` / `max-content` / `fit-content` |
| height        | 미지정 / `px` / `%`                                                       |
| min/max       | 없음 / `minWidth` / `maxWidth` / `minHeight` / `maxHeight` (각 1값)       |
| 부모 컨텍스트 | definite(stretch) / shrink-to-fit(`align-items:center` column flex)       |

자식은 스칼라 leaf 2개 고정. 추정 5×6×3×5×2 = **900** — 실행 시간 초과 시 min/max 축을 대표 2조합으로 축소 (450).

### 부분 격자 2 — 자식 크기 (`basicAxisChildSize`)

| 축           | 값                                                |
| ------------ | ------------------------------------------------- |
| 부모 display | 4종 (부분 격자 1과 동일 대표)                     |
| 자식 width   | auto / `px` / `%` / `fit-content` / `max-content` |
| 자식 height  | auto / `px` / `%`                                 |
| 자식 margin  | 0 / `px` / `%` / `auto` (인라인 축)               |
| 자식 min/max | 없음 / `minWidth` / `maxWidth`                    |

부모 크기는 definite 고정 (미결정 부모는 부분 격자 1·3 담당). 추정 4×5×3×4×3 = **720** — 초과 시 height 축 축소.

### 부분 격자 3 — 중첩 전파 (`basicAxisNesting`)

| 축           | 값                                                 |
| ------------ | -------------------------------------------------- |
| 조부 display | flex-column(definite) / flex-column(shrink-to-fit) |
| 중간 display | block / flex-row / grid(auto)                      |
| 중간 크기    | auto / `px` / `%`                                  |
| leaf 크기    | auto / `%`                                         |

검증 대상: available/percentage base 의 **한 단계 전파** (조부→중간→leaf). 추정 2×3×3×2 = **36** + 대조군.

### 총량과 상한

- 추정 총 900+720+36 ≈ **1,650 케이스** (flexSweep 1152 와 동급 클래스).
- **상한 계약**: 신규 격자 3파일 합산 로컬 단일 실행 ≤ 기존 parity 스위트 전체 실행 시간 (수 분대). 초과 시 축 축소가 케이스 삭제보다 우선 (축소 내역은 §4 사각 목록에 편입).
- 추정치는 Phase 0 freeze 에서 실측 확정 — 추정 vs 실측 gap 은 절차 보강으로 흡수하고 전제 재검토 trigger 로 삼지 않는다 (adr-writing.md M3).

## §4. 사각 목록 — 초안 (격자가 못 여는 축, Phase 0 freeze 후 layout-engine.md 이관)

| 사각                                           | 사유 / 담당                                                                                    |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 텍스트 실측정 sub-pixel                        | 스칼라 leaf 로 대체 — CanvasKit↔DOM 폰트 측정 차이는 별도 축 (기존 nodeRendererText 교정 경로) |
| `position: absolute/fixed`                     | ADR-164 의도적 미지원 경계 — 재개 조건 별도 정의됨                                             |
| overflow/scroll 상호작용                       | 렌더/히트 축 (canvas-rendering.md §8) — 레이아웃 격자 대상 아님                                |
| flex wrap 다중 라인 조합                       | flexSweep 담당 (LINE_COUNTS 축)                                                                |
| 중첩 2단 이상                                  | 부분 격자 3 은 1단 전파만 — 2단+ 는 조합 폭발, 1단 정합이면 귀납 가정                          |
| writing-mode / direction / float / inline flow | 엔진 미지원 표면                                                                               |
| `aspect-ratio`                                 | Phase 0 에서 엔진 지원 여부 실측 후 편입/사각 판정                                             |
| grid `%` 트랙 내부 배분                        | 기존 명시 이연 (layout-engine.md §그리드 자신의 min/max-content 잔존 — 실사용 0건)             |

## §5. Phase 목록

### Phase 0 — 격자 설계 freeze (수정 0, 문서만)

- [ ] 기존 29 fixture 의 축 커버리지 맵 실측 확정 (§2 표 갱신)
- [ ] 부분 격자 1~3 축 배열 + 케이스 수 확정 (§3 표 갱신)
- [ ] 사각 목록 확정 (§4 표 갱신, `aspect-ratio` 판정 포함)
- [ ] 기존 parity 스위트 실행 시간 실측 → HC3 상한을 절대 수치 (분) 로 고정하고 ADR 본문 HC3 갱신
- [ ] **G1**: 본 breakdown freeze — 리뷰 후 Phase 1 진입

### Phase 1 — 격자 구현 + 발산 인벤토리 (엔진 수정 0)

- [ ] `apps/builder/tests/parity/basicAxisContainerSize.browser.test.ts` (부분 격자 1)
- [ ] `apps/builder/tests/parity/basicAxisChildSize.browser.test.ts` (부분 격자 2)
- [ ] `apps/builder/tests/parity/basicAxisNesting.browser.test.ts` (부분 격자 3)
- [ ] harness 재사용 — 신규 harness 헬퍼가 필요하면 `harness.ts` 에 추가 (별도 harness 금지)
- [ ] 첫 실행 → 발산 전수 수집 → **known-divergence 스냅샷으로 잠금** (스위트 green 유지)
- [ ] 발산 군집화 보고: 군집별 {대표 케이스, 발산 수치, 추정 거처 (엔진 solve\_\* / TS 공급 / 스펙 조문), 케이스 수} — 본 breakdown §7 부록에 기록
- [ ] 기존 parity 전체 (911+) 회귀 0 확인
- [ ] **G2**: 격자 green + 인벤토리 보고 완료

### Phase 2 — 군집별 수정 wave

- [ ] 군집당: 원인 확정 (스펙 조문 병기) → 엔진(`tree.rs`/`flex.rs`/`grid.rs`) 또는 TS(`fullTreeLayout.ts`/`utils.ts`) 수정 → 해당 스냅샷을 parity 단언으로 교체 → 민감도 (수정 되돌리면 red N건) → 커밋 1개
- [ ] 이연 판정 군집: 사유 필수 (실사용 0건 / 미지원 표면 편입 등) + 스냅샷 유지 + §4 사각 목록 편입
- [ ] cargo 유닛 + layout 유닛 회귀 0 유지 + **엔진 마이크로벤치 회귀 0** (ADR-164 G3 벤치 — `packages/composition-engine/benches/{flex_shrink,tree_solve}.rs`. 수정 wave 는 재진입 pass 추가 등 perf-relevant — ADR-164/165 관행 승계)
- [ ] **G3**: 스냅샷 잔여 전건이 "명시 이연 + 사유" 상태
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
- 민감도: Phase 2 각 군집 커밋 메시지에 "되돌리면 red N건" 명시 (기존 관행)
- G4 live: components 페이지가 아닌 **신규 빈 페이지** 에서 기본 축 편집 시나리오 (테스트 수준 공통 컴포넌트를 오라클로 쓰지 않는다 — memory 정본)
