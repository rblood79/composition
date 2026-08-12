# ADR-177: 페이지 위치의 문서 데이터화 — 히스토리 기록 + 영속화

## Status

Implemented — 2026-08-12 (리뷰 round 1 승인 `docs/adr/reviews/177.md` → Accepted → Phase 0~4 같은 날 완료)

### Phase 진행 로그

- Phase 0 (inventory freeze): Implemented 2026-08-12 — breakdown §5 계약 표 C1~C10 (R2 파서 additive 안전 확정 포함)
- Phase 1 (document 필드 + persist/hydrate): Implemented 2026-08-12 — `pagePositions` root 필드 + `setPagePositions` + hydrate 페이지 단위 병합. live: 드래그 → IndexedDB 기록(lazy write 1 entry) → 새로고침 → 배치 유지 실측
- Phase 2 (히스토리 canonical event + undo/redo): Implemented 2026-08-12 — `page-position` entry (batch) + 3 진입점 early-branch + `alignPagesToScreen` batch 1 entry + 정적 가드. live: 드래그→Cmd+Z 원위치→redo 재적용 + align→Cmd+Z 1회 전체 복귀 + 문서 축 before/after 정합 실측
- Phase 3 (인스펙터 X/Y + nudge): Implemented 2026-08-12 — PageBodyEditor Position 섹션(page body 한정) + 화살표 nudge 1px/Shift 10px (페이지 선택 분기 — element 형제 순서 무변경). live: nudge X 470→473 + Shift Y 0→10 + undo/redo 왕복 + X 입력 600 반영, entry 5개(조작당 1개) + 문서 축 정합 실측
- Phase 4 (검증 종결): Implemented 2026-08-12 — G1 (드래그/정렬/입력/nudge 전 경로 undo·redo live) / G2 (새로고침 배치 유지 + 구 문서 폴백·재직렬화 0) / G3 (`updatePagePosition` 호출처 3곳 전부 finish 지점 — 드래그 중·cancel 경로 기록 0, 조작당 entry 1개 카운터 실측 18→23) / G4 (type-check + 유닛 52·57 + 정적 가드 + CHANGELOG) 전수 통과

## Context

페이지(아트보드) 캔버스 위치는 현재 **인메모리 뷰 상태**다. 2026-08-12 이동 기능 gap 실측에서 확인된 사실:

- `updatePagePosition` (`apps/builder/src/builder/stores/elements.ts:2026-2038`) 은 `pagePositions` + `pagePositionsByBreakpoint` + version 만 set 한다 — **히스토리 미기록** (Cmd+Z 로 페이지 이동을 되돌릴 수 없다), **persist 미호출**.
- 히스토리 스키마 자체가 element 노드 전용 — `HistoryEntry.type = add|update|remove|move|batch|group|ungroup` + `elementId` 필수 (`apps/builder/src/builder/stores/history.ts:46-88`), canonical event (`canonicalHistoryEvents.ts`) 도 노드 이벤트만 표현한다.
- 저장/복원 경로 미발견 — 로드 시 `initializePagePositions` (`elements.ts:1938`) 가 배치를 **재계산**한다. 같은 날 라이브 세션에서 새로고침 후 사용자 배치가 초기 정렬로 소실되는 것을 실측 확인.
- Figma/Pencil 은 프레임(페이지) 위치가 문서 데이터다 — 이동은 undo 대상이고 재로드 후 유지된다.

[ADR-176](../176-canvas-authoring-gesture-and-page-position-optimization.md) (Implemented 2026-08-01) 은 페이지 드래그의 gesture/presentation 축을 결정하면서 "document schema migration 이나 새 저장 필드를 만들지 않는다" 를 명시적 경계로 뒀다. 본 ADR 은 그 의도적 이연분인 **데이터 모델 축**의 결정이다.

**3-domain**: D1/D2/D3 무관 — canonical document 의 authoring 데이터 + builder-system 상태 축. 페이지 캔버스 배치는 Preview/Publish 출력에 영향이 없다 (Figma 와 동일 — 문서 데이터지만 산출물 무관).

### Hard Constraints

1. **ADR-176 계약 보존** — 드래그 중 transient presentation publish, canonical write 는 정상 종료 시 1회. 히스토리 기록·persist 도 같은 finish 지점에서 1회 (연속 인터랙션 중 기록 금지).
2. **breakpoint 축 보존** — 기존 `pagePositionsByBreakpoint` 구조 유지, active breakpoint 의 항목만 기록/갱신.
3. **BC 정량**: 기존 프로젝트 영향 **0%** — 필드 부재 문서는 현행 재계산 경로 그대로 폴백, 로드 시 재직렬화 0 (lazy write — 다음 위치 변경 시에만 필드 기록).
4. **undo 일원화** — 기존 히스토리 파이프라인(per-page 50 depth, jump-to-index)에 편입. 별도 undo 스택 금지.
5. `alignPagesToScreen` 일괄 재배치는 **단일 batch entry** 로 기록 (Cmd+Z 1회로 전체 복귀).

### Soft Constraints

- ADR-131 root collection 패턴 (flat entry + `syncXxxToCanonical` 경유) 재사용.
- 신규 package/의존성 없이 store + canonical 어댑터 내부에서 닫는다.

## Alternatives Considered

### 대안 A: canonical document additive 필드 + 히스토리 canonical event 확장

- document 에 페이지 위치 additive 필드 (breakpoint 별) 를 두고, `updatePagePosition` commit 지점에서 `page-position-set` canonical event 를 히스토리에 기록. 로드 시 필드 존재 → hydrate, 부재 → 현행 재계산 폴백.
- 위험: 기술(M — 스키마 + 히스토리 event kind 확장) / 성능(L — finish 1회) / 유지보수(M — 히스토리 소비 분기 1종 추가) / 마이그레이션(L — additive + 폴백, BC 0%)

### 대안 B: 에디터 사이드카 저장 + 자체 undo 스택

- IndexedDB 별도 store (project × breakpoint) 에 위치 저장, 페이지 이동 전용 undo 스택 별도 운영. document 스키마 무침범.
- 위험: 기술(L) / 성능(L) / **유지보수(H — undo 이원화: Cmd+Z 가 어느 스택을 되돌리는지 사용자 모델 파괴 + 두 스택 순서 결합 문제)** / 마이그레이션(L)

### 대안 C: 현상 유지 + 세션 복원만 (localStorage)

- 위험: 기술(L) / 성능(L) / 유지보수(L) / 마이그레이션(L) — 그러나 **undo 미해결 + 문서 이동성(다른 기기/공유 시 배치 소실) 미해결** — 본 ADR 의 문제 정의 자체를 충족하지 못한다.

### Risk Threshold Check

| 대안 | HIGH+ 요약                   | 판정                    |
| ---- | ---------------------------- | ----------------------- |
| A    | 없음 (전 축 L/M)             | **통과 — 채택**         |
| B    | 유지보수 H (undo 이원화)     | 실패                    |
| C    | 기능 미달 (요구 자체 미충족) | 실패 (위험 이전에 미달) |

## Decision

**대안 A 채택 — 페이지 위치는 문서 데이터다.**

1. canonical document 에 페이지 위치 additive 필드를 둔다 (형식 후보와 판정 기준은 breakdown §4 — root 필드 우선 검토).
2. 히스토리는 `page-position-set` canonical event (batch 지원) 로 기존 파이프라인에 편입 — 드래그 finish / 인스펙터 입력 / nudge / `alignPagesToScreen` 이 전부 같은 event 를 낸다.
3. 기록·persist 시점은 ADR-176 의 finish commit 지점 1곳 — 드래그 중 경로는 건드리지 않는다.
4. 위치 데이터의 소비자로 인스펙터 페이지 X/Y 입력과 페이지 선택 시 화살표 nudge (1px / Shift 10px) 를 함께 노출한다 (Phase 3) — 기존 화살표=형제 순서 변경은 element 선택 scope 라 충돌 없음 (`keyboardShortcuts.ts:555-602` 실측).

기각 사유 — B: undo 이원화가 사용자 모델(Cmd+Z 일원)을 깨고 두 스택의 순서 결합이 영구 유지보수 부담. C: "이동이 저장되고 되돌려진다" 는 본 ADR 의 존재 이유를 충족하지 못함.

> 구현 상세: [177-page-position-document-data-breakdown.md](../design/177-page-position-document-data-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                   | 심각도 | 대응                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------------------------- |
| R1  | 히스토리 소비자가 element 노드 전용 가정 — `history.ts:46-88` 스키마, `historyActions.ts` undo/redo 적용 분기, `canonicalHistoryEvents.ts` — 신규 event 미처리 시 undo 에서 무시되거나 크래시                                                                          |  HIGH  | event kind 소비 분기 전수 grep 를 Phase 0 inventory 로 freeze + 소비 분기 정적 가드 테스트 + G1 live undo/redo              |
| R2  | 구 문서/신 문서 교차 호환 — 필드 보유 문서를 구 빌드가 거부할 가능성                                                                                                                                                                                                   |  MED   | Phase 0 에서 파서의 additive 필드 허용 여부 확인 — 거부 시 마이그레이션 버전 게이트. BC 수식화는 breakdown §5               |
| R3  | 페이지 추가/삭제·`alignPagesToScreen`·breakpoint 전환과 히스토리 상호작용 — stale pageId entry, batch 경계, **per-page 스택 소속** (entry 는 `currentPageId` 스택에 기록되는데 페이지 위치는 프로젝트 수준 데이터 — 비활성 페이지 이동·전체 정렬 entry 의 undo 도달성) |  MED   | 삭제된 pageId entry 는 undo 적용 시 무시 규칙 + batch 1 entry 계약 (G1) + 스택 소속 규칙을 Phase 0 에서 lock (breakdown §2) |
| R4  | 드래그 성능 회귀                                                                                                                                                                                                                                                       |  LOW   | finish 1회 기록 (ADR-176 HC 승계) — 드래그 프레임 경로 무변경, G3 에서 write 횟수 재확인                                    |

## Gates

| Gate | 통과 조건                                                                                                                                             |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1   | live: 페이지 드래그 → Cmd+Z 원위치 복귀 → Cmd+Shift+Z 재적용. `alignPagesToScreen` → Cmd+Z 1회로 전체 복귀. 인스펙터 X/Y 입력·nudge 도 각각 entry 1개 |
| G2   | live: 이동 → 새로고침 → 배치 유지 (active breakpoint 별 독립). 필드 없는 구 문서 로드 → 현행 재계산과 동일 배치 + 재직렬화 0                          |
| G3   | 드래그 100 pointer-move 재현에서 canonical write 1회·히스토리 entry 1개·persist 1회 (ADR-176 G2 재확인 — cancel 경로는 전부 0)                        |
| G4   | type-check + 히스토리/persist 관련 유닛·정적 가드 PASS + `docs/CHANGELOG.md` 갱신 (Implemented 승격 시)                                               |

## Consequences

### Positive

- 페이지 이동이 undo/redo·재로드에서 다른 편집과 동일하게 동작 — 이동 기능의 데이터 신뢰 확보 (Figma/Pencil 동등).
- 위치가 문서 데이터가 되면서 인스펙터 X/Y·nudge 같은 정밀 조작 소비자를 얹을 기반이 생긴다 (ADR-178/179 와 직교).

### Negative

- 히스토리 스키마에 비-element event kind 가 처음 들어간다 — 소비 분기 전수 관리 의무 (R1 정적 가드로 상쇄).
- document 필드 1종 추가로 canonical 스키마 표면이 늘어난다 (additive, BC 0%).
