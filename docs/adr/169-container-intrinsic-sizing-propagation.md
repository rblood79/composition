# ADR-169: 컨테이너 intrinsic 크기 산출 (min/max-content)

## Status

Accepted — 2026-07-27 (리뷰 round 1 승인 — `docs/adr/reviews/169.md`, 이슈 3건 전건 fixed)

## Context

레이아웃 엔진의 flex item 은 자기 **intrinsic 크기**(min-content / max-content)를 알아야 한다. 두 곳이 그 값을 소비한다 — flex base size(`flex-basis:auto` → content)와 CSS-FLEXBOX-1 §4.5 automatic minimum size(floor). ADR-165 는 이 중 **텍스트 leaf** 축을 닫았다: TS 가 폰트 측정으로 스칼라 2종(`contentMinWidth`/`contentMaxWidth`)을 공급하고 엔진이 CSS-SIZING-3 §5 공식을 소유한다.

**컨테이너 item 은 이 채널이 비어 있다.** `solve_flex` 1단계(`tree.rs:1069-1075`)는 각 item 을 **컨테이너 available 로 solve** 하고 그 결과를 `content_main`(off 13, `tree.rs:2423`)에 적는다. 그래서 _스스로 폭을 갖지 않고 늘어나기만 하는 내용_(auto 폭 블록, `width:100%`)이 그 item 의 고유 폭으로 오인된다. 그리고 `content_min_main`(off 19, `tree.rs:2445`)은 TS 텍스트 leaf 스칼라 전용이라 컨테이너에서는 항상 absent → `flex.rs:288-293` 이 `content_main` 으로 fallback 한다. 즉 **available 로 잰 상한 근사가 하한(floor)으로 쓰인다.** 결과적으로 item 이 available 밑으로 내려가지 못하고 형제가 부족분을 전부 뒤집어쓴다.

3-leg 하니스(DOM ground truth / engine / pipeline) 실측에서 **engine ≡ pipeline** 이며 TS 파이프라인 상쇄가 없다. 발산은 **컨테이너 item 에 한정**되고, 그중에서도 **내용이 stretch 로만 늘어난 경우**에만 나타난다 (자식이 진짜로 넓으면 DOM 도 동일하게 형제를 붕괴시킨다). 도달성은 가설이 아니다 — `sidebar-left` / `sidebar-right` / `list-detail` 프리셋(`presetDefinitions.ts:194/229/267`)이 이 형태이고, 고정 슬롯의 `flexShrink:0` 탓에 **붕괴 대신 컨테이너를 sidebar 폭만큼 초과**하는 형태로 지금 나타난다. 실측표는 breakdown §2-2.

**SSOT 3-domain 위치**: D3(시각 스타일)의 **소비 알고리즘 층**이다. catalog/theme/tokens 스키마와 프로토콜 슬롯은 무변경이고, D1(DOM/ARIA)·D2(Props/API)는 무관하다. 본 ADR 이 지키는 것은 D3 의 대칭 정의 — Skia 와 CSS 두 consumer 의 **시각 결과 동일성**이다.

**Hard Constraints**:

1. **성능** — Canvas 60fps 기준. 레이아웃 pass 는 편집마다 돈다. 측정 모드를 캐시 없이 도입하면 중첩 깊이에 **지수적**이므로, 대표 문서 layout pass 시간 회귀가 bench 로 관리돼야 한다.
2. **Chrome 실측 정합** — `apps/builder/tests/parity` 3-leg 하니스에서 발산 0. 착수 시점 baseline 13 files / 105 tests + 신규 7형태.
3. **기존 suite 무회귀** — Rust 단위 324 / `apps/builder` workspace·canvas 867 / `pnpm type-check` 0 error.
4. **프로토콜 슬롯 무변경** — `FLEX_FIELD_COUNT = 20`(`flex.rs:99`), off 13/19 의 의미와 위치를 바꾸지 않는다. 바뀌는 것은 **공급 주체**뿐이다.
5. **측정 주체 경계 유지** — 엔진은 폰트 측정을 하지 않는다 (ADR-164/165 의 "CanvasKit/Canvas 2D = 측정 oracle"). 컨테이너 intrinsic 은 자식 값의 집계·재실행이므로 이 경계를 넘지 않는다.

**Soft Constraints**:

- Rust 엔진 작업 빈도가 낮아 컨텍스트 재적재 비용이 있다 — phase 를 얇게 유지해 각 phase 가 독립 revert 가능해야 한다.
- grid 축 intrinsic 은 실사용이 0건으로 실측된 이력이 있다(ADR-165 Phase 0) — 우선순위를 폭 축 flex 에 둔다.

## Alternatives Considered

### 대안 A: available 3-값 센티넬 확장 + 노드별 측정 캐시

- 설명: `INDEFINITE_AVAIL(-1.0)` 옆에 `MIN_CONTENT_AVAIL(-2.0)` / `MAX_CONTENT_AVAIL(-3.0)` 센티넬을 추가해 `solve_node` 를 측정 모드로 재실행한다. 컨테이너의 intrinsic 은 **자기 알고리즘을 그 모드로 돌린 결과**다. 노드당 `(min, max)` 캐시를 기존 `dirty` 플래그에 종속시켜 무효화한다. 함수 시그니처는 바꾸지 않는다 — 음수 도메인 확장이라 호출부 전수 변경이 없다.
- 근거: 주요 엔진이 모두 이 형태다. **Taffy** 는 `AvailableSpace::{Definite, MinContent, MaxContent}` 로 레이아웃을 재실행하고 노드당 캐시를 둔다. **Yoga** 는 `MeasureMode::{Undefined, Exactly, AtMost}` + 노드별 레이아웃 캐시. **Blink LayoutNG** 는 `ComputeMinMaxSizes` 가 `MinMaxSizes{min,max}` 를 반환하고 결과를 박스에 캐시한다. 공통점은 "**특수 모드로 알고리즘 재실행 + 노드별 캐시**" 이며, 집계 근사로 대체한 엔진은 없다 — flex/grid 의 intrinsic 이 자식 값의 단순 합·최댓값이 아니기 때문이다(CSS-FLEXBOX-1 §9.9.3 은 flex fraction 을 쓴다).
- **정확도 위상 명시 (자기 리뷰 반영)**: A 도 착수 시점에는 §9.9.3 의 완전 구현이 아니다 — "알고리즘을 측정 모드로 재실행" 자체가 근사를 포함한다(R4). B 와의 차이는 _근사인가_ 가 아니라 **근사의 층위**다. A 는 명세와 같은 코드 경로 위에 있어 정밀화할수록 수렴하지만, B 는 display 별 별도 규칙이라 정밀화해도 수렴 경로가 없다.
- 위험:
  - 기술: **M** — 센티넬 도메인 확장은 `INDEFINITE_AVAIL` 선례가 있고 leaf 경로(`resolve_leaf_intrinsic_width`, `tree.rs:1930`)는 이미 min/max-content 키워드를 처리한다. 다만 `solve_*` 3종의 모드 분기와 3.5 재-solve 판정식 갱신이 동반된다.
  - 성능: **M** — 캐시가 필수 전제다. 캐시 없이는 지수적, 캐시가 있으면 pass 당 O(n) 상수배. 상수배의 크기가 실측 전이므로 M.
  - 유지보수: **L** — 3개 엔진이 공유하는 표준 패턴이라 규칙 문서화와 후속 인수인계가 쉽다.
  - 마이그레이션: **L** — 엔진 내부 변경. 프로토콜 슬롯·TS 계약 무변경이라 phase 단위 revert 가 깨끗하다.

### 대안 B: bottom-up 집계 근사 (추가 solve 없음)

- 설명: 각 노드가 자기 solve 중에 `(min_content_w, max_content_w)` 를 display 별 규칙으로 집계해 올린다 (block → max, flex row → 합, column → max, grid → 트랙별 합). 추가 solve 0회, O(n).
- 근거: GUI 툴킷의 size-request 전파 방식이다 — GTK `get_preferred_width`, Qt `sizeHint`/`minimumSizeHint`. 자체 박스 모델을 쓰는 툴킷에서는 이 집계가 곧 정본이라 근사가 아니다.
- 위험:
  - 기술: **M** — 구현 자체는 단순하다.
  - 성능: **L** — 추가 solve 가 없어 가장 싸다.
  - 유지보수: **H** — CSS 와 다른 근사 규칙을 display 마다 손으로 유지해야 한다. GTK/Qt 는 CSS 정합이 목표가 아니라 근사가 정본이지만, 본 엔진은 "CSS 표준 의미론은 엔진 소유"(ADR-164 Decision)가 원칙이라 **근사는 곧 발산 잔존**이고 "왜 여기만 어긋나지" 조사가 반복된다. §9.9.3(flex fraction)·grid track sizing 과 어긋나는 지점이 계속 나온다.
  - 마이그레이션: **L**
- **Risk Threshold 루프 산물**: 대안 A 의 성능 위험(M)을 회피하려는 시도로 추가한 대안이다.

### 대안 C: §4.5 floor 만 정정 (base size 채널 유지)

- 설명: 부작용이 가장 큰 floor 채널만 실제 min-content 로 바꾸고, base size 는 현행 "available 로 잰 값" 을 유지한다.
- 근거: 실측 기반 부분 대응 — 신고된 프리셋 형태(base 가 `flex:1` 로 이미 0%)는 floor 만 고쳐도 정확해진다(breakdown §2-2 마지막 행).
- 위험:
  - 기술: **L** — 변경 범위가 가장 좁다.
  - 성능: **M** — 측정 1회가 여전히 추가된다. 캐시가 없으면 2^depth.
  - 유지보수: **H** — base size 채널이 틀린 채 남아 일부 형태에서 20~30px 발산이 잔존한다(실측: `width:100%` 자식 형태 240 vs 213). 원인이 같은 곳인데 절반만 닫혀 있어 **본 조사와 동일한 비용의 재조사**가 예약된다.
  - 마이그레이션: **L**

### 대안 D: TS 스칼라 채널을 컨테이너로 확장

- 설명: ADR-165 방식 그대로, TS 가 컨테이너의 min/max-content 도 측정해 스칼라로 공급한다.
- 근거: 기존 채널 재사용이라 엔진 변경이 0 이다.
- 위험:
  - 기술: **H** — TS 가 컨테이너 intrinsic 을 산출하려면 flex/grid/block 알고리즘을 재구현해야 한다.
  - 성능: **M** — JS 측 전수 계산 + WASM 경계 왕복 증가.
  - 유지보수: **C** — 엔진/TS 이중 구현. ADR-164 Decision 이 명시적으로 금지한 "TS 재보정" 의 최대 형태이고, `layout-engine.md` §TS 잔존 계약의 역방향 재침식 금지 조항에 정면으로 걸린다.
  - 마이그레이션: **M**

### Risk Threshold Check

| 대안                       | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| -------------------------- | :--: | :--: | :------: | :----------: | :--------: |
| A. 센티넬 3-값 + 측정 캐시 |  M   |  M   |    L     |      L       |   **0**    |
| B. bottom-up 집계 근사     |  M   |  L   |    H     |      L       |     1      |
| C. floor 만 정정           |  L   |  M   |    H     |      L       |     1      |
| D. TS 스칼라 컨테이너 확장 |  H   |  M   |    C     |      M       |     2      |

**루프 판정**: 대안 A 가 HIGH+ 0개로 threshold 를 통과한다. 추가 루프 불필요. (B 는 A 의 성능 위험 회피 시도로 추가된 1회 루프의 산물이며, 회피 대가로 유지보수 H 를 얻어 순손실이다.)

## Decision

**대안 A: available 3-값 센티넬 확장 + 노드별 측정 캐시**를 선택한다.

선택 근거:

1. **HIGH+ 잔존 0** — 유일하게 threshold 를 통과한다. 남은 M 2개(기술·성능)는 각각 선례(`INDEFINITE_AVAIL` 도메인 확장, leaf 키워드 처리 기존 보유)와 게이트(bench)로 관리 가능한 범위다.
2. **원인 지점에서 닫는다** — 두 소비 채널(off 13 base size / off 19 floor)이 같은 결함에서 나오므로 함께 고쳐야 한다. 실측상 **부분 반영은 역효과**다: max-content 만 정정하면 floor 도 같이 커져 긴 텍스트가 지금보다 크게 넘친다.
3. **경계를 정밀화할 뿐 옮기지 않는다** — 폰트 측정은 TS 에 남고, 구조 집계만 엔진이 가져간다. ADR-164/165 가 세운 "측정 주체 TS / 소비 알고리즘 엔진" 이 깨지지 않는다.
4. **외부 수렴** — Taffy·Yoga·Blink 가 모두 같은 형태를 쓴다. 표준에서 벗어난 자체 근사를 새로 발명하지 않는다.

기각 사유:

- **대안 B 기각**: 성능이 가장 싸지만 CSS 근사를 display 마다 손으로 유지하게 되어 유지보수 H. 기각의 근거는 "A 는 정확하고 B 는 근사" 가 **아니다** — 착수 시점엔 둘 다 근사다(위 정확도 위상). 갈림은 **수렴 경로의 유무**다: A 의 오차는 같은 코드 경로를 명세에 맞춰 조이면 줄어들지만, B 의 오차는 display 별 규칙을 각각 다시 쓰지 않는 한 줄지 않는다. 본 엔진의 원칙(CSS 표준 의미론은 엔진 소유)과도 충돌한다.
- **대안 C 기각**: 같은 원인의 절반만 닫아 20~30px 발산이 잔존하고, 동일 비용의 재조사가 예약된다. 변경 범위가 좁다는 이점이 그 부채를 상쇄하지 못한다.
- **대안 D 기각**: TS 가 레이아웃을 재구현해야 하는 이중 구현. ADR-164 가 금지한 TS 재보정의 최대 형태로 유지보수 CRITICAL.

> 구현 상세: [169-container-intrinsic-sizing-propagation-breakdown.md](design/169-container-intrinsic-sizing-propagation-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                     |   심각도    | 대응                                                                                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 측정 모드가 캐시 없이 도입되어 중첩 깊이에 지수적 비용                                                                                                                                                                                                                                                                                                                                   |     MED     | G4 — 캐시를 Phase 1 필수 구성요소로 고정, bench 회귀 게이트 없이 Phase 2 진입 차단                                                                                                                                                                     |
| R2  | 두 채널 중 한쪽만 반영된 중간 상태가 커밋되어 긴 텍스트 초과가 **악화**                                                                                                                                                                                                                                                                                                                  |     MED     | G3 — 부분 반영 금지를 fixture 로 집행 (max-content 단독 상태에서 red 를 유지하는 케이스 포함)                                                                                                                                                          |
| R3  | 센티넬 추가가 기존 indefinite 경로의 음수 판정(`avail < 0`)을 오염시켜 무관한 shrink-to-fit 회귀                                                                                                                                                                                                                                                                                         |     MED     | G1 — Phase 1 을 동작 무변경 리팩터로 두고 전 suite green 확인 후 Phase 2 진입                                                                                                                                                                          |
| R4  | flex intrinsic 을 §9.9.3 완전 구현이 아닌 근사로 두었을 때의 잔존 발산이 문서화되지 않아 후속 오진                                                                                                                                                                                                                                                                                       |     MED     | G2 — fixture 통과 범위와 잔존 형태를 breakdown §6 에 실측 수치로 명문화                                                                                                                                                                                |
| R5  | grid 축이 이연된 사실이 잊혀 "엔진이 intrinsic 을 갖췄다" 는 과잉 전제로 후속 ADR 이 작성됨                                                                                                                                                                                                                                                                                              |     LOW     | G5 — Phase 3 판정 결과(포함/이연)를 재개 조건과 함께 `layout-engine.md` 에 기록                                                                                                                                                                        |
| R6  | height 축(column main)이 ADR-165 의 2-pass 축소 계약과 겹쳐 폭 축 변경이 재줄바꿈 계약을 잠식                                                                                                                                                                                                                                                                                            |     LOW     | G6 — 본 ADR 범위를 폭 축으로 한정 명시, height 축은 Phase 3 실측 후 별도 판정                                                                                                                                                                          |
| R7  | 기존 문서가 **현재의 잘못된 배치에 맞춰 수동 보정**돼 있으면(초과를 피하려 폭을 직접 지정 등) 수정 후 이중 보정으로 보임                                                                                                                                                                                                                                                                 |     MED     | G2 — 영향 형태를 "flex + auto-main 컨테이너 item" 으로 한정 수식화하고, 프리셋 3종 × 3 breakpoint live 확인에 기존 사용자 문서 표본을 포함. **스키마가 아니라 배치 결과 변경**이라 데이터 migration 은 불필요 — 되돌림이 필요하면 phase revert 로 충분 |
| R8  | **TS `minWidth` 주입이 §4.5 auto-min 을 무력화**해 Phase 2 fix 가 해당 형태에서 masking — `utils.ts:4767-4769` 가 `isFlexChild && style.minWidth == null` 이면 `minWidth = ceiledWidth` 를 주입하고, 그러면 `flex.rs:292` 의 `min_main == AUTO` 가 거짓이 되어 auto-min 분기 자체가 실행되지 않는다. 도달 조건은 `needsWidth`(`utils.ts:4490`) — leaf 태그군 외에 \*\*`width:fit-content | min-content | max-content` 를 선언한 컨테이너**도 포함된다(`utils.ts:4479` "모든 요소에서" 명시). 남겨두면 본 ADR 이 없애려는 "상한을 하한으로" 패턴이 explicit min 채널로 재유입된다                                                                                | MED | Phase 0 fixture 에 `width:fit-content` 컨테이너 item 케이스를 포함해 masking 여부를 먼저 확정하고, Phase 2 에서 이 주입의 존치·축소를 명시 판정 (축소 시 `layout-engine.md` §TS 잔존 계약의 "컨테이너 numeric 선해석" 행 동시 갱신). G2 통과 조건에 편입 |

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                                 | 실패 시 대안                                                   |
| ---- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| G1   | Phase 1 종료 | 센티넬·캐시 도입 후 **동작 무변경** — Rust 324 / parity 105 / builder 867 / type-check 전부 green                                                                                         | 센티넬 도메인 충돌 지점 격리 후 재설계, Phase 2 진입 차단      |
| G2   | Phase 2 종료 | breakdown §2-2 발산 7형태가 green, 잔존 형태가 있으면 실측 수치로 명문화. **R8 판정 포함** — `width:fit-content` 컨테이너에서 TS `minWidth` 주입의 masking 여부와 존치·축소 결론이 기록됨 | 근사 범위를 좁혀 재시도, 또는 §9.9.3 완전 구현으로 승격        |
| G3   | Phase 2 중간 | max-content 단독 반영 상태에서 긴 텍스트 초과가 **확대되지 않음**을 fixture 로 확증                                                                                                       | 두 채널을 단일 커밋으로 묶어 중간 상태 자체를 제거             |
| G4   | Phase 1·4    | bench — **Phase 1 종료 시 baseline 수치와 회귀 상한을 breakdown 에 기록**(상한 미기록 상태로 Phase 2 진입 금지), Phase 4 에서 그 상한 이내임을 확증                                       | 캐시 적중률 개선, 미달 시 대안 B(집계 근사) 로 fallback 재평가 |
| G5   | Phase 3 종료 | grid 축 실사용 실측 기록 + 포함/이연 판정과 재개 조건이 문서에 남음                                                                                                                       | 판정 보류 상태로 Phase 4 진입 금지                             |
| G6   | Phase 4 종료 | `layout-engine.md` §TS 잔존 계약 / §automatic minimum 이 새 경계("폰트 측정 TS / 구조 집계 엔진")로 갱신                                                                                  | 문서 갱신 완료까지 ADR Implemented 승격 보류                   |

## Consequences

### Positive

- `sidebar-left` / `sidebar-right` / `list-detail` 프리셋의 content 슬롯 초과가 소멸하고, `flexShrink:0` 없이 구성한 고정폭 형제의 0 붕괴도 함께 사라진다.
- 컨테이너 flex item 의 base size 와 §4.5 floor 가 CSS 정의와 같은 의미를 갖는다 — "상한 근사를 하한으로 쓰는" 구조가 제거된다.
- ADR-164 ① → ADR-165(leaf) → 본 ADR(컨테이너) 로 intrinsic 축이 닫히고, `layout-engine.md` 의 TS 잔존 계약이 "폰트 측정 = TS / 구조 집계 = 엔진" 으로 더 좁고 명확해진다.
- 노드별 측정 캐시는 향후 grid track sizing·`fit-content` 확장의 공통 기반이 된다.

### Negative

- `tree.rs` 의 `solve_node` / `solve_flex` / `solve_block` / `solve_grid` 가 측정 모드 분기를 갖게 되어 읽기 난도가 올라간다 — 모듈 doc 에 모드 계약을 명시해야 한다.
- 레이아웃 pass 비용이 상수배 증가한다. 캐시로 상환하지만 0 은 아니며, bench 를 상시 게이트로 유지하는 부담이 생긴다.
- 3.5 재-solve 판정식(`tree.rs:1147~`)이 측정 기준 변경에 연동돼 갱신 대상이 된다 — ADR-165 가 축소 계약으로 고정한 영역과 인접해 경계 재확인이 필요하다.
- grid·height 축은 이연되어 "intrinsic 이 부분적으로만 닫혔다" 는 상태가 당분간 유지된다 (R5/R6 로 관리).

## 진행 로그

| Phase | 상태                   | 내용                                                                                                                                                                                   |
| ----- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | Implemented 2026-07-27 | `containerIntrinsic.browser.test.ts` 신설 — 정합 3 (`it`, 회귀 가드) + 발산 4 (`it.fails`, Phase 2 목표) + 파이프라인 leg 1 + R8 판별/대조 4. **R8 masking 실재 확인** (아래 §R8 판정) |
| 1     | Implemented 2026-07-27 | `tree.rs` — `MIN_CONTENT_AVAIL`/`MAX_CONTENT_AVAIL` 센티넬 + `IntrinsicMode` + mutation-generation 측정 캐시 + 스냅샷 복구. **G1 동작 무변경** (Rust 330 / parity 117 / builder 2925 전건 green), **G4 baseline 기록** (`benches/tree_solve.rs`, 깊이 스케일링 상한 포함) |
| 2     | Implemented 2026-07-27 | `solve_flex` 2-b — 컨테이너 item 의 off 13(max-content)/off 19(min-content) 동시 배선. **G2** 발산 7형태 green + **R8 결론 = 축소**(컨테이너 한정 TS `minWidth` 주입 제거, 대조 실험으로 원인 확정), **G3** 단일 커밋 + Rust floor 계약 테스트. 잔존 1건: 파이프라인 중첩 텍스트 1.5px |
| 3     | Implemented 2026-07-27 | grid 축 **이연** 판정 + Phase 2 회귀 1건 차단 — `measure_intrinsic_width` 가 grid 서브트리에 `None` 을 돌려 측정 자체를 포기(가드 없으면 grid item 이 1920 → **0** 붕괴, 토글 실험 2층 확정). **R6 = 결함 부재**(블록 방향은 `height:auto` 가 내용 크기라 형태 자체가 성립 안 함 — K 실측), **R5 해소**(재개 조건을 `layout-engine.md` §컨테이너 intrinsic 에 기록). **G5** |

### R8 판정 — Phase 0 관측 → Phase 2 확정 (2026-07-27)

`width:fit-content` 컨테이너 item 에 stretch 자식을 넣은 판별 케이스에서 **engine leg 와 pipeline leg 의 결과가 다르다**:

| leg                                  | sidebar / content | 해석                           |
| ------------------------------------ | ----------------- | ------------------------------ |
| engine (TS 선계산 미경유)            | 0 / 1920          | 본 ADR 이 고치려는 발산 그대로 |
| pipeline (`calculateFullTreeLayout`) | 236.7 / 1683.3    | TS 선계산이 도달해 배치를 바꿈 |

`growsInFlex`(`utils.ts:4758`)가 `width` 채널을 막으므로 해당 형태에서 작동하는 채널은 `minWidth` 주입(`utils.ts:4767-4769`) 하나다. 즉 `min_main != AUTO` 가 되어 **§4.5 auto-min 분기가 실행되지 않으며, Phase 2 가 off 19 을 정확히 채워도 이 형태에는 도달하지 못한다.** 잔존 3.3px 발산이 그 증거다.

대조군(고정폭 자식)은 두 leg 모두 정합이다 — masking 은 **발산 조건(stretch)이 성립할 때만** 관측된다.

**Phase 2 확정 — 결론은 축소.** 위 두 형태는 Phase 2 의 base size 채널 수정만으로 정합이 되어 masking 을 가리지 못했다(둘 다 `[]`). 하한이 결과를 정하는 형태를 새로 만들어(실텍스트 + `fit-content` + `flexShrink:0` 300 압박) 재보니 **dom 40 / eng 80** 으로 갈렸고, TS `minWidth` 주입을 일시 차단하자 그대로 정합됐다 — **원인이 주입임이 대조로 확정**됐다. Phase 0 이 지목한 메커니즘은 맞았으나 그 근거는 코드 읽기였고, 여기서 실험으로 대체됐다.

주입의 원래 목적은 이제 엔진이 정확 min-content 로 소유하므로 **컨테이너에 한해 제거**했다. leaf 는 존치 — 비텍스트 합성 leaf 의 content 를 엔진은 여전히 모른다 (`layout-engine.md` §TS 잔존 계약).
