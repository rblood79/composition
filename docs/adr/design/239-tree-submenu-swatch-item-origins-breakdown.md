# ADR-239 구현 상세 — Tree · Menu 하위 메뉴 · ColorSwatchPicker 항목 origin (재귀 항목)

> 본문: [ADR-239](../239-tree-submenu-swatch-item-origins.md) · base: [ADR-234](../completed/234-variant-instances-and-slot-filled-collections.md) · 선행: [ADR-238](../238-collection-item-slots-sections-picker-items.md) (항목 역할 표 · 경로 포함 항목 key)

## 1. 전제 확정 기록 (fork 4 질문 · 사용자 confirm)

사용자 confirm 2026-09-24 (AskUserQuestion 2문항 — "3개로 분리" · 작은 항목 "Tree ADR 에 포함"). 근거: 같은 날 `/deep-research` (react-aria.adobe.com) + `react-aria-components@1.21.0` 소스 + 코드 조사.

1. **base / 응용**: 234 가 base (변형 = 완성된 상태 origin 의 ref · slot = 추천 항목 · 정적 목록 = instance 자식 · 바인딩 = `items`). 239 는 그 규칙을 **재귀 항목** (항목 안에 같은 종류 항목) 에 적용하는 응용이다.
2. **schema 직교성**: 새 저장 필드 없음. 새 canonical 노드 type 없음 — TreeItem · MenuItem · ColorSwatch 는 이미 type 이다. `expandedKeys` 는 Tree 의 기존 prop (Preview writeback 이 이미 쓴다).
3. **선행 전제 역전 검증**: 239 → 238 단방향 — 항목 역할 표 (238 Phase 1) 와 경로 포함 항목 key (238 Phase 2) 를 재사용한다. 238 이 먼저 반영돼야 한다 (역전 없음 — 238 은 239 를 모른다).
4. **범위**: Tree (TreeItem 재귀 · 펼침 · 선택 · 상태 변형) · Menu 하위 메뉴 (MenuItem 재귀) · ColorSwatchPicker 항목 (ColorSwatch instance 자식) · LoadMore 판정 (저작 모델 밖 — 기록만). 범위 밖: TreeSection (RAC alpha) · Tree 드래그 · NavigationTree (catalog 밖) · ColorSwatch Canvas 색 채움 (2026-06-11 사용자 방침 box-only 유지).

## 2. 레퍼런스 — RAC (`react-aria-components@1.21.0` · starter `packages/react-aria-starter/src`, read-only)

| ID  | 사실                                                                                                                                                                                                         | 근거                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| R1  | Tree = `Tree > TreeItem > TreeItemContent` 이고 TreeItem 안에 TreeItem 을 넣어 재귀한다. dynamic Tree 는 같은 render 함수를 `<Collection items={item.children}>` 로 다시 부른다 (반복 템플릿 = 재귀 템플릿). | react-aria.adobe.com/Tree · starter `Tree.tsx:53-63`                              |
| R2  | TreeItemContent 의 이름 있는 slot = `chevron` (펼침 Button) · `selection` (Checkbox, toggle 선택일 때) · `drag` (Button, drag 가능할 때) — owner 설정이 켜는 부품.                                           | starter `Tree.tsx:25-47` · `dist/private/Tree.mjs` provider `slots`               |
| R3  | Tree 펼침 = `expandedKeys` (controlled) / `defaultExpandedKeys` — 기본은 아무것도 펼치지 않는다. render prop `isExpanded` · `hasChildItems` · `level`.                                                       | react-aria.adobe.com/Tree                                                         |
| R4  | Menu 하위 메뉴 = `SubmenuTrigger > MenuItem + Popover > Menu` — 하위 Menu 의 항목도 MenuItem (재귀).                                                                                                         | starter `Menu.tsx:68-76` · react-aria.adobe.com/Menu                              |
| R5  | ColorSwatchPicker 항목 = `ColorSwatchPickerItem color` — 선택 값이 색이라 같은 색 항목 둘은 같이 선택된다.                                                                                                   | `dist/exports/ColorSwatchPicker` · react-aria.adobe.com/ColorSwatchPicker         |
| R6  | LoadMore 항목 (`ListBoxLoadMoreItem` · `TreeLoadMoreItem` 등) 은 비동기 목록의 "더 불러오기" 부품 (`isLoading` · `onLoadMore`) — 데이터 경로의 런타임 부품이다.                                              | starter `ListBox.tsx:47-51` · `Tree.tsx:65-71` · react-aria.adobe.com/collections |

## 3. 코드 사실 (2026-09-24, main `44ec413ad`)

| ID  | 사실                                                                                                                                                                                                                                                                                                    | 위치                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Tree 항목은 이미 canonical TreeItem 요소다 (`items` 아님) — `Tree: ["TreeItem"]` · `TreeItem: ["TreeItem"]` 중첩 규칙, factory 는 평면 TreeItem 2 (`props.children` = 글자).                                                                                                                            | `packages/shared/src/catalog/nesting/nestingRules.ts:280-281` · `apps/builder/src/builder/factories/definitions/LayoutComponents.ts:75-109`                                                        |
| F2  | Components 페이지 `component-tree` origin 자식 = plain TreeItem 2 · `slot` 없음. TreeItem origin · 상태 변형 · slot host 행 · 정적 가족 행이 없다.                                                                                                                                                      | 새 문서 probe (2026-09-24) · `components/slotHostPolicy.ts:203-289` · `stateVariantOrigins.ts:57-79` · `packages/shared/src/catalog/slotRoles.ts:365-375`                                          |
| F3  | Preview `renderTree` 는 TreeItem 자식을 재귀로 RAC 에 넘기고 key = 요소 id. `expandedKeys` 는 controlled 로 부재 시 `[]` (전부 접힘), `onExpandedChange` 가 `props.expandedKeys` 를 쓴다. 선택도 `selectedKeys` writeback.                                                                              | `packages/shared/src/renderers/CollectionRenderers.tsx:86-211` (펼침 `:160-169` · writeback `:180-206`)                                                                                            |
| F4  | **Canvas 는 Tree 펼침을 읽지 않는다** — canvas · specs 에 `expandedKeys` reader 0, 모든 중첩 TreeItem 을 그리고 chevron 은 항상 오른쪽 (아래는 `props.isExpanded === true` 일 때만인데 TreeItem 에 주입 경로 없음). Preview 기본 (전부 접힘) 과 Canvas (전부 펼침) 가 갈린다.                           | `workspace/canvas/skia/buildSpecNodeData.ts:1772-1786` · `packages/specs/src/renderers/skiaPrimitives.ts:2501,2540-2543`                                                                           |
| F5  | Canvas TreeItem 들여쓰기 = `_treeLevel` (TreeItem 조상 수) × `indentPerLevel` · chevron 은 자식이 있을 때만 · 선택 checkbox 는 부모 Tree 설정으로.                                                                                                                                                      | `buildSpecNodeData.ts:559-621,1772-1786` · `packages/specs/src/renderers/buildCatalogShapes.ts:39,411`                                                                                             |
| F6  | 단독 TreeItem Preview (`renderTreeItem`) 는 `id={element.customId}` — 재귀 경로 (`id={item.id}`) 와 key 규칙이 다르다.                                                                                                                                                                                  | `CollectionRenderers.tsx:216-250`                                                                                                                                                                  |
| F7  | Menu 하위 메뉴는 `items` 의 `children` (재귀) 로만 저장된다. Preview 는 `items` 전용 경로 · 바인딩 경로에서만 `SubmenuTrigger` 를 그리고, section/separator 가 섞인 구조 경로 (`renderMenuLeaf`) 는 `children` 을 버린다. 정적 이관은 `children` 이 있는 행을 건너뛴다.                                 | `packages/specs/src/types/menu-items.ts:25-42` · `CollectionRenderers.tsx:938-951` · `packages/shared/src/components/Menu.tsx:306-321,385-398` · `components/staticCollectionMigration.ts:360-370` |
| F8  | Canvas 는 Menu 트리거만 그린다 (MenuItem 은 popover 내용) — 하위 메뉴도 Canvas 변화 없음.                                                                                                                                                                                                               | `buildSpecNodeData.ts:1802-1807`                                                                                                                                                                   |
| F9  | ColorSwatchPicker 항목은 이미 ColorSwatch 자식 요소 (factory 6개, `props.color`). Preview 는 ColorSwatch 자식 → `ColorSwatchPickerItem key={child.id} color`, picker 에는 style · className 만 넘긴다 (binding 의 `defaultValue` 등 미전달). ColorSwatchPicker · ColorSwatch 모두 reusable origin 없음. | `factories/definitions/DateColorComponents.ts:649-691` · `packages/shared/src/renderers/LayoutRenderers.tsx:1980-2011` · `packages/shared/src/catalog/componentCatalog.ts:1228-1290`               |
| F10 | ColorSwatch Canvas 는 box 만 그린다 (`props.color` 미반영) — 2026-06-11 사용자 방침 "color leaf box-only".                                                                                                                                                                                              | `packages/shared/src/catalog/bindings/ColorSwatch.binding.ts:7-9` · `componentCatalog.ts:1043`                                                                                                     |
| F11 | LoadMore 항목 소비처 0 (starter 정의뿐).                                                                                                                                                                                                                                                                | `packages/react-aria-starter/src/{ListBox,GridList,Tree,Table}.tsx`                                                                                                                                |

## 4. Phase

### Phase 0 — inventory freeze (G0)

- F1~F11 재grep · 238 반영 상태 (역할 표 · 경로 포함 key) 확인 — 미반영이면 착수 보류.
- 진단 RED:
  - (a) Tree instance 에 Slot "+" 없음 · TreeItem 안에 항목 추가 경로 없음 (F2).
  - (b) 중첩 TreeItem 이 있는 Tree: Canvas 전부 펼침 vs Preview 전부 접힘 (F4 — 두 leg 발산).
  - (c) 같은 TreeItem origin 을 참조하는 형제의 상속 자식 key 충돌 (238 (c) 와 같은 뿌리 — 재귀라 깊이마다).
  - (d) section 이 섞인 Menu 의 하위 메뉴가 Preview 에서 사라짐 (F7).
  - (e) ColorSwatchPicker 에 같은 색 swatch 둘 → Preview 선택이 둘 다 켜짐 (R5).
- 이관 수식 실측 (문서당): (i) Components 새 노드 — TreeItem origin 2 (선택 · `--unselected`) + 상호작용 4 + `--collapsed` 1 · ColorSwatch origin 1 · ColorSwatchPicker origin 1 (swatch ref 6) (ii) 사용자 Tree 의 plain TreeItem `n` → ref `n` (항목당 byte 실측) (iii) `children` 이 있는 정적 Menu 행 `k` → 중첩 ref `k` (iv) 사용자 ColorSwatchPicker swatch `s` → ref `s` (v) 바인딩 Tree · Menu Δ0.

### Phase 1 — Tree 항목 origin · slot · 재귀 (G1)

- **TreeItem origin**: `component-tree-item-default` (선택 상태 — 234 규칙) + `--unselected` · 상호작용 변형 (hover · pressed · focus-visible · disabled) · `--collapsed` (237 `collapsed` 층 — root 전용). 역할 자식 = 238 역할 표에 TreeItem 행 추가 (icon · label ● · description — RAC TreeItemContent 의 자유 자식이라 전부 DEFAULT_SLOT). chevron · selection · drag 는 역할이 아니다 (R2 — owner 설정 부품).
- **Tree origin**: `component-tree` 자식 = TreeItem origin instance (한 항목은 자식 항목 1 을 가진 중첩 예시) · `slot` = TreeItem origin 2.
- **재귀 slot host**: Tree 와 **TreeItem instance** 모두 host — TreeItem 의 후보는 소속 Tree 의 slot (owner 조회). "+" = 그 자리에 TreeItem instance 자식.
- **key**: 238 경로 포함 key 를 TreeItem 에도 (깊이마다 경로 접두). 단독 TreeItem Preview 의 `customId` key (F6) 를 같은 함수로.

### Phase 2 — 펼침 두 leg 대칭 (G2)

- **정본 = Tree `expandedKeys`** (R3 · F3 그대로). Canvas 는 접힌 TreeItem 의 자식 TreeItem 을 layout · 그리기에서 뺀다 (Disclosure `isDisclosureExpandedInContext` 와 같은 자리 — layout 과 Skia 가 한 판정 함수를 읽는다). chevron 방향 = 유효 펼침.
- **기존 문서 보존 이관 (hydration, 1회 · 멱등)**: 중첩 TreeItem 이 있고 `expandedKeys` 가 **없는** (한 번도 토글 안 한 — Preview writeback 은 배열을 쓴다) Tree 는 부모 항목 key 전부를 `expandedKeys` 로 채운다 → Canvas 픽셀 그대로 (지금 전부 펼침) · Preview 는 접힘 → 펼침으로 바뀐다 (두 leg 일치). `expandedKeys: []` 가 있는 문서는 사용자 선택이라 건드리지 않는다.
- Components 페이지 변형 노드는 강제 상태 (`--collapsed` = 접힘).

### Phase 3 — Menu 하위 메뉴 (G3)

- MenuItem instance 가 자식 MenuItem instance 를 가지면 하위 메뉴 — Preview 는 `SubmenuTrigger > MenuItem + Popover > Menu` 로 합성 (정적 자식 경로 · 구조 경로 공통 함수). MenuItem 도 slot host (후보 = Menu slot).
- 이관: `children` 이 있는 정적 Menu 행 → 중첩 instance 자식 (`hasUnsupportedRows` 에서 `children` 조건 제거 — section · separator 는 238 이 처리).
- Canvas 변화 없음 (F8).

### Phase 4 — ColorSwatchPicker 항목 · LoadMore 판정 (G4)

- ColorSwatch reusable origin (팔레트 밖 — 233 Radio 선례 `placeable:false`) · ColorSwatchPicker origin (팔레트 reusable) 자식 = swatch ref 6 · `slot` = ColorSwatch origin. slot host 행 (key 배정 = 형제와 다른 색 — 237 Radio `value` 유일값과 같은 자리).
- Preview picker 에 binding props (`defaultValue` · `layout` · `isDisabled`) 전달 (F9 — `accepts` 선언 prop 이 DOM 에 안 닿는 결함).
- Canvas 는 box 유지 (F10 사용자 방침).
- LoadMore: 저작 모델에 넣지 않는다 (R6 · F11 — 바인딩 목록 런타임 부품). 기록만.

### Phase 5 — 성능 · BC (G5 · G6)

- G5: 같은 세션 headed A/B (대조 arm = 239 전 빌드 worktree) — fixture = 사람이 만든 모양 (Tree 3 단계 × 30 항목 × 20 · Menu 하위 메뉴 2 단계) · 불리 조작 (TreeItem origin 편집 · 펼침 토글 · breakpoint 전환).
- G6: Canvas 픽셀 이관 전후 동일 (Tree 중첩 · ColorSwatchPicker) · Preview Tree 는 펼침 이관 뒤 Canvas 와 같은 항목 집합 (renderer unit) · Δbyte 수식 · 재hydration Δ0 (IndexedDB 저장 층 live).

## 5. 실행 기록

(실행 시 기록)
