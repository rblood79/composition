# ADR-184: canonical mutation 순서 러너 — 신규 경로의 구조적 순서 보증

## Status

Accepted — 2026-08-15 (리뷰 round 1 승인 — MED 1건 fixed, `docs/adr/reviews/184.md`)

## Context

canonical mutation 의 4단 순서 (① canonical document 갱신 → ② store `set` → ③ `_rebuildIndexes` → ④ persist) 는 ADR-116/122 HC #2 ("runtime mutation 은 canonical 을 먼저 갱신") 의 실행 형태이며, 현재 **관례 + 문서 + 사후 정적 가드**로만 강제된다 (`.claude/rules/state-management.md` §"Canonical sync 호출 순서"). 이 방어선은 반복적으로 뚫렸다:

- **역전 잔존 (현재도)**: `instanceActions.ts` 의 `createInstance` / `resetInstanceOverrideField` 가 set 1차 → `syncInstanceElementsToCanonical` 2차 (instanceActions.ts:660, 250 — JSDoc 스스로 "race 회피용 sync 선행" 우회를 기록)
- **사용자-가시 race 실증**: stale canonical 로 elementsMap mirror 를 빌드해 `reusable`/`componentRole` 누락 — 신규 프로젝트에서 origin → copy → paste 시 instance 가 일반 element 로 생성 (수습 커밋 `a859f8b97`/`ee91020c4` — 순서 자체가 아니라 race 만 우회 해소)
- **사후 가드 누적**: history 3분기는 `historyActions.static.test.ts` 의 source-order 정적 가드로 위반 **후에** 잠갔다 (2026-07-15). 위반이 나올 때마다 가드를 추가하는 구조라, 발견 시점이 항상 증상 이후다

**외부 선례**: x-algorithm(2026-08 공개) 의 `candidate-pipeline` — 스테이지 타입(source/hydrator/filter/scorer)을 프레임워크가 정의하고 실행·순서·에러 처리를 러너가 소유해, 비즈니스 로직이 순서를 위반할 방법 자체가 없다. Redux 의 store enhancer/middleware 체인도 같은 구조 (dispatch 파이프라인 순서를 스토어가 소유).

**선행 판정 존중**: 기존 잔존 경로의 순서 반전(이관)은 "회귀 위험 대비 이득 작음"으로 이미 판정돼 있다 (state-management.md 잔존 표, 2026-07-15 — history 경로는 canonical event 로 격리 완료). 본 ADR 은 그 판정을 뒤집지 않는다 — **신규 mutation 경로에 한해** 순서를 구조로 옮겨 위반 누적을 멈추는 것이 목적이다.

**Domain**: D1/D2/D3 어디에도 속하지 않는 state 계층 (builder-system). Spec/Generator 확장 없음 (선차단 #2 해당 없음). canonical 스키마·저장 데이터 무변경 — 사용자 영향 0% (선차단 #3 — BC 훼손 없음).

**Hard Constraints**:

1. 상태 변경 파이프라인 순서 계약 보존: Memory → Index → History (즉시) → DB → Preview (CLAUDE.md §상태 변경 파이프라인)
2. **기존 잔존(역전) 경로 동작 불변** — 이관 0건 (`createInstance` 등 allowlist 고정). 정합 기존 경로도 **G2 파일럿 1건 전환 외에는** diff 를 만들지 않는다 (파일럿은 정합 패턴 경로에서만 선정 — 잔존 allowlist 는 파일럿 대상 아님)
3. 기존 정적 가드 계약 유지 — `historyActions.static.test.ts` source-order 단언 무변경
4. 성능 중립 — 러너는 함수 1겹 (편집 1회 205ms 병력 대비 측정 불가 수준. mutation 은 프레임 hot path 가 아니라 이벤트 경로)

**Soft Constraints**:

- 이원 체계 (기존 = 수동 순서 / 신규 = 러너) 가 일정 기간 공존 — 문서·가드로 혼동 흡수 필요
- wrapper 표면이 이미 다양 (`canonicalMutations.ts` 1841~1992 — merge/set/move/order 6종, 비테스트 호출부 15파일) — 러너 시그니처가 이 다양성을 담아야 함

## Alternatives Considered

### 대안 A: 러너 함수 — 순서를 러너가 소유 (선택)

- 설명: `runCanonicalMutation({ canonical, store, history })` — 스테이지 함수를 받아 canonical → set → rebuild → history → persist 를 러너가 고정 순서로 실행. 신규 mutation 은 러너 경유 의무 (정적 가드로 우회 차단).
- 근거: x-algorithm `candidate-pipeline` (러너가 실행 소유 → 순서 위반이 표현 불가) / Redux dispatch 파이프라인 관례.
- 위험:
  - 기술: M — 시그니처가 기존 패턴 다양성 (batch / projection 경유 / history 이벤트 유형) 을 못 담으면 우회가 합법화됨 (R1, G1 로 관리)
  - 성능: L — 함수 1겹, 이벤트 경로
  - 유지보수: M — 이원 체계 공존 기간의 혼동 (문서 + allowlist 고정으로 흡수)
  - 마이그레이션: L — 신규 경로 한정이라 기존 diff 0. 러너 폐기 시 스테이지 함수를 인라인으로 풀면 됨

### 대안 B: AST 기반 정적 규칙 (ESLint custom rule)

- 설명: 파일 내에서 `set(` 호출이 `merge*CanonicalPrimary` 호출보다 앞서면 경고하는 lint 규칙.
- 근거: 순서 계약을 lint 로 잡는 일반 관례 (react-hooks/exhaustive-deps 류).
- 위험:
  - 기술: **H** — 순서 위반의 실제 형태가 **호출 체인을 넘는다**: `createInstance` 는 `set` 뒤에 별도 함수 `syncInstanceElementsToCanonical` 을 부른다. 파일 내 AST 인접성으로는 간접 호출·조건 분기·async 경계를 못 본다 (source-order 정적 가드가 경로별 수작업인 이유와 동일). false negative 가 구조적
  - 성능: L
  - 유지보수: M — 규칙 자체의 AST 유지
  - 마이그레이션: L

### 대안 C: 현상 유지 + 위반별 정적 가드 누적

- 설명: 지금 구조 그대로 — 위반이 발견될 때마다 `historyActions.static.test.ts` 형태의 source-order 가드를 추가.
- 근거: 이미 운용 중인 방식 (2026-07-15 history 3분기).
- 위험:
  - 기술: L / 성능: L / 마이그레이션: L
  - 유지보수: **H** — 가드가 위반 **후에만** 생기고 (발견 = 증상 = 사용자-가시 race 이후), 위반 지점마다 개별 테스트 노동 누적. 문제(위반 누적)를 풀지 않고 수습 속도만 유지

### 대안 D: 전면 이관 — 기존 경로까지 러너로

- 설명: 잔존 경로 (`createInstance` 등) 를 포함해 15개 호출부 전부 러너 경유로 재작성.
- 근거: 이원 체계 제거 (일관성 최대).
- 위험:
  - 기술: M
  - 성능: L
  - 유지보수: L (완료 후) — 단일 체계
  - 마이그레이션: **H** — "회귀 위험 대비 이득 작음" 기존 판정의 정면 반전. instance 계열은 history 가 canonical event 로 격리돼 실질 위험이 이미 낮아진 상태라, 이관의 한계 이득이 회귀 위험을 못 넘는다 (state-management.md 잔존 표 근거 그대로)

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  M   |  L   |    M     |      L       |     0      |
| B    |  H   |  L   |    M     |      L       |     1      |
| C    |  L   |  L   |    H     |      L       |     1      |
| D    |  M   |  L   |    L     |      H       |     1      |

루프 판정: HIGH 0 인 대안 A 존재 — 추가 대안 루프 불요.

## Decision

**대안 A: 러너 함수 + 우회 차단 정적 가드**를 선택한다. 적용 범위는 **신규 mutation 경로 한정** — 기존 잔존 경로는 allowlist 로 고정하고 이관하지 않는다 (선행 판정 유지).

선택 근거:

1. **위반이 표현 불가가 된다**: 순서를 각 함수가 아니라 러너가 소유하면, set-1차 형태의 위반은 시그니처상 쓸 수 없다. C 의 사후 가드 누적 (증상 이후 발견 + 위반별 테스트 노동) 이 원천 소멸
2. 잔존 위험 (R1 — 시그니처 표현력) 은 Phase 0 인벤토리 + G1 로 착수 초기에 판정된다 — 표현 불가 유형이 나오면 구현 전에 scope 를 재판정하는 순서라 매몰 비용이 없다
3. 신규 한정이라 기존 판정과 충돌 없음 — 마이그레이션 위험 L

기각 사유:

- **대안 B 기각**: 실제 위반 형태 (호출 체인 너머의 간접 sync) 를 AST 인접성이 구조적으로 못 본다 — 기술 HIGH. 잡히는 것은 이미 눈에 보이는 형태뿐
- **대안 C 기각**: 유지보수 HIGH — 발견이 항상 사용자-가시 race 이후이고 가드 노동이 위반 수에 비례. 위반 누적이라는 문제 자체를 풀지 않는다
- **대안 D 기각**: "회귀 위험 대비 이득 작음" 기존 판정의 반전 근거가 없다 — history 격리로 실질 위험이 이미 낮아진 경로의 재작성은 한계 이득 < 회귀 위험. 단 개별 경로에서 race **재발** 시 그 경로 1건만 이관하는 재개 조건을 breakdown 에 명시

> 구현 상세: [184-canonical-mutation-runner-breakdown.md](design/184-canonical-mutation-runner-breakdown.md)

## Risks

| ID  | 위험                                                                                                          | 심각도 | 대응                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------------------------- |
| R1  | 러너 시그니처가 mutation 패턴 다양성 (batch / projection / history 유형) 을 못 담아 신규 경로가 우회를 정당화 |  HIGH  | G1 — Phase 0 인벤토리 (호출부 15파일 전수) 에서 표현 가능률 선판정. 표현 불가 유형 발견 시 시그니처 확장 또는 scope 재판정    |
| R2  | 이원 체계 혼동 — 기존 경로를 보고 신규를 수동 순서로 작성                                                     |  MED   | 우회 차단 정적 가드 (allowlist 밖 wrapper 직호출 FAIL) + state-management.md 규칙 갱신                                        |
| R3  | 부분 실패 semantics 오정의 — canonical 성공 후 set 실패 시 러너가 임의 복구를 발명                            |  MED   | 현행 관례 고정 명문화 (동기 구간 throw 전파 / persist 백그라운드) — 러너는 새 복구 로직을 도입하지 않는다 (breakdown Phase 1) |
| R4  | allowlist 가 자라며 가드 무력화 (기존 경로 목록에 신규가 슬쩍 추가)                                           |  MED   | allowlist 는 Phase 0 시점 고정 + "추가 금지" 를 가드 테스트 주석·rules 에 명시. 추가 시도 자체가 리뷰 대상                    |
| R5  | 러너 오버헤드                                                                                                 |  LOW   | 함수 1겹, 이벤트 경로 — 측정 불요 수준                                                                                        |

## Gates

| Gate | 시점         | 통과 조건                                                                                                                  | 실패 시 대안                                                      |
| ---- | ------------ | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| G1   | Phase 0 종료 | 호출부 15파일 패턴 분류 완료 + 신규에 나타날 패턴 전 유형이 러너 시그니처로 표현 가능                                      | 시그니처 확장 1회 재설계, 재실패 시 scope 재판정 (사용자 surface) |
| G2   | Phase 2 종료 | 파일럿 1경로 러너 전환 + live builder 실측 (mutation 실행 → 새로고침 → canonical/IndexedDB 정합 — 완료 기준 live behavior) | 파일럿 마찰 원인 수리 전 Implemented 승격 금지                    |
| G3   | Phase 3 종료 | 우회 차단 가드 RED 실측 (allowlist 밖 가짜 직호출 주입 → FAIL, 편집 역적용 원복)                                           | 가드 매칭 로직 수리 후 재실측                                     |

## Consequences

### Positive

- 신규 mutation 의 순서 위반이 구조적으로 불가 — stale-canonical race 계열 (reusable/componentRole 누락 형)의 **신규 발생** 원천 차단
- 위반별 사후 정적 가드 노동이 러너 1개 + 우회 가드 1개로 수렴
- 부분 실패 semantics 가 관례에서 명문 계약으로 — 신규 작성자가 경로별 JSDoc 을 고고학하지 않아도 됨

### Negative

- 이원 체계 공존 (기존 15파일 수동 순서 / 신규 러너) — allowlist 고정 + 문서로 관리하나 인지 부담은 잔존
- adapters/canonical 표면 증가 (러너 + 테스트 2종)
- 러너 시그니처가 향후 mutation 유형 진화를 따라가야 함 (R1 의 상시 형태)
