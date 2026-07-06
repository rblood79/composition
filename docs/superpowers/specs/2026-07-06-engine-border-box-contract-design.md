# 자체 Rust 엔진 box-sizing 계약 정합 — specified size 를 border-box 로 해석 (설계)

- 날짜: 2026-07-06
- 상태: 설계 확정 (사용자 confirm 2회 — 수정 층 재확정 포함)
- 관련: ADR-916 (Taffy 완전 제거, 자체 composition-engine 단독), Button size 발산 버그 리포트

## 1. 증상

같은 size 의 Button 이 Skia(Builder) 에서 CSS(Preview) 보다 크게 렌더된다.

- md 기준 실측: width +26px (paddingX 12×2 + border 1×2), height +10px (paddingY 4×2 + border 1×2)
- CSS 정합 기준 높이: xs=20 / sm=22 / md=30 / lg=42 / xl=54 (lineHeight + paddingY×2 + borderWidth×2)

## 2. 근본 원인 — box-sizing 계약 불일치

앱 세계 전체는 **border-box** 계약으로 일관되어 있다:

| 층                                                        | 근거                                                                                                                         | 계약            |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Preview CSS                                               | `apps/builder/src/preview/index.tsx:38` `* { box-sizing: border-box }` (publish 도 동일, export.utils.ts:1011)               | border-box      |
| store / 패널 편집값                                       | 사용자가 넣는 width/height = CSS 에서 border-box 로 소비                                                                     | border-box      |
| JS enrich (`enrichWithIntrinsicSize`, utils.ts:4044-4048) | 주석 명시: "웹 CSS 의 `* { box-sizing: border-box }` 동작과 일치… Taffy 0.9: style.size 를 border-box 로 처리 → 변환 불필요" | border-box 주입 |
| (구) Taffy 0.9                                            | style.size = border-box                                                                                                      | border-box      |
| **자체 엔진 커널 (신규)**                                 | block.rs:281-286 / flex.rs:206-244 — explicit size 를 content 로 취급 후 pad_border 재가산                                   | **content-box** |

이중 가산 경로: enrich 가 border-box 30px 주입 → 커널이 content 로 재해석 + pad_border(10) 재가산 → 40px. Skia > CSS.

**content-box 계약의 출처**: `c046daedc` (2026-07-04, ADR-916 Phase 2-B tree.rs 단위 3-a). CSS 기본값(content-box)을 구현한 이틀 전 단위 작업이며, 앱의 전역 border-box 계약과 대조 검토 없이 작성됨. `block_child_explicit_width_adds_padding` 테스트(tree.rs, width 100 + padding 20 → 120 기대)가 이를 고정하고 있으나 정본 계약이 아니라 미정합 신규 코드다.

**dual-run 이 못 거른 이유**: C-2b (bf60f79e6) fixture 전부 padding=0 — box-sizing 계약 차이가 diff 에 나타날 수 없는 입력이었다.

## 3. 결정 — 엔진 커널을 border-box 로 정합

**specified size (width / height / min* / max*, px·percent 공통) 는 border-box 로 해석한다.** JS 는 무변경.

### 기각안과 사유

| 안                                         | 기각 사유                                                                                                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| enrich 를 content-box 로 전환 (1차 확정안) | 보고된 Button 증상만 해결. 같은 뿌리인 (a) 사용자 명시 px, (b) percent+padding 발산이 잔존. JS 하류에서 주입 height 를 border-box 로 재사용하는 소비자(부모 합산·2-pass 비교·overflow cap) 전면 재점검 ripple 발생 |
| JS 직렬화 경계에서 감산 (boundary 변환)    | 사용자 명시 px 는 해결되나 percent 는 정적 감산 불가 (엔진이 percent 를 layout 시점에 해석 — `compute_leaf_percent`)                                                                                               |

엔진 border-box 정합은 Taffy 계약의 복원이므로, Taffy 를 전제로 작성된 모든 JS 코드(enrich·applyCommonTaffyStyle·하류 소비자)가 무변경으로 다시 정합된다. utils.ts:4048 / :4688 의 "Taffy 0.9 = border-box" 주석은 stale 이 아니라 다시 정본이 된다 (엔진 이름만 갱신).

## 4. 설계

### 4.1 계약 명문화

- **대외 계약 (style 입력)**: specified size = border-box. AUTO / FIT_CONTENT / 측정(intrinsic) 경로는 현행 유지 — content 측정 + pad_border 가산 = border-box 결과이므로 이미 정합.
- **커널 내부 수학**: content 기준 유지 (block.rs / flex.rs 무변경이 목표).
- **min/max**: CSS 와 동일하게 border-box 단계에서 clamp 후 content 도출. 감산 시 `max(0, v - pad_border)` 하한 보장.

### 4.2 변환 단일 지점 — tree.rs specified intake

specified → content 변환은 **tree.rs 의 item write / resolve 시점 1곳**에 둔다 (percent 는 available 대비 해석 직후 감산):

| 지점                                     | 현행                                              | 변경                                                                                                                |
| ---------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `write_block_item` (tree.rs:1123~)       | expl_w/h 를 그대로 content 슬롯에 기록            | percent 해석 → border-box clamp(min/max) → `- pad_border` 후 기록                                                   |
| flex item write (FLEX_FIELD 직렬화 지점) | width/height/min/max 그대로                       | 동일 변환 (main/cross 축별 pad_border)                                                                              |
| `resolve_self_size` (tree.rs:843)        | style 값 그대로 반환                              | 반환값 = border-box 총크기 계약 유지 (leaf 최종 크기 = specified 그대로 — `compute_leaf_explicit_px` 기대 120 불변) |
| grid (tree.rs `solve_grid` + grid.rs)    | 트랙 기반 — 아이템 explicit size 소비 지점 미정독 | 구현 Phase 에서 정독 후 동일 변환 적용 (아이템 intrinsic 을 트랙에 주입하는 경로 포함)                              |

`solve_node` 반환값 계약을 "border-box 총크기" 로 주석 명문화한다 (부모 content 슬롯 재사용 시 이중 변환 금지의 기준선).

**계획 단계 추가 발견 (같은 뿌리 형제 결함 — 구현 범위 포함)**: (a) 자식 좌표가 부모 padding/border offset 없이 content 원점 기준 (Taffy 는 border-box 원점 + offset 포함 계약), (b) 컨테이너 explicit 크기가 자식 available 로 무감산 전달, (c) 자식 percent 해석 ctx 가 부모 available 기준 (CSS 는 부모 content box). 셋 다 padding=0 fixture 로 dual-run 미검출 — tree.rs solve_flex/block/grid 에서 함께 정합.

### 4.3 무변경 확인 대상 (설계상 안전 근거)

- **JS 전 층 무변경**: enrich 주입(border-box), applyCommonTaffyStyle, 2-pass, 부모 합산, overflow cap — Taffy 계약 복원이므로 그대로 정합.
- **SPEC_SHAPES_INPUT_TAGS** (utils.ts:4086 — dropdown 류): enrich 가 "전체 시각적 높이" 를 주입 → Taffy 시절과 동일하게 border-box 로 소비되어 복원. 검증 항목에 포함.
- **block.rs auto 경로**: `available - margin` stretch 는 이미 border-box (block.rs:278-280 주석) — 무변경.

## 5. Risks

| ID  | 위험                                                                           | 심각도 | 대응                                                                                                    |
| --- | ------------------------------------------------------------------------------ | :----: | ------------------------------------------------------------------------------------------------------- |
| R1  | 커널 내부에서 specified 와 measured 를 구분 못 하는 지점의 변환 누락/이중 변환 |  HIGH  | 변환을 tree.rs intake 단일 지점으로 한정 + `solve_node` 반환 계약 주석 명문화 + padding≠0 테스트로 확증 |
| R2  | grid 아이템/트랙의 specified size 소비 지점 미확인                             |  MED   | 구현 Phase 첫 단계에서 solve_grid 경로 정독 + grid padding≠0 케이스 테스트                              |
| R3  | min/max clamp 순서 오적용 (content 단계 clamp 시 CSS 와 다른 결과)             |  MED   | border-box 단계 clamp 를 단위 테스트로 고정                                                             |
| R4  | wasm 재빌드 누락으로 stale binary 검증 (측정 함정 기왕력)                      |  MED   | cargo test → wasm rebuild → dev 서버 재시작을 검증 절차에 명시                                          |

## 6. 검증 계획

1. **Rust 단위 테스트**: content-box 를 고정한 기존 테스트(`block_child_explicit_width_adds_padding` 등) 기대값을 border-box 로 flip (100+padding20 → 120 이 아니라 100). `compute_leaf_explicit_px`(120→120) / `compute_leaf_percent` 는 불변 확인.
2. **padding≠0 신규 fixture**: dual-run 이 못 거른 갭 보강 — block/flex/grid 각각 explicit px·percent × padding·border 조합 케이스. Button md 실측 재현 케이스(content 20 + pad 8 + border 2 = 30) 포함.
3. **tree_golden (Chrome 실측 golden N1~N5)**: padding=0 이므로 불변 통과 확인. padding≠0 golden 1건 이상 추가.
4. **빌드 체인**: cargo test → wasm rebuild(stale binary 함정 — mtime 확인) → pnpm build → pnpm type-check.
5. **live 검증 (test PASS 단독 종결 금지)**: 실제 builder 에서 Button xs~xl 높이 = 20/22/30/42/54 확인 (Preview DOM getComputedStyle 대조), 사용자 명시 width 요소 1건, padding 있는 컨테이너(Card 류) 1건.
6. **cross-check 회귀**: padding 보유 컴포넌트 스윕 + CHANGELOG 반영 (사용자-가시 버그 수정 트리거).

## 7. 부차 항목 (본 설계 범위 외, 후속 재평가)

- `calculateContentHeight` 의 `configHeight=0` sentinel 결함 (utils.ts:2385-2457) — 이중 가산과 무관한 잠재 결함. 본 수정 후 재평가.
- 메모리 `project-button-configheight-zero-sentinel-collapse` 의 "0 붕괴" 결론은 반증된 진단 — 정정 필요.
