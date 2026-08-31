# ADR-923 Phase 3 evidence — Chrome 차등 증명 (G1 전반)

> 2026-09-01. 실행 Claude. 하니스: `apps/builder/tests/parity/adr923ChromeDifferential.browser.test.ts`
> (ADR-156 `harness.ts` — domLeg = 실 Chrome `getBoundingClientRect` ground truth ·
> engineLeg = **어댑터 우회** 엔진 직결(raw CSS display 를 `buildTreeBatch` 로) ·
> pipelineLeg = 현 어댑터 경로 대조군, 기록 전용). 통과 기준 위치·크기 ≤ 1px (TOL 1.0,
> 허용치 무변경). 대조군 원본: `tests/parity/.artifacts/adr923-phase3-differential.json`
> (매 실행 재생성 — vitest browser 는 통과 테스트 콘솔을 숨기므로 파일로 내보낸다).

## 결과 — 23 케이스 전부 엔진 직결 ≤1px (수리 후)

1차 실행: 14 pass / **9 fail** → 전부 엔진 결함으로 확정·수리 → 2차 실행 23/23 pass.
어댑터 대조군은 **16/23 발산** — 현 IFC 시뮬레이션이 Chrome 과 갈리는 차원의 실측
(Phase 5 cutover 가 이 격차를 닫는 대상. "정합" 7건은 시뮬레이션이 우연히 맞는 차원).

| 케이스 | 차원 | 엔진 직결 (게이트) | 현 어댑터 (대조군) |
| --- | --- | --- | --- |
| ib-two-one-line | inline-block 2개 한 줄 | 정합 | 발산 1: a.y: dom=4.0 eng=2.0 (Δ2.0) |
| ib-wrap | 3개 중 셋째 줄바꿈 | 정합 | 정합 |
| explicit-width-block-sibling | 명시 폭 block 형제 (ADR-198 재현) | 정합 | 발산 6: a.y: dom=0.0 eng=5.0 (Δ5.0) · mid.x: dom=0.0 eng=60.0 (Δ60.0) · mid.y: dom=20.0 eng=0.0 (Δ20.0) · b.x: dom=0.0 eng=180.0 (Δ180.0) · b.y: dom=50.0 eng=5.0 (Δ45.0) · root.h: dom=70.0 eng=30.0 (Δ40.0) |
| auto-width-block-sibling | auto 폭 block 형제 | 정합 | 정합 |
| valign-top |  | 정합 | 정합 |
| valign-middle |  | 정합 | 발산 1: a.y: dom=0.0 eng=10.0 (Δ10.0) |
| valign-bottom |  | 정합 | 정합 |
| valign-baseline | 기본 baseline 정렬 (bottom = 폴백 baseline) | 정합 | 발산 1: a.y: dom=20.0 eng=10.0 (Δ10.0) |
| child-margin | 인라인 마진 + 형제 block | 정합 | 발산 1: a.y: dom=5.0 eng=2.5 (Δ2.5) |
| empty-block-sibling | 빈 block 이 줄을 끊는다 | 정합 | 정합 |
| parent-padding | 부모 padding 안 line box | 정합 | 정합 |
| inline-flex-nested-baseline | inline-flex 컨테이너 baseline (R6 필수) | 정합 | 발산 12: a1a.y: dom=20.0 eng=0.0 (Δ20.0) · a1.y: dom=20.0 eng=0.0 (Δ20.0) · a.y: dom=20.0 eng=0.0 (Δ20.0) · a.w: dom=60.0 eng=320.0 (Δ260.0) · b1a.x: dom=60.0 eng=0.0 (Δ60.0) · b1a.y: dom=0.0 eng=35.0 (Δ35.0) · b1.x: dom=60.0 eng=0.0 (Δ60.0) · b1.y: dom=0.0 eng=35.0 (Δ35.0) · b.x: dom=60.0 eng=0.0 (Δ60.0) · b.y: dom=0.0 eng=35.0 (Δ35.0) · b.w: dom=60.0 eng=320.0 (Δ260.0) · root.h: dom=55.0 eng=75.0 (Δ20.0) |
| inline-grid-line | inline-grid 가 line item | 정합 | 발산 1: a.y: dom=10.0 eng=5.0 (Δ5.0) |
| ib-shrink-to-fit-wrap | r6: fit-content 100 vs one-pass 80 | 정합 | 정합 |
| ib-fit-under-min-content | available < min-content 는 overflow | 정합 | 발산 2: c1.w: dom=80.0 eng=60.0 (Δ20.0) · f.w: dom=80.0 eng=60.0 (Δ20.0) |
| ib-pct-child-shrink | r6: shrink-to-fit 안 percentage 재해소 | 정합 | 발산 2: p2.w: dom=30.0 eng=50.0 (Δ20.0) · f.w: dom=60.0 eng=100.0 (Δ40.0) |
| ib-baseline-margin-bottom | r7: 폴백 baseline 은 margin edge (§10.8.1) | 정합 | 발산 1: a.y: dom=12.0 eng=6.0 (Δ6.0) |
| ib-overflow-hidden-baseline | r7: overflow≠visible 은 margin edge (§10.8.1) | 정합 | 발산 2: a1.y: dom=10.0 eng=5.0 (Δ5.0) · a.y: dom=10.0 eng=5.0 (Δ5.0) |
| valign-top-bottom-only | r7: baseline 참여자 없는 줄 | 정합 | 발산 1: c.y: dom=10.0 eng=0.0 (Δ10.0) |
| inline-flex-column-baseline | r7: column flex 첫 item baseline | 정합 | 발산 5: c1a.y: dom=28.0 eng=4.0 (Δ24.0) · c1.y: dom=28.0 eng=4.0 (Δ24.0) · c2.y: dom=40.0 eng=16.0 (Δ24.0) · c.y: dom=28.0 eng=4.0 (Δ24.0) · root.h: dom=60.0 eng=40.0 (Δ20.0) |
| atomic-line-height-inert | atomic inline 의 line-height 는 line box 에 관여하지 않는다 | 정합 | 정합 |
| strut-short | 부모 line-height strut 이 짧은 item 위로 line 확장 | 정합 | 발산 2: tail.y: dom=40.0 eng=20.0 (Δ20.0) · root.h: dom=50.0 eng=30.0 (Δ20.0) |
| strut-tall | item 이 strut 보다 커도 strut descent 는 남는다 | 정합 | 발산 2: tail.y: dom=70.0 eng=50.0 (Δ20.0) · root.h: dom=80.0 eng=60.0 (Δ20.0) |

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
   **overflow ≠ visible 강제** (`tree.rs` 가 센티널로 강제 — §10.8.1 두 조항, r7 관찰 확정).
5. **atomic inline shrink-to-fit** (`tree.rs solve_block_child` + `solve_flex` min 측정):
   폭 auto atomic inline 은 fit = min(max-content, max(min-content, available−margin−pb)),
   fit 으로 재-solve (wrap·percentage 재해소, used width = fit — §10.3.9). wrap row 컨테이너의
   min-content 는 합산이 아니라 최대 item 기여 (css-flexbox-1 §9.9 — `min_wrap_measure`).

## 프로덕션 영향

수리 1~4 + 5 의 shrink-to-fit 본체는 line item(atomic inline) 경로 — 현 프로덕션 display
운반 union 은 inline-\* 를 보내지 않아 **휴면** (Phase 5 cutover 가 활성화). 유일한 실효
변화 = **wrap flex 컨테이너의 min-content 측정 정정** (`solve_flex` 2-b 실측 교체 경로가
프로덕션에서 소비 — §4.5 floor·fit-content 기준이 합산 → 최대 item 으로, CSS 방향 정정).
parity 전 suite 회귀 0 으로 확인.

## 검증 (2026-09-01)

- cargo **346** (+5: p3 신규 4 + inert 반전 1 · 기존 전량 GREEN) · golden 15 · layout_trace 10
  · tree_golden 11 · clippy 신규 0 (`VALIGN_BASELINE` 명명 상수는 allow(dead_code) 주석).
- wasm 재빌드 → 차등 **23/23** · seam 4/4 · **parity 957 pass** (+23; 실패 = 기존
  catalogComponentBox GridListItem/Tooltip 2 건만) · layout unit 49 files/401 · type-check 0.
- **Live Exercise**: 실 빌더(localhost:5173, TEST 프로젝트) Chrome MCP 로드 — Skia 캔버스
  3 페이지 정상 렌더, Page 2 wrap 카드(GridList 형: Desert Sunset·Hiking Trail 한 줄 +
  Mountain Sunrise 줄바꿈, 자연폭 유지·collapse 0) 확대 확인, 콘솔 에러 0. wrap
  min-content 정정 경로의 사용자-가시 무회귀 표본.

## 관찰 (Phase 3 종결에 포함하지 않는 후속 후보)

- 마지막 line box 가 형제 없이 끝나면 strut/line 초과분이 컨테이너 auto-height 에 반영되지
  않는다 (trailing meta 에 line 높이 없음 — 케이스는 전부 tail block 보유로 관측 밖).
- vertical-align: middle 은 line box 중앙 근사 유지 — CSS 는 baseline + x-height/2 앵커
  (fontSize 0 fixture 에선 동치, 실폰트 x-height 공급은 S4 판정).
- strut 의 실폰트 ascent 보정 (half-leading 의 폰트 항) — TS 공급 채널 S4/Phase 5 판정.
- TS 는 lineHeight "normal" 을 엔진에 보내지 않는다 — 프로덕션 strut 의 normal 해소
  (≈1.2em) 공급은 Phase 5 cutover 시 판정.
