# ADR-124 구현 상세: Canonical-only history entry schema

> **ADR 본문**: [124-canonical-only-history-schema.md](../124-canonical-only-history-schema.md)
>
> **ADR Fork framing lock-in** (adr-writing.md §"ADR Fork / 분리 결정 시 framing checkpoint"):
>
> 1. **base/응용**: ADR-124는 base ADR (schema 추상). ADR-126 (Element type deprecate) 이 응용.
> 2. **schema 직교성**: ADR-123 (cloud) / ADR-125 (render input) 과 직교. ADR-126과 강결합.
> 3. **baseline framing reverse 검증**: ADR-122 closure note가 "legacy field는 compatibility 경계"로 남긴 framing을 이 ADR이 닫는다. ADR-122 → ADR-124 의존 방향 정방향 확인.
> 4. **codex 1차 진입 전 통과**: 4 질문 통과 완료.

## Phase 0: History entry inventory (legacy snapshot field 사용 surface 측정)

**목표**: legacy snapshot field 사용 entry 수 측정 및 변환 전략별 분류.

### 측정 대상

| 파일                                                                | 역할                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/builder/src/builder/stores/history.ts`                        | `HistoryEntry` 타입 정의 + `addEntry`/`addDiffEntry`/`addBatchDiffEntry` |
| `apps/builder/src/builder/stores/history/historyActions.ts`         | undo/redo 실행 로직 (2,300줄)                                            |
| `apps/builder/src/builder/stores/utils/historyHelpers.ts`           | multi-select/group/ungroup/AI batch 추적 헬퍼                            |
| `apps/builder/src/builder/stores/history/canonicalHistoryEvents.ts` | canonical event builder (insert/remove/move)                             |
| `apps/builder/src/builder/stores/history/historyIndexedDB.ts`       | IndexedDB v1 persistence                                                 |

### Inventory 분류 기준

| bucket            | 정의                                                                            |
| ----------------- | ------------------------------------------------------------------------------- |
| `canonical-done`  | 이미 `canonicalEvents` 경로 — 이 ADR의 수정 대상 아님                           |
| `diff-based`      | `diff`/`diffs` 경로 — canonical `update` event 래핑 대상                        |
| `snapshot-remove` | `element`/`childElements` snapshot read — canonical event apply로 교체 대상     |
| `snapshot-batch`  | `elements`/`prevElements`/`batchUpdates` — canonical event sequence로 교체 대상 |
| `type-surface`    | `HistoryEntry.data` 타입 선언 — Phase 4에서 삭제                                |

### 측정 방법

```bash
# legacy snapshot field 읽기 경로 전수
grep -n "data\.element\b\|data\.prevElement\b\|data\.childElements\|data\.elements\b\|data\.prevElements\|data\.props\b\|data\.prevProps\b\|data\.batchUpdates" \
  apps/builder/src/builder/stores/history/historyActions.ts | wc -l

# canonical event 경로 (이미 완료)
grep -n "data\.canonicalEvents\|data\.diff\b\|data\.diffs\b" \
  apps/builder/src/builder/stores/history/historyActions.ts | wc -l
```

현재 측정값 (2026-05-10 기준):

- `data.element`/`data.childElements`/`data.elements`/`data.prevElements`: 123개 읽기 경로 (`snapshot-remove` + `snapshot-batch` bucket)
- `data.diff`/`data.diffs`/`data.canonicalEvents`: 별도 경로 (`diff-based` + `canonical-done` bucket)

**Phase 0 완료 기준**: 위 두 bucket 수치가 [`docs/adr/design/124-inventory.md`](124-inventory.md)에 기록됨.

**Phase 0 Status: Done — 2026-05-10**. 측정 결과 (main HEAD `f54c2495c`): legacy snapshot field reads 167건, canonical event/diff reads 26건, HistoryEntry data field 11개 bucket 분류 완료, 42 case block enumerate 완료. Phase 1 진입 가능.

---

## Phase 1: Canonical event schema 확장 — `CanonicalUpdateEvent` 정의

**목표**: props 변경을 표현하는 `CanonicalUpdateEvent` 타입 정의 + apply 함수 + isolated unit test.

**대상 파일**:

- `apps/builder/src/builder/stores/history/canonicalHistoryEvents.ts`

### 신규 타입

현재 `CanonicalHistoryNodeEvent` 는 insert/remove/move만 커버. update를 추가:

```typescript
// Before: structural events only
export type CanonicalHistoryNodeEvent =
  | {
      type: "insert";
      node: CanonicalNode;
      parentId: string | null;
      index: number;
    }
  | {
      type: "remove";
      node: CanonicalNode;
      parentId: string | null;
      index: number;
    }
  | {
      type: "move";
      nodeId: string;
      fromParentId: string | null;
      fromIndex: number;
      toParentId: string | null;
      toIndex: number;
    };

// After: + update event
export type CanonicalHistoryNodeEvent =
  | {
      type: "insert";
      node: CanonicalNode;
      parentId: string | null;
      index: number;
    }
  | {
      type: "remove";
      node: CanonicalNode;
      parentId: string | null;
      index: number;
    }
  | {
      type: "move";
      nodeId: string;
      fromParentId: string | null;
      fromIndex: number;
      toParentId: string | null;
      toIndex: number;
    }
  | {
      type: "update";
      nodeId: string;
      prevProps: Record<string, unknown>;
      nextProps: Record<string, unknown>;
    };
```

### apply 함수 확장

`applyCanonicalHistoryEventsToDocument` 에 `update` case 추가:

```typescript
// update event apply (undo: nextProps→prevProps, redo: prevProps→nextProps)
if (event.type === "update") {
  const props = direction === "undo" ? event.prevProps : event.nextProps;
  return applyNodePropsUpdate(currentDoc, event.nodeId, props);
}
```

`applyNodePropsUpdate`는 document DFS에서 nodeId 일치 노드를 찾아 props를 교체하는 순수 함수.

### Builder helper 추가

```typescript
// canonicalHistoryEvents.ts에 추가
export function buildCanonicalUpdateEvent(
  nodeId: string,
  prevProps: Record<string, unknown>,
  nextProps: Record<string, unknown>,
): CanonicalHistoryNodeEvent {
  return { type: "update", nodeId, prevProps, nextProps };
}
```

### Gate G1 검증 (unit test)

`apps/builder/src/builder/stores/history/__tests__/canonicalUpdateEvent.test.ts`:

```typescript
// undo/redo round-trip: prevProps=before, nextProps=after
// apply undo → props restored to prevProps
// apply redo → props restored to nextProps
// apply undo → redo → undo: final === prevProps (round-trip identity)
```

---

## Phase 2: update/batch entry → canonical event sequence 전환

**목표**: `historyActions.ts`의 `update`/`batch` undo/redo case를 canonical event apply 경로로 전환.

**대상 파일**:

- `apps/builder/src/builder/stores/history/historyActions.ts`
- `apps/builder/src/builder/stores/history.ts` (`addDiffEntry`, `addBatchDiffEntry`)
- `apps/builder/src/builder/stores/utils/historyHelpers.ts` (`trackBatchUpdate`)

### 핵심 변환 패턴

**`update` entry 기록 (addDiffEntry)**:

```typescript
// Before: diff only
const newEntry: HistoryEntry = {
  data: {
    diff: serializedDiff,
    ...(canonicalEvents ? { canonicalEvents } : {}),
  },
};

// After: diff is wrapped inside canonicalEvents as update event
// (diff는 props 추출용으로만 사용, canonical event로 변환 후 저장)
const updateEvent = buildCanonicalUpdateEvent(
  prevElement.id,
  prevElement.props as Record<string, unknown>,
  nextElement.props as Record<string, unknown>,
);
const newEntry: HistoryEntry = {
  data: {
    diff: serializedDiff, // 크기 추정용으로만 유지, undo/redo는 canonicalEvents 경로
    canonicalEvents: structuralCanonicalEvents
      ? [...structuralCanonicalEvents, updateEvent]
      : [updateEvent],
  },
};
```

**`batch` entry 기록 (addBatchDiffEntry)**:

```typescript
// Before: diffs only
const newEntry: HistoryEntry = { data: { diffs } };

// After: diffs + canonical update events
const canonicalEvents = diffs.map((serializedDiff) => {
  const diff = deserializeDiff(serializedDiff);
  return buildCanonicalUpdateEvent(
    diff.elementId,
    extractPrevProps(diff),
    extractNextProps(diff),
  );
});
const newEntry: HistoryEntry = { data: { diffs, canonicalEvents } };
```

**`historyActions.ts` undo case "update"**:

```typescript
// Before: legacy prevProps/prevElement snapshot restore
case "update": {
  if (entry.data.prevProps) { /* legacy props restore */ }
  if (entry.data.prevElement) { /* legacy element restore */ }
  break;
}

// After: canonical event apply only
case "update": {
  const result = applyCanonicalHistoryEventsToActiveDocument(
    entry.data.canonicalEvents,
    "undo",
  );
  if (result) { /* sync to store */ }
  break;
}
```

**`historyActions.ts` undo case "batch"**:

```typescript
// Before: legacy elements/prevElements/batchUpdates restore
case "batch": {
  if (entry.data.prevElements && entry.data.elements) { /* legacy */ }
  if (entry.data.elements) { /* legacy */ }
  break;
}

// After: canonical event apply (update events sequence)
case "batch": {
  const result = applyCanonicalHistoryEventsToActiveDocument(
    entry.data.canonicalEvents,
    "undo",
  );
  if (result) { /* sync to store */ }
  break;
}
```

### Gate G2 검증

```bash
# legacy snapshot field 직접 read가 update/batch case에서 0건
grep -n "entry\.data\.element\b\|entry\.data\.prevElement\b\|entry\.data\.childElements\|entry\.data\.elements\b\|entry\.data\.prevElements\|entry\.data\.props\b\|entry\.data\.prevProps\b\|entry\.data\.batchUpdates" \
  apps/builder/src/builder/stores/history/historyActions.ts
```

기대: update/batch case 내부에서 0건. `pnpm type-check` PASS.

---

## Phase 3: auto-detach batch + compatibility fallback 경로 전환

**목표**: auto-detach batch, IndexedDB session-restore, `remove`/`add` case의 legacy snapshot 경로를 canonical event apply로 전환.

**대상 파일**:

- `apps/builder/src/builder/stores/history/historyActions.ts` — `remove`/`add` case legacy snapshot 경로
- `apps/builder/src/builder/stores/history/historyIndexedDB.ts` — session restore 경로

### `remove` case 전환

```typescript
// Before: element + childElements snapshot restore
case "remove": {
  if (entry.data.element) { elementsToRestore.push(cloneForHistory(entry.data.element)); }
  if (entry.data.childElements) { elementsToRestore.push(...entry.data.childElements); }
  break;
}

// After: canonical insert event apply (이미 add/remove는 Phase 0에서 canonical 변환됨)
// canonicalHistoryEvents.ts buildCanonicalRemoveEvents → canonicalEvents에 insert/remove 담김
case "remove": {
  const result = applyCanonicalHistoryEventsToActiveDocument(entry.data.canonicalEvents, "undo");
  if (result) { /* sync */ }
  break;
}
```

### `add` case 전환

동일 패턴 — `childElements` snapshot 경로 제거, canonical remove event apply.

### session-restore 경로

`historyIndexedDB.ts`에서 v1 entry를 로드할 때 legacy field를 canonical event로 변환하는 adapter 적용 (v2 migration 이전 in-memory fallback):

```typescript
function migrateV1EntryToV2(entry: HistoryEntry): HistoryEntry {
  if (entry.data.canonicalEvents) return entry; // 이미 canonical
  // diff/diffs: canonicalEvents로 래핑
  // element/childElements snapshot: insert/remove event 생성 (best-effort)
  // 변환 불가: canonicalEvents: [] (undo 시 no-op)
}
```

### Gate G3 검증

- `historyActions.ts` 전체에서 `entry.data.element`/`entry.data.childElements`/`entry.data.elements`/`entry.data.prevElements` 직접 읽기 0건 (type-check에서 확인 가능).
- `historyIndexedDB.ts` session restore 후 undo/redo targeted vitest PASS.

---

## Phase 4: legacy snapshot field 타입 surface 삭제

**목표**: `HistoryEntry.data` 타입에서 legacy field를 삭제해 compile-time 강제 적용.

**대상 파일**:

- `apps/builder/src/builder/stores/history.ts` — `HistoryEntry` 인터페이스

### 타입 변경

```typescript
// Before
export interface HistoryEntry {
  // ...
  data: {
    element?: Element;
    prevElement?: Element;
    props?: ComponentElementProps;
    prevProps?: ComponentElementProps;
    parentId?: string;
    prevParentId?: string;
    childElements?: Element[];
    elements?: Element[];
    prevElements?: Element[];
    batchUpdates?: Array<{
      elementId: string;
      prevProps: ComponentElementProps;
      newProps: ComponentElementProps;
    }>;
    groupData?: { groupId: string; childIds: string[] };
    diff?: SerializableElementDiff;
    diffs?: SerializableElementDiff[];
    canonicalEvents?: CanonicalHistoryNodeEvent[];
  };
}

// After (legacy fields 삭제)
export interface HistoryEntry {
  // ...
  data: {
    groupData?: { groupId: string; childIds: string[] }; // group/ungroup 메타 (non-snapshot)
    diff?: SerializableElementDiff; // 크기 추정용 유지 (undo/redo는 canonicalEvents)
    diffs?: SerializableElementDiff[]; // 크기 추정용 유지 (undo/redo는 canonicalEvents)
    canonicalEvents?: CanonicalHistoryNodeEvent[];
  };
}
```

`parentId`/`prevParentId`도 canonical event의 parentId로 표현 가능하므로 삭제.

### Gate G4 검증

```bash
pnpm type-check
```

compile error 0건이면 전수 수정 완료 증명.

---

## Phase 5: IndexedDB v1→v2 upgrade (one-shot entry conversion)

**목표**: `historyIndexedDB.ts`의 DB version을 v1→v2로 bump하고 기존 entry를 canonical event sequence로 one-shot 변환.

**대상 파일**:

- `apps/builder/src/builder/stores/history/historyIndexedDB.ts`

### DB version 전략

```typescript
// Before
const DB_NAME = "composition-history";
const DB_VERSION = 1;

// After
const DB_VERSION = 2;
```

### onupgradeneeded v1→v2 migration

```typescript
request.onupgradeneeded = (event) => {
  const db = (event.target as IDBOpenDBRequest).result;
  const oldVersion = event.oldVersion;

  if (oldVersion < 2) {
    // v1→v2: history-entries store의 모든 entry를 canonical event로 변환
    const transaction = (event.target as IDBOpenDBRequest).transaction!;
    const store = transaction.objectStore(STORE_ENTRIES);

    const cursorRequest = store.openCursor();
    cursorRequest.onsuccess = (e) => {
      const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
      if (!cursor) return;

      const entry = cursor.value as { entry: HistoryEntry };
      const migrated = migrateV1EntryToV2(entry.entry);
      cursor.update({ ...entry, entry: migrated });
      cursor.continue();
    };
  }
};
```

`migrateV1EntryToV2`: Phase 3에서 정의한 adapter 재사용.

### 변환 불가 entry 처리

- 변환 가능: `diff`/`diffs` 보유 → canonical update event 생성. `element`/`childElements` 보유 → insert/remove event 생성 (best-effort).
- 변환 불가 (스냅샷 없이 props만 있는 구형 entry 등): `canonicalEvents: []` → undo/redo 시 no-op graceful degradation.

### Gate G5 검증

- Chrome: 기존 history DB v1 entry 보유 상태에서 새 코드 로드 → v2 upgrade migration 성공 → undo/redo 동작 확인.
- Firefox: 동일.
- migration 실패 시 catch → `console.error` 후 in-memory mode 유지.
- 데이터 손실 0 확인: entry 수 before/after 동일 (변환 불가는 empty canonicalEvents로 보존).

---

## Phase 6: Final verification

**목표**: 전체 undo/redo pipeline의 회귀 0 검증.

### Targeted vitest

`apps/builder/src/builder/stores/history/__tests__/` 신규/갱신:

| 테스트 파일                          | 커버 범위                                                                   |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `canonicalUpdateEvent.test.ts`       | G1 round-trip (Phase 1 gate)                                                |
| `historyActions.canonical.test.ts`   | 6 entry type (add/remove/update/move/batch/group) undo/redo canonical apply |
| `historyIndexedDB.migration.test.ts` | v1→v2 migration adapter (migrateV1EntryToV2)                                |

### Grep gates (CI)

```bash
# HistoryEntry.data에 legacy field 읽기 0건
grep -rn "\.data\.element\b\|\.data\.prevElement\b\|\.data\.childElements\|\.data\.elements\b\|\.data\.prevElements\|\.data\.props\b\|\.data\.prevProps\b\|\.data\.batchUpdates" \
  apps/builder/src/builder/stores/history/ | grep -v "\.test\."
# 기대: 0건
```

### Browser smoke checklist

| 시나리오                       | undo                        | redo              |
| ------------------------------ | --------------------------- | ----------------- |
| 요소 추가                      | 요소 제거됨                 | 요소 복원됨       |
| 요소 props 변경                | 이전 props 복원             | 변경된 props 복원 |
| 요소 삭제                      | 요소 복원됨                 | 요소 제거됨       |
| 요소 이동                      | 이전 위치 복원              | 이동 후 위치 복원 |
| 그룹 생성                      | 그룹 해제 + children 원위치 | 그룹 재생성       |
| 그룹 해제                      | 그룹 재생성                 | 그룹 해제         |
| 세션 복원 (browser refresh 후) | undo 이력 유지              | redo 이력 유지    |

### Gate G6 통과 조건

- `pnpm type-check` PASS.
- targeted vitest PASS.
- browser smoke checklist 7 시나리오 전체 회귀 0.
- grep gate 0건.

---

## 파일 변경 예상 범위

| 파일                                                                | 변경 유형                                         | 예상 규모               |
| ------------------------------------------------------------------- | ------------------------------------------------- | ----------------------- |
| `apps/builder/src/builder/stores/history.ts`                        | HistoryEntry 타입 축소                            | -30줄                   |
| `apps/builder/src/builder/stores/history/canonicalHistoryEvents.ts` | update event 타입 + apply + builder 추가          | +150~200줄              |
| `apps/builder/src/builder/stores/history/historyActions.ts`         | legacy snapshot 읽기 → canonical event apply 전환 | -300 / +150줄 (순 -150) |
| `apps/builder/src/builder/stores/utils/historyHelpers.ts`           | trackBatchUpdate → canonical event 생성           | -20 / +30줄             |
| `apps/builder/src/builder/stores/history/historyIndexedDB.ts`       | DB_VERSION bump + migration                       | +80~100줄               |
| `apps/builder/src/builder/stores/history/__tests__/*.test.ts`       | 신규 unit test 3개                                | +300~400줄              |

---

## 체크리스트

- [x] Phase 0: inventory 측정 완료, [`124-inventory.md`](124-inventory.md) 기록 (2026-05-10)
- [x] Phase 1: `CanonicalUpdateEvent` 타입 + `applyNodePropsUpdate` + `buildCanonicalUpdateEvent` + G1 unit test 6/6 PASS (2026-05-10)
- [ ] Phase 1: `CanonicalUpdateEvent` 타입 + apply 함수 + G1 unit test PASS
- [x] Phase 2: update/batch entry → canonical event 부착 (entry 생성 layer), G2 static guard 6/6 PASS (2026-05-10). 단, historyActions.ts 의 case "update"/"batch" legacy fallback 은 Phase 5 v2 migration 후 제거 예정 (compatibility 보존)
- [x] Phase 3: `migrateV1EntryToV2` adapter 구현 + `historyIndexedDB.getEntriesByPage` 통합 (in-memory v1 → v2 변환), G3 unit test 13/13 PASS (2026-05-10)
- [x] Phase 4: HistoryEntry data 의 legacy field 8개에 `@deprecated ADR-124 Phase 4` 마킹 + interface JSDoc 강화 (2026-05-10). 실제 type 삭제는 Phase 5 v2 migration 완료 후 진입 (compile error 시 fallback cleanup 동반)
- [ ] Phase 3: add/remove/auto-detach + session-restore 경로 전환, G3 검증
- [ ] Phase 4: legacy field 타입 삭제, `pnpm type-check` PASS (G4)
- [x] Phase 5: IndexedDB DB_VERSION v1 → v2 bump + onupgradeneeded cursor migration (best-effort, graceful degradation 보장) (2026-05-10). Chrome + Firefox migration browser smoke 는 v1 IndexedDB 기존 사용자 환경에서 별도 단계 검증 (in-memory `migrateV1EntriesToV2` fallback 이 항상 보호함)
- [ ] Phase 6: targeted vitest + grep gate + browser smoke 7 시나리오 (G6)
