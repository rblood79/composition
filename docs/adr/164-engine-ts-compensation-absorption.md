# ADR-164: 레이아웃 TS 보정 레이어의 엔진 흡수 — automatic minimum size + position:absolute 잔여

## Status

Accepted — 2026-07-24 (리뷰 round 1 승인 — [reviews/164.md](reviews/164.md) 이슈 전건 종결, HIGH/CRITICAL 0)

## Context

**Domain 판정**: D3 (시각 스타일) — Builder(Skia) 레이아웃 경로가 CSS consumer 와 동일 시각 결과를 산출하기 위한 정합 메커니즘. D1(DOM)/D2(Props) 비침범.

composition-engine (Rust WASM, ADR-916 Implemented 2026-07-06) 은 Taffy 대체를 목표로 만들어졌고, 성공 기준이 **Taffy 동등성** (dualRunLive 12/12 diff 0) 이었다. 그 결과 Taffy 시대에 TS 쪽에 쌓인 CSS 의미론 보정 레이어가 엔진 교체 후에도 그대로 상류에 남아 있다 — dual-run diff 0 방법론은 상류 보정이 가로챈 입력 차원에 구조적으로 blind 했다 (두 엔진 모두 보정 후 입력만 받았으므로).

현존 보정 중 본 ADR 대상은 다음이며, 전부 **CSS 표준 의미론을 엔진이 몰라서 TS 가 밖에서 근사하는** 것들이다:

1. **overflow×flexShrink 보정** — `fullTreeLayout.ts:2156` (Step 5.7): 부모 `overflow≠visible` 이면 flex 자식 전원에 `flexShrink: 0` 강제 주입. CSS 실제 의미론(CSS-FLEXBOX-1 §4.5: 자식은 automatic minimum size 밑으로만 shrink 하지 않고, 그 조건도 **item 자신의** overflow 기준)과 다른 **coarse 근사**라 min-content 이상의 정당한 shrink 까지 막는다. 관련 규칙 문서(`layout-engine.md`)는 `TaffyFlexEngine.ts _runTaffyPassRaw` 와의 이중 관리 의무를 명시하나 해당 심볼은 소멸했다 (grep 0건) — 문서-코드 drift 실증.
2. **min-width:auto 에뮬레이션** — `utils.ts:4712` (enrichWithIntrinsicSize): flex 자식에 width 주입 시 `minWidth` 동시 주입. 엔진이 명시 `min_width` 만 해석하고 (`tree.rs:142,507`) automatic minimum size 개념이 없어서다 (`flex.rs` §9.7 분배는 `flex_shrink` 와 명시 min 만 소비).
3. **position:absolute 잔여** — 엔진은 2026-07-14 `67ddfe899` 로 out-of-flow 배치를 구현 완료 (`tree.rs:609~790` solve_node 분리 + `place_absolute_children`, `resolve_abs_axis` 의 양측 inset stretch/margin-auto 센터링/음수 inset). 잔여는 2건: containing block 이 직계 부모 고정 (nearest positioned ancestor 체인 미탐색), `position:fixed` 의 viewport 기준 부재 (absolute 근사). ⚠️ 착수 전 분석이 stale 메모리를 승계해 ④ 전체를 "엔진 미지원" 으로 잘못 분류했던 이력이 있다 — Phase 0 인벤토리 재실측이 필수 선행인 직접 근거.

TS 보정 레이어 규모: `utils.ts` 5,422 + `fullTreeLayout.ts` 3,034 + `implicitStyles.ts` 2,774 = 약 11,230줄 (이 중 본 ADR 제거 대상은 위 보정 지점 한정 — 전체가 아니다).

**Hard Constraints**:

1. **60fps** — 엔진에 추가되는 min-content 재귀 계산이 레이아웃 hot path 프레임 예산을 초과하지 않는다 (기존 bench 기준 회귀 0).
2. **CanvasKit = 텍스트 측정 oracle** — 엔진 자체 텍스트 측정 도입 금지 ("Layout = Canvas 2D = CSS 정합" 규칙). 본 ADR 의 min-content 산출은 **주입된 definite 크기 입력으로부터의 재귀 계산에 한정**하며, 텍스트 재줄바꿈 측정이 필요한 intrinsic sizing 은 범위 밖 (후속 ADR).
3. **기존 parity suite 회귀 0** — ADR-156 Chrome 차등 oracle (`apps/builder/tests/parity/*.browser.test.ts`, DOM `getBoundingClientRect` ground truth) 전 케이스 PASS 유지.
4. **엔진 구현과 TS 보정 제거는 같은 phase** — 엔진이 구현했는데 TS 주입이 남으면 이중 적용, 제거만 먼저 하면 회귀. dormant 인프라(구현됐지만 가동 경로 없음)는 본 프로젝트 반복 확인 함정.

**Soft Constraints**:

- WASM binary protocol 필드 추가 시 3 직렬화 경로 + layoutVersion 5-심볼 2계층 체인 동시 갱신 의무 (`layout-engine.md`).
- 리뷰 피로 전례 (reviews/912 = 16 라운드) — 실행 가능한 크기의 scope 유지가 승인·완주 확률을 좌우.

## Alternatives Considered

### 대안 A: 의미론별 점진 흡수 — automatic minimum size (②③ 통합) + absolute 잔여 (④), intrinsic sizing (①) 은 후속 ADR

- 설명: ②③ 은 같은 명세 조항(CSS-FLEXBOX-1 §4.5)의 두 증상이므로 하나의 엔진 기능(content-based minimum floor, definite 입력 기반 재귀)으로 통합 구현하고, 같은 phase 에서 TS 보정 2곳을 제거. ④ 는 Phase 0 실사용 실측 결과에 따라 구현 또는 "의도적 미지원" 명문화로 종결. 엔진 입력 계약(계산에 필요한 크기가 입력에 정의돼 있음)은 불변.
- 근거: CSS-FLEXBOX-1 §4.5 는 W3C 명세로 알고리즘이 확정적. Taffy/Yoga 등 오픈소스 레이아웃 엔진 모두 automatic minimum size 를 엔진 내부에서 처리하며 상류 보정에 위임하는 구현은 없다. 검증 인프라는 ADR-156 이 이미 구축한 브라우저 실측 차등 oracle 재사용.
- 위험:
  - 기술: **M** — §4.5 명세 기반이라 알고리즘 불확실성 낮음. min-content 재귀는 기존 solve_node 구조 확장. 단 shrink 분배 알고리즘(§9.7)과의 상호작용(scaled factor, 동결 루프)에 edge case 존재.
  - 성능: **M** — min-content 산출 추가 패스. definite 입력 재귀라 O(n), bench 로 확증 필요.
  - 유지보수: **L** — TS 보정 2곳 + stale 문서 소멸. 명세 조항과 1:1 이라 향후 변경 근거가 자명.
  - 마이그레이션: **M** — Step 5.7 coarse 근사 → 명세 의미론 전환으로 기존 문서의 shrink 결과가 달라질 수 있음 (영향 조건: overflow≠visible flex 컨테이너 + 자식 flexShrink 미명시 + min-content < 현재 배치폭 — Phase 0 에서 해당 조합 실측 수식화). 저장 스키마·문서 데이터 무변경 (재직렬화 0 — 레이아웃 계산 결과만 변화). phase 단위 revert 가능.

### 대안 B: intrinsic sizing (①) 포함 전면 개편 — 측정 계약 재설계까지 한 ADR

- 설명: automatic minimum size 에 더해 fit-content/min-content 텍스트 자동측정까지 엔진이 소유. 레이아웃 도중 "이 텍스트는 폭 W 에서 얼마인가" 를 물을 수 있어야 하므로 입력 계약 변경 필수 — (a) Rust→JS→CanvasKit measure 콜백 (Taffy 의 measure function 패턴) 또는 (b) 측정 테이블 선주입. 2-pass Step 4.5·사전 enrichment DFS 메커니즘 자체가 소멸 가능.
- 근거: Taffy 는 measure function 으로 leaf 측정을 위임하는 선례가 있음. 그러나 CanvasKit 이 별도 WASM 모듈이라 레이아웃 hot path 한가운데 Rust→JS→WASM 왕복이 들어가는 구조는 선례 부재.
- 위험:
  - 기술: **H** — wasm-bindgen 재진입 콜백 또는 측정 예측 선주입(닭-달걀) 중 택일 자체가 대안 비교가 필요한 미검증 설계. CanvasKit oracle 제약과의 정합 설계 복잡.
  - 성능: **H** — 60fps hot path 내 경계 왕복. 측정 호출 수가 트리 크기×재배치 횟수에 비례.
  - 유지보수: **M** — 성공 시 TS 레이어 대폭 축소. 실패 시 두 계약 공존.
  - 마이그레이션: **H** — 입력 계약 변경이라 롤백 표면이 엔진 소비자 전체. 전 컴포넌트 sizing 동시 영향.

### 대안 C: 현상 유지 — TS 보정 레이어 존치 + 문서만 정정

- 설명: 코드는 그대로 두고 stale 문서(`_runTaffyPassRaw` 등)만 정정, 보정 레이어를 공식 경계로 승격.
- 근거: 현행이 동작 중이며 회귀 위험 0. 그러나 Step 5.7 근사는 CSS 와 이미 발산 상태(min-content 이상의 shrink 차단)이고, 오늘까지 하루 4건의 동형 결함(클립 계열)이 "경계 부재 + 소비자별 산재 보정" 구조에서 나왔다는 실증이 있다.
- 위험:
  - 기술: **L** — 변경 없음.
  - 성능: **L** — 변경 없음.
  - 유지보수: **H** — 11K 레이어의 이중 의미론(명세 vs 근사) 영구화. 문서-코드 drift 재발 구조 존치. 후속 세션이 같은 gap 을 재발견·재보정하는 비용 반복.
  - 마이그레이션: **L** — 변경 없음.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  M   |  M   |    L     |      M       |     0      |
| B    |  H   |  H   |    M     |      H       |     3      |
| C    |  L   |  L   |    H     |      L       |     1      |

루프 판정: 대안 A 가 HIGH 0 으로 통과 — B 의 HIGH 3축을 회피하는 축소안이 곧 A 이므로 추가 대안 불요. C 의 유지보수 HIGH 는 구조적(발산 영구화)이라 수용 불가.

## Decision

**대안 A: 의미론별 점진 흡수**를 선택한다.

선택 근거:

1. **위험 수용 근거** — 잔존 위험은 마이그레이션 M (기존 문서 shrink 결과 변화) 하나가 실질인데, 이는 "근사 → 명세 정합화" 라는 본 ADR 의 목적 그 자체이며, Phase 0 영향 조합 실측 + ADR-156 브라우저 oracle fixture + phase 단위 revert 로 관리 가능하다.
2. ②③ 을 하나의 명세 기능으로 통합하면 TS 보정 2곳이 같은 phase 에 소멸해 이중 적용/dormant 창이 열리지 않는다 (Hard Constraint 4).
3. ④ 는 조건부 규칙으로 종결한다: **Phase 0 실측에서 containing block 조상 체인·fixed 실사용이 0건이면 "의도적 미지원" 을 엔진 doc comment + 규칙 문서에 명문화하고 종결, 실사용이 있으면 해당 축만 구현**한다. 어느 쪽이든 본 ADR 안에서 닫힌다.

기각 사유:

- **대안 B 기각**: 측정 계약 재설계(콜백 vs 선주입 테이블)는 그 자체가 독립된 위험 평가와 대안 비교를 받아야 할 설계 문제다. 본 ADR 에 섞으면 HIGH 3축을 짊어진 채 리뷰가 길어지고 (reviews/912 = 16 라운드 전례), ②③④ 의 확실한 이득까지 인질이 된다. ① 은 후속 ADR 로 분리하되 본 ADR 의 §4.5 floor 구현이 그 선행 기반(content minimum 소비 지점)이 된다 — Consequences 에 체인 기록.
- **대안 C 기각**: Step 5.7 은 이미 CSS 와 발산한 근사이고, 보정 레이어 존치는 문서-코드 drift 와 재보정 비용을 구조적으로 재생산한다. "동작 중" 은 정합의 증거가 아니다 (dual-run blind 실증).

> 구현 상세: [164-engine-ts-compensation-absorption-breakdown.md](design/164-engine-ts-compensation-absorption-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                   | 심각도 | 대응                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------- |
| R1  | 명세 정합화로 기존 문서의 shrink 결과 변화 (조건: overflow≠visible flex 컨테이너 + 자식 flexShrink 미명시 + min-content < 배치폭 — `fullTreeLayout.ts:2156` 제거 영향) |  HIGH  | Phase 0 에서 해당 조합 실측 수식화 → G1 fixture + G4 live sweep. phase 단위 revert |
| R2  | 엔진 구현 ↔ TS 제거 phase 불일치 (이중 적용 또는 dormant — `utils.ts:4712` / `fullTreeLayout.ts:2156` / `flex.rs` §9.7 소비부 3지점 동기 필요)                         |  HIGH  | 같은 phase 원칙 (Hard Constraint 4) + G2 grep gate                                 |
| R3  | min-content 재귀의 성능 (깊은 트리에서 추가 패스)                                                                                                                      |  MED   | G3 bench — 기준치 회귀 시 캐시/단일 패스 통합 후 재측정                            |
| R4  | 후속 세션의 경계 재침식 (엔진 gap 을 TS 보정으로 다시 메움)                                                                                                            |  MED   | Phase 3 "TS 잔존 계약" 을 `layout-engine.md` 에 규칙화 (breakdown §6)              |
| R5  | 규칙 문서 stale 잔존 (`layout-engine.md` 의 소멸 심볼 서술 등)                                                                                                         |  LOW   | Phase 3 개정을 phase 완료 조건에 포함                                              |

## Gates

| Gate | 시점                | 통과 조건                                                                                                                                                                                                                                                                                  | 실패 시 대안                                                           |
| ---- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| G1   | Phase 1 완료        | 신규 parity fixture (ADR-156 harness, **raw style 직행** — 보정 제거 후 입력): scroll 컨테이너 shrink / `flex:1 minWidth:0` / flexShrink 명시 상호작용 / column 축 대칭 — Chrome 실측 대비 diff 0                                                                                          | 해당 케이스 엔진 수정 후 재실행. 명세 해석 쟁점이면 Chrome 실측이 우선 |
| G2   | Phase 1 완료        | TS 보정 제거 grep 0건 (Step 5.7 flexShrink 주입) + 기존 parity·유닛 전체 PASS + type-check baseline 유지. `minWidth = ceiledWidth` 주입은 **leaf content 제안값 전달 채널로 §6 재분류·잔존** (2026-07-25 정정, 사용자 confirm — Phase 1 실측: 엔진은 텍스트 측정 부재로 leaf content 무지) | 제거 커밋 revert 후 엔진 구현 보강 (제거 단독 잔류 금지)               |
| G3   | Phase 1 완료        | 엔진 bench 기준치 회귀 0 (Phase 0 기록치 대비)                                                                                                                                                                                                                                             | 캐시/패스 통합 최적화 후 재측정. 미달 지속 시 floor 계산 lazy 화       |
| G4   | 각 phase 완료       | live builder 1회 exercise (실문서 — R1 영향 조합 포함) + 무엇을 exercise 했는지 완료 보고 명시                                                                                                                                                                                             | 발견 이슈 수정 전 phase 종결 금지                                      |
| G5   | Phase 2 (④) 진입 전 | Phase 0-3 실측 기록 존재 (containing block 조상 체인·fixed 실사용 유무) — Decision 조건부 규칙의 판정 근거                                                                                                                                                                                 | 실측 없이 구현 착수 금지 (stale 분류 재발 방지)                        |

## Consequences

### Positive

- Builder(Skia) 레이아웃이 overflow×shrink·min-width:auto 에서 CSS 명세와 동일 의미론으로 동작 — coarse 근사(flexShrink:0 전면 차단)로 인한 잠재 발산 소멸.
- `fullTreeLayout.ts` Step 5.7 제거 — 부모-overflow 전면 차단 보정과 그 문서 관리 의무(`layout-engine.md` 해당 절) 소멸. `utils.ts` minWidth 동시 주입은 leaf content 제안값 전달 채널로 §6 잔존 계약 편입 (2026-07-25 정정 — ① 이 content 채널을 재설계할 때까지).
- "TS 잔존 계약" 명문화로 엔진↔TS 경계가 규칙이 됨 — 재침식 차단.
- **후속 ADR 체인**: ① intrinsic sizing (측정 계약 재설계 — 콜백 vs 선주입 대안 비교) 은 본 ADR 의 content minimum floor 를 소비 지점으로 활용하는 별도 ADR 로 진행. ⑤ hitBoundsMap Rust 이관은 렌더 레이어 + bench 선행의 독립 후보로 남는다.

### Negative

- 기존 문서 중 R1 조건 조합의 시각 결과가 달라질 수 있다 (명세 정합 방향의 의도된 변화 — G1/G4 로 관리).
- `packages/composition-engine` 에 min-content 재귀 코드가 추가되어 flex 알고리즘 복잡도 증가 (§4.5 명세 1:1 이라 근거는 자명).
- ① 이 후속으로 남는 동안 enrichWithIntrinsicSize 의 width 주입·2-pass Step 4.5 는 존속 — TS 레이어 축소 폭은 보정 지점 한정 (수천 줄 소멸은 ① 의 몫).

## 진행 로그

- **2026-07-24 — Phase 0 (인벤토리 freeze) Implemented**: breakdown §7 을 실측으로 교체. 핵심 실측 3건 — (1) ④ 실사용 **0건** (factory absolute/fixed 0건 + Inspector position 편집 UI 미노출) → Phase 2 는 Decision 조건부 규칙상 "의도적 미지원 명문화" 경로, G5 근거 확보. (2) 전용 bench harness **부재** → G3 판정 수단을 Phase 1 criterion micro-bench 신설 + floor 도입 직전 기준치 측정으로 구체화 (breakdown §3-3). (3) baseline: parity 74 PASS / cargo 309 PASS / type-check PASS. 코드 무변경 phase 라 G4 live exercise 는 해당 없음 (Phase 1 부터 적용).
- **2026-07-25 — Phase 1 착수 중 G2 재정의 (사용자 confirm)**: 구현 설계 실측에서 엔진이 leaf content 를 알 수 없음을 확정 (`tree.rs:654~664` — width auto leaf 는 0 반환 / explicit 노드 content 슬롯은 border-box 저장이라 신뢰 불가). 텍스트 leaf 의 §4.5 content 제안값은 TS `minWidth` 주입이 유일 전달 채널 → 전부 제거 시 measured leaf 가 tight 컨테이너에서 0 까지 축소되는 회귀. 이에 `minWidth` 동시 주입을 "보정 (제거 대상)" 에서 "**leaf content 제안값 전달 채널 (§6 잔존 계약)**" 로 재분류하고 G2 grep 을 Step 5.7 축으로 축소. 엔진 §4.5 floor 는 **width auto item 한정 content_main** (신뢰 가능한 유일 케이스) + item overflow 조건으로 구현. Step 5.7 제거는 원안 유지 — ADR 의 경계 원칙 (엔진이 §4.5 의미론 소유, TS 는 측정값 공급) 불변.
- **2026-07-25 — Phase 1 (automatic minimum size ②+③) Implemented**: `flex.rs` §4.5 content-based minimum floor (`FLEX_FIELD_COUNT` 18→19, off 18 `overflow_main`; `parse_item` effective min — width-auto item 한정 `content_main` + max clamp) + `tree.rs` `write_flex_item` 주축 overflow 기록 + Step 5.7 제거 + `utils.ts` minWidth 주입 주석 재분류. **검증**: cargo 316 (신규 floor 유닛 7 — 명시 min:0 존중 / clipped 무floor / max clamp / column 대칭 포함) · parity **90/90** (신규 fixture 8케이스 × engine/pipeline 2 leg — d2/d3 content floor 는 Chrome 실측과 diff 0, a/a2 가 R1 본체, e 가 grid no-op 확증) · layout 유닛 299 · type-check PASS. **G1 ✓ G2 ✓** (Step 5.7 flexShrink 주입 grep 0건) **G3 ✓** (bench best-of-N median: S1 15.9→16.7µs / S2 69.1→71.1µs / S3 14.9→15.2µs — 노이즈 밴드 ±10% 이내, S2 는 floor 동결 작업이 추가되고도 +2.9%) **G4 ✓** (live: fresh reload 콘솔 에러 0 + CSS 프리뷰 ↔ Skia 캔버스 ListBox 시각 대칭 + 클릭 선택 박스 330×194·행 가이드라인 bounds 정합 exercise). **반영 경위 특이사항**: 엔진+TS 코드 변경분은 같은 worktree 에서 병렬로 돌던 다른 세션의 커밋 `3045fd979` (panel inset 토글) 가 광범위 add 로 휩쓸어 먼저 push 함 — 해당 커밋 메시지에 ADR-164 서술이 없으므로 본 진행 로그가 정본 추적 기록이다 (병렬 세션은 worktree 격리 권장 — CLAUDE.local.md).
