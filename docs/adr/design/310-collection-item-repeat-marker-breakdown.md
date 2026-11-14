# ADR-310 breakdown — 항목 노드의 반복 표시 · Tabs 노드 정본 · bound Table Row 템플릿

> 본문: [ADR-310](../310-collection-item-repeat-marker.md). 기준: main `e7e9fc035` (2026-11-14), react-aria-components 1.22.1 · react-stately 3.51.0 · @react-spectrum/s2 1.8.2, `LIBRARY_CONTRACT_VERSION` 66.
>
> `C` = `packages/shared/src/catalog`, `B` = `apps/builder/src/builder/catalogRuntime`.
>
> 조사 원문 (로컬 전용, 커밋되지 않음): `.agent/runs/2026-11-14-collection-model-proposal/artifacts/proposal.claude.md` · `proposal.md` (Codex 안) · `.agent/runs/2026-11-14-reui-collection-research/artifacts/report.md`. 결론은 이 문서에 옮겼다.

## 1. 전제 확정 기록

분리 (fork) 가 아니라 새 결정이지만, 선행 ADR 넷을 고치므로 4 질문을 적어 둔다.

1. **base / 응용**: 이 ADR 은 base (문서 모델) 다. Code 보기 · 연결 UI · Layers 표시는 그 응용이고 같은 ADR 의 뒤 Phase 다.
2. **schema 직교성**: `repeat` 는 `binding` (ADR-152) · 그룹 선택 (ADR-308) · slot (ADR-234) 과 직교인 새 필드 하나다. 기존 필드의 뜻을 바꾸지 않는다.
3. **선행 전제 재검증**: ADR-234 의 「데이터 목록 = `items` + 템플릿, 정적 목록과 두 경로 공존」 을 그대로 승계하지 않았다 — 레퍼런스의 「Combining collections」 가 섞는 형태를 정식으로 두므로 한 목록으로 합친다. ADR-241 의 「데이터 행마다 노드 = 기각」 은 유지한다 (템플릿 하나).
4. **판독에 미루지 않음**: 위 1 ~ 3 은 사용자 요청 (「권장안으로 /create-adr」) 으로 확정됐다. 사용자가 답한 6 건은 본문 Status.

## 2. 레퍼런스에서 확인한 것

2026-11-14 에 직접 연 공식 페이지 11 건. hook 시그니처는 설치본 타입 (`react-stately/dist/types/src/data/*.d.ts`).

| 개념            | 출처                                                                                                                         | 요지                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 정적 collection | [RAC Collections](https://react-aria.adobe.com/collections) · [S2 Collections](https://react-spectrum.adobe.com/collections) | 항목을 JSX 자식으로 적는다                                                                                                                               |
| 동적 collection | 같은 문서                                                                                                                    | `items` + 렌더 함수. 항목 객체 단위로 렌더를 기억한다                                                                                                    |
| id              | 같은 문서                                                                                                                    | 모든 항목은 유일한 `id`. section 을 넘어 목록 전체에서 유일                                                                                              |
| dependencies    | 같은 문서                                                                                                                    | 렌더가 바깥 상태에 의존하면 `dependencies` 로 알린다                                                                                                     |
| 조합            | 같은 문서 「Combining collections」                                                                                          | `<Collection>` 으로 여러 데이터를 합치거나 정적 항목과 섞는다                                                                                            |
| 비동기          | 같은 문서                                                                                                                    | RAC 는 목록 끝의 `LoadMoreItem` (level · section 마다 가능), S2 는 owner 의 `loadingState` + `onLoadMore`                                                |
| Tabs            | [S2 Tabs](https://react-spectrum.adobe.com/Tabs)                                                                             | 배열 하나를 `TabList items` 와 `<Collection items>` (TabPanel) 가 같이 읽고 `id` 로 짝                                                                   |
| Table           | [RAC Table](https://react-aria.adobe.com/Table)                                                                              | `TableBody items` 의 Row 함수 + Cell. 하위 행은 `<Collection items={item.children}>`                                                                     |
| Tree            | [RAC Tree](https://react-aria.adobe.com/Tree)                                                                                | `renderItem` 이 `<Collection items={item.children}>` 로 자신을 다시 부른다. 끌어 옮기기는 `onMove` + `useTreeData`                                       |
| 선택            | [RAC Selection](https://react-aria.adobe.com/selection)                                                                      | owner 의 `selectedKeys` (Set 또는 `"all"`). `"all"` 은 안 불러온 항목 포함                                                                               |
| DnD             | [RAC Drag and Drop](https://react-aria.adobe.com/dnd)                                                                        | `onReorder` = 같은 level 의 사이. `onMove` = level 을 넘는 이동 포함. 목록 간은 `onInsert` + `onRootDrop` + `onDragEnd`                                  |
| Virtualizer     | [RAC Virtualizer](https://react-aria.adobe.com/Virtualizer)                                                                  | 위치 · 크기는 Layout 이 정하고 CSS flex · grid 는 적용되지 않는다                                                                                        |
| hook            | 설치본 타입                                                                                                                  | `useListData` (append · insert · move · update · remove …) · `useTreeData` (`move(key, toParentKey, index)`) · `useAsyncList` (reload · loadMore · sort) |

S2 컴포넌트별 지원 (로컬 skill 스냅샷 집계):

| 기능                          | 지원하는 S2 컴포넌트                                                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`                       | ActionMenu · Breadcrumbs · CardView · ComboBox · ListView · Menu · Picker · SelectBoxGroup · SideNav · TableView · Tabs · TagGroup · TreeView |
| `loadingState` + `onLoadMore` | CardView · ComboBox · ListView · Picker · TableView · TreeView                                                                                |
| `renderEmptyState`            | CardView · ListView · TableView · TagGroup · TreeView                                                                                         |
| `dragAndDropHooks`            | CardView · ListView · TableView · TreeView                                                                                                    |

RadioGroup · CheckboxGroup · ToggleButtonGroup · SegmentedControl 은 `items` 가 없다 — 데이터로 채우는 코드는 `array.map` 이다.

## 3. 현재 상태 (본문 F1 ~ F13 의 상세)

「첫 항목 = 템플릿」 규칙의 자리 (F3):

| 자리                                                | 내용                                          |
| --------------------------------------------------- | --------------------------------------------- |
| `C/resolution/resolver.ts:2693-2694`                | `if (childId !== itemPositions[0]) continue;` |
| `C/resolution/resolver.ts:3052`                     | `projectChildren([itemPositions[0]!], …)`     |
| `C/resolution/resolver.ts:1983` · `:2920` · `:2991` | 같은 규칙의 다른 가지 (2026-11-14 직접 읽음)  |
| `B/layerTree.ts:530-532`                            | `rows.find(isItem)` — 첫 항목을 템플릿으로    |
| `B/dataBindingCommand.ts:85`                        | `items[0]`                                    |

항목 type 목록의 불일치 (F4 · F5):

| 항목 type                                   |   추가 명령 표   | resolver 반복 대상 | Code 보기 표 |
| ------------------------------------------- | :--------------: | :----------------: | :----------: |
| ListBoxItem · GridListItem · Tag · TreeItem |        ✓         |         ✓          |      ✓       |
| Tab                                         |        ✓         |         ✓          |      ✗       |
| Breadcrumb                                  |        ✓         |         ✓          |      ✗       |
| MenuItem                                    |        ✓         |         ✗          |      ✓       |
| Card (CardView)                             | ✗ (owner 표에만) |         ✗          |      ✓       |
| SelectBox                                   |        ✓         |         ✗          |      ✗       |
| Row (Table)                                 |    전용 명령     |   전용 합성 경로   |      ✓       |

그 밖에 조사에서 나온 것 (직접 다시 읽지 않은 항목은 §10):

- section 과 데이터 연결의 조합을 다루는 resolver 분기가 없다.
- 한 목록 안 정적 key 중복을 막는 검증을 찾지 못했다. Radio · Checkbox 의 `value` 개명은 그룹 값 갱신 경로 (`B/singleSelection.ts:225` `catalogItemKeyRenameCommands`) 를 지나지 않는다.
- Tree 편집도 Code 보기에서 `list.move` 로 나온다.

## 4. 설계

### 4.1 저장

```ts
// 제안
interface NodeEntry {
  // …기존 필드
  /** 이 항목 노드를 데이터 행마다 반복한다 (레퍼런스의 Collection 구간). */
  repeat?: true;
}
```

- 붙일 수 있는 곳: §5 표가 「항목」 또는 「section」 으로 적은 type 의 노드뿐. 그 밖은 검증이 거절한다.
- library 원본 template 에는 쓰지 않는다. 연결 명령이 지금처럼 템플릿 항목을 소유 노드로 넣고 (`rowTemplateInsert`) 거기에 표시한다.

### 4.2 데이터 위치

| 순서 | 데이터 위치                    | 레퍼런스 형태                        | 쓰임                              |
| ---- | ------------------------------ | ------------------------------------ | --------------------------------- |
| ①    | 그 노드 자신의 `binding`       | `<Collection items={다른 목록}>`     | 한 목록에 데이터가 둘 이상        |
| ②    | 반복 중인 바깥 행의 하위 행    | `<Collection items={item.children}>` | Tree 재귀, 묶음 section 안의 항목 |
| ③    | 가장 가까운 owner 의 `binding` | `<ListBox items={목록}>`             | 기본. 지금의 연결과 같은 위치     |

`binding.key` (한 행 고정) 는 `repeat` 와 함께 쓰지 않는다 (검증).

### 4.3 판정 함수 하나

```ts
// 제안. 저장하지 않는다 — Graph 에서 계산.
type CollectionEntry =
  | { kind: "static"; nodeId: NodeId; key: string }
  | { kind: "repeat"; nodeId: NodeId; source: "own" | "outerRow" | "owner" } // ① ② ③
  | { kind: "other"; nodeId: NodeId }; // Header · 빈 상태 · 구분선

function collectionEntries(graph, ownerId): readonly CollectionEntry[];
```

읽는 곳: resolver · Layers · 연결 / 해제 / 삭제 / 복사 명령 · key 중복 검증 · Code 보기. 데이터 행과 행 수는 담지 않는다 — 그려진 행은 resolver 결과 트리, 수는 `rowCount` · `rowsShown` · Builder 표본 (F11).

### 4.4 사용자 동작과 문서 변경

| 사용자 동작                  | 문서 변경 (명령 하나 = Undo 한 단계)                      | 화면                                     |
| ---------------------------- | --------------------------------------------------------- | ---------------------------------------- |
| slot 「+」                   | 항목 노드 추가 (지금 그대로)                              | 연결된 목록에서도 고정 항목으로 추가된다 |
| 목록에 데이터 연결           | owner 에 `binding` + 항목 하나에 `repeat` (없으면 넣는다) | 그 항목 자리에 데이터 행들               |
| 템플릿 편집                  | 반복 항목 노드와 그 자식 편집                             | 모든 행이 같이 바뀐다                    |
| 고정 항목을 데이터 앞에 두기 | 반복 항목 앞에 정적 항목 추가 · 이동                      | `[전체, 데이터 행들]`                    |
| 연결 해제                    | `binding` · `repeat` 제거                                 | 템플릿이 정적 항목 하나로 남는다         |
| 템플릿 바꾸기                | 다른 항목으로 `repeat` 옮기기                             | —                                        |
| 두 번째 데이터               | 다른 항목에 `repeat` + 그 항목에 직접 연결 (①)            | `[A 의 행들, B 의 행들]`                 |

### 4.5 family 별 적용

| family                                                            | 적용                                                                                      | 지금과 달라지는 것                                              |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| ListBox · GridList · TagGroup · Breadcrumbs                       | 항목에 `repeat`                                                                           | 정적 항목이 연결 뒤에도 보인다                                  |
| Menu · CardView · SelectBoxGroup                                  | 같음                                                                                      | 반복 대상에 들어간다 (F4 수리)                                  |
| Select · ComboBox                                                 | 지금처럼 picker 가 `binding`, 안쪽 ListBox 의 항목에 `repeat`                             | 없음                                                            |
| Tabs                                                              | 정적 = Tab + 짝 TabPanel 노드. 연결 = 둘 다 `repeat`, 짝은 `id` ↔ `itemId`                | `props.items` · 전용 목록 UI 제거. 삭제 · 복제가 짝을 같이 처리 |
| Table                                                             | TableBody 아래 Row 하나에 `repeat`, 열마다 Cell. 셀 내용은 `{필드}`                       | 합성 행 제거. 셀을 노드로 편집. 고정 Row 허용                   |
| Tree                                                              | TreeItem 에 `repeat`, 하위는 ②                                                            | 재귀가 Tree 전용 코드에서 일반 규칙으로                         |
| section                                                           | 정적 section 안의 반복 항목은 ③ 또는 ①. 묶음 데이터면 section 에 `repeat` + 안쪽 항목은 ② | 새 기능                                                         |
| RadioGroup · CheckboxGroup · ToggleButtonGroup · SegmentedControl | 같은 표시. 연결 UI 를 이 그룹에도 연다                                                    | 새 기능. Code 보기는 `array.map`                                |

### 4.6 key

- 정적 항목 · 데이터 행의 key 규칙은 지금 그대로다 (ADR-308).
- 섞인 목록: 중복 검사 범위에 정적 형제의 key 를 넣는다. 겹치면 진단을 낸다 (조용히 잘라내거나 접두사를 붙여 선택 값을 바꾸지 않는다).
- 추가: 한 목록 안 정적 key 중복 검증, `value` 개명 시 그룹 값 갱신, Tab ↔ TabPanel 삭제 · 복제 짝 처리.

### 4.7 실행 중 상태

- 문서의 쓰기 원본은 Graph 하나다. hook 을 Builder 문서 저장소로 쓰지 않는다.
- runtime 은 지금의 세션을 유지한다. 쓰기 대상은 key 다 (화면 순번 아님).
- 섞인 목록:
  - 고정 항목은 데이터에 없다. 끌어 옮기기 · `remove` · `update` 의 대상이 아니고 서버 정렬 · 필터에도 움직이지 않는다.
  - 데이터 행을 고정 항목 앞 · 뒤에 놓으면 반복 구간의 처음 · 끝으로 (사용자 결정 4).
  - 서로 다른 데이터의 구간 사이 이동은 지금의 목록 간 이동 (`onInsert` + `onDragEnd`) 규칙.
  - `removeSelectedItems` 는 데이터에 있는 key 만 지운다.
- 추가: `useTreeData` 의 부모 지정 이동 · 추가, `onMove` 연결.

### 4.8 표시 범위와 구간별 source (리뷰 round 1 H1 · H2)

**표시 범위 (H1)** — 지금: 세션 `boundRows` 가 `catalogBoundRows` 를 기본 상한 100 으로 불러 매번 `[0, 100)` 만 그린다 (`C/runtime/catalogPreviewSession.ts:1688`). `loadMore` 가 붙인 101 번째 행은 세션에만 있다.

| 수           | 가진 곳                                                                   | 뜻                                          |
| ------------ | ------------------------------------------------------------------------- | ------------------------------------------- |
| 전체 수      | source (`total` · 응답의 `totalPath`)                                     | 「+N more」 · 개수 표시                     |
| 불러온 수    | 세션의 조회 단위 (더 보기 · 가상 스크롤 = collection 별, 페이지 = 목록별) | 서버에서 받은 행                            |
| 표시 창      | 세션 (구간별, 100 에서 시작) — 새 값                                      | Preview · Publish DOM 에 놓는 행            |
| Builder 표본 | resolver `rowSample`                                                      | Canvas 가 그리는 행 (page 에 보이는 행 + 1) |

표시 방식은 owner 의 `rowDisplay` 가 정한다 (본문 Decision 10 — 사용자 2026-11-15 「a, b, c 모두다 사용 가능 해야한다」).

```ts
// 제안
interface NodeEntry {
  /** 연결된 목록이 행을 보여 주는 방식. 없으면 { mode: "more", size: 100 }. */
  rowDisplay?: { mode: "more" | "pages" | "virtual"; size?: number };
}
```

| 방식                  | 표시 창                                        | 행을 받는 방법                                    | DOM         | 레퍼런스                                         |
| --------------------- | ---------------------------------------------- | ------------------------------------------------- | ----------- | ------------------------------------------------ |
| 더 보기 `more`        | 구간별, `size` 씩 늘어남                       | 끝의 sentinel 이 창을 늘리거나 다음 페이지를 받음 | 본 만큼     | RAC `LoadMoreItem` · S2 `onLoadMore`             |
| 페이지 `pages`        | `[(page−1)×size, page×size)` — owner 별 `page` | 그 페이지만 (원격: `page` · `pageSize` 인자)      | `size` 행   | 없음 (Pagination 은 자체 컴포넌트 — F16)         |
| 가상 스크롤 `virtual` | 불러온 행 전부                                 | 더 보기와 같음 (`loaderSize`)                     | 보이는 행만 | RAC `Virtualizer` + `ListLayout` · `TableLayout` |

**더 보기**: 구간 끝 `LoadMoreItem` 이 닿으면 ① 불러온 행이 창 밖에 있으면 창 += size ② 다 보였고 다음 페이지가 있으면 불러온 뒤 창 += size ③ 둘 다 아니면 sentinel 을 내지 않는다. 원격이 아닌 목록도 ① 로 창을 늘린다 (지금은 `pages(collectionId)` 가 거짓이면 sentinel 이 없다 — `delegatedDom.runtime.ts:456`). `reload` · 정렬 · 필터 변경은 창을 처음으로 되돌린다. `catalogBoundRows` 의 `limit` 인자는 이미 있으므로 세션이 창 값을 넘기면 된다.

**페이지**: 원격이 아닌 목록은 이미 있는 `CollectionWindow` 계산기 (`resolveCollectionItems.ts:96-108` — 지금 연결돼 있지 않음) 로 자른다. 원격은 `ENDPOINT_LOAD_ARGUMENTS` 에 `page` · `pageSize` 를 더하고 페이지 수는 전체 수 (`totalPath`) ÷ size. endpoint 가 `page` 를 읽지 않으면 cursor 로 앞 · 뒤 이동만 (지나온 페이지는 세션이 든다). 정렬 · 필터 · `reload` 는 1 쪽으로. Pagination 의 번호 Button 은 지금 정적 노드 다섯이다 — 권고안 (사용자 결정 6 (a)) 은 번호 Button 하나를 템플릿으로 두고 페이지 수만큼 그리며 현재 쪽에 `data-current` 를 준다 (rule 에 이미 그 선택자가 있다). Canvas 는 작성된 표본 버튼을 그린다. 반복 구간이 둘 이상인 목록은 페이지를 고를 수 없다 (검증).

**조회 단위 (리뷰 round 2 H1)** — 지금 세션은 원격 조회 상태를 collection id 하나에 묶는다 (본문 F18). 페이지 번호만 목록별로 두면 B 의 3 쪽 응답이 A 의 행을 바꾼다. 그래서 상태를 둘로 가른다.

| 상태                                                                    | 묶이는 곳                | 이유                                         |
| ----------------------------------------------------------------------- | ------------------------ | -------------------------------------------- |
| 항목 key · 편집 기록 (`itemEdits`) · 선택                               | collection               | 데이터의 정체성 — 어느 목록에서 보든 같은 행 |
| 요청 인자 · 받은 항목 · cursor 이력 · 로딩 상태 · 전체 수 · 취소 · 순서 | 조회 단위                | 목록마다 다른 쪽을 볼 수 있다                |
| 표시 창 · 현재 쪽                                                       | 반복 구간 · owner record | 화면의 범위                                  |

조회 단위의 key: 더 보기 · 가상 스크롤 = collection id (지금 그대로 — 같은 collection 의 목록들이 이어 받은 행을 같이 본다). 페이지 = collection id + 그 목록을 그리는 record id (같은 컴포넌트의 instance 둘, 행마다 놓인 목록도 갈린다 — ADR-294 가 경계를 record id 로 가른 것과 같은 이유). 그래서 페이지 목록의 응답은 collection 단위의 항목을 건드리지 않는다.

바꿀 자리 (Phase 7 에서 전수 확정):

- 행 감싸개 `rows: (binding, kind) => this.boundRows(binding, kind)` (`catalogPreviewSession.ts:2072`) 가 읽는 record 를 같이 받아 그 조회 단위의 항목을 준다. `itemSources()` (`:854`) 는 collection 단위 항목만 준다.
- `loadPage` (`:1206-1226`) 의 순서 · 취소 · 로딩 상태 key 를 조회 단위로. `showLoaded` (`:1452-1463`) 는 그 단위의 항목만 바꾸고 편집 기록은 지우지 않는다 (편집 기록은 collection 의 것 — 지금은 `showLoaded` 가 지운다).
- 진행 중 요청 공유: 지금 세션의 페이지 로더 (`catalogPreviewSession.ts:1236`) 는 `loadCollectionEndpoint` (`executeCollectionEndpoint.ts:111-116`) 로 직접 요청하므로 공유가 없다. endpoint id 로 공유하는 실행기 (`:188-201`) 는 `executeApiEndpoint` 경로의 것이다. 조회 단위가 그 실행기를 쓰게 되면 key 를 풀린 요청으로 바꾼다 — Phase 7 소비자 조사에서 경로를 가른다 (리뷰 round 3 LOW).
- collection 대상 동작: 편집은 편집 기록 하나를 각 단위 위에 다시 적용, `reload` · 정렬 · 검색 글자는 그 collection 의 모든 단위에 (페이지 목록은 1 쪽으로), 불러온 선택은 지금처럼 collection 의 record 들에.
- 서버 보기 (`uniqueView` — 그 collection 을 읽는 보기가 하나일 때만 서버로) 판정은 조회 단위 안에서 한다.

**가상 스크롤**: DOM 만 바뀐다 — `<Virtualizer layout={…} layoutOptions={…}>` 가 owner 를 감싼다. Canvas 는 그대로 표본 행을 엔진 배치로 그린다. 두 화면이 같으려면 `layoutOptions` 가 Canvas 가 읽는 값과 같아야 한다:

| Layout 옵션                                          | 내는 곳                                                                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gap` · `padding` · `orientation`                    | 목록 rule · 작성 layout 의 같은 값                                                                                                                                  |
| `rowSize` / `estimatedRowSize`                       | 템플릿 항목의 해석된 크기 — 방향을 따른다 (세로 목록은 높이, 가로 목록은 폭). 고정이면 `rowSize`, 내용에 따라 달라지면 `estimatedRowSize` + `shouldObserveItemSize` |
| `headingSize` · `loaderSize`                         | section Header · sentinel 의 해석된 크기 (같은 방향)                                                                                                                |
| Table `rowHeight` · `headingHeight` · `columnWidths` | Row · 머리글 행 높이와 `_tableTracks` 의 열 폭                                                                                                                      |

고를 수 있는 조건 (패널이 검사하고 이유를 알린다): 목록에 정해진 높이가 있다 (내용만큼 늘어나는 목록은 스크롤 영역이 없다) · 배치가 한 줄이거나 Table 이다 · 정적 항목과 반복 구간이 섞여도 된다 (정적 항목도 `Layout` 이 놓는다). `Virtualizer` 모듈은 가상 스크롤 목록이 있을 때만 lazy 로 싣는다. Tree · Menu · picker 안 ListBox 의 지원 여부와 grid 배치 (`GridLayout`) 는 Phase 0 에서 확인한다 (사용자 결정 7).

**구간별 source (H2)** — 지금 owner 하나를 읽는 runtime 소비자 (Phase 0 에서 전수 확정):

| 소비자                       | 자리                                                                    | 구간별로 바뀌는 것                                                    |
| ---------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 더 불러오기 sentinel         | `delegatedDom.runtime.ts:440-470` (`catalogLoadMoreItem`)               | 구간마다 하나, key = 구간 노드 id, 그 구간의 collection 을 부른다     |
| owner `loadingState`         | resolver `LOADING_STATE_TYPES` (`resolver.ts:364` · `:1817` · `:2493`)  | 모든 구간 idle → idle, 아니면 가장 앞 구간의 상태                     |
| 빈 상태                      | `delegatedDom.runtime.ts:415` (`catalogEmptyState`)                     | 정적 항목 0 + 모든 구간 0 행                                          |
| 서버 필터 · 정렬             | 세션 `serverFilterOf` (`catalogPreviewSession.ts:1564`) · `serverSort`  | 구간의 source 마다 따로 보낸다. 구간 사이 순서는 문서 순서            |
| 불러온 선택 · 선택 항목 삭제 | `catalogPreviewInteractions.ts:548` (`selectedKeysOf`) · `selectLoaded` | 이미 collection 별 — 구간의 collection 을 owner record 에 잇는 조회만 |
| 끌기 type                    | `catalogDragAndDrop.components.tsx:32`                                  | 구간의 collection 들                                                  |

세션의 cursor · 로딩 상태 · 페이지 여부는 이미 collection id 별이다 (`catalogPreviewSession.ts:492` · `:1517`). 더 보기 · 가상 스크롤에서 새로 생기는 상태는 표시 창뿐이고, 페이지 방식은 조회 단위를 따로 갖는다 (아래). 한 목록의 두 구간이 같은 collection 을 읽으면 key 가 겹치므로 §4.6 의 진단이 막는다.

## 5. 항목 type 표 (한 곳)

`COLLECTION_FAMILIES` · `COLLECTION_ITEM_OWNERS` · `CATALOG_ROW_ITEM_TYPES` · Code 보기 `itemType` · `PICKER_LIST` · `GROUP_ITEM_TYPES` 를 표 하나로 합치고 나머지는 계산한다.

| 칸                            | 뜻                                                             | 출처                                   |
| ----------------------------- | -------------------------------------------------------------- | -------------------------------------- |
| owner · list · item · section | 누가 무엇을 담는가                                             | 손 입력 (지금의 `COLLECTION_FAMILIES`) |
| key prop                      | `id` 또는 `value`                                              | 손 입력                                |
| 짝                            | Tabs 의 TabPanel                                               | 손 입력                                |
| 재귀                          | Tree                                                           | 손 입력                                |
| 코드 형태                     | `items` 를 받으면 `items` · `<Collection>`, 아니면 `array.map` | 설치본 S2 타입에서 읽는다              |
| 기능                          | `loadingState` · 더 불러오기 · 빈 상태 · DnD 지원 여부         | 설치본 S2 타입에서 읽는다              |

ADR-144 가 폐기된 이유 (한 축으로 11 컴포넌트를 묶음) 를 피하려고 family 차이를 칸으로 둔다. 「코드 형태」 · 「기능」 은 `d2S2Alignment.static.test.ts` 와 같은 방식으로 타입을 대조하고, 표에 없는 type 은 테스트가 막는다.

## 6. Code 보기가 낼 코드

| 문서                                     | 생성 코드                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| 정적 항목만                              | JSX 자식 (지금 그대로)                                                        |
| 반복 항목 하나, 정적 형제 없음, 데이터 ③ | `<ListBox items={rows}>{item => <템플릿 전체/>}</ListBox>`                    |
| 정적 형제가 있거나 데이터 ①              | 정적 자식 + `<Collection items={…}>{item => …}</Collection>`                  |
| Tabs 연결                                | `<TabList items={tabs}>` + `<Collection items={tabs}>{item => <TabPanel>…}`   |
| Table 연결                               | Column 은 JSX, `<TableBody items={rows}>{item => <Row><Cell>…</Cell>…</Row>}` |
| Tree 연결                                | `renderItem` + `<Collection items={item.children}>{renderItem}</Collection>`  |
| 그룹 (Radio 등) 연결                     | `{rows.map(item => <Radio key={…} value={…}>…)}`                              |
| 더 불러오기 · 빈 상태                    | `LoadMoreItem` · `renderEmptyState`                                           |
| 템플릿이 변수를 읽음                     | `dependencies={[변수]}`                                                       |
| Tree 를 규칙이 편집                      | `useTreeData`                                                                 |

렌더 함수 본문은 템플릿 노드 트리 그대로이고 `{필드}` 는 `{item.필드}` 가 된다.

## 7. Phase

설계 범위는 §4 ~ §6 전체다. 구현만 나눈다. 4 · 5 는 3 (`repeat` · `collectionEntries`) 에 의존하고 서로는 독립이다. 7 · 8 은 1 (더 보기 · 표시 창) 에 의존하고 3 ~ 6 과는 독립이다.

| Phase | 내용                                                                                                                                 | 주 파일                                                                                                                                                                                  | Gate |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 0     | 재현 · 기준선 · §10 해소                                                                                                             | —                                                                                                                                                                                        | G0   |
| 1     | type 표 통합 + 결함 수리 (bound Menu · CardView · SelectBoxGroup 반복, 정적 key 중복 검증, `value` 개명, 표시 방식 「더 보기」 §4.8) | `C/commands/collections.ts` · `C/resolution/resolver.ts` · `packages/shared/src/codeView/generate.ts` · `B/itemInsert.ts`                                                                | G1   |
| 2     | Tabs A2: `props.items` · 전용 목록 UI · `tabsItems.ts` 제거, Tab 삭제 · 복제 짝, contract 올림                                       | `B/itemInsert.ts` · `C/document/tabsItems.ts` · `C/commands/structure.ts` · `C/commands/collections.ts` · Tabs binding · 패널                                                            | G2   |
| 3     | `repeat`: 검증, `collectionEntries`, resolver 의 첫 항목 규칙 교체, 연결 · 해제 명령과 UI, Layers 표시, 섞인 목록 실행 규칙          | `C/document/types.ts` · `C/resolution/resolver.ts` · `B/layerTree.ts` · `B/dataBindingCommand.ts` · `C/runtime/catalogPreviewSession.ts`                                                 | G3   |
| 4     | Table Row 템플릿: 합성 행 제거, 템플릿 생성, 열-셀 맞춤, 고정 Row                                                                    | `C/resolution/resolver.ts` · `C/commands/collections.ts` · `C/runtime/tableTracks.ts` · Table DOM 렌더                                                                                   | G4   |
| 5     | 항목 자체 데이터 (①) 와 구간별 source (§4.8), 묶음 section (②), 그룹 family 연결                                                     | resolver · 연결 UI · 그룹 binding                                                                                                                                                        | G5   |
| 6     | Code 보기 (§6), `onMove` · `useTreeData`                                                                                             | `packages/shared/src/codeView/generate.ts` · `codeViewApply.ts` · `C/runtime/catalogDragAndDrop.components.tsx`                                                                          | G6   |
| 7     | 표시 방식 「페이지」: `rowDisplay`, 세션 `page`, endpoint 인자 `page` · `pageSize`, Pagination 연결 (사용자 결정 6), 패널            | `C/document/types.ts` · `C/runtime/catalogPreviewSession.ts` · `packages/shared/src/collections/executeCollectionEndpoint.ts` · `C/bindings/Pagination.binding.ts` · Pagination DOM 렌더 | G7   |
| 8     | 표시 방식 「가상 스크롤」: `Virtualizer` lazy 모듈, `layoutOptions` 를 catalog 값에서 내는 함수, 고를 수 있는 조건 검사, 패널        | `C/runtime/delegatedDom.runtime.ts` · 새 lazy 모듈 · `C/runtime/tableTracks.ts`                                                                                                          | G8   |

2 · 3 · 4 는 저장 형식을 바꾼다. 번호는 한 번만 올리는 것이 낫다 — Phase 2 에서 올리고 3 · 4 는 같은 번호 안에서 형식을 확장하되, 2 가 main 에 나간 뒤 3 · 4 가 늦어지면 다시 올린다 (사용자 결정 1 에서 같이 정한다).

각 Phase 끝에 실제 Builder 에서 한 번 조작한다. 문서 갱신 대상: `state-management.md` (§7 「첫 소유 항목을 행마다 반복」) · `catalog-subparts.md` · ADR-234 · 241 · 256 · 308 의 해당 서술 · CHANGELOG.

## 8. 측정 설계 (measurement-validity §1)

| 질문           | 답                                                                                                                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q1 측정 대상   | 합성 문서 (bound Table 3 · 8 열 × mock 100 · 1,000 행) 는 규모 전용. 분포 주장에 쓰지 않는다                                                                                                                                                           |
| Q2 불리한 경우 | 표시 창 1,000 행 (mock 상한) 의 목록 · Table DOM, 가상 스크롤에서 행 높이가 내용마다 다른 목록 · 빠른 스크롤 · breakpoint 전환 뒤 위치, 셀마다 내용 노드 (Badge · Button) 가 있는 8 열 Table, 템플릿 편집 (모든 행 재해석), breakpoint 전환, 정렬 변경 |
| Q3 대조군      | Phase 4 직전 commit 을 before arm 으로 교대 3 쌍. 호출 수가 아니라 frame 총비용과 ratchet 카운트                                                                                                                                                       |
| Q4 소비 경로   | `repeat` 를 쓰는 명령 → resolver → Canvas record · DOM 까지 실제로 닿는지 G3 의 5 개 · 같은 순서로 확인 (단위 테스트의 필드 존재가 아니라 그려진 결과)                                                                                                 |
| Q5 oracle      | Canvas = Preview 는 실제 브라우저의 DOM 순서 · 개수와 Canvas record 대조. Table 은 설치 RAC 가 낸 `tr` · `td` 수. Code 보기 왕복은 생성 → 적용 뒤 문서 diff                                                                                            |
| 측정 조건      | 사용자 Chrome CPU throttle 4x 병기, 보이는 탭, 새 프로젝트 (Library page 저장본 영향 배제)                                                                                                                                                             |

## 9. ReUI 조사 반영

ReUI 2.8.1 의 실제 기반은 Base UI · Radix 이고 RAC 가 아니다. 목적 (RAC · S2 레퍼런스 개념 활용) 의 근거로는 쓰지 않고 일반 패턴의 사례로만 봤다 (보고서 서술을 그대로 읽음 — 소스 재확인 안 함).

| 보고서 권고                           | 이 ADR                                                                                            |
| ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| A2 유지                               | 같음                                                                                              |
| 읽기 계약 공통화                      | 일부 받아들임 — 판정 함수 하나 (§4.3). 행 · 수를 담는 새 타입은 넣지 않음                         |
| 쓰기는 원본의 명령으로                | 같음. key 기준 · 섞인 목록 규칙 (§4.7)                                                            |
| Tabs 는 같은 key 로 짝                | 같음                                                                                              |
| binding 이동 · Row 템플릿은 별도 판단 | binding 은 옮기지 않음. Row 템플릿은 RAC Table 문서와 「셀을 편집할 수 없다」 (F8) 를 근거로 도입 |

이 ADR 을 뒷받침하는 사례: ComboBox 예제가 고정 항목과 데이터 Collection 을 한 목록에 둔다 (§4.4 의 `[전체, 데이터 행들]`), 그룹 예제가 바깥 행의 배열을 안쪽 Collection 에 넘긴다 (② ). 데이터 둘을 한 목록에 두는 ① 은 ReUI 에 사례가 없고 근거는 RAC 문서뿐이다.

보고서가 든 「마지막 행 도달」 은 지금 코드에서 성립하지 않았다 (본문 F14 — 리뷰 round 1 이 실행으로 확인). §4.8 로 계약을 정했다.

보고서의 회귀 항목 → Gate: 정렬 · 필터 중 쓰기 대상 일치 (G3), 삭제 뒤 `selectedKeys` 정리 (G3), section 간 key 충돌 진단 (G5), 마지막 행 도달 (G1 · G5).

## 10. 확인하지 못한 것 (Phase 0 에서 해소)

- 아무것도 실행하지 않았다 — 테스트 · 브라우저 · Code 보기 생성기.
- bound Menu · CardView · SelectBoxGroup 이 실제로 반복되지 않는지.
- section 이 있는 목록에 연결했을 때의 화면.
- ADR-284 의 묶기 결과가 어떤 행 모양으로 오는지 (§4.5 의 묶음 section).
- library Table instance 에서 `TABLE_ROWS_FROM_DATA` 가 걸리는지.
- `apps/publish` 가 같은 runtime 경로를 쓰는지.
- 「바뀌지 않은 파생 항목 객체 유지」 가 resolver · Preview 에서 지켜지는지.
- 원격 collection 의 「불러온 수」 가 전체 수 · 창과 따로 결과 트리에 실리는지.
- 조사 보고로만 읽은 자리: `C/commands/structure.ts:1379` (`dropRemovedItemKeys`) 의 동작 세부, `B/workspace.ts` 의 데이터 행 선택 → 템플릿 편집 경로, `C/runtime/catalogPreviewSession.ts` 의 load 세부, `codeViewApply.ts` 의 역방향 적용.
- `Virtualizer` 가 Tree · Menu · picker 안 ListBox 를 감쌀 수 있는지, Canvas 가 `GridLayout` 의 칸 크기를 같은 결과로 낼 수 있는지 (사용자 결정 7).
- 내용만큼 늘어나는 목록과 정해진 높이의 목록을 지금 어떻게 구분하는지 (ADR-157 표본 정책의 판정 함수).
- README 의 ADR-306 항목이 「contract 65」 라고 적고 있으나 지금 값은 66 이다 (Tabs 배열 `7f76a6ee8`) — 이 ADR 의 범위 밖, 306 착수 때 고친다.

## 11. 실행 기록

(Phase 를 닫을 때마다 적는다)
