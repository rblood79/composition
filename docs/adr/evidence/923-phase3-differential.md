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

## 결과 — 51 케이스 전부 엔진 직결 ≤1px (round 10 수리 후)

1차 실행: 14 pass / **9 fail** → 전부 엔진 결함으로 확정·수리(수리 1~~5) → 23/23.
Codex round 8 판독이 반례 2(middle·마지막 line box)로 재개방 → 케이스 4 추가(clip
오라클 포함) → 수리 6~~8 → 27/27. Codex round 9 판독이 flex clip auto-min(HIGH) + block
auto-height 꼬리 margin 반례 2(MEDIUM) 로 재개방 → 재현 5 + 인접 경계 7 = 12 케이스 추가,
**RED 10/12** (hidden 대조군 2 만 첫 실행 PASS) → 수리 9~12 → 39/39. 후속 ① (height:0
self-collapsing) 3 케이스 RED 1 → 수리 13 → **42/42 pass**. Codex round 10 판독이 §8.3.1
self-collapsing 경계(텍스트 leaf · absolute 자식) + adjoining 집합 + auto-height 하한 반례 4군으로
재개방 → 재현 8 + 대조군 1 = 9 케이스 추가, **RED 8/9** (+ 게이트 3 중 RED 2) → 수리 14~~18
→ **51/51 pass**. 어댑터 대조군은 **발산 18 / 정합 33** — 현 IFC 시뮬레이션이 Chrome 과 갈리는 차원의 실측
(Phase 5 cutover 가 닫을 대상. "정합" 은 시뮬레이션이 우연히 맞는 차원 — round 9 추가
12 케이스는 프로덕션 어댑터가 엔진 block/flex 경로를 그대로 타므로 수리 후 전부 정합).
종전 "16/23 발산" 표기는 오집계 (r8m1 — 실측 15/23; 27 케이스 18/9; 39 케이스 18/21; 42 케이스 18/24; 51 케이스 18/33).

| #   | 케이스                                         | 차원                                                                                                      | 엔진 직결 (게이트) | 현 어댑터 (대조군)                                                                                                                                                                                                                                                                                                                                                                                                        |
| --- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ib-two-one-line                                | inline-block 2개 한 줄                                                                                    | 정합               | 발산 1: a.y: dom=4.0 eng=2.0 (Δ2.0)                                                                                                                                                                                                                                                                                                                                                                                       |
| 2   | ib-wrap                                        | 3개 중 셋째 줄바꿈                                                                                        | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 3   | explicit-width-block-sibling                   | 명시 폭 block 형제 (ADR-198 재현)                                                                         | 정합               | 발산 6: a.y: dom=0.0 eng=5.0 (Δ5.0) · mid.x: dom=0.0 eng=60.0 (Δ60.0) · mid.y: dom=20.0 eng=0.0 (Δ20.0) · b.x: dom=0.0 eng=180.0 (Δ180.0) · b.y: dom=50.0 eng=5.0 (Δ45.0) · root.h: dom=70.0 eng=30.0 (Δ40.0)                                                                                                                                                                                                             |
| 4   | auto-width-block-sibling                       | auto 폭 block 형제                                                                                        | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 5   | valign-top                                     |                                                                                                           | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 6   | valign-middle                                  |                                                                                                           | 정합               | 발산 1: a.y: dom=0.0 eng=10.0 (Δ10.0)                                                                                                                                                                                                                                                                                                                                                                                     |
| 7   | valign-bottom                                  |                                                                                                           | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 8   | valign-baseline                                | 기본 baseline 정렬 (bottom = 폴백 baseline)                                                               | 정합               | 발산 1: a.y: dom=20.0 eng=10.0 (Δ10.0)                                                                                                                                                                                                                                                                                                                                                                                    |
| 9   | child-margin                                   | 인라인 마진 + 형제 block                                                                                  | 정합               | 발산 1: a.y: dom=5.0 eng=2.5 (Δ2.5)                                                                                                                                                                                                                                                                                                                                                                                       |
| 10  | empty-block-sibling                            | 빈 block 이 줄을 끊는다                                                                                   | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 11  | parent-padding                                 | 부모 padding 안 line box                                                                                  | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 12  | inline-flex-nested-baseline                    | inline-flex 컨테이너 baseline (R6 필수)                                                                   | 정합               | 발산 12: a1a.y: dom=20.0 eng=0.0 (Δ20.0) · a1.y: dom=20.0 eng=0.0 (Δ20.0) · a.y: dom=20.0 eng=0.0 (Δ20.0) · a.w: dom=60.0 eng=320.0 (Δ260.0) · b1a.x: dom=60.0 eng=0.0 (Δ60.0) · b1a.y: dom=0.0 eng=35.0 (Δ35.0) · b1.x: dom=60.0 eng=0.0 (Δ60.0) · b1.y: dom=0.0 eng=35.0 (Δ35.0) · b.x: dom=60.0 eng=0.0 (Δ60.0) · b.y: dom=0.0 eng=35.0 (Δ35.0) · b.w: dom=60.0 eng=320.0 (Δ260.0) · root.h: dom=55.0 eng=75.0 (Δ20.0) |
| 13  | inline-grid-line                               | inline-grid 가 line item                                                                                  | 정합               | 발산 1: a.y: dom=10.0 eng=5.0 (Δ5.0)                                                                                                                                                                                                                                                                                                                                                                                      |
| 14  | ib-shrink-to-fit-wrap                          | r6: fit-content 100 vs one-pass 80                                                                        | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 15  | ib-fit-under-min-content                       | available < min-content 는 overflow                                                                       | 정합               | 발산 2: c1.w: dom=80.0 eng=60.0 (Δ20.0) · f.w: dom=80.0 eng=60.0 (Δ20.0)                                                                                                                                                                                                                                                                                                                                                  |
| 16  | ib-pct-child-shrink                            | r6: shrink-to-fit 안 percentage 재해소                                                                    | 정합               | 발산 2: p2.w: dom=30.0 eng=50.0 (Δ20.0) · f.w: dom=60.0 eng=100.0 (Δ40.0)                                                                                                                                                                                                                                                                                                                                                 |
| 17  | ib-baseline-margin-bottom                      | r7: 폴백 baseline 은 margin edge (§10.8.1)                                                                | 정합               | 발산 1: a.y: dom=12.0 eng=6.0 (Δ6.0)                                                                                                                                                                                                                                                                                                                                                                                      |
| 18  | ib-overflow-hidden-baseline                    | r7: scroll container 는 margin edge (css-align-3 §9.1)                                                    | 정합               | 발산 2: a1.y: dom=10.0 eng=5.0 (Δ5.0) · a.y: dom=10.0 eng=5.0 (Δ5.0)                                                                                                                                                                                                                                                                                                                                                      |
| 19  | valign-top-bottom-only                         | r7: baseline 참여자 없는 줄                                                                               | 정합               | 발산 1: c.y: dom=10.0 eng=0.0 (Δ10.0)                                                                                                                                                                                                                                                                                                                                                                                     |
| 20  | inline-flex-column-baseline                    | r7: column flex 첫 item baseline                                                                          | 정합               | 발산 5: c1a.y: dom=28.0 eng=4.0 (Δ24.0) · c1.y: dom=28.0 eng=4.0 (Δ24.0) · c2.y: dom=40.0 eng=16.0 (Δ24.0) · c.y: dom=28.0 eng=4.0 (Δ24.0) · root.h: dom=60.0 eng=40.0 (Δ20.0)                                                                                                                                                                                                                                            |
| 21  | atomic-line-height-inert                       | atomic inline 의 line-height 는 line box 에 관여하지 않는다                                               | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 22  | strut-short                                    | 부모 line-height strut 이 짧은 item 위로 line 확장                                                        | 정합               | 발산 2: tail.y: dom=40.0 eng=20.0 (Δ20.0) · root.h: dom=50.0 eng=30.0 (Δ20.0)                                                                                                                                                                                                                                                                                                                                             |
| 23  | strut-tall                                     | item 이 strut 보다 커도 strut descent 는 남는다                                                           | 정합               | 발산 2: tail.y: dom=70.0 eng=50.0 (Δ20.0) · root.h: dom=80.0 eng=60.0 (Δ20.0)                                                                                                                                                                                                                                                                                                                                             |
| 24  | valign-middle-tall                             | r8: middle 은 baseline 에 중심 고정 (x-height/2=0)                                                        | 정합               | 발산 1: a.y: dom=10.0 eng=20.0 (Δ10.0)                                                                                                                                                                                                                                                                                                                                                                                    |
| 25  | strut-last-line                                | r8: 마지막 line box 의 strut 높이가 auto-height 에 반영                                                   | 정합               | 발산 1: root.h: dom=40.0 eng=20.0 (Δ20.0)                                                                                                                                                                                                                                                                                                                                                                                 |
| 26  | clip-no-bfc                                    | r8: overflow:clip 은 BFC 를 만들지 않는다 (margin 관통)                                                   | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 27  | ib-overflow-clip-baseline                      | r8: clip 의 inline-block baseline 판정 (오라클)                                                           | 정합               | 발산 3: a1.y: dom=20.0 eng=5.0 (Δ15.0) · a.y: dom=20.0 eng=5.0 (Δ15.0) · root.h: dom=50.0 eng=40.0 (Δ10.0)                                                                                                                                                                                                                                                                                                                |
| 28  | flex-item-clip-auto-min                        | r9h1: overflow:clip flex item 은 scroll container 아님 → §4.5 content floor 유지 (f.w 80)                 | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 29  | flex-item-hidden-auto-min                      | r9h1 대조군: hidden 은 scroll container → floor 0 (f.w 60)                                                | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 30  | trailing-empty-block-escape                    | r9m2: 꼬리 empty block 의 관통 margin 은 부모 bottom 으로 탈출 (root 10)                                  | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 31  | trailing-margin-contained                      | r9m2: padding-bottom 부모는 마지막 bottom margin 을 content 에 포함 (31)                                  | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 32  | trailing-empty-block-contained                 | r9m2: padding-bottom 부모 안 꼬리 empty block 관통 margin 포함 (41)                                       | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 33  | bfc-last-child-margin-escape                   | r9 인접: BFC 자식(flex) 의 자기 bottom margin 은 부모 bottom 과 collapse (sib.y 30)                       | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 34  | bfc-sibling-top-collapse                       | r9 인접: BFC 자식(flex) 의 자기 top margin 은 이전 형제 bottom 과 collapse (b.y 30)                       | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 35  | bfc-first-child-top-escape                     | r9 인접: BFC 자식(flex) 의 자기 top margin 은 부모 top 과 collapse (wrap.y 30·h 10)                       | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 36  | empty-first-child-padded                       | r9 인접: padding-top 부모 안 첫 empty block = non-zero bottom border 가정 위치 (solid.y 31)               | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 37  | empty-first-chain-through-wrap                 | r9 인접: 첫 empty + 다음 block 의 chain 이 wrap top 으로 통째 탈출 (wrap.y 40)                            | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 38  | flex-item-cross-hidden-auto-min                | r9h1 양축: overflowY hidden 만 있어도 computed overflowX auto → scroll container (f.w 60)                 | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 39  | block-margin-then-line-box                     | r9 인접: line box 는 margin 을 collapse 하지 않는다 (block mb10 뒤 inline-block y 20)                     | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 40  | height-zero-self-collapsing                    | 후속①: height:0 명시 + margin 은 self-collapsing (chain 관통, b.y 40)                                     | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 41  | height-zero-with-content-not-self-collapsing   | 후속① 대조군: in-flow 내용이 있으면 아님 (b.y 60)                                                         | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 42  | self-collapsing-wrapper-of-empty               | 후속①: 자식 전부 self-collapsing 이면 wrapper 도 (b.y 40, wrap.y 40)                                      | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 43  | abs-only-height-zero-self-collapsing           | r10m1: absolute 자식만 가진 height:0 컨테이너는 self-collapsing (b.y 40)                                  | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 44  | abs-only-auto-height-self-collapsing           | r10m1 대조군: 같은 구조 height auto (b.y 40)                                                              | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 45  | mixed-sign-chain-three-empties                 | r10m2: 부호 혼합 3+ adjoining margin 은 최대 양수 + 최소 음수 (b.y 20)                                    | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 46  | mixed-sign-chain-hoisted-through-wrapper       | r10m2: 손자 탈출 음수 margin 도 wrapper·형제와 한 집합 (g.y 20)                                           | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 47  | mixed-sign-chain-self-collapsing-wrapper       | r10m2: self-collapsing wrapper 의 own + 탈출 chain + 형제 한 집합 (b.y 20)                                | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 48  | negative-top-margin-padded-auto-height-clamped | r10m3: 음수 top margin 으로 in-flow bottom 음수여도 auto height 0 하한 (root.h 2)                         | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 49  | negative-bottom-margin-contained-clamped       | r10m3: bottom padding 이 담는 음수 bottom margin 도 0 하한 (root.h 1)                                     | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 50  | negative-flow-bottom-not-self-collapsing       | r10m3 인접: in-flow bottom ≤ 0 이어도 내용 있으면 self-collapsing 아님 (b.y 60)                           | 정합               | 정합                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 51  | text-leaf-height-zero-has-line-box             | r10h1: 텍스트 leaf 는 height:0 이어도 line box 가 있어 self-collapsing 아님 (b.y 60; leafBaseline = 신호) | 정합               | 정합 (Text 경로)                                                                                                                                                                                                                                                                                                                                                                                                          |

별도 게이트 (표 밖, `pipelineLeg` = 프로덕션 어댑터 경로):

- **r8l2 — 프로덕션 wrap intrinsic-min**: display:flex row 60px 안 wrap flex item 이
  min-content 최대 item 80 으로 바닥 (수리 5 의 프로덕션 실효 경로를 운반 어휘 그대로 고정).
- **r9h1 — 프로덕션 overflow:clip (shorthand)**: 같은 구조에 Style Panel 이 쓰는 shorthand
  `overflow: "clip"` → Chrome f.w 80 (수리 전 pipeline 60). 패널 → `utils.ts` shorthand
  분배 → wasm 경계 → `write_flex_item` 슬롯 18 의 전 경로를 고정.

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
  부모의 텍스트 leaf 전부에 `leafBaseline` 을 공급하므로 baseline 정렬 문맥 (flex
  `align-items: baseline` · inline-block `vertical-align`) 에서 종전 bottom 폴백이 첫 줄
  baseline 으로 바뀐다 — Chrome 과 같은 방향 (full parity 990 회귀 0).

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
