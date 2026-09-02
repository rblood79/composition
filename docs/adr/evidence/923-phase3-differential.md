# ADR-923 Phase 3 evidence — Chrome 차등 증명 (G1 전반)

> 2026-09-01. 실행 Claude. 하니스: `apps/builder/tests/parity/adr923ChromeDifferential.browser.test.ts`
> (ADR-156 `harness.ts` — domLeg = 실 Chrome `getBoundingClientRect` ground truth ·
> engineLeg = **어댑터 우회** 엔진 직결(raw CSS display 를 `buildTreeBatch` 로) ·
> pipelineLeg = 현 어댑터 경로 대조군, 기록 전용). 통과 기준 위치·크기 ≤ 1px (TOL 1.0,
> 허용치 무변경). 대조군 원본: `tests/parity/.artifacts/adr923-phase3-differential.json`
> (매 실행 재생성 — vitest browser 는 통과 테스트 콘솔을 숨기므로 파일로 내보낸다).
> **round 8 갱신 (`efb56a888`)**: Codex 판독 반례 2 + clip 오라클 + 프로덕션 게이트로
> 23 → 27 케이스, 수리 3건 추가 (6~~8).
> **round 9 갱신**: Codex 판독 r9h1/r9m2 재현 5 + 인접 margin-collapse 경계 7 로
> 27 → 39 케이스, 수리 4건 추가 (9~12). 표 밖 pipelineLeg 게이트 2 (r8l2 + r9h1 clip).
> **round 9 후속 ①**: `height: 0` 명시 self-collapsing 3 케이스 → **42 케이스**, 수리 13.
> **round 10 갱신**: Codex 판독 r10h1/r10m1/r10m2/r10m3 재현 8 + 대조군 1 → **51 케이스**,
> 수리 14~~18. 표 밖 pipelineLeg 게이트 5 (r8l2 · r9h1 clip · r10h1 텍스트 leaf 3).
> **round 11 갱신**: Codex 판독 r11h1/r11m1 재현 3 + 경계·대조군 7 → **61 케이스**, 수리
> 19~~21. 표 밖 pipelineLeg 게이트 14 (+ r11h1 whitespace 9: RED 4 · 대조군 5).
> **round 12 갱신**: Codex 판독 r12h1/r12m1/r12m2/r12l1/r12l2 + 과제 5 재현 5 · 대조군 2 →
> **68 케이스**, 수리 22~~26. 표 밖 pipelineLeg 게이트 19 (+ r12h1 상속 white-space 4: RED 3 ·
> r12l1 flex 폭 1).

## 결과 — 69 케이스 전부 엔진 직결 ≤1px (round 23 수리 후)

1차 실행: 14 pass / **9 fail** → 전부 엔진 결함으로 확정·수리(수리 1~~5) → 23/23.
Codex round 8 판독이 반례 2(middle·마지막 line box)로 재개방 → 케이스 4 추가(clip
오라클 포함) → 수리 6~~8 → 27/27. Codex round 9 판독이 flex clip auto-min(HIGH) + block
auto-height 꼬리 margin 반례 2(MEDIUM) 로 재개방 → 재현 5 + 인접 경계 7 = 12 케이스 추가,
**RED 10/12** (hidden 대조군 2 만 첫 실행 PASS) → 수리 9~12 → 39/39. 후속 ① (height:0
self-collapsing) 3 케이스 RED 1 → 수리 13 → **42/42 pass**. Codex round 10 판독이 §8.3.1
self-collapsing 경계(텍스트 leaf · absolute 자식) + adjoining 집합 + auto-height 하한 반례 4군으로
재개방 → 재현 8 + 대조군 1 = 9 케이스 추가, **RED 8/9** (+ 게이트 3 중 RED 2) → 수리 14~~18
→ **51/51 pass**. Codex round 11 판독이 whitespace-only 텍스트 line box (HIGH) + 명시
height/min-height 부모의 bottom margin (MEDIUM) 반례 2군으로 재개방 → 재현 3 + 경계·대조군 7 =
10 케이스 추가, **RED 3/10** (+ 게이트 9 중 RED 4; 1차 수리안 `min_h > 0` 일괄 포함은 Chrome
바인딩 경계 3 에서 RED — Blink 모델로 교체) → 수리 19~~21 → **61/61 pass**. Codex round 12 판독이 상속 white-space (HIGH) +
percentage min-height 세로 ctx · min>max clamp 순서 (MEDIUM) 반례 3군으로 재개방 → 재현 5 +
sweep/대조군 2 = 7 케이스 추가, **RED 4/7** (+ 게이트 5 중 RED 3; r12l1 flex 폭 게이트는 raw
측정 원복에서 RED) → 수리 22~~26 → **68/68 pass**. 어댑터 대조군은
**발산 18 / 정합 50** — 현 IFC 시뮬레이션이 Chrome 과 갈리는 차원의 실측
(Phase 5 cutover 가 닫을 대상. "정합" 은 시뮬레이션이 우연히 맞는 차원 — round 9 추가
12 케이스는 프로덕션 어댑터가 엔진 block/flex 경로를 그대로 타므로 수리 후 전부 정합).
종전 "16/23 발산" 표기는 오집계 (r8m1 — 실측 15/23; 27 케이스 18/9; 39 케이스 18/21; 42 케이스 18/24; 51 케이스 18/33; 61 케이스 18/43; 68 케이스 18/50).

| #   | 케이스                                               | 차원                                                                                                                        | 엔진 직결 (게이트) | 현 어댑터 (대조군)                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ib-two-one-line                                      | inline-block 2개 한 줄                                                                                                      | 정합               | 발산 1: a.y: dom=4.0 eng=2.0 (Δ2.0)                                                                                                                                                                                                                                                                                                                                                                                       |
| 2   | ib-wrap                                              | 3개 중 셋째 줄바꿈                                                                                                          | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 3   | explicit-width-block-sibling                         | 명시 폭 block 형제 (ADR-198 재현)                                                                                           | 정합               | 발산 6: a.y: dom=0.0 eng=5.0 (Δ5.0) · mid.x: dom=0.0 eng=60.0 (Δ60.0) · mid.y: dom=20.0 eng=0.0 (Δ20.0) · b.x: dom=0.0 eng=180.0 (Δ180.0) · b.y: dom=50.0 eng=5.0 (Δ45.0) · root.h: dom=70.0 eng=30.0 (Δ40.0)                                                                                                                                                                                                             |
| 4   | auto-width-block-sibling                             | auto 폭 block 형제                                                                                                          | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 5   | valign-top                                           |                                                                                                                             | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 6   | valign-middle                                        |                                                                                                                             | 정합               | 발산 1: a.y: dom=0.0 eng=10.0 (Δ10.0)                                                                                                                                                                                                                                                                                                                                                                                     |
| 7   | valign-bottom                                        |                                                                                                                             | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 8   | valign-baseline                                      | 기본 baseline 정렬 (bottom = 폴백 baseline)                                                                                 | 정합               | 발산 1: a.y: dom=20.0 eng=10.0 (Δ10.0)                                                                                                                                                                                                                                                                                                                                                                                    |
| 9   | child-margin                                         | 인라인 마진 + 형제 block                                                                                                    | 정합               | 발산 1: a.y: dom=5.0 eng=2.5 (Δ2.5)                                                                                                                                                                                                                                                                                                                                                                                       |
| 10  | empty-block-sibling                                  | 빈 block 이 줄을 끊는다                                                                                                     | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 11  | parent-padding                                       | 부모 padding 안 line box                                                                                                    | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 12  | inline-flex-nested-baseline                          | inline-flex 컨테이너 baseline (R6 필수)                                                                                     | 정합               | 발산 12: a1a.y: dom=20.0 eng=0.0 (Δ20.0) · a1.y: dom=20.0 eng=0.0 (Δ20.0) · a.y: dom=20.0 eng=0.0 (Δ20.0) · a.w: dom=60.0 eng=320.0 (Δ260.0) · b1a.x: dom=60.0 eng=0.0 (Δ60.0) · b1a.y: dom=0.0 eng=35.0 (Δ35.0) · b1.x: dom=60.0 eng=0.0 (Δ60.0) · b1.y: dom=0.0 eng=35.0 (Δ35.0) · b.x: dom=60.0 eng=0.0 (Δ60.0) · b.y: dom=0.0 eng=35.0 (Δ35.0) · b.w: dom=60.0 eng=320.0 (Δ260.0) · root.h: dom=55.0 eng=75.0 (Δ20.0) |
| 13  | inline-grid-line                                     | inline-grid 가 line item                                                                                                    | 정합               | 발산 1: a.y: dom=10.0 eng=5.0 (Δ5.0)                                                                                                                                                                                                                                                                                                                                                                                      |
| 14  | ib-shrink-to-fit-wrap                                | r6: fit-content 100 vs one-pass 80                                                                                          | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 15  | ib-fit-under-min-content                             | available < min-content 는 overflow                                                                                         | 정합               | 발산 2: c1.w: dom=80.0 eng=60.0 (Δ20.0) · f.w: dom=80.0 eng=60.0 (Δ20.0)                                                                                                                                                                                                                                                                                                                                                  |
| 16  | ib-pct-child-shrink                                  | r6: shrink-to-fit 안 percentage 재해소                                                                                      | 정합               | 발산 2: p2.w: dom=30.0 eng=50.0 (Δ20.0) · f.w: dom=60.0 eng=100.0 (Δ40.0)                                                                                                                                                                                                                                                                                                                                                 |
| 17  | ib-baseline-margin-bottom                            | r7: 폴백 baseline 은 margin edge (§10.8.1)                                                                                  | 정합               | 발산 1: a.y: dom=12.0 eng=6.0 (Δ6.0)                                                                                                                                                                                                                                                                                                                                                                                      |
| 18  | ib-overflow-hidden-baseline                          | r7: scroll container 는 margin edge (css-align-3 §9.1)                                                                      | 정합               | 발산 2: a1.y: dom=10.0 eng=5.0 (Δ5.0) · a.y: dom=10.0 eng=5.0 (Δ5.0)                                                                                                                                                                                                                                                                                                                                                      |
| 19  | valign-top-bottom-only                               | r7: baseline 참여자 없는 줄                                                                                                 | 정합               | 발산 1: c.y: dom=10.0 eng=0.0 (Δ10.0)                                                                                                                                                                                                                                                                                                                                                                                     |
| 20  | inline-flex-column-baseline                          | r7: column flex 첫 item baseline                                                                                            | 정합               | 발산 5: c1a.y: dom=28.0 eng=4.0 (Δ24.0) · c1.y: dom=28.0 eng=4.0 (Δ24.0) · c2.y: dom=40.0 eng=16.0 (Δ24.0) · c.y: dom=28.0 eng=4.0 (Δ24.0) · root.h: dom=60.0 eng=40.0 (Δ20.0)                                                                                                                                                                                                                                            |
| 21  | atomic-line-height-inert                             | atomic inline 의 line-height 는 line box 에 관여하지 않는다                                                                 | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 22  | strut-short                                          | 부모 line-height strut 이 짧은 item 위로 line 확장                                                                          | 정합               | 발산 2: tail.y: dom=40.0 eng=20.0 (Δ20.0) · root.h: dom=50.0 eng=30.0 (Δ20.0)                                                                                                                                                                                                                                                                                                                                             |
| 23  | strut-tall                                           | item 이 strut 보다 커도 strut descent 는 남는다                                                                             | 정합               | 발산 2: tail.y: dom=70.0 eng=50.0 (Δ20.0) · root.h: dom=80.0 eng=60.0 (Δ20.0)                                                                                                                                                                                                                                                                                                                                             |
| 24  | valign-middle-tall                                   | r8: middle 은 baseline 에 중심 고정 (x-height/2=0)                                                                          | 정합               | 발산 1: a.y: dom=10.0 eng=20.0 (Δ10.0)                                                                                                                                                                                                                                                                                                                                                                                    |
| 25  | strut-last-line                                      | r8: 마지막 line box 의 strut 높이가 auto-height 에 반영                                                                     | 정합               | 발산 1: root.h: dom=40.0 eng=20.0 (Δ20.0)                                                                                                                                                                                                                                                                                                                                                                                 |
| 26  | clip-no-bfc                                          | r8: overflow:clip 은 BFC 를 만들지 않는다 (margin 관통)                                                                     | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 27  | ib-overflow-clip-baseline                            | r8: clip 의 inline-block baseline 판정 (오라클)                                                                             | 정합               | 발산 3: a1.y: dom=20.0 eng=5.0 (Δ15.0) · a.y: dom=20.0 eng=5.0 (Δ15.0) · root.h: dom=50.0 eng=40.0 (Δ10.0)                                                                                                                                                                                                                                                                                                                |
| 28  | flex-item-clip-auto-min                              | r9h1: overflow:clip flex item 은 scroll container 아님 → §4.5 content floor 유지 (f.w 80)                                   | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 29  | flex-item-hidden-auto-min                            | r9h1 대조군: hidden 은 scroll container → floor 0 (f.w 60)                                                                  | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 30  | trailing-empty-block-escape                          | r9m2: 꼬리 empty block 의 관통 margin 은 부모 bottom 으로 탈출 (root 10)                                                    | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 31  | trailing-margin-contained                            | r9m2: padding-bottom 부모는 마지막 bottom margin 을 content 에 포함 (31)                                                    | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 32  | trailing-empty-block-contained                       | r9m2: padding-bottom 부모 안 꼬리 empty block 관통 margin 포함 (41)                                                         | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 33  | bfc-last-child-margin-escape                         | r9 인접: BFC 자식(flex) 의 자기 bottom margin 은 부모 bottom 과 collapse (sib.y 30)                                         | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 34  | bfc-sibling-top-collapse                             | r9 인접: BFC 자식(flex) 의 자기 top margin 은 이전 형제 bottom 과 collapse (b.y 30)                                         | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 35  | bfc-first-child-top-escape                           | r9 인접: BFC 자식(flex) 의 자기 top margin 은 부모 top 과 collapse (wrap.y 30·h 10)                                         | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 36  | empty-first-child-padded                             | r9 인접: padding-top 부모 안 첫 empty block = non-zero bottom border 가정 위치 (solid.y 31)                                 | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 37  | empty-first-chain-through-wrap                       | r9 인접: 첫 empty + 다음 block 의 chain 이 wrap top 으로 통째 탈출 (wrap.y 40)                                              | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 38  | flex-item-cross-hidden-auto-min                      | r9h1 양축: overflowY hidden 만 있어도 computed overflowX auto → scroll container (f.w 60)                                   | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 39  | block-margin-then-line-box                           | r9 인접: line box 는 margin 을 collapse 하지 않는다 (block mb10 뒤 inline-block y 20)                                       | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 40  | height-zero-self-collapsing                          | 후속①: height:0 명시 + margin 은 self-collapsing (chain 관통, b.y 40)                                                       | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 41  | height-zero-with-content-not-self-collapsing         | 후속① 대조군: in-flow 내용이 있으면 아님 (b.y 60)                                                                           | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 42  | self-collapsing-wrapper-of-empty                     | 후속①: 자식 전부 self-collapsing 이면 wrapper 도 (b.y 40, wrap.y 40)                                                        | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 43  | abs-only-height-zero-self-collapsing                 | r10m1: absolute 자식만 가진 height:0 컨테이너는 self-collapsing (b.y 40)                                                    | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 44  | abs-only-auto-height-self-collapsing                 | r10m1 대조군: 같은 구조 height auto (b.y 40)                                                                                | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 45  | mixed-sign-chain-three-empties                       | r10m2: 부호 혼합 3+ adjoining margin 은 최대 양수 + 최소 음수 (b.y 20)                                                      | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 46  | mixed-sign-chain-hoisted-through-wrapper             | r10m2: 손자 탈출 음수 margin 도 wrapper·형제와 한 집합 (g.y 20)                                                             | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 47  | mixed-sign-chain-self-collapsing-wrapper             | r10m2: self-collapsing wrapper 의 own + 탈출 chain + 형제 한 집합 (b.y 20)                                                  | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 48  | negative-top-margin-padded-auto-height-clamped       | r10m3: 음수 top margin 으로 in-flow bottom 음수여도 auto height 0 하한 (root.h 2)                                           | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 49  | negative-bottom-margin-contained-clamped             | r10m3: bottom padding 이 담는 음수 bottom margin 도 0 하한 (root.h 1)                                                       | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 50  | negative-flow-bottom-not-self-collapsing             | r10m3 인접: in-flow bottom ≤ 0 이어도 내용 있으면 self-collapsing 아님 (b.y 60)                                             | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 51  | text-leaf-height-zero-has-line-box                   | r10h1: 텍스트 leaf 는 height:0 이어도 line box 가 있어 self-collapsing 아님 (b.y 60; leafBaseline = 신호)                   | 정합               | 정합 (Text 경로)                                                                                                                                                                                                                                                                                                                                                                                                          |
| 52  | parent-explicit-height-bottom-margin-contained       | r11m1: height:50px 부모 — 마지막 자식 bottom margin 은 부모 안 (§8.3.1 adjoining = height auto; b.y 50 / 종전 70)           | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 53  | parent-min-height-nonbinding-bottom-margin-collapses | r11m1 대조군: 미바인딩 min-height:10px 은 접힘 유지 (b.y 40 — min_h>0 일괄 포함 55 반증)                                    | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 54  | parent-min-height-binding-bottom-margin              | r11m1: 바인딩 min-height:100px → strut 미전파 (b.y 115 / 탈출 120)                                                          | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 55  | parent-min-height-partially-binding-bottom-margin    | r11m1: min-height:30 (content 20 < 30 < strut 포함 40) → used 30 · b.y 45 (Blink; 포함-후-clamp 40·55 반증)                 | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 56  | parent-max-height-binding-bottom-margin              | r11m1: 바인딩 max-height:10px → strut 미전파 (p.h 10 · b.y 25 / 탈출 30)                                                    | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 57  | parent-height-zero-bottom-margin-contained           | r11m1 인접: height:0 은 auto 아님 — used 0 + margin 미탈출 (b.y 0 / 종전 20)                                                | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 58  | parent-height-zero-min-height-used                   | r11m1 인접: height:0 + min-height:10 → used 10 (b.y 10 / 종전 30)                                                           | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 59  | parent-min-height-zero-bottom-margin-collapses       | r11m1 대조군: min-height:0 명시 → 접힘 유지 (b.y 40)                                                                        | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 60  | parent-max-height-bottom-margin-collapses            | r11m1 대조군: 미바인딩 max-height:100 → 접힘 유지 (b.y 40)                                                                  | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 61  | parent-explicit-height-top-margin-still-collapses    | r11m1 대조군: height 명시는 top collapse 무관 (p.y 30 · b.y 80)                                                             | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 62  | parent-percent-min-height-indefinite-cb-collapses    | r12m1: auto 부모(indefinite CB) 의 min-height:50% = 0 (§10.7) → 접힘 유지 (b.y 40 / 수평 ctx 오판 35)                       | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 63  | parent-percent-min-height-definite-cb-binding        | r12m1 대조군: root height:200 아래 50% = 100 바인딩 → strut 미전파 (b.y 115)                                                | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 64  | parent-min-over-max-height-min-wins                  | r12m2: min-height:30 > max-height:10 → min 우선 (§10.7 max-then-min; p.h 30 · b.y 45 / 종전 10 · 25)                        | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 65  | root-min-over-max-height-min-wins                    | r12m2 sweep: root fixup 도 max-then-min (root.h 30 / 종전 10)                                                               | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 66  | grid-item-min-over-max-height-min-wins               | r12m2 sweep: grid auto 트랙 기여값 clamp 도 max-then-min (c.h 30 / 종전 10)                                                 | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 67  | height-zero-parent-abs-child-bottom-inset            | r12l2 게이트: height:0 부모의 abs containing block 높이 0 → bottom:0 자식 y −10 (content 기준이면 +10; 원복 (f) 에서만 RED) | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 68  | root-explicit-height-zero-min-height-clamp           | r12 과제 5 sweep: root 명시 height:0 에도 min-height clamp (root.h 10 / 종전 0)                                             | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 69  | root-min-over-max-width-min-wins                     | r13l4: root auto 폭 clamp max-then-min + 자식은 used 폭 안에 배치 (root.w 250 · c.w 250 / 종전 c.w 300)                     | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |

별도 게이트 (표 밖, `pipelineLeg` = 프로덕션 어댑터 경로):

- **r8l2 — 프로덕션 wrap intrinsic-min**: display:flex row 60px 안 wrap flex item 이
  min-content 최대 item 80 으로 바닥 (수리 5 의 프로덕션 실효 경로를 운반 어휘 그대로 고정).
- **r9h1 — 프로덕션 overflow:clip (shorthand)**: 같은 구조에 Style Panel 이 쓰는 shorthand
  `overflow: "clip"` → Chrome f.w 80 (수리 전 pipeline 60). 패널 → `utils.ts` shorthand
  분배 → wasm 경계 → `write_flex_item` 슬롯 18 의 전 경로를 고정.
- **r11h1 — whitespace-only 텍스트 leaf 9** (같은 `textZero` 구조): normal `" "` · `" \t\n "` ·
  nowrap `" "` · pre-line `" \t "` → line box 없음 (Chrome b.y 40; 수리 전 pipeline 60 RED 4) /
  pre-line `"\n"` (segment break 보존) · pre `" "` · pre-wrap `"  "` · nbsp · fontSize:0 `"x"` →
  line box 있음 (b.y 60, 대조군 5). 프로덕션 `enrichWithIntrinsicSize` 의 신호 함수
  `textLeafRendersContent` 를 white-space 값과 함께 고정.
- **r12h1 — 상속 white-space 4** (`textZeroIn` — root 에 white-space 를 얹어 자식 Text 가 상속):
  부모 pre · break-spaces + 공백만 → line box 있음 (Chrome 60; 수리 전 pipeline 40 RED) · 부모
  pre-line + `"\n"` → 60 (RED) / 부모 pre + 자식 inline normal 재지정 → 40 (대조군). 신호가
  computed(상속) white-space 를 읽는지 고정.
- **r12l1 — flex row 안 공백만 Text 폭** (`width: "auto"` 명시): Chrome t.w 0 · box.x 0 — raw
  공백 폭 공급(수리 19 이전) 원복 시 5 로 RED. width 미지정은 프로덕션 Text 기본 `width: 100%`
  (catalog generated base) 가 실려 plain-DOM 대조군 밖 (관찰).

## 수리 5건 (1차 실행 9 fail 의 root cause — 전부 Chrome 실측으로 확정)

1. **valign-bottom baseline 밀림** (`block.rs line_metrics`): bottom 정렬 초과분은 line 을
   위로 늘려 baseline 을 아래로 민다 — `baseline = max(asc, maxBottom − desc)` (§10.8.1).
2. **atomic line-height 불관여** (`block.rs`): inline-block/inline-flex/inline-grid 는
   margin box 로만 line 에 참여 (§10.8) — per-item `line_height` 소비 제거, slot 18 은
   S4 text-run 예약. Phase 2 의 종전 가정(item lineHeight 가 line 확장)은 비-CSS 로 판명
   → `adr923_p2_line_height_extends_line_box` 를 `adr923_p3_atomic_line_height_inert` 로 반전.
3. **컨테이너 strut** (`block_layout_with_strut` + `tree.rs` 전달): 컨테이너 line-height px
   가 ascent=descent=lh/2 의 zero-width baseline 참여자 (§10.8 half-leading — fontSize 0
   기준 정확; 실폰트 ascent 보정 공급 채널은 S4/Phase 5 판정). wasm export 시그니처 유지.
4. **폴백 baseline = bottom margin edge** (`block.rs` intake `child_h + m_bottom`) +
   **scroll container 강제** (`tree.rs` 가 센티널로 강제 — §10.8.1, r7 관찰 확정.
   round 8 정정: 강제 대상은 visible/**clip** 이외 — 수리 8. round 9 규범 귀속: 수리 12).
5. **atomic inline shrink-to-fit** (`tree.rs solve_block_child` + `solve_flex` min 측정):
   폭 auto atomic inline 은 fit = min(max-content, max(min-content, available−margin−pb)),
   fit 으로 재-solve (wrap·percentage 재해소, used width = fit — §10.3.9). wrap row 컨테이너의
   min-content 는 합산이 아니라 최대 item 기여 (css-flexbox-1 §9.9 — `min_wrap_measure`).

## round 8 수리 3건 (Codex 판독 반례·오라클 — 전부 Chrome 실측으로 확정, `efb56a888`)

6. **vertical-align: middle 은 baseline 앵커** (`block.rs line_metrics`/`flush_line_box`,
   r8h1): line box 중앙 배치가 아니라 **margin box 중심 = baseline + x-height/2** (§10.8
   — fontSize 0 채널이라 x-height 0, 실폰트 보정은 S4/Phase 5). middle 이 asc/desc 를
   mbox/2 씩 밀어 baseline 을 움직인다 (valign-middle-tall: ib20+ib60 → baseline 30,
   a.y 10 — 종전 중앙설은 기존 40px 케이스에서 우연히 동치라 통과했었다).
7. **마지막 line box 높이의 auto-height 반영** (r8h2): 마지막 flush 가 `current_y` 를
   전진하지 않아 tail 형제가 없으면 strut/valign 초과분이 증발 — trailing meta 4번째
   **inFlowBottom** 신설(`block.rs`) + 컨테이너 auto-height 소비(`tree.rs`).
   strut-last-line: root 40 vs 종전 20 (기존 strut 케이스는 전부 tail 보유라 관측 밖이었다).
   round 9 정정: 자식 bbox 와의 max 가 아니라 **inFlowBottom 단독** (수리 10).
8. **overflow: clip 은 BFC 도 baseline 도 만들지 않는다** (r8m2 + 오라클): `tree.rs`
   `overflow_creates_bfc` 와 baseline 억제 술어 **양쪽에서 clip 제외** — css-overflow-3
   §valdef-overflow-clip (clip-no-bfc: margin 관통 탈출), inline-block baseline 은
   visible 처럼 last line box 유지 (ib-overflow-clip-baseline: dom a.y 20 — margin-edge
   강제였다면 10. **Codex r8 과제 6 의 "baseline 은 clip 포함 타당" 판정을 오라클
   케이스가 반증** — BFC 쪽만 확증, baseline 쪽은 확장 수리).

## round 9 수리 4건 (Codex 판독 r9h1/r9m2 + 인접 경계 — 전부 Chrome 실측으로 확정)

9. **scroll container 단일 술어** (`tree.rs is_scrollable_overflow`/`is_scroll_container`,
   r9h1): overflow 판정 3곳 (BFC 생성 · block baseline 강제 · flex §4.5 automatic minimum)
   이 각자 문자열 비교를 들고 있어 flex 만 clip 을 "clipped" 로 남겼다 → 한 술어로
   통합. css-flexbox-1 §4.5 "automatic minimum size on a flex item whose computed overflow
   value is **non-scrollable** is its content-based minimum size; for scroll containers …
   zero" + css-overflow-3 §3.1 "scroll, auto, hidden … cause the box to be a scroll
   container" → clip/visible 은 floor 유지 (flex-item-clip-auto-min f.w 80, hidden 대조군
   60). 양축 판정: 한 축이 scrollable 이면 다른 축 visible 은 auto 로 계산되므로
   overflowY hidden 만 있어도 scroll container (flex-item-cross-hidden-auto-min 60 —
   종전 main 축 단독 판정은 이 케이스에서 80 이었을 것). `flex.rs` 슬롯 18 의미론을
   "clipped" → "scroll container" 로 개명.
10. **block auto height = in-flow bottom 단독 + 꼬리 margin chain 포함/탈출** (`block.rs`
    trailing, `tree.rs container_h`, r9m2): 부모 bottom 과 collapse 하지 못하는
    (`can_collapse_bottom=false` — padding/border/BFC) 마지막 margin chain 은 content 에
    포함 (§10.6.3 "bottom margin edge of the last in-flow child" — trailing-margin-contained
    31 / trailing-empty-block-contained 41), collapse 하면 탈출·제외 (trailing-empty-
    block-escape 10). 컨테이너 auto height 는 자식 rect bbox 를 버리고 block.rs meta
    inFlowBottom 만 소비 — bbox 는 꼬리 self-collapsing box 의 rect(as-if-border 자리)
    와 음수 bottom margin 을 부풀린다.
11. **self-collapsing box 의 intake 분류** (`tree.rs write_block_item` → 코드 2, r9m2
    root cause): 종전 주석은 "block.rs 사전 분류" 라 했지만 발행 주체가 없어 `DISPLAY_
EMPTY_BLOCK` 경로는 cargo 단위 테스트에서만 살아 있었다 — 프로덕션·차등 하니스에선
    empty block 이 일반 block 으로 흘러 top/bottom margin 이 관통하지 않았다 (empty-first-
    child-padded: solid.y 51 vs Chrome 31). 조건 = block-level · 상하 padding/border 0 ·
    height auto · min-height 0/미지정 · content_h 0 · BFC 아님 (§8.3.1). block.rs 는
    위치를 "non-zero bottom border 가 있었다면" 자리(자기 top 만 이전 chain 과 collapse)
    로, 부모 top 과 collapse 하는 선두 chain 은 부모 top border edge 로 놓는다
    (empty-first-chain-through-wrap: empty/solid/wrap y 40 — 종전 30/60/30). `height: 0`
    명시는 보수적으로 제외 (자식 유무를 intake 에서 볼 수 없어 content 있는 height:0
    box 와 구분 불가 — 관찰).
12. **BFC 자식의 자기 margin 은 형제·부모와 collapse 한다** (`block.rs` — `bfc_flag`
    미소비화, 인접): §8.3.1 의 BFC 조항은 "자기 **in-flow 자식** 과 collapse 하지
    않는다" 뿐인데 block.rs 는 BFC 자식의 자기 top 을 합산(`prev + m_top`)하고 bottom
    탈출을 0 으로 막았다 (bfc-sibling-top-collapse b.y 40 vs Chrome 30 · bfc-last-child-
    margin-escape sib.y 10 vs 30 · bfc-first-child-top-escape wrap.h 30 vs 10). 자식
    내부 차단은 tree.rs 가 자식 solve 의 `can_collapse_*=false` 로 이미 하고 있어
    block.rs 의 이중 차단이 오류였다. 슬롯 7 은 프로토콜 호환용 잔존. 같은 정리로
    **line box 는 margin 을 collapse 하지 않는다** — 새 line box 가 시작될 때 pending
    chain 을 그대로 놓고, 마지막이 line box 면 탈출 margin 0 (block-margin-then-line-box
    b.y 20 vs 종전 10 — 종전 `prev_margin_bottom` 을 inline 분기가 버렸다).
    round 8 수리 8 의 규범 귀속 (r9l1): CSS 2.1 §10.8.1 "overflow other than visible" 문면은
    css-align-3 §9.1 "a block container that is a **block-axis scroll container** always has
    a last baseline set … block-end margin edge" 로 갱신됐고 clip 은 scroll container 가
    아니다 — Chrome 결과와 규범이 일치 (css-overflow-3 자체에는 baseline 조항 없음).

13. **`height: 0` 명시 self-collapsing** (`tree.rs` `NodeLayout` 옆 `self_collapsing` 플래그 +
    intake leaf 규칙, 후속 ①): §8.3.1 "zero **or auto** computed height" — 수리 11 의 intake
    규칙은 auto 만 받았다. 재귀 정의라 자식 `solve_block` 이 판정(in-flow 하단 0 · line box
    없음 · 상하 pad/border 0 · height auto/0 · min-height 0 · BFC 아님)해 플래그로 남기고 부모
    intake 가 읽는다; `solve_block` 을 타지 않는 leaf 는 explicit 0 + content_h 0 으로 intake 가
    직접 판정. 내용 있는 height:0 컨테이너는 플래그 false 라 제외 (Chrome 대조군 b.y 60).
    (Chrome height-zero-self-collapsing b.y 40 — 종전 60.)

## round 10 수리 5건 (Codex 판독 r10h1/r10m1/r10m2/r10m3 — 전부 Chrome 실측으로 확정)

14. **텍스트 leaf 의 line box 신호** (`tree.rs` solve_node leaf 경로 + `utils.ts`
    `enrichWithIntrinsicSize`, r10h1): §8.3.1 "no line boxes" — 텍스트가 있는 leaf 는 height:0
    이어도 line box 가 있어 self-collapsing 이 아니다 (Chrome text-leaf-height-zero-has-line-box
    b.y 60 / 종전 40). 엔진은 텍스트를 모르므로 TS 측정 스칼라 `leafBaseline` 을 **line box 존재
    신호**로 읽는다 (Some → 제외). TS 쪽 root cause 2겹: early return 2곳 (`!needsHeight &&
!needsWidth` · `contentHeight <= 0`) 이 height 명시 텍스트 leaf 를 스칼라 공급 전에 반환했고,
    텍스트 분기 자체가 `needsWidth` (flex/grid 자식 한정) 에 묶여 **block 부모의 텍스트 leaf 는
    leafBaseline 을 받지 못했다** → 텍스트가 있으면 폭 조건과 무관하게 공급 (빈 텍스트는 line box
    없음 → 미공급, Chrome 대조군 40). 부수효과: block 부모 텍스트 leaf 의 baseline 이 bottom
    폴백 → 실제 첫 줄 baseline (Phase 2 계약 — Chrome 과 같은 방향). 게이트 3 (pipelineLeg:
    hello · width 100px · 빈 텍스트).
15. **absolute 자식만 있는 컨테이너** (`tree.rs` leaf 경로, r10m1): in-flow 자식이 없으면 leaf
    경로인데 플래그를 남기지 않았고 intake 의 leaf 규칙은 `children.is_empty()` 를 봐 absolute 자식
    이 있으면 둘 다 빠졌다 (Chrome abs-only-height-zero b.y 40 / 종전 60). 판정을 leaf 경로로 이관
    (상하 pad/border 0 · height auto/0 · min-height 0 · BFC 아님 · leafBaseline 없음) — intake
    는 플래그만 읽고 `write_block_item` 의 auto-height 규칙은 제거 (**단일 원천**, r9m2 이중 층
    교훈; auto 대조군 44 도 이 경로로 40).
16. **adjoining margin 집합 `MarginSet`** (`block.rs` + `tree.rs` 경계, r10m2): §8.3.1 collapsed
    margin = 최대 양수 + 최소 음수 — 이항 `collapse_margins` 누적은 3개 이상 부호 혼합에서 결합
    순서에 의존한다 ({10,30,−20,5,25,5} 집합 10 / 이항 25 — Chrome three-empties b.y 20 / 종전 35).
    형제 chain · self-collapsing 관통 · 부모-자식 hoist **3층이 한 집합**이므로 커널 상태 3종
    (prev/first/last) 과 경계 (Node `escaped_mt/mb`, 슬롯 19/20 음수 성분, meta 4/5) 를 (pos, neg)
    쌍으로 넘긴다 — `FIELD_COUNT` 19 → 21 (golden `block_child` 입력 21 필드, **기대값 무변경**).
    hoisted g.y 20 / 종전 35 · self-collapsing wrapper 20 / 35.
17. **auto height 0 하한** (`tree.rs container_h`, r10m3): 음수 margin 으로 in-flow bottom 이
    content 원점 위로 가면 used height 가 음수였다 → `max(0)` (Chrome negative-top-margin-padded
    root.h 2 / 종전 −8 · negative-bottom-margin-contained 1 / −9).
18. **self-collapsing 근거 = 자식 코드 전수** (`tree.rs solve_block`, r10m3 인접): 종전 판정이
    `in-flow bottom ≤ 0` 을 근거로 써 음수 margin 컨테이너(내용 있음)를 self-collapsing 으로 오판
    했다 → in-flow 자식 전부 코드 2 (line box 는 코드 1 이라 자동 제외) 로 교체 (Chrome
    negative-flow-bottom-not-self-collapsing b.y 60 / 종전 40).

## round 11 수리 3건 (Codex 판독 r11h1/r11m1 — 전부 Chrome 실측으로 확정, min-height 절반은 Chrome 이 정정)

19. **whitespace-aware line box 신호** (`utils.ts` `textLeafRendersContent`, r11h1): 종전 신호는
    raw 문자열 nonempty — CSS Text 3 §4.1.1 white-space 처리 뒤 collapsible 공백 (space · tab ·
    segment break) 만 있는 텍스트는 normal/nowrap 에서 아무것도 남지 않아 line box 가 없다 (Chrome
    `" "` b.y 40 / 종전 60). pre-line 은 공백·탭만 collapsible, segment break 는 forced line
    break 로 보존 (`"\n"` → line box, Chrome 60) · pre/pre-wrap/break-spaces 는 전부 보존 · nbsp
    는 비-collapsible (Chrome 60). 폭 스칼라 (contentMin/MaxWidth) 도 같은 신호로 공급 — collapse
    로 사라진 내용의 측정폭은 공백 폭이라 Chrome max-content 0 과 갈린다. 엔진 leaf 규칙
    (`leaf_baseline.is_none()`) 은 무변경 — 신호 원천만 정정.
20. **부모 bottom adjoining = height auto** (`tree.rs` solve_block `can_collapse_bottom`, r11m1):
    §8.3.1 "bottom margin of a last in-flow child and bottom margin of its parent **if the
    parent has 'auto' computed height**" — 종전 조건은 BFC · bottom pad/border 뿐. 명시 height
    (0 포함) 면 마지막 자식 margin 은 부모 안 (Chrome parent-explicit-height b.y 50 / 종전 70 ·
    height:0 b.y 0 / 종전 20). height:0 은 auto 가 아니므로 `container_h` 도 content 0 (min-height
    clamp 는 부모 intake 슬롯 12 — height:0+min-height:10 → 10 / 종전 30). top 조건에는 height 가
    없다 (대조군 p.y 30 첫 실행 PASS). **Codex 지적의 `min-height: 0` 절반은 §8.3.1 self-collapsing
    조건이지 adjoining 조건이 아니다** — Chrome 미바인딩 min-height:10 은 접힘 유지 (b.y 40; 1차
    수리안 `min_h > 0` 일괄 포함은 55 로 발산해 Chrome 이 기각).
21. **min/max-height 바인딩 시 strut 미전파** (`tree.rs` solve_block, r11m1 후속 — Blink 모델):
    used block-size 가 min/max clamp 로 strut 제외 intrinsic 과 달라지면 마지막 자식의 bottom
    margin strut 은 부모 밖으로 나가지 않는다 — Chrome min-height:30 (content 20 < 30 < strut 포함 40) p.h 30 · b.y 45 (포함-후-clamp 모델의 40·55 반증) · max-height:10 p.h 10 · b.y 25 ·
    min-height:100 b.y 115. 구현: 커널은 height auto 기준으로 collapse 하고, flow_bottom 확정 뒤
    `min_h > content || max_h < content` (content-box, 슬롯 12/13 과 같은 변환) 면
    `escaped_bottom_set = ZERO` — 사용 높이는 부모 intake `clamp_size` 가 확정, 자식 margin edge 는
    상자 안 overflow. 대조군: min-height:0 명시 · max-height:100 미바인딩 → 40. **Blink 근거
    (r12l4, Codex round 12 확인)**: `third_party/blink/renderer/core/layout/block_layout_algorithm.cc`
    — intrinsic block size 와 최종 block size 가 다르면 end margin strut 을 제거 ·
    `length_utils.cc` `ComputeBlockSizeForFragment` (min/max clamp).

## round 12 수리 5건 (Codex 판독 r12h1/r12m1/r12m2/r12l1/r12l2/r12l3 + 과제 5 — 전부 Chrome 실측으로 확정; 커밋 `ea097ef68` (세션 밖 도구가 중간 상태를 커밋·push — 내용은 그대로 이어받음) · `6770013b2` (수리 마무리) · `2eea7c742` (문서), r13l3 공시)

22. **상속 white-space** (`utils.ts` `enrichWithIntrinsicSize`, r12h1): white-space 는 inherited
    property 인데 신호가 inline `style.whiteSpace` 만 읽었다 → `?? _computedStyle?.whiteSpace`
    (cssResolver 의 computed, 부모 상속) (Chrome 부모 pre + 자식 공백만 b.y 60 / 종전 40;
    break-spaces · pre-line `"\n"` 동일, inline normal 재지정 대조군 40).
23. **children 정규화** (`utils.ts` `resolveTextLeafContent`, r12l3): `String(children)` 이 배열을
    `" , "` (쉼표 = 내용), object 를 `"[object Object]"` 로 만들어 신호를 오염 → `extractFromValue`
    규칙 (string/number, 배열은 그 항목만 이어붙임, object/boolean 은 "") 으로, 원천 우선순위
    (children → text → label → title 첫 정의값) 유지. unit `adr923TextLeafContentSignal.test.ts`.
24. **percentage min-height 의 세로 ctx** (`tree.rs` solve_block, r12m1): `own_min_h`/`own_max_h`
    가 `parent_ctx`(avail_w) 로 풀려 50% 가 폭 기준 150 → 바인딩 오판 → `own_height_ctx =
ctx_for(avail_h)` (explicit_h 와 같은 ctx; 부모 auto 면 INDEFINITE → None → 0, §10.7 "containing
    block 높이 미명시 시 percentage min-height 는 0") (Chrome b.y 40 / 종전 35; definite CB 대조군
    115 불변).
25. **min/max clamp 순서 = max-then-min** (r12m2 + sweep 4곳): CSS §10.4/§10.7 은 max 를 먼저
    적용하고 그 결과에 min 을 적용한다 — min > max 면 min 이 이긴다. `block.rs clamp_size` 는
    min-then-max 였다 (Chrome min-height:30 + max-height:10 부모 p.h 30 · b.y 45 / 종전 10 · 25).
    같은 순서 오류 sweep: `tree.rs fixup_root_self_size` width/height (root.h 30 / 10) ·
    `track_contribution` (grid c.h 30 / 10). `flex.rs clamp_size` 는 원래 max-then-min — 같은
    이름의 helper 가 두 파일에서 순서가 달랐다.
26. **root 명시 height 의 min/max clamp** (`tree.rs fixup_root_self_size`, r12 과제 5): `has_h`
    분기가 명시 높이에서 clamp 를 건너뛰어 root `height:0 + min-height:10` 이 0 (Chrome 10) →
    clamp 를 has_h 와 무관하게 적용 (§10.7). 비-root 명시 높이 > 0 은 solve_node 가 이미 clamp,
    height:0 자식은 부모 intake 슬롯 12 가 clamp (#58). 라이브 root(body) 는 Builder 가 authored
    height 를 걷어내고 viewport `minHeight` 를 주입한다 (`fullTreeLayout.ts` Step 1.5; Preview 도
    `minHeight:100vh`) → 처음부터 `!has_h` + min-height clamp 경로라 이 이동으로 body 동작은
    불변 (r13l1 정정 — 종전 "min/max 미선언" 서술은 오류).
    - **게이트 2 (r12l1 · r12l2)**: flex row 공백만 Text 폭 (width:auto 명시 — Chrome 0, raw 측정
      원복 5) · height:0 부모 abs containing block (#67 — Codex 실측 원복 시 abs.y −10 → +10). 폭
      스칼라는 내용이 없을 때 **0 을 공급** (`Option` 부재 = "측정 없음" — 엔진 auto 폴백이 현재 0
      이라 동치지만 "알려진 0" 으로 고정).

## round 13 수리 3건 (Codex 판독 r13m1/r13m2 + r13l4 게이트가 연 root 폭 결함 — 전부 Chrome 실측으로 확정, `1e1f3a85d`)

27. **white-space cascade 키워드** (`utils.ts` `resolveTextLeafWhiteSpace`, r13m1): 신호가 inline
    `style.whiteSpace` 를 computed 보다 먼저 읽어 `inherit`/`unset` 을 raw 문자열 (→ normal) 로
    소비했다 — cssResolver computed 는 이미 키워드를 해석해 두었는데 (inherit·unset → 부모값,
    initial·revert → normal) 버려졌다. 해석 규칙: inline **구체값** 은 그대로 (implicit 주입이
    computed 산출 뒤에 실릴 수 있어 inline 이 최신), 키워드·부재는 computed, computed 없는 키워드는
    normal 폴백 (Chrome 부모 pre + 자식 `inherit`/`unset` b.y 60 / 종전 40; `initial` 대조군 40).
28. **텍스트 leaf 내용 원천 SSOT** (r13m2): 네 소비처의 원천 순서가 달랐다 — 신호
    children→text→label→title · 폭 측정 `extractTextContent` label→text→children · Skia
    `buildCatalogShapes` label||text||children||placeholder · Preview generic/renderLabel children 만.
    SSOT = binding 이 content 로 선언한 `children` (TEXT_LEAF 7종 전부
    `accepts.children.section === "content"` — Preview 가 그리는 것). `resolveTextLeafContent` 를
    children-only 로 고정하고 텍스트 leaf 의 신호·폭 측정 (`calculateContentWidth` 분기)·높이 측정
    (`calculateContentHeight` 빈 판정·wrap 측정)·min/max-content 키워드·빈 leaf 판정 전부 이 함수로.
    Skia 렌더 (`buildSpecNodeData`)·측정 (`specTextStyle`)·overlay 의 `buildCatalogShapes` 호출은
    `maskNonContentTextProps` — binding 이 children 을 content 로 선언하면 label/text 차단 (데이터
    분기; `label` 을 content 로 선언한 ProgressBar/Meter/Slider/TextField 는 그대로). Preview
    `renderDescription` 은 legacy `text` 선행을 children 선행으로 (Card 안 Description 렌더와 같은
    순서). (Chrome flex row children "Y" + label "XXXXXXXXXXXXXXXXXXXX" (width:auto) box.x 10.2 /
    종전 label 폭 211; children "" + label "X" 대조군 40 — 신호가 이미 children 을 봐 스칼라 0 경로.)
29. **root auto 폭의 min/max clamp 를 자식 배치 전에** (`tree.rs compute_layout`, r13l4 게이트가 연
    결함): root 폭 clamp 는 `fixup_root_self_size` 가 solve **뒤** root 상자만 고쳐 자식은 clamp 전
    폭 (300) 으로 배치됐다 — CSS 는 used 폭 (containing block fill → max-then-min) 안에 자식을
    배치한다 (§10.3.3/§10.4). `compute_layout` 이 auto 폭 root 의 used 폭을 먼저 구해 `solve_node`
    에 넘긴다 (비-root 는 부모 intake 가 used 폭을 넘기는 ADR-170 §1 과 같은 모델; % min/max 는
    원래 available ctx). (Chrome root min-width:250 + max-width:100 → c.w 250 / 종전 300; 명시 폭
    root 는 solve_node 가 이미 clamp — cargo 대조군 250.) 게이트 #69 는 Codex 가 요청한 "폭 축 독립
    케이스" 였고 첫 실행에서 RED (c.w 300) — 회귀 게이트가 아니라 결함 발견이었다.
    - **게이트 5 (r13m1 3 · r13m2 2)**: 부모 pre + 자식 inline `inherit` (60) · `unset` (60) ·
      `initial` 대조군 (40) · children "" + label "X" 대조군 (40) · flex row children "Y" + label 장문
      (box.x = w(Y)). 하니스 `CaseNode.props` (pipeline 전용 — DOM 이 그리지 않는 prop) 추가 —
      대조군을 유리하게 바꾼 것이 아니라 Preview 가 그리지 않는 prop 을 실은 것.
    - 원복 RED (수리 전 첫 실행 실측): (a) `style?.whiteSpace ?? computed` 복원 → inherit/unset
      게이트 2 RED (root.h 50 / Chrome 70) · (b) `extractTextContent` label 우선 복원 → r13m2 flex
      게이트 RED (box.x 211 / 10.2) · (c) `compute_layout` solve_w 제거 → #69 RED (c.w 300 / 250) ·
      (d) `maskNonContentTextProps` 제거 → Skia 만 label 을 그림 (차등 하니스 밖 — live 로 확인).

## round 14 수리 2건 (Codex 판독 r14m1/r14m2 + r14l1/r14l2 — 전부 Chrome 실측으로 확정, `9fa92c8e1`)

30. **cascade 키워드 정규화 + computed 우선** (`cssResolver.ts` `resolveCascadeKeyword` · flat 경로 ·
    `utils.ts resolveTextLeafWhiteSpace`, r14m1·r14l1): resolver 가 소문자화만 하고 trim 을 안 해
    `" INHERIT "` 를 키워드로 못 읽고 computed 에 raw 를 남겼다 → trim + 소문자 (CSS 키워드는 ASCII
    대소문자·앞뒤 공백 무시). helper 는 **computed 우선** (inline 을 이미 포함) + computed 정규화 (남은
    키워드는 normal 폴백), computed 부재 시에만 inline raw. round 13 의 "inline 구체값이 computed 보다
    최신" 근거는 성립하지 않았다 — implicit 주입 뒤엔 이 함수가 호출되지 않고 2-pass 는 computed 를
    재계산한다 (r14l1) (Chrome 부모 pre + 자식 `" INHERIT "` b.y 60 / 종전 40).
31. **텍스트 원천 SSOT 를 writer 인벤토리로 재정의** (r14m2 — round 13 수리 28 의 binding-선언 기반
    차단 **철회**): binding `accepts` 는 편집 surface 지 렌더 소비 집합이 아니었다 — (i) **Pencil
    import** 가 `props.text` 를 쓴다 (`collectPencilProps`, production writer — `pencilImport.test.ts`
    :14) (ii) collection item (ListBoxItem/GridListItem/TreeItem/Column/Menu) 은 Preview 가
    `label || children` 을 그린다 (`SelectionRenderers.tsx` :655/:1053 · `CollectionRenderers.tsx`
    :205 · `TableRenderer.tsx` :68 — 단 Column 은 `children || label` 로 순서가 반대였다, Codex r15 정정). round 13 의 33-primitive label/text 차단은 (i) 의 Skia 텍스트와
    (ii) 의 item label 을 지웠다 (Codex probe). 수리: 차단 helper 삭제 (3 호출 원복) ·
    `resolveTextLeafContent` = **children → text** (첫 비어있지 않은 값; label/title 은 텍스트 leaf
    writer 0 + Preview 미소비) · Skia `buildCatalogShapes` = `label || children || text || placeholder`
    (children 이 stale import `text` 를 이김 — inspector 편집은 children 을 쓰고 overlay 편집은
    `getTextPropKey` 로 원 키 유지) · Preview generic 렌더에 `text` fallback (`resolveGenericLeafText`
    — import 문서의 Text/Heading/Paragraph 가 Preview 에서 비어 있던 D3 비대칭 해소;
    renderDescription/Card Description 과 같은 순서) (Chrome `text` 만 있는 Text b.y 60 / 종전
    children-only 40 · flex 폭 w(Y) / 0).
    - **게이트 3 (r14m1 1 · r14m2 2)**: 부모 pre + `" INHERIT "` (60) · `text` 만 있는 height:0 Text
      (60) · flex row `text` 만 있는 width:auto Text (box.x = w(Y)). 하니스 `CaseNode.textPropKey`
      (`"children"` | `"text"`) — DOM 은 어느 쪽이든 textContent; writer 를 실은 것이지 대조군을
      유리하게 바꾼 것 아님.
    - 원복 RED (수리 전 첫 실행 실측): (a) resolver trim 제거 → `" INHERIT "` 게이트 RED (40 / 60) ·
      (b) `resolveTextLeafContent` children-only → `text` 게이트 2 RED (40 / 60 · box.x) · (c) 차단
      helper 복원 / `buildCatalogShapes` 순서 복원 → 차등 밖 — specs unit
      `buildCatalogShapes.textSource.test.ts` (label > children > text > placeholder · children 이
      text 를 이김 · 배열 children 은 텍스트 아님) 로 판별.
    - r14l2: breakdown :125 대조군 수치 18/51 정정.

## round 15 수리 1건 (Codex 판독 r15m1 — 세 표면 unit 게이트로 확정; Chrome plain-DOM 하니스는 이 RED 를 실을 수 없음, `04503eebd`)

32. **텍스트 원천을 타입별 계약 단일 모듈로 통합** (r15m1 — round 14 수리 31 의 "label/title writer 0"
    전제 정정): writer 인벤토리가 **AI `create_element`/`update_element`** (`createElement.ts` :52
    `{...defaultProps, ...aiProps}` · `updateElement.ts` :72 `updateElementProps(id, {...newProps})` —
    열린 props 를 검증 없이 병합·저장) 를 빠뜨렸다. AI Text `{label: "AI Label"}` → 저장
    `{children: "Text", label: "AI Label"}` → Skia (`label` 우선) "AI Label" / Preview·레이아웃 "Text";
    Button/Column 도 같은 조합에 도달 (Codex 반례). root cause 는 writer 하나의 누락이 아니라 **텍스트
    원천 순서를 consumer 마다 따로 들고 있던 것** — 열린 writer (AI/DB/마이그레이션) 가 있는 한
    인벤토리로 "writer 0" 을 확정할 수 없고, 순서가 한 곳이라도 다르면 도달 가능한 반례가 있다.
    수리: `@composition/specs` `renderers/utils/textSource.ts` (`resolveTextSourceText(type, props)` —
    writer 인벤토리로 도출한 타입별 순서: 기본 `children` · 텍스트 leaf 7 + FieldError `children → text`
    · ListBoxItem/GridListItem/Menu `label → children` · field leaf 9 (Input/TextArea/TextField/
    SearchField/NumberField/ColorField/Select/SelectValue/ComboBox) `placeholder`; 문자열화
    `textFromValue` 공통 — 배열은 string/number 이어붙임) 을 **세 표면이 전부 위임**: Skia
    `buildCatalogShapes(…, nodeType)` (호출 3곳 type 전달) + `breadcrumbCrumb` primitive · 레이아웃
    `extractTextContent(type, props)` / `resolveTextLeafContent` / 비-텍스트 leaf `??` 체인 2곳 ·
    Preview generic (`resolveGenericLeafText(type, props)`) + Label/Description/FieldError +
    ListBoxItem/GridListItem/Menu + TreeItem (2) + Column (`resolveColumnHeaderLabel`) +
    DisclosureHeader + Button + shared `extractTextContent(element)`. 계약 밖 키 (기본 군의 `label`/
    `title`/`value`/`text`/`placeholder`) 는 세 표면이 **함께** 무시한다 (**노드 자기 텍스트에 한함** — composite parent 의 `label`/`placeholder` 는 parent props 가 SSOT 이고 propagation registry 가 canonical 자식으로 잇는 별개 축, round 16 수리 33) — Preview 의 TreeItem
    `title/label/value` · Column `label` · DisclosureHeader `title` 폴백은 production writer 가 없는 (AI 만
    도달하는) 키라 계약에서 뺐고, FieldError 는 inspector 가 쓰는 `children` 을 Preview 만 무시하던
    것이 함께 고쳐졌다. AI 도구 설명 (i18n `aiToolDef.props`/`updateProps` ko·en) 에 "표시 텍스트는
    children" 을 명시 (writer 측 보강 — 계약의 대체 아님).
    - **게이트 (전부 RED 확인 — 수리 코드를 종전 순서로 원복해 실측)**: specs unit `textSource.test.ts`
      13 + `buildCatalogShapes.textSource.test.ts` 7 (Skia 종전 순서 원복 → 6 RED) · layout unit
      `adr923TextLeafContentSignal` r15m1 3 (`calculateContentWidth` Button/Column/TreeItem/Div 가
      label·title 장문에 불변 · ListBoxItem label 우선 · AI 저장 형태 — 레이아웃 종전 순서 원복 → 1 RED)
      · Preview `textSourceContract.test.tsx` 6 (shared — ListBoxItem/GridListItem/TreeItem/Column/Menu/
      Label/Description/FieldError/DisclosureHeader/Button 반환 element 텍스트 = 계약; Column 종전
      `children || label` 원복 → 1 RED) + `CanonicalNodeRenderer.textSource.test.tsx` 4 (generic
      Text/Heading DOM · cutover Button DOM). Chrome 차등에는 pin 1 (Text + AI label 장문, 첫 실행 PASS
      — 레이아웃은 round 13 부터 children 우선) 만 — 이 하니스는 RED 를 실을 수 없다: plain-DOM
      대조군은 catalog box 를 모르고 (Button probe DOM 10.2 / 파이프라인 68, label 유무 무관) 비-텍스트
      leaf 의 inline 텍스트는 파이프라인이 재지 않는다 (Div probe DOM 10.2 / 0 — canonical 모델에서
      텍스트는 Text leaf 에 산다).
    - 기존 specs 테스트 2 파일 (`buildCatalogShapes.test.ts` "label 우선" · `placeholderAlign` 5) 은
      round 14 의 Skia 단일 순서를 고정하던 것이라 계약 (nodeType) 으로 갱신 — 배열 children 은 Skia
      도 "ab" (Preview 가 그리는 결과; 종전 Skia 만 "텍스트 아님" 으로 `text` 로 넘어갔다).

## round 16 수리 1건 (Codex 판독 r16m1 — composite parent label 다리; factory sweep 이 2 가족 추가 검출, `89155edea`)

33. **composite parent `label` 을 canonical Label 자식으로 잇는 propagation 다리** (r16m1 — round 15 의 "세 표면 위임" 은
    노드 자기 텍스트 (buildCatalogShapes text shape · generic leaf · 콘텐츠 폭) 에만 성립하고, composite parent 의 slot
    텍스트는 다른 축이었다). Preview 는 parent props 로 RAC 를 self-compose (`renderColorField` `label={element.props.label}`)
    하고, Skia (`applyParentPropagationProps` :457) · 레이아웃 (`fullTreeLayout` :2153 `resolvePropagatedProps`) · Inspector
    store 쓰기 (`PropertiesPanel` :207 `buildPropagationUpdates`) 는 propagation registry 의 `label → Label.children (override)`
    로만 canonical Label 자식에 닿는다 — 형제 field 9종 (TextField/TextArea/SearchField/NumberField/DateField/TimeField/
    DatePicker/Select/ComboBox) 은 전부 이 규칙을 갖는데 ColorField 는 spec 시절 (`ColorField.spec.ts` propagation `size` 만)
    부터 없었고 factory parent 에 `label` 도 없었다 (`DateColorComponents.ts` — DateField/TimeField 는 parent label + Label
    자식 둘 다). 그래서 Inspector (binding `label` accepts) / AI 가 parent label 을 쓰면 Preview "Changed Color" / Skia·
    레이아웃 "Color" (Codex 반례 — 확증), 생성 직후는 Preview 무라벨 / Skia "Color".
    - **factory sweep 게이트가 같은 누락을 2 가족 더 검출**: 직접 Label 자식 (문자열 children) 을 만드는 factory 전부
      (20 가족 — r17l1 정정: 게이트가 정확한 집합을 단언) 에 대해 (i) registry `→ Label.children` 규칙 (ii) 생성 시 parent SSOT == Label 텍스트 (iii) parent 변경이
      `resolvePropagatedProps` 로 도달 — 수리 전 RED = ColorField · **CheckboxGroup · RadioGroup** (binding 이 parent
      `label` 을 받지만 규칙 없음 → Inspector label 편집이 어느 표면에도 안 닿았다: Preview 는 Label 자식 우선
      `labelChild.children || props.label` 이라 stale, Skia 도 자식 stale — 표면끼리는 같았지만 편집이 죽어 있었고, 규칙만
      추가하면 AI 가 parent 만 쓴 문서에서 Skia 만 바뀌는 새 갈림이 생기므로 Preview 순서를 parent 우선으로 함께 정렬).
    - 수리: registry 3 가족 `label → Label.children (override)` · ColorField factory parent `label: "Color"` · Preview
      CheckboxGroup/RadioGroup `props.label || labelChild.children` (parent = D2 SSOT, 자식은 mirror + legacy 폴백) ·
      hydration migration `migrateColorFieldParentLabel` (parent `label` 부재 시 Label 자식 텍스트로 채움 — `label: ""` 은
      보존, 멱등, `adapters/canonical/index.ts` + `usePageManager.ts` 두 체인).
    - 게이트: `apps/builder/src/builder/utils/adr923CompositeLabelBridge.test.tsx` 5 (sweep 2 + ColorField 3표면 2 + 그룹
      parent 우선 1 — 수리 전 RED 3+2) · `colorFieldParentLabelMigration.test.ts` 3. Chrome 차등에는 싣지 않음 (plain-DOM
      하니스 한계 — round 15 와 같은 이유).
    - **계약 밖 키 공동 무시 주장의 정정**: 수리 32 의 "계약 밖 키는 세 표면이 함께 무시" 는 노드 자기 텍스트 한정.
      composite parent 의 `label`/`placeholder` 는 parent props 가 SSOT 이고 propagation registry 가 자식으로 잇는 별개 축 —
      이 축의 닫힘 기준은 "Label 자식을 만드는 factory 가족 전부가 규칙을 가진다" (sweep 게이트).
    - **description / errorMessage (r16m1 의 나머지 반 — 이번 수리 밖)**: field/group binding 15종이 Inspector 로 parent
      `description`/`errorMessage` 를 받고 Preview 는 RAC slot 으로 그리지만 (`errorMessage` 는 `isInvalid` 일 때만 —
      RAC FieldError), **Skia 는 어떤 field 가족에서도 이 둘을 그리지 않는다** — factory 에 Description 자식이 없고
      (TextField/DateField/TimeField 의 FieldError 자식은 `children: ""` + `display: none`, 규칙 없음) skiaPrimitives 의
      `description` reader 는 card/listbox_item (collection) 뿐. round 15 이전부터의 D3 투영 공백 (text 원천 순서 문제가
      아님) 이고 수리 = 가족 전체 canonical 자식 (Description/FieldError) + propagation + FieldError 가시성 ↔ `isInvalid` +
      레이아웃 높이 — ADR-923 (레이아웃 어휘) 범위 밖으로 판정, 관찰로 기록 — **사용자 결정 2026-09-01: 범위 밖, 별도 작업** (Phase 4 이후).

34. **overlay 텍스트 편집 (캔버스 더블클릭) 의 읽기·쓰기 키를 텍스트 원천 계약에 위임** (round 16 확증 중 자체
    발견 — round 15 축의 마지막 미위임 reader/writer). `useTextEdit.ts` 는 자체 순서 `value || defaultValue ||
children || text || label` 로 편집 시작 텍스트를 뽑고, 쓰기 키도 자체 규칙 (`value`/`defaultValue` 있으면 value →
    children → text → label) 이었다 — AI 가 Button 에 `label` 만 쓰면 캔버스·Preview 는 아무것도 안 그리는데 편집창에는
    "Go" 가 떴고 확정 시 `label` 에 다시 써서 계속 안 보였다 (TEXT_EDITABLE_TAGS 는 기본·텍스트 leaf 군이라 도달 경로는
    AI 계약 밖 키뿐). 수리: `extractText(type, props)` → `resolveTextSourceText`, `getTextPropKey` →
    `resolveTextSourceKey ?? textSourceOrder(type)[0]` (입력 계열 value 편집은 보존 — 가시 태그 밖). 게이트
    `useTextEdit.textSource.test.ts` 5.

## round 17 수리 3건 (Codex 판독 r17m1/r17m2/r17m3 + LOW 2 — 전부 unit 게이트로 확정, 종전 코드 원복 RED 6, `6e8d5ed39`)

35. **Preview 의 composite label 읽기를 propagation engine 과 같은 경계로** (r17m1 — round 16 수리 33 의 그룹 라벨
    `props.label || labelChild.children` 가 `||` 라 사용자가 비운 `label: ""` 이 stale Label 자식으로 되살아났다;
    engine (`resolvePropagatedProps` :244 · Skia `resolvePropagationValue` :435) 은 **`undefined` 만** skip 하고 `""`/`null`
    은 자식에 그대로 override 하므로 Preview "Stale Group" / Skia·레이아웃 "" 로 갈렸다). grep sweep 으로 같은 `||` 접기를
    가진 reader 를 전부 찾았다: 그룹 2 + **child-first** 4 (SearchField `FormRenderers` :398 · ProgressBar `LayoutRenderers`
    :779 · Meter :839 · ComboBox `SelectionRenderers` :1558 — AI 가 parent 만 쓴 문서에서 Skia 와 갈리는 r16 그룹과 같은
    형태) + **default-fallback** 4 (DatePicker/DateRangePicker/DateField/TimeField `DateRenderers` :208/:304/:411/:487
    `label || "Date Picker"` — `""` 가 "Date Picker" 로 되살아남). 수리: shared `renderers/utils/propagatedLabel.ts`
    `resolvePropagatedText(parentValue, labelChild, fallback)` — parent 가 undefined 가 아니면 `textFromValue` 그대로
    (`""` 포함), undefined 면 자식 계약 텍스트 (legacy), 없으면 fallback — 10 지점 전부 위임.
36. **형태 migration 단일 체인 + external import 결선** (r17m2 — `migrateColorFieldParentLabel` 을 hydration/persist-back
    두 체인에만 이었고 external import (`importPayloadAdapter.ts` `normalizeCompositionImportPayload`) 는 어느 migration
    도 안 거쳐 import master 의 legacy ColorField 가 Preview 무라벨 / Skia "Color" 로 남았다). root cause 는 결선 하나가
    아니라 **같은 4 migration 을 진입점마다 다시 적는 구조** — `adapters/canonical/canonicalDocumentMigrations.ts`
    `applyCanonicalDocumentMigrations` (CheckboxRadio 구조 → ColorField parent label → field inline strip → circle leaf
    strip, 종전 중첩 순서) 로 모으고 세 진입점 (`index.ts` :338 · `usePageManager.ts` :402 · import adapter 3 분기) 이
    전부 이것을 호출. origin 시드/보수 (`ensure*`) 는 main document 전용이라 두 체인에 남김. 게이트
    `canonicalDocumentMigrations.test.ts` 3 — 함수 · import 경로 · **정적 결선** (세 진입점이 단일 체인만 호출, 개별
    migration 직접 호출 0 — 원복 (d) 가 unit 으로 못 잡던 결선 공백을 닫음).
37. **Disclosure 제목 = 헤더 자식의 텍스트 원천 계약** (r17m3 — `renderDisclosure` 가 DisclosureHeader 자식의
    `children || title` 을 직접 읽어 AI 가 헤더에 `title` 만 쓰면 Preview 만 그 값을 보였다; standalone
    `renderDisclosureHeader` 만 위임돼 있었다). `resolveTextSourceText(headerEl.type, headerEl.props) || "Section"`.
    헤더 자식이 없는 legacy 문서의 parent `title` 폴백은 유지 (Skia 는 헤더 없는 Disclosure 에 제목을 안 그린다 —
    round 15 이전부터, 관찰).
    - 게이트 (round 17): shared `propagatedLabel.test.tsx` 9 (helper 경계 1 · 7 renderer × {parent "Changed" 우선 ·
      `""` 비움 · undefined → 자식} · Disclosure 헤더 계약 1) — 종전 FormRenderers/LayoutRenderers 원복 시 6 RED ·
      builder `adr923CompositeLabelBridge` +1 (그룹 `""` → Preview stale 없음 + `resolvePropagatedProps` 자식 `""`) ·
      sweep 정확 집합 20 (r17l1) · `canonicalDocumentMigrations.test.ts` 3.
    - r17l2: breakdown/ADR 의 builder unit 1607 → 1612 정정 (round 16 시점), round 17 은 1616.

## round 18 수리 4건 (Codex 판독 r18m1/r18m2/r18m3 + LOW 1 — 전부 unit 게이트로 확정, 종전 코드 원복 RED 12, `9bd23adf5`)

38. **Preview 의 계약 결과 뒤 기본 글자 제거 (sweep 6 + 레이아웃 2)** (r18m1 — 수리 37 의
    `resolveTextSourceText(...) || "Section"` 이 계약 resolver 의 빈 결과에 truthiness 기본값을 다시 붙여 명시적 빈 값과
    부재를 합쳤다; Skia `buildCatalogShapes` :319 는 계약 결과가 "" 면 text shape 를 안 그리므로 사용자가 비운 헤더가 Skia 는
    비고 Preview 는 "Section" 이었다). grep sweep 으로 같은 형태를 전부 찾았다 — Preview: Disclosure 헤더 (`LayoutRenderers`
    :1687) · 헤더 없는 legacy parent `title || "Section"` (:1688) · standalone `renderDisclosureHeader` (:1743) · Column
    `resolveColumnHeaderLabel` `|| "Column"` (`TableRenderer` :45) · TreeItem `` || `Item ${id}` `` (`CollectionRenderers`
    :103/:207) · Menu `|| "Menu"` (:826) — Skia 는 어느 것도 기본 글자를 그리지 않는다 (Column/TreeItem/Menu 전부
    catalog box+text 계약). 레이아웃: DisclosureHeader `children ?? title ?? "Section"` (`utils.ts` :1454 — 헤더가 없거나 AI 가
    `title` 만 쓴 문서에서 "Section" 폭 측정) · Breadcrumb `children ?? label ?? title` (:1579/:1625 — r15m1 형태의 측정만의
    순서, Skia `breadcrumb_crumb`·Preview 는 계약). 전부 계약 텍스트 그대로 (기본 글자 없음). `FormRenderers` 의
    `|| null` 3 (Label/Description/FieldError) 은 "" → 노드 없음이라 Skia 와 같아 유지.
39. **Disclosure parent `title` 다리** (r18m1 확증 중 — binding 은 `title` 을 D2 편집 surface 로 선언하는데 registry 에
    `title → DisclosureHeader.children` 규칙이 없어 Inspector Title 이 어느 표면에도 닿지 않았고 (factory 헤더가 항상
    있으므로), 헤더 없는 legacy 형태에선 Preview 만 parent title 을 읽었다 — round 16 ColorField label 다리와 같은 부재,
    Card `title → CardHeader.Heading.children` 이 선례). 규칙 추가 (override) + Preview
    `resolvePropagatedText(element.props.title, headerEl)` (engine 경계: parent undefined 만 자식 계약, `""` 는 비움);
    legacy `Heading` 헤더는 registry 대상이 아니라 계약만; 헤더 자식이 없으면 어느 표면도 그리지 않는다 (Preview-only
    parent title 읽기 제거). factory 는 parent `title` 을 쓰지 않는다 (Card 동형 — parent undefined = 헤더 자기 텍스트).
40. **main document 정규화 체인 단일 소유 + 전체 문서 교체 경계 결선** (r18m2 — 수리 36 의 진입점 인벤토리가
    hydration · persist-back · import 에 한정돼 **전체 문서 교체 경계** `applySnapshotDocument` (`snapshotRestore.ts` —
    snapshot 복원 `restoreSnapshot` · undo/redo 재적용 `applySnapshotRestoreHistoryEntry` · 프로젝트 JSON 파일 가져오기
    `BuilderCore.tsx` :1164 `handleImportProject`) 를 빠뜨렸다; 이 경계는 어느 migration 도 안 거쳐 store·IndexedDB 를
    legacy 형태로 교체했다). root cause 는 결선 하나가 아니라 origin 시드 3 + legacy ListBox + 형태 migration 을 같은 순서로
    중첩하는 체인이 두 곳에 복제된 구조 (수리 36 은 형태 migration 만 모았다) — `adapters/canonical/mainDocumentNormalization.ts`
    `normalizeMainDocument` 로 모으고 hydration (`index.ts`) · persist-back (`usePageManager.ts`) · `applySnapshotDocument`
    (JSON round-trip 뒤) 가 전부 이것을 호출. `.setDocument(` 직접 호출자 인벤토리 (18 — 종전 "21" 은 receiver 경계 없는 grep 이
    `getActiveCanonicalResetDocument(` 3건을 섞은 오집계, r19l1 정정): 교체 경계 2 (persist-back `usePageManager.ts` ·
    `applySnapshotDocument`; hydration `index.ts` 는 정규화 경계지만 문서를 반환할 뿐 직접 호출자가 아니다) 외 15 는 이미 열린
    canonical document 의 mutation/undo/frame 결선 (canonicalMutations 6 · pageFrameBinding · frameLayoutCascade · usePageTreeData ·
    pageTitleMutation · canonicalFrameStore · frameActions · canonicalHistoryEvents · editorPresentationCommitAdapter 2) 과
    dev fixture 1 (`pathHeavy117Fixture` — 현행 코드가 생성, 테스트 전용) 이라 진입점이 아니다 (Codex r18 과제 3 판정과 동일).
41. **import adapter 단일 출구 + 분기별 기능 게이트** (r18m3 — 수리 36 의 정적 게이트가 파일 단위 "문자열 1회 이상" 이라
    CompositionDocument 분기만 체인을 뺀 원복 (c) 에서 기능 1 만 RED, 정적은 PASS). 분기마다 체인을 감싸는 구조 자체를
    바꿨다: `convertImportPayload` (변환 3 분기, migration 없음) + `normalizeCompositionImportPayload` 가
    `applyCanonicalDocumentMigrations(convertImportPayload(...))` 단일 출구 — 분기 누락이 구조적으로 불가. 게이트: 분기별
    기능 3 (CompositionDocument legacy ColorField · Pencil document / Pencil node 의 field inline `display` strip — Pencil 노드는
    `children` 이 노드 필드라 Label 텍스트를 못 실어 `migrateFieldInlineLayout` 으로 통과를 잰다) + 정적 (호출 정확히 1회 ·
    `convertImportPayload(` 를 감쌈 · 개별 migration/시드 직접 호출 0).
    - 게이트 (round 18): shared `propagatedLabel.test.tsx` 13 (+4: Disclosure 헤더 `""` · AI `title` 만 → "" · parent title
      우선/`""`/헤더 없음 · Heading 헤더 · standalone 헤더) · `textSourceContract.test.tsx` TreeItem/Column "" · builder
      `adr923DisclosureTitleBridge.test.tsx` 3 (registry · `resolvePropagatedProps` · Preview 렌더) ·
      `snapshotRestoreNormalization.test.ts` 1 (실제 canonical store + mock DB: store·persist 양쪽 parent label, 입력 불변,
      allowShrink/reason) · `canonicalDocumentMigrations.test.ts` 9 (함수 · normalizeMainDocument 멱등 · 분기 3 · 정적 4) ·
      layout `adr923TextLeafContentSignal.test.ts` +2 (DisclosureHeader `{}`/`""`/`{title}` → 0 · Breadcrumb label/title 0).
    - 원복 RED (실측, HEAD 파일로 교체 → 게이트 → 수리본 복구): LayoutRenderers 4 · TableRenderer 1 · snapshotRestore 2
      (기능 + 정적) · importPayloadAdapter 정적 1 (HEAD 의 3-wrapped 형태 = 호출 3회) · propagationRegistry 2 · layout utils 2
      = 12.
    - r18l1: README ADR-923 행의 `|` 8 → 6 (r17 설명 안에 끼어든 `|     |` 제거).

## round 19 수리 5건 (Codex 판독 r19m1 + LOW 1 — 전부 unit 게이트로 확정, 종전 코드 원복 RED 12, `c298cbe6b`)

42. **legacy Preview `renderButton` 의 "Button" 폴백 제거** (r19m1 ① — round 15 가 계약 위임하면서 "자식·아이콘 없고 children
    미지정 → 'Button'" 폴백을 남겼다; 이 경로는 `?canonical=0` (`preview/App.tsx` :87 `USE_CANONICAL_RENDER`) 과 canonical
    resolve/render 실패 안전망 (:230/:1229) 으로 도달하고, Skia `buildCatalogShapes` :324 는 계약 결과 "" 면 text shape 를 만들지
    않는다). 계약 결과가 비면 글자 없음 (`LayoutRenderers.tsx` `renderButton`). canonical 경로의 shared `Button` 컴포넌트에는
    기본 글자가 없다 (grep 0).
43. **레이아웃 Breadcrumbs 집계의 기본 crumb 제거 + crumb 원천을 실제 그려지는 노드로** (r19m1 ② — `utils.ts` 1.2 분기는 직접
    자식만 보고 "Home"/"Products"/"Detail" 을 기본으로 밀어 넣었다. 확증 중 더 큰 사실: items projection 문서 (ADR-912 — factory 가
    만드는 모든 Breadcrumbs) 의 직접 자식은 projection `Rows` 그룹 하나뿐이라 crumb 0 → **항상** 기본 3 crumb 폭 (M 192px) 을
    컨테이너에 주입했다 (`INLINE_BLOCK_TAGS` 소속이라 `enrichWithIntrinsicSize` 가 `childElements=[Rows]` 로 이 분기를 호출).
    body 자식처럼 stretch 되는 자리에선 보이지 않고 fit-content/flex row 자리에서 드러난다). crumb 원천 = `Rows` 아래 projection
    crumb (scene 이 `toItemProjectionRow` 로 정규화한 `children`/`_isLast`) 또는 pre-migration 자식 Breadcrumb element; crumb 0 → 0. 빈 라벨 crumb 도 non-last separator 폭은 남는다 (DOM `.react-aria-Breadcrumb:not(:last-child)::after` · Skia
    `breadcrumb_crumb` 는 텍스트와 무관하게 separator 를 그린다) — 단일 crumb 측정 1.17 의 `if (!label) return 0` (r18m1 sweep 이
    남긴 형태) 도 같이 수정. 종전 `if (label) crumbs.push(label)` 은 빈 crumb 의 separator 를 버렸다.
44. **TagList 측정의 `label || \`Tag ${i + 1}\``제거** (sweep —`resolveTagWrapLayout`만의 기본 글자; DOM`useResolvedCollectionItems`· Skia`appendTagRowProjection`은`toItemProjectionRow` (`getItemLabel`: label/textValue/children/name/title/value → itemKey,
    빈 문자열은 부재 취급) 로 같은 라벨을 그린다). 측정도 같은 정규화 — 빈 label 은 세 표면 모두 itemKey 폭.
45. **IllustratedMessage 텍스트 원천 단일 지점 + "" 줄 접기 (세 표면)** (sweep — Preview 는 두 경로 모두 `||` (legacy
    `renderIllustratedMessage` `LayoutRenderers.tsx` :2071 · canonical `CanonicalNodeRenderer` → shared
    `components/IllustratedMessage.tsx` :67) 라 사용자가 비운 "" 를 "No content"/"There is nothing to display." 로 되살렸고 Skia
    `illustrated_message` 는 `??` 라 부재만 기본 글자였다). 기본 글자 자체는 Skia 에도 있으므로 유지하되 형태를 통일:
    `packages/specs/src/renderers/utils/illustratedMessageMetrics.ts` `resolveIllustratedMessageText` (부재 → 기본 글자, "" → "")
    를 Preview 2 경로 · layout `illustratedmessage` 높이 · Skia primitive 가 공유. "" 는 줄 자체를 접는다 — Preview 는 div 미렌더
    (빈 div 도 flex gap 을 차지해 높이가 갈린다), layout 은 gap + line 차감 (md: 240 → heading "" 201 → 둘 다 "" 168), Skia 는
    shape 미생성 + y 접힘 (description y 205.5 → 166.5).
46. **shared `Menu` 컴포넌트 trigger `label || "Menu"` → `label ?? ""`** (sweep — round 18 수리 38 이 렌더러 `renderMenu` 의
    `|| "Menu"` 를 지웠지만 렌더러가 넘긴 빈 label 을 컴포넌트 (`components/Menu.tsx` :203 — canonical/legacy 두 경로가 모두 통과)
    가 다시 "Menu" 로 되살렸다: 렌더러 층만 본 sweep 의 구멍. Skia 는 기본 글자 없음).
    - 게이트 (round 19): shared `textSourceContract.test.tsx` +2 (legacy Button `{}`/`{label}`/`""` → "" · IllustratedMessage 부재/"")
      · `components/__tests__/illustratedMessageEmptyLine.test.tsx` 2 (canonical 컴포넌트 줄 수 3/1/2) ·
      `menuTriggerLabelEmpty.test.tsx` 3 · specs `illustratedMessage.metric.test.ts` +2 (heading "" → shape 없음 + description y
      166.5 · 부재 → "No content" 169.5) · layout `adr923TextLeafContentSignal.test.ts` +6 (Breadcrumbs projection crumb 합 < 120 ·
      crumb 0 → 0 · 전부 "" → separator×2 · legacy 자식 · TagList 빈 label rowCount 2 · IllustratedMessage 240/201/168) + r18
      Breadcrumb `{label}` 단언을 "" crumb 와 동일 (separator 폭) 로.
    - 원복 RED (실측, HEAD 파일로 교체 → 게이트 → 수리본 복구): LayoutRenderers 2 · skiaPrimitives 1 · layout utils 6 ·
      IllustratedMessage 컴포넌트 1 · Menu 컴포넌트 2 = 12 (`illustratedMessageMetrics.ts` 단독 원복은 새 export 부재로 컴파일 불가
      — 소비자 3 원복이 대신 잰다).
    - r19l1: `.setDocument(` 직접 호출자 18 (교체 경계 2 + mutation/undo/frame 15 + dev fixture 1) — 수리 40 본문 정정. 종전 21 은
      receiver 경계 없는 grep 이 `getActiveCanonicalResetDocument(` 3건을 섞은 오집계.

## round 20 수리 7건 (Codex 판독 r20m1/r20m2 + live sweep 3 — unit 게이트 + Chrome 실 CSS 오라클로 확정, 종전 코드 원복 RED 18, `641763bfb`)

47. **layout 빈 정적 ListBox/GridList 의 sample-data fallback 제거** (r20m1 — `utils.ts` §1.55b/§1.55c 는 `props.items` 가 비면
    3 행 ("Item 1~3", 110px) / 4 카드 (164px) 를 만들었다. DOM 은 `useResolvedCollectionItems` 가 빈 source 를 rows []
    (sourceKind "empty") 로, scene 은 `appendListBoxRowProjection`/`appendGridListRowProjection` 이 rows 0 → projection 없음 —
    layout 만 collection rows SSOT 전환 (ADR-912) 전의 fallback 을 남겼다 (Breadcrumbs 192px phantom · TagList `Tag N` 과 같은
    형태). 빈 집합은 padding + border 뿐 (ListBox md 10). dataBinding 만 있고 행 0 인 소유자 (projection 없음 →
    `_projectedRowsContentHeight` 미주입) 도 같은 경로. ADR-157 게이트 두 파일의 "3/4-item fallback" 단언은 정적 items 명시로
    전환 — 결함을 회귀 게이트로 고정하고 있었다.)
48. **Menu trigger 의 접근성 이름 경로 분리** (r20m2 — `components/Menu.tsx`: r19 수리 46 이 `label || "Menu"` 를 지우자 직접
    사용한 빈 `<MenuButton>` 의 RAC Button 은 이름이 없어졌고, 호출자의 `aria-label`/`aria-labelledby` 는 `{...props}` 로
    `MenuTrigger` (context provider — `BaseMenuTriggerProps` 에 aria 없음) 에 가서 버려졌다. 보이는 글자 = 텍스트 원천 계약
    (그대로), 이름 = 호출자 aria-* → trigger Button 직접, 둘 다 없고 글자도 없으면 i18n `menuTriggerLabel` ("Menu"/"메뉴",
    `i18n/componentStrings.ts`) — 속성이라 화면·Skia 에는 아무것도 없다. 6 분기의 trigger Button 을 단일 element 로.)
49. **`renderMenu` 의 aria-\* 전달** (sweep — factory 는 `"aria-label": "Menu"` 를 쓰지만 (`NavigationComponents.ts` :30)
    `renderMenu` commonProps 가 전달하지 않아 D1 이름 writer 가 죽어 있었다.)
50. **legacy `renderButton` 의 aria-\* 전달** (sweep — r19 수리 42 가 "Button" 폴백을 지운 뒤 계약 결과 "" 인 Button 은 aria-\*
    가 유일한 이름인데 legacy 경로가 떨어뜨렸다; canonical `Button` 컴포넌트는 rest spread.)
51. **catalog `sizes.minWidth` 를 layout 이 소비** (live sweep — Menu trigger 빈 글자 live 에서 DOM 68×10 vs Skia 106×30.
    `deriveSizeConfig` 가 `minWidth` (Button 45/50/68/95/122) 를 버려 `calculateContentWidth` 의 minWidth 분기가 죽어 있었다 —
    글자 있는 버튼도 DOM `min-width` 68 vs layout 54. border-box (생성 CSS `box-sizing: border-box`) 라 content 하한 = minWidth
    − padding − border.)
52. **button 가족 빈 글자 폭** (live sweep — 빈 글자는 `if (text)` 밖 §6 `DEFAULT_WIDTH` 80 (+26 → 106) 로 떨어졌다 (icon-only
    분기도 도달 불가). `BUTTON_TEXT_LEAF_TAGS` (button/submitbutton/fancybutton/menu) 는 글자가 비어도 size 분기 (textWidth 0 →
    minWidth) 로.)
53. **button 가족 빈 글자 높이** (live sweep — 글자 유무와 무관하게 lineHeight 20 줄 상자 (→ 30); Chrome 은 `display:flex`
    button 에 내용이 없으면 padding + border 뿐 (min-height 없음, 10). 빈 글자 + iconName·isPending 없음 → content 0, enrich 가
    button 가족에 한해 0 도 주입 (엔진은 catalog padding 을 모른다). input 은 내용 없이도 줄 상자 — 제외.)
    - 게이트 (round 20): layout `adr923EmptyCollectionHeight.test.ts` 4 (ListBox 부재/[]/dataBinding-only → 10 · GridList → 0 ·
      정적 1 행 · enrich 통합) · `adr923ButtonLikeEmptyText.test.ts` 4 (Button/Menu "" → 68×10 · "OK"/"Menu" → minWidth 68 · 긴
      글자 > 68 · 아이콘/pending 은 줄 상자 · input 제외) · ADR-157 게이트 2 파일 정적 items 전환 · shared
      `menuTriggerLabelEmpty.test.tsx` +5 (기본 aria-label · 호출자 aria-label · aria-labelledby 시 기본 없음 · 글자 있으면
      aria-label 없음 · dataBinding 분기) · `textSourceContract.test.tsx` +2 (renderMenu/renderButton aria 전달) · **Chrome 실 CSS
      오라클** `tests/parity/catalogComponentBox.browser.test.ts` Button 케이스 (내용 없는 `.react-aria-Button` DOM 68×10 =
      pipeline).
    - 원복 RED (실측, HEAD 파일로 교체 → 게이트 → 수리본 복구): layout utils 7 + Chrome Button 1 (dom 68×10 / pipe 106×30) · Menu
      컴포넌트 4 · componentStrings 4 (`Could not find intl message menuTriggerLabel`) · CollectionRenderers 1 · LayoutRenderers
      1 = 18.

## round 21 수리 8건 (Codex 판독 r21m1/r21m2/r21l1 + live sweep 1 — Chrome 실 CSS 오라클 케이스 7 · 단위 15 · binding 다리 2, 종전 코드 원복 RED 4 조합, `1155ae702`)

round 20 은 **발견된** ListBox/GridList/Button 만 닫았다. 같은 형태 (한 표면만 갖는 빈 내용 기본값) 를 collection/container 가족
전체로 대조하니 5 종이 더 열려 있었고 (r21m1), Button 하한은 최종 폭과 **다른 padding 원천**을 쓰고 있었다 (r21m2).

54. **ToggleButtonGroup 빈 구조** (r21m1 — `utils.ts` 경로 C: 자식 ToggleButton 도 legacy `items` 도 없으면 폭은 §6
    `DEFAULT_WIDTH` 80, 높이는 size 의 버튼 높이 30 이었다. DOM 은 `width: fit-content` flex 컨테이너에 padding/border 가 없어
    **0×0** — 버튼이 0 개면 상자도 없다. r20 수리 52 의 Button `DEFAULT_WIDTH` 와 같은 형태.)
55. **Tabs 빈 items + stale TabPanel** (r21m1 — Preview `renderTabs` 는 `items.map(findPanelForItem)` 로만 panel 을 그린다:
    items 가 비면 빈 TabList (Tab 0 → 높이 0) 만 있고 panel 은 하나도 없으며, item 이 지워진 뒤 남은 stale `TabPanel` 자식도
    DOM 에 없다. layout 은 tab bar 29 + 첫 panel (padding 24 + 높이) 을 무조건 더했다. `utils.ts` Tabs 분기 · `implicitStyles`
    tabs/tabpanels/tablist 세 분기를 같은 판정 (`resolveTabsItems` — items SSOT, Tabs 는 dataBinding 경로 없음) 으로.)
56. **TagGroup 슬롯 자식의 가시성 원천** (r21m1 — Preview 는 parent prop 이 비면 Label/Description/FieldError 를 렌더하지 않는다
    (`TagGroup.tsx` `{label && <Label>}`) → DOM 에 요소가 없어 flex gap 도 없다. layout 은 Label 자식 (글자 "" → 높이 0) 을 세어
    gap 4 를 더했다. 자식 element 의 글자가 아니라 **parent prop** 이 조건 — composite parent → 슬롯 자식은 propagation 다리
    (r16m1) 라 판정 원천이 부모다. 높이 합산·Taffy 자식 양쪽에서 제외.)
57. **GridList / Tree 의 `data-empty` 상태 padding** (r21m1 — 수동 CSS 는 빈 상태에 base 와 다른 padding 을 둔다
    (`GridList.css [data-empty] { padding: var(--spacing-lg) }` 16 · `Tree.css` `--spacing-xl` 24). catalog `containerStyles` 는
    base 규칙이라 layout 은 이 상태를 몰랐다 — r20 이 GridList 빈 집합을 0 으로 닫은 것도 base 만 본 결과다. 행 원천 (정적 items ·
    scene 주입 `_projectedRowsContentHeight` · 자식) 이 전부 없을 때만 적용하고, 인라인 padding 은 DOM 에서도 상태 규칙을 이기므로
    (inline > class) 그대로 둔다. Tree 는 전용 분기가 없어 fallback 이 후주입으로만 닿았다 → ListBox 처럼 선주입.)
58. **Table `min-height: 40px` 의 layout 채널** (r21m1 — 수동 `Table.css` 의 `min-height` 를 catalog top-level
    `containerStyles` + fallback allowlist (`minHeight`) 로 공급. `width: 100%` (ADR-151 B22) 와 같은 채널이며 `heightMode: "fixed"`
    는 `implicitStyles` Table 분기가 height 를 덮으므로 auto 에서만 드러난다.)
59. **Table 높이 prop 의 registry 다리** (live — 58 을 넣고 live 를 보니 Preview 는 `heightMode: "auto"` 에서도 402 였다.
    `Table.binding.ts` `accepts` 에 `heightMode`/`height` 선언이 없어 cutover 렌더러 (`CanonicalNodeRenderer`) 가 두 prop 을
    전달하지 못했고, 컴포넌트 기본값 (fixed × 400) 이 고정으로 나왔다 — Inspector·AI writer 가 써도 화면이 안 바뀌는 dead writer
    이면서 layout 만 두 prop 을 읽어 auto 에서 갈렸다 (r18m1 Disclosure `title` 과 같은 형태). 선언 추가로 live 3 모드가 붙었다.)
60. **Button min-content 하한의 원천 통일** (r21m2 — catalog `min-width` 하한은 catalog padding 으로, 최종 폭은 인라인 padding 으로
    계산해 `padding: 20` → layout 84 vs DOM 68, `padding: 0 · minWidth: 0` → 44 vs 2 였다. `parseBoxModel` 의 leaf padding/border
    결정을 `resolveLeafBoxEdges` 로 뽑아 **하한과 최종 폭이 같은 함수**를 쓴다 (인라인 우선 · icon-only 정사각 · Tag remove 보정).
    인라인 `minWidth` 는 엔진이 `box.minWidth` 로 직접 적용하므로 (0 포함 — DOM 도 inline `min-width` 가 클래스를 이긴다) 그때는
    catalog 하한을 겹치지 않는다.)
61. **ADR-157 주석 정정** (r21l1 — `utils.ts` §1.55b/§1.55c 와 게이트 2 파일의 머리말이 제거된 3/4 sample fallback 을 현재 동작으로
    서술했다. r20 은 단언만 정적 items 로 옮기고 설명을 남겼다.)
    - 게이트 (round 21): **Chrome 실 CSS 오라클** `catalogComponentBox` +7 (Button padding:20 · Button padding:0+minWidth:0 ·
      ToggleButtonGroup · Tabs · GridList `data-empty` · Tree `data-empty` · Table auto) — 하니스에 `attrs` (RAC 상태 속성) ·
      `props` (DOM 이 안 그리는 prop) · `style` (양 leg 공통 인라인) 축 추가. 단위 `adr923EmptyStructureBox.test.ts` 15
      (Button 하한 3 · TBG 2 · Tabs 4 · TagGroup 2 · data-empty 4) · shared `collectionBindings.test.ts` +2 (Table binding 다리 —
      accepts 선언 + `toRacProps` 전달) · `resolveContainerStylesFallback.test.ts` table 케이스 갱신.
    - 원복 RED (실측, HEAD 파일로 교체 → 게이트 → 수리본 복구): `utils.ts`+`implicitStyles.ts` 동시 원복 → 단위 10 + Chrome 9 ·
      `implicitStyles.ts` 단독 → 단위 5 + Chrome 6 · catalog Table `minHeight` 단독 → Chrome 1 (dom 40 / pipe 0) ·
      `Table.binding.ts` 단독 → shared 2 = **4 조합**.
    - **Live (Chrome MCP, 2026-09-02)**: 빈 8 조합을 팔레트로 만들어 Skia layout box (`__composition_LAYOUT_DEBUG__`) 와 Preview
      compare DOM 을 같이 잰다 — ToggleButtonGroup 0×0 = 0×0 · Tabs 366×0 = 366×0 (TabList 만, panel 없음) · GridList 366×32 =
      366×32 (`data-empty` padding 16) · Tree 366×50 = 366×50 (padding 24) · Button `padding:20` 68×42 = 68×42 ·
      Button `padding:0 minWidth:0` 2×2 = 2×2 · Table 3 모드 auto 40 = 40 (virtualizer inline `auto`) · fixed 402 = 402 ·
      `height: 240` → 242 = 242. TagGroup 은 빈 label 이 두 표면 모두 gap 없이 붙었다 (Skia 32 · DOM 30 — 잔여 2px 은 TagList chip
      행 metric 축, 아래 관찰).

## round 22 수리 3건 (Codex 판독 r22m1 + 전수 sweep 2 — 전수 동치 게이트 2 · Chrome 실 CSS 오라클 +1 · shared 6, 종전 코드 원복 RED 3 조합, `6c2e1b388`)

round 21 이 Table 에 `heightMode`/`height` binding 다리를 놓았지만 layout 의 기존 리터럴 fallback (300) 을 정렬하지 않았다 (r22m1).
같은 형태 — **prop 부재 기본값을 두 표면이 각자 들고 있는 자리** — 를 catalog 전 타입으로 대조하니 두 축이 더 갈려 있었다.

62. **Table prop 부재 기본 높이** (r22m1 — `toRacProps` 는 props 에 키가 없으면 `accepts[key].default` 를 채워 컴포넌트에 넘기므로
    prop 없는 Table 의 Preview 는 fixed × 400 = 402 다. layout 은 자기 리터럴 300 → 302 였다. factory 는 생성 시 항상
    `height: 400` 을 기록해 팔레트 경로에서는 가려졌고, canonical/import/AI 입력만 prop 부재를 표현한다. shared
    `resolveBindingPropDefault(type, key)` 를 단일 조회로 두고 `implicitStyles` Table 분기가 그것을 읽는다.)
63. **기본 size 표 ↔ catalog `defaultSize`** (sweep — layout 의 `DEFAULT_SIZE_BY_TAG` 는 catalog 와 **별개 표**였고 두 타입에서
    값이 갈렸다: Badge (catalog `sm` · 표 `md`) · Select (catalog `md` · 표 `sm`). 생성 CSS 의 base 규칙은 `defaultSize` 값으로
    emit 되므로 (`.react-aria-Badge { padding: 2px 8px; font-size: text-xs }` = sm) prop 없는 요소의 DOM 은 catalog 기본 size 이고
    layout 만 다른 size config 를 골라 폰트·padding·높이가 어긋났다. catalog 등록 타입은 `resolveComponentRuleByTag(tag).defaultSize`
    가 정본이고 표에는 catalog 에 없는 legacy 별칭 (`type`/`chip`/`submitbutton`/`fancybutton`/`a`) 만 남긴다.)
64. **catalog `sizes[size].borderWidth` 의 L3 미러 누락** (오라클이 연 결함 — 63 을 넣고 Badge 케이스를 실 CSS 로 재니 DOM 20 vs
    layout 18 이었다. 생성기는 size 블록마다 `border-width` 를 emit 하는데 (`CSSGenerator` — `containerStyles.border` shorthand 가
    있을 때만 skip) `resolveContainerStylesFallback` 의 L3 size 축 미러는 height/padding/gap 만 옮겨 border 축이 빠져 있었다.
    top-level `containerStyles` 가 없는 타입은 이 값이 캔버스에 도달할 경로가 아예 없었다 — GridListItem 도 같은 축이다.)
    - 게이트 (round 22): 단위 `adr923DefaultContractParity.test.ts` 6 — **전수 동치 2** (catalog 전 타입에 대해 "prop 부재" 와
      "binding accepts default 명시" / "catalog defaultSize·defaultVariant 명시" 의 layout 4 표면 결과가 같은지) + 갈렸던 3 타입
      고정 4. 새 기본값 축이 생기면 layout 이 따라오지 않는 즉시 RED 다. shared `defaultContractLookup.test.ts` 6 (조회 계약 —
      casing · `toRacProps` 와 같은 값 · 미등록 undefined). Chrome 실 CSS 오라클 `catalogComponentBox` +1 (Badge — prop 없는 기본
      size + border 축). 기대값 갱신 2: `tableFixedHeightBorderImplicitStyles` (302 → 402, DOM 근거 기재) ·
      `resolveContainerStylesFallback` gridlistitem (`borderWidth: 1` — 생성 CSS `border: 1px solid var(--border)` 근거).
    - 원복 RED (실측, HEAD 파일로 교체 → 게이트 → 수리본 복구 · md5 대조): `implicitStyles.ts` → layout 4 + Chrome 3 ·
      `utils.ts` → layout 3 + Chrome 3 · shared helper 2 파일 → shared 6 = **3 조합**.
    - **Live (Chrome MCP, 2026-09-02)**: 팔레트로 Table·Badge 를 만든 뒤 factory 가 기록한 `height`/`heightMode`(Table) ·
      `size`(Badge) 를 store 에서 **제거**해 prop 부재 입력을 재현했다 (팔레트 경로는 factory 가 값을 채워 결함을 가린다).
      Skia layout box ↔ Preview compare DOM: Table 366×402 = 366×402 (수리 전 Skia 302) · Badge 높이 22 = 22 · padding 2/8 ·
      border 1 · font 12px (sm, 수리 전 Skia 30). 콘솔 에러 0, 생성 요소 전부 삭제 (86 복귀).

## round 23 수리 2건 (Codex 판독 r23m1 — 게이트 fixture 축 + 같은 형태 sweep 1, 원복 RED 3, `5678b377c`)

round 22 의 전수 동치 게이트는 **자식 없는 단일 노드**만 재서, 기본값을 자식·데이터가 있을 때만 소비하는 경로를 검사하지
못했다 (r23m1). Codex 가 GridList `selectionMode` 기본값을 `single` → `multiple` 로 바꿔 6 테스트 전부 PASS 하는 것을 보였고,
item 1개를 넣으면 76 vs 98 로 갈린다는 것도 함께 보였다 — 판독 그대로 재현했다 (수리 전 게이트 6 PASS).

65. **게이트 fixture 축 확장** (r23m1 — 타입마다 3 변형 (`bare` / 자식 2개 / `items` 2개) 으로 대조한다. 자식·데이터가 있어야
    실행되는 경로 (`resolveCardSelectionExtra` 의 카드 선택 체크박스 높이 — `utils.ts` §1.55c) 가 이제 게이트 안에 들어온다.
    같은 mutation 실험에서 확장 게이트는 `GridList [items] 76 vs 98` 로 RED 다.)
66. **`defaultSelectionMode` 원천 통일** (sweep — 65 의 축을 따라가니 네 소비처 (layout 카드 높이 · scene 카드 ·
    virtualization stride · Skia Tree 체크박스) 가 기본값을 각자 리터럴로 들고 있었다. cutover 경로의 Preview 는 `toRacProps`
    가 채운 binding default 를 받으므로 렌더러 destructure 기본값에 도달하지 않는다 — GridList 는 binding `single` 인데 세
    자리가 `none` 이었다. 두 값 모두 `checkboxModes: ["multiple"]` 밖이라 시각 결과는 같았지만 기본값 원천이 둘이라 binding
    쪽만 바뀌면 조용히 갈린다 (round 22 Table 높이와 같은 형태). shared `resolveBindingSelectionMode(type, fallback)` 로
    통일 — binding 미선언 타입만 호출자의 컴포넌트 기본값을 쓴다.)
    - 게이트 (round 23): 확장 전수 동치 2 (fixture 3 변형 × catalog 전 타입) · shared `defaultContractLookup` +2
      (`resolveBindingSelectionMode` — binding 선언값 · 미선언 폴백) · 정적 4 (네 소비처에 `defaultSelectionMode:` 문자열
      리터럴 0, `resolveBindingSelectionMode(` 경유). scene/virtualization/Skia 는 layout 과 실행 경로가 달라 값 자체는 shared
      계약이, 결선은 정적 게이트가 맡는다.
    - 원복 RED (실측, HEAD 파일로 교체 → 게이트 → 수리본 복구 · md5 대조): 수리 66 네 파일 → 정적 게이트 **4 fail** ·
      shared helper → `defaultContractLookup` **2 fail** · [확증] round 22 게이트 + GridList binding `single → multiple`
      → **6 PASS (놓침)**, 같은 mutation 에 확장 게이트는 **1 RED** = **3 조합**.
    - **Live (Chrome MCP, 2026-09-02)**: 팔레트 GridList (ref instance, items 3 · `layout: grid` · columns 2) 를 만들고
      `selectionMode` 를 부재 / `multiple` / `single` 로 바꿔 Skia layout box ↔ Preview compare DOM 을 같이 잰다 —
      부재 **164 = 164** (체크박스 0; binding default `single` 을 읽어도 GridList 게이트는 multiple 만) · `multiple`
      **208 = 208** (체크박스 3, 2행 × 22) · `single` **164 = 164**. 콘솔 에러 0 · 생성 요소 삭제.

## round 24 수리 3건 (Codex 판독 r24h1/r24m1/r24m2 — 선언 기본값이 Preview 에 도달하지 않던 축 + 기능 게이트, 원복 RED 3 조합)

round 23 은 "prop 부재 기본값의 단일 원천 = catalog binding accepts default" 를 layout·scene·Skia 에서 잠갔다. 그런데 그
계약의 **근거**(`toRacProps` 가 default 를 채운다)는 **generic cutover 경로에서만** 성립한다 — `CanonicalNodeRenderer` 는
delegating 집합(`renderFacetDeclaration.ts`)에 속한 타입을 `toRacProps` 없이 `rendererMap[type](element, ctx)` 에 위임하므로,
그 타입들의 Preview 값은 **렌더러가 들고 있는 리터럴**이었다. 그래서 선언과 렌더가 조용히 갈릴 수 있었고, 실제로 갈려 있었다.

67. **선언 기본값이 Preview 에 도달하지 않던 축** (r24m1 root cause — GridList·ListBox 는 binding `selectionMode` default 가
    `"single"` 인데 `renderGridList`/`renderListBox` 는 `props.selectionMode || "none"` 으로 렌더한다. RAC 기본도 `none`,
    GridList factory 도 `selectionMode: "none"` 을 기록한다 — **`single` 은 어느 표면에도 없던 값**이었다. Inspector 만
    `resolveEditContract` 가 `contract.default` 를 "현재값" 으로 표시해 패널 Single ↔ DOM none 이 갈렸다. ① 두 binding 의
    선언을 실제 렌더 값(`none`)으로 정정하고, ② delegating 렌더러 5 자리(ListBox 2 · GridList · Tree · TagGroup)가 리터럴
    대신 binding 을 읽게 해 일치를 구조로 만들었다. ③ 같은 축의 `selectionStyle` 도 소비처 4곳이 리터럴 `fallback`
    ("toggle"/"replace") 을 기본값 원천으로 쓰고 있었다 — `resolveBindingSelectionStyle(type)` 로 통일, `fallback` 은
    binding 미선언 타입용 최후 폴백으로만 남는다.)
68. **게이트 축 2개 추가** (r24m1 — ① **활성화 baseline**: 어떤 기본값은 _다른_ prop 이 비기본값일 때만 소비된다
    (GridList `selectionStyle` 은 `selectionMode: multiple` 일 때만 카드 높이에 닿는다). "전부 부재 ↔ 전부 명시" 대조는
    명시 쪽이 모든 기본값을 덮어써서 그 조합을 표현하지 못한다 — 판독이 보인 `selectionStyle` `checkbox → highlight`
    mutation 이 round 23 게이트를 그대로 통과했다. 타입마다 enum non-default option · boolean true · non-default size/variant
    를 하나씩 고정한 baseline 을 더 만들어 그 위에서 다시 대조한다. ② **Preview 표면 전수 동치**: delegating 타입에 대해
    렌더러를 실제로 실행하고 `renderToStaticMarkup` 으로 그린 DOM 을 비교한다 — React element props 비교는 `undefined`
    통과 자리까지 전부 차이로 잡혀 쓸 수 없다.)
69. **정적 게이트 → 기능 게이트** (r24m2 — 정적 4 는 문자열만 본다. `resolveBindingSelectionMode("NotAComponent",
"multiple")` 오결선이 정적 게이트 4 + 기존 scene 153 을 전부 통과하는 것을 재현했다. layout 밖 세 소비처를 각자의
    production 진입점으로 실행하는 게이트를 추가한다 — `buildCanvasSceneGraph`(카드 `_showSelectionCheckbox`) ·
    `resolveVirtualizedCollectionWindows`(행 stride) · `buildSpecNodeData`(TreeItem 렌더 결과). 각 게이트에 **신호가 실제로
    움직이는 대조군**을 함께 둔다 — 없으면 "언제나 false == false" 로 통과하는 빈 게이트가 된다. 정적 4 는 리터럴 재도입
    차단용으로 유지하고 `selectionStyle` 축을 추가했다.)
    - 게이트 (round 24): layout 전수 동치 2 (fixture 3 변형 × 활성화 baseline × catalog 전 타입) · 기능 게이트 3
      (scene · virtualization · Skia, 각 대조군 포함) · Preview 전수 동치 2 (delegating 타입) · 정적 4 (selectionStyle 축
      추가) · shared `defaultContractLookup` +2 (`resolveBindingSelectionStyle`).
    - 원복 RED (실측, 백업 교체 → 게이트 → 복구 · md5 대조): ① 수리 67③ 원복 + GridList binding `selectionStyle`
      `checkbox → highlight` → layout 전수 동치 **4 fail** (`GridList [items] @{"selectionMode":"multiple"} — 부재 h:98 /
명시 h:76` — 판독의 probe 그대로) · ② `canvasSceneNode` 오결선 → 기능 게이트 **1 fail**, 같은 오결선에서 정적 4 +
      scene 153 은 **전부 PASS** (판독 지적 재현) · ③ 렌더러 리터럴 원복 + binding `single` 복원(= round 24 이전 상태) →
      Preview 전수 동치 **1 fail** (`GridList [items] — 명시에만 [data-react-aria-pressable="true" aria-selected="false"
data-selection-mode="single"]`) = **3 조합**.
    - **Live (Chrome MCP, 2026-09-02)**: 팔레트 GridList (ref instance, items 3) 를 만들어 compare mode 에서 Skia layout box
      와 Preview DOM 을 함께 잰다 — `selectionMode` **부재** = Preview 행 `aria-selected` 없음 · 체크박스 없음 / Skia
      **164**, **명시 `none`** = 같은 DOM · **164** (부재 = 기본값 명시), 대조군 **`multiple`** = 행 `aria-selected="false"`
      - 체크박스 · Skia **208** (+44 = 2행 × 22). 부재로 복귀 시 원상. 콘솔 에러 0 · 생성 요소 삭제.
    - **잔여 인벤토리 (신규 게이트가 처음 드러낸 것, 이번 수리 밖)**: Preview 전수 동치에 축 5개 45건이 남아 baseline 으로
      고정돼 있다 (`adr923DefaultContractRenderers.test.ts` `KNOWN_DIFFS` — 새 발산은 즉시 RED, 목록 축소는 수리 결과로만).
      축별 방향이 갈려 한 규칙으로 못 고친다: ① `data-label-align="start"` 미방출 8 타입 ② ListBox `data-variant` — 부재
      `primary`(컴포넌트 기본값 `ListBox.tsx:116`) vs binding `default`, **catalog ListBox variants 는 `default|accent`
      뿐이라 `primary` 는 존재하지 않는 variant** = 렌더 경로가 틀림 ③ Menu `data-variant` — catalog `defaultVariant:
"primary"` 이고 variants 에 `default` 가 없다 = **binding 이 틀림** (②와 방향 반대) ④ ProgressBar/Meter `value`
      binding 50/75 vs 렌더러 0 (막대 채움이 실제로 다름) ⑤ ColorPicker/TableView/Toast 의 `data-variant`/`data-density`/
      `data-timeout` 미방출.

## round 25 수리 3건 (Codex 판독 r25m1/r25m2 + LOW 3 — 기능 게이트 음성 대조 + Preview ratchet 키 무손실, 원복 RED 4 조합)

round 24 의 게이트 두 층이 각각 한 방향만 보고 있었다. 기능 게이트는 **양성 대조(multiple → 체크박스)와 기본값(none)** 만 확인해
"제외돼야 할 유효 enum" 을 보지 않았고, Preview 전수 동치의 baseline 키(`describeMarkupDiff`)는 **속성 차이가 하나라도 있으면
나머지(내용·구조) 를 버려** 그 뒤에 새로 생긴 차이가 같은 키로 흡수됐다. 둘 다 판독의 mutation 으로 재현했다 (scene/virtualization
`checkboxModes` 를 Tree 규칙 `["single","multiple"]` 로 → 13/13 PASS · ProgressBar `valueLabel` 기본값 `"BROKEN"` → 2/2 PASS).

70. **기능 게이트 음성 대조** (r25m1 — GridList.tsx 게이트는 `selectionMode === "multiple"` 만 체크박스라 **`single` 은 none 과
    같아야** 하고, `multiple` 이라도 `selectionStyle: highlight` 면 체크박스가 없다. 세 소비처(scene `_showSelectionCheckbox` ·
    virtualization stride · layout `utils.ts` 카드 extra)에 이 두 음성 대조를 더했다 — layout 은 전수 동치(부재 ↔ 명시)가
    "규칙 자체를 바꾸는" mutation 을 못 보므로(양쪽이 같이 움직인다) 세 모드를 직접 고정하는 기능 게이트를 새로 둔다. Tree
    (Skia `buildSpecNodeData`) 는 반대로 single·multiple 둘 다 체크박스, none 만 제외 — 모드 집합 전체를 고정한다.
    `checkboxModes` 4 자리 전수: scene · virtualization · layout · Skia.)
71. **Preview ratchet 키 무손실** (r25m2 — `describeMarkupDiff` 가 양쪽에서 **서로 다른 속성만 걷어낸 나머지**를 다시 비교하고,
    남는 차이가 있으면 태그 경계까지 넓힌 갈리는 구간(`…<span class="value">[0%]</span>… ↔ 명시 [75%]`)을 키에 붙인다. 그 결과
    **기존 Meter/ProgressBar 6건이 이미 내용 차이를 갖고 있었다**(값 문구 `0%` ↔ `75%`/`50%`) — 종전 키는 그것을 숨기고
    있었다. baseline 6건의 키를 실제 차이로 갱신 (개수 45 그대로, 축소 아님).)
72. **LOW 3** (r25l1 잔여 인벤토리 수치 39 → **45** (Meter·ProgressBar 각 3 fixture 6건 누락 — evidence·reviews·breakdown·README
    4 곳 정정) · r25l2 `resolveBindingSelectionMode` 주석이 r24 이전 사실("Preview 는 toRacProps 경유 · GridList `single`")을
    설명 → delegating 렌더러가 helper 를 직접 읽는 현 구조 + 이력으로 갱신 · r25l3 CHANGELOG "AI 로 만든 문서" — AI
    `create_element` 는 GridList/ListBox 를 `COMPLEX_COMPONENT_TAGS` 경로(`createCompositeElement`)로 만들어 factory 가
    `selectionMode` 를 기록하므로(GridList `"none"` · ListBox `"single"` — r26l1 정정) prop 부재 문서가 아니다. 영향 범위를 "값을 기록하지 않은 문서 (파일로 가져온
    canonical 문서 등)" 로 정정.)
    - 게이트 (round 25): 기능 게이트 3 → **4** (layout `utils.ts` 카드 extra 신설) + 각 음성 대조 2 (single · multiple+highlight),
      Tree Skia 모드 집합 3 · Preview 전수 동치 키 무손실 (속성 + 내용·구조).
    - 원복 RED (실측, 백업 교체 → 게이트 → 복구 · md5 대조): ① scene+virtualization `checkboxModes` → Tree 규칙 → 기능 게이트
      **2 fail** (round 24 게이트는 13/13 PASS 였다) · ② layout `utils.ts` → Tree 규칙 → 신설 layout 게이트 **1 fail** · ③ Skia
      Tree `checkboxModes` → `["single"]` 만 → **1 fail** · ④ ProgressBar `valueLabel` 기본값 `"BROKEN"` → Preview 전수 동치
      **1 fail** (`… ↔ 명시 [BROKEN]` — round 24 키로는 2/2 PASS 였다) = **4 조합**.
    - **Live (Chrome MCP, 2026-09-02)**: 팔레트 GridList (ref instance, items 3) 를 만들어 Skia 선택 박스 크기 배지와 compare
      mode Preview DOM 을 함께 잰다 — **`single`+checkbox = Skia 164 · Preview 행 `aria-selected="false"` + 체크박스 0** (none 과
      같은 높이 — 음성 대조의 live 대응), `multiple`+checkbox = **208** · 체크박스 3 (대조군), `multiple`+highlight = **164** ·
      체크박스 0, `none` = 164 · `aria-selected` 없음. 콘솔 에러 0 · 생성 요소 삭제 · compare mode 원복.
    - **잔여 인벤토리 축별 판정 (round 25 판독, 이번 수리 밖 — 후속 scope)**: ① ListBox `data-variant` — 렌더러 기본 `primary`
      가 틀림, catalog 정본은 `default` (`ListBox.tsx:111-116` · `componentRulesTable.ts:6499-6528`) ② Menu — binding `default`
      가 틀림, catalog·컴포넌트 정본은 `primary` (`Menu.binding.ts:43-49` · `componentRulesTable.ts:6674-6705` · `Menu.tsx:114-120`)
      ③ `labelAlign: start` 8 타입 — DOM 속성만 다르고 CSS 기본 정렬이 이미 start (`TextField.css:207-218`) = 시각 무차이
      ④ ProgressBar/Meter `value` — 시각 token 이 아니라 **content 상태**. binding·factory 는 50/75 로 일치하고 렌더러만 0
      (`DisplayComponents.ts:215-222/303-313` · `LayoutRenderers.tsx:804/860`) → "content 부재의 의미" 를 먼저 정해야 방향이
      나온다 ⑤ ColorPicker/TableView/Toast — display 계약의 load-bearing 사실 아님. 판독 결론: 인벤토리로는 유효, Decision C′
      재개 사유 아님.

## round 26 수리 2건 (Codex 판독 r26m1 + r26l1 — 결선 대상 component 고정, 원복 RED 4 조합)

round 25 의 기능 게이트는 **현재 값의 boolean 동치**만 본다. GridList 규칙(`checkboxModes: ["multiple"]`)에서 none 과 single 은
둘 다 "체크박스 없음" 이라, layout `utils.ts` 의 `defaultSelectionMode` 를 **Tree binding**(`single`) 으로 오결선해도 14/14 +
layout 460 이 전부 통과했다 (판독 실험, 재현). 정적 게이트는 helper 호출 여부만 보고 component 인자를 보지 않았다. 값이 우연히
같은 결과로 접히면 **어느 binding 을 읽는지는 출력에 안 나온다** — 그래서 binding 자체를 움직인다.

73. **결선 대상 component 고정** (r26m1 — ① **binding mutation 게이트**: 테스트 안에서 `getPrimitiveBinding(type).props.accepts
[key].default` 를 바꾸고(`finally` 복구) production 진입점을 다시 실행한다. GridList binding `selectionMode` → `multiple`
    이면 layout · scene · virtualization 의 "부재" 결과가 `multiple` 명시와 같아져야 하고(따라간다), Tree binding 을 `multiple`
    로 바꿔도 세 소비처는 움직이지 않아야 한다(다른 원천은 안 읽는다). Tree(Skia `buildSpecNodeData`) 는 반대 방향 — Tree
    `none` 이면 checkbox 스타일에서도 체크박스가 사라지고, GridList 를 바꿔도 그대로. 계약의 정의 "부재 = **그 타입의**
    binding 기본값" 을 값 우연과 무관하게 확인한다. mutation 이 실제로 신호를 움직이는 대조군 + 복구 확인 포함. ② 정적
    게이트는 파일마다 component 리터럴을 고정(`resolveBindingSelectionMode("GridList",` / `("Tree",`) 하고 다른 component 로
    결선된 호출이 남아 있으면 RED — 리터럴 재도입·오결선 재도입 차단용.)
74. **r26l1** (evidence 가 "GridList/ListBox factory 가 `selectionMode: "none"` 을 기록" 이라 썼는데 ListBox factory 는
    `"single"` (`SelectionComponents.ts:255`) — "값을 기록한다" 는 공통 사실을 하나의 값으로 합쳐 쓴 오류. 정정. CHANGELOG 의
    "값이 기록되어 영향이 없다" 결론은 그대로.)
    - 게이트 (round 26): binding mutation 3 (GridList 소비처 3 따라감 · Tree mutation 에 GridList 소비처 3 불변 + style 축 ·
      Skia Tree 는 Tree 만 따라감) · 정적 4 를 component 고정으로 강화. layout 460 → **463**.
    - 원복 RED (실측, 백업 교체 → 게이트 → 복구 · md5 대조): ① layout `utils.ts` → `("Tree", "none")` → **3 fail** (정적 1 +
      binding mutation 2; round 25 게이트는 14/14 PASS 였다) · ② scene → Tree → **3 fail** · ③ virtualization → Tree → **3 fail**
      · ④ Skia Tree → `("GridList", "single")` → **3 fail** (정적 1 + 기존 Skia 게이트 1 + mutation 1) = **4 조합**.
    - **Live (Chrome MCP, 2026-09-02)**: 프로덕션 코드 변경 0 (테스트·문서만). 팔레트 GridList(items 3) 로 계약의 live 대응만
      재확인 — 명시 `none` = Skia **164**, `selectionMode` 키를 문서에서 제거한 **부재** = **164** (부재 = GridList binding
      기본값). 콘솔 에러 0 · 생성 요소 삭제.
    - 판독 판정 (round 26): 수리 71 VERIFIED — 속성 값 변경(50 → 51) · 기존 속성 차이 뒤의 구조 추가(ProgressBar · ColorPicker)
      모두 RED, 45건 키 갱신은 "숨겨진 값 문구 차이를 드러낸 것". `KNOWN_DIFFS` 축별 처리를 후속 범위로 두는 판단: 타당.

## round 27 수리 1건 (Codex 판독 r27m1 — style 축의 source identity, 원복 RED 4 조합)

round 26 의 binding mutation 게이트는 `selectionMode` 에만 양성 mutation 을 뒀다. `selectionStyle` 은 Tree(다른 값 `highlight`)
음성 대조뿐이라, `resolveBindingSelectionStyle` 이 GridList 대신 **같은 현재값(`checkbox`)을 가진 CardView binding** 을 읽어도
focused 17/17 · layout 463 · shared 965 가 전부 통과했다 (판독 실험, 재현). 값이 같은 sibling 은 boolean 동치로도 다른 값
sibling 의 음성 대조로도 못 가른다. 또 round 26 의 Tree-style 음성 대조는 mutation **안**의 두 결과를 서로 비교해 둘 다 같이
움직여 항상 통과하는 형태였다 (판독 지적).

75. **style 축 source identity** (r27m1 — ① parity 게이트 +2: GridList `selectionStyle` → `highlight` 면 `selectionMode:
multiple` baseline 의 세 소비처(layout · scene · virtualization)가 highlight 명시와 같아진다(양성) + 같은 값 CardView 와
    다른 값 Tree 를 움직여도 불변(음성). Skia Tree 는 Tree `selectionStyle` → `checkbox` 면 부재가 checkbox 명시와 같아지고,
    GridList/CardView 를 움직여도 불변. **비교 기준은 전부 mutation 밖에서** 잡는다 — 종전 vacuous 비교를 이 형태로 교체.
    ② shared `defaultContractLookup` +2: helper 수준 source identity — `resolveBindingSelectionStyle("GridList")` 는 GridList
    mutation 만 따라가고 같은 값 CardView 에 무관, `resolveBindingSelectionMode("GridList")` 는 같은 값 ListBox 에 무관.)
    - 게이트 (round 27): parity 19 (+2) · shared `defaultContractLookup` 12 (+2). layout 463 → **465** · shared 965 → **967**.
    - 원복 RED (실측, 백업 교체 → 게이트 → 복구 · md5 대조): ① helper `resolveBindingSelectionStyle` 이 GridList 일 때 CardView
      를 읽도록 → parity **1 fail** + shared **1 fail** (round 26 게이트는 전부 PASS 였다) · ② `utils.ts`
      `resolveBindingSelectionStyle("CardView")` → 정적 1 + mutation 1 = **2 fail** · ③ helper `resolveBindingSelectionMode` 가
      GridList 일 때 ListBox 를 읽도록 → parity 1 + shared 1 = **2 fail** · ④ Skia `resolveBindingSelectionStyle("GridList")` →
      정적 1 + 기존 Skia 게이트 1 + style mutation 1 = **3 fail** = **4 조합**.
    - **Live (Chrome MCP, 2026-09-02)**: 프로덕션 코드 변경 0 (테스트만). 팔레트 GridList(items 3) 로 style 축의 live 대응만
      재확인 — `selectionMode: multiple` + style 부재 = Skia **208** · 체크박스 (= GridList binding `checkbox`), `highlight`
      명시 = **164**. 콘솔 에러 0 · 생성 요소 삭제.
    - 판독 판정 (round 27): 수리 74 VERIFIED · singleton mutation 누출 0 (try/finally · memoization 없음 · 동일 worker 반복
      seed 27/2702 PASS) · `fallback` 반전 mutation 은 선언된 binding 값이 항상 우선하고 선언 자체가 shared 테스트로 고정돼
      현 계약에서 동치 — 이슈 아님.

## round 28 판독 (Codex — 수리 75 VERIFIED · LOW 1 문서, 코드 변경 0)

- 판정: selection mode/style × 소비처 4 × helper 2 의 source identity 누락 0 · mutation 누출 0 (try/finally · 동기 callback · builder/shared 독립 실행 단위). 재실행 전부 일치, 원복 RED (a) 1+1 · (b) 2 · (c) 1+1 · (d) 3 기대 일치.
- 다른 기본값 축은 **후속 mutation-hardening 범위** — Table `height=400` 은 같은 키·값 sibling 이 없고 직접 조회 (`Table.binding.ts:64` · `implicitStyles.ts:1279`); Badge/Select 는 component 별 리터럴 소비처가 아니라 동적 tag 단일 경로 (`utils.ts:1462`), helper 의 전 타입 객체 identity 는 `defaultContractLookup.test.ts:140` 이 고정. Badge→Code 같은 값 조건 분기 진단은 19/19 PASS 였으나 현 코드에 그 분기가 없어 남은 load-bearing 사실이 아님.
- r28l1 LOW: README 923 행 집계 `수리 61` (r21 시점) 이 r22~r27 이력 추가 뒤에도 그대로 → **75** 로 정정.
- 결론: **Phase 3 닫힘 · Phase 4 진입 가** (Decision C′ 재개 조건 충족하지 않음). Phase 4 착수는 사용자 승인 후.

## 프로덕션 영향 (round 9 정정 — 종전 "clip UI 미노출·실효 0" 공시는 오류, r9m1)

- **실효 (프로덕션 어댑터 경로가 그대로 타는 수리)**: 수리 5 (wrap min-content, r8l2
  게이트) · **수리 9** (Style Panel Overflow = Clip 이 `styleOptions.ts` 로 직접 노출되고
  shorthand `overflow` 는 `utils.ts` 가 overflowX/Y 로 분배 — 종전 clip flex item 은
  min-content 바닥을 잃어 Chrome 보다 좁게 그려졌다; r9h1 pipeline 게이트) · **수리
  10~12** (block 컨테이너의 block 자식 margin — padding-bottom 부모의 마지막 margin,
  빈 block 의 margin 관통, flex 자식의 자기 margin collapse, block 뒤 인라인 줄의 margin:
  모두 운반 union 안 어휘라 프로덕션 활성. full parity 975 회귀 0).
- **휴면 (inline-\* 운반 전까지)**: 수리 1~~4·6~~8 의 line item 경로 본체 — 현 프로덕션
  display 운반 union 은 inline-\* 를 보내지 않아 Phase 5 cutover 가 활성화. 단 수리 8 의
  BFC 쪽(clip 부모의 margin 관통)과 수리 12 의 line box 규칙은 block 경로라 활성.
- AI styles (`services/ai/styleAdapter.ts`) 도 열린 객체라 overflow:clip 이 들어올 수 있다
  — 같은 경로.
- **round 10** (Codex r10 과제 8 — generic block > block 의 `buildTreeBatch` payload 가 양쪽
  block 유지로 캡처됨): 수리 14~~18 전부 block 경로 → 프로덕션 활성. 수리 14 의 TS 쪽은 block
  부모의 텍스트 leaf 전부에 `leafBaseline` 을 공급한다 (Codex r11 과제 3 payload 캡처: height 0 ·
  width 명시 · auto 세 변형 모두 `leafBaseline: 13.4765625`, JSON 4회 · binary 0회).
  ~~baseline 정렬 문맥에서 종전 bottom 폴백이 첫 줄 baseline 으로 바뀐다~~ → **r11m2 정정**: 현
  프로덕션은 이 스칼라를 baseline 정렬에 **소비하지 않는다** — inline-block 은 어댑터가 block
  leaf 로, block 부모 + inline 자식은 flex row 시뮬레이션 (`taffyDisplayAdapter.ts` :514/:526,
  `alignItems: center`) 으로 바꾸고 `parse_align_items` 는 `baseline` 을 stretch(0) 로 떨어뜨린다
  (`tree.rs`). 즉시 가시 변화 0 (parity 990 회귀 0 이 그 증거) — baseline 방향 위치 변화는 Phase 5
  (inline-block 직결) + S8 (`align-items: baseline` 파서) 이후 조건. 비용: nonempty 텍스트 leaf 당
  `measureFontMetrics` 1회 — 폰트 준비 후 Map 캐시 O(1) (256 키), 준비 전 미캐시 (`textMeasure.ts`).
- **round 11**: 수리 19 (TS 신호 — 공백만 있는 Text 의 leafBaseline·폭 스칼라 미공급) · 20·21
  (block 경로 `can_collapse_bottom` / strut 미전파) 전부 프로덕션 활성 — 신규 10 케이스 전부 어댑터
  대조군도 정합 (full parity 1009 회귀 0).
- **round 12**: 수리 22·23 (TS 신호 — 상속 white-space · children 정규화) · 24~~26 (block/root/grid
  clamp) 전부 프로덕션 활성 — 신규 7 케이스 양쪽 정합 (full parity 1023 회귀 0). 관찰: 프로덕션
  Text 는 width 미지정 시 catalog generated base `width: 100%` 를 받는다 — plain-DOM 대조군 (catalog
  CSS 미적용) 은 이 축을 모르므로 pipelineLeg 게이트는 `width: "auto"` 명시로 스칼라 경로만 격리
  (Preview 도 같은 generated CSS 를 받아 Builder↔Preview 는 대칭).

## 검증 (2026-09-01, round 9 + 후속 ① 수리 후)

- cargo **363** (+11: block 4 · tree 7 — adr923 filter 35/35) · golden 15 · layout_trace
  10 · tree_golden 11 · doc 1 · clippy 신규 0 (경고 7 = 기존 위치 tree.rs:2035/6525-6528/6818-6819).
- wasm 재빌드 → 차등 **44/44** (42 케이스 + 게이트 2; round 9 신규 12 중 RED 10 · 후속 ① 3 중
  RED 1 → GREEN) · full **parity 978 pass** (실패 = 기존 catalogComponentBox
  GridListItem/Tooltip 2 건만 · 1 expected fail · 2 skipped) · layout unit 49 files/401 ·
  type-check 0.
- **Live Exercise (Phase 3 완료 시)**: 실 빌더(localhost:5173, TEST 프로젝트) Chrome MCP
  로드 — Skia 캔버스 3 페이지 정상 렌더, Page 2 wrap 카드(Desert Sunset·Hiking Trail
  한 줄 + Mountain Sunrise 줄바꿈, 자연폭 유지·collapse 0) 확대 확인, 콘솔 에러 0.
- **Live Exercise (round 8 수리 후, `efb56a888`)**: 같은 빌더·TEST 프로젝트 재로드 —
  Skia 전 페이지 정상 렌더, Page 2 wrap 카드 배치 불변 확대 확인, 콘솔 에러 0.

- **Live Exercise (round 9 수리 후)**: Live: 실 빌더(localhost:5173) TEST 프로젝트 재로드 — Skia 전 페이지 정상 렌더, Page 2 wrap 카드 배치 불변(Desert Sunset·Hiking Trail 한 줄 + Mountain Sunrise 줄바꿈) 확대 확인, Home Button/avatar 스택 정상, 콘솔 에러 0 (로드 시점 포함). r9h1 프로덕션 경로(패널 shorthand overflow:clip → 어댑터 → wasm)는 pipelineLeg 게이트가 고정.
- **Live Exercise (후속 ① 수리 후)**: 실 빌더 TEST 프로젝트 재로드 — Skia 전 페이지 정상, Page 2 wrap 카드 불변, 콘솔 에러 0.
- **round 10 수리 후**: cargo **368** (+5: tree 4 · block 1 — adr923 filter 40/40) · golden 15
  (block 입력 21 필드, 기대값 무변경) · layout_trace 10 · tree_golden 11 · doc 1 · clippy 신규 0
  (경고 7 기존). wasm 재빌드 → 차등 **56/56** (51 케이스 + 게이트 5; 신규 9 중 RED 8 · 게이트
  3 중 RED 2 → GREEN) · 대조군 발산 18 / 정합 33 · full **parity 990 pass** (실패 = 기존
  catalogComponentBox 2 · 1 expected fail · 2 skipped) · layout unit 49 files/401 · type-check 0.
  r10l1 정정: 원복 (c) 코드 2 발행 제거의 RED 는 4건이 아니라 5건 (self-collapsing-wrapper-of-
  empty 도 leaf 코드 2 에 의존) — round 10 이후 코드 2 원천은 플래그 하나라 원복 단위도 하나.
- **Live Exercise (round 10 수리 후)**: 실 빌더(localhost:5173) TEST 프로젝트 재로드 — Skia 전
  페이지 정상, Page 2 wrap 카드 불변 (Desert Sunset·Hiking Trail 한 줄 + Mountain Sunrise
  줄바꿈), Components 페이지 텍스트 leaf (메뉴 항목·폼 label·카드 캡션 — leafBaseline 공급
  확대 대상) 배치 불변 확대 확인, 콘솔 에러 0.
- **round 11 수리 후**: cargo **369** (+1: tree — adr923 filter 41/41) · golden 15 · layout_trace
  10 · tree_golden 11 · doc 1 · clippy 신규 0 (경고 7 기존 — 행 이동 tree.rs:2067/6616-6619/
  6909-6910). wasm 재빌드 → 차등 **75/75** (61 케이스 + 게이트 14; 신규 10 중 RED 3 (height:50 ·
  height:0 · height:0+min-height) + 1차 수리안 (`min_h > 0` 일괄 포함) 에서 Chrome 바인딩 경계 3
  RED (미바인딩 min-height:10 · 부분 바인딩 30 · max-height:10) → Blink 모델로 GREEN · 게이트 9 중
  RED 4 → GREEN) · 대조군 발산 18 / 정합 43 · full **parity 1009 pass** (실패 = 기존
  catalogComponentBox GridListItem/Tooltip 2 · 1 expected fail · 2 skipped) · layout unit 49
  files/401 · type-check 0. r11l1 정정 (round 10 원복 실측, Codex r11): (b) 경계 값 축약은
  hoisted 1건만 RED — self-collapsing-wrapper 는 wrapper own + through 가 값으로도 같은 극값 ·
  (g) `.max(0)` 제거는 지정 2 + negative-flow-bottom-not-self-collapsing (root −5) = 3건. 예상
  집합은 실행 전 기재였다 — 이후 원복 RED 는 실측 후 기록.
- **Live Exercise (round 11 수리 후)**: 실 빌더(localhost:5173) TEST 프로젝트 재로드 (Chrome MCP) — Skia 전 페이지 정상, Page 2 wrap 카드 불변 (Desert Sunset·Hiking Trail 한 줄 + Mountain Sunrise 줄바꿈), Components 페이지 텍스트 leaf (메뉴 항목·폼 label·리스트 행 — 수리 19 신호 함수 경유) 배치 불변 확대 확인, 콘솔 에러 0 (로드 시점 포함).
- **round 12 수리 후**: cargo **370** (+1: tree — adr923 filter 42/42) · golden 15 · layout_trace
  10 · tree_golden 11 · doc 1 · clippy 신규 0 (경고 7 기존). wasm 재빌드 → 차등 **87/87** (68 케이스
  - 게이트 19; 신규 7 중 RED 4 (#62 35/40 · #64 10/30 · #65 · #66) + #68 은 Codex 실측 RED (root 0 /
    Chrome 10) + 게이트 5 중 RED 3 (상속 pre · break-spaces · pre-line `"\n"`) · r12l1 게이트는 raw
    측정 원복에서 RED (t.w 5) → GREEN) · 대조군 발산 18 / 정합 50 · full **parity 1023 pass** (기존
    catalogComponentBox 2 · 1 expected fail · 2 skipped) · layout unit 50 files/408 (+7 unit:
    `adr923TextLeafContentSignal`) · type-check 0.
- **Live Exercise (round 12 수리 후)**: 실 빌더(localhost:5173) TEST 프로젝트 재로드 (Chrome MCP) —
  Skia 전 페이지 정상, Page 2 wrap 카드 불변 (Desert Sunset·Hiking Trail 한 줄 + Mountain Sunrise
  줄바꿈), Components 텍스트 leaf (수리 22·23 경유 — 상속 white-space · children 정규화) 배치 불변,
  콘솔 에러 0 (로드 시점 포함).

- **round 13 수리 후**: cargo **371** (+1: tree — adr923 filter 43/43) · golden 15 · layout_trace
  10 · tree_golden 11 · doc 1 · clippy 신규 0 (경고 7 기존). wasm 재빌드 → 차등 **93/93** (69 케이스
  - 게이트 24; 신규 케이스 #69 첫 실행 RED (c.w 300 / 250) + 게이트 5 중 RED 3 (inherit · unset ·
    label 장문 box.x 211 / 10.2), 대조군 2 GREEN) · 대조군 발산 18 / 정합 51 · full **parity 1029 pass**
    (기존 catalogComponentBox 2 · 1 expected fail · 2 skipped) · layout unit 50 files/411 (+3 unit:
    `resolveTextLeafWhiteSpace` · children-only 원천) · Skia/utils/overlay unit 519 · shared 920 ·
    type-check 0.

- **Live Exercise (round 13 수리 후)**: 실 빌더(localhost:5173) TEST 프로젝트 재로드 (Chrome MCP) —
  Skia 전 페이지 (25 페이지 Auto 배치) 정상, Page 2 카드 텍스트 leaf (Card Title · description —
  수리 28 의 children-only 원천 + Skia `maskNonContentTextProps` 경유) 렌더 불변, ProgressBar 의
  `label` content ("Progress" + 값 — label-content binding 은 차단 대상 아님) 그대로, wrap 카드 불변
  (Desert Sunset·Hiking Trail 한 줄 + Mountain Sunrise 줄바꿈), 콘솔 에러 0 (로드 시점 포함).

- **round 14 수리 후**: Rust 변경 0 (cargo 371 불변) · 차등 **96/96** (69 케이스 + 게이트 27; 신규
  게이트 3 전부 첫 실행 RED) · 대조군 발산 18 / 정합 51 · full **parity 1032** (기존 catalogComponentBox
  2 · 1 expected fail · 2 skipped) · layout unit 50 files/412 · Skia/utils/overlay/preview unit 658 ·
  specs 858 (+5 `buildCatalogShapes.textSource`) · shared 920 · type-check 0.

- **Live Exercise (round 14 수리 후)**: 실 빌더(localhost:5173) TEST 프로젝트 재로드 (Chrome MCP, 25
  페이지 Auto 배치) — Page 2 카드 텍스트 leaf (Card Title · description — 수리 31 의 children → text
  원천 + Skia `label || children || text` 경유) 렌더 불변, ProgressBar `label` content 그대로, wrap 카드
  불변 (Desert Sunset·Hiking Trail 한 줄 + Mountain Sunrise 줄바꿈), 콘솔 에러 0 (로드 시점 포함).

- **round 15 수리 후**: Rust 변경 0 (cargo 371 불변) · 차등 **97/97** (69 케이스 + 게이트 28; 신규 pin 1
  첫 실행 PASS) · 대조군 발산 18 / 정합 51 · full **parity 1033** (기존 catalogComponentBox 2 · 1 expected
  fail · 2 skipped) · layout unit 50 files/415 (+3) · Skia/utils/overlay/preview unit 662 (+4) · specs 873
  (+15: `textSource` 13 · `buildCatalogShapes.textSource` +2) · shared 926 (+6 `textSourceContract`) ·
  type-check 0. 원복 RED (실측): Skia 종전 순서 6 · 레이아웃 종전 순서 1 · Preview Column 종전 순서 1.

- **Live Exercise (round 15 수리 후)**: 실 빌더(localhost:5173) TEST 프로젝트 재로드 (Chrome MCP) —
  Components 페이지 Skia: ListBox 템플릿 `{label}`/`{description}` · collection 항목 (Inbox/Starred/
  Archive — label 우선 군) · 카드 (Documents · 12 files) · Menu 항목 행 (`{label}`/`{shortcut}`/
  `{description}`) · Tabs (Action 1~3) · 폼 Label (Name/Email) + Input placeholder (field leaf
  `placeholder` 군) · Button (Cancel/Save) · Tooltip `{label}` 전부 렌더 불변, Home 페이지 Button ×10
  불변, 콘솔 에러 0 (재로드 시점 포함).

- **round 16 수리 후**: Rust 변경 0 (TS 만 — cargo 미재실행, Codex round 16 재실행 371) · 차등 **97/97** · full
  **parity 1033** (기존 catalogComponentBox 2 · 1 expected fail · 2 skipped) · layout unit 50 files/415 · builder unit
  (utils/factories/adapters/preview/skia/utils/overlay/panels) 183 files/1612 (+13: 다리 5 · migration 3 · overlay 5) · shared 926 ·
  type-check 0. 수리 전 RED (실측): sweep 1 FAIL (ColorField·CheckboxGroup·RadioGroup 규칙 부재 나열) + ColorField 3표면
  2 FAIL (Preview 는 "Changed Color", 다리 없음 / factory parent label 없음).

- **Live Exercise (round 16 수리 후)**: 실 빌더(localhost:5173) TEST 프로젝트 Home (Chrome MCP) — 팔레트에서 ColorField
  추가 → Skia "Color" + Inspector Label "Color" (parent label) → Inspector Label 에 "Brand Color" 입력 → Skia 캔버스
  "Brand Color" (propagation → Label 자식) · Preview iframe (`preview.html`) `.react-aria-ColorField label` = "Brand Color"
  (DOM) — 두 표면 동일, 콘솔 에러 0. 확인 후 요소 삭제. (publish 탭은 ColorField 를 안 그린다 — publish 범위 밖 관찰 유지.) 수리 34: Components 페이지 Save Button 더블클릭 (그룹 → Button → 편집) → 편집창 초기값 "Save" (계약 = children) → "Go!" 입력 · 바깥 클릭 확정 → Skia "Go!" · undo 로 복원.

- **round 17 수리 후**: Rust 변경 0 (TS 만) · 차등 **97/97** · full **parity 1033** (기존 catalogComponentBox 2 · 1
  expected fail · 2 skipped) · layout unit 50 files/415 · builder unit 9 영역 184 files/1616 (+4: migration 체인 3 · 그룹
  `""` 1) + resolvers/canonical 7 files/96 · shared 98 files/935 (+9 `propagatedLabel`) · type-check 0. 원복 RED (실측):
  종전 FormRenderers + LayoutRenderers 로 `propagatedLabel.test` → 6 FAIL (CheckboxGroup · RadioGroup · SearchField ·
  ProgressBar · Meter · Disclosure).

- **Live Exercise (round 17 수리 후)**: 실 빌더(localhost:5173) TEST 프로젝트 Home (Chrome MCP) — 팔레트에서
  CheckboxGroup 추가 → Inspector Label "Checkbox Group" 을 비움 (Delete + Enter) → Skia 캔버스 그룹 라벨 사라짐 (84×52,
  Option 1/2 만) · compare mode Preview iframe (`preview.html`) `.react-aria-CheckboxGroup` textContent = "Option 1Option 2"
  (stale "Checkbox Group" 없음) — 두 표면 동일. undo 로 복원 후 요소 제거.

- **round 18 수리 후**: Rust 변경 0 (TS 만) · 차등 **97/97** · full **parity 1033** (기존 catalogComponentBox 2 · 1
  expected fail · 2 skipped) · layout unit 50 files/417 (+2) · builder unit 10 영역 (9 영역 + resolvers/canonical +
  stores/history) 207 files/1810 · shared 98 files/939 (+4) · type-check 0. 원복 RED (실측) 12 — 수리 38~41 참조.

- **Live Exercise (round 18 수리 후)**: 실 빌더(localhost:5173) TEST 프로젝트 Home (Chrome MCP) — 팔레트에서 Disclosure
  추가 (Skia "Section Title", Inspector Title 빈 칸 = parent undefined) → Inspector Title "Live Title" 입력 → Skia 캔버스 헤더
  "Live Title" (registry 다리 → DisclosureHeader.children) → Title 비움 (cmd+a · Backspace · Enter) → Skia 헤더 chevron 만
  (366×56, "Section" 없음) · compare mode Preview iframe (`preview.html`) `.react-aria-Disclosure` heading/button
  textContent = "" · 전체 textContent = "Section content goes here." (stale "Section Title"·기본 "Section" 없음) — 두 표면
  동일, 콘솔 에러 0. 확인 후 요소 삭제. snapshot 복원/프로젝트 파일 가져오기 경계는 실제 canonical store 를 쓰는 unit
  게이트 (DB 만 mock) 로 확인 — live 는 legacy 형태 snapshot 을 만들 수단이 없다.

- **round 19 수리 후**: Rust 변경 0 (TS 만) · 차등 **97/97** · full **parity 1033** (기존 catalogComponentBox 2 · 1
  expected fail · 2 skipped) · layout unit 50 files/423 (+6) · builder unit 10 영역 207 files/1810 · shared 100 files/946 (+7) ·
  specs 75 files/875 (+2) · type-check 0. 원복 RED (실측) 12 — 수리 42~46 참조.

- **round 20 수리 후**: Rust 변경 0 (TS 만) · 차등 **97/97** · full **parity 1034** (+1 Button 실 CSS; 기존 catalogComponentBox
  2 · 1 expected fail · 2 skipped) · layout unit 52 files/431 (+8) · builder unit 10 영역 207 files/1810 · shared 100 files/953
  (+7) · specs 75 files/875 · type-check 0. 원복 RED (실측) 18 — 수리 47~53 참조.

- **round 21 수리 후**: Rust 변경 0 (TS 만) · 차등 **97/97** · full **parity 1041** (+7 빈 구조 상자 실 CSS; 기존
  catalogComponentBox 2 · 1 expected fail · 2 skipped) · layout unit 53 files/**446** (+15) · builder unit 10 영역 207
  files/1810 · shared 100 files/**955** (+2) · specs 75 files/875 · type-check 0. 원복 RED (실측) 4 조합 — 수리 54~61 참조.
- **round 22 수리 후**: Rust 변경 0 (TS 만) · 차등 **97/97** · full **parity 1042** (+1 Badge 실 CSS; 기존
  catalogComponentBox GridListItem/Tooltip 2 · 1 expected fail · 2 skipped) · layout unit 54 files/**452** (+6) · builder unit
  10 영역 207 files/1810 · shared 101 files/**961** (+6) · specs 75 files/875 · type-check 0 (`TYPE-CHECK PASS`).
  원복 RED (실측) 3 조합 — 수리 62~64 참조.
- **round 23 수리 후**: Rust 변경 0 (TS 만) · 차등 **97/97** · full **parity 1042** (기존 catalogComponentBox
  GridListItem/Tooltip 2 · 1 expected fail · 2 skipped) · layout unit 54 files/**456** (+4) · builder unit 10 영역 207
  files/**1812** (+2 — 본 수리 밖, 같은 시각 다른 세션이 커밋한 canvas readiness 테스트) · shared 101 files/**963** (+2) ·
  specs 75 files/875 · type-check 0 (`TYPE-CHECK PASS`). 원복 RED (실측) 3 조합 — 수리 65~66 참조.

- **Live Exercise (round 19 수리 후)**: 실 빌더(localhost:5173) TEST 프로젝트 Home (Chrome MCP) — ① 팔레트에서 Breadcrumbs 추가
  (366×24, body stretch) → Styles Width size "fit" → 190×24, 선택 상자가 "Home › Category › Page" 끝에 맞음 (실제 crumb 폭; 종전
  phantom "Home › Products › Detail" 192 와 2px 차라 live 만으로는 판별력이 낮다 — 판별은 unit RED: crumb 0 → 192 phantom · A/B/C
  라벨 < 120). ② IllustratedMessage 추가 (366×240) → Inspector Heading 비움 → Skia "No content" 240 유지 · compare mode Preview
  iframe `[role=status]` textContent "○No contentTry another search term." · children 3 · 366×240 — 두 표면 동일. **Inspector 는
  빈 값을 `undefined` 로 쓴다** (`CatalogInspectorFields.tsx` :143 `v === "" ? undefined : v`) 라 부재 → 기본 글자 경로이고, "" 는
  AI `update_element`/import 같은 열린 writer 경로 — unit 3 표면 게이트로 확정 (Preview div 1 · layout 201/168 · Skia shape 없음).
  콘솔 에러 0. 확인 후 두 요소 삭제. legacy Button 경로 (`?canonical=0`) 는 unit 게이트.

- **Live Exercise (round 20 수리 후, 2026-09-02)**: 실 빌더(localhost:5173) TEST 프로젝트 Home (Chrome MCP, compare mode) — ①
  팔레트 ListBox 추가 (ref instance, items 3) → store `updateElementProps` 로 `items: []` → Skia layout map 366×**10** · Preview
  iframe `[role=listbox]` 366×**10** (option 0, padding 4/4 · border 1) — 종전 layout 110. ② 팔레트 Menu 추가 (factory
  `label`/`children`/`aria-label` 전부 "Menu") → Preview trigger `aria-label="Menu"` (수리 49 전엔 미전달) → label+children ""
  → trigger 글자 "" · `aria-label="Menu"` (호출자 값), aria-label prop 삭제 → 기본 이름 "Menu" (i18n), `aria-label: "Actions"`
  → "Actions". 같은 순간 **DOM 68×10 vs Skia 106×30** 발산 발견 → 수리 51~53 후 Skia **68×10** = DOM. Inspector 는 "" 를
  `undefined` 로 쓰므로 store `updateElementProps` (AI/import 와 같은 열린 writer 경로) 로 넣었다. 콘솔 에러 0 · 두 요소 삭제.
  GridList 빈 집합·legacy Button 경로는 unit + Chrome 실 CSS 게이트.

- **Live Exercise (round 21 수리 후, 2026-09-02)**: 실 빌더(localhost:5173) TEST 프로젝트 Home (Chrome MCP, compare mode) —
  팔레트 (`ComponentsPanel` 의 `handleAddElement`) 로 ToggleButtonGroup · Tabs · GridList · Tree · Table · TagGroup · Button 2 를
  body 아래 만들고 빈 상태로 만든 뒤 (자식 삭제 · `items: []` · `label: ""` · `heightMode: "auto"` · 인라인 padding/minWidth),
  Skia layout box (`__composition_LAYOUT_DEBUG__.getSharedLayoutMap()`) 와 Preview iframe DOM 을 같이 측정: ToggleButtonGroup
  **0×0 = 0×0** · Tabs 366×**0** = 366×0 (TabList 만) · GridList 366×**32** = 366×32 · Tree 366×**50** = 366×50 · Button
  `padding:20` **68×42** = 68×42 · Button `padding:0 minWidth:0` **2×2** = 2×2 (수리 전 layout 80×30 / 29 / 0 / 10 / 84 / 44).
  Table 은 수리 58 만으로는 Preview 가 402 그대로여서 (heightMode 미전달) 수리 59 를 추가 — 이후 auto **40 = 40**
  (`.react-aria-TableVirtualizer` inline `auto`) · fixed 402 = 402 · `height: 240` → 242 = 242. TagGroup 은 빈 label 에서 두
  표면 모두 gap 없이 붙었다 (Skia 32 · DOM 30 — 잔여 2px 은 chip 행 metric, 관찰 등재). 콘솔 에러 0 · 생성 요소 전부 삭제
  (요소 수 86 복귀).

- **Live Exercise (round 22 수리 후, 2026-09-02)**: 실 빌더(localhost:5173) TEST 프로젝트 Home (Chrome MCP, compare mode) —
  팔레트로 Table · Badge 를 만든 뒤 factory 가 기록한 `height`/`heightMode`(Table) · `size`(Badge) 를 store `setElements` 로
  **제거**해 prop 부재 입력을 재현했다 (팔레트 경로는 factory 가 값을 채우므로 결함이 가려진다 — canonical/import/AI 만 부재를
  표현한다). Skia layout box ↔ Preview iframe DOM: Table 366×**402** = 366×402 (수리 전 Skia 302) · Badge 높이 **22** = 22
  (`padding 2px 8px` · `border-width 1px` · `font-size 12px` = catalog sm; 수리 전 Skia 30). 콘솔 에러 0 · 생성 요소 전부 삭제
  (요소 수 86 복귀).

- **Live Exercise (round 23 수리 후, 2026-09-02)**: 실 빌더(localhost:5173) TEST 프로젝트 Home (Chrome MCP, compare mode) —
  팔레트 GridList (ref instance · items 3 · `layout: grid` columns 2) 의 `selectionMode` 를 부재 / `multiple` / `single` 로
  바꿔 Skia layout box ↔ Preview iframe DOM 을 같이 측정: 부재 **164 = 164** (체크박스 0) · `multiple` **208 = 208**
  (체크박스 3) · `single` **164 = 164**. 수리 66 은 시각 무변경 계약이고 (binding `single` 도 GridList 게이트 밖) live 가
  그것을 확인한다. 콘솔 에러 0 · 생성 요소 삭제. 주: 같은 시각 다른 세션이 작업 중인 canvas readiness 오버레이 때문에
  로드 직후 Header 가 잠시 가려져 compare 토글은 DOM 조회로 눌렀다 (ADR-923 범위 밖).

## 관찰 (Phase 3 종결에 포함하지 않는 후속 후보)

- ~~마지막 line box auto-height 미반영~~ → round 8 수리 7 로 종결.
- ~~middle 의 line box 중앙 근사~~ → round 8 수리 6 으로 종결 — 잔여는 실폰트 x-height
  공급 채널 (S4 판정).
- strut 의 실폰트 ascent 보정 (half-leading 의 폰트 항) — TS 공급 채널 S4/Phase 5 판정.
- **(r21)** TagList chip 행 metric 이 DOM 보다 2px 높다 (live: TagGroup label "Tags" → Skia 56 = 20 + gap 4 + TagList 32 ·
  DOM 54 = 20 + 4 + chip 30; 빈 label 도 Skia 32 vs DOM 30). 빈 내용 상자 축이 아니라 **내용이 있는** chip 행의 높이 공식 축
  (`resolveTagWrapLayout` + taglist 분기의 paddingY 재가산) — 별도 판정.
- **(r21)** catalog `sizes.height` 는 여전히 layout 에 전달되지 않는다 (r20 관찰 유지) — Button md `height: 0` (auto) 이라 현재
  무영향.
- **(r21)** spacing 토큰 스케일 2계열 공존: specs `primitives/spacing.ts` 의 md/lg/xl/2xl (16/24/32/48) 이 CSS
  `--spacing-md/lg/xl/2xl` (12/16/24/32) 과 다르다 (2xs/xs/sm 만 일치). catalog 는 이 4 토큰을 `{spacing.X}` 로 쓰지 않아 layout
  도달 소비자가 없어 드러나지 않았을 뿐 — 수리 57 은 그래서 `resolveToken` 대신 CSS px 표를 쓴다. 토큰 정렬은 별도 판정.
- TS 는 lineHeight "normal" 을 엔진에 보내지 않는다 — 프로덕션 strut 의 normal 해소
  (≈1.2em) 공급은 Phase 5 cutover 시 판정.
- ~~`height: 0` 명시 self-collapsing 미분류~~ → **후속 ① 수리 13 으로 종결** (자식 solve 의
  재귀 플래그 — "intake 가 자식 유무를 볼 수 없다" 는 제약은 §8.3.1 정의가 재귀라 우회됨).
  ~~잔여: 텍스트 leaf 에 `height: 0` 명시 + 텍스트 내용 은 leaf 규칙이 구분 못 한다 — 빌더에서
  성립 경로 없음~~ → **round 10 수리 14 로 종결** (Codex r10h1 반증: harness pipeline 이 Text
  경로를 성립시킨다 — "성립 경로 없음" 은 오류였다).
- TS `enrichWithIntrinsicSize` DC-6 overflow cap (`utils.ts:4531` `overflow !== "visible"`,
  게이트 `needsHeight = !rawHeight` — height 미지정 요소 전부) 은 엔진 flex §4.5 의 TS 중복
  구현이고 block 문맥에도 걸며 clip 을 hidden 과 같이 취급한다 — clip 만 빼면 증상 수정,
  온전한 수리는 제거. **Phase 4 인벤토리 등재** (breakdown Phase 4 — Phase 5 cutover 제거
  목록, 제거 시 Chrome 케이스 첨부).
- 텍스트 측정은 raw 문자열 기준 — `"  a  "` (normal) 의 contentMin/MaxWidth 는 collapsible 공백
  폭을 포함해 Chrome 보다 넓다 (r11h1 은 **공백만** 있는 경우의 line box·스칼라 유무만 수리).
  white-space 처리 후 문자열로 측정하는 것은 S4/Phase 5 텍스트 채널 판정.
- ~~root 자신의 `height:0` (+`min-height`) 은 `fixup_root_self_size` 의 `has_h` 경로라 min-height
  clamp 를 받지 않는다~~ → **round 12 수리 26 으로 종결** (Codex r12 과제 5 Chrome 실측 10 / 0).
- §8.3.1 미커버 경계 (Codex r11 과제 10 목록, r12 과제 10 판정): ~~percentage height × bottom
  collapse~~ (r12 definite·indefinite 정합) · ~~inline↔block 전환~~ (raw 엔진 정합, 어댑터 발산은
  Phase 5 대상) · ~~**root margin**~~ (Codex r13 과제 10 — wrapper padding 으로 관측, Chrome/engine/pipeline probe-root.y 11 · child.y 42 정합 → 잔여 제외) · **anonymous
  block box** (`display.rs` 가 pure inline 을 block 으로 올려 현 어휘로 구성 불가 — S4) · clearance ·
  float/clear · writing-mode · multicol/fragmentation · 생성 콘텐츠 (float/clear · writing-mode ·
  multicol 은 `block.rs` 모듈 doc 명시 미대상).
- 프로덕션 Text 의 catalog 기본 `width: 100%` 는 plain-DOM 대조군 밖 (위 §프로덕션 영향 round 12) —
  catalog 기본값 축의 Builder↔Preview 대조는 catalog CSS 를 domLeg 에 싣는 별도 하니스가 필요
  (Phase 5/catalog 판정).
- ~~(r13) Preview 의 `text` legacy prop — "writer 0" 전제~~ → **round 14 수리 31 로 종결** (Codex r14: Pencil import 가
  production writer; generic 렌더 `text` fallback 추가, renderFieldError 는 `text` 만 — writer 인벤토리 상 정합).
- (r13) cssResolver 는 `revert` 를 `initial` 로 취급한다 (노코드 정책, 파일 doc 명시) — Chrome 의
  inline `white-space: revert` 는 상속값으로 되돌아간다. 게이트 미작성 (정책 문서화된 의도적 차이).
- (r13) root auto 폭의 used 폭을 `solve_node` 의 available 로 넘기므로 root 자신의 % padding/margin
  은 used 폭 기준으로 해소된다 — 비-root 자식과 같은 모델 (부모 intake 가 used 폭을 넘김). CSS 는
  containing block 기준이라 "min/max 가 바인딩되는 auto root + % padding" 조합에서만 갈린다 (라이브
  body 는 폭 명시 주입이라 무관).
- (r15) publish `ElementRenderer` 는 `children` 만 읽는다 (`apps/publish/src/renderer/ElementRenderer.tsx`
  :83~165) — 계약의 `text` (Pencil import) · `placeholder` 군을 publish 가 아직 위임하지 않는다. publish 는
  빌더 안정화 후 착수 방침 (링크만) 이라 범위 밖 — 착수 시 `resolveTextSourceText` 위임이 첫 항목.
- (r15) field leaf 의 `value`: DOM `<input>` 은 value 가 있으면 value 를, 없으면 placeholder 를 보이지만
  Skia `buildCatalogShapes` 는 value 를 그리지 않는다 (round 14 이전부터; 계약은 `placeholder` 만). 라이브
  도달 (inspector value 편집) 이라 후속 후보 — 이번 round 범위 (label / AI writer) 밖이라 계약에 넣지 않음.
- (r15) `cssResolver.resolveCurrentColor` whole-value 비교는 `toLowerCase()` 만 (Codex r15 관찰) —
  white-space 범위 밖, Chrome 반례 미측정.
- (r15) Chrome plain-DOM 하니스는 catalog box leaf (Button paddingX) 와 비-텍스트 leaf 의 inline 텍스트를
  못 싣는다 — 텍스트 원천 계약의 RED 는 unit 게이트 (세 표면) 가 원천. catalog CSS 를 domLeg 에 싣는 별도
  하니스 (위 Text width:100% 관찰과 같은 축) 가 필요.
- (r16) field/group 의 parent `description`/`errorMessage` 를 Skia 가 어떤 가족에서도 그리지 않는다 (수리 33 참조) — Inspector
  writer 15 binding · Preview RAC slot · Skia 투영 0 · 레이아웃 높이 0. ADR-923 범위 밖 (레이아웃 어휘가 아니라 D3 투영 공백)
  — **사용자 결정 2026-09-01: 범위 밖, 별도 작업** (Phase 4 이후): 가족 전체 canonical Description/FieldError 자식 + propagation + `isInvalid` 가시성 + 높이.
- (r16) Codex 원복 (b) — 레이아웃 종전 순서 원복 시 Chrome r13m2·r15 pin 도 RED (95/97): 종전 `extractTextContent` 가 Text 의
  콘텐츠 폭 경로에도 도달한다 — round 16 프롬프트의 "PASS 유지 예상" 은 틀렸다 (Chrome pin 이 레이아웃 원천 순서도 잡는다).
- (r16) Codex 원복 (c″) — Preview generic 종전 함수 원복 시 `CanonicalNodeRenderer.textSource` 4/4 PASS: 게이트가 출력 의미만
  잡고 공용 resolver 위임 자체는 검출하지 않는다 (의미가 같으면 위임 여부는 게이트 밖 — 의도).
- ~~(r17) Disclosure 에 헤더 자식이 없는 legacy 문서: Preview 는 parent `title || "Section"` 을 보이고 Skia 는 제목을 안
  그린다~~ → **round 18 수리 38·39 로 종결** (Preview-only parent title 읽기 제거 + registry 다리 — 헤더 없으면 어느 표면도
  안 그린다).
- (r17) parent-only reader (TextField/TextArea/NumberField/Select `label || ""`, TagGroup) 는 `""` 를 `""` 로 두어 engine 과
  같다; parent 부재 legacy 문서에서만 자식 텍스트를 안 읽는데, 이 가족들은 factory 가 항상 parent label 을 쓴다 (sweep
  조건 ii) — 반례 경로 없음, 미변경.
- (r18) Pencil import 의 Label 텍스트는 `text` 로 들어온다 (Pencil 노드의 `children` 은 노드 필드) — `migrateColorFieldParentLabel`
  의 `labelChildText` 는 Label `children` 만 읽어 Pencil 경유 legacy ColorField 는 parent label 을 못 받는다. Pencil 이 ColorField
  를 내는 경로는 composition export 왕복 (`metadata.compositionType`) 뿐이고 export 가 Label `props.children` 을 싣지 않아
  (`componentToPencilTree` 가 `children` 키를 노드 필드로 건너뜀) 왕복 자체가 텍스트를 잃는다 — Pencil 왕복 텍스트 보존은
  ADR-923 범위 밖 후속 후보.
- (r18) Disclosure 의 Inspector Title 은 수리 39 전까지 어느 표면에도 닿지 않는 D2 writer 였다 — 같은 종류 (binding accepts 의
  content string 인데 registry 다리가 없는 composite parent) 의 전수 sweep 은 round 16 의 Label 자식 20 가족 밖이라
  description/errorMessage 별도 작업 (사용자 결정) 과 같은 묶음으로 둔다.
- (r19) shared 컴포넌트의 **dataBinding DOM 경로** row label 휴리스틱 5 (CheckboxGroup :280 · RadioGroup :283 · Menu :259/:283 ·
  Tabs :280/:295 · ToggleButtonGroup :160 — `name || title || label || \`Option ${i + 1}\``류) 는`toItemProjectionRow`와 순서·빈 값
처리가 모두 다르다 (Skia 는`getItemLabel`→ itemKey).`boundData`(API/collection 바인딩) 에서만 도는 경로라 정적 items · 문서
텍스트 축 밖 — ADR-912 §2-D (DOM wrapper 는 hook adapter`rows`만) 미이관 잔여로 별도 작업. 같은 경로의`fallbackData` (API
  실패 시 "Home/Products/Current" 등 11 컴포넌트) 도 DOM 만의 데이터 폴백이다 (Skia 는 API 를 못 부른다).
- (r19) Table `ColumnGroup` 은 Preview 만 그린다 (`TableRenderer.tsx` :351 `label || "Group"`; Skia/scene 에 ColumnGroup 렌더 0) —
  기본 글자가 아니라 표면 자체가 없는 축이라 이번 sweep 밖.
- (r19) `?canonical=0` legacy Preview 경로는 별도 렌더러 집합 (rendererMap) 이고 canonical 경로는 cutover 컴포넌트라 기본 글자
  sweep 은 **렌더러 층 + 컴포넌트 층** 둘 다 봐야 한다 — round 18 의 Menu 처럼 렌더러만 고치면 컴포넌트가 되돌린다 (수리 46).
- (r19) ToggleButtonGroup 측정의 items·children 0 → `DEFAULT_WIDTH` (80) 는 글자가 아닌 상자 기본값 (leaf 공통 폴백) — 빈
  ToggleButtonGroup 의 DOM 폭 (0) 과 다르지만 텍스트 축이 아니라 별도.
- (r20) icon-only Button 폭은 §2.5 (`iconSize` 만) — DOM 은 `[data-icon-only]` padding 0 + `min-width` (md 68) 라 다른 축; 수리 52
  의 minWidth 하한은 §2.5 를 거치지 않는다 (별도 후속).
- (r20) INLINE_UI 태그 (badge/tag/chip/togglebutton/tab) 의 빈 글자는 여전히 `DEFAULT_WIDTH` 80 + 줄 상자 — r18/r19 writer 변경
  밖이라 Chrome 미검증, 수리 52/53 은 button 가족 한정. 같은 형태의 후보.
- (r20) catalog `sizes.height` 도 `deriveSizeConfig` 가 버린다 (`configHeight` 분기 dead) — Button 은 `height: 0` (= auto) 이라
  현재 무영향, 다른 rule 이 height 를 쓰면 layout 만 못 본다.
- (r20) Disclosure trigger 의 이름은 title 뿐 (RSP 동일 — `aria-label` 은 컨테이너 group 으로 간다); r18 수리로 title "" 이면
  이름 없는 Button — D1 writer 가 없어 이번 sweep 밖.
- (r20) 팔레트 카드 클릭은 **선택된 요소 안에** 넣는다 — ListBox 선택 상태에서 Menu 를 넣으면 ListBox 자식이 되어 Preview 에
  안 그려진다 (items 렌더). live 절차 함정.
