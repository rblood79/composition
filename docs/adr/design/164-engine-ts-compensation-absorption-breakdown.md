# ADR-164 Design Breakdown: 레이아웃 TS 보정 레이어의 엔진 흡수

> 본문: [../164-engine-ts-compensation-absorption.md](../164-engine-ts-compensation-absorption.md)
> 결정·대안·위험 평가는 ADR 본문 소관 — 이 문서는 구현 상세만 담는다.

## 1. Scope lock-in (사용자 confirm 2026-07-24)

- **포함**: ② overflow×flexShrink 보정 → automatic minimum size 로 대체 / ③ min-width:auto 에뮬레이션 → 엔진 소속 / ④ position:absolute 잔여 (containing block 조상 체인 · fixed 처리 방침)
- **제외 (후속 ADR)**: ① intrinsic sizing (fit-content/min-content **텍스트 자동측정**) — WASM 경계 measure 콜백 아키텍처가 필요한 별도 설계 문제. CanvasKit 이 텍스트 측정 oracle 로 잔존한다는 제약은 본 ADR 전 phase 에 동일 적용.
- **제외 (렌더 레이어)**: ⑤ hitBoundsMap 산출의 Rust 이관 — 레이아웃이 아니라 렌더/인터랙션 소속 + bench 선행 필요.
- **제외 (grid intrinsic 계열, round 1 리뷰 반영)**: grid item automatic minimum (CSS-GRID-1 §6.6) · intrinsic track (min/max-content) — grid.rs 미구현 영역으로 ① 후속과 동반. 본 ADR 의 §4.5 floor 는 flex item 한정.
- ①/⑤ 는 본 ADR Consequences 에 후속 관계만 기록한다.

## 2. Phase 0 — 인벤토리 freeze (필수 선행) — ✅ Implemented 2026-07-24

압축 전 분석이 stale 메모리를 승계해 ④ 를 "엔진 미지원" 으로 잘못 분류했던 전례가 본 ADR 의 직접 계기 중 하나다. 착수 시점에 아래를 재실측해 freeze 한다.

| #   | 실측 항목                           | 방법                                                                                                                                                                                                                                                                     |
| --- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0-1 | TS 보정 지점 전수 목록              | `fullTreeLayout.ts` Step 5.7 (현 2156~2180) / `utils.ts` enrichWithIntrinsicSize minWidth 동시 주입 (현 4703~4714, growsInFlex 분기 포함) / 기타 flexShrink·minWidth 주입처 grep (`implicitStyles.ts` 의 컴포넌트별 주입은 catalog 의미론이므로 **제외** — §6 잔존 계약) |
| 0-2 | Step 5.7 근사 발산 영향 범위 수식화 | 현존 문서에서 "overflow≠visible flex 컨테이너 + 자식 flexShrink 미명시 + min-content < 현재 배치폭" 조합 실측 (해당 조합만 명세 전환 시 shrink 재개 → 시각 변화 가능)                                                                                                    |
| 0-3 | ④ 잔여의 실사용 유무                | `position:absolute` 사용처 중 containing block 이 직계 부모가 **아닌** 사례 (positioned ancestor 2단 이상) + `position:fixed` 사용처 grep/실측. 메모리 기록(2026-07-14)상 "composition 실사용 = relative 부모 + absolute 자식이 전부" — 이 전제의 현재 유효성 재확인     |
| 0-4 | stale 문서 목록                     | `layout-engine.md` §"Overflow Scroll + Flex Shrink 보정" 의 `TaffyFlexEngine.ts _runTaffyPassRaw` 언급 (심볼 grep 0건 — 소멸) 등 개정 대상 절 확정                                                                                                                       |
| 0-5 | parity baseline                     | `apps/builder/tests/parity/*.browser.test.ts` (ADR-156 harness) 현행 PASS 상태 + bench 기준치 (`pnpm --filter composition-engine bench` 상당) 기록                                                                                                                       |

산출물: 본 문서 §7 인벤토리 표 갱신 커밋 1개. 추정 vs 실측 gap 발견 시 새 ADR 분리 사유가 아니라 본 표 보강으로 흡수한다 (adr-writing M3).

## 3. Phase 1 — automatic minimum size (②+③ 통합, 본체) — ✅ Implemented 2026-07-25

> G3 실측 결과: bench best-of-N median 기준 S1 15.9→16.7µs / S2 69.1→71.1µs (+2.9%, floor 동결 작업 추가 포함) / S3 14.9→15.2µs — 기준치 대비 노이즈 밴드(±10%) 이내, 회귀 0 판정. 코드 반영 경위는 ADR 본문 진행 로그 참조 (병렬 세션 커밋 `3045fd979` 에 동승).

②와 ③은 같은 명세 조항의 두 증상이다: CSS-FLEXBOX-1 §4.5 automatic minimum size (`min-width:auto` = content-based minimum) 를 엔진이 0 으로 처리 → TS 가 두 갈래로 보정.

### 3-1. 엔진 구현 (`packages/composition-engine/src/`) — 2026-07-25 착수 실측 정정 (사용자 confirm)

- `flex.rs` shrink 분배(§9.7 알고리즘, 현 `flex_shrink` data[off+16] 소비부)에 **content-based minimum floor** 추가: `parse_item` 에서 effective `min_main` 으로 해석 — 이후 §9.7 clamp/violation 동결 기계가 자연 처리.
- **floor 적용 조건 (실측 정정)**: `min_main == AUTO` ∧ item 주축 overflow visible ∧ **`width == AUTO`** — floor = `content_main` (max_main clamp). width-auto item 만인 이유: explicit 노드의 content 슬롯은 border-box 저장이라 신뢰 불가 (`tree.rs:592~598` 주석), 그리고 **엔진 leaf 는 자기 content 를 모른다** (`tree.rs:654~664` — width auto leaf 는 0 반환, 텍스트 측정 부재). width-definite item 에 width 를 floor 로 쓰면 명세(min(content 제안, specified 제안))보다 과대해 Chrome parity 가 깨진다 (빈 div width:200 은 Chrome 에서 0 까지 shrink).
- **텍스트 leaf 의 content 제안값은 TS `minWidth` 주입이 명시 min 채널로 전달** (§6 잔존 계약 — 재분류). 컨테이너 item(width auto)은 재귀 solve 결과 `content_main` 이 진짜 content 라 엔진 floor 대상.
- `min_width:0` 명시값은 그대로 존중 (falsy 함정 재발 금지 — `Option` 부재와 `Some("0")` 구분).
- **바이너리 프로토콜 (실측 정정)**: `FLEX_FIELD_COUNT` 18→19 — off 18 = item 주축 overflow (0=visible, zero-init = CSS 기본값 정합 / 1=clipped). flex 데이터 배열은 `tree.rs::solve_flex` 가 **Rust 내부에서 구성** (`write_flex_item`) 하므로 TS 직렬화 무변경 — NodeStyle 은 `overflow_x/overflow_y` 를 이미 수신 (`tree.rs:108~109`). "3 직렬화 경로 동시 갱신" Soft Constraint 는 TS→WASM JSON style 필드 추가 시에만 해당 (이번엔 미해당).

### 3-2. TS 보정 제거·재분류 (같은 phase 필수 — dormant/이중 적용 금지)

| 대상                                                                                     | 위치                          | 처분 (2026-07-25 정정)                                                                                            |
| ---------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Step 5.7 부모-overflow 기준 flexShrink:0 강제 주입                                       | `fullTreeLayout.ts` 2156~2179 | **제거 (원안 유지)** — 엔진 §4.5 floor 가 대체 (부모가 아니라 **item 기준** — 명세 정합화)                        |
| enrichWithIntrinsicSize 의 minWidth 동시 주입 (`isFlexChild && style?.minWidth == null`) | `utils.ts` 4703~4714          | **잔존 재분류 (G2 재정의, 사용자 confirm)** — leaf content 제안값 전달 채널 (width 주입과 동일 범주, ① 까지 존속) |
| growsInFlex 분기의 "minWidth 만 주입" 경로                                               | `utils.ts` 동일 함수          | **잔존 재분류 (동일)** — grow leaf 는 width 미주입이라 minWidth 가 유일 content 채널                              |

- 제거 후 grep gate (G2 재정의): Step 5.7 의 `flexShrink: 0` 강제 주입 0건 (shorthand 파서 `flex: none` 해석 제외). minWidth 축 grep 은 §6 재분류로 대체 — 주입 코드의 주석을 "leaf content 제안값 전달 채널 (ADR-164 §6)" 로 갱신해 보정 오인 재발 차단.
- `TaffyFlexEngine.ts` / `utils.ts:5307~5334` 의 flex shorthand 파서 중복은 본 phase 범위 아님 (보정이 아니라 파싱 — 정리하려면 별도 리팩터).

### 3-3. 검증

- 신규 parity fixture (ADR-156 harness): (a) scroll 컨테이너 flex 자식 shrink — Chrome 실측 vs 엔진, **raw style 직행** (Step 5.7 제거 후 보정 없는 입력) (b) `flex:1 minWidth:0` 축소 허용 (c) 자식 flexShrink 명시 시 min floor 와의 상호작용 (d) column 축 min-height:auto 대칭 (e) **grid 클립 컨테이너 no-op 확증** — Step 5.7 은 `FLEX_GRID_DISPLAYS` 대상(`fullTreeLayout.ts:2159`)이라 제거가 grid 경로 무영향임을 fixture 로 증명 (grid 알고리즘은 `flex_shrink` 미소비. grid item automatic minimum(CSS-GRID-1 §6.6)·intrinsic track 은 본 ADR 범위 밖 — grid.rs 미구현 영역, ① 후속과 동반).
- 기존 parity/유닛 전체 회귀 + Phase 0 에서 수식화한 발산 조합의 실문서 live 확인.
- **G3 bench (Phase 0 실측 반영 → 2026-07-25 신설 완료)**: 전용 bench harness 부재가 확정됐으므로 Phase 1 에서 flex shrink 케이스 **zero-dep micro-bench** (`benches/flex_shrink.rs`, `harness=false` + `Instant` 중앙값 — criterion 상당, `panic=abort` 프로필·의존 최소화 기조로 외부 crate 미도입) 를 신설했고, **floor 도입 직전 기준치 (best-of-N median)**: `shrink_nowrap_1000` ≈ 15.9µs / `shrink_wrap_auto_1200` ≈ 69.1µs / `grow_nowrap_1000` ≈ 14.9µs. 도입 후 동일 시나리오 on/off 비교로 회귀 0 을 판정한다 (런 간 노이즈 ±10% 관측 — 판정은 best-of-N 끼리 비교).

## 4. Phase 2 — position:absolute 잔여 (④) — ✅ Implemented 2026-07-25 (의도적 미지원 명문화 경로)

엔진은 2026-07-14 `67ddfe899` 로 out-of-flow 배치를 이미 구현했다 (`tree.rs::solve_node` in-flow/out-of-flow 분리 + `place_absolute_children` + `resolve_abs_axis` — 양측 inset stretch / margin-auto 센터링 / 음수 inset·margin). 잔여 2건의 처리 방침은 ADR 본문 Decision 의 조건부 규칙을 따른다:

| 잔여                                                     | 현행             | Phase 0-3 실측 결과에 따라                                                                                                                       |
| -------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| containing block 조상 체인 (nearest positioned ancestor) | 직계 부모 고정   | 실사용 0건 → "의도적 미지원" 을 `tree.rs` doc comment + `layout-engine.md` 에 명문화하고 종결 / 실사용 있음 → `tree.rs` 조상 탐색 구현 + fixture |
| `position:fixed` viewport 기준                           | absolute 로 근사 | 동일 규칙 (캔버스 환경에서 viewport = page frame 인지의 판정 포함)                                                                               |

> **Phase 0-3 실측 결과 (2026-07-24, §7)**: 두 잔여 모두 실사용 **0건** → Decision 조건부 규칙상 "의도적 미지원 명문화" 경로. G5 근거 확보.

## 5. Phase 3 — 문서·규칙 정합 + 경계 계약 명문화

- `layout-engine.md`: §"Overflow Scroll + Flex Shrink 보정" 절 폐기(§4.5 엔진 소속으로 대체 서술) + `_runTaffyPassRaw` stale 제거 + §"CSS min-width:auto 에뮬레이션" 절을 엔진 계약 서술로 교체.
- `canvas-rendering.md` 금지 패턴 중 flexShrink/minWidth TS 주입 관련 항목 갱신.
- **TS 잔존 계약** 절 신설 (`layout-engine.md`): §6 표를 규칙화 — 이후 세션이 엔진 gap 을 TS 보정으로 다시 메우는 침식 차단.
- CHANGELOG (Architecture) + ADR-916 후속 관계 기록.

## 6. TS 잔존 계약 (경계 — 본 ADR 이후에도 TS 에 남는 것)

| 잔존                                                                                              | 이유                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 텍스트/leaf 측정값 주입 (enrichWithIntrinsicSize 의 width 주입 자체)                              | CanvasKit 이 측정 oracle — "Layout = Canvas 2D = CSS 정합" 규칙. 엔진 자체 측정 도입 금지. ① 후속 ADR 에서도 측정 주체는 불변(소비 알고리즘만 이관 검토)                                         |
| `implicitStyles.ts` 컴포넌트별 주입 (indicator 크기, collection item font, synthetic children 등) | catalog/spec 의미론 (D3 SSOT 파생) — CSS 표준 의미론이 아니라 composition 디자인 규칙                                                                                                            |
| 2-pass Step 4.5 재계산                                                                            | intrinsic 측정-배치 닭-달걀의 우회 장치 — ① 이 해소하기 전까지 유지                                                                                                                              |
| enrichWithIntrinsicSize 의 minWidth 동시 주입 (growsInFlex 포함, `utils.ts:4712`)                 | **텍스트 leaf 의 §4.5 content 제안값 전달 채널** (2026-07-25 재분류, 사용자 confirm) — 엔진은 텍스트 측정 부재로 leaf content 무지 (`tree.rs:654~664`). ① 이 content 채널을 재설계할 때까지 잔존 |
| f32 `Math.ceil` 보정                                                                              | 엔진 f32 ↔ JS f64 정밀도 경계 — 흡수 대상 아님                                                                                                                                                   |
| layoutCache 시그니처/무효화 (5-심볼 2계층)                                                        | store 결합 — 마샬링 비용 > 계산 비용                                                                                                                                                             |

## 7. 인벤토리 표 (Phase 0 산출물 — 2026-07-24 freeze)

> Phase 0 실측 완료 (execute-adr). 사전 조사 값과의 gap 은 본 표 보강으로 흡수했다 (adr-writing M3).

| 항목                                          | 실측 값 (2026-07-24 freeze)                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TS 레이어 규모                                | `utils.ts` 5,422 / `fullTreeLayout.ts` 3,034 / `implicitStyles.ts` 2,774 (합 11,230줄 — wc 재검 일치). 본 ADR 제거 대상은 §3-2 표의 보정 지점 한정                                                                                                                                                                                                                                                                                                                                                   |
| Step 5.7 소재·조건 (0-1)                      | `fullTreeLayout.ts:2156~2179` **단일 소재** (TaffyFlexEngine 이중화 서술은 stale — 0-4). 조건 실측: `FLEX_GRID_DISPLAYS` 컨테이너 ∧ 주축 방향 overflow≠visible(`overflow` 단축 fallback, row→overflowX / column→overflowY) → flexShrink 미명시 자식 **전원** `flexShrink=0`. grid 컨테이너도 주입 대상이나 grid 알고리즘은 flex_shrink 미소비 → no-op (fixture (e) 확증 대상)                                                                                                                        |
| minWidth 동시 주입 소재 (0-1)                 | `utils.ts:4712~4713` (`isFlexChild && style?.minWidth == null` → `injectedStyle.minWidth = ceiledWidth`). growsInFlex 분기 `4703~4705` — width 주입은 non-grow 한정이며 **width 주입 자체는 유지 대상** (측정값 전달 채널, ① 영역)                                                                                                                                                                                                                                                                   |
| 기타 flexShrink/minWidth 소재 전수 판정 (0-1) | 제거 대상 아님 4군: ⓐ `implicitStyles.ts` 28건 — catalog/컴포넌트 의미론 (예: Label 공통 `flexShrink:0` 주입 `2710~2721`) → §6 잔존 ⓑ `taffyDisplayAdapter.ts:247` INLINE_BLOCK_LEAF `flexShrink:0` — inline-block 비축소 에뮬레이션 (display 의미론) ⓒ flex shorthand 파싱 3곳 (`fullTreeLayout.ts:579~587` / `TaffyFlexEngine.ts:184~219` / `utils.ts:5310~5321`) — §3-2 명시 제외 ⓓ `utils.ts:2031` (catalog sizeConfig read) · `4150` (style 파싱) · `5220` (NodeStyle passthrough) — 주입 아님  |
| 발산 조합 수식화 (0-2)                        | Step 5.7 발산 = {주축 overflow≠visible flex 컨테이너} ∧ {자식 flexShrink 미명시} ∧ {Σ 자식 hypothetical size > 배치폭}. 현행 = shrink 전면 금지 → CSS 대비 과대 폭·오버플로. 명세 전환 시 **이 조합만** §4.5 floor 까지 shrink 재개 (R1 조합 = G4 live 확인 대상). 역방향: injected minWidth = 단일줄 측정폭(ceil) ≥ 실제 min-content → 재줄바꿈 케이스에서 CSS 대비 덜 shrink — ① 영역, §6 "상한 근사" 계약과 일치                                                                                  |
| ④ 실사용 (0-3)                                | **0건**: factory absolute/fixed 기본값 0건 (`position:"relative"` 1건 — `GroupComponents.ts:32`) + Inspector position 편집 UI 미노출 (panels grep 0건). TS fixed→absolute 강제 변환 지점: `fullTreeLayout.ts:597·861~868` / `TaffyBlockEngine.ts:138·187` / `TaffyFlexEngine.ts:121~124·266` (엔진은 absolute 만 수신). 렌더 층에 별도 sticky/fixed 좌표 보정 경로 존속 (`renderCommands.ts:499~`, ADR-151 B19 카메라 역보정 미활성 — 보류 항목). → Phase 2 는 "의도적 미지원 명문화" 경로 (G5 근거) |
| 엔진 automatic minimum                        | 부재 재확인 — `flex.rs` §9.7 분배는 `flex_shrink`(off 16) / 명시 `min_main`(off 9, AUTO=-1) 만 소비. floor 기준값은 `content_main`(off 13) 재사용 가능, **item overflow 필드 부재** (§3-1 — `FLEX_FIELD_COUNT` 18→19 시 3 직렬화 경로 동시 갱신)                                                                                                                                                                                                                                                     |
| 엔진 absolute                                 | 구현됨 (`tree.rs:609~790`, `resolve_abs_axis` 2414~) — 잔여는 §4 표 2건                                                                                                                                                                                                                                                                                                                                                                                                                              |
| stale 문서 목록 (0-4)                         | `layout-engine.md:121` `_runTaffyPassRaw` (코드 심볼 grep 0건 — 문서·ADR 역사 기록만 잔존) / 동 §"Overflow Scroll + Flex Shrink 보정" 폐기 대상 / 동 §"CSS min-width:auto 에뮬레이션" 교체 대상 / `canvas-rendering.md` §7 금지 패턴 2행 (flex 자식 minWidth 미설정 · overflow flexShrink 보정) 갱신 대상 — Phase 3                                                                                                                                                                                  |
| parity/bench baseline (0-5)                   | parity **10 파일 / 74 테스트 PASS** (tests 827ms, `pnpm --filter builder test:parity`) / cargo **309 PASS** (lib 282 + 통합 15·11·1) / type-check baseline PASS. **전용 bench harness 부재** (benches/ 없음 · criterion 미의존 · bench script 0건) → G3 판정 수단: Phase 1 에서 flex shrink 케이스 criterion micro-bench 신설, floor 도입 직전 기준치 측정 후 on/off 비교 (§3-3, M3 — 실측 gap 의 Phase 0 보강 흡수)                                                                                 |

## 8. 커밋 단위

- Phase 당 커밋 1~2개 (엔진 구현 + TS 제거는 **같은 커밋** 또는 연속 커밋으로 같은 push). "narrow" sliver 분해 금지 (adr-writing M4).
- 각 phase 종료 시 live builder 1회 exercise 명시 (완료 기준 규칙 — test PASS 단독 종결 금지).
