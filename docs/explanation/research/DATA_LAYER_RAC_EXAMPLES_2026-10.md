# 데이터 층 연구 — RAC 공식 예제 · 데이터 어휘 · 빌더 gap (2026-10-26)

> 목적: 사용자 질문 「GridList 에 Users 데이터가 묶여 있고 RadioGroup (all · male · female) 으로 거르려면 어떻게 하나 · RAC 는 무엇을 주나 · 조건은 Checkbox · TextField · Select 등 여러 컨트롤의 조합이다 · Adobe 예제만 봐도 filter + sort 조합이다」 에서 시작해, 빌더가 RAC 데이터 층 (collection · 선택 · 필터 · 정렬 · 묶음 · CRUD · drag & drop · Form · 비동기 로드) 을 **새 어휘 없이** 사용자에게 전달하려면 무엇이 필요한지 적은 연구 기록. 정본 우선순위는 설치본 (`react-aria-components` 1.22.1 · `react-aria` 3.53.0 · `react-stately` 3.51.0 · `@react-types/shared` 3.37.0 · `@react-spectrum/s2` 1.8.1) 의 `d.ts` 이고, 공식 저장소 (`adobe/react-spectrum` main, 2026-10-26 sparse clone — `packages/dev/s2-docs/pages/react-aria/examples/` · `pages/react-aria/*.mdx` · `pages/s2/*.mdx` · `starters/`) 는 예제와 지침의 출처다. 이 문서는 ADR 이 아니다 — 사실 · 원형 · gap · 결정 지점만 나열한다. 사용자 원칙: [Interactions 는 RAC 표면을 UI 로 전달, 새 어휘 금지](../../../.claude/rules/state-management.md) (메모리 `project-interactions-expose-rac-surface-not-new-vocabulary`, 2026-10-22) · 앞선 연구 [INTERACTION_REDESIGN_RAC_S2_2026-10](INTERACTION_REDESIGN_RAC_S2_2026-10.md) (상호작용 28 개념 — 이 문서는 그중 데이터 축만 깊게 본다).

## 0. 요약

1. **RAC 자체에는 「목록을 거른다 · 정렬한다 · 묶는다」 기능이 없다.** 컴포넌트는 받은 `items` 를 그리기만 하고, 거르기 · 정렬 · 묶기는 앱 state 와 앱 코드 (`array.filter` · `toSorted` · `collator.compare`) 가 한다. RAC 가 주는 것은 비교 함수 (`useFilter` · `useCollator`), 상태 묶음 훅 (`useListData` · `useAsyncList` · `useTreeData`), 그리고 **표시 층** 글자 검색 (`Autocomplete filter`) 뿐이다 (§3).
2. 공식 예제 7 종을 전부 읽은 결과, 데이터가 있는 예제 5 종 (plants · photos · kanban · ios-list · emoji-picker) 은 **같은 한 가지 모양**이다 — 「원본 배열 (state) → 조건 · 정렬로 파생한 `items` → 한 개 이상의 collection 컴포넌트」. 조건 값은 전부 **컨트롤이 쓰는 state 변수** (SearchField → string · Checkbox → boolean · TagGroup → `Selection` · Tree 선택 → key · Table `onSortChange` → `SortDescriptor`) 이고, 조건끼리는 AND, 빈 값 (빈 글자 · false · 빈 Set · `'library'` 같은 「전체」 키) 이면 건너뛴다 (§2 · §4).
3. 필터는 **두 층**이다 — 데이터 층 (필드 비교 · 서버 전달 가능) 과 표시 층 (RAC `Autocomplete` 가 렌더된 항목의 `textValue` 로 거름 · 서버에 못 보냄 · 키보드 · 가상 포커스는 RAC 가 처리). photos 는 둘을 같이 쓴다 (§2.2).
4. **묶기 (group by) 는 RAC 에 없다.** kanban 은 상태값 3 개를 손으로 적은 열 3 개가 각자 `items.filter(t => t.status === status)` 로 거른 뒤, drop 때 `list.update(id, {…, status})` 로 **묶음 필드를 바꿔** 열을 옮긴다. 섹션 (`ListBoxSection`) 은 미리 중첩된 데이터 (`{name, children}`) 만 받는다 (§2.4 · §3.4).
5. **drag & drop 은 list 명령의 조합**이다 — `onReorder` → `moveBefore/After` · `onInsert` → `update` + `moveBefore/After` · `onRootDrop` → `update` 또는 `append` · `onDragEnd(move, !isInternal)` → `remove`. 빌더의 list 명령 (append · update · remove · insert* · move*) 은 이미 있고, 없는 것은 `useDragAndDrop` 배선과 drop 이벤트 → 명령 연결이다 (§3.6 · §5).
6. 빌더 현황: 바인딩 · list CRUD · tree 데이터 · API 로드 (cursor · `{{ filterText }}` · `{{ sortDescriptor }}`) · Table 정렬 (클라이언트 collator · 서버) · Autocomplete `contains` · 빈 상태 · load more · Form 제출은 있다. **없는 것**: 로컬 (mock) 데이터를 다른 컨트롤 · 변수로 거르기, Table 밖 정렬, 결과를 두 화면이 공유하는 보기, 필드로 묶기, collection drag & drop, 파생값 (개수 · 조건 수 · 선택 수), 변수 변경 때 endpoint 다시 부르기, 조건부 · 다단계 규칙 (§5).
7. 설계 함의 (구현 제안 아님): 「컨트롤이 필터다」 가 아니라 **「변수가 조건의 값이다」** 로 묶어야 한다 (Slider 가 photos 에서는 필터가 아니라 타일 크기다). 「원본 + 조건 목록 + 정렬」 을 바인딩 하나가 아닌 **이름 있는 보기**로 두어야 plants 처럼 Table 과 GridList 가 같은 결과를 쓴다. 조건 = 필드(들) + 비교 방식 + 값 참조 (`!var`) + 건너뛰는 값. 비교 방식은 값 모양 (string · Key · boolean · Key[] · number · 범위 · 날짜) 이 정한다 (§6).
8. 사용자 결정이 필요한 것은 문서 구조 (보기 entry 신설 vs 바인딩 필드) · Table 정렬 소유 이동 (ADR-257) · 파생값 범위 · 표시 층 Autocomplete 를 collection 에 감싸는 경로 · 조건부 규칙 (ADR-158 「한 줄」) 재개 여부 다섯 가지와, §8 에서 더한 로컬 데이터 조회 범위 하나다 (§7).
9. 「다양한 조회 · 필터 조건을 쉽게」 기준으로 §6 을 다시 보면 (§8) 모델은 예제 범위를 덮지만 쉬움 · 다양함에 빈 곳이 있다 — 필터 하나에 저작 4 단계 (변수 · 규칙 · 조건 · 바인딩) · API 데이터는 조건과 endpoint `{{ }}` 를 두 번 정의 · 비교 방식을 값 모양만으로 고름 · 「아님 · 빈 값 · 배열 포함 · 상대 날짜」 비교 없음. 조건 OR 묶음 · 집계 · 테이블 관계 (조인) 는 범위 밖으로 둘 근거가 없어 (§8.3.1) 설계에 넣고 phase 로 나눈다 — 저장 형식은 첫 phase 에서 셋의 자리를 모두 연다 (§8.4).

## 1. 방법

### 1.1 입력

- 공식 저장소 sparse clone (scratchpad, 2026-10-26): `packages/dev/s2-docs/pages/react-aria/examples/{plants,photos}/` · `emoji-picker.mdx` · `ios-list.mdx` · `kanban.mdx` · `ripple-button.mdx` · `swipeable-tabs.mdx` + `Tab*.tsx` · `pages/react-aria/*.mdx` (collections · selection · dnd · forms · Autocomplete · Virtualizer · Table · useListData · useAsyncList · useTreeData · useFilter · useCollator) · `pages/s2/{collections,selection,ActionBar,TableView,ListView,CardView}.mdx` · `starters/{docs,tailwind}/src/`.
- 설치본 d.ts: react-stately `data/useListData.d.ts` · `useAsyncList.d.ts` · `useTreeData.d.ts` · `layout/*.d.ts` · `table/useTableState.d.ts`, `@react-types/shared` `collections.d.ts` · `selection.d.ts` · `dnd.d.ts`, RAC `Autocomplete.d.ts` · `useDragAndDrop.d.ts` · `Virtualizer.d.ts` · `Table.d.ts`, react-aria `i18n/useFilter.d.ts`.
- 빌더 소스: `packages/shared/src/catalog/document/types.ts` · `interactions/*` · `catalog/runtime/catalogPreviewSession.ts` · `domBinding.runtime.ts` · `delegatedDom.runtime.ts` · `domBinding.components.tsx` · `collections/resolveCollectionItems.ts` · `apps/builder/src/builder/components/property/CollectionBinding.tsx` · `panels/interactions/*`.

### 1.2 절차

세 갈래 (예제 7 종 · RAC 어휘 · 빌더 현황) 를 병렬 조사한 뒤, 보고의 핵심 인용을 원문으로 다시 확인했다 — kanban 의 `onInsert` (`update` + `moveBefore/After`) · ios-list 의 `selectionMode` 변수 · emoji-picker 에 섹션 · 최근 항목 · 피부색 없음 · Autocomplete 가 감쌀 수 있는 자식 목록 · `Sortable` 이 Table 만 · RAC ComboBox · ListBox · GridList · Select 에 `loadingState` prop 없음 · 빌더 행 상한 `COLLECTION_ROW_PROJECTION_WINDOW_LIMIT = 100` (`packages/shared/src/collections/resolveCollectionItems.ts:36`) · `interactionRule.types.ts:9-11` 「조건부 실행 / 다중 actions[] 원천 제거」 — 모두 일치.

### 1.3 문서 drift (읽을 때 주의)

- `useAsyncList.mdx` · `useListData.mdx` · `useTreeData.mdx` 예제는 옛 Spectrum v3 JSX (`Picker` · `<Item key>` · ComboBox `loadingState`) 다. RAC 의 ComboBox · Select · ListBox · GridList 에는 `loadingState` prop 이 없다 (설치 d.ts 0 건).
- `ListLayout` 의 `rowHeight` · `estimatedRowHeight` · `headingHeight` · `loaderHeight` 는 deprecated — `*Size` 이름이 현재다. `Virtualizer.mdx:764` 는 아직 옛 이름을 쓴다.
- `useTreeData` 의 `selectedKeys` 와 `useAsyncList` 의 `initialSelectedKeys` 는 `'all'` 을 받지 않는다 (`useListData` 는 받는다).

## 2. 공식 예제 7 종 — 데이터 흐름 사실

### 2.1 plants (crud) — 필터 5 + 정렬 + CRUD, 두 화면 공유

`plants/App.tsx`:

```tsx
let [allItems, setAllItems] = useState<Plant[]>(…);                       // 원본
let [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({column: 'common_name', direction: 'ascending'});
let [visibleColumns, setVisibleColumns] = useState<Selection>(new Set([…]));
let [search, setSearch] = useState('');                 // SearchField        → string
let [favorite, setFavorite] = useState(false);          // Checkbox          → boolean
let [cycles, setCycles] = useState<Selection>(new Set()); // TagGroup multiple → Selection ×3
let {contains} = useFilter({sensitivity: 'base'});
let collator = useCollator();
let items = allItems
  .filter(item =>
    (contains(item.common_name, search) || contains(item.scientific_name.join(''), search)) &&
    (!favorite || item.isFavorite) &&
    (cycles === 'all' || cycles.size === 0 || cycles.has(item.cycle)) && …)
  .sort((a, b) => collator.compare(a[sortDescriptor.column], b[sortDescriptor.column]) * dir);
```

- `useListData` 는 쓰지 않는다. 렌더마다 filter → sort 를 다시 계산한다.
- 조건은 AND. 빈 값은 통과 (`contains(x, '')` = true · `!favorite` · `size === 0`). 한 조건이 두 필드를 OR 로 본다 (이름 · 학명).
- 적용 조건 수 배지는 같은 state 에서 계산 (`filters++` · `cycles.size`). Clear 는 state 들을 비운다.
- 거르고 정렬한 같은 `items` 를 `PlantList` (GridList, 모바일) 와 `PlantTable` (Table, 데스크톱) 이 함께 받는다. 전환은 CSS (`hidden md:block` / `md:!hidden`).
- `PlantTable.tsx`: 자기 state 없음 — `sortDescriptor` · `onSortChange` · `visibleColumns` · `items` 전부 prop. 보이는 열은 `allColumns.filter(c => visibleColumns === 'all' || visibleColumns.has(c.id))` (L41) · `TableBody dependencies={[columns]}` (L56) · `renderEmptyState` (L57). 행 안 `ToggleButton isSelected={item.isFavorite} onChange={v => onFavoriteChange(item.id, v)}` (L65-68) = **행의 boolean 필드를 바꾸는 컨트롤**.
- `PlantActionMenu.tsx`: `MenuItem onAction` → 즐겨찾기 토글 · 수정 · 삭제 (L32-40); `SubmenuTrigger` 의 `href` 가 행 필드로 만들어진다 (`encodeURIComponent(item.common_name)`, L41-62).
- `PlantDialog.tsx`: 폼 필드는 **uncontrolled 이고 현재 항목으로 시드** (`defaultInputValue` · `defaultValue` · `defaultSelectedKey`) · `Form action={formData => …}` 가 `Object.fromEntries(formData)` 를 모델 모양으로 고쳐 (`sunlight` 배열 · `default_image.thumbnail`) `id = item?.id || Date.now()` 로 upsert (L27-35). `DropZone` 은 `getDropOperation` 으로 MIME 를 보고 `isFileDropItem` → `URL.createObjectURL` → hidden input (L38-63). 추가 · 수정 모드는 `item ? 'Edit' : 'Add'`.
- 삭제는 `Modal isOpen={dialog === 'delete'}` + `AlertDialog onAction` (`chain(onAction, close)` — `starters/tailwind/src/AlertDialog.tsx:47`). 열림은 변수 `dialog` 와 「현재 항목」 변수 `actionItem` 두 개로 제어 (L126-136 · 283-294).

### 2.2 photos — 두 층 필터 · Tree 선택이 조건 · drop 이 필드 변경

`photos/App.tsx:18`:

```tsx
let visiblePhotos = useMemo(
  () =>
    album === "library" ? library : library.filter((p) => p.album === album),
  [album, library],
);
```

- 데이터 층: `Tree selectionMode="single" disallowEmptySelection selectedKeys={[album]} onSelectionChange={keys => setAlbum([...keys][0])}` (`Sidebar.tsx`). 「전체」 는 특정 키 `'library'`.
- 표시 층: `PhotoGrid.tsx:70` `<Autocomplete filter={contains} disableVirtualFocus>` 가 `SearchField` 와 `GridList` 를 감싼다. 거르는 기준은 `GridListItem textValue={photo.description || photo.username}` (L20). 데이터 필드를 모르고 서버에 못 보낸다.
- `Slider value={size}` 는 필터가 아니다 — `Virtualizer layout={WaterfallLayout} layoutOptions={{minItemSize: new Size(size, size)}}` 의 입력 (L80-97).
- drag & drop: `getItems: (keys, items) => items.map(item => ({photo: JSON.stringify(item)}))` (L41) · Sidebar `acceptedDragTypes: ['photo']` · `shouldAcceptItemDrop: target => target.key !== 'library' && target.key !== selectedAlbum` (L31-34) · `onItemDrop` → `library.map(photo => photoIds.includes(photo.id) ? {...photo, album} : photo)` = **묶음 필드 변경** → 거른 목록이 다시 계산.
- `PhotoDetail.tsx`: 선택한 항목 하나를 보여 주는 상세 (`selectedPhoto` 변수 · `onBack` 이 비움) · `document.startViewTransition` + `flushSync` (L30-41).

### 2.3 emoji-picker — 표시 층 검색만

- state 없음. `<Select defaultValue="🥳">` uncontrolled · `Autocomplete filter={contains}` 의 글자도 uncontrolled (mdx L34 · 39-40).
- 모듈 수준 정적 선필터 `_emojis.filter(e => typeof e.label === 'string' && !e.label.startsWith('regional indicator'))` (L28).
- 항목 `textValue = label + tags.join(' ')` (L64) — 검색은 이 합성 글자 하나로.
- `Virtualizer layout={GridLayout}` (`minItemSize` · `maxItemSize` `Size(32,32)` · `minSpace` · `preserveAspectRatio`, L41-48) + `ListBox layout="grid"`.
- **섹션 · 최근 항목 · 피부색 선택은 없다** (`ListBoxSection` · `Collection` · recent · skin 0 건). emojibase 의 `group` 필드도 쓰지 않는다.

### 2.4 kanban — 묶음 = 손으로 적은 열 + 필드 같음, 이동 = update + move

`kanban.mdx`:

```tsx
let list = useListData({initialItems: tickets});                                   // L120
<Column status="Open" list={list} … /> <Column status="In Progress" … /> <Column status="Closed" … />  // L126-128
let items = list.items.filter(t => t.status === status);                           // L140
```

- 열은 데이터에서 유도하지 않는다 — 상태값 3 개를 손으로 적었다.
- 각 열이 자기 `useDragAndDrop` 을 만들고 모두 **같은 `list`** 에 쓴다 (L142-202):
  - `getItems: ({'issue-id': item.id, 'text/plain': item.title})` · `acceptedDragTypes: ['issue-id']` · `getDropOperation: () => 'move'`
  - `onInsert` (다른 열에서 항목 사이로): `list.update(id, {...list.getItem(id)!, status})` 그 뒤 `dropPosition` 에 따라 `list.moveBefore/moveAfter(e.target.key, ids)` (L170-182)
  - `onRootDrop` (빈 열): `update(… status)` 만 (L185-192)
  - `onReorder` (같은 열): `moveBefore/moveAfter(e.target.key, e.keys)` (L195-201) — 순서는 전역 배열 하나에 있어 열 안 재정렬이 전역 순서를 바꾼다
  - `renderDropIndicator` → `<DropIndicator target>` · `<Button slot="drag">` 손잡이
- 열 머리 개수 `{items.length} {items.length === 1 ? 'task' : 'tasks'}` (L208) · `renderEmptyState={() => 'No tasks.'}` (L215).
- 열마다 `selectionMode="multiple"` 은 uncontrolled 이고 스타일에만 쓰인다.

### 2.5 ios-list — 선택 모드가 변수 · 선택 수가 조건 · 일괄 삭제

`ios-list.mdx:118-125 · 140-153`:

```tsx
let [items, setItems] = useState(messages.emails);
let [selectedKeys, setSelectedKeys] = useState<Selection>(new Set());
let [selectionMode, setSelectionMode] = useState<SelectionMode>("none");
let onDelete = () => { setItems(items.filter(i => selectedKeys !== 'all' && !selectedKeys.has(i.id))); setSelectedKeys(new Set()); setSelectionMode("none"); };
<Button onPress={() => { setSelectionMode(m => m === "none" ? "multiple" : "none"); setSelectedKeys(new Set()); }}>{selectionMode === "none" ? "Edit" : "Cancel"}</Button>
<GridList onAction={selectionMode === "none" ? () => {} : undefined} selectionMode={selectionMode} selectedKeys={selectedKeys} onSelectionChange={setSelectedKeys}>
```

- `selectionMode` 자체가 **변수**다 (Edit / Cancel 토글이 바꾸고 선택도 비운다).
- Delete 버튼은 `opacity: selectionMode === "none" ? 0 : 1` · `isDisabled={selectedKeys !== 'all' && selectedKeys.size === 0}` (L133-134) = **선택 수에서 파생한 boolean**.
- 일괄 삭제는 `'all'` 을 처리한다 (`'all'` 이면 전부 지움). 한 항목 삭제는 `items.filter(i => i !== item)` (객체 동일성).
- 밀어서 삭제: motion `drag="x"` · 80 % 넘으면 `onRemove()` · drag 시작 때 `document.dispatchEvent(new PointerEvent("pointercancel"))` 로 RAC press 취소 (L209-225) · 키보드는 `onFocus → x.set(-100)`. 재정렬은 없다.

### 2.6 swipeable-tabs — 선택 ↔ 스크롤 양방향

- 앱 state 없음. `TabListStateContext` 로 자식이 Tabs 의 내부 상태를 읽고 쓴다 (`TabPanelCarousel.tsx:5`).
- 선택 → 스크롤: `useLayoutEffect` 가 `state.selectedItem.index` 의 패널로 `scrollTo({left, behavior: 'smooth'})` (L33-40).
- 스크롤 → 선택: `onScrollEnd` 가 `Math.round(scrollLeft / offsetWidth)` 로 `state.setSelectedKey([...state.collection][index].key)` (L9-14 · 52); `scrollend` 없는 Safari 는 300 ms debounce polyfill.
- CSS scroll-snap · scroll-driven animation (`timelineScope` · `scrollTimeline`) · anchor positioning 으로 지시자 · `TabPanel shouldForceMount`.

### 2.7 ripple-button — 이벤트 payload 를 잠깐 state 로

- `Button onPress={e => setCoords({x: e.x, y: e.y})}` (press 좌표) → `<div key={`${x},${y}`}>` 가 애니메이션 → `onAnimationEnd={() => setCoords(null)}`. 데이터 변경 없음.

### 2.8 S2 문서에서 더 본 것

- **`renderActionBar={(selectedKeys) => <ActionBar>…</ActionBar>}`** (S2 `TableView` · `ListView` · `CardView`, `s2/ActionBar.mdx:15-71`) — 선택이 생기면 일괄 동작 막대. 「선택 수 → 동작 노출」 을 컴포넌트 prop 하나로 만든 S2 표면 (RAC 에는 없음, D2).
- `collections.mdx` (S2): 동적 collection = `items` + render 함수 (항목 객체 동일성으로 memo) · `dependencies` 는 외부 state 를 읽을 때 (「항목 객체 자체를 갱신하는 편을 권장」) · `Collection` 으로 정적 + 동적 · 여러 출처 합치기 · `id` 는 섹션 넘어 전역 유일 · 비동기는 `useAsyncList` + `loadingState` · `onLoadMore`.
- `selection.mdx` (S2): select all 은 `'all'` 문자열 — 「무한 스크롤에서 안 불러온 항목까지 포함」 이 이유 · `onAction` 은 선택이 없을 때 동작, 있을 때는 토글 · 터치는 long press 로 선택 모드.
- `TableView.mdx:739-786`: 정렬은 `allowsSorting` 열 + `onSortChange` → **앱이 정렬** → `sortDescriptor` 로 표시. `useAsyncList` 예제 (`TableView.mdx:241`) 는 `loadingState` · `onLoadMore`.
- `router.tsx` · `RoutedSideNav.tsx` · `SideNavPanelApp.tsx`: `RouterProvider navigate={setSelectedRoute}` — 선택 ↔ 라우트 (앞선 연구의 `routeSelection` 개념).

## 3. RAC · react-stately 데이터 어휘 (설치본 기준)

### 3.1 상태 묶음 훅 (react-stately `data/`)

| 훅                                   | 옵션                                                                                                                                                                                                                                                                                            | 상태                                                                                 | 명령                                                                                                                                                                                                                                                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useListData<T>`                     | `initialItems` · `initialSelectedKeys: 'all' \| Iterable<Key>` · `initialFilterText` · `getKey` · `filter(item, filterText)`                                                                                                                                                                    | `items` · `selectedKeys: Selection` · `filterText` · `getItem(key)`                  | `insert(index, …)` · `insertBefore/After(key, …)` · `append` · `prepend` · `remove(…keys)` · `removeSelectedItems()` · `move(key, toIndex)` · `moveBefore/After(key, keys)` · `update(key, T \| (prev) => T)` · `setSelectedKeys` · `addKeysToSelection` · `removeKeysFromSelection` · `setFilterText` |
| `useAsyncList<T, C>` (ListData 확장) | `load({signal, cursor, filterText, sortDescriptor, selectedKeys, items, loadingState})` 필수 → `{items, cursor?, selectedKeys?, sortDescriptor?, filterText?}` · `sort?` (없으면 `sortDescriptor` 가 `load` 로) · `initialSortDescriptor` · `initialSelectedKeys: Iterable<Key>` (`'all'` 불가) | + `isLoading` · `error` · `sortDescriptor` · `loadingState`                          | + `reload()` · `loadMore()` · `sort(descriptor)`                                                                                                                                                                                                                                                       |
| `useTreeData<T>`                     | `initialItems` · `getKey` · `getChildren`                                                                                                                                                                                                                                                       | `items: TreeNode[]` (`{key, parentKey, value, children}`) · `selectedKeys: Set<Key>` | `insert(parentKey \| null, index, …)` · `append/prepend(parentKey \| null, …)` · `move(key, toParentKey \| null, index)` · `moveBefore/After` · `remove` · `update(key, T)` (updater 함수 없음)                                                                                                        |

- `LoadingState = 'loading' | 'sorting' | 'loadingMore' | 'error' | 'idle' | 'filtering'` (`@react-types/shared/collections.d.ts:34`).
- `useListData` 의 `filter` 는 `filterText` 가 빈 글자여도 **항상 실행**된다 (`dist/private/data/useListData.mjs:22`) — 「전체」 처리는 `filter` 안에서.
- 지침: 「React 는 prop 으로 넘기는 데이터 구조가 immutable 이어야 한다」 (`useListData.mdx:24`) · 「선택은 항목이 지워지면 자동 갱신」 (`:31`) · 정식 배선 `items={list.items} selectedKeys={list.selectedKeys} onSelectionChange={list.setSelectedKeys}` (`:66-69`).

### 3.2 정렬

- `SortDescriptor {column: Key; direction: 'ascending' | 'descending'}` · `Sortable {sortDescriptor?, onSortChange?}` (`collections.d.ts:90-104`).
- **Table 만** `Sortable` 을 확장한다 (`react-stately/table/useTableState.d.ts:9 · 68`). `Column allowsSorting` (`RAC/Table.d.ts:205`). GridList · ListBox · Tree 에 정렬 prop 없음.
- 문서 (`Table.mdx:521`): 「`onSortChange` 로 받은 descriptor 로 **데이터를 정렬하고** `sortDescriptor` 를 Table 에 넘겨 표시」 — 정렬은 앱 몫.
- 클라이언트 정렬 = `useCollator()` + `collator.compare(a[col], b[col])` · 서버 정렬 = `load({sortDescriptor})` (`useAsyncList.mdx:112-160`).

### 3.3 필터 · 검색

- **`useFilter(options?: Intl.CollatorOptions): {startsWith, endsWith, contains}`** (`react-aria/i18n/useFilter.d.ts`) — 글자 둘을 locale 규칙으로 비교하는 함수 묶음. 목록을 거르지 않는다. `contains("female", "male")` 은 true 라 정해진 값 고르기 (gender) 에는 「같음」 이 맞다.
- **`Autocomplete`**: `filter?: (nodeTextValue, node) => boolean` (`RAC/Autocomplete.d.ts:12`) · `disableVirtualFocus` · `disableAutoFocusFirst`. 감쌀 수 있는 자식 = `SearchField | TextField` + **`Menu` · `ListBox` · `TagGroup` · `GridList` · `Table`** (`Autocomplete.mdx:1249-1252`; Tree 없음). `filter` 를 주지 않으면 「items 는 controlled」 → 서버 검색은 `inputValue={list.filterText} onInputChange={list.setFilterText}` + `useAsyncList load({filterText})` (`:1065-1093`). 항목은 `textValue` 가 필요.
- **ComboBox**: `items` (controlled) / `defaultItems` (uncontrolled) · `defaultFilter` (기본 `useFilter` contains) · `allowsEmptyCollection` · `allowsCustomValue` · `inputValue`/`onInputChange` 와 `value`/`onChange` 는 「한 상호작용에 둘 중 하나만」 (`ComboBox.mdx:291`).
- **SearchField**: `value`/`onChange` · `onSubmit` (Enter) · `onClear`.
- 서버 필터 로딩 상태는 `'filtering'`.

### 3.4 묶기 (섹션)

- `ListBoxSection` · `MenuSection` + `Header` (`collections.mdx:35`) · `GridListSection` · `TreeSection` 은 alpha (`GridList.mdx:538` · `Tree.mdx:242`). 머리 없는 섹션은 `aria-label` 필수.
- `<Collection items={…}>` 으로 섹션 안 동적 항목 · 여러 출처 합치기 (`collections.mdx:237-271`). `id` 는 섹션을 넘어 전역 유일.
- **필드로 묶는 helper 는 없다** (`groupBy` 0 건). 문서는 미리 중첩된 `{name, children}` 만 보여 준다 (`ComboBox.mdx:71-109`). `useTreeData` 로 섹션을 받칠 수도 있다 (`useTreeData.mdx:96-99`).
- `dependencies?: ReadonlyArray<any>` — 항목 렌더가 외부 state 를 읽을 때 (`Collection` · `TableHeader/Body` · `Row`); 「전체 목록을 무효화하므로 항목 객체를 갱신하는 편이 낫다」 (`collections.mdx:233`).

### 3.5 선택

- `Selection = 'all' | Set<Key>` · `SelectionMode = 'none' | 'single' | 'multiple'` · `SelectionBehavior = 'toggle' | 'replace'` · `disallowEmptySelection` · `disabledKeys` · `disabledBehavior = 'selection' | 'all'` · `escapeKeyBehavior = 'clearSelection' | 'none'` (`selection.d.ts`).
- `onSelectionChange(keys: Selection)` 는 **항상 Set 또는 `'all'`** (`selection.mdx:17 · 219`). 단일 전용 (Tabs) 은 `selectedKey`. `selectionMode="single"` 도 `selectedKeys` Set 을 받는다 (`:526`).
- `onAction` / `onRowAction(key)`: 「toggle 에서 선택이 없으면 동작, 있으면 토글; replace 에서는 더블클릭이 동작, long press 가 선택 모드」 (`:564-566`).
- **컴포넌트 간 선택 공유 지침은 없다** — 보이는 패턴은 `useState<Selection>` 을 `selectedKeys` / `onSelectionChange` 에 controlled 로 넘기는 것뿐 (`:21-54`).

### 3.6 drag & drop (`useDragAndDrop` → `dragAndDropHooks`; ListBox · GridList · Tree · Table)

- 출발: `getItems(keys, items) => DragItem[]` (없으면 drag 불가) · `renderDragPreview` · `getAllowedDropOperations` · `onDragStart/Move/End` (`onDragEnd` 의 `isInternal`).
- 도착: `acceptedDragTypes: 'all' | (string | symbol)[]` · `shouldAcceptItemDrop(target, types)` · `getDropOperation(target, types, allowed) => 'move' | 'copy' | 'link' | 'cancel'` · `onRootDrop{items, dropOperation}` · `onItemDrop{items, dropOperation, isInternal, target}` · `onInsert{items, dropOperation, target: ItemDropTarget}` · `onReorder{keys, target}` (같은 부모 · 사이만) · `onMove{keys, target}` (on 포함 · 부모 이동 가능) · `onDrop` (포괄) · `onDropEnter/Exit/Activate` · `renderDropIndicator` → `<DropIndicator>` · `isDisabled` · `dropTargetDelegate`.
- `DropTarget = {type: 'root'} | {type: 'item', key, dropPosition: 'on' | 'before' | 'after'}` · drop 항목 종류 `text` (`getText(type)`) · `file` · `directory` 와 guard `isTextDropItem` · `isFileDropItem` · `isDirectoryDropItem` (`DIRECTORY_DRAG_TYPE` 필요).
- **정식 조합** (`dnd.mdx:585-670`): `getItems` 가 `JSON.stringify(item)` · `onInsert` → `insertBefore/After` · `onRootDrop` → `append` · `onReorder` → `moveBefore/After` · `onDragEnd` 가 `'move' && !isInternal` 이면 `remove` · Tree 는 `onMove` 의 `'on'` 에 `tree.move(key, target.key, index)`.

### 3.7 Virtualizer

- `<Virtualizer layout={ListLayout | GridLayout | WaterfallLayout | TableLayout} layoutOptions={…}>` 가 collection 을 감싼다. 「항목 위치는 Layout 이 정하고 flex · grid CSS 는 적용되지 않는다」 (`Virtualizer.mdx:42`).
- `ListLayout` (`rowSize` · `estimatedRowSize` · `headingSize` · `loaderSize` · `gap` · `padding` · `orientation`) · `GridLayout` (`minItemSize` · `maxItemSize` · `preserveAspectRatio` · `minSpace` · `maxColumns`; `layout="grid"` 필요) · `WaterfallLayout` (Grid 와 같되 `preserveAspectRatio` 없음) · `TableLayout`.
- 무한 로드는 Virtualizer 별도 기능이 아니라 `*LoadMoreItem` 패턴 그대로.

### 3.8 collection 컴포넌트의 데이터 prop

- `items` + render 함수 (항목 객체 동일성 memo) · `id` (기본 `item.id`; `array.map` 이면 `key` 와 `id` 둘) · `textValue` (typeahead · 필터) · `dependencies`.
- `renderEmptyState`: ListBox · GridList · Tree · Menu · TagList · TableBody.
- `*LoadMoreItem` (`ListBox` · `GridList` · `Tree` (각 TreeItem 끝) · `Menu` · `Table`) + `onLoadMore` · `isLoading` · `scrollOffset`; 정식 배선 `onLoadMore={list.loadMore} isLoading={list.loadingState === 'loadingMore'}` (`collections.mdx:324-326`) · 첫 로드 스피너는 `renderEmptyState`.
- Table: `TableHeader columns` · `Row columns` · `Column isRowHeader` · `treeColumn` · `expandedKeys`. Tree: `TreeItem` 안 재귀 `<Collection items={item.children}>`.
- ListBox · GridList `layout: 'stack' | 'grid'` · `orientation`.

### 3.9 Form

- React 19 는 `action={formData => …}`, 그 전은 `onSubmit` (`forms.mdx:43`). 기본은 브라우저 전체 제출 (`:39`).
- `validationBehavior`: RAC Form 기본 `'native'` (제출 막음) · `'aria'` (편집 중 표시, 제출 허용) (`RAC/Form.d.ts:17-19` · `forms.mdx:258`).
- 서버 오류 `validationErrors: {[name]: string | string[]}` — 편집하면 지워짐 (`:264`) · 필드 `validate` · `isInvalid` · `FieldError` · `onInvalid` (첫 invalid 필드 포커스, `preventDefault` 로 막음) · `onReset`.
- 지침: 「대부분 uncontrolled 폼 + 내장 검증으로 충분」 (`:446`).

### 3.10 상태 관리 지침

- 「모든 RAC 컴포넌트는 기본 uncontrolled. 다른 UI 와 동기화하려면 `value` + `onChange` 와 `useState`」 (`forms.mdx:96`).
- `selectedKeys` / `defaultSelectedKeys`, `items` / `defaultItems`, `inputValue` / `defaultInputValue` 모두 같은 controlled / uncontrolled 짝.
- 「`useListData` 는 immutable 목록의 state 를 관리하는 내장 훅」 (`collections.mdx:128`) · 「비동기는 어떤 fetch 라이브러리든 되고 `useAsyncList` 는 내장 선택지」 (`:281`).

## 4. 예제가 요구하는 빌더 원형 (RAC 어휘로)

예제 보고의 36 항목을 겹치는 것끼리 합쳐 원형 20 개로 줄였다. 「없음」 열은 7 예제 어디에도 없던 것.

| #   | 원형                                                                                              | RAC 어휘                                                                                                           | 예제 (file:line)                                                   |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 1   | 원본 collection (정적 · JSON · API)                                                               | `items` · `useListData.initialItems` · `useAsyncList.load`                                                         | 전부                                                               |
| 2   | 키 있는 변경 가능한 목록 (update · move · insert · remove)                                        | `useListData` 명령                                                                                                 | kanban L120; plants · ios 는 `useState` 배열                       |
| 3   | 조건: 필드 = 변수 (Key · boolean)                                                                 | `item.status === status` · `!favorite \|\| item.isFavorite`                                                        | kanban L140; photos App:18; plants App:44                          |
| 4   | 조건: 필드 ∈ 선택 (Selection; 빈 Set · `'all'` = 전체)                                            | `cycles === 'all' \|\| cycles.size === 0 \|\| cycles.has(item.cycle)`                                              | plants App:45-62                                                   |
| 5   | 조건: 글자 포함 (locale) — 필드 여러 개 OR                                                        | `useFilter.contains`                                                                                               | plants App:52-53 (이름 · 학명)                                     |
| 6   | 표시 층 검색 (렌더된 `textValue`)                                                                 | `Autocomplete filter={contains}`                                                                                   | emoji L39 · 64; photos PhotoGrid:70                                |
| 7   | 원본 수준 정적 선필터                                                                             | `array.filter` 모듈 수준                                                                                           | emoji L28                                                          |
| 8   | 정렬 = `SortDescriptor` 변수 + collator; Table 이 쓰고 다른 화면도 같은 순서                      | `sortDescriptor` · `onSortChange` · `useCollator`                                                                  | plants App:33 · 52-65; PlantTable:50-51                            |
| 9   | 열 보이기 = Selection 변수 (Menu multiple)                                                        | `visibleColumns` · `Row columns` · `dependencies`                                                                  | PlantTable:41 · 56                                                 |
| 10  | 묶기 = 묶음 값마다 보기 하나 (손으로 적은 값)                                                     | `filter(t => t.status === status)` ×N                                                                              | kanban L126-128 · 140                                              |
| 11  | 파생값: 거른 결과 개수 · 적용 조건 수 · 선택 수 → boolean                                         | `items.length` · `filters++` · `selectedKeys.size === 0`                                                           | kanban L208; plants App:67-80; ios L133-134                        |
| 12  | 선택을 변수로 공유 (toolbar + 목록 · Tree 선택 → 다른 목록의 조건)                                | controlled `selectedKeys` / `onSelectionChange`                                                                    | ios L119 · 152-153; photos Sidebar                                 |
| 13  | 선택 모드가 변수 (Edit / Cancel · 선택 비우기 동반)                                               | `selectionMode` prop controlled                                                                                    | ios L120 · 140-143                                                 |
| 14  | 행 안 컨트롤이 행 필드를 바꿈 (ToggleButton · Menu)                                               | `update(key, {...item, field})`                                                                                    | PlantTable:65-68; PlantActionMenu:32                               |
| 15  | Form → FormData → 레코드 모양 → upsert; 현재 항목으로 시드 (Add / Edit)                           | `action` · `Object.fromEntries` · `default*`                                                                       | PlantDialog:24-35 · 65-129                                         |
| 16  | 삭제 (행 동작 · 밀기 · 메뉴 + 확인) · 선택 일괄 삭제 (`'all'` 포함)                               | `remove` · `removeSelectedItems`                                                                                   | ios L121-125 · 160; plants App:283-290                             |
| 17  | 변수로 여는 대화상자 + 「현재 항목」 변수                                                         | `Modal isOpen`                                                                                                     | plants App:126-136 · 283-294                                       |
| 18  | drag & drop: 재정렬 · 다른 묶음으로 이동 (= 묶음 필드 update + 위치) · payload 타입 · 대상별 수락 | `onReorder` · `onInsert` · `onRootDrop` · `onItemDrop` · `getItems` · `acceptedDragTypes` · `shouldAcceptItemDrop` | kanban L142-202; photos PhotoGrid:41 · Sidebar:31-34               |
| 19  | 가상화 + 레이아웃 (Grid · Waterfall)                                                              | `Virtualizer` · `GridLayout` · `WaterfallLayout`                                                                   | emoji L41-48; photos PhotoGrid:97                                  |
| 20  | 빈 상태 · 선택 항목 상세 (master / detail) · 같은 데이터의 대체 렌더러 (Table ↔ GridList)         | `renderEmptyState` · 변수 · CSS                                                                                    | PlantTable:57; photos App:16 · 53-56; PlantTable:52 · PlantList:22 |
| —   | 섹션 (`ListBoxSection`) 으로 묶기 · 최근 항목 · 피부색 변형                                       | —                                                                                                                  | **7 예제에 없음**                                                  |
| —   | 파일 drop → 폼 필드 · 선택 ↔ 스크롤 · press 좌표 state                                            | `DropZone` · `TabListStateContext` · `PressEvent.x/y`                                                              | PlantDialog:38-63; swipeable-tabs; ripple                          |

### 4.1 컨트롤이 넘기는 값 → 조건의 비교 방식

예제의 컨트롤 (SearchField · Checkbox · TagGroup · Tree · Table · Slider) 을 RAC 가족 전체로 넓힌 표. 컨트롤은 `onChange` · `onSelectionChange` 의 값을 변수에 쓰고, 조건은 변수 값의 모양으로 비교 방식을 고른다. 「전체 (건너뜀)」 는 그 조건을 적용하지 않는 값.

| 컨트롤 (RAC callback 값)                                                                                                                                     | 값 모양                                      | 비교 방식                                                    | 전체 (건너뜀)                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------- |
| TextField · SearchField · ComboBox `onInputChange`                                                                                                           | string                                       | 포함 · 시작 · 끝 (`useFilter`, `sensitivity`) · 같음         | 빈 글자                                   |
| RadioGroup `onChange` · Select (single) · ComboBox `onChange` · Tree · ListBox · GridList · Table (single) `onSelectionChange` 의 첫 키 · Tabs `selectedKey` | Key                                          | 같음                                                         | 지정한 키 (`all` · `library`) 또는 `null` |
| Checkbox · Switch · ToggleButton `onChange`                                                                                                                  | boolean                                      | 같음 (true 일 때만 적용하는 경우가 흔함 — plants `favorite`) | false                                     |
| CheckboxGroup `onChange` · TagGroup · ToggleButtonGroup · Menu · Select (multiple) · Tree · ListBox · GridList · Table (multiple) `onSelectionChange`        | `Selection` (`'all' \| Set<Key>`) · string[] | 그 중 하나 (in)                                              | 빈 Set · `'all'`                          |
| NumberField · Slider `onChange`                                                                                                                              | number                                       | 같음 · 이상 · 이하                                           | `null` · 지정한 값                        |
| Slider (범위) · RangeCalendar · DateRangePicker `onChange`                                                                                                   | `[min, max]` · `{start, end}`                | 사이                                                         | `null`                                    |
| DatePicker · Calendar · DateField `onChange`                                                                                                                 | date                                         | 같음 · 이전 · 이후                                           | `null`                                    |
| Table `onSortChange`                                                                                                                                         | `SortDescriptor`                             | (정렬 — 조건 아님)                                           | `null`                                    |

같은 컨트롤이 필터가 아닐 수도 있다 (photos 의 Slider 는 타일 크기). 그래서 묶는 단위는 컨트롤이 아니라 변수다 (§6.1).

### 4.2 출발 사례 — GridList (Users) × RadioGroup (all · male · female)

사용자 질문의 사례를 예제 · 어휘 기준으로 다시 적으면:

- **RAC 로 짜면** (`useListData` 쪽):
  ```tsx
  let list = useListData({ initialItems: users, initialFilterText: "all",
    filter: (u, text) => text === "all" || u.gender === text });   // 값 고르기 = 같음 (contains 는 "female" ⊃ "male")
  <RadioGroup value={list.filterText} onChange={list.setFilterText}>…</RadioGroup>
  <ListBox items={list.items}>…</ListBox>
  ```
  `filterText` 는 글자 하나라 조건이 하나일 때만 맞는다. 조건이 여럿이면 예제처럼 변수 여러 개 + `filter` 함수 (§2.1).
- **지금 빌더에서**: Do 「setFilterText」 규칙 (Value = This event › `value`) 은 만들 수 있지만, 효과는 조회 endpoint 가 `{{ filterText }}` 를 읽는 API 데이터에만 난다 (`catalogPreviewSession.ts:1186` · `queryEndpoint` 는 mock 을 거부). Users 같은 로컬 테이블은 값만 저장되고 목록은 그대로다 — `DataBindingRef` 에 `useListData.filter` 에 해당하는 조건이 없기 때문 (§5).
- **예제 기준으로 맞는 모양**: RadioGroup `onChange` → Set state `GENDER` (이미 있는 규칙) · 보기 조건 「`gender` = `!var.GENDER`, `all` 이면 건너뜀」 · GridList 가 그 보기를 바인딩. 로컬이면 Preview 가 거르고, API 면 endpoint 가 `{{ GENDER }}` 를 읽어 서버가 거른다 (변수 변경 때 다시 부르는 경로는 아직 없다 — §5).

## 5. 빌더 현황 대조 (2026-10-26, 커밋 `729c44749`)

| RAC 데이터 층                                                                            | 빌더                                                                                       | 근거                                                                                           |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| collection 바인딩 (행마다 템플릿 반복)                                                   | 있음 — RAC 동적 `items` 가 아니라 템플릿을 행 수만큼 반복 · 행 상한 100                    | `types.ts:533-542` · `domRegistry.runtime.ts:127` · `collections/resolveCollectionItems.ts:36` |
| `getItem(key)` 한 항목                                                                   | 있음 (UI 는 Form 에만)                                                                     | `CollectionBinding.tsx:202-205`                                                                |
| mock / API 출처 · endpoint · `responseMapping` (`cursorPath` · `selectedKeysPath`)       | 있음                                                                                       | `apps/builder/src/types/builder/data.types.ts`                                                 |
| `useListData` append · update · remove · insert* · prepend · move* · removeSelectedItems | 있음 (세션 메모리, 문서 무변경)                                                            | `types.ts:948-1031` · `dispatcher.ts:206-360`                                                  |
| `useTreeData` (children · parentId · parentKey)                                          | 있음                                                                                       | `dataBinding.ts:178-226` · `resolver.ts:276`                                                   |
| `useAsyncList` reload · loadMore · cursor · `loadingState` 스피너 · `*LoadMoreItem`      | 있음 (API 전용 — mock 은 `queryEndpoint` 거부)                                             | `catalogPreviewSession.ts:1121 · 1166 · 1197` · `delegatedDom.runtime.ts:346 · 371`            |
| 서버 필터 `{{ filterText }}` (`setFilterText` 규칙 · ComboBox `inputValue`)              | 있음                                                                                       | `catalogPreviewSession.ts:1186 · 1216` · `domBinding.runtime.ts:889-916`                       |
| 클라이언트 글자 필터 (`Autocomplete` + `useFilter.contains`)                             | 있음 — ComboBox · Select 안에서만, `contains` 고정                                         | `domBinding.components.tsx:188-201`                                                            |
| **mock · 로컬 목록을 다른 컨트롤 · 변수로 거르기**                                       | **없음**                                                                                   | `DataBindingRef` 에 조건 필드 없음                                                             |
| Table 정렬 (클라이언트 `Intl.Collator` · 서버 `{{ sortDescriptor }}`)                    | 있음 — Table 소유, Preview 런타임 상태                                                     | `tableSort.ts` · `domBinding.runtime.ts:2392-2406` · `catalogPreviewSession.ts:1361 · 1408`    |
| **정렬 결과를 다른 화면이 공유 · Table 밖 정렬**                                         | **없음**                                                                                   | `concepts/sort.ts` (Table 만)                                                                  |
| **필터 · 정렬 설정 UI**                                                                  | **없음** (Column `allowsSorting` 만)                                                       | `Column.binding.ts:96`                                                                         |
| controlled 선택 (`selectedKeys` · `selectedKey` · `expandedKeys` · `inputValue`)         | 있음 — Preview 런타임 상태                                                                 | `runtimeStateProps.ts:67-130`                                                                  |
| 선택을 변수에 담기                                                                       | 부분 — `source` 미러 또는 Set state `!event.keys` · `!item`                                | `types.ts:926` · `valueRef.ts`                                                                 |
| 섹션                                                                                     | 있음 — 저작 노드 한 단계 (`ListBoxSection` · `GridListSection` · `MenuSection`)            | `ListBoxSection.binding.ts`                                                                    |
| **필드로 묶기**                                                                          | **없음**                                                                                   | —                                                                                              |
| **collection drag & drop (`useDragAndDrop`)**                                            | **없음** — DropZone `onDrop*` 만 (인자 없음); 빌더 자체 Layers 트리에만 `dragAndDropHooks` | `componentInteractionSpecs.ts:150` · `panels/navigator/tree/TreeBase`                          |
| 빈 상태 `renderEmptyState`                                                               | 부분 — ListBox · GridList · Tree · TagList · Menu; TableBody · CardView 미완               | `delegatedDom.runtime.ts:346`                                                                  |
| Virtualizer · ListLayout · GridLayout                                                    | 없음 (ADR-257 Phase 5 「쓰지 않는다」) — waterfall 은 CSS masonry                          | `waterfall.ts` · `compositionRoot.ts:1186`                                                     |
| Form `onSubmit` → `formData` → endpoint / append · `onInvalid`                           | 있음 (검증 결과 전달은 이벤트만)                                                           | `concepts/form.ts` · `types.ts:943-955`                                                        |
| 값 참조 `!event` · `!item` · `!var` + 「값 고르기」                                      | 있음 (2026-10-26)                                                                          | `valueRef.ts` · `ValueField.tsx`                                                               |
| **파생값 (개수 · 조건 수 · 선택 수 · 식)**                                               | **없음** — `{{ }}` 는 경로 접근만                                                          | `state/template.ts:2-22`                                                                       |
| **조건부 · 다단계 규칙**                                                                 | **없음** (ADR-158 「한 줄」)                                                               | `interactionRule.types.ts:9-11`                                                                |
| **변수 변경 때 템플릿 endpoint 다시 부르기**                                             | **없음** — 라우트 · 데이터 변경 때만 `loadRouted`                                          | `catalogPreviewSession.ts:558 · 604` (`writeState` 652-664 는 호출 안 함)                      |
| S2 `renderActionBar` (선택 → 일괄 동작 막대)                                             | 없음                                                                                       | catalog · runtime 0 건                                                                         |

When 개념 (현재): action · multiSelection (`keys`) · singleSelection (`value` / `keys`) · sort (`descriptor`) · expansion · inputValue · value · valueCommit · form (`formData`) · search · remove (TagGroup `keys`) · fileSelect · dragDrop (DropZone, 인자 없음) · open · toggle · focusedDate · press · hover · focus · keyboard · inherited. Do: `selectItem` · `deselectItem` · `clearSelection` · `sort` · `expand*` · `collapse*` · `setInput` · `setValue` · `check*` · `open` · `close` · `toggleOpen` · `focusDate` · `submit` · `reset` · `show` · `hide` · `toggle` + list 명령 · `setState` · `navigate` · `callEndpoint` · `toast`.

## 6. 설계 함의 (구현 제안이 아니라 예제 · 어휘에서 따라 나오는 제약)

1. **변수가 중심이다.** 다섯 예제 모두 「컨트롤 → state 변수 → 파생 `items`」 다. 컨트롤은 변수를 쓰고 (이미 있는 `onChange` → Set state · Value = This event › value), 조건은 변수를 읽는다. 같은 컨트롤이 필터일 수도 (plants 의 Slider 없음 · photos 의 Slider 는 타일 크기) 아닐 수도 있으므로 「컨트롤 = 필터」 로 묶으면 틀린다.
2. **보기 (원본 + 조건 목록 + 정렬) 는 바인딩 하나의 속성이 아니다.** plants 는 Table 과 GridList 가 같은 결과를 받고, kanban 은 보기 3 개가 같은 원본을 본다. 그래서 「조건 · 정렬」 은 이름 있는 단위로 두고 바인딩이 그것을 가리켜야 한다. 반대로 photos 처럼 보기 하나에 컴포넌트 하나인 경우가 기본이므로, 보기 단위는 있어야 하되 사용자가 매번 만들게 해서는 안 된다.
3. **조건 = 필드(들) + 비교 방식 + 값 참조 + 건너뛰는 값.** 값 참조는 방금 만든 `!var` · `!event` 와 「값 고르기」 를 그대로 쓴다. 비교 방식은 값 모양이 정한다 — string: 포함 · 시작 · 끝 (`useFilter` · `sensitivity`) · 같음 / Key · boolean: 같음 / Key[] · Selection: 그 중 하나 (`'all'` 처리) / number: 이상 · 이하 · 같음 / 범위: 사이 / 날짜: 이전 · 이후 · 같음. 건너뛰는 값은 조건마다 다르다 (빈 글자 · false · 빈 Set · `'library'`).
4. **조건은 AND 가 기본이고 한 조건 안에서 필드 여러 개가 OR 다** (plants 의 이름 · 학명). 조건 묶음 사이 OR 은 7 예제에 없다 — 다만 예제는 데모의 범위이지 요구의 상한이 아니다 (§8.3.1).
5. **필터는 두 층을 다 제공해야 한다.** 데이터 층은 로컬이면 Preview 가 거르고 API 면 `load({filterText})` 또는 endpoint 의 `{{ 변수 }}` 로 서버가 거른다 (후자는 변수 변경 때 다시 부르는 경로가 없다 — §5). 표시 층은 RAC `Autocomplete` 를 ListBox · GridList · Table · Menu · TagGroup 에 감싸는 것으로, 이미 ComboBox · Select 에 있는 경로를 넓히는 일이다 (D1 — 빌더가 거르지 않는다).
6. **정렬은 `SortDescriptor` 변수다.** Table 의 `onSortChange` 가 변수를 쓰고 보기가 그 변수로 정렬하면 GridList 도 같은 순서를 받는다. 지금은 Table 이 자기 런타임 상태로 정렬한다 (ADR-257) — 소유 경계가 바뀐다.
7. **묶기는 묶음 값마다 보기 하나 + 「묶음 필드 = 이 값」 조건**으로 환원된다 (kanban). 섹션으로 묶기는 RAC 가 미리 중첩된 데이터만 받으므로 별도 주제다. 열 이동 = `update(key, {field: 값})` 는 이미 있는 명령이다.
8. **drag & drop 은 이벤트 → 이미 있는 list 명령**이다. 빌더에 없는 것은 `useDragAndDrop` 배선 (`getItems` 직렬화 · `acceptedDragTypes` · `shouldAcceptItemDrop` · `renderDropIndicator`) 과 When `onReorder` · `onInsert` · `onRootDrop` · `onItemDrop` · `onDragEnd` 의 인자 (`keys` · `items` · `target.key` · `target.dropPosition` · `dropOperation` · `isInternal`) 노출이다. 한 drop 이 명령 둘 (`update` + `moveBefore`) 을 필요로 하므로 **「한 규칙 = 한 Do」 (ADR-158) 와 충돌**한다.
9. **파생값**이 없으면 예제의 배지 · 열 개수 · Delete 비활성 · 「적용 조건 수」 를 만들 수 없다. RAC 어휘로 닫힌 최소 집합은 `items.length` (보기 결과 수) · `selectedKeys.size` / `'all'` (선택 수) · 적용 조건 수 세 가지다. 일반 식 (formula) 은 예제에 없다.
10. **선택 모드 · 보이는 열도 변수**다 (ios · plants). Do 「capability 값 = 변수」 는 이미 있으므로, `selectionMode` 와 `columns` 가 capability 로 노출돼 있는지만 확인할 일이다.
11. **Form upsert** 는 `append` + `update` 에 「`key` 없으면 `id` 로 갱신, 없으면 추가」 가 더 있어야 하고, 폼 필드를 현재 항목으로 시드하는 길 (`getItem(key)` 바인딩 → `defaultValue`) 은 이미 있는 Form `key` 바인딩으로 된다.
12. **S2 `renderActionBar`** 는 D2 표면이다 — 선택이 있을 때 보이는 일괄 동작 막대. 「선택 수 > 0 → show」 를 파생값 + capability 로 만들 수도 있고, S2 prop 그대로 노출할 수도 있다.

## 7. 사용자 결정이 필요한 것 (4 개 결정 지점 중 (3) SSOT 경계 · (4) scope)

1. **문서 구조** — 「보기 (원본 · 조건 · 정렬)」 를 새 entry 로 둘지, `DataBindingRef` 에 `filter` · `sort` 필드로 둘지. 예제 (plants · kanban) 는 공유가 필요해 entry 쪽이지만, 기본 사례 (보기 1 : 컴포넌트 1) 의 UI 부담이 있다. contract 가 오른다.
2. **Table 정렬 소유 이동** — ADR-257 의 「정렬은 Table 의 Preview 런타임 상태」 를 「정렬은 변수 → 보기」 로 바꾸는 것. SSOT 경계 (3).
3. **파생값 범위** — 결과 수 · 선택 수 · 적용 조건 수 + 묶음별 집계 (§8.3.2-2 — 결과 수는 묶음 없는 count) vs 일반 식. 「새 어휘 금지」 는 데이터 조회에 닿지 않으므로 (§8.3.1) 판단 기준은 예제 · 데이터 도구가 쓰는 범위다.
4. **표시 층 Autocomplete** 를 ListBox · GridList · Table · Menu · TagGroup 에 감싸는 경로 — D1 그대로지만 저작 구조 (어느 노드가 Autocomplete 를 소유하는가) 가 ADR-256 부품 구조에 닿는다.
5. **「한 규칙 = 한 Do」 (ADR-158) 재개** — drag & drop 의 `onInsert` 가 `update` + `move` 둘을 요구한다. 조건부 실행은 여전히 예제에 없으므로 다중 Do 만 열지, 둘 다 열지. scope (4).
6. (부수) collection drag & drop 전체 · Virtualizer 도입 여부 (ADR-257 「쓰지 않는다」 재확인) · S2 `renderActionBar` 노출 · TableBody · CardView 빈 상태 — 각각 별도 ADR 후보.
7. **로컬 데이터 조회 범위** (§8.3 · §8.4) — OR 묶음 · 집계 · 조인은 설계에 넣는다 (사용자 지시 2026-10-26 — 범위 밖 근거 재검토 §8.3.1). 남는 결정은 로컬 (mock) 데이터에서 Preview 가 셋을 다 계산할지, API 전용으로 둘지. 권고는 로컬도 전부 — mock 이 저작 단계의 데이터라, 로컬이 못 하면 저작 중에 결과를 볼 수 없고 API 로 바꿨을 때 결과가 같은지 확인할 길이 없다. scope (4).

## 8. 보완점 — 「다양한 조회 · 필터 조건을 쉽게」 기준 (2026-10-26 후속)

> 사용자 질문 「이 분석대로 설계하면 다양한 data 의 조회 조건과 필터 조건을 빌더에서 쉽게 만들어 낼 수 있나」 에 대한 판정. §6 의 모델 (조건 = 필드 + 비교 방식 + 값 참조 + 건너뛰는 값) 은 유지하고, 그 위에 빠진 것만 적는다 (조건끼리 AND 는 OR 묶음의 루트 기본값으로 바뀐다 — §8.3.2-1). 구현 제안이 아니라 설계 요구다.

### 8.1 판정

- **된다** — 예제 수준의 필터 바: 검색어 (포함) · Radio · Select (같음) · Checkbox (true 일 때만) · TagGroup · CheckboxGroup (그 중 하나) · Slider · NumberField (이상 · 이하) · 날짜 범위 (사이) · Table 정렬, 조건끼리 AND. plants · photos · kanban 은 §6 모델로 다 표현된다.
- **쉽지 않다** — 저작 단계 수와 API 데이터 경로 (§8.2-1 · 2).
- **다양하지 않다** — 비교 방식 표 (§4.1) 에 없는 비교와 OR 묶음 · 집계 · 조인 (§8.3).

### 8.2 쉬움을 막는 것

1. **필터 하나에 저작 4 단계.** RadioGroup 으로 Users 를 거르려면 ① 상태 변수 만들기 → ② `onChange` → Set state 규칙 → ③ 보기에 조건 추가 → ④ 바인딩을 보기에 연결. §6.2 는 보기에 대해서만 「사용자가 매번 만들게 해서는 안 된다」 고 했고 변수 · 규칙은 말하지 않는다.
   - 요구: **저장 모델은 변수 중심 (§6.1) 그대로, 저작 UI 에 「이 컨트롤로 목록 거르기」 한 동작**을 둔다 — 컨트롤과 대상 목록 · 필드를 고르면 변수 · Set state 규칙 · 조건이 한꺼번에 생긴다. 「컨트롤 = 필터」 가 틀린 것은 저장 모델의 문제이고 (photos Slider), 생성 단축과는 충돌하지 않는다. 만든 뒤에는 변수 · 규칙 · 조건이 각자 보이고 고칠 수 있어야 한다 (새 어휘 없이 기존 세 단위로 풀린다).
   - 요구: 바인딩마다 **이름 없는 기본 보기**를 자동으로 두고, 공유가 필요할 때만 이름을 붙여 다른 바인딩이 가리킨다 — §7-1 「entry vs 바인딩 필드」 의 양쪽 요구 (plants 공유 · 보기 1 : 컴포넌트 1 기본) 를 함께 만족하는 형태.
2. **API 데이터는 조건을 두 번 정의한다.** 로컬은 Preview 가 조건으로 거르지만, API 는 endpoint `path` · `ApiParam.value` · `bodyTemplate` 에 `{{ 변수 }}` 를 손으로 적어야 한다 (`apps/builder/src/types/builder/data.types.ts:143-148 · 233 · 243`). 조건 UI 와 서버 쿼리가 따로 놀아, 조건을 하나 더하면 endpoint 도 고쳐야 한다.
   - 요구: **보기의 조건 목록 → 요청 직렬화 규칙** 하나 (예: `gender = !var.GENDER` → `gender=female`, 「이상」 → `age_gte=20`, 건너뛰는 값이면 param 생략). 직렬화 형식은 endpoint 단위로 고른다 (query param 이름 규칙 · body JSON). 그러면 같은 조건 정의로 로컬 (Preview 가 거름) 과 API (서버가 거름) 를 다 처리한다 — RAC `useAsyncList load({filterText, sortDescriptor})` 가 상태를 넘기고 서버가 해석하는 모양과 같다.
   - 요구: **변수 변경 → 보기를 읽는 endpoint 다시 부르기** (§5 마지막에서 두 번째 줄 — `writeState` 가 `loadRouted` 를 부르지 않는다). 글자 입력은 debounce 가 필요하고, 앞선 요청은 `signal` 로 취소한다 (`useAsyncList` 와 같은 계약).
3. **비교 방식을 값 모양만으로 고른다.** §6.3 은 「비교 방식은 값 모양이 정한다」 고 했지만, 필드에도 타입이 있다 (`DataFieldType` = string · number · boolean · date · datetime · email · url · image · array · object, `data.types.ts:26-36`). 「필드 타입 × 값 모양」 으로 고를 수 있는 비교 방식을 좁히면 고르기 목록이 짧아지고 틀린 조합 (number 필드 × 포함) 이 처음부터 안 보인다.

### 8.3 다양함 — 비교 방식 표 밖

| 항목                | 예                                                  | §6 모델로                                              | 보완                                                  |
| ------------------- | --------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| 아님                | `status ≠ closed` · `cycle ∉ {annual}`              | 안 됨                                                  | §4.1 비교 방식에 「아님」 짝 추가                     |
| 빈 값               | 「이메일 없음」 · 「사진 있음」                     | 안 됨                                                  | 값 참조 없는 비교 (있음 · 없음)                       |
| 배열 필드 포함      | `tags` 에 `x` 포함 · `tags` ∩ 선택 ≠ ∅              | 안 됨 — §4.1 의 「그 중 하나」 는 필드가 스칼라일 때만 | 필드 타입 `array` 일 때의 비교                        |
| 상대 날짜           | 「최근 7 일」 · 「이번 달」                         | 안 됨 — 날짜 값 참조는 고정 값만                       | 날짜 비교의 값 참조 하나 (오늘 기준 오프셋)           |
| 조건 OR 묶음 · 중첩 | `A AND (B OR C)`                                    | 안 됨 — 조건 목록은 AND 하나                           | 조건 목록 → 조건 묶음 트리                            |
| 집계                | 상태별 개수 · 합계 · 평균                           | 안 됨 — 결과는 원본 행만                               | 묶기 필드 + 집계 함수 → 결과 행 모양이 바뀐다         |
| 테이블 관계 (조인)  | 주문 목록에 사용자 이름 · 사용자 필드로 주문 거르기 | 안 됨 — `DataField` 에 참조 타입 없음                  | 스키마 참조 타입 + 조건 · 바인딩 · 직렬화의 필드 경로 |

- 위 네 줄은 §4.1 표에 행을 더하는 일이라 모델이 바뀌지 않는다.
- 아래 세 줄은 모델이 바뀐다. 그래도 범위 밖으로 둘 근거는 없다 (§8.3.1) — 설계에 넣고 phase 로 나눈다 (§8.4).
- API 데이터에서는 서버가 OR · 집계 · 조인을 하고 빌더는 조건 · 묶기 · 경로를 요청으로 직렬화만 한다 (§8.2-2). 로컬 (mock) 데이터에서는 Preview 가 직접 계산해야 한다 — 그 범위가 §7-7 결정이다.

#### 8.3.1 범위 밖 근거 재검토 (사용자 질문 2026-10-26 「OR 묶음 · 조인 · 집계는 범위 밖으로 해야 하는 이유가 뭐지」)

이 절의 첫 판 (커밋 `57a13a734`) 은 아래 세 줄을 「§7-7 범위 결정」 으로 미뤘고, 근거로 셋을 들었다. 셋 다 성립하지 않는다.

1. **「7 예제에 없다」** — RAC 는 거르기 · 정렬 · 묶기를 하지 않고 앱 코드에 맡긴다 (§0-1). §6 의 AND 조건 목록부터가 RAC 어휘가 아니라 예제 앱의 `array.filter` 다. 예제에 OR 이 없는 것은 Adobe 데모가 보여 준 범위일 뿐, 빌더 사용자에게 필요 없다는 증거가 아니다.
2. **「새 어휘 금지」** — 이 원칙 (메모리 `project-interactions-expose-rac-surface-not-new-vocabulary`) 은 Interactions 가 **RAC 표면이 있는 곳**에서 그 표면을 그대로 전달하라는 것이다. 데이터 조회에는 RAC 표면이 없으므로 닿지 않는다. 이 축의 참조는 데이터 도구 (Airtable · Notion 의 filter group · linked record + lookup · group by, SQL `WHERE` · `JOIN` · `GROUP BY`) 다.
3. **「파생값 3 종 한정 (§7-3) 과 부딪힌다」** — §7-3 은 이 문서가 적은 선택지이지 사용자 결정이 아니다. 그것을 다시 근거로 든 것은 순환이다.

반대 증거:

- 빌더에 집계 어휘가 이미 있다 — Chart `budgetAggregate` 의 sum · mean · max · min (`packages/shared/src/catalog/bindings/Chart.binding.ts:189-198`). 다만 이것은 넘치는 범주를 묶는 **표시 예산** 이고 group by 조회가 아니다 — 함수 이름은 같이 쓰되 계산 단계는 다르다.
- kanban 열 머리의 `{items.length}` (§2.4) 는 묶음별 count 이고, §6.9 의 「결과 수」 는 묶음 없는 count 다 — 집계가 없으면 파생값도 특수 경우만 남는다.

남는 실제 차이는 구현 비용과 데이터 출처 (로컬 · API) 뿐이다. 비용은 범위가 아니라 phase 의 문제다 (메모리 `feedback-design-whole-scope-upfront-no-deferral` — 「필요해지면 이 아니라 처음부터 모든 설계」).

#### 8.3.2 세 항목의 설계 요구

1. **조건 OR 묶음**
   - 보기의 조건 = **묶음 트리** — 묶음은 `AND` · `OR` 중 하나와 자식 (조건 또는 묶음) 목록. 루트 묶음 하나 (기본 `AND`) 가 지금의 조건 목록과 같다.
   - 깊이: 데이터 도구 관행 (Notion · Airtable) 은 2 단계 안팎이다 — UI 는 깊이를 제한해도 저장 형식은 트리로 둔다.
   - 건너뛰는 값: 자식이 전부 건너뛰면 묶음도 건너뛴다 (묶음이 빈 `OR` 로 남아 0 행이 되지 않게).
   - 직렬화: endpoint 직렬화 형식마다 표현할 수 있는 범위가 다르다 (평면 query param 은 `OR` 를 못 담는다) — 형식이 못 담는 트리는 저작 때 그 자리에서 알린다.
2. **집계**
   - 보기의 선택 단계 = **묶기 필드 (0 개 이상) + 집계 목록** (`count` · `sum` · `mean` · `min` · `max`, 필드 지정 — 이름은 Chart `budgetAggregate` 와 맞춘다). 결과 행 = `{묶음 키…, 집계 값…}`. 묶기 필드 0 개 + `count` = 결과 수 (§6.9).
   - 순서: 조건 → 묶기 · 집계 → 정렬 (정렬은 집계 값으로도 할 수 있다). 묶기 결과는 묶음 목록이라 kanban 의 「묶음 값마다 보기 하나」 (§6.7) 를 손으로 적지 않고 데이터에서 유도할 수 있다.
   - 바인딩: 결과 행 모양이 원본 schema 와 다르므로, 보기가 결과 schema (묶음 키 · 집계 이름과 타입) 를 내고 `fieldMap` 은 그것을 가리킨다. Chart 가 같은 보기를 읽으면 표시 예산 집계와 겹치지 않게 순서를 정한다 (보기 집계 뒤 표시 예산).
3. **테이블 관계 (조인)**
   - `DataField` 에 **참조 타입** — 대상 collection + 대상 키 필드. 값은 대상 행의 키 (하나 또는 배열).
   - 필드 경로: 조건 (`author.name 포함 …`) · 바인딩 `fieldMap` (`{author.name}`) · 정렬 · 묶기가 참조를 건너 대상 필드를 읽는다. 저장은 필드 id 경로 (`DataField.id` — ADR-152 안정 참조) 로, 이름 변경에 끊기지 않게.
   - 로컬: Preview 가 대상 collection 에서 키로 찾는다 (지워진 대상은 빈 값 — 「빈 값」 비교로 거를 수 있다). API: 직렬화가 경로를 endpoint 의 확장 param (`expand=author` 같은 형식) 으로 넘기거나, 대상 endpoint 를 키 목록으로 따로 부른다 — 형식은 endpoint 단위.
   - 역방향 (사용자 → 그 사용자의 주문 수) 은 참조 + 집계의 조합이다 — 대상 쪽에서 「나를 가리키는 행」 을 묶어 센다.

### 8.4 설계 확정 때 함께 넣을 것 — phase

저장 형식은 **첫 phase 에서 조건 트리 · 묶기 · 집계 · 필드 경로의 자리를 모두 연다.** 개발 단계에 문서 마이그레이션 코드를 두지 않으므로 (메모리 `feedback-no-document-migration-code-dev-stage`), 뒤 phase 가 저장 형식을 바꾸지 않게 하는 것이 phase 분할의 조건이다.

| phase | 내용                                                                                                                                                                                               | 근거 절                      |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 1     | 보기 저장 형식 (조건 트리 · 묶기 · 집계 · 필드 경로 자리) · 「이 컨트롤로 목록 거르기」 생성 단축 · 바인딩별 기본 보기 · 필드 타입 기준 비교 방식 · 아님 · 빈 값 · 배열 포함 · 상대 날짜 · OR 묶음 | §8.2-1 · 3 · §8.3 · §8.3.2-1 |
| 2     | 조건 · 정렬 → 요청 직렬화 (형식별 표현 범위 알림) · 변수 변경 때 다시 부르기                                                                                                                       | §8.2-2                       |
| 3     | 묶기 · 집계 (로컬 계산 + 직렬화) · 결과 schema · 묶음에서 유도한 보기 목록                                                                                                                         | §8.3.2-2                     |
| 4     | 참조 타입 · 필드 경로 · 역방향 집계                                                                                                                                                                | §8.3.2-3                     |

이 넷이 있으면 일반적인 목록 · 검색 화면 (필터 바 + 정렬 + 결과 수) 부터 대시보드 (상태별 개수 · 합계) · 관계 데이터 (주문 ↔ 사용자) 까지 「쉽게 · 다양하게」 기준을 만족한다. 로컬 (mock) 에서 phase 3 · 4 를 Preview 가 다 계산할지는 §7-7 결정이다.

**실행 결과 (ADR-284, 2026-10-27 Phase 7 기준)** — 위 네 phase 는 ADR-284 의 Phase 1 ~ 4 로 실행됐고, dnd · code view · 확인이 뒤에 붙었다. 저장 형식은 Phase 1 에서 열었으나 수용 집합 대조 (Phase 6a) 에서 선택 필드 넷을 더했다 (부정 글자 비교 · prop 값 조건 · 상태 prop 이 변수를 읽는 형식 · 글자 변수 전환 값 — contract 50 그대로, 변환 0). 결정 3 의 「적용 조건 수」 는 Phase 7 에서 집계 `applied` 로 넣었다.

| 연구 phase | ADR-284 Phase | 실제로 들어간 것                                                                                                             |
| ---------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1          | 1 · 3         | 보기 저장 형식 · 로컬 계산기 · 「검색 추가」 (목록 · 컨트롤 양쪽 진입) · 공유 보기 · 정렬 따라가기 · 연결 상세 (행마다 판정) |
| 2          | 2             | 요청 직렬화 (접미 · body · 없음) · 변수 쓰기 → 다시 부르기 · 전체 수 경로                                                    |
| 3          | 4a · 4b · 4d  | 묶기 · 집계 · 「결과 수 표시」 · 「묶기로 목록 · 열 만들기」 · 「모든 값」                                                   |
| 4          | 4c            | 참조 필드 · 경로 · 역방향 count                                                                                              |
| —          | 5             | 목록 끌어 놓기 · kanban drop 규칙 · 다중 Do                                                                                  |
| —          | 6             | code view 생성기 · 수용 판정 (예제 5) · 1:1 자리 역매핑                                                                      |
| —          | 7             | 「적용 조건 수 표시」 · 이미 공유된 보기에 목록 합류 · 파생 보기 정리 · live (plants · kanban · API 전환 · 인계)             |

### 8.5 같은 결과를 코드로도 — code view 는 레퍼런스 예제의 모양 그대로 (사용자 2026-10-26)

사용자 원문: 「이렇게 해서 나오는 것이 code edit 형태로도 제공하는 것은 어떨까.」 → 「레퍼런스에 스크립트처럼 그것들을 쉽게 사용하게 하려고 하는 것이었고, 반대로 code view 로 했을 때 그 형태가 그대로 나와야겠지.」

빌더의 UI 는 §2 예제들이 코드로 하는 일 (`useListData` · `filter` · `useFilter` · `useCollator` · `sortDescriptor` · `useDragAndDrop`) 을 쉽게 만드는 것이고, **code view 는 그 반대 방향 — 문서를 레퍼런스 예제와 같은 모양의 RAC 코드로 보여 주는 것**이다. 전용 DSL 이 아니라 React Aria 코드 그 자체여야 한다 — 그래야 「빌더 = RAC 수준 조립」 (사용자 원칙 10-07) 이 눈으로 확인되고, 개발자가 넘겨받을 때 배울 것이 없다.

**모양 — 과제 ① · ② · ⑩ 을 만든 문서의 code view (plants/App.tsx 와 같은 어법)**

```tsx
let [search, setSearch] = useState('');                      // SearchField → $search
let [gender, setGender] = useState('all');                   // RadioGroup  → $gender
let [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({column: 'name', direction: 'ascending'});
let {contains} = useFilter({sensitivity: 'base'});
let collator = useCollator();
let users = Users
  .filter(u => contains(u.name, search) && (gender === 'all' || u.gender === gender))
  .toSorted((a, b) => collator.compare(a[sortDescriptor.column], b[sortDescriptor.column]) * dir);

<SearchField value={search} onChange={setSearch} />
<RadioGroup value={gender} onChange={setGender}>…</RadioGroup>
<Table sortDescriptor={sortDescriptor} onSortChange={setSortDescriptor}>…<TableBody items={users}>…</TableBody></Table>
<GridList items={users}>{u => <GridListItem textValue={u.name}>…</GridListItem>}</GridList>
```

문서의 단위와 코드의 단위가 1:1 이다 — 변수 = `useState` · 규칙 (`onChange → Set state`) = `onChange={setX}` · 보기 조건 = `filter(…)` 의 한 항 · 정렬 = `toSorted(collator…)` · 집계 = `reduce` / `Map` · 참조 = `find` · drag & drop = `useDragAndDrop({…})` · API = `useAsyncList({load({filterText, sortDescriptor})})`. §3 의 어휘표가 곧 생성 코드의 어휘표다.

**이것이 주는 것**

1. **레퍼런스와의 정합을 검사할 수 있다** — 공식 예제 7 종을 빌더로 다시 만들었을 때 code view 가 그 예제의 `App.tsx` 와 같은 구조 (hook · filter 항 · prop 배선) 로 나오는지가 **수용 기준**이 된다. §4 원형 20 이 전부 코드로 환원되는지도 여기서 드러난다.
2. **개발자 인계** — 프리랜서 · 다음 담당자가 문서 대신 익숙한 RAC 코드를 읽는다. 검토 · diff 도 이 코드로.
3. **Publish 의 또 다른 형태** — 지금 Publish 는 문서를 해석하는 런타임 (DOM runtime) 이다. 생성 코드가 레퍼런스 모양이면 「코드로 내보내기」 가 같은 투영의 출력이 된다 (정책은 메모리 `project-publish-link-only-defer-until-builder-stable` — 별도 결정).
4. **AI 의 출력 · 입력 형식** — AI 가 RAC 코드 (학습 데이터에 가장 많은 형태) 를 내고, 빌더가 그중 문서로 환원되는 부분만 받는다.

**편집 (code edit) 의 범위 — 어디까지 거꾸로 가나**

> **2026-10-27 갱신 ([ADR-285](../../adr/285-code-view-closed-vocabulary-round-trip.md))**: 편집 범위는 아래 첫 줄의 「1:1 자리」 에서 **닫힌 어휘 전체** 로 넓어졌다 — 요소 추가 · 삭제 · 이동 · 글자 · prop · 변수 · 규칙 Do (목록 명령 포함) · 보기 (조건 · 「또는」 · 정렬 · 묶기 · 집계) · 요청 매개변수 · drag & drop 을 코드에서 고치면 문서의 같은 명령으로 반영된다 (한 step). 판정은 「재생성 대조」 — 계획한 명령을 적용한 문서의 코드가 편집한 줄을 그대로 돌려줘야 적용, 아니면 그 줄을 이유 · 대안과 함께 거절 (부분 적용 없음). 「자리 밖의 코드는 받지 않는다」 는 「어휘 밖의 코드는 받지 않는다」 로 그대로 유지된다 — 자유 코드 escape 는 여전히 없다.

- **1:1 자리는 양방향** — 조건의 비교 · 값 · 필드, 변수 이름 · 초기값, 정렬 열, `useDragAndDrop` 의 어느 핸들러 — 코드의 그 자리를 고치면 문서의 그 자리가 바뀐다 (projection 편집 — 코드를 파싱하는 것이 아니라 생성한 코드의 자리에 편집을 매핑). 적용은 기존 명령 (`workspace.execute`) 으로, undo · 저장 · Preview 그대로.
- **자리 밖의 코드는 받지 않는다** — `filter` 안에 임의 함수 호출 · 새 hook · 조건 밖 JS 를 적으면 「문서로 환원되지 않는 코드」 로 그 줄에 표시하고 적용하지 않는다. 받으면 §9.2 의 A 경로 (사람마다 다른 결과 · 코드 층 조용한 실패) 가 돌아오고 Publish 에 사용자 코드가 들어간다. **code view 는 문서를 읽고 고치는 창이고, 문서를 벗어나는 길이 아니다.**
- 그래서 「숙련자 전용 자유 코드」 는 여전히 배제다 (§7-3 의 일반 식 배제와 같은 결정). 숙련자는 code view 에서 1:1 자리를 빠르게 고치는 것으로 충분하고, 그 이상이 필요하면 그것은 빌더에 없는 기능이므로 §9.6 대로 **빌더가 채워야 할 결함**이다.

**요구 (설계에 넣을 것)**

- 문서 스키마 → RAC 코드 생성기 하나 (어휘 = §3 · 부록 A). 두 번째 모델이 아니다.
- 생성 코드는 공식 예제의 어법을 따른다 — `useListData` / `useAsyncList` 선택 기준 (로컬 · API), `useFilter({sensitivity:'base'})`, `useCollator`, controlled prop 배선, `Collection` · `Section` 중첩, `useDragAndDrop` 핸들러 → list 명령.
- 1:1 자리 목록과 그 역매핑 (코드 자리 → 문서 필드) 을 스키마에 같이 선언한다. 자리 밖 편집의 표시 문구.
- **수용 기준**: §2 의 예제 7 종을 빌더로 재현 → code view 가 예제 `App.tsx` 와 구조 동치 (hook · filter 항 · 배선; 스타일 · 마크업 세부는 제외).
- phase: 저장 형식 (phase 1) 과 조건 · 정렬 · 집계 · 참조의 실행 (phase 2 ~ 4) 뒤에 생성기 — 그 전에는 환원할 것이 없다. 다만 **수용 기준 (예제 7 종 재현) 은 phase 1 설계 때부터 고정**해 저장 형식이 코드로 환원되지 않는 모양을 갖지 않게 한다.

## 9. 쉬움 평가 — 과제 × 방식 cognitive walkthrough (2026-10-26 후속)

> 사용자 제안 「스크립트 방식 · 지금 빌더 · 리서치 설계를 신입 개발자 100 명 페르소나로 비교」 를 셀 수 있는 모양으로 바꿔 돌린 결과. 페르소나 100 명은 한 모델의 100 표본이라 독립 근거가 아니고, 신입의 차이는 사전 지식 축 3 개 (R React 상태 · Q SQL 필터 개념 · S 스프레드시트 · Notion 필터) 의 8 조합으로 닫힌다. 그래서 **과제 12 × 방식 3** 을 설계 근거 (§6 · §8) 를 주지 않은 독립 walker 3 개가 각자 걷고, 동작 수 · 필요한 개념 (프로필별 새 개념) · **조용한 실패 지점** (틀린 선택인데 오류 없이 무반응 · 그럴듯한 틀린 결과) · 결과 왕복 · 확장 비용 · 불가를 셌다. 숫자는 모델 추정이다 — 셋이 같은 방향이면 설계 사실, 갈리면 가정 차이로 읽는다. brief 와 walker 보고 원문: `docs/explanation/research/data-layer-walkthrough-2026-10/`.

### 9.1 설정

- **데이터**: `Users` (id · name · gender · age · email · createdAt · tags[] · teamId → Teams · status) 50 행 mock, `Teams`. 화면은 Users GridList.
- **과제 12**: ① RadioGroup gender ② SearchField name 포함 ③ TagGroup tags 「그 중 하나」 ④ DateRangePicker 범위 ⑤ Checkbox 「closed 제외」 (아님) ⑥ `search AND (female OR age<25)` ⑦ 결과 수 Text ⑧ status 별 개수 3 줄 ⑨ 팀 이름 표시 + Select 로 거르기 (조인) ⑩ Table 정렬을 GridList 가 따라가기 ⑪ ① · ② 그대로 API 서버 필터로 전환 ⑫ kanban 열 3 + drag & drop 으로 status 변경.
- **방식**: A 스크립트 (RAC + `useState`/`useListData` 직접 코드) · B 지금 빌더 (변수 · 규칙 · `setFilterText` · endpoint `{{ }}`) · C 리서치 설계 (§8 — 「이 컨트롤로 목록 거르기」 동작 · 바인딩별 기본 보기 · 조건 트리 · 묶기 · 집계 · 참조 · 정렬 변수 · 직렬화 · dnd · 다중 Do).

### 9.2 결과 — 세 walker 가 같은 방향인 것

| 지표                     | A 스크립트                              | B 지금 빌더                                        | C 리서치 설계                                                                |
| ------------------------ | --------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------- |
| 불가 과제                | 0 · 0 · 0                               | **10 · 10 · 10** (①~⑨ · ⑫)                         | 0 · 0 · 1 (⑤ — walker 3)                                                     |
| 동작 수 합 (12 과제)     | 107 · 115 · 128                         | 51 · 41 · 24 (가능 과제 ⑩ · ⑪ 만, 둘 다 가정 의존) | 179 · 178 · 145                                                              |
| 동작 수 합 (⑫ 제외)      | 90 · 97 · 106                           | —                                                  | 103 · 109 · 88                                                               |
| C 가 가벼운 과제         | —                                       | —                                                  | ② ④ ⑦ ⑪ (6 ~ 9 vs A 7 ~ 22)                                                  |
| C 가 무거운 과제         | —                                       | —                                                  | **⑫ 57 ~ 76** (A 17 ~ 22) · ⑩ 15 ~ 20 (A 14 ~ 19) · ① ③ ⑨ 10 ~ 13 (A 8 ~ 14) |
| 조용한 실패 수           | 25 · 26 · 26                            | 14 · 18 · 18 (끝낼 수 있는 2 과제에 집중)          | 35 · 31 · 32                                                                 |
| 그중 「알아채기 어려움」 | 7 · 11 · 10                             | 5 · 4 · —                                          | 10 · 12 · 10                                                                 |
| 결과 왕복                | 저장 1 (HMR, 타입 오류는 편집기에 즉시) | Preview 탭 1 (규칙 오류 표시 없음)                 | Preview 탭 1 (같음)                                                          |

- **B 는 비교 대상이 아니다.** 12 과제 중 10 이 불가 — 세 walker 모두. 우회 (테이블을 손으로 3 개로 나누고 Tabs 로 전환 · ComboBox 로 대체) 는 과제의 컨트롤 · 결과를 바꾸고 동작 수가 24 ~ 580 이다. 가능한 ⑩ · ⑪ 도 「GridList `sort` capability 가 descriptor 인자를 받는다」 · 「같은 When 에 규칙 둘」 가정에 의존한다. B 의 조용한 실패는 대부분 **「그럴듯한 시도 → 무반응」** 이고, 사용자가 겪은 사례 (`selectedKeys.name` 글자 · mock 에 setFilterText) 가 그 부류다.
- **A 와 C 는 둘 다 끝낸다.** ⑫ 를 빼면 동작 수가 비슷하다 (A 90 ~ 106 · C 88 ~ 109). A 의 큰 몫은 RAC 조립 (DateRangePicker 15 줄 · Table 8 · Select 9), C 의 큰 몫은 컨트롤 자체 (B 와 같음) 와 ⑫ 의 **열 3 개 × 같은 일 반복** (조건 · 바인딩 · 머리 count · 규칙 = 69 중 42).
- **조용한 실패는 A 와 C 가 과제당 2 ~ 3 개로 비슷하고 종류가 다르다.** A 는 코드 층 (타입 · 참조 · 경계 · stale closure · 문자열 키 vs 숫자 id), C 는 설계 층 (비교 방식의 뜻 · 기본값 · 묶음 위치 · 보기 공유 부작용). C 가 A 보다 조용한 실패가 많다 — 「코드보다 쉽다」 를 주장하려면 아래 9.4 가 전제다.
- **새 개념 (프로필별)**: 방향은 셋이 같다 — **R 축은 A 만 줄이고 C 는 0 개 줄인다** (C 의 개념은 React 어휘와 겹치지 않는다) · **Q 또는 S 축은 C 를 15 ~ 25 줄인다** (조건 · AND/OR · 묶기 · 집계 · 참조가 SQL · Notion 어휘다). RQS 프로필은 A 가 적고 (A 27 ~ 47 vs C 44 ~ 66), 「없음」 프로필은 비슷하거나 C 가 많다 (A 60 ~ 101 vs C 59 ~ 90). **고유 개념 수** (중복 제거) 는 walker 2 는 모든 프로필에서 C < A, walker 3 은 C ≥ A — A 의 개념은 컴포넌트마다 다른 API 가 한 번씩, C 의 개념은 적은 수 (「거르기 동작」 · 「건너뛰는 값」 · 「값 고르기」 · 「이름 있는 보기」) 가 되풀이된다. 어느 쪽이 「배우는 부담」 인지는 이 방법으로 못 가른다.

### 9.3 C 의 약점 — 셋 중 둘 이상이 짚은 지점

| #   | 지점                                           | 과제    | 무엇이 조용히 실패하나                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ---------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **「거르기」 동작이 자동으로 고른 기본값**     | ① ②     | string 필드의 비교 기본값 — 「포함」 이면 `male ⊂ female` 로 male 을 눌러도 전부 보이고 female 은 맞아서 못 알아챔; 「같음」 이면 SearchField 가 완전 일치가 됨 (walker 마다 가정이 갈려 어느 쪽이든 실패 1 개). 건너뛰는 값 `all` 이 기본으로 안 들어가면 all = 빈 목록. 대소문자 (Radio 값 `Male` vs 데이터 `male`).                                                                                                                                                                  |
| 2   | **boolean 컨트롤이 조건에 들어가는 길이 없다** | ⑤       | 조건의 값 자리가 하나라 「변수가 true 일 때만 `status ≠ closed`」 를 둘 곳이 없다 — walker 3 은 불가, 1 · 2 는 변수를 값 자리에 넣어 `status ≠ true` (항상 참 · 무반응) 또는 리터럴만 두어 체크와 무관하게 동작하는 실패.                                                                                                                                                                                                                                                               |
| 3   | **조건 트리의 묶음 위치 · 기본 AND · 경계**    | ⑥       | 새 조건을 묶음이 아니라 루트에 넣어 AND 로 동작 (결과가 줄어 그럴듯함) · 묶음을 OR 로 안 바꿈 · 루트를 OR 로 바꿔 검색까지 OR · 「미만」 이 없어 「이하 25」 → 25 세 포함 (1 명 차이, 거의 못 알아챔).                                                                                                                                                                                                                                                                                  |
| 4   | **이름 없는 기본 보기 ↔ 이름 있는 보기 경계**  | ⑦ ⑧ ⑩ ⑫ | 개수 하나를 보이려면 「GridList 보기에 이름 → Text 보기의 원본 = 그 보기 → count」 세 단계; GridList 보기에 바로 count 를 넣으면 **목록이 한 행 `{count}` 로 깨진다**; Text 원본을 `Users` 에 두면 항상 50; ⑫ 의 열 보기는 손으로 만든 것이라 이름이 없어 머리 count 가 공유 못 함; ⑩ 에서 보기를 공유하면 **조건까지 따라가** Table 이 뜻밖에 걸러진다. 집계 결과 행의 키 이름 (`status` vs `key` · `count`) 과 템플릿 문법 (`{{ }}` 변수 vs `{ }` 행 필드) 혼동.                      |
| 5   | **정렬에는 「거르기」 같은 한 번 동작이 없다** | ⑩       | 변수 생성 (type object) · `onSortChange → Set state` 규칙 · 보기 이름 · Table 바인딩을 그 보기로 · 보기 정렬 = 변수 — 4 ~ 5 가지를 손으로 잇는다. Table 을 원본에 두면 B 의 `allowsSorting` 자체 정렬이 **되는 것처럼 보여** GridList 가 안 따라가는 것을 늦게 안다. Table `sortDescriptor` 표시와 보기 정렬 변수가 한 곳에서 묶이지 않으면 화살표와 순서가 어긋난다. When 을 `onSelectionChange` 로 고르면 무반응.                                                                     |
| 6   | **drag & drop 은 열마다 규칙 · 머리를 되풀이** | ⑫       | 69 ~ 76 동작 중 42 가 열 3 개 반복. `onRootDrop` 과 `onInsert` 가 When 에 둘로 갈려 하나만 걸면 **가끔 됨** (빈 자리 vs 카드 사이). `update` 의 keys 를 「값 고르기」 에서 `keys` · `items` · `target.key` · 「선택한 항목」 중 골라야 하고, 틀리면 무반응이거나 **그 자리 카드가 바뀜**. `update` 대상을 「놓인 열의 목록」 으로 고르면 끌어온 키가 그 보기에 없어 no-op. 열마다 규칙을 복사하고 리터럴 `active` 를 안 바꾸면 어느 열에 놓아도 active 로. 드래그 키 문자열 vs 숫자 id. |
| 7   | **API 전환의 직렬화 · 경고 시점**              | ⑪       | 「포함」 → `name_like=` 의 서버 뜻 (앞글자 vs 포함) 이 다르면 그럴듯한 틀린 결과; 형식을 body JSON 으로 고르면 GET 에 안 실려 전부 반환; 「평면 param 에 OR 못 담음」 경고가 **조건 저작 때**만 뜨면 ⑥ 을 둔 채 원본을 endpoint 로 바꾸는 (과제 순서 그대로인) 경로에서 경고가 빈다; 응답 필드 이름이 mock 과 다르면 조건이 끊기고 Preview 가 로컬 재계산도 하는지에 따라 빈 목록 또는 서버 결과만; 바인딩을 endpoint 로 바꿀 때 기본 보기가 새로 생기면 ① · ② 조건이 사라짐.           |
| 8   | **참조 경로 이름 · Select 해제**               | ⑨       | 필드 이름 `teamId` 인데 경로가 `team.name` 인지 `teamId.name` 인지; 조건 필드를 `team.name` 으로 두고 값은 Select 키 (id) → 빈 목록; Teams 에 없는 teamId (null) 행이 조건에서 조용히 빠짐; Select 는 해제가 없어 `all` 항목 + 건너뛰는 키를 안 만들면 「전부」 로 못 돌아감 (①과 같은 뿌리).                                                                                                                                                                                           |
| 9   | **B 습관의 경로**                              | ①       | 「거르기」 동작을 안 쓰고 변수 + `onChange → Set state` 규칙만 손으로 만들면 (지금 빌더 방식) 보기에 조건이 없어 무반응 — C 안에 B 의 길이 그대로 남아 있다.                                                                                                                                                                                                                                                                                                                            |
| 10  | **비교 방식의 뜻이 이름에 없다**               | ③ ④     | 「배열 포함」 이 하나라도 (any) 인지 전부 (all) 인지 · 「사이」 끝 포함 여부 · 날짜에 시각이 있을 때 끝날 00:00 비교 · `createdAt` 이 mock JSON 그대로 string 이면 사전순 비교 — 결과가 줄어 그럴듯해 못 알아챔.                                                                                                                                                                                                                                                                        |

### 9.4 §8.4 phase 1 에 더할 설계 요구 (약점 → 요구)

1. **기본값은 「컨트롤 모양 × 필드 타입」 으로 정하고 동작 완료 화면에 보인다** — 값 고르기 컨트롤 (Radio · Select · Tag) 은 「같음 / 그 중 하나」, 글자 입력 (SearchField · TextField) 은 「포함 (대소문자 · 악센트 무시)」; 건너뛰는 값은 컨트롤 모양 (빈 글자 · 빈 선택 · false) 에서 자동, 지정 키 (`all`) 는 Radio · Select 의 항목 중 하나를 고르게 함. 비교 · 건너뛰는 값 · 변수 이름 셋이 동작 직후 한 화면에 보여야 한다 (약점 1 · 8 · 9).
2. **조건에 「적용 여부」 자리** — 값 자리와 별도로 boolean 변수를 「이 조건을 켠다」 에 연결 (Checkbox 「closed 제외」 = 리터럴 `closed` 아님 + 적용 = `!var.hideClosed`). 「변수가 true 일 때만」 이 흔한 모양이다 (plants `favorite`) (약점 2).
3. **비교 방식 이름에 뜻을 붙인다** — 「하나라도 포함 / 전부 포함」 · 「사이 (끝 포함)」 · 「미만 · 초과」 를 「이하 · 이상」 과 따로 · 날짜는 날짜 단위 비교가 기본 · mock JSON 의 날짜 글자는 필드 타입 date 로 올리기를 권함 (약점 3 · 10).
4. **묶음 추가는 「조건을 묶음으로 바꾸기」 로** — 조건 옆 「또는 조건 추가」 가 그 조건을 OR 묶음으로 감싼다. 루트 연산자 변경은 묶음이 하나뿐일 때만 보이거나 확인을 받는다 (약점 3).
5. **집계는 보기 「위」 가 아니라 「파생 보기」 로** — 보기에 count 를 넣어 목록이 깨지는 길을 막고, Text · 배지가 「이 목록의 결과 수」 를 고르면 파생 보기와 이름이 자동으로 생긴다. 집계 결과의 키 · 집계 이름은 템플릿 피커가 보여 준다 (약점 4).
6. **공유 보기는 「원본 + 조건」 과 「정렬」 을 나눠 공유할 수 있어야 한다** — ⑩ 은 조건 없이 정렬만 따라가길 원할 수 있다. 「이 Table 의 정렬을 저 목록도 따라가기」 한 번 동작이 변수 · 규칙 · 보기 정렬을 만들고, Table `sortDescriptor` 표시를 같은 변수에 묶는다. Table 을 원본에 둔 채 `allowsSorting` 만 켜면 「이 Table 만 정렬됩니다」 를 그 자리에서 알린다 (약점 4 · 5).
7. **kanban 은 「묶기 필드로 열 만들기」 한 번 동작** — 보기의 묶기 (`status`) 에서 열 보기 N 개 + 머리 count + drop 규칙 (`onRootDrop` · `onInsert` 둘 다, `update status = 열 값`) 을 한꺼번에 만든다. When 에 「놓음 (빈 자리 · 카드 사이)」 을 묶은 선택지를 두고, `update` 의 키 기본값은 「끌어온 항목 (`keys`)」, 대상은 항상 원본 collection 으로 고정한다 (약점 6).
8. **직렬화는 비교 방식 ↔ param 대응을 표로 보여 주고, 경고는 조건 저작 · 원본 변경 · 형식 변경 세 시점 모두** — 「포함」 이 `_like` 로 가는지 확인하게 하고, GET + body 조합은 막는다. endpoint 로 바꿀 때 기본 보기의 조건은 유지하고 응답 필드가 조건 필드와 안 맞으면 그 자리에서 알린다. API 보기도 Preview 가 조건을 로컬로 다시 적용하는지는 §7-7 결정에 적는다 (약점 7).
9. **참조 경로는 필드 이름이 아니라 「표시 이름」 으로** — `teamId` 참조 필드에 경로 이름 (`team`) 을 함께 두고, 템플릿 · 조건 피커가 `team.name` 을 보여 준다. 조건 필드가 참조 경로면 값 자리의 컨트롤 변수 (키) 와 모양이 맞는지 알린다 (약점 8).

### 9.4.1 비개발자가 생각하는 단위 — 사용자의 예시 (2026-10-26)

사용자 원문: 「나도 개발자가 아니다. 그 입장에서 단순하게 접근했다 — data 를 list · table · grid 가 제공하는 목록형에 연동하면 보여주기, 화면에 검색 기능 추가 → input 에 입력 → 목록형에 입력된 것만 보여주기, 검색 기능에 select 추가. 이런 식으로 접근한 거다.」 그리고 「내가 말한 것은 하나의 예시일 뿐이다.」

예시가 정하는 것은 특정 진입 순서가 아니라 **생각의 단위와 어휘의 수준**이다 — 「보여주기 · 검색 · 입력 · 선택」 같은 기능 단위로 생각하고, 그 단위 하나가 빌더에서 동작 하나여야 한다. 그래서 §8.2-1 · §9.4-1 의 생성 단축은 **어느 쪽에서 시작해도** 같은 결과가 나와야 한다.

- **진입점은 둘 다 열어 둔다.** 목록에서 「검색 추가 → 필드 → 컨트롤 종류」 로 가도 되고 (예시의 길), 캔버스에 놓인 컨트롤에서 「이 컨트롤로 목록 거르기 → 대상 → 필드」 로 가도 된다 (§8.2-1 의 길). 둘이 만드는 변수 · 규칙 · 조건은 같다. 어느 쪽이 더 짧은지는 사람 · 상황마다 다르므로 한쪽을 「두 번째 길」 로 두지 않는다. 검색 외의 기능 (정렬 · 개수 · 묶기 · 상세 보기) 도 같은 원칙 — 기능 이름 하나 = 동작 하나.
- **어휘는 비개발자의 것이다.** 「데이터 연동 · 검색 · 입력 · 선택 · 정렬 · 개수」. 변수 · 규칙 · 보기 · 조건 트리 · 직렬화는 **만든 뒤 펼치면 보이는 층**이고, 첫 화면에 나오지 않는다. §9.3 약점 4 · 5 (보기 이름 · 정렬 변수 배선) 는 이 층을 사용자에게 먼저 보인 데서 나온 것이기도 하다.
- **「검색 기능」 이 묶음 단위다.** 한 목록의 검색 컨트롤들은 한 묶음 (조건 트리의 루트) 이고, 「전체 지우기」 · 「적용된 조건 N」 배지 (plants) 는 그 묶음의 속성이다. OR 묶음 (§8.3.2-1) 은 이 묶음 안에서 「또는」 으로 들어간다.
- **select 는 데이터에서 채운다.** 「검색 기능에 select 추가」 가 가장 짧으려면 select 의 항목이 그 필드의 값 (gender 의 male · female) 에서 자동으로 오고 「전체」 항목이 기본으로 붙어야 한다 (§9.3 약점 1 · 8 의 `all` 건너뛰기가 여기서 자동으로 해결된다).

walkthrough 의 C 동작 수 (① 10 ~ 13 · ③ 10 ~ 12) 는 「컨트롤 놓기 → 항목 값 입력 → 동작 → 대상 → 필드 → 비교 → 건너뜀」 을 다 센 것이다. 어느 길이든 항목 값 · 비교 · 건너뜀이 데이터와 컨트롤 모양에서 자동으로 채워지면 과제 ① 이 4 ~ 5 동작이 된다 — 다음 라운드에서 두 진입점을 각각 센다.

### 9.5 이 평가의 한계

- 세 walker 는 같은 모델의 세 표본이다 — 독립 인간이 아니다. 셋이 갈린 곳 (string 비교 기본값 · ⑤ 불가 여부 · 고유 개념 수 방향) 은 **brief 가 정하지 않은 설계 빈칸**이고, 그 빈칸 자체가 9.4 의 요구가 됐다.
- 동작 수는 「최소 경로」 라 실제 신입은 더 많이 헤맨다. 그래서 조용한 실패 수가 동작 수보다 센 지표다.
- 실제 근거로 올리려면 ① · ⑥ · ⑫ 세 과제를 신입 2 ~ 3 명에게 C 의 시안 (또는 Phase 1 뒤 실제 UI) 으로 시키고 조용한 실패가 9.3 의 목록에 드는지 보는 것이 맞다. 그 전까지 「C 가 A 보다 쉽다」 는 주장하지 않는다 — 지금 숫자는 「B 는 불가 · A 와 C 는 비슷한 무게 · C 의 조용한 실패는 9.4 로 줄일 수 있는 설계 층의 것」 까지다.

### 9.6 평가 기준의 재정의 — 빌더의 목적에 비추어 (사용자 원칙 2026-10-26)

사용자 원문: 「가장 좋은 것이야 빌더는 지금 UI 만 제공하고 스크립트는 숙련된 사용자가 하는 것이겠지만, 그럴 경우 급격한 인건비 상승에 휴먼 에러 리스크를 감당해야 한다. 현재 composition 빌더를 개발하는 이유도 **인건비를 줄이고 프로젝트 결과물의 완성도와 유지보수를 누가 하든 일관되게** 하기 위함이다.」

이 목적에 비추면 §9.2 의 숫자는 다르게 읽힌다.

| 기준               | A 스크립트                                                                                                    | C 리서치 설계                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 누가 하나          | 숙련자 (R 축 필수 — 신입은 새 개념 60 ~ 101)                                                                  | 신입 포함 (R 축 효과 0 · Q/S 축이 줄임) — 인건비 축                                                |
| 조용한 실패의 성질 | **사람마다** 다시 생긴다 (타입 · 경계 · stale closure · 키 타입) — 리뷰 · 테스트로 매번 잡아야 하는 휴먼 에러 | **설계 층** — §9.4 의 요구 9 개로 **한 번 고치면 모든 사용자에게 사라진다**                        |
| 결과물의 일관성    | 같은 과제를 사람마다 다르게 짠다 (`useListData` vs `useState` · filter 위치 · 정렬 방식)                      | 같은 과제 → 같은 문서 구조 (변수 · 규칙 · 보기 조건 세 단위, 개념 수 적고 되풀이 — §9.2 고유 개념) |
| 유지보수           | 다음 사람이 코드를 읽어야 한다                                                                                | 패널에서 변수 · 규칙 · 조건이 각자 보인다 (§8.2-1 요구)                                            |
| B 지금 빌더        | —                                                                                                             | 과제 10 개가 불가라 **스크립트로 빠져나가게 만든다** — 그 순간 위 A 열의 비용이 그대로 든다        |

따라서 「C 가 A 보다 쉽다」 는 §9.5 대로 아직 주장하지 않지만, **「C 가 A 보다 일관되고 싼가」** 는 구조로 답할 수 있다 — C 의 실패는 제품 결함이라 수리 대상이고, A 의 실패는 운영 비용이라 수리 대상이 아니다. 이것이 B 의 불가 10 개를 C 로 채워야 하는 이유이고, §9.4 요구 9 개가 「있으면 좋은 것」 이 아니라 **빌더가 존재하는 이유를 만족하는 조건**인 이유다.

배경 (사용자 10-26 추가): 「매번 프로젝트 진행 시 프리랜서 개발자들의 실력 문제로 휴먼 에러 급증과 유지보수에 더 큰 리스크를 반복했다.」 — 문제는 평균 실력이 아니라 **사람마다의 편차**다. 그래서 재야 할 것은 동작 수의 평균이 아니라 **분산** (같은 과제를 세 사람이 하면 결과물이 얼마나 다른가) 과 **떠난 뒤의 비용** (만든 사람 없이 조건 하나를 바꾸는 동작 수) 이다. A 는 둘 다 사람에 묶이고, C 는 둘 다 문서 구조에 묶인다.

다음 walkthrough 라운드가 있으면 지표에 **일관성** (같은 과제를 walker 3 이 만든 문서 구조가 같은가 — 이번 라운드의 walker 간 차이가 그 대리 지표다) 과 **유지보수** (만든 사람 없이 다른 사람이 조건 하나를 바꾸는 동작 수) 를 더한다 — 이번 brief 에는 없었다.

## 부록 A. 용어표 (빌더가 그대로 노출해야 하는 RAC · react-stately 어휘)

| 어휘                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 뜻                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `items` / `defaultItems` · render 함수 · `id` · `textValue` · `dependencies`                                                                                                                                                                                                                                                                                                                                                                                                              | 동적 collection 입력 (controlled / uncontrolled) · 항목 렌더 · 전역 유일 키 · 글자 표현 (typeahead · 필터) · 외부 state 의존 |
| `Collection` · `ListBoxSection` · `MenuSection` · `GridListSection` · `TreeSection` · `Header`                                                                                                                                                                                                                                                                                                                                                                                            | 섹션 안 동적 항목 · 출처 합치기 · 묶음과 제목                                                                                |
| `renderEmptyState` · `*LoadMoreItem` · `onLoadMore` · `isLoading`                                                                                                                                                                                                                                                                                                                                                                                                                         | 빈 상태 · 무한 로드 sentinel                                                                                                 |
| `useListData` (`initialItems` · `initialSelectedKeys` · `initialFilterText` · `getKey` · `filter`)                                                                                                                                                                                                                                                                                                                                                                                        | immutable 목록 state + 선택 + 필터 + 명령                                                                                    |
| `insert` · `insertBefore` · `insertAfter` · `append` · `prepend` · `remove` · `removeSelectedItems` · `update` · `move` · `moveBefore` · `moveAfter` · `getItem` · `setSelectedKeys` · `setFilterText`                                                                                                                                                                                                                                                                                    | 목록 명령 · 조회 · setter                                                                                                    |
| `useAsyncList` · `load({signal, cursor, filterText, sortDescriptor, selectedKeys})` · `reload` · `loadMore` · `sort` · `loadingState` · `isLoading` · `error`                                                                                                                                                                                                                                                                                                                             | 비동기 목록 — fetch · 페이지 · 서버 정렬 · 서버 필터                                                                         |
| `useTreeData` · `getChildren` · `parentKey` (`null` = 루트)                                                                                                                                                                                                                                                                                                                                                                                                                               | immutable 트리 state                                                                                                         |
| `SortDescriptor {column, direction}` · `sortDescriptor` · `onSortChange` · `allowsSorting` · `useCollator`                                                                                                                                                                                                                                                                                                                                                                                | 정렬 (Table 만 prop; 정렬 자체는 앱)                                                                                         |
| `useFilter` → `contains` · `startsWith` · `endsWith` (`sensitivity`)                                                                                                                                                                                                                                                                                                                                                                                                                      | locale 글자 비교                                                                                                             |
| `Autocomplete filter` · `disableVirtualFocus` · `disableAutoFocusFirst` · `inputValue` · `onInputChange`                                                                                                                                                                                                                                                                                                                                                                                  | 표시 층 검색 · 서버 검색 배선                                                                                                |
| `defaultFilter` · `allowsEmptyCollection` · `allowsCustomValue` · `menuTrigger`                                                                                                                                                                                                                                                                                                                                                                                                           | ComboBox 필터 · 팝오버                                                                                                       |
| `Selection` (`'all' \| Set<Key>`) · `selectionMode` · `selectionBehavior` · `selectedKeys` / `defaultSelectedKeys` / `onSelectionChange` · `selectedKey` · `disallowEmptySelection` · `disabledKeys` · `disabledBehavior` · `escapeKeyBehavior` · `onAction` / `onRowAction`                                                                                                                                                                                                              | 선택                                                                                                                         |
| `useDragAndDrop` → `dragAndDropHooks` · `getItems` · `acceptedDragTypes` · `shouldAcceptItemDrop` · `getDropOperation` · `getAllowedDropOperations` · `onRootDrop` · `onItemDrop` · `onInsert` · `onReorder` · `onMove` · `onDrop` · `onDragStart/Move/End` (`isInternal`) · `onDropEnter/Exit/Activate` · `renderDragPreview` · `renderDropIndicator` · `DropIndicator` · `DropTarget` (`root` \| `item` + `dropPosition`) · `isTextDropItem` · `isFileDropItem` · `isDirectoryDropItem` | drag & drop                                                                                                                  |
| `Virtualizer` · `ListLayout` · `GridLayout` · `WaterfallLayout` · `TableLayout` · `layoutOptions`                                                                                                                                                                                                                                                                                                                                                                                         | 가상화 레이아웃                                                                                                              |
| `TableHeader columns` · `Row columns` · `Column isRowHeader` · `treeColumn` · `expandedKeys`                                                                                                                                                                                                                                                                                                                                                                                              | Table 동적 열 · 계층                                                                                                         |
| `Form action` / `onSubmit` / `onReset` / `onInvalid` · `validationBehavior` · `validationErrors` · `validate` · `isInvalid` · `FieldError` · `name`                                                                                                                                                                                                                                                                                                                                       | 폼                                                                                                                           |
| `renderActionBar` (S2)                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 선택 있을 때 일괄 동작 막대 (D2)                                                                                             |
