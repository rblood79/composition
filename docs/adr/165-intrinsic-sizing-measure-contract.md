# ADR-165: 레이아웃 intrinsic sizing 측정 계약 — min/max-content 스칼라 공급 + 엔진 fit-content 소유

## Status

Proposed — 2026-07-25 (ADR-164 Consequences "후속 ADR 체인" ① — 사용자 요청으로 작성. **Phase 실행은 사용자 승인 후 시작**)

## Context

**Domain 판정**: D3 (시각 스타일) — Builder(Skia) 레이아웃 경로가 CSS consumer 와 동일 시각 결과를 산출하기 위한 정합 메커니즘. D1(DOM)/D2(Props) 비침범. Spec/Generator 확장 아님 (catalog/Generator emit 질문 해당 없음 — 엔진 내부 구현 계층).

[ADR-164](completed/164-engine-ts-compensation-absorption.md)(Implemented 2026-07-25) 가 automatic minimum size 를 엔진에 흡수하면서, intrinsic sizing (fit-content/min-content/max-content + height-for-width 재줄바꿈) 은 측정 계약 재설계가 필요하다는 이유로 후속 ADR 로 분리했다 (대안 B 기각 — 기술/성능/마이그레이션 HIGH 3축). 본 ADR 이 그 후속이다. 현행 구조:

1. **사전 enrichment 폭 주입** — `utils.ts:4437` `enrichWithIntrinsicSize`: 텍스트 leaf 폭을 CanvasKit 측정으로 선주입. §4.5 content 하한은 **단일줄 측정폭(ceil) 상한 근사** 라 재줄바꿈 케이스에서 CSS 대비 덜 shrink 하는 발산이 명문화돼 있다 (ADR-164 breakdown §7 0-2 역방향).
2. **2-pass Step 4.5** — `fullTreeLayout.ts:2466`: 배치 폭이 enrichment 가정 폭과 다르면 재측정 → 재계산 (측정-배치 닭-달걀의 범용 우회 장치).
3. **엔진 센티널 dormant gap** — `packages/composition-engine/src/style.rs:26~30/299~301` 이 `FIT_CONTENT(-2)/MIN_CONTENT(-3)/MAX_CONTENT(-4)` 를 파싱하나, `tree.rs:2339~2364` 는 FIT_CONTENT 를 block 경로에서 부분 통과시킬 뿐 MIN/MAX_CONTENT 소비는 **0건** (tree/flex/block/grid.rs 전수 grep) — 키워드가 파싱되고 소비되지 않는다.
4. **grid intrinsic 계열 위임** — ADR-164 breakdown §2/§3 이 grid item automatic minimum (CSS-GRID-1 §6.6)·intrinsic track (min/max-content — `grid.rs` 미구현, 현행 0 폴백) 을 "① 후속과 동반" 으로 본 ADR 에 위임했다. 본 ADR 의 스칼라 공급이 곧 grid track sizing 이 요구하는 입력이다 (처분은 Decision 조건부 규칙).

**Hard Constraints**:

1. **CanvasKit = 측정 oracle 불변** — 엔진 자체 텍스트 측정 도입 금지 ("Layout = Canvas 2D = CSS 정합"). 측정 **주체** 는 TS, 이관 대상은 측정값의 **소비 알고리즘** 뿐 (ADR-164 HC2 승계).
2. **60fps + bench 회귀 0** — 기준치: `benches/flex_shrink.rs` S1 16.7µs / S2 71.1µs / S3 15.2µs (ADR-164 도입 후).
3. **기존 parity suite 회귀 0** — ADR-156 Chrome 차등 oracle + ADR-164 `autoMin.browser.test.ts` 전 케이스 (90) PASS 유지.
4. **WASM Paragraph 객체 캐싱 금지** — 결과 스칼라만 LRU (`canvaskitTextMeasurer.ts:130~`, canvas-rendering 규칙).
5. **공급·소비·축소 같은 phase** — 측정 공급(TS)·프로토콜 필드·엔진 소비·enrichment 축소가 phase 를 어긋나면 dormant 또는 이중 적용 (ADR-164 HC4 승계).

**Soft Constraints**:

- 저장 스키마(canonical document) 무변경 — 레이아웃 계산 결과만 변화 (재직렬화 0, BC 0%). 사용자-가시 변화 조건은 {min-content 이하 shrink 압박 ∧ 다단어 텍스트 leaf} 조합 한정 — Phase 0 에서 실측 수식화.
- 프로토콜/NodeStyle 필드 추가 시 layout-engine.md 5-심볼 2계층 체인 + 직렬화 경로 동시 갱신 의무.

## Alternatives Considered

### 대안 A: 재진입 measure callback — 레이아웃 도중 Rust→JS→CanvasKit 질의

- 설명: Taffy `compute_layout_with_measure` / Yoga measure function 패턴. 엔진이 배치 도중 (nodeId, availableWidth) → {width,height} 콜백 질의. 2-pass 소멸 가능.
- 근거: Taffy/Yoga 의 확립된 선례. 단 두 엔진 모두 measure 대상과 레이아웃이 **같은 모듈 경계 안** — composition 은 CanvasKit 이 별도 WASM 이라 Rust WASM→JS→CanvasKit WASM 이중 경계 왕복이며 이 구조는 선례 부재 (ADR-164 대안 B 평가 승계).
- 위험:
  - 기술: **H** — wasm-bindgen 재진입 + 이중 WASM 경계 + "완전한 입력 → 순수 계산" flat f32 batch 아키텍처의 구조 전환.
  - 성능: **H** — hot path 내 경계 왕복, 캐시 미스 시 paragraph layout 수십 µs × leaf 수 × 재배치 횟수.
  - 유지보수: **M** — 성공 시 2-pass 소멸로 TS 레이어 대폭 축소.
  - 마이그레이션: **H** — 입력 계약 전면 변경, 롤백 표면이 엔진 소비자 전체.

### 대안 B: 측정 테이블 선주입 — leaf 별 후보 폭 → 크기 곡선

- 설명: TS 가 leaf 별 {후보 폭 집합 → 측정값} 테이블을 선계산해 batch 에 포함, 엔진이 보간/스텝 소비.
- 근거: 콜백 없이 순수 계산 아키텍처 유지. 그러나 후보 폭 산정 자체가 레이아웃 결과에 의존 — 닭-달걀을 해소하지 못하고 granularity 문제로 이동시킨다.
- 위험:
  - 기술: **M** — 테이블 생성/보간 로직.
  - 성능: **M** — 선측정 비용 = 후보 폭 수 × leaf 수 (캐시로 일부 상쇄).
  - 유지보수: **H** — granularity 튜닝 영구 + 보간 근사 오차가 parity 회귀의 상시 원천.
  - 마이그레이션: **M** — 프로토콜 확장 위주, phase revert 가능.

### 대안 C: min/max-content 스칼라 2종 공급 + 엔진 fit-content 공식 소유 (점진)

- 설명: 폭 축 intrinsic 은 스칼라 2종(min-content = 최장 단어 폭 / max-content = 단일줄 폭)으로 완결된다는 성질을 이용 — leaf 당 정확 측정 2회를 프로토콜로 공급하고, 엔진이 CSS-SIZING-3 §5 공식 (`fit-content = clamp(min-content, stretch-fit, max-content)`) + §4.5 floor 의 정확 하한을 소유. height-for-width 재줄바꿈만 2-pass 로 축소 잔존 ("폭 확정 후 높이 1회 재측정" 계약으로 명문화). dormant 센티널 3종의 소비 배선이 곧 구현 표면.
- 근거: CSS-SIZING-3 명세상 폭 intrinsic 은 스칼라 2종으로 결정적 — 명세 조항 단위 흡수라는 ADR-164 대안 A 와 동형 철학. CanvasKit Paragraph API 가 두 스칼라를 직접 제공 (`getMinIntrinsicWidth`/`getMaxIntrinsicWidth`).
- 위험:
  - 기술: **M** — 프로토콜 필드 + 센티널 소비 배선 (파싱은 기존재). §9.7 clamp 상호작용은 ADR-164 fixture 가 이미 커버.
  - 성능: **M** — leaf 당 측정 최대 2회 추가 (동일 문자열·스타일 LRU 재사용, G3 bench 로 확증).
  - 유지보수: **M** — 2-pass 가 축소 계약으로 잔존하나 역할이 단일화됨.
  - 마이그레이션: **M** — 저장 스키마 무변경, phase 단위 revert 가능. 재줄바꿈 결과 변화는 명세 정합 방향 (R1).

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  H   |  H   |    M     |      H       |     3      |
| B    |  M   |  M   |    H     |      M       |     1      |
| C    |  M   |  M   |    M     |      M       |     0      |

루프 판정: 대안 C 가 HIGH 0 으로 통과 — A 의 HIGH 3축을 회피하는 축소안이 곧 C 이므로 추가 대안 불요.

## Decision

**대안 C: min/max-content 스칼라 2종 공급 + 엔진 fit-content 공식 소유**를 선택한다.

선택 근거:

1. **위험 수용 근거** — 잔존 위험의 실질은 재줄바꿈 결과 변화(R1)와 측정 2회 비용(R3)인데, 전자는 "상한 근사 → 명세 정합화" 라는 본 ADR 의 목적 그 자체이고 (Phase 0 수식화 + Chrome oracle fixture + phase revert 로 관리), 후자는 LRU + bench 게이트로 확증한다.
2. 폭 축 intrinsic 은 스칼라 2종으로 명세상 완결되므로, 콜백 재설계(A) 없이 dormant 센티널 소비 배선만으로 fit/min/max-content 를 엔진이 소유할 수 있다 — ADR-164 가 만든 content 소비 지점(floor)의 정밀화이기도 하다.
3. height-for-width 는 2-pass 축소 계약으로 명문화해 잔존 — 그 비용이 실측으로 문제가 될 때만 대안 A 를 별도 ADR 로 재평가한다 (재개 조건 기록, R4).
4. **grid intrinsic 계열 (ADR-164 위임분) 은 조건부 규칙로 닫는다**: Phase 0 실측에서 grid 컨테이너의 min/max-content track·auto track intrinsic 실사용이 0건이면 "의도적 이연" 을 breakdown 에 명문화하고 flex/leaf 축만 진행, 실사용이 있으면 Phase 1 에 `grid.rs` track sizing 의 스칼라 소비를 포함한다 (ADR-164 ④ absolute 잔여와 동형 패턴 — 어느 쪽이든 위임이 본 ADR 안에서 종결된다).

기각 사유:

- **대안 A 기각**: 이중 WASM 경계 재진입은 선례 부재의 구조 전환으로 HIGH 3축 — 폭 축이 스칼라로 해결되는 이상, hot path 왕복을 감수할 필요가 height-for-width 하나뿐인데 그 빈도는 Phase 0 실측 전이며 2-pass 축소 잔존으로 충분히 관리된다.
- **대안 B 기각**: 후보 폭 산정이 레이아웃 의존이라 닭-달걀 미해소 — granularity 튜닝과 보간 오차를 영구 부채로 도입한다.

> 구현 상세: [165-intrinsic-sizing-measure-contract-breakdown.md](design/165-intrinsic-sizing-measure-contract-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                    | 심각도 | 대응                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------ |
| R1  | 정확 min-content 전환으로 재줄바꿈 결과 변화 (조건: min-content 이하 shrink 압박 ∧ 다단어 텍스트 leaf — `utils.ts:4712` 상한 근사 해소) |  HIGH  | Phase 0 실측 수식화 → G1 fixture + G4 live sweep. phase 단위 revert                        |
| R2  | 공급·소비·축소 phase 불일치 (dormant 또는 이중 적용 — `utils.ts:4437` / `style.rs` 센티널 / `tree.rs` 소비부 동기 필요)                 |  HIGH  | 같은 phase 원칙 (Hard Constraint 5) + G2 grep gate                                         |
| R3  | leaf 당 측정 2회 추가 비용 (캐시 미스 시 paragraph layout 반복)                                                                         |  MED   | 결과 스칼라 LRU (Paragraph 비캐시 규칙 유지) + G3 bench — 회귀 시 lazy 측정/캐시 키 정밀화 |
| R4  | 2-pass 잔존을 "미완" 으로 오인한 후속 재침식 (콜백 재도입 시도 또는 TS 재보정)                                                          |  MED   | Phase 3 잔존 계약 갱신 — "height-for-width 1회 재측정" 계약 + 대안 A 재개 조건 명문화      |
| R5  | 규칙 문서 stale (minWidth 채널 서술 등 ADR-164 반영분의 재갱신 누락)                                                                    |  LOW   | Phase 3 개정을 phase 완료 조건에 포함                                                      |

## Gates

| Gate | 시점          | 통과 조건                                                                                                                                                                            | 실패 시 대안                                                           |
| ---- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| G1   | Phase 1 완료  | 신규 parity fixture (재줄바꿈 shrink 정확 하한 / fit-content leaf / max-content — engine+pipeline 2 leg) Chrome 실측 diff 0 + 기존 parity 90 회귀 0                                  | 해당 케이스 엔진 수정 후 재실행. 명세 해석 쟁점이면 Chrome 실측이 우선 |
| G2   | Phase 1 완료  | 공급·소비·축소 동시 반영 grep — enrichment 텍스트 leaf 폭 주입 축소 지점과 엔진 센티널 소비 배선이 같은 push. 이중 적용 0건 + type-check baseline 유지                               | 해당 push revert 후 재구성 (부분 반영 잔류 금지)                       |
| G3   | Phase 1 완료  | bench 회귀 0 (flex_shrink 3 시나리오 + 신규 intrinsic 시나리오, best-of-N median ±10% 이내) + 측정 호출 수 증가분 실측 기록                                                          | LRU 키 정밀화/lazy 측정 후 재측정                                      |
| G4   | 각 phase 완료 | live builder 1회 exercise (R1 영향 조합 실문서 포함) + 무엇을 exercise 했는지 완료 보고 명시                                                                                         | 발견 이슈 수정 전 phase 종결 금지                                      |
| G5   | Phase 0 완료  | Step 4.5 트리거 빈도 + 상한 근사 발산 실사용 케이스 + grid intrinsic track/auto track 실사용 실측 freeze — Phase 2 계약 축소·R1 수식화·Decision 조건부 규칙(선택 근거 4)의 판정 근거 | 실측 없이 Phase 1 착수 금지                                            |

## Consequences

### Positive

- 폭 축 intrinsic (fit/min/max-content) 이 CSS-SIZING-3 명세와 동일 의미론으로 엔진에서 동작 — 단일줄 ceil 상한 근사로 인한 재줄바꿈 발산 (ADR-164 §6 명문화 잔존) 소멸.
- ADR-164 §4.5 floor 의 입력이 정확 min-content 로 승격 — automatic minimum 의 명세 정합 완결.
- dormant 센티널 (MIN/MAX_CONTENT 파싱 후 미소비) 해소 — 파싱-소비 gap 이라는 잠복 함정 제거.
- `layout-engine.md` §"TS 잔존 계약" 의 minWidth 채널 행이 스칼라 계약으로 흡수되고, 2-pass 는 역할이 단일화된 축소 계약으로 명문화 — 경계가 더 좁고 명확해짐.

### Negative

- R1 조건 조합의 시각 결과가 달라질 수 있다 (명세 정합 방향의 의도된 변화 — G1/G4 로 관리).
- leaf 당 측정 최대 2회 추가 — LRU 로 상쇄하나 콜드 케이스 비용 존재 (G3 확증).
- height-for-width 재줄바꿈의 2-pass 는 잔존 — 완전한 단일 pass 는 대안 A 재평가 (별도 ADR, 재개 조건: Phase 0/2 실측에서 2-pass 비용이 프레임 예산을 압박) 의 몫.
