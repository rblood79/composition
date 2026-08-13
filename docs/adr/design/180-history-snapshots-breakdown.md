# ADR-180: 히스토리 스냅샷 — design breakdown

> 본문: [../180-history-snapshots.md](../180-history-snapshots.md)
> 배경 조사: Adobe Photoshop 웹 History 패널 실측 (2026-08-13 세션 — 스냅샷 = 선형 truncation 의 분기 보존 장치, 즉시 생성 + 인라인 rename + 클릭 복원 + truncation 생존 실측). 1단계 (시각 어법 — 미래 state 흐림/타입 아이콘) 는 `6405722d9` 로 반영 완료, 본 ADR 이 2단계.

## §1 결정 요약 + 스코프 lock

| 축                 | 결정                                                                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 스냅샷 표현        | **canonical `CompositionDocument` 전체 직렬화 본** (프로젝트 스코프) — 페이지 서브트리 아님 (본문 대안 C 기각)                                                              |
| 저장               | IndexedDB `composition-history` DB **v3** 신규 `snapshots` object store (기존 `entries`/`meta` 무변경)                                                                      |
| 복원               | 문서 전체 교체 (새로고침 hydrate 와 동일 경로) + `snapshot-restore` 히스토리 entry — **undo 가능**                                                                          |
| 복원 undo 표현     | entry 에 직렬화 본을 담지 않고 `{ beforeSnapshotId, afterSnapshotId }` 참조만 (before 는 복원 직전 자동 캡처)                                                               |
| 타 페이지 히스토리 | **복원 시 clear** (R4 — stale nodeId delta 적용 차단. 복원 자체의 undo 는 beforeSnapshot 이 보장)                                                                           |
| 상한               | user **10개** — 초과 시 생성 차단 + 삭제 유도, 자동 삭제 금지 (사용자 데이터) / system(복원 안전망) 은 프로젝트당 최신 **5개 rolling** 자동 순환 — 참조 소실 시 R5 fallback |
| UI                 | HistoryPanel 에 스냅샷 섹션 (Photoshop 웹 동형: 생성 버튼 / 클릭 복원 / 더블클릭 인라인 rename / 삭제)                                                                      |
| 어휘               | entry type `"snapshot-restore"`, 라벨 "스냅샷 복원 {이름}"                                                                                                                  |

## §2 Phase 0 — inventory freeze (착수 게이트)

구현 착수 전 다음을 실측 확정하고 본 §2 에 기록 (추정 금지 — adr-writing M3):

- [ ] **직렬화 재사용 지점**: canonical persist 경로가 쓰는 직렬화 형태 (`persistActiveCanonicalDocument` 계열) — 스냅샷 저장이 같은 포맷을 재사용할 수 있는지, deep-clone 필요 여부 (structuredClone vs JSON round-trip)
- [ ] **문서 교체 → 재파생 경로**: `canonicalDocumentStore.setDocument` (canonicalDocumentStore.ts:249) 이후 store mirror 재파생 (`canonicalDocumentToElements` → `_rebuildIndexes`) + `layoutVersion`/`pagePositionsVersion`/preview 재송신이 한 진입점으로 묶인 함수가 있는지 (새로고침 hydrate 경로와 동일해야 함 — 없으면 Phase 2 에서 단일 진입점 신설)
- [ ] **historyManager 확장점**: `subscribe` 채널이 스냅샷 목록 변경도 통지할지, 별도 snapshot subscribe 를 둘지
- [ ] **HistoryEntry union 확장 영향면**: `historyEntryLabel.ts` / `historyEntryMigration.ts` / `historyEntryCanonicalEvents.static.test.ts` / `historyActions` 분기 4곳 (349/751/1146 + 1682 persist skip — 리뷰 round 1 실측) 전수 나열
- [ ] **entry 제거 지점 전수** (R5 fallback 빈도 추정 근거): maxSize 초과 shift (history.ts:459 부근) / truncation slice (history.ts:449) / `clearPageHistory` (history.ts:680) — system 상한은 rolling 5 (§1) 가 보장하므로 참조-추적 GC 는 불요 판정이 기본값. 나열 결과는 rolling 임계값 재조정 근거로 기록

## §3 Phase 1 — 스냅샷 코어 (CRUD + 영속)

- `apps/builder/src/builder/stores/history/snapshots.ts` 신설:

```ts
interface HistorySnapshot {
  id: string;
  projectId: string;
  name: string; // 기본 "스냅숏 N" — Photoshop 어법
  kind: "user" | "system"; // system = 복원 직전 자동 캡처 (상한 계상 제외)
  createdAt: number;
  doc: SerializedCompositionDocument; // Phase 0 에서 포맷 확정
  estimatedSize: number;
}
```

- API: `createSnapshot(name?)` / `listSnapshots(projectId)` / `renameSnapshot(id, name)` / `deleteSnapshot(id)` — user kind 상한 10 검사 + system kind rolling 5 (초과 시 가장 오래된 system 자동 삭제)
- `historyIndexedDB.ts`: `DB_VERSION 2 → 3`, `snapshots` store (`keyPath: "id"`, index `projectId`) — upgrade 분기는 기존 store 존재 검사 패턴 (historyIndexedDB.ts:114/128) 과 동일
- 테스트: `snapshots.test.ts` — 생성/조회 정렬(최신순)/상한 차단/rename/삭제/system kind 상한 제외 + rolling 5 순환

## §4 Phase 2 — 복원 + `snapshot-restore` entry

- 복원 시퀀스 (state-management.md canonical 1차 순서 준수):
  1. 복원 직전 상태를 `kind: "system"` 스냅샷으로 자동 캡처 (`beforeSnapshotId`)
  2. `setDocument(projectId, snapshot.doc)` — canonical 1차
  3. store mirror 재파생 (Phase 0 확정 진입점) + index rebuild + layout/pagePositions version 증가 + preview 재송신
  4. IndexedDB persist
  5. **타 페이지 히스토리 clear** + 현재 페이지에 `snapshot-restore` entry 기록: `data.snapshotRestoreEvent = { beforeSnapshotId, afterSnapshotId }`
- undo/redo: `historyActions.ts` 의 page-position early-branch 패턴 (349/751/1146) 동형 — element 노드 경로 미진입, before/after 스냅샷 재적용 (2~4 재실행)
- `historyEntryLabel.ts`: `case "snapshot-restore"` → "스냅샷 복원 {name}" (스냅샷 삭제됨이면 "(삭제됨)" — 삭제 시 restore entry 는 잔존하므로 라벨만 표기)
- 테스트: 복원→undo→redo 왕복 (문서 동일성), 타 페이지 히스토리 clear, entry 크기 상한 (직렬화 본 미포함 — 참조 2개)

## §5 Phase 3 — 패널 UI (Photoshop 웹 동형)

- `HistoryPanel.tsx`: "편집" 리스트 위에 스냅샷 섹션
  - 헤더 액션: 스냅샷 생성 버튼 (Camera 아이콘) — 이름 대화상자 없이 즉시 "스냅숏 N" 생성 (Photoshop 웹 실측 동형)
  - 행: 이름 + 생성 시각, 클릭 = 복원, 더블클릭 = 인라인 rename (input 전환 + Enter/blur commit), hover 삭제 버튼 (confirm 1회 — 스냅샷은 세션 넘는 사용자 데이터라 Photoshop 웹의 무확인 삭제보다 보수적으로)
  - 현재 문서가 특정 스냅샷 복원 직후 상태면 해당 행 `data-active`
- `HistoryPanel.css`: `history-snapshot-*` 고유 클래스 (kebab-case, 예약 prefix 비사용 — panel-structure §2)
- 썸네일 (선택 — defer 허용): Skia surface 캡처 경로 실측 후 별도 판단. 1차 반영은 텍스트 행
- 테스트: 기존 `historyEntryLabel.test.ts` 확장 + 패널은 live 검증 위주

## §6 Phase 4 — 검증 게이트 (본문 Gates 와 1:1)

| Gate    | 내용                                                         | 통과 기준                                                                                                             |
| ------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| G1 성능 | 스냅샷 생성 소요 (components 페이지급 실문서 + 5k 합성 문서) | 5k 에서 직렬화+저장 p50 < 800ms (기존 편집 persist 205ms/35MB 실측 대비 동일 자릿수), 생성 후 캔버스 조작 프리즈 무감 |
| G2 정합 | 복원 결과 == 같은 문서 새로고침 hydrate 결과                 | store/canonical/Skia 렌더 diff 0 (live Chrome MCP)                                                                    |
| G3 왕복 | 복원 → Cmd+Z → Cmd+Shift+Z                                   | 문서·캔버스 원복, entry 1개                                                                                           |
| G4 영속 | 새로고침 후 스냅샷 목록 유지 + 복원 동작                     | IndexedDB v3 upgrade 후 기존 히스토리 entry 무손실 포함                                                               |

## §7 파일 변경표 (추정 — Phase 0 에서 freeze)

| 파일                                               | 변경                                                                                              |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `stores/history/snapshots.ts`                      | 신설 — HistorySnapshot + CRUD + 상한                                                              |
| `stores/history/historyIndexedDB.ts`               | DB v3 + `snapshots` store + CRUD 저수준                                                           |
| `stores/history.ts`                                | HistoryEntry union `"snapshot-restore"` + `snapshotRestoreEvent` payload + manager 연동/subscribe |
| `stores/history/historyActions.ts`                 | early-branch 3곳 (349/751/1146 패턴) + 복원 시퀀스 진입점                                         |
| `panels/history/HistoryPanel.tsx` / `.css`         | 스냅샷 섹션 UI                                                                                    |
| `panels/history/historyEntryLabel.ts` / `.test.ts` | `snapshot-restore` 라벨                                                                           |
| `stores/history/__tests__/snapshots.test.ts`       | 신설                                                                                              |

## §8 반복 패턴 선차단 대조 (adr-writing seed)

- 코드 경로 인용: history.ts:449 (truncation) / historyIndexedDB.ts:47-129 (DB v2, 2 store) / historyActions.ts:349·751·1146 (early-branch) / canonicalDocumentStore.ts:249 (setDocument) — 본문·breakdown 에 반영
- Spec/Generator 비대상: builder 시스템 상태/UI 계층 — D1/D2/D3 무관 (본문 Context 명시)
- BC: 순수 추가 (IndexedDB v3 upgrade 는 기존 store 무변경 — G4 로 확증)
- Phase 분리: 위 4 phase — 각 phase commit 가능 상태 유지
