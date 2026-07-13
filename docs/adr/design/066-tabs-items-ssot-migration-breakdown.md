# ADR-066 구현 상세 — Tabs items SSOT 전환

본 문서는 [ADR-066](../completed/066-tabs-items-ssot-migration.md)의 구현 상세. Phase별 작업 순서 + 영향 파일 + 체크리스트.

## Phase 1: Spec + Factory + Renderer (core)

### 1.1 Tabs.spec.ts — items prop 추가

- `TabsProps` 인터페이스에 `items?: Array<{id: string; title: string}>` 추가
- `properties.sections`에 Item Management 섹션 추가 (custom editor hybrid — TabsHybridAfterSections 확장)
- render.shapes 변경 없음 (items 기반 렌더는 LayoutRenderers 측)

### 1.2 Factory (LayoutComponents.ts) — createTabsDefinition

Before: `Tabs > TabList[Tab×2] + TabPanels[TabPanel×2]` (5 elements)

After: `Tabs{items:[{id1,T1},{id2,T2}]} > TabList + TabPanels[TabPanel×2{customId=id}]` (4 elements)

- `newTabElement` 제거
- `items` 생성 + `customId = items[i].id`로 TabPanel 세팅
- 기본 `defaultSelectedKey = items[0].id`

### 1.3 LayoutRenderers.tsx — renderTabs

- 기존 Tab/TabPanel 직접 element 순회 제거
- `const items = element.props.items ?? []`
- `<TabList items={items}>{item => <Tab id={item.id}>{item.title}</Tab>}</TabList>`
- `<TabPanels items={items}>{item => <TabPanel id={item.id}>{renderChildrenOf(findPanelByCustomId(item.id))}</TabPanel>}</TabPanels>`
- `findPanelByCustomId(customId)`: elements.find(el => el.parent_id === tabPanelsEl.id && el.customId === customId)

## Phase 2: Store actions + sync reducer

### 2.1 addTabItem(tabsId: string, title?: string)

- uuid 생성 → `items.push({id, title: title ?? `Tab ${items.length+1}`})`
- TabPanels element 찾기 → 빈 TabPanel element insert (customId=id, parent_id=tabPanelsEl.id)
- Tabs.props.items 업데이트 + `layoutVersion++`
- first item이면 `defaultSelectedKey = id` 자동 설정

### 2.2 removeTabItem(tabsId: string, itemId: string)

- **가드**: `items.length <= 1` → no-op + console.warn
- items 배열에서 필터링
- 매칭 TabPanel element id 찾기 → `removeElement(panelId)` (기존 cascade 로직 재사용 — 자식 subtree 자동 삭제)
- `defaultSelectedKey === itemId`였다면 남은 첫 항목으로 변경

### 2.3 renameTabItem(tabsId: string, itemId: string, title: string)

- items[index].title 갱신 + `layoutVersion++`

### 2.4 reorderTabItems(tabsId: string, newOrder: string[])

- items 배열 재정렬 + `layoutVersion++`
- TabPanel element의 order_num 재할당 (items 순서 기준)

## Phase 3: Editor UI

### 3.1 TabsEditor.tsx — Item Management 리스트

- 기존 "Add Tab" 버튼 유지하되 내부 동작을 `addTabItem` store action으로 전환
- 아래에 items 리스트 섹션:
  ```
  [Tab 1      ] [×]
  [Tab 2      ] [×]  ← items.length===1이면 × 비활성
  [+ Add tab]
  ```
- title input: onChange → `renameTabItem`
- × 버튼: onClick → `removeTabItem`

### 3.2 TabEditor.tsx 삭제

- Tab element 소멸 → 개별 편집기 불필요
- `editors/index.ts`에서 export 제거
- `inspector/editors/registry.ts`에서 참조 없음 확인

### 3.3 specRegistry.ts — Tab 항목 제거

- Tab element 없어지므로 property editor 진입점도 제거
- TabList/TabPanels/TabPanel은 유지 (여전히 selectable)

## Phase 4: TabList 우측 +/- 오버레이 (DOM)

### 4.1 Selection overlay 확장

- 기존 `apps/builder/src/builder/workspace/canvas/overlays/`에 유사 overlay 컴포넌트 존재 확인 필요
- Tabs element 선택 시 TabList 경계 우측에 절대 위치 `<div.tab-manage-overlay>`:
  ```html
  <div class="tab-manage-overlay" style="left: tabListRight; top: tabListTop">
    <button class="add" onClick={addTabItem}>+</button>
    <button class="remove" disabled={items.length<=1} onClick={removeLastTab}>−</button>
  </div>
  ```
- CSS: `panel-system.css` 또는 신설 overlay CSS

### 4.2 위치 계산

- Tabs element layout bounds → TabList 자식 bounds 조회 → 그 right 좌표
- pan/zoom 적용 (기존 overlay 패턴 준용)

## Phase 5: Runtime 정리 — Tab element 로직 제거

### 5.1 implicitStyles.ts

- `containerTag === "tablist"` 블록: children map Tab 주입 로직 제거 → **가상 Tab array 생성**
  ```ts
  const tabsParent = findAncestorByTag(containerEl, "Tabs", ...);
  const items = tabsParent?.props?.items ?? [];
  filteredChildren = items.map((item, i) => ({
    id: `${tabsParent.id}:virtualTab:${item.id}`,
    tag: "Tab",
    props: { title: item.title, tabId: item.id, _virtual: true, style: {height: tabBarHeight, minHeight: tabBarHeight} },
    parent_id: tabListEl.id,
    order_num: i + 1,
    page_id: tabListEl.page_id,
  }));
  ```
- `containerTag === "tabpanels"` 블록: panelItems filter에서 `tag === "TabPanel"` (이미 적용됨)

### 5.2 utils.ts calculateContentHeight Tabs 분기

- 활성 TabPanel 찾기: `items.find(i => i.id === selectedKey)?.id` → TabPanel customId로 탐색
- 기존 Tab.props.tabId 기반 로직 제거

### 5.3 elementRemoval.ts

- `tag === "Tab"` 처리 블록 **전부 제거** (Tab element 없음)
- TabPanel 삭제 시 해당 items 항목도 제거하는 역방향 sync 추가 검토:
  - 레이어 트리에서 TabPanel 개별 삭제 → 매칭 items 항목도 제거 필요
  - 가드: 마지막 1개면 Tabs 자체 삭제? → 설계 결정 필요 (일단 단순히 items 배열에서 제거 + 마지막 남은 경우 가드 적용)

### 5.4 elementReorder.ts

- Tab+Panel 쌍 reorder 로직 제거 → items 배열 재정렬로 대체

### 5.5 HierarchyManager.ts / treeUtils.ts

- Tab filter 블록 제거
- pairedItems 로직(Tab+Panel 쌍 그룹화) 제거

### 5.6 useLayerTreeData.ts

- "Tab" display name 블록 제거 (실제 element 없음)
- Tabs 노드 하위 virtual Tab row 표시 여부 결정:
  - (권장) items 기반 가상 노드 표시, selectable=false (UI 힌트만)
  - TabPanel은 그대로 selectable

### 5.7 TAG_SPEC_MAP / specRegistry Tab 정리 방향

- Skia spec 경로는 `buildSpecNodeData` 가상 Tab element 처리 위해 **TAG_SPEC_MAP의 Tab 항목 유지** (Q1=b 결정)
- specRegistry는 Tab 제거 (editor 진입점 없음)

## Phase 6: AI / 메타데이터 / 번역

### 6.1 systemPrompt.ts + tools/definitions.ts

- Tabs 생성 시 items prop 사용 안내 추가

### 6.2 metadata.ts

- Tab entry 제거 (TabList/TabPanels/TabPanel 유지)

### 6.3 translations.ts

- "tab" 키 제거

## Phase 7: README.md + ADR Status

- `docs/adr/README.md` 테이블에 ADR-066 행 추가
- ADR-066 Status: Proposed → Implemented

## 영향 파일 요약

| 카테고리      | 파일 수                                                                           |
| ------------- | --------------------------------------------------------------------------------- |
| Spec          | 1 (Tabs.spec.ts)                                                                  |
| Factory       | 1 (LayoutComponents.ts)                                                           |
| Renderer      | 1 (LayoutRenderers.tsx)                                                           |
| Store actions | 2~3 (신설 action 파일 or elements.ts 확장)                                        |
| Editor        | 2 (TabsEditor 확장 + TabEditor 삭제)                                              |
| Overlay       | 2~3 (overlay 컴포넌트 + CSS)                                                      |
| Runtime       | 6 (implicitStyles/utils/elementRemoval/elementReorder/HierarchyManager/treeUtils) |
| 레이어 트리   | 1 (useLayerTreeData)                                                              |
| 레지스트리    | 2 (specRegistry/tagSpecMap Tab 재검토)                                            |
| AI/메타       | 3                                                                                 |
| Docs          | 2 (ADR + README)                                                                  |

**총 ~25 파일** (ADR-065보다 규모 작음, 대부분 mechanical edit)

## 검증 체크리스트

- [ ] 신규 Tabs 삽입 → 2 items + 2 TabPanel 생성, 시각 동일
- [ ] TabsEditor에서 Add → items+TabPanel 동기 추가
- [ ] TabsEditor에서 Remove → items+TabPanel 동기 제거, 마지막 1개 가드 동작
- [ ] TabList 우측 +/- 버튼 → Add/Remove 동일 동작
- [ ] TabPanel 선택 후 자식 Form/Card 드래그 → 정상 편집
- [ ] title 변경 → Skia 즉시 width 조정
- [ ] defaultSelectedKey items[0].id 자동 설정
- [ ] 선택된 탭 삭제 시 defaultSelectedKey 자동 전환
- [ ] `pnpm build:specs` 107개 유지
- [ ] `pnpm type-check` 3/3 통과
