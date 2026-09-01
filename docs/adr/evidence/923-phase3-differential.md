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

## 결과 — 69 케이스 전부 엔진 직결 ≤1px (round 16 수리 후)

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
      (13 가족) 에 대해 (i) registry `→ Label.children` 규칙 (ii) 생성 시 parent SSOT == Label 텍스트 (iii) parent 변경이
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

## 관찰 (Phase 3 종결에 포함하지 않는 후속 후보)

- ~~마지막 line box auto-height 미반영~~ → round 8 수리 7 로 종결.
- ~~middle 의 line box 중앙 근사~~ → round 8 수리 6 으로 종결 — 잔여는 실폰트 x-height
  공급 채널 (S4 판정).
- strut 의 실폰트 ascent 보정 (half-leading 의 폰트 항) — TS 공급 채널 S4/Phase 5 판정.
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
