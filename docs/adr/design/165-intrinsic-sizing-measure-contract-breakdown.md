# ADR-165 구현 상세 — intrinsic sizing 측정 계약 (min/max-content 스칼라 공급 + 엔진 fit-content 소유)

> 본문: [../165-intrinsic-sizing-measure-contract.md](../165-intrinsic-sizing-measure-contract.md)
>
> 사용자 `/execute-adr 165` 트리거로 실행 착수 (2026-07-25) — Accepted 승격 동시 반영. Phase 1 은 R1·R2 HIGH 매핑으로 착수 전 사용자 surface 대상.

## 1. Fork checkpoint 4 질문 lock-in (adr-writing.md)

1. **base / 응용 분류**: [ADR-164](../completed/164-engine-ts-compensation-absorption.md) (base — §4.5 automatic minimum floor + `content_main` 소비 지점 + off 18 overflow 프로토콜) 가 본 ADR 의 선행. 본 ADR 은 그 소비 지점의 입력을 상한 근사(단일줄 ceil)에서 정확 스칼라(min/max-content)로 승격하고 fit-content 공식을 엔진에 얹는 **후속 응용**. ADR-164 Consequences "후속 ADR 체인" 에 기록된 그대로.
2. **schema 직교성**: 본 ADR 은 측정 **공급 계약** (프로토콜 leaf 필드 + TS 측정기 확장) — ADR-164 의 floor **알고리즘** 과 직교. floor 는 min 해석 로직이고, 본 ADR 은 그 입력의 정밀화 + intrinsic 키워드 3종 소비 신설. 저장 스키마(canonical document) 무변경.
3. **선행 ADR 전제 reverse 검증**: ADR-164 의 두 전제 — (a) CanvasKit = 측정 oracle (엔진 자체 텍스트 측정 금지), (b) 엔진 leaf content 무지 (`tree.rs:654~664`) — 를 본 ADR 도 **유지**한다 (reverse 아님). 이관 대상은 측정값의 **소비 알고리즘** (fit-content 공식 / min-content 하한) 뿐이며 측정 주체는 TS 불변. grep 근거: ADR-164 진행 로그 G2 재정의 실측.
4. **codex 1차 진입**: 본 4 질문 lock-in + Proposed 작성 완료 후 리뷰 (`review-adr`) 는 사용자 트리거로 진입 — 3차까지 미루지 않음.

## 2. Phase 0 — 인벤토리 freeze (실측, 코드 무변경) — ✅ Implemented 2026-07-25

> 실측 완료 (execute-adr). live 실측 대상 실문서 = dAAA (49 elements / 2 pages, 현행 유일 로컬 프로젝트). Step 4.5 빈도는 **임시 비커밋 계측** (console 카운터 2줄 → 실측 → `git checkout` 원복 — 커밋 이력 무변경) 으로 측정.

| 항목                            | 실측 값 (2026-07-25 freeze)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| enrichment 폭 주입 전수         | `utils.ts:4437` — 폭 주입 게이트 `needsWidth`(`4490~4504`) 4분기: **A** 명시 `min-content`/`max-content` 키워드 (모든 type — `calculateMinContentWidth`(`5113`, 단어별 최대) / `calculateMaxContentWidth`(`5147`, 단일줄) 로 px 해석) **B** 명시 `fit-content` **C** `INLINE_BLOCK_TAGS`(`4321~4372`, button 등 텍스트 합성 leaf 다수) **D** 순수 텍스트 leaf `TEXT_LEAF_TAGS`(text/heading/description/label/paragraph/kbd/code, `4378~4387`) — **isFlexChild 한정** (block 자식은 stretch 라 미대상). 주입: width(`4703~4705`, non-grow 한정 — `growsInFlex` 판정 `4469~4473`) + minWidth(`4716~4718`, `isFlexChild ∧ style.minWidth == null` — grow 자식도 받음). 밑바탕 측정은 전부 Canvas 2D `measureTextWidth`(`1263`). 비텍스트 잔존 (Phase 1 축소 대상 아님): CIRCLE_LEAF/IMAGE_INTRINSIC/SPEC_SHAPES_INPUT height 주입   |
| Step 4.5 트리거 빈도            | 소재 `fullTreeLayout.ts:2466~2853` (4.5/4.5b/4.5c). 조건 = `\|layout.width − enrichedWidth\| > 2`(`WIDTH_TOLERANCE`, `2472`), auto/fit-content height 한정(`2507~2513`). counter/log **부재** → 임시 계측 실측: fresh load 1회에 run 2회 — **메인 트리 25/47 트리거 (53%) + projection 서브트리 4/6 (67%)**. 원인: `enrichedWidth` 추정(`2521~2531`)의 fallback 이 요소별 부모 폭이 아닌 **루트 availableWidth(=페이지 폭 390)** — width 미명시 요소가 재줄바꿈 필요와 무관하게 사실상 전부 트리거. → Phase 2 계약 축소의 정량 근거 (트리거 집합 과대)                                                                                                                                                                                                                                                                            |
| 상한 근사 발산 수식화 (R1)      | 발산 조건 = {주축 shrink 압박이 단일줄 폭 미만 ∧ 다단어 텍스트 leaf}: injected minWidth = 단일줄 측정폭 ceil ≥ 실제 min-content(최장 단어 폭) → CSS 는 min-content 까지 shrink, 엔진은 단일줄 폭에서 정지. **실문서 발생 0건**: 다단어 leaf 8건 전수 (Toolbar Button 3 / Form Heading 1 / Label 2 / TextField 2) 전원 단일줄 배치·shrink 압박 없음 (layout map 실측) → R1 의 사용자-가시 변화는 현행 문서 기준 잠재적 (향후 문서의 조건 조합에서만 발현). G1 fixture 가 유일 검증 수단                                                                                                                                                                                                                                                                                                                                            |
| 엔진 센티널 소비 현황           | `style.rs:26~30` FIT(-2)/MIN(-3)/MAX(-4) 정의 + `298~303` 파싱 재확인. FIT_CONTENT 실소비 = `block.rs:60/173/177/265` (shrink-to-fit — 자식 solve 결과 content_w 근사) + `tree.rs:2339~2364` write_block_item 통과(`resolve_cross_dimension_opt:2537` 특례). **MIN/MAX_CONTENT 소비 0건 확정** — 키워드 도달 3경로 전부 폴백 (`tree.rs:1861~1864`→0 / `tree.rs:2534~2538`→AUTO / `grid.rs:148,155`→0·-1). 추가 실측: **-3/-4 센티널은 TS→WASM 경계를 넘지도 않음** — `utils.ts:5183~5188` 이 min/max-content 를 undefined 로 drop (enrichment 분기 A 가 px 로 선해석), fit-content 문자열 송신은 Calendar/RangeCalendar allowlist(`fullTreeLayout.ts:815~821`) 한정. §4.5 floor 교체 지점 = `flex.rs:281~286` (`content_main.max(0.0)`, off 13). `FLEX_FIELD_COUNT=19`, off 18 overflow_main                                      |
| 측정 API·캐시                   | `canvaskitTextMeasurer.ts` — `_widthCache`(number)/`_wrappedCache`({width,height}) 2 Map, MAX 1000, LRU evict(`180~186`). width 키 = 텍스트+폰트 9필드(maxWidth 무관). `measureWidth` = `layout(1e6)` → `getMaxIntrinsicWidth()`(`273~274`). **`getMinIntrinsicWidth` 호출 0건 / canvaskit-wasm 0.40.0 타입 선언 존재**(`index.d.ts:1118~1121`). 동일 Paragraph 에서 min+max 동시 추출 가능 (layout 후 getter 2회 — 재빌드 불요, 한계비용 메서드 2회). 제약 2건: (a) 반환 shape 이 스칼라 1개 → 시그니처 확장 필요 (b) **Canvas 2D 우회 경로가 지배** (`USE_CANVAS2D_MEASURE=true`, `canvas2dSegmentCache.ts:33` — 해당 케이스는 Paragraph 미생성) → Canvas 2D 경로의 min-content 는 `calculateMinContentWidth`(단어 split 측정) 기존재 활용. Paragraph delete 페어링 준수(`276/384/404/457`)                                     |
| bench baseline                  | 부하 배제 3회: S1 16.4~16.9µs / S2 71.6~74.8µs / S3 15.0~15.3µs — ADR-164 기준치(16.7/71.1/15.2) ±10% 정합 (부하 상태 1차 실행 S1 43µs 는 병렬 컴파일 노이즈로 기각). 신규 intrinsic 시나리오 설계: **S4** = 다단어 leaf 정확 min-content floor (§4.5 floor 소비 + shrink 압박) / **S5** = width fit-content 센티널 clamp 공식 소비. Phase 1 도입 직전 커밋에서 기준치 측정 (ADR-164 G3 선례). suite baseline: parity 11 파일/90 PASS + cargo 316 PASS + type-check PASS                                                                                                                                                                                                                                                                                                                                                          |
| grid intrinsic 실사용 (G5 판정) | **min/max/fit-content track 실사용 0건** — factory·catalog·implicitStyles·gridAuto\* 전수 grep 공집합 + 실문서 grid 컨테이너 0건 + canonical 문서 gridTemplate 흔적 0건 + Inspector grid track 에 intrinsic 키워드 입력 UI 없음(preset = px/fr/auto 만). **auto track 실사용은 존재**: Meter/ProgressBar/Slider catalog `"1fr auto"`(`componentRulesTable.ts:6468/7676/9799`) + `PROGRESS_GRID_STYLE`(`unified.types.ts:2043~2044`) + LayoutPreset 4종. 단 auto 는 이미 양측 근사 소비 중 — `grid.rs:274~297` auto=1fr 근사 + TS DFS 균등분할(`fullTreeLayout.ts:1553~1565`) — `grid.rs:27~29` doc 이 "현행 catalog 사용 범위 한정" 으로 명시 수용. width/height 축 fit-content 실사용은 광범위(factory 22곳 + catalog 14곳 + store default) → Phase 1 (b) 센티널 소비의 실수요. **판정은 Phase 1 surface 에 포함** (아래 §3 (c)) |

## 3. Phase 1 — min/max-content 스칼라 계약 (공급 + 소비 + 축소, 같은 phase — HC5)

> 공급(TS 측정)·프로토콜 필드·엔진 소비·enrichment 축소를 **같은 phase 의 같은 push** 로 반영한다 — 공급만 먼저 커밋되면 dormant, 축소만 먼저면 회귀 (ADR-164 HC4 승계 + [[feedback-no-dormant-foundation-ahead-of-flip]]).

- **TS 측정 공급**: `canvaskitTextMeasurer` 에 min-content(최장 단어 폭, Paragraph `getMinIntrinsicWidth()`)/max-content(단일줄 폭, `getMaxIntrinsicWidth()`) 스칼라 2종 산출 경로 추가 — 결과 `{width,height}` 계열 LRU 재사용, Paragraph 객체 비캐시 규칙 유지. 스칼라 2종도 엔진 f32 경계의 `Math.ceil` 보정 대상 (layout-engine.md 기타 규칙 — f32/f64 정밀도 차이로 인한 불필요 wrap 방지). **Phase 0 실측 반영**: Canvas 2D 지배 경로 (`USE_CANVAS2D_MEASURE=true`) 에서는 Paragraph 가 없으므로 min-content 는 `calculateMinContentWidth`(단어 split) 경로 활용, CanvasKit fallback 분기에서만 동일 Paragraph getter 2회 추출. `measureWidth` 반환 shape (스칼라 1개) 확장 필요.
- **프로토콜**: leaf content 필드 확장 — 기존 `content_main`(off 13, 단일 값) 을 min/max 2종으로 정밀화하는 필드 신설. ADR-164 선례대로 flex 배열이 Rust 내부 구성(`tree.rs::solve_flex`)이면 TS 직렬화 무변경 범위를 우선 검토, NodeStyle 확장이 필요하면 layout-engine.md 5-심볼 2계층 체인 점검 동반.
- **엔진 소비**: (a) §4.5 floor 의 `content_main` 상한 근사 → 정확 `min_content` 로 교체 (`flex.rs:281~286` — ADR-164 floor 정밀화). (b) width `fit-content`/`min-content`/`max-content` 센티널 실소비 — CSS-SIZING-3 §5 공식 `fit-content = clamp(min-content, stretch-fit, max-content)`. (c) **조건부 (Phase 0 실측 완료 — 판정 대기)**: min/max/fit-content track 실사용 **0건** → Decision 조건부 규칙의 "의도적 이연" 조건 부합 (권장). 단 auto track 실사용 3 컴포넌트 (`"1fr auto"`) 가 존재하며 현행은 양측 auto=1fr 근사 수용 상태 — auto track 을 intrinsic 실수요로 간주해 `grid.rs` 스칼라 소비를 포함할지 여부는 **Phase 1 착수 surface 에서 사용자 판정** (scope 결정 지점).
- **TS enrichment 축소**: 텍스트 leaf 의 폭 주입을 스칼라 공급으로 대체 가능한 분기 한정 축소 — 측정 **주체** 는 TS 잔존. **Phase 0 확정 경계**: 축소 후보 = `needsWidth` 4분기 (A 명시 min/max-content / B 명시 fit-content / C INLINE_BLOCK / D 텍스트 leaf) 의 폭 주입 + minWidth 채널(`4716~4718`). 잔존 = 비텍스트 주입 (CIRCLE_LEAF/IMAGE_INTRINSIC/SPEC_SHAPES_INPUT height) + 측정 함수 자체.
- **검증**: 신규 parity fixture (재줄바꿈 shrink 정확 하한 / fit-content leaf / max-content, engine+pipeline 2 leg) Chrome diff 0 (G1) + 이중 적용 grep 0 (G2) + bench (G3 — S4/S5 신설 포함) + live exercise (G4).

## 4. Phase 2 — height-for-width 2-pass 계약 축소·명문화

- `fullTreeLayout.ts:2466` Step 4.5 를 "폭 확정 후 높이 1회 재측정" 계약으로 축소·재정의 — 폭 축은 Phase 1 스칼라로 엔진이 소유하므로 2-pass 의 남는 역할은 height-for-width 재줄바꿈뿐임을 코드·주석·규칙에 명문화.
- **Phase 0 실측 반영**: 현행 트리거 집합이 과대 (fresh load 마다 25/47=53% 트리거 — enrichedWidth 추정의 루트 availableWidth fallback 이 원인). 계약 축소 시 트리거 판정을 "재줄바꿈 가능 텍스트 요소" 로 좁히는 것이 정량 목표 (실측 재계측으로 확증).
- 재줄바꿈 높이의 measure callback 이관(대안 A)은 **본 ADR 범위 밖** — Phase 0/2 실측에서 2-pass 잔존 비용이 문제로 확인될 때만 별도 ADR 로 재평가 (R4).

## 5. Phase 3 — 문서·규칙 정합

- `layout-engine.md` §"TS 잔존 계약" 표 갱신 — minWidth 채널 행을 스칼라 계약으로 대체/축소, 2-pass 행을 "height-for-width 1회 재측정" 으로 재정의.
- `canvas-rendering.md` §3 텍스트 측정 동기화 규칙에 min/max-content 스칼라 경로 추가.
- CHANGELOG (Architecture) + ADR-164 후속 관계 기록 (Consequences 체인 완결).

## 6. TS 잔존 계약 변화 (전 → 후 예상)

| 항목              | ADR-164 후 (현행)                        | 본 ADR 후                                            |
| ----------------- | ---------------------------------------- | ---------------------------------------------------- |
| 텍스트 측정 주체  | TS (CanvasKit oracle)                    | **불변** — TS                                        |
| 폭 intrinsic 소비 | TS enrichment 폭 주입 (fit-content 근사) | 엔진 (스칼라 2종 입력 + CSS-SIZING-3 공식)           |
| §4.5 floor 입력   | `content_main` 단일줄 상한 근사          | 정확 `min_content`                                   |
| minWidth 채널     | 유일 전달 경로 (§6 잔존)                 | 스칼라 계약으로 흡수 (축소/소멸 — Phase 0 경계 확정) |
| height-for-width  | 2-pass Step 4.5 (범용)                   | 2-pass 축소 잔존 ("폭 확정 후 높이 1회 재측정" 계약) |

## 7. 커밋 단위

- Phase 당 커밋 1~2개, 공급+소비+축소는 같은 push (HC5). "narrow" sliver 분해 금지 (adr-writing M4).
- 각 phase 종료 시 live builder 1회 exercise 명시 (test/type-check PASS 단독 종결 금지).
