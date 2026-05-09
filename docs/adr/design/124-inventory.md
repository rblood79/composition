# ADR-124 Phase 0 — History entry inventory (2026-05-10)

본 문서는 [ADR-124 design breakdown §Phase 0](124-canonical-only-history-schema-breakdown.md) 의
inventory 측정 결과를 freeze 한다. main HEAD `f54c2495c` 기준.

## 1. 측정 결과 (정량)

| 측정 대상                                           | 명령                                                                                                                                                               | 결과      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| legacy snapshot field reads in `historyActions.ts`  | `grep -nE "data\.element\b\|data\.prevElement\b\|data\.childElements\|data\.elements\b\|data\.prevElements\|data\.props\b\|data\.prevProps\b\|data\.batchUpdates"` | **167건** |
| canonical event / diff reads in `historyActions.ts` | `grep -nE "data\.canonicalEvents\|data\.diff\b\|data\.diffs\b"`                                                                                                    | **26건**  |

→ 약 86% 가 legacy snapshot field 직접 read (canonical migration 미완 상태).

## 2. HistoryEntry data field 11개 → bucket 분류

`apps/builder/src/builder/stores/history.ts:44-65` 정의:

| Field                                           | bucket              | Phase        | 처리                                                         |
| ----------------------------------------------- | ------------------- | ------------ | ------------------------------------------------------------ |
| `element?: Element`                             | `snapshot-remove`   | Phase 3      | canonical insert event 로 변환                               |
| `prevElement?: Element`                         | `snapshot-remove`   | Phase 3      | canonical insert/update event 로 변환                        |
| `props?: ComponentElementProps`                 | `snapshot-remove`   | Phase 2      | canonical update event prevProps/nextProps 로 변환           |
| `prevProps?: ComponentElementProps`             | `snapshot-remove`   | Phase 2      | canonical update event prevProps 로 변환                     |
| `parentId?: string`                             | `snapshot-remove`   | Phase 4      | canonical event parentId 로 표현 (필드 삭제)                 |
| `prevParentId?: string`                         | `snapshot-remove`   | Phase 4      | canonical move event fromParentId 로 표현 (필드 삭제)        |
| `childElements?: Element[]`                     | `snapshot-remove`   | Phase 3      | canonical insert/remove event sequence 로 변환               |
| `elements?: Element[]`                          | `snapshot-batch`    | Phase 2      | canonical update event sequence 로 변환                      |
| `prevElements?: Element[]`                      | `snapshot-batch`    | Phase 2      | canonical update event sequence 로 변환                      |
| `batchUpdates?: Array<{...}>`                   | `snapshot-batch`    | Phase 2      | canonical update event sequence 로 변환                      |
| `groupData?: { groupId, childIds }`             | `non-snapshot meta` | Phase 4 유지 | group/ungroup 메타 (canonical 직접 표현 불가)                |
| `diff?: SerializableElementDiff`                | `diff-based`        | Phase 2      | canonical update event 로 래핑, diff 자체는 size 추정용 유지 |
| `diffs?: SerializableElementDiff[]`             | `diff-based`        | Phase 2      | 동일                                                         |
| `canonicalEvents?: CanonicalHistoryNodeEvent[]` | `canonical-done`    | —            | 이미 변환됨, 확장만 (Phase 1 update event 추가)              |

→ Phase 4 후 `data` 타입은 `groupData` / `diff` / `diffs` / `canonicalEvents` 4개 필드만 유지.

## 3. historyActions.ts case block 분포

`apps/builder/src/builder/stores/history/historyActions.ts` 의 `case "<type>":` 분포:

| Case      |   등장 횟수 | line range                                                          |
| --------- | ----------: | ------------------------------------------------------------------- |
| `add`     |           6 | 290 / 411 / 714 / 969 / 1069 / 1325 / 1704                          |
| `update`  |           6 | 300 / 425 / 738 / 994 / 1075 / 1381 / 1722                          |
| `remove`  |           6 | 320 / 493 / 768 / 1005 / 1112 / 1422 / 1768                         |
| `batch`   |           6 | 345 / 512 / 826 / 1015 / 1126 / 1446 / 1788                         |
| `group`   |           6 | 351 / 589 / 853 / 1021 / 1203 / 1478                                |
| `ungroup` |           6 | 358 / 638 / 877 / 1031 / 1239 / 1524                                |
| `move`    | 0 in switch | (현재 batch 또는 group 으로 흡수, 또는 canonical event 로만 표현됨) |

→ 6 case × 7 entry 위치 ≒ 42 case block. legacy snapshot field 167 reads 가 이들 case block
에 분산.

## 4. canonicalHistoryEvents.ts 현재 schema

`apps/builder/src/builder/stores/history/canonicalHistoryEvents.ts` (현재):

```typescript
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
```

→ `update` event 부재. Phase 1 에서 `{ type: "update"; nodeId; prevProps; nextProps }` 추가 필요.

## 5. historyIndexedDB.ts 현재 schema version

`apps/builder/src/builder/stores/history/historyIndexedDB.ts:43-44`:

```typescript
const DB_NAME = "composition-history";
const DB_VERSION = 1;
```

→ Phase 5 에서 v1→v2 upgrade. 기존 entry 의 legacy field 를 canonical event sequence 로 one-shot
변환. 변환 불가 entry 는 `canonicalEvents: []` 로 graceful degradation.

## Phase 0 완료 기준 (G0)

- [x] legacy snapshot field reads 167건 측정
- [x] canonical event / diff reads 26건 측정
- [x] HistoryEntry data field 11개 bucket 분류 완료
- [x] historyActions.ts case block 분포 측정 (42 case block)
- [x] canonicalHistoryEvents.ts schema 현황 freeze (update event 부재 확인)
- [x] historyIndexedDB.ts DB version 확인 (v1, Phase 5 에서 v2 upgrade)
- [x] Phase 1 진입 가능 — `CanonicalUpdateEvent` 타입 정의 + apply 함수로 직진
