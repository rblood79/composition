---
title: Element Hierarchy Rules
impact: CRITICAL
impactDescription: 잘못된 계층 구조 = 렌더링 오류, 데이터 손실
tags: [domain, element, hierarchy]
---

catalog 문서의 계층 구조와 주소 체계를 정의합니다. 문서 정본은 `CatalogGraph` (`packages/shared/src/catalog/document/graph.ts`), 타입은 `packages/shared/src/catalog/document/types.ts` 입니다.

## 계층 구조

```
ProjectEntry
├── pageIds[] → PageEntry          (route · name · children)
│   └── children[0] = body 노드    (definitionId "lib:definition:type-body")
│       └── NodeEntry.children[]   (사용자 요소 트리)
├── definitionIds[] → DefinitionEntry
│   ├── usage: "component"          재사용 컴포넌트 — templateRootId 아래 템플릿 트리
│   └── usage: "layout"             페이지 레이아웃 — body 가 이 정의의 instance 가 된다
├── stateVariableIds[] → StateVariableEntry
└── interactionIds[] → InteractionEntry
```

- **식별자**: 노드는 `definitionId` 를 갖고, 타입명은 `definitionTypeName` (`commands/context.ts`) 이 정의에서 유도합니다. 옛 `type` · `parent_id` · `page_id` 필드는 문서 노드에 없습니다.
- **순서**: `NodeEntry.children` · `PageEntry.children` · `ProjectEntry.pageIds` 배열이 정본입니다. `order_num` 은 옛 레코드를 로드할 때 지웁니다 (`lib/db/indexedDB/adapter.ts` `deleteLegacyOrderFields`).
- **소유**: 부모는 필드가 아니라 graph 인덱스로 찾습니다 — `graph.ownerOf(id)`.
- **생성 위치**: 새 페이지 (`catalogRuntime/pageTree.ts`) · 새 프로젝트 (`catalogRuntime/project.ts`) 는 body 노드 하나를 함께 만듭니다. 레이아웃이 적용된 페이지의 내용 slot 은 `layoutContentSlotPath` (`commands/project.ts`) 가 고릅니다.

## 주소 체계 — 소유 노드 ↔ 인스턴스 안 위치

| 타입                                                | 뜻                                                                                                          |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `EditTarget {kind: "node", id}`                     | 문서가 소유한 노드                                                                                          |
| `EditTarget {kind: "descendant", ownerId, address}` | 인스턴스 `ownerId` 안 template position (`InstanceAddress`) — 쓰기는 owner 의 `descendantOverrides` 로 간다 |
| `NodeParent`                                        | 삽입 · 이동의 부모 — 같은 두 갈래                                                                           |
| record identity (`instancePath` + `sourceId`)       | Canvas · overlay · 선택의 **렌더 키** — 문서 · 명령 대상에 쓰지 않는다                                      |

- 패널 · Canvas 의 행은 `CatalogPosition` (`catalog/resolution/positions.ts`) 하나가 `target` 과 `identity` 를 같이 줍니다. 명령에는 `target` 을 넘깁니다.

## 중첩 판정

- 판정은 명령 안의 `assertNestable` (`commands/context.ts`) → `resolveNestingViolation` (`catalog/nesting/nestingRules.ts`) 입니다. 위반이면 `NESTING_NOT_ALLOWED` 로 명령이 실패합니다.
- 층 순서: Pen 구조 (`PEN_LEAF_TYPES` = Text · Icon) → RAC 합성 (`RAC_COLLECTION_CHILD_TYPES` · `RAC_SUBPART_OWNER_TYPES`) → HTML 의미 (`DOM_LEAF_TYPES` 등).
- 호출자가 leaf 목록을 하드코딩해 따로 막지 않습니다 — 판정이 갈립니다.

## Incorrect

```typescript
// ❌ record identity 를 쪼개 문서 id 로 사용
const nodeId = identity.split("::").pop();
workspace.execute(moveNodes({ ids: [nodeId], ... }));

// ❌ 호출자 쪽 leaf 하드코딩
const LEAF_TYPES = ["Text", "Image", "Icon", "Separator"];
if (LEAF_TYPES.includes(parentType)) return;
```

## Correct

```typescript
// ✅ position 의 target 을 명령에 넘긴다 — 중첩 판정은 명령이 한다
workspace.execute(
  removeTargets({ targets: selection.map((item) => item.target) }),
);
```

## 참조 파일

- `packages/shared/src/catalog/document/types.ts` — `ProjectEntry` · `PageEntry` · `NodeEntry` · `DefinitionEntry` · `EditTarget` · `NodeParent`
- `packages/shared/src/catalog/document/graph.ts` — `ownerOf` · `getEntry`
- `packages/shared/src/catalog/resolution/positions.ts` — `CatalogPosition`
- `packages/shared/src/catalog/nesting/nestingRules.ts` — 중첩 3층
- 레이아웃 적용: [domain-layout-resolution.md](domain-layout-resolution.md)
