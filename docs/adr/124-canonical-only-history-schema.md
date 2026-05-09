# ADR-124: Canonical-only history entry schema

## Status

Proposed — 2026-05-10

## Context

**SSOT 체인 연계**: 본 ADR은 history persistence boundary에 해당하며, `CompositionDocument` canonical schema (ADR-116)와 runtime canonical-only 전환 (ADR-122)의 직접 후속이다. 3-domain 분할 중 D2(Props/API) 경계 — history entry payload의 API 계약 변경이므로 D3 시각 스타일과는 무관.

**base/응용 분류**: base ADR. ADR-126 Element type deprecate의 prerequisite 중 하나. ADR-123 (cloud schema) / ADR-125 (render input) 와 직교하며, ADR-126과는 강결합.

### 배경

ADR-122는 Builder runtime hot path에서 mutable legacy `Element[]` mirror를 제거하고, canonical selectors/resolved canonical tree를 직접 소비하도록 전환을 완결했다. 그러나 ADR-122 closure note에 명시된 것처럼 history entry payload에는 legacy snapshot field가 잔존한다:

> "legacy `element`/`childElements`/`elements`/`prevElements` snapshot fields는 기존 IndexedDB history entry, update/batch fallback, auto-detach batch 같은 compatibility/fallback 경계를 위해 타입 surface에 남아 있다"

현재 `HistoryEntry.data`는 두 가지 payload 형식이 혼재하는 hybrid schema다:

1. **Canonical event sequence** (ADR-122에서 add/remove/group/ungroup에 적용): `canonicalEvents?: CanonicalHistoryNodeEvent[]`
2. **Legacy snapshot fields** (update/batch fallback 경로에 잔존):
   - `element?: Element` — add/remove 시 단일 요소 스냅샷 (49 라인 사용)
   - `childElements?: Element[]` — remove 시 자식 요소 스냅샷 묶음
   - `elements?: Element[]` — batch/group/ungroup 작업의 요소 배열
   - `prevElements?: Element[]` — batch의 이전 상태 배열
   - `prevElement?: Element` — update의 이전 요소 스냅샷
   - `props/prevProps: ComponentElementProps` — update의 props snapshot

**문제점**:

1. `historyActions.ts`에 legacy snapshot field를 읽는 경로가 123개 이상 존재 (grep `data\.element\b|data\.childElements|data\.elements\b|data\.prevElements`).
2. `update` 타입 entry는 `diff` 기반으로 일부 개선됐지만, fallback 경로에서 `element`/`prevElement` snapshot 전체를 restore하는 코드가 남아있다.
3. `batch` 타입 entry는 `batchUpdates` 배열 (prev/newProps snapshot)을 그대로 저장한다.
4. IndexedDB `composition-history` DB (v1)에 저장된 기존 entry가 legacy snapshot fields를 포함하므로, 세션 복원(session restore) 경로도 legacy 경로를 탄다.
5. `HistoryEntry` 타입 surface에 `element`/`prevElement`/`childElements`/`elements`/`prevElements`/`props`/`prevProps` 가 optional field로 잔존해 있어 신규 코드에서도 잘못된 패턴을 유발한다.

**Hard Constraints**:

1. history undo/redo 정확성: undo/redo 결과가 canonical document를 정확히 복원해야 하며, 데이터 손실 0.
2. IndexedDB upgrade 동안 데이터 손실 0: version upgrade migration이 실패하더라도 기존 history entry 자체는 보존되어야 한다.
3. 세션 복원(browser refresh 후 undo/redo) 동작 유지.
4. 기존 `diff`/`diffs`/`canonicalEvents` 필드는 이미 canonical 형식 — 이 경로는 수정하지 않는다.

**Soft Constraints**:

- Phase 단위로 rollback surface를 최소화한다.
- Supabase `elements` table cloud sync는 이번 ADR scope 밖 (ADR-127 또는 별도 boundary로 분리).
- `update` 타입의 `diff`-first 경로는 이미 canonical 방향 — fallback만 정리한다.

**의존 ADR**:

- ADR-116 (canonical document SSOT) — base
- ADR-118 (children[] SSOT) — base
- ADR-122 (runtime canonical-only 전환, Implemented) — 이 ADR의 직접 predecessor
- ADR-126 (Element type deprecate) — 이 ADR의 successor

## Alternatives Considered

### 대안 A: hybrid schema 유지 (현행 유지)

- 설명: `HistoryEntry.data`에 canonical event sequence와 legacy snapshot field를 계속 공존시킨다. 새로운 entry 유형은 canonical event 우선으로 작성하되, 기존 경로는 건드리지 않는다.
- 위험:
  - 기술: M — `historyActions.ts` 123개 레거시 읽기 경로가 canonical-only 전환 이후에도 영구화된다. ADR-122 residual로 허용한 것이 아니라 별도 정리 없이 고착되는 위험.
  - 성능: L — 현행 유지이므로 성능 변화 없음.
  - 유지보수: H — `HistoryEntry` 타입에 legacy field가 있으면 신규 contributor가 잘못된 패턴을 재사용한다. ADR-126 Element type deprecate 진행 시 `element: Element` 타입 자체를 제거할 수 없어 ADR-126 gate 미통과.
  - 마이그레이션: L — 변경 없음.

### 대안 B: legacy snapshot field 즉시 제거 + 기존 IndexedDB entry 폐기

- 설명: `HistoryEntry.data`에서 legacy snapshot field를 한 번에 삭제하고, IndexedDB DB version을 bump하면서 기존 entry를 모두 폐기(flush)한다. 세션 복원 이력은 초기화됨.
- 위험:
  - 기술: H — undo/redo 경로 전체를 한 번에 재작성해야 하며, 검증 실패 시 rollback surface가 없다. `historyActions.ts` 2,300줄을 한 번에 수정.
  - 성능: L — entry 크기가 줄어 성능 개선 가능하지만 측정 미수행.
  - 유지보수: L — 완료 후 타입이 단순해진다.
  - 마이그레이션: H — 기존 IndexedDB history entry 전체 폐기 → 사용자가 undo/redo 이력을 잃는다. 데이터 손실 hard constraint 위반.

### Risk Threshold Check (1차)

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | L    | H        | L            |     1      |
| B    | H    | L    | L        | H            |     2      |

대안 A/B 모두 HIGH 위험 있음 → 추가 대안 생성 루프 진입.

### 대안 C: canonical event-only schema 도입 + IndexedDB v1→v2 entry conversion (권장)

- 설명:
  1. `HistoryEntry.data`에서 `update`/`batch` 경로를 canonical event sequence(`CanonicalHistoryNodeEvent`)로 확장하여 구조 변경(insert/remove/move) 외 props 변경(update)도 canonical patch event로 표현.
  2. 기존 `diff`/`diffs` 기반 update path를 canonical `update` event로 래핑하는 adapter를 도입.
  3. IndexedDB `composition-history` DB를 v1→v2로 upgrade하면서 기존 entry를 one-shot conversion: `diff` 필드는 canonical `update` event로 변환, `element`/`childElements` snapshot은 `canonicalEvents`로 변환, 변환 불가 entry는 폐기(flush)가 아닌 skip(빈 canonicalEvents로 남김) — undo 시도 시 no-op.
  4. `HistoryEntry.data` 타입에서 `element?`/`prevElement?`/`childElements?`/`elements?`/`prevElements?`/`props?`/`prevProps?` optional field 삭제.
  5. `historyActions.ts`의 legacy snapshot field 읽기 경로 (123개)를 canonical event apply 경로로 전환.
- 위험:
  - 기술: M — `update` entry에 대한 canonical event type을 새로 정의해야 한다. `diff` payload를 canonical patch로 래핑하는 adapter의 정확성이 핵심 위험. 코드 경로: `historyActions.ts:289-350` (undo case "update") / `historyActions.ts:524-545` (batch prevElements/elements) / `historyActions.ts:600-660` (elements batch).
  - 성능: L — diff 기반은 유지하고 wrapper만 추가하므로 성능 영향 최소.
  - 유지보수: L — 완료 후 `HistoryEntry.data`에 `diff`/`diffs`/`canonicalEvents` 세 필드만 남는다.
  - 마이그레이션: M — IndexedDB v2 upgrade migration 로직 작성 필요. 변환 불가 entry는 skip(no-op)으로 처리해 데이터 손실 hard constraint 준수.

### 대안 D: legacy snapshot field만 deprecate, canonical event는 추가 layer로

- 설명: 기존 `element`/`childElements`/`prevElements` field에 `@deprecated` JSDoc 태그를 추가하고 신규 코드에서 사용을 금지하는 eslint rule을 도입한다. 타입 자체는 남기고 점진적으로 0건이 될 때까지 PR별로 제거한다.
- 위험:
  - 기술: L — 코드 변경 최소.
  - 성능: L — 변화 없음.
  - 유지보수: H — `@deprecated`는 타입 제거를 강제하지 않는다. ADR-126 gate 통과를 위한 `Element` 타입 제거가 여전히 불가능하다. 점진적 제거는 정해진 완료 시점 없이 무기한 연장될 위험.
  - 마이그레이션: L — 기존 코드 유지.

### Risk Threshold Check (2차)

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | L    | H        | L            |     1      |
| B    | H    | L    | L        | H            |     2      |
| C    | M    | L    | L        | M            |     0      |
| D    | L    | L    | H        | L            |     1      |

대안 C가 유일하게 HIGH 0개. 루프 종료.

## Decision

**대안 C: canonical event-only schema 도입 + IndexedDB v1→v2 entry conversion**을 선택한다.

선택 근거:

1. ADR-122 residual로 남긴 history payload hybrid를 cleanly 닫는다. runtime mirror가 제거된 이후에도 history payload가 legacy snapshot을 보유하면 ADR-126 Element type deprecate의 gate를 통과할 수 없다.
2. `diff`/`diffs` 기반 기존 최적화를 유지하면서 canonical event type으로 래핑만 추가하므로 성능 영향이 최소화된다.
3. IndexedDB upgrade migration에서 변환 불가 entry를 폐기하지 않고 skip(no-op)으로 처리해 데이터 손실 hard constraint를 준수한다.
4. 완료 후 `HistoryEntry.data`의 타입 surface가 `diff?`/`diffs?`/`canonicalEvents?` 세 필드로 단순화되어 신규 코드의 패턴 재사용 오용 위험을 제거한다.

기각 사유:

- **대안 A 기각**: legacy field 영구화 → ADR-126 prerequisite 미충족. ADR-122가 닫은 runtime mirror를 history payload가 다시 살리는 inconsistency.
- **대안 B 기각**: 기존 IndexedDB history entry 전체 폐기 → 데이터 손실 hard constraint 위반. 코드 변경 surface가 너무 넓어 rollback 불가.
- **대안 D 기각**: `@deprecated` JSDoc은 강제력이 없어 유지보수 HIGH 위험이 해소되지 않는다. ADR-126 Element 타입 제거를 blocking한다.

> 구현 상세: [124-canonical-only-history-schema-breakdown.md](design/124-canonical-only-history-schema-breakdown.md)

## Risks

| ID  | 위험                                                                                                   | 심각도 | 대응                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------ | :----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `update` canonical event type 정의 오류 — props 변경이 undo/redo 시 partial 복원되거나 순서가 뒤집힌다 |  MED   | Phase 1에서 `CanonicalUpdateEvent` 타입 + apply 함수를 isolated unit test로 먼저 검증. `historyActions.diff.test.ts`에 canonical update round-trip 추가                                   |
| R2  | IndexedDB v2 migration이 모든 브라우저에서 정상 수행되지 않아 세션 복원 시 undo/redo가 완전 무력화     |  MED   | migration 실패 시 memory-only fallback (기존 behavior와 동일). DB upgrade error를 catch 후 log하고 in-memory state로 계속 동작. Phase 5 gate에서 Chrome/Firefox 두 브라우저 smoke         |
| R3  | `historyActions.ts` 2,300줄 수정 중 미처리 legacy 경로가 남아 undefined 접근 runtime error 발생        |  MED   | Phase 4에서 `entry.data.element`/`entry.data.childElements`/`entry.data.elements`/`entry.data.prevElements` TypeScript 타입 삭제 → compile error로 전수 강제 탐지. `pnpm type-check` gate |
| R4  | `batchUpdates` 배열 (prevProps/newProps snapshot) → canonical event 변환 시 element identity 미확인    |  LOW   | Phase 2에서 `batchUpdates` 경로를 canonical update event sequence로 변환할 때, elementId를 key로 canonical node lookup 후 변환. lookup 실패 시 해당 entry skip (no-op)                    |

잔존 HIGH 위험 없음.

## Gates

| Gate                                     | 시점         | 통과 조건                                                                                                                                              | 실패 시 대안                                  |
| ---------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| G1: canonical update event round-trip    | Phase 1 종료 | `CanonicalUpdateEvent` apply undo/redo 결과가 canonical document를 정확히 복원 (targeted vitest, props before=after=before)                            | Phase 1 재작업, diff adapter 수정             |
| G2: update/batch conversion              | Phase 2 종료 | `historyActions.ts` update/batch case가 canonical event apply 경로만 사용, legacy snapshot 직접 read 0건 (TypeScript type-check + grep gate)           | fallback adapter 유지 후 재시도               |
| G3: auto-detach + compatibility fallback | Phase 3 종료 | auto-detach batch 및 IndexedDB session-restore 경로가 canonical event apply 완료                                                                       | 해당 경로만 rollback                          |
| G4: legacy field 타입 삭제               | Phase 4 종료 | `HistoryEntry.data`에서 `element?`/`prevElement?`/`childElements?`/`elements?`/`prevElements?`/`props?`/`prevProps?` 타입 삭제, `pnpm type-check` PASS | 잔존 사용처 수정 후 재시도                    |
| G5: IndexedDB v2 migration smoke         | Phase 5 종료 | Chrome + Firefox에서 기존 session history 로드 후 undo/redo 정상 동작 (또는 no-op graceful degradation). 데이터 손실 0                                 | migration 로직 수정 후 재시도                 |
| G6: final verification                   | Phase 6 종료 | `pnpm type-check` PASS + targeted vitest (undo/redo round-trip 6 types) + browser smoke (create/update/remove/move/group/ungroup 각 undo/redo) 회귀 0  | 실패 bucket을 residual로 기록 후 phase 재실행 |

## Consequences

### Positive

- `HistoryEntry.data`의 타입 surface가 `diff?`/`diffs?`/`canonicalEvents?` 세 필드로 단순화된다.
- `historyActions.ts`에서 legacy snapshot field 읽기 경로 (123개)가 제거된다.
- ADR-126 Element type deprecate의 prerequisite가 충족된다 (history에서 `element: Element` snapshot 직접 저장 제거).
- IndexedDB history entry도 canonical event sequence로 통일되어 session restore 경로가 runtime과 동일한 형식을 사용한다.

### Negative

- `CanonicalUpdateEvent` 타입 신규 정의 및 `canonicalHistoryEvents.ts` 확장 필요 (약 +150~200줄).
- IndexedDB v2 migration 로직 작성 필요 (단, 변환 불가 entry는 no-op으로 graceful degradation).
- Phase 4 타입 삭제 이후 runtime에서 `entry.data.element` 접근 시 TypeScript compile error — 전수 수정 필요.

## 반복 패턴 선차단 체크리스트 (adr-writing.md §"반복 패턴 선차단" 4 항목 selfcheck)

- [x] **HIGH+ 위험 코드 경로 3곳 이상 구체 인용**: 잔존 HIGH 위험 0. MEDIUM 위험 (R1~R4) 도 코드 경로 인용 — `historyActions.ts` Element production 49 라인, `canonicalHistoryEvents.ts:227` (`canonicalDocumentToElements(nextDoc)`), `historyIndexedDB.ts:43-44` (`DB_NAME='composition-history'` / `DB_VERSION=1`), `data.element/childElements/elements/prevElements` snapshot field 123 hits. HIGH+ 없으므로 본 항목 strict requirement N/A.
- [x] **Spec/Generator 확장 ADR 여부**: 본 ADR 은 history payload schema, Spec/Generator 확장 아님. N/A.
- [x] **BC 훼손 수식화**: 기존 IndexedDB `composition-history` v1 entry — Phase 5 v2 upgrade 시 변환 불가 entry 는 no-op (빈 canonicalEvents). 영향 = 기존 entry 100% 중 add/remove/group/ungroup canonical event 보유 entry 는 fully migrated, legacy snapshot only entry 는 undo 시도 시 no-op. 사용자 영향: 미저장 work (이미 commit 된 history) 의 undo 가능성 부분 손실, 향후 작업 0 영향.
- [x] **HIGH+ Phase 분리 가능 여부 검토**: HIGH+ 0. Phase 분리 불필요. 7-phase 분할로 update/batch/auto-detach 영역별 점진 전환.
