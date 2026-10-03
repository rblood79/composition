---
title: Layout Resolution Pattern
impact: HIGH
impactDescription: 잘못된 레이아웃 합성 = 페이지 렌더링 오류, ID 공간 오염
tags: [domain, layout, page, projection]
---

Page 와 재사용 레이아웃의 합성 규칙을 정의합니다.

> **정본**: [canvas-rendering.md §9 · §9.5](../../../rules/canvas-rendering.md) (렌더 identity ↔ 편집 대상 분리 · 해석은 한 곳). 본 문서는 구현 위치 지도입니다. 옛 Frame (`FrameNode reusable:true` + `type:"ref"` + `descendants[path].children`) · page-frame projection (`::page-frame::` projected id · `renderNodesMap` / `interactionNodesMap` / `sceneNodesMap` · `resolveCanonicalMoveTarget`) 은 ADR-248 Phase 4 (2026-10-03) 에서 삭제됐습니다.

## 체계

| 층      | 지금                                                                                                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 데이터  | 레이아웃 = `DefinitionEntry { usage: "layout", templateRootId }`. 페이지에 적용하면 **body 가 그 정의의 instance** 가 되고, 페이지 내용은 template slot 의 `fillSlot` override (`childIds`) 에 들어간다 |
| 해석    | shared resolver (`catalog/resolution/resolver.ts` `resolveCatalogNode` · `positions.ts`) 한 곳이 instance 를 펼친다. Canvas · DOM 은 같은 결과를 소비한다                                               |
| 렌더 키 | record identity = `instancePath` + `sourceId`. Canvas · overlay · 선택의 키이고 문서에는 쓰지 않는다                                                                                                    |
| 편집    | 명령에는 `EditTarget` / `NodeParent` (`{kind: "descendant", ownerId, address}` 포함) 만 넘긴다                                                                                                          |

## 명령과 구현 위치

| 역할                 | 위치                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 레이아웃 생성        | `createLayout` (`commands/project.ts`) — slot 선언 필수 (`LAYOUT_SLOT_REQUIRED`). Builder: `catalogNewLayoutCommand` (`catalogRuntime/layouts.ts`) |
| 적용 · 해제          | `applyLayout` (`definitionId` 없으면 해제) — 내부 `releaseLayout` 이 모든 slot 내용을 페이지로 되돌린 뒤 새로 적용                                 |
| 기본 내용 slot       | `layoutContentSlotPath` — `slotPath` → 이름 `content` → 첫 required → 첫 slot                                                                      |
| 삭제                 | `deleteLayout` — 쓰던 페이지는 `releaseLayout`                                                                                                     |
| slot 선언            | `NodeEntry.slot { name, required }` · `setSlotDeclaration` (`commands/fields.ts`), Builder `catalogSlotCommands` (`catalogRuntime/slots.ts`)       |
| 페이지 레이아웃 설정 | `catalogRuntime/pageLayoutSettings.ts` (`setPageLayoutSettings`)                                                                                   |
| Navigator 목록       | `catalogDefinitionList` (`catalogRuntime/layouts.ts`, Layouts 탭)                                                                                  |
| hit-test             | `CatalogCanvasPicking` · `pickTopmostRecord` (`catalogRuntime/canvasPick.ts`)                                                                      |
| 드롭 · 이동          | `canvasGesture.ts` · Layers `catalogLayerDropCommand` (`layerTree.ts`) → `moveNodes` (`NodeParent` descendant 포함)                                |

- 옛 `deriveProjectRenderModelFromDocument` · `::page-frame::` (`packages/shared/src/utils/export.utils.ts`) 는 publish · export 경로에만 남았습니다. Builder 경로가 아닙니다.

## 규칙

- **identity 비영속**: record identity · 선택 `identity` 를 문서 · IndexedDB · 히스토리 payload 에 쓰지 않습니다.
- **이동 대상은 `NodeParent`**: slot 안으로 옮길 때는 `{kind: "descendant", ownerId, address}` 를 `moveNodes` 에 넘깁니다. identity 문자열을 쪼개 대상 id 로 쓰지 않습니다.
- **해제 · 재적용 무손실**: `applyLayout` 의 해제 → 재적용에서 slot 내용 (`fillSlot.childIds`) 순서가 보존돼야 합니다. 레이아웃 적용 로직을 고치면 이 왕복을 테스트로 고정합니다.
- **해석은 resolver 하나**: slot 펼침을 Canvas 또는 DOM 한쪽에 따로 구현하지 않습니다 (D3 symmetric consumer). 변경 뒤 Canvas · Preview 양쪽을 `/cross-check` 로 확인합니다.

## Incorrect

```typescript
// ❌ record identity 를 이동 대상으로
workspace.execute(
  moveNodes({ ids, parent: { kind: "node", id: slotIdentity }, newId }),
);

// ❌ Canvas 쪽에서만 slot 내용을 합성
const children = [...layoutChildren, ...pageChildren];
```

## Correct

```typescript
// ✅ position 의 target 으로 NodeParent 를 만든다
const parent: NodeParent =
  target.kind === "node"
    ? { kind: "node", id: target.id }
    : { kind: "descendant", ownerId: target.ownerId, address: target.address };
workspace.execute(moveNodes({ ids, parent, newId }));

// ✅ 레이아웃 적용 · 해제는 명령 하나
workspace.execute(applyLayout({ pageId, definitionId, newId }));
```

## 참조 파일

- `packages/shared/src/catalog/commands/project.ts` — `createLayout` · `applyLayout` · `deleteLayout` · `layoutContentSlotPath`
- `packages/shared/src/catalog/document/types.ts` — `DefinitionEntry.usage` · `fillSlot` · `EditTarget` · `NodeParent`
- `packages/shared/src/catalog/resolution/resolver.ts` · `positions.ts`
- `apps/builder/src/builder/catalogRuntime/layouts.ts` · `slots.ts` · `pageLayoutSettings.ts` · `canvasPick.ts` · `layerTree.ts`
