# ADR-180: 히스토리 스냅샷 — 선형 truncation 생존 복원 지점

## Status

Proposed — 2026-08-13

## Context

composition 의 히스토리는 페이지 스코프 선형 모델이다: undo 로 되돌아간 상태에서 새 편집을 하면 redo 분기가 폐기되고 (`stores/history.ts:449` — `entries.slice(0, currentIndex + 1)`), 폐기된 분기를 복구할 수단이 없다. Adobe Photoshop 웹 History 패널 실측 조사 (2026-08-13 세션) 에서 이 선형 모델의 표준 보상 장치가 **스냅샷** 임을 확인했다 — 사용자가 명시적으로 고정한 시점은 truncation 을 생존하며, 즉시 생성 + 인라인 rename + 클릭 복원으로 동작한다 (실측: 폐기된 타원 분기가 스냅샷으로만 복원 가능). 조사 1단계 (패널 시각 어법 — 미래 state 흐림/타입 아이콘) 는 `6405722d9` 로 반영 완료, 본 ADR 은 2단계 (스냅샷 기능) 다.

**도메인 위상**: SSOT 3-domain (D1/D2/D3) 비대상 — builder 시스템 상태/UI 계층 (ADR-163 패널 표준과 동일 위상). Spec/catalog/Generator 확장 없음.

**Hard Constraints**:

1. **생성 비용 상한**: 스냅샷 = canonical document 직렬화 1회 — 5,069 요소 실문서 실측 편집 persist 205ms/35MB (memory `project-mutation-cost-scales-with-document-size`) 와 동일 자릿수여야 하며, 생성 후 캔버스 60fps 조작에 프리즈 무감 (Gates G1).
2. **복원 순서 계약**: canonical document 가 primary SSOT (ADR-116/122) — 복원은 canonical 1차 갱신 순서 (`setDocument` → store mirror 재파생 → index rebuild → persist, `canonicalDocumentStore.ts:249` + state-management.md §Canonical sync 호출 순서) 를 준수해야 한다.
3. **복원 undo 가능**: 복원은 히스토리 entry 로 기록되어 Cmd+Z 1회로 원복되어야 한다 (Photoshop 동형). entry 는 element 노드 경로 미진입 early-branch — ADR-177 `page-position` 패턴 (`historyActions.ts:349/751/1146`) 재사용.
4. **저장 상한**: 스냅샷 1개 = 문서 전체 (35MB@5k) — IndexedDB 누적 상한 필요. 사용자 데이터이므로 자동 삭제 금지 (상한 도달 시 생성 차단 + 삭제 유도).

**Soft Constraints**:

- 패널 UI 는 Photoshop 웹 어법과 정합 (스냅샷 섹션: 즉시 생성 / 클릭 복원 / 더블클릭 rename) — 학습 비용 최소화.
- 기존 IndexedDB `composition-history` (v2, `entries`+`meta` store — `historyIndexedDB.ts:47-129`) 스키마와 공존.

## Alternatives Considered

### 대안 A: canonical document 전체 직렬화 스냅샷

- 설명: 스냅샷 = `CompositionDocument` 전체 직렬화 본 (프로젝트 스코프). IndexedDB v3 신규 `snapshots` store 저장. 복원 = 문서 전체 교체 (새로고침 hydrate 와 동일 경로) + `snapshot-restore` entry (before/after 스냅샷 id 참조 — 직렬화 본 entry 미포함).
- 근거: Photoshop 데스크톱 스냅샷의 Full Document 모드 동형 (웹은 이 모드만 탑재). Figma version checkpoint 도 문서 전체 단위. delta 체인과 독립된 전체본만이 truncation 을 구조적으로 생존한다.
- 위험:
  - 기술: L — 순수 추가 기능, 기존 hydrate/persist 경로 재사용
  - 성능: M — 직렬화 1회 비용 (205ms/35MB@5k 실측 자릿수), 명시 액션 1회로 국한
  - 유지보수: L — 기존 히스토리 스택 무변경, early-branch 1종 추가
  - 마이그레이션: L — IndexedDB v3 upgrade 는 신규 store 추가만 (기존 entry 무변경)

### 대안 B: 비선형 히스토리 (truncation 폐기, 분기 트리 보존)

- 설명: 새 편집 시 redo 분기를 폐기하지 않고 분기 트리 (DAG) 로 보존 — Photoshop 데스크톱 "Allow Non-Linear History", git 커밋 그래프 동형.
- 근거: 스냅샷 없이도 모든 분기가 보존되는 상위 모델. Photoshop 데스크톱이 옵션으로 제공.
- 위험:
  - 기술: H — ADR-124 canonical event 선형 체인 (`currentIndex` 단일 포인터) 전면 재설계, 분기 병합 의미론 정의 필요
  - 성능: M — 폐기 없는 누적으로 maxSize 관리 복잡화
  - 유지보수: H — 히스토리 소비자 전부 (undo/redo/goToIndex/패널/IndexedDB 스키마) 가 트리 모델로 전환, 분기 탐색 UI 신설
  - 마이그레이션: H — 기존 IndexedDB entry 선형 스키마 → 트리 전환 migration

### 대안 C: 페이지 서브트리 스냅샷

- 설명: 히스토리가 페이지 스코프이므로 스냅샷도 현재 페이지 서브트리만 캡처/복원.
- 근거: 스코프 정합 (히스토리 계층과 동일 단위), 직렬화 비용 최소.
- 위험:
  - 기술: H — cross-page 정합 split-brain: reusable/instance 원본이 타 페이지에 있을 때 한 페이지만 과거로 되돌리면 ref 참조·`componentRole` 정합이 어긋난다 (ADR-135/136 render-space 계약 위반 축). 페이지 경계를 넘는 move 히스토리와도 충돌
  - 성능: L — 직렬화 범위 최소
  - 유지보수: M — 서브트리 추출/재접합 로직 별도 유지
  - 마이그레이션: L

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | L    | M    | L        | L            |     0      |
| B    | H    | M    | H        | H            |     3      |
| C    | H    | L    | M        | L            |     1      |

루프 판정: HIGH 0 인 대안 A 존재 — 추가 대안 불요.

## Decision

**대안 A: canonical document 전체 직렬화 스냅샷**을 선택한다.

선택 근거:

1. truncation 생존은 delta 체인과 독립된 전체본에서만 구조적으로 성립한다 — 체인 인덱스 포인터는 truncation (`history.ts:449`) 시 대상 자체가 소실된다.
2. 잔존 위험이 성능 MED 하나이며, 스냅샷 생성은 사용자 명시 액션 1회 비용 + 프로젝트당 상한 10개로 국한된다 (기존 편집 persist 가 이미 같은 자릿수 비용을 상시 지불 중).
3. 복원·영속 모두 기존 경로 재사용 (hydrate 경로 / ADR-177 early-branch / IndexedDB upgrade 패턴) — 신규 표면 최소.

기각 사유:

- **대안 B 기각**: 목적 (폐기 분기의 선택적 보존) 대비 히스토리 체계 전면 재설계가 과잉. Photoshop 웹도 비선형을 탑재하지 않고 스냅샷으로 보상하는 동일 선택을 했다 (실측). 필요가 실증되면 후속 ADR 로 재론.
- **대안 C 기각**: cross-page reusable/instance split-brain (기술 HIGH) — 문서 전체본 대비 절감되는 것이 직렬화 비용뿐인데, 그 비용은 A 에서 이미 수용 가능 판정.

> 구현 상세: [180-history-snapshots-breakdown.md](design/180-history-snapshots-breakdown.md)

## Risks

| ID  | 위험                                                                               | 심각도 | 대응                                                                                                          |
| --- | ---------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------- |
| R1  | 대형 문서 스냅샷 생성 시 메인 스레드 블로킹 (직렬화 205ms 자릿수@5k)               |  MED   | 명시 액션 1회 비용으로 국한 + G1 성능 게이트 (프리즈 무감 기준)                                               |
| R2  | IndexedDB 용량 누적 (35MB × N)                                                     |  MED   | user 스냅샷 프로젝트당 상한 10 + 초과 시 생성 차단·삭제 유도 (자동 삭제 금지)                                 |
| R3  | 복원 후 파생 상태 (Skia/layout/preview) 동기화 누락                                |  MED   | 새로고침 hydrate 와 동일 진입점 재사용 (Phase 0 에서 확정) + G2 정합 게이트                                   |
| R4  | 복원이 타 페이지 히스토리의 stale nodeId delta 를 무효화 — 적용 시 corruption 가능 |  MED   | 복원 시 타 페이지 히스토리 clear (트레이드오프 명시). 복원 자체의 undo 는 before 자동 스냅샷이 보장 (G3 왕복) |
| R5  | `snapshot-restore` entry 가 참조하는 스냅샷 삭제 시 undo 불능                      |  LOW   | 라벨 "(삭제됨)" 표기 + undo 시도 시 no-op 안내. system(before) 스냅샷 GC 판정은 Phase 0 inventory 항목        |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점           | 통과 조건                                                                                   | 실패 시 대안                                        |
| ---- | -------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| G1   | Phase 1 종료   | 5k 합성 문서 생성 p50 < 800ms + 생성 직후 캔버스 조작 프리즈 무감 (live)                    | 직렬화를 persist 파이프라인 유휴 시점으로 이동 검토 |
| G2   | Phase 2 종료   | 복원 결과 == 동일 문서 새로고침 hydrate 결과 (store/canonical/Skia diff 0, live Chrome MCP) | 복원 진입점을 hydrate 함수로 강제 단일화            |
| G3   | Phase 2 종료   | 복원 → Cmd+Z → Cmd+Shift+Z 왕복 원복, 히스토리 entry 1개                                    | early-branch 재설계 (page-position 대조 디버깅)     |
| G4   | Phase 4 (종결) | IndexedDB v3 upgrade 후 기존 히스토리 entry 무손실 + 새로고침 후 스냅샷 목록/복원 동작      | upgrade 분기 수정 전 Implemented 승격 금지          |

## Consequences

### Positive

- undo 후 재편집으로 폐기되는 분기를 사용자가 선택적으로 보존/복원 가능 — 선형 히스토리의 구조적 한계 보상 (Photoshop 어법 정합으로 학습 비용 최소).
- 스냅샷이 IndexedDB 영속이므로 세션 한정인 Photoshop 웹보다 강한 지속성 — 새로고침 후에도 복원 지점 유지.
- 3단계 (Supabase 명명 버전 — 영구 버전 계층) 의 로컬 선행 형태가 되어 후속 ADR 의 UI/의미론 기반 마련.

### Negative

- IndexedDB 사용량 증가 (문서 크기 × 최대 10) — `panels/history` 사용자에게 상한·용량 노출 필요.
- 복원 시 타 페이지 히스토리 소실 (R4 트레이드오프) — 문서 전체 교체의 대가로, 패널에서 복원 전 안내 필요.
- `HistoryEntry` union 확장 (`snapshot-restore`) 으로 히스토리 소비자 (label/migration/static test) 표면 +1.
