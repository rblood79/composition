# ADR-165 구현 상세 — intrinsic sizing 측정 계약 (min/max-content 스칼라 공급 + 엔진 fit-content 소유)

> 본문: [../165-intrinsic-sizing-measure-contract.md](../165-intrinsic-sizing-measure-contract.md)
>
> 사용자 `/execute-adr 165` 트리거로 실행 착수 (2026-07-25) — Accepted 승격 동시 반영. Phase 1 은 R1·R2 HIGH 매핑으로 착수 전 사용자 surface 대상.

## 1. Fork checkpoint 4 질문 lock-in (adr-writing.md)

1. **base / 응용 분류**: [ADR-164](../completed/164-engine-ts-compensation-absorption.md) (base — §4.5 automatic minimum floor + `content_main` 소비 지점 + off 18 overflow 프로토콜) 가 본 ADR 의 선행. 본 ADR 은 그 소비 지점의 입력을 상한 근사(단일줄 ceil)에서 정확 스칼라(min/max-content)로 승격하고 fit-content 공식을 엔진에 얹는 **후속 응용**. ADR-164 Consequences "후속 ADR 체인" 에 기록된 그대로.
2. **schema 직교성**: 본 ADR 은 측정 **공급 계약** (프로토콜 leaf 필드 + TS 측정기 확장) — ADR-164 의 floor **알고리즘** 과 직교. floor 는 min 해석 로직이고, 본 ADR 은 그 입력의 정밀화 + intrinsic 키워드 3종 소비 신설. 저장 스키마(canonical document) 무변경.
3. **선행 ADR 전제 reverse 검증**: ADR-164 의 두 전제 — (a) CanvasKit = 측정 oracle (엔진 자체 텍스트 측정 금지), (b) 엔진 leaf content 무지 (`tree.rs:654~664`) — 를 본 ADR 도 **유지**한다 (reverse 아님). 이관 대상은 측정값의 **소비 알고리즘** (fit-content 공식 / min-content 하한) 뿐이며 측정 주체는 TS 불변. grep 근거: ADR-164 진행 로그 G2 재정의 실측.
4. **codex 1차 진입**: 본 4 질문 lock-in + Proposed 작성 완료 후 리뷰 (`review-adr`) 는 사용자 트리거로 진입 — 3차까지 미루지 않음.

## 2. Phase 0 — 인벤토리 freeze (실측, 코드 무변경)

| 항목                    | 실측 대상                                                                                                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| enrichment 폭 주입 전수 | `utils.ts:4437` `enrichWithIntrinsicSize` 의 텍스트 leaf 폭 주입 분기 전수 (측정 1회 경로 / minWidth 채널 `4712~4713` / non-grow 한정 조건) — Phase 1 축소 대상과 §6 잔존(측정 주체) 경계 확정                                                        |
| Step 4.5 트리거 빈도    | `fullTreeLayout.ts:2466` 2-pass height 교정의 실문서 트리거 조건·빈도 (enrichment 폭 ≠ 배치 폭 케이스 수) — Phase 2 계약 축소의 근거 (G5)                                                                                                             |
| 상한 근사 발산 수식화   | ADR-164 breakdown §7 0-2 역방향: injected minWidth = 단일줄 측정폭(ceil) ≥ 실제 min-content → 재줄바꿈 케이스에서 CSS 대비 덜 shrink. 실문서에서 해당 조합 {min-content 이하 shrink 압박 ∧ 다단어 텍스트 leaf} 발생 케이스 실측 (R1 영향 범위 수식화) |
| 엔진 센티널 소비 현황   | `style.rs:26~30/299~301` FIT(-2)/MIN(-3)/MAX_CONTENT(-4) 파싱 존재. `tree.rs:2339~2364` block 경로 FIT_CONTENT 부분 통과만 — MIN/MAX_CONTENT 소비 grep 0건 (dormant 센티널) 재확인                                                                    |
| 측정 API·캐시           | `canvaskitTextMeasurer.ts:130~` 캐시 구조 + Paragraph `getMaxIntrinsicWidth()`(max-content) / `getMinIntrinsicWidth()`(min-content) 가용성 — Paragraph 객체 캐싱 금지 규칙 하에서 스칼라 2종 추가 측정 비용 산정                                      |
| bench baseline          | `benches/flex_shrink.rs` 현행 3 시나리오 기준치 (ADR-164 도입 후: S1 16.7µs / S2 71.1µs / S3 15.2µs) + 신규 intrinsic 시나리오 설계                                                                                                                   |
| grid intrinsic 실사용   | grid 컨테이너의 min/max-content track·auto track intrinsic 실사용 실측 (`grid.rs` 현행 0 폴백, ADR-164 위임분) — Decision 조건부 규칙(선택 근거 4)의 판정 근거 (G5). 0건 = 의도적 이연 명문화 / 있음 = Phase 1 에 grid.rs 스칼라 소비 포함            |

## 3. Phase 1 — min/max-content 스칼라 계약 (공급 + 소비 + 축소, 같은 phase — HC5)

> 공급(TS 측정)·프로토콜 필드·엔진 소비·enrichment 축소를 **같은 phase 의 같은 push** 로 반영한다 — 공급만 먼저 커밋되면 dormant, 축소만 먼저면 회귀 (ADR-164 HC4 승계 + [[feedback-no-dormant-foundation-ahead-of-flip]]).

- **TS 측정 공급**: `canvaskitTextMeasurer` 에 min-content(최장 단어 폭, Paragraph `getMinIntrinsicWidth()`)/max-content(단일줄 폭, `getMaxIntrinsicWidth()`) 스칼라 2종 산출 경로 추가 — 결과 `{width,height}` 계열 LRU 재사용, Paragraph 객체 비캐시 규칙 유지. 스칼라 2종도 엔진 f32 경계의 `Math.ceil` 보정 대상 (layout-engine.md 기타 규칙 — f32/f64 정밀도 차이로 인한 불필요 wrap 방지).
- **프로토콜**: leaf content 필드 확장 — 기존 `content_main`(off 13, 단일 값) 을 min/max 2종으로 정밀화하는 필드 신설. ADR-164 선례대로 flex 배열이 Rust 내부 구성(`tree.rs::solve_flex`)이면 TS 직렬화 무변경 범위를 우선 검토, NodeStyle 확장이 필요하면 layout-engine.md 5-심볼 2계층 체인 점검 동반.
- **엔진 소비**: (a) §4.5 floor 의 `content_main` 상한 근사 → 정확 `min_content` 로 교체 (ADR-164 floor 정밀화). (b) width `fit-content`/`min-content`/`max-content` 센티널 실소비 — CSS-SIZING-3 §5 공식 `fit-content = clamp(min-content, stretch-fit, max-content)`. (c) **조건부**: Phase 0 실측에서 grid intrinsic 실사용 존재 시 `grid.rs` track sizing 의 스칼라 소비 동반 (Decision 선택 근거 4 — 0건이면 의도적 이연 명문화로 종결).
- **TS enrichment 축소**: 텍스트 leaf 의 폭 주입을 스칼라 공급으로 대체 가능한 분기 한정 축소 — 측정 **주체** 는 TS 잔존 (경계는 Phase 0 freeze 로 확정).
- **검증**: 신규 parity fixture (재줄바꿈 shrink 정확 하한 / fit-content leaf / max-content, engine+pipeline 2 leg) Chrome diff 0 (G1) + 이중 적용 grep 0 (G2) + bench (G3) + live exercise (G4).

## 4. Phase 2 — height-for-width 2-pass 계약 축소·명문화

- `fullTreeLayout.ts:2466` Step 4.5 를 "폭 확정 후 높이 1회 재측정" 계약으로 축소·재정의 — 폭 축은 Phase 1 스칼라로 엔진이 소유하므로 2-pass 의 남는 역할은 height-for-width 재줄바꿈뿐임을 코드·주석·규칙에 명문화.
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
