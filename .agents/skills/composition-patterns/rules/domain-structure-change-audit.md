---
title: Element Structure Change Audit
impact: CRITICAL
impactDescription: Element 트리 구조 변경 시 소비자 전수 조사 누락 = Layer Tree/Canvas/Preview 전면 장애
tags: [domain, element, structure, audit]
---

Element 트리의 parent-child 관계를 변경할 때(래퍼 추가/제거, 중간 노드 삽입, parent 재배치 등) 반드시 수행해야 하는 **소비자 영향도 감사(Consumer Audit)** 절차를 정의합니다.

## 배경: Tabs 구조 변경 사고 (2026-02-25)

`Tabs > [Tab, Tab, Panel, Panel]` (flat) → `Tabs > [TabList > [Tab, Tab], TabPanels > [Panel, Panel]]` (nested)로 변경 시, Factory 1개만 수정하고 소비자 9곳을 누락하여 Layer Tree/Canvas/Preview 전면 장애 발생.

**교훈**: 데이터 구조 변경의 작업량은 "변경 자체"가 아닌 "소비자 수 × 수정 복잡도"로 결정됨.

## 필수 감사 절차

### Step 1: 소비자 식별 (grep 필수)

```bash
# 변경되는 type의 parent_id 참조 검색
rg "parent_id.*{ParentType}|type === '{ChildType}'" apps/ packages/ -g "*.tsx" -g "*.ts"

# 예: Tabs 구조 변경 시
rg "parent_id.*elementId.*Tab|type === 'Tab'|type === 'Panel'" apps/ packages/ -g "*.tsx" -g "*.ts"
```

### Step 2: 7개 서브시스템 체크리스트

| #   | 서브시스템           | 확인 파일                                      | 확인 사항                       |
| --- | -------------------- | ---------------------------------------------- | ------------------------------- |
| 1   | **Factory**          | `factories/definitions/*.ts`                   | 구조 정의 변경                  |
| 2   | **Layer Tree**       | `treeUtils.ts`, `useLayerTreeData.ts`          | 정렬/필터 로직, 표시명          |
| 3   | **Preview Renderer** | `renderers/*.tsx`, `renderers/index.ts`        | 자식 조회, 렌더러 등록          |
| 4   | **Preview HTML**     | `preview/App.tsx`                              | `resolveHtmlTag` 매핑           |
| 5   | **Type System**      | `unified.types.ts`                             | `defaultPropsMap` 등록          |
| 6   | **Property Editor**  | `editors/*Editor.tsx`                          | 자식 카운트, 추가/삭제 로직     |
| 7   | **Canvas**           | `BuilderCanvas.tsx`, `layout/engines/utils.ts` | 컨테이너 자식 렌더링, 높이 계산 |

### Step 3: 호환 레이어 설계 (Dual Lookup)

기존 데이터와의 하위 호환이 필요한 경우, 변경 전에 Dual Lookup 패턴을 설계합니다:

```typescript
// ✅ Dual Lookup: 기존 flat 구조와 새 nested 구조 모두 지원
function findChildrenByType(
  parentId: string,
  childType: string,
  wrapperType: string,
  getChildren: (id: string) => Element[],
): Element[] {
  const directChildren = getChildren(parentId).filter(
    (c) => c.type === childType,
  );
  if (directChildren.length > 0) return directChildren;

  // 래퍼 내부 검색
  const wrapper = getChildren(parentId).find((c) => c.type === wrapperType);
  if (wrapper) {
    return getChildren(wrapper.id).filter((c) => c.type === childType);
  }
  return [];
}
```

### Step 4: E2E 검증

구현 완료 후 반드시 실행:

1. **새 컴포넌트 생성** → 구조가 올바른지 Layer Tree에서 확인
2. **Canvas(WebGL)** → 모든 자식이 렌더링되는지 확인
3. **Preview(iframe)** → React Aria가 올바르게 작동하는지 확인
4. **Property Editor** → 자식 카운트, 추가/삭제 기능 확인

## Incorrect

```typescript
// ❌ Factory만 수정하고 소비자를 확인하지 않음
// LayoutComponents.ts만 변경
children: [
  { type: "TabList", children: [{ type: "Tab" }, { type: "Tab" }] },
  { type: "TabPanels", children: [{ type: "Panel" }, { type: "Panel" }] },
];
// → 9개 소비자가 깨짐

// ❌ 작업량을 "Factory 파일 1개 = 소" 로 판단
// Gap D: Tabs TabList 래퍼 추가 — 작업량: 소 ← 잘못된 평가
```

## Correct

```typescript
// ✅ 구조 변경 전 소비자 전수 조사
// 1. rg로 parent_id + type 패턴 검색
// 2. 7개 서브시스템 체크리스트 순회
// 3. 각 소비자에 Dual Lookup 적용
// 4. E2E 검증 (Layer Tree → Canvas → Preview → Editor)

// ✅ 작업량은 소비자 수 × 수정 복잡도로 산정
// Tabs 구조 변경: 10개 파일 × 7개 서브시스템 = 작업량: 대
```

## 참조 파일

- `apps/builder/src/builder/factories/definitions/` — Factory 정의
- `apps/builder/src/builder/utils/treeUtils.ts` — Layer Tree 정렬
- `packages/shared/src/renderers/` — Preview 렌더러
- `apps/builder/src/preview/App.tsx` — Preview HTML 태그 매핑
- `apps/builder/src/types/builder/unified.types.ts` — 타입/기본값
- `apps/builder/src/builder/panels/properties/editors/` — Property Editor
- `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx` — Canvas 렌더러
- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` — 레이아웃 높이 계산
