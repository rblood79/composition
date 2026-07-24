# ADR-164 Design Breakdown: 레이아웃 TS 보정 레이어의 엔진 흡수

> 본문: [../164-engine-ts-compensation-absorption.md](../164-engine-ts-compensation-absorption.md)
> 결정·대안·위험 평가는 ADR 본문 소관 — 이 문서는 구현 상세만 담는다.

## 1. Scope lock-in (사용자 confirm 2026-07-24)

- **포함**: ② overflow×flexShrink 보정 → automatic minimum size 로 대체 / ③ min-width:auto 에뮬레이션 → 엔진 소속 / ④ position:absolute 잔여 (containing block 조상 체인 · fixed 처리 방침)
- **제외 (후속 ADR)**: ① intrinsic sizing (fit-content/min-content **텍스트 자동측정**) — WASM 경계 measure 콜백 아키텍처가 필요한 별도 설계 문제. CanvasKit 이 텍스트 측정 oracle 로 잔존한다는 제약은 본 ADR 전 phase 에 동일 적용.
- **제외 (렌더 레이어)**: ⑤ hitBoundsMap 산출의 Rust 이관 — 레이아웃이 아니라 렌더/인터랙션 소속 + bench 선행 필요.
- ①/⑤ 는 본 ADR Consequences 에 후속 관계만 기록한다.

## 2. Phase 0 — 인벤토리 freeze (필수 선행)

압축 전 분석이 stale 메모리를 승계해 ④ 를 "엔진 미지원" 으로 잘못 분류했던 전례가 본 ADR 의 직접 계기 중 하나다. 착수 시점에 아래를 재실측해 freeze 한다.

| #   | 실측 항목                           | 방법                                                                                                                                                                                                                                                                     |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0-1 | TS 보정 지점 전수 목록              | `fullTreeLayout.ts` Step 5.7 (현 2156~2180) / `utils.ts` enrichWithIntrinsicSize minWidth 동시 주입 (현 4703~4714, growsInFlex 분기 포함) / 기타 flexShrink·minWidth 주입처 grep (`implicitStyles.ts` 의 컴포넌트별 주입은 catalog 의미론이므로 **제외** — §6 잔존 계약) |
| 0-2 | Step 5.7 근사 발산 영향 범위 수식화 | 현존 문서에서 "overflow≠visible flex 컨테이너 + 자식 flexShrink 미명시 + min-content < 현재 배치폭" 조합 실측 (해당 조합만 명세 전환 시 shrink 재개 → 시각 변화 가능)                                                                                                    |
| 0-3 | ④ 잔여의 실사용 유무                | `position:absolute` 사용처 중 containing block 이 직계 부모가 **아닌** 사례 (positioned ancestor 2단 이상) + `position:fixed` 사용처 grep/실측. 메모리 기록(2026-07-14)상 "composition 실사용 = relative 부모 + absolute 자식이 전부" — 이 전제의 현재 유효성 재확인     |
| 0-4 | stale 문서 목록                     | `layout-engine.md` §"Overflow Scroll + Flex Shrink 보정" 의 `TaffyFlexEngine.ts _runTaffyPassRaw` 언급 (심볼 grep 0건 — 소멸) 등 개정 대상 절 확정                                                                                                                       |
| 0-5 | parity baseline                     | `apps/builder/tests/parity/*.browser.test.ts` (ADR-156 harness) 현행 PASS 상태 + bench 기준치 (`pnpm --filter composition-engine bench` 상당) 기록                                                                                                                       |

산출물: 본 문서 §7 인벤토리 표 갱신 커밋 1개. 추정 vs 실측 gap 발견 시 새 ADR 분리 사유가 아니라 본 표 보강으로 흡수한다 (adr-writing M3).

## 3. Phase 1 — automatic minimum size (②+③ 통합, 본체)

②와 ③은 같은 명세 조항의 두 증상이다: CSS-FLEXBOX-1 §4.5 automatic minimum size (`min-width:auto` = content-based minimum) 를 엔진이 0 으로 처리 → TS 가 두 갈래로 보정.

### 3-1. 엔진 구현 (`packages/composition-engine/src/`)

- `flex.rs` shrink 분배(§9.7 알고리즘, 현 `flex_shrink` data[off+16] 소비부)에 **content-based minimum floor** 추가: `min_width/min_height` 미명시(auto)인 flex item 은 shrink 결과를 content minimum 밑으로 내리지 않는다.
- content minimum 산출은 **definite 입력 기반 재귀 한정**: leaf = 주입된 definite main-size (TS enrichment 가 이미 px 로 확정해 보냄), 컨테이너 = 자식 content minimum 의 합/최대 (flex-direction 축 규칙). **텍스트 재측정 없음** — 재줄바꿈이 필요한 min-content 는 ①(후속 ADR) 영역이며, 그 경우 현행 injected minWidth 값이 상한 근사로 동작함을 §6 계약에 명시.
- item 자신의 `overflow≠visible` 이면 content-based minimum 을 적용하지 않는다 (명세 §4.5 조건 — automatic minimum 은 `overflow:visible` item 한정).
- `min_width:0` 명시값은 그대로 존중 (falsy 함정 재발 금지 — `Option` 부재와 `Some("0")` 구분).

### 3-2. TS 보정 제거 (같은 phase 필수 — dormant/이중 적용 금지)

| 제거 대상                                                                                | 위치                          | 대체                                                            |
| ---------------------------------------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------- |
| Step 5.7 부모-overflow 기준 flexShrink:0 강제 주입                                       | `fullTreeLayout.ts` 2156~2180 | 엔진 §4.5 floor (부모가 아니라 **item 기준** — 명세 정합화)     |
| enrichWithIntrinsicSize 의 minWidth 동시 주입 (`isFlexChild && style?.minWidth == null`) | `utils.ts` 4703~4714          | 엔진이 injected width 를 content minimum 으로 소비              |
| growsInFlex 분기의 "minWidth 만 주입" 경로                                               | `utils.ts` 동일 함수          | 동일 — 단 **width 주입 자체는 유지** (측정값 전달 채널, ① 영역) |

- 제거 후 grep gate: `flexShrink: 0` 신규 주입 0건 (shorthand 파서 `flex: none` 해석 제외), `minWidth = ceiledWidth` 0건.
- `TaffyFlexEngine.ts` / `utils.ts:5307~5334` 의 flex shorthand 파서 중복은 본 phase 범위 아님 (보정이 아니라 파싱 — 정리하려면 별도 리팩터).

### 3-3. 검증

- 신규 parity fixture (ADR-156 harness): (a) scroll 컨테이너 flex 자식 shrink — Chrome 실측 vs 엔진, **raw style 직행** (Step 5.7 제거 후 보정 없는 입력) (b) `flex:1 minWidth:0` 축소 허용 (c) 자식 flexShrink 명시 시 min floor 와의 상호작용 (d) column 축 min-height:auto 대칭.
- 기존 parity/유닛 전체 회귀 + Phase 0 에서 수식화한 발산 조합의 실문서 live 확인.

## 4. Phase 2 — position:absolute 잔여 (④)

엔진은 2026-07-14 `67ddfe899` 로 out-of-flow 배치를 이미 구현했다 (`tree.rs::solve_node` in-flow/out-of-flow 분리 + `place_absolute_children` + `resolve_abs_axis` — 양측 inset stretch / margin-auto 센터링 / 음수 inset·margin). 잔여 2건의 처리 방침은 ADR 본문 Decision 의 조건부 규칙을 따른다:

| 잔여                                                     | 현행             | Phase 0-3 실측 결과에 따라                                                                                                                       |
| -------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| containing block 조상 체인 (nearest positioned ancestor) | 직계 부모 고정   | 실사용 0건 → "의도적 미지원" 을 `tree.rs` doc comment + `layout-engine.md` 에 명문화하고 종결 / 실사용 있음 → `tree.rs` 조상 탐색 구현 + fixture |
| `position:fixed` viewport 기준                           | absolute 로 근사 | 동일 규칙 (캔버스 환경에서 viewport = page frame 인지의 판정 포함)                                                                               |

## 5. Phase 3 — 문서·규칙 정합 + 경계 계약 명문화

- `layout-engine.md`: §"Overflow Scroll + Flex Shrink 보정" 절 폐기(§4.5 엔진 소속으로 대체 서술) + `_runTaffyPassRaw` stale 제거 + §"CSS min-width:auto 에뮬레이션" 절을 엔진 계약 서술로 교체.
- `canvas-rendering.md` 금지 패턴 중 flexShrink/minWidth TS 주입 관련 항목 갱신.
- **TS 잔존 계약** 절 신설 (`layout-engine.md`): §6 표를 규칙화 — 이후 세션이 엔진 gap 을 TS 보정으로 다시 메우는 침식 차단.
- CHANGELOG (Architecture) + ADR-916 후속 관계 기록.

## 6. TS 잔존 계약 (경계 — 본 ADR 이후에도 TS 에 남는 것)

| 잔존                                                                                              | 이유                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 텍스트/leaf 측정값 주입 (enrichWithIntrinsicSize 의 width 주입 자체)                              | CanvasKit 이 측정 oracle — "Layout = Canvas 2D = CSS 정합" 규칙. 엔진 자체 측정 도입 금지. ① 후속 ADR 에서도 측정 주체는 불변(소비 알고리즘만 이관 검토) |
| `implicitStyles.ts` 컴포넌트별 주입 (indicator 크기, collection item font, synthetic children 등) | catalog/spec 의미론 (D3 SSOT 파생) — CSS 표준 의미론이 아니라 composition 디자인 규칙                                                                    |
| 2-pass Step 4.5 재계산                                                                            | intrinsic 측정-배치 닭-달걀의 우회 장치 — ① 이 해소하기 전까지 유지                                                                                      |
| f32 `Math.ceil` 보정                                                                              | 엔진 f32 ↔ JS f64 정밀도 경계 — 흡수 대상 아님                                                                                                           |
| layoutCache 시그니처/무효화 (5-심볼 2계층)                                                        | store 결합 — 마샬링 비용 > 계산 비용                                                                                                                     |

## 7. 인벤토리 표 (Phase 0 산출물 — 착수 시 갱신)

> Phase 0 완료 전까지는 2026-07-24 사전 조사 값. freeze 시 실측으로 교체.

| 항목                    | 사전 조사 값 (2026-07-24)                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| TS 레이어 규모          | `utils.ts` 5,422 / `fullTreeLayout.ts` 3,034 / `implicitStyles.ts` 2,774 (합 11,230줄 — 이 중 본 ADR 제거 대상은 §3-2 표의 보정 지점) |
| Step 5.7 소재           | `fullTreeLayout.ts:2156` (단일 소재 — 문서의 TaffyFlexEngine 이중화 서술은 stale)                                                     |
| minWidth 동시 주입 소재 | `utils.ts:4712`                                                                                                                       |
| 엔진 automatic minimum  | 부재 (`flex.rs` §9.7 분배는 `flex_shrink`/명시 `min_width` 만 소비)                                                                   |
| 엔진 absolute           | 구현됨 (`tree.rs:609~790`, `resolve_abs_axis` 2414~) — 잔여는 §4 표 2건                                                               |
| parity harness          | `apps/builder/tests/parity/*.browser.test.ts` + `vitest.browser.config.ts` (ADR-156)                                                  |

## 8. 커밋 단위

- Phase 당 커밋 1~2개 (엔진 구현 + TS 제거는 **같은 커밋** 또는 연속 커밋으로 같은 push). "narrow" sliver 분해 금지 (adr-writing M4).
- 각 phase 종료 시 live builder 1회 exercise 명시 (완료 기준 규칙 — test PASS 단독 종결 금지).
