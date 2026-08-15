# ADR-185: history coverage 계약 — mutation 의 undo 기록 의무화

## Status

Implemented — 2026-08-15

- 리뷰 round 1 승인 (이슈 1건 LOW `fixed`, HIGH/CRITICAL 0 — reviews/185.md) → Accepted → 당일 Phase 0~2 종결
- **Phase 0** (G1 PASS): ADR-184 인벤토리 26 지점 전수 분류 — 기록함 15 / 의도적 생략 5 / 비-mutation 5 / gap 소속 1. gap = G-1 (페이지 생성/삭제) 단독, breakdown §4 freeze. G-2 후보 (resetInstanceOverrideField) 는 `addEntry` :950 실측으로 기각
- **Phase 1** (G2 PASS): 러너 `history` required union (`(result) => void` | `{ skip: 사유 }`) + 빈 사유 fail-fast throw. RED 4 failed 실측 → GREEN 347 tests + type-check 0 신규 위반. live exercise — Select 추가 canonical 85→90/store 77→82 → Cmd+Z 완전 원상 (85/77)
- **Phase 2** (G3 PASS): state-management.md 계약 문단 + gap 목록 링크, iframe ingress 생략 사유 주석, CHANGELOG (계약 도입 + Known gap)

## Context

사용자-가시 mutation 이 **history entry 없이 출시되는 결함 계열**이 반복되고 있다. 이 실패는 조용하다 — 컴파일 에러도, 테스트 실패도, 런타임 에러도 아니며, 발견 시점은 항상 "사용자가 undo 를 눌렀는데 아무 일도 없는" 순간이다.

**재발 실증 4건** (같은 계열, 그중 1건은 현재도 live):

| #   | 경로                  | 상태                                                               | 증거                                                                                                                                                                                                                              |
| --- | --------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 요소 move             | 과거 미기록 → 사후 수리                                            | `stores/elements.ts:1621` 주석 "과거 이 경로는 history 미기록으로 undo 자체가 불가했다"                                                                                                                                           |
| 2   | 복합 컴포넌트 생성    | 미기록 (dead `saveSnapshot` 가드가 조용히 no-op) → 2026-08-15 수리 | `fbedcfcaa` — `factories/utils/elementCreation.ts`                                                                                                                                                                                |
| 3   | 수동 가이드 (ADR-181) | 출시 후 사후 편입                                                  | `b2172cc91` "수동 가이드 히스토리 편입"                                                                                                                                                                                           |
| 4   | **페이지 생성/삭제**  | **현재도 미기록 — undo 불가**                                      | `stores/elements.ts:1264` (`appendPageShell`) / `:1317` (`removePageLocal`) — entry 기록 0건 (`setCurrentPage` 컨텍스트 전환만 존재). entry 유형에 `page-position`(ADR-177)/`page-guide`(ADR-181) 는 있으나 페이지 생성·삭제 없음 |

**구조 원인**: history 기록은 호출부별 opt-in 이고 누락 방어선이 없다. CLAUDE.md 파이프라인 (Memory → Index → **History** → DB) 에서 순서는 [ADR-184](184-canonical-mutation-runner.md) 러너가 소유하게 됐지만, history 스테이지의 **존재 여부**는 여전히 무계약이다 (`canonicalMutationRunner.ts:88` — `history?:` optional).

**의도적 생략은 실재한다** — 그래서 계약은 "전수 기록 강제" 가 아니라 "생략은 명시 사유" 형태여야 한다:

- silent live edit: `overlay/useTextEdit.ts` 의 canonical-only 편집 (commit 시 `updateElementProps` 가 기록)
- caller batch entry: `skipHistory` 옵션 (`stores/utils/elementRemoval.ts:260` — "migration 경로에서 undo 스택 오염 방지") — 상위 호출자가 batch entry 1개로 대신 기록
- 비-mutation: hydration / bridge / undo·redo 재생 (ADR-184 분류 C형 — 러너 대상 자체가 아님)

**SSOT 3-domain 판정**: D1/D2/D3 어느 것에도 관여하지 않는다 — builder-system layer 의 상태 관리 파이프라인 계약 (ADR-163 과 같은 위상). catalog/spec/Generator 확장 없음.

**Fork checkpoint**: ADR-184 (base) 의 응용 확장 — 4 질문 lock-in 과 사용자 confirm (2026-08-15, "계약만 — 수리는 별도") 은 [design breakdown §1](../design/185-history-coverage-contract-breakdown.md) 에 기록.

**Hard Constraints**:

1. 기존 undo/redo 재생 경로 회귀 0 — entry 스키마 / `historyActions` 재생 무변경 (본 ADR 은 기록 **여부** 계약만)
2. ADR-184 러너 기존 호출부 하위 호환 — **비테스트** 이용자 1곳 (`factories/utils/elementCreation.ts:153`, history 함수 이미 제공) 이 **무변경 컴파일 통과** (BC 0% 는 비테스트 소스 기준 — 러너 단위 테스트의 history 생략형 케이스 4곳+ 는 skip 반영 수정 대상, breakdown Phase 1)
3. 의도적 생략 경로 표현 가능 — canonical-only silent edit 신규 경로를 false positive 없이 수용
4. `pnpm type-check` 0 error + 기존 러너 단위 테스트 8건 PASS (history 생략형 케이스는 `{ skip }` 반영 후)

**Soft Constraints**:

- ADR-184 당일 종결 직후라 러너 API 이용자가 1곳뿐 — 시그니처 강화 비용이 최소인 시점
- gap 수리 (페이지 undo 등) 는 본 ADR 비스코프 — 사용자 결정 2026-08-15

## Alternatives Considered

### 대안 A: 감사 1회 + 개별 수리 (메커니즘 없음)

- 설명: 전 mutation 경로의 history 기록 여부를 1회 감사하고, 발견된 gap 을 개별 버그 수정으로 처리. 계약/집행 장치는 도입하지 않는다.
- 근거: 지금까지의 사실상 방식 — 실증 1~3 건이 전부 이 방식 (증상 발견 → 사후 수리) 으로 처리됐다.
- 위험:
  - 기술: L — 신규 코드 없음
  - 성능: L — 영향 없음
  - 유지보수: **H** — 재발 차단 장치가 없다. 실증 4 (페이지) 가 이미 "감사 없이는 발견도 안 되는" 현재형 증거이며, 신규 경로가 늘 때마다 같은 계열이 재발한다
  - 마이그레이션: L — 변경 없음

### 대안 B: 러너 history 스테이지 명시 필수화 + 감사 + gap 목록 freeze

- 설명: ADR-184 러너의 `history` 를 optional 에서 **required union** (`(result) => void` 또는 `{ skip: 사유 }`) 으로 강화 — 신규 mutation 경로에서 조용한 생략이 타입상 표현 불가. 기존 경로는 1회 감사로 분류 (기록함 / 의도적 생략 / gap) 하고 gap 목록을 수리 백로그 정본으로 freeze.
- 근거: 업계에서 undo 신뢰성이 높은 시스템 (Redux undo 계열, event-sourcing/CRDT 기반 편집기) 은 기록을 파이프라인 구조에 내장해 누락이 표현 불가하다. ADR-184 가 같은 형태 ("순서를 시그니처로") 를 당일 검증 완료 — 본 안은 그 시그니처의 한 필드를 강화하는 최소 확장.
- 위험:
  - 기술: L — 타입 union 1개 + 실행부 분기 1개
  - 성능: L — 타입 수준 집행, 런타임 비용 0 (skip 은 no-op)
  - 유지보수: M — `{ skip: 사유 }` 남용 가능성 (사유 필수 + 리뷰 규율로 완화)
  - 마이그레이션: L — 기존 호출부 1곳 무변경 통과 (HC 2)

### 대안 C: dev 런타임 감지 (canonical 변경 + entry 부재 경고)

- 설명: dev 모드에서 canonical document 변경을 감시하고, 같은 처리 구간에 history entry 가 없으면 console.warn. 관측 기반 (Sentry 형) 커버리지.
- 근거: 타입이 닿지 않는 기존 경로까지 커버 가능 — 정밀도가 가장 높은 접근.
- 위험:
  - 기술: M — undo/redo 재생·hydration·bridge (ADR-184 C형 비-mutation) 를 mutation 과 구분해야 오탐이 없다 — 구분 신호가 현행 코드에 없음
  - 성능: M — 문서 변경 감시 훅이 편집 hot path 에 상주
  - 유지보수: **H** — 오탐 mute 목록이 두 번째 allowlist 가 되어 관리 비용이 계약 자체보다 커진다
  - 마이그레이션: L — 기존 코드 무변경

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | L    | L    | **H**    | L            |     1      |
| B    | L    | L    | M        | L            |     0      |
| C    | M    | M    | **H**    | L            |     1      |

루프 판정: HIGH 0 인 대안 B 존재 — 추가 대안 불요.

## Decision

**대안 B: 러너 history 스테이지 명시 필수화 + 감사 + gap 목록 freeze** 를 선택한다.

선택 근거:

1. **잔존 위험이 유일하게 HIGH 0** — 집행이 타입 수준이라 런타임 비용과 오탐이 없고, 기존 호출부 1곳이 무변경 통과라 마이그레이션 부담도 없다.
2. **ADR-184 와 한 몸의 집행 지점** — 순서 (184) 와 기록 여부 (본 ADR) 가 같은 러너 시그니처에서 집행되어, 신규 mutation 작성자가 만나는 계약이 한 곳이다.
3. **의도적 생략을 1급으로 표현** — `{ skip: 사유 }` 가 silent live edit 같은 정당 경로를 막지 않으면서 "왜 기록하지 않는가" 를 코드에 남긴다 (조용한 생략 → 명시된 생략).

기각 사유:

- **대안 A 기각**: 재발 차단 장치가 없다 — 실증 1~3 이 이 방식의 결과이고, 실증 4 (페이지) 는 이 방식으로는 발견조차 안 되던 현재형 gap 이다.
- **대안 C 기각**: mutation/비-mutation 구분 신호 부재로 오탐 관리 비용 (mute 목록 = 제 2 allowlist) 이 계약 가치를 잠식한다. 타입 집행 (B) 이 신규 경로를 막은 뒤에도 필요성이 남으면 후속 판정.

> 구현 상세: [185-history-coverage-contract-breakdown.md](../design/185-history-coverage-contract-breakdown.md)

## Risks

| ID  | 위험                                                                               | 심각도 | 대응                                                                                                                            |
| --- | ---------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 기존 allowlist 15파일 내부의 신규 mutation 함수는 타입 집행 밖 (ADR-184 구멍 승계) |  MED   | 신규 **파일**은 184 정적 가드가 러너로 강제. 같은 파일 내 추가는 리뷰 신호 (184 R4 동형 — allowlist 추가 시도 자체가 리뷰 대상) |
| R2  | gap 수리 지연 — 페이지 생성/삭제 undo 불가가 백로그로 잔존                         |  MED   | Phase 0 gap 목록 freeze (breakdown §4-2 정본) + CHANGELOG Known 가시화. 수리는 별도 진행 (사용자 결정 2026-08-15)               |
| R3  | `{ skip: 사유 }` 형식적 남용                                                       |  LOW   | 사유 문자열 필수 (빈 문자열 런타임 throw) + 리뷰 규율                                                                           |
| R4  | 시그니처 강화가 향후 러너 이용 확산에 마찰                                         |  LOW   | skip 1줄로 비용 극소 — 파일럿 실측 무변경 통과 (HC 2)                                                                           |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                              | 실패 시 대안                       |
| ---- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| G1   | Phase 0 종료 | ADR-184 인벤토리 26 지점 전수 분류 (기록함 / 의도적 생략+사유 / gap) + gap 목록 freeze (각 gap 에 사용자-가시 증상 1줄)                                | 분류 불가 지점 발견 → scope 재판정 |
| G2   | Phase 1 종료 | type-check 0 + 러너 단위 테스트 (기존 8 + skip/빈 사유/`@ts-expect-error` 생략 불가) PASS + 파일럿 live undo 1회 exercise (복합 컴포넌트 추가 → Cmd+Z) | 시그니처 마찰 2회 이상 → G1 재판정 |
| G3   | Phase 2 종료 | state-management.md 계약 절 + gap 목록 링크 + CHANGELOG (계약 도입 + Known gap)                                                                        | — (문서 gate)                      |

## Consequences

### Positive

- 신규 mutation 경로에서 "history 기록을 잊는" 실패 모드가 타입 에러로 전환 — 발견 시점이 사용자 undo 에서 컴파일 시점으로 앞당겨진다
- 조용한 생략이 명시된 생략 (`{ skip: 사유 }`) 으로 바뀌어 리뷰에서 판독 가능
- Phase 0 감사가 페이지 생성/삭제를 포함한 gap 목록을 정본화 — 수리 백로그가 증상 신고 의존에서 벗어난다

### Negative

- 신규 mutation 작성 시 history 의사결정이 강제된다 — 기록하지 않을 경우에도 skip 1줄 필요 (의도된 마찰)
- 기존 allowlist 경로의 gap 은 본 ADR 이 직접 수리하지 않는다 — R2 백로그 관리 필요
