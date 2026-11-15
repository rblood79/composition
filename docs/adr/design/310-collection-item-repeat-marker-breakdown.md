# ADR-310 breakdown — 항목 노드의 반복 표시 · Tabs 노드 정본 · bound Table Row 템플릿

> 본문: [ADR-310](../completed/310-collection-item-repeat-marker.md). 기준: main `e7e9fc035` (2026-11-14), react-aria-components 1.22.1 · react-stately 3.51.0 · @react-spectrum/s2 1.8.2, `LIBRARY_CONTRACT_VERSION` 66.
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
  - 데이터 행을 고정 항목 앞 · 뒤에 놓으면 반복 구간의 처음 · 끝으로 (사용자 결정 4 — 확정).
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

**페이지**: 원격이 아닌 목록은 이미 있는 `CollectionWindow` 계산기 (`resolveCollectionItems.ts:96-108` — 지금 연결돼 있지 않음) 로 자른다. 원격은 `ENDPOINT_LOAD_ARGUMENTS` 에 `page` · `pageSize` 를 더하고 페이지 수는 전체 수 (`totalPath`) ÷ size. endpoint 가 `page` 를 읽지 않으면 cursor 로 앞 · 뒤 이동만 (지나온 페이지는 세션이 든다). 정렬 · 필터 · `reload` 는 1 쪽으로. Pagination 의 번호 Button 은 지금 정적 노드 다섯이다 — 확정안 (사용자 결정 6, 2026-11-15) 은 번호 Button 하나를 템플릿으로 두고 페이지 수만큼 그리며 현재 쪽에 `data-current` 를 준다 (rule 에 이미 그 선택자가 있다). Canvas 는 작성된 표본 버튼을 그린다. 반복 구간이 둘 이상인 목록은 페이지를 고를 수 없다 (검증).

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

| Phase | 내용                                                                                                                                                            | 주 파일                                                                                                                                                                                  | Gate |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 0     | 재현 · 기준선 · §10 해소                                                                                                                                        | —                                                                                                                                                                                        | G0   |
| 1     | type 표 통합 + 결함 수리 (bound Menu · CardView · SelectBoxGroup 반복, 정적 key 중복 검증, `value` 개명, 표시 방식 「더 보기」 §4.8)                            | `C/commands/collections.ts` · `C/resolution/resolver.ts` · `packages/shared/src/codeView/generate.ts` · `B/itemInsert.ts`                                                                | G1   |
| 2     | Tabs A2: `props.items` · 전용 목록 UI · `tabsItems.ts` 제거, Tab 삭제 · 복제 짝, contract 올림                                                                  | `B/itemInsert.ts` · `C/document/tabsItems.ts` · `C/commands/structure.ts` · `C/commands/collections.ts` · Tabs binding · 패널                                                            | G2   |
| 3     | `repeat`: 검증, `collectionEntries`, resolver 의 첫 항목 규칙 교체, 연결 · 해제 명령과 UI, Layers 표시, 섞인 목록 실행 규칙                                     | `C/document/types.ts` · `C/resolution/resolver.ts` · `B/layerTree.ts` · `B/dataBindingCommand.ts` · `C/runtime/catalogPreviewSession.ts`                                                 | G3   |
| 4     | Table Row 템플릿: 합성 행 제거, 템플릿 생성, 열-셀 맞춤, 고정 Row                                                                                               | `C/resolution/resolver.ts` · `C/commands/collections.ts` · `C/runtime/tableTracks.ts` · Table DOM 렌더                                                                                   | G4   |
| 5     | 항목 자체 데이터 (①) 와 구간별 source (§4.8), 묶음 section (②), 그룹 family 연결                                                                                | resolver · 연결 UI · 그룹 binding                                                                                                                                                        | G5   |
| 6     | Code 보기 (§6), `onMove` · `useTreeData`                                                                                                                        | `packages/shared/src/codeView/generate.ts` · `codeViewApply.ts` · `C/runtime/catalogDragAndDrop.components.tsx`                                                                          | G6   |
| 7     | 표시 방식 「페이지」: `rowDisplay`, 세션 `page`, endpoint 인자 `page` · `pageSize`, Pagination 연결 (사용자 결정 6 확정 — 목록 참조 + 번호 Button 템플릿), 패널 | `C/document/types.ts` · `C/runtime/catalogPreviewSession.ts` · `packages/shared/src/collections/executeCollectionEndpoint.ts` · `C/bindings/Pagination.binding.ts` · Pagination DOM 렌더 | G7   |
| 8     | 표시 방식 「가상 스크롤」: `Virtualizer` lazy 모듈, `layoutOptions` 를 catalog 값에서 내는 함수, 고를 수 있는 조건 검사, 패널                                   | `C/runtime/delegatedDom.runtime.ts` · 새 lazy 모듈 · `C/runtime/tableTracks.ts`                                                                                                          | G8   |

2 · 3 · 4 는 저장 형식을 바꾼다. 번호는 한 번만 올리는 것이 낫다 — Phase 2 에서 올리고 3 · 4 는 같은 번호 안에서 형식을 확장하되, 2 가 main 에 나간 뒤 3 · 4 가 늦어지면 다시 올린다 (사용자 결정 1 확정 — 올린다. 몇 번 올릴지는 이 규칙대로 실행자가 정한다).

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

### Phase 0 — 재현 · 기준선 · §10 해소 (2026-11-15, 닫힘)

기준 HEAD `f01653b77`. 실행 근거는 Preview 통합 probe (`openAdr280Preview` — Builder workspace + Preview 세션 + RAC DOM, 임시 파일 · Phase 1 테스트로 옮기고 지움) 와 코드 읽기.

| G0 항목                                     | 결과                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bound Menu · CardView · SelectBoxGroup 반복 | **재현** — 연결 뒤에도 template 항목 수 그대로 (Menu 3 · CardView 3 · SelectBoxGroup 2, Canvas record = DOM record). RadioGroup · CheckboxGroup · ToggleButtonGroup 도 반복 없음 (Phase 5 대상). ListBox · GridList · TagGroup · Breadcrumbs · Tree · Tabs 는 반복 (Canvas 표본 3 · DOM 5). R7 (이중 반복) 없음 |
| 연결 계약                                   | CardView · SelectBoxGroup · MenuTrigger 에 `dataBinding` 계약이 없어 연결 UI 자체가 열리지 않는다 (Menu 계약은 owned Menu 노드만 — 팔레트 Menu 는 MenuTrigger instance, 안쪽 Menu 는 template 자리라 `FIELD_NOT_PATCHABLE`). F4 의 「연결 UI 에는 있다」 는 연결 대상 목록 기준이었고 실제 패널 경로는 없었다   |
| section + 연결 화면                         | ListBox 에 ListBoxSection 「+」 → 연결: DOM = 데이터 행 5 + section (정적 항목 2 그대로). 위쪽 정적 항목 2 는 사라진다 (첫 항목 규칙). section 은 반복 대상 밖이라 남는다                                                                                                                                       |
| ADR-284 묶기 행 모양                        | `groupRows` (`collections/view/evaluate.ts:498-544`) 가 그룹마다 **평평한 레코드 하나** (묶은 필드 + 집계) — section · 중첩 children 없음. 원래 행은 실리지 않는다. Phase 5 의 묶음 section (②) 은 이 모양으로는 그룹 안 행이 없다 → R8 대응 (Phase 5 에서 범위 판단)                                           |
| 번들 기준선                                 | `vite build` → `adr209-bundle-closure.mjs`: Builder initial JS gzip **1,540,940** B · Preview **152,371** B (HEAD 가 이미 ADR-201 절대 상한 1,414,000 초과 — 이 ADR 이전)                                                                                                                                       |
| ratchet 기준선                              | `pnpm gate:perf-ratchet` (5173 재사용): 측정한 시드는 A 초과 없음, **`600:scroll-boxes` 하니스 실패** (`scroll targets not scrollable: perf-seed-sl` — 코드 변경 전, 이 ADR 이전) 로 게이트가 측정 불가를 낸다. Phase 4 의 G4 는 이 시드를 뺀 결과와 Phase 4 직전 commit 대조로 판정한다                        |
| frame 기준선                                | G4 의 대조군은 Phase 4 직전 commit (§8 Q3) — Phase 0 에서 따로 재지 않음                                                                                                                                                                                                                                        |

§10 해소 (코드 읽기 — 근거 파일:라인은 조사 기록 `.agent/runs` 와 같음):

- `apps/publish` 는 같은 runtime 이다 — `apps/publish/src/catalogSession.ts` 가 `CatalogPreviewSession`, `App.tsx` 가 `CatalogPreviewView` (→ `renderCatalogDom` → `delegatedDom`).
- library Table instance 의 Row 추가는 `TABLE_ROWS_FROM_DATA` 에 걸리지 않는다 — 조건이 `owner.kind === "node" && binding` 이고 instance 의 TableBody 는 descendant 자리 (`collections.ts:1495`). 연결된 palette Table 에 Row 「+」 가 들어갈 수 있다 (Phase 4 에서 정리).
- 행이 바뀔 때 record 는 다시 만들고 `sameRecord` 로 같은 것을 남긴다 (`compositionRoot.ts:2963-2971`) — 행 key memo 는 없다.
- 원격 「불러온 수」 는 결과 트리에 따로 없다 — view meta (`session.viewResult`) 에만. `rowCount` = total ?? 길이, `rowsShown` = 창.
- `dropRemovedItemKeys` = 지운 항목의 key 를 가장 가까운 그룹의 선택 · 펼침 값에서 뺀다.
- Canvas 에서 데이터 행을 고르면 `positionOfRecord` 가 `#row:` 를 잘라 템플릿 자리를 편집한다 (`workspace.ts:1140`).
- `codeViewApply` 는 렌더 함수 본문을 해석하지 않는다 — 고치면 `notInCode` 로 거부 (Phase 6 대상).
- 높이 판정: ListBox · GridList 는 `growsWithRows` (높이 · 최대 높이를 쓰지 않음 = 내용만큼), Table 은 `heightMode === "fixed"` — 가상 스크롤의 「정해진 높이」 판정에 같은 함수를 쓴다 (Phase 8).
- `GridLayout` (react-stately 3.51.0 `private/layout/GridLayout.mjs:35-125`) 은 폭 · `minItemSize` · `minSpace` · `maxColumns` 로 열 수 (`floor(w / (min + space))`) · 칸 폭 · 가로 간격 · 가운데 여백을 정하는 닫힌 산식이다 — CSS grid 가 아니다. Canvas 가 같은 함수를 쓰면 같은 칸을 낼 수 있다 (사용자 결정 7 의 재료 — Phase 8 에서 묻는다).
- 새로 찾은 것: **SideNav** (S2 `items` 지원) 가 항목 type 목록 다섯 곳 어디에도 없다 — 연결 계약도 없다. 이 ADR 범위 밖으로 보고하고 type 표 게이트에 사유와 함께 제외로 둔다.

사용자 결정 5 확정 (2026-11-15): 번들 Δ = ADR-201 기본 — ADR 전체 Builder +4,096 · Preview +3,584 B (위 기준선 대비).

### Phase 1 — type 표 통합 + 결함 수리 + 「더 보기」 (2026-11-15)

- **type 표** (`C/document/collectionItems.ts` `COLLECTION_TYPE_TABLE`): owner · list · item · section · 짝 · 재귀 · 「+」 · 반복 · 선택 소유 · Code 보기 · 부품 · picker 칸. `COLLECTION_FAMILIES` · `COLLECTION_ITEM_OWNERS` · `CATALOG_ROW_ITEM_TYPES` · Code 보기 `itemType` (`CODE_VIEW_ITEM_TYPES`) · `PICKER_LIST` (`COLLECTION_ITEM_PARTS`) 가 표에서 계산된다 — 값은 그대로 (반복 대상만 MenuItem · Card · SelectBox 추가). 「코드 형태 · 기능」 칸의 설치 S2 타입 대조는 Code 보기를 바꾸는 Phase 6 에서 (지금 칸 `codeItems` 는 손 입력). `GROUP_ITEM_TYPES` 는 그룹 family (Phase 5) 라 표 밖에 두고 게이트가 겹치지 않음을 본다. 게이트 `C/__tests__/adr310CollectionTypeTable.static.test.ts` — catalog 계약의 모든 collection 이 표의 행 · 부품이거나 사유 있는 제외 (원복 RED: Menu 행 삭제 → 2 실패).
- **bound Menu · CardView · SelectBoxGroup 반복**: 반복 대상 추가 + 연결 계약 (`CardView` · `SelectBoxGroup` binding 의 `dataBinding`, 팔레트 Menu 의 `MENU_PROPS_SCHEMA` 에 `dataBinding` — instance 에 저장, 행이 Popover 너머 Menu 로 간다). DOM 의 더 불러오기는 MenuTrigger 너머 Menu 도 owner 로 본다 (`boundOwnerOf`). 행 글자: 원본 정의의 글자 기본값 (SelectBox `label: "Option"`) 도 표본 글자로 빼고 (`dropLiteralContent` · `templateBindings` 의 `rowStart`), Card 는 `Text[slot=title]` ← label · `Text[slot=description]` ← description (`rowLabel: "slots"`, S2 CardView 예제의 `<Text slot="title">{item.title}</Text>`).
- **정적 key 중복**: 항목 key 개명이 같은 그룹의 다른 항목 key 와 겹치면 `ITEM_KEY_TAKEN` 으로 거절 (안내 `operation.itemKeyTaken`). 복제 · 붙여넣기는 이미 새 key (`catalogCopiesWithFreshKeys`).
- **`value` 개명**: 그룹 안 Radio · Checkbox 의 `value` 편집이 그룹 값 갱신 (`catalogItemKeyRenameCommands`) 을 지난다 (Properties 의 key prop = `value`).
- **「더 보기」**: 세션이 연결된 목록마다 (collection + 연결 노드) 표시 창을 갖고 100 에서 시작한다. 목록 끝 sentinel 은 불러온 행이 창 밖에 남았거나 (`rowCount` > `rowsShown`) 다음 페이지가 있을 때 나오고, 보이면 `showMore` — 창 밖 행이 있으면 창만 늘리고, 없고 다음 cursor 가 있으면 불러온 뒤 늘린다 (cursor 가 없으면 아무것도 하지 않는다 — 늘리면 같은 sentinel 이 다시 보여 끝없이 돈다, 구현 중 실측). `reload` · 검색 글자 · 정렬은 창을 처음으로.
- 테스트: `adr310Phase1.test.tsx` 9 (원복 RED 5 — 반복 3 · 이름 2), `adr310ShowMore.test.tsx` 4 (원복 RED 3 — mock 250 ListBox · GridList, 원격 101), `adr308GroupSelection.test.tsx` 「ADR-310 Phase 1」 2, 정적 게이트 4.

### Phase 2 — Tabs 노드 정본 (A2) · contract 67 (2026-11-15)

- **배열 경로 삭제**: Tabs binding 의 `items` (items-manager) · 팔레트 `DEFAULT_TABS_ITEMS` 와 그 accepts 우회 · 「+」 의 배열 분기 (TabList → Tabs `editItems`) · resolver 의 `catalogTabsItemRows` 두 자리 · Layers 의 `tabsChanged` 재투영을 지웠다. `editItems` · ItemsManager 는 Chart 가 쓰는 공용이라 남는다. `tabsItems.ts` 는 참조 0 이 되어 삭제했다 (사용자 승인 2026-11-15).
- **원본 slot 을 Tabs 루트로**: contract 65 가 TabPanels 래퍼 (slot `Panels`) 를 없앤 뒤 놓은 Tabs 의 TabPanel 은 template 자리로 남고 Tab 만 자기 노드였다 (TabList 의 slot `Tabs`). 짝 명령이 한쪽은 노드 삭제 · 한쪽은 template 숨김을 해야 하는 비대칭이라, slot 을 Tabs 루트 template 으로 옮겼다 — 놓은 Tabs 가 TabList · Tab · TabPanel 을 모두 자기 노드로 갖는다 (ToggleButtonGroup 루트 slot 과 같은 길). 두 번째 TabPanel 에도 본문 Text (`presentWhen: nonEmptyText`) 를 두어 짝마다 모양이 같다.
- **짝 명령** (`C/commands/collections.ts` `catalogPairedTabPanels` — Tab 의 key 와 `itemId` 가 같은 TabPanel, Tabs 바로 아래 또는 작성된 TabPanels 안): `removeTargets` 가 Tab 과 함께 짝 TabPanel 을 대상에 넣고 (한 명령 · Undo 한 번), `duplicateNodes` 가 새 key 를 받은 Tab 복제본마다 짝 TabPanel 을 복제해 `itemId` 를 새 key 로 둔다. 「+」 의 짝 TabPanel 은 루트 slot 목록에 들어간다 (`collectionRootSlot`).
- **연결한 Tabs**: 소유 노드 TabPanel 의 본문 Text 는 표본 글자가 빠져 (`withoutSampleContent`) `children` 이 없다 — 행의 `content` 를 읽는 조건을 「빈 문자열 또는 없음, Text 만」 으로 넓혔다 (`rowLabelField` 에 type 인자 — TabPanel 안 다른 노드에는 닿지 않는다).
- **contract 66 → 67**: Tabs `items` 가 든 문서는 `PROP_NOT_ACCEPTED`, 그 전 번호 문서는 `UNSUPPORTED_LIBRARY_CONTRACT` (저장소 정책, 변환 없음). ADR-306 은 아직 Proposed 라 이 ADR 이 67 을 쓴다 — 306 이 나중이면 68.
- **Phase 1 회귀 2 (이번에 찾아 고침)**: ① `pickerLoading.test.tsx` 의 Select · ComboBox 「더 불러오기」 가 무한 루프 — 다음 페이지가 불러오는 중이면 `loadMore` 가 바로 돌아오는데 `showMore` 가 창을 늘리고 다시 그려 sentinel 이 곧바로 다시 호출됐다. 새 행이 들어왔을 때만 창을 늘린다. 전체 스위트가 그 파일에서 멈춰 Phase 1 의 전체 회귀 대조가 끝까지 돌지 않았던 것이 원인 (그때 실패 목록은 멈추기 전까지만). ② `propertyRacSlotVisibility` 의 SelectBoxGroup — 연결 칸이 생겨 Quick Connect host 가 필요해졌다 (Builder 는 늘 제공, 테스트 fixture 만 없었다).
- **낡은 테스트 갱신** (contract 65 · 이번 구조 반영, HEAD 에서 이미 실패하던 것): `phase4eItemInsert` 「a TabList adds a Tab with its TabPanel」 (TabPanels 래퍼 → Tabs 바로 아래) · `adr301Expansion` Tabs (S2 구조 · template 자리 0) · `phase4eComponents` (Tabs 의 TabList 는 이제 자기 노드라 slot 자리 표본에서 뺌). `phase3Presence` 4 · `resolveContainerStylesFallback` tabpanel 2 는 Tabs 칠 · rule 값 기대값이 contract 65 (다른 세션) 뒤 낡은 것으로 이 Phase 범위 밖 — HEAD 와 같은 실패.
- 번들 (G0 대비 누적): Builder +393 · Preview 0 B (Phase 1 +487 에서 배열 경로 삭제분이 빠졌다).
- **중첩 판정 유지**: 루트 slot 은 원본을 자유 내용 host 로 만든다 (Toolbar · Form · ToggleButtonGroup) — 그대로면 Tabs 가 Button 을 직계 자식으로 받는다. 루트가 RAC 필수 부품 (Tabs 의 TabList) 을 들면 slot 은 소유만 뜻하고 Tabs 는 부품 host 로 남는다 (`nestingRules.ts` `derivePartsHosts`). 루트 slot 원본 19 개 중 바뀐 것은 Tabs 하나 (실측).
- **회귀 (전체 스위트, 원복 대조)**: type-check 0 (builder · shared). shared 2,473 중 실패 10 = HEAD 와 같은 기존 실패 (중첩 판정 2 는 위 수리 뒤 통과). builder unit 9,037 중 실패 26 — 기존 실패 (`phase3Presence` 4 · `resolveContainerStylesFallback` 2 · `adr256PresentWhen` · `adr256SlotInsertOptions` · `actionIcons` · `orientationDrivenTags` · `phase4eOriginView` 1) 외 나머지는 전체 실행 부하의 5 초 시간 초과 (`adr282LibraryOriginUnlock` · `libraryPageSync` · `phase4ePalette` · `adr284Authoring` · `adr310ShowMore` …) — 7 파일을 따로 돌리면 기존 1 건만 남는다 (97/98). HEAD 에서 실패하던 Tabs 테스트 5 (`phase4eItemInsert` · `phase4eComponents` · `adr301Expansion` · `adr308CodeView` · `d2S2Alignment`) 는 통과. parity `tabsS2.browser` 33/33.
- **원복 RED 4**: ① `removeTargets` 짝 끄기 · ② `duplicatePairedPanels` 호출 삭제 → `tabsDynamicCollection` G2 테스트 실패 · ③ `rowLabelField` 본문 규칙 끄기 → 연결한 Tabs 테스트 실패 · ④ 루트 slot 예외 끄기 → `partsHosts` · `childKind` 2 실패. 전부 복원 (cmp).
- **live** (5173 새 프로젝트 `verify-adr310-p2`, Chrome MCP): Tabs 놓기 → 「+」 3/3 · Tab 복제 4/4 · 삭제 3/3 · Undo 4 → 3 → 2 — 단계마다 짝 없는 TabPanel 0, 저장 문서 contract 67 · `items` 0, 콘솔 오류 0.

### Phase 3 — 반복 표시 `repeat` (2026-11-15, 닫힘)

- **사용자 결정 2 · 3 확정** (착수 시 질문, 권고안): 2 = Design 패널 Collection 의 연결 칸 안 선택지 (고정 항목 2 개 이상일 때 「첫 항목만 템플릿으로 — 나머지 지움」 (기본) / 「모두 고정 항목으로 두고 데이터는 뒤에」) · 3 = Layers 템플릿 행의 반복 아이콘 + 「× 행 수」, Canvas 는 템플릿을 고르면 반복 행 전체 점선 외곽.
- **저장 · 검증**: `NodeEntry.repeat?: true` (contract 67 안 — Phase 2 가 main 에 나가기 전이라 같은 번호 안에서 형식 확장, §7 규칙). 형식 검증 `REPEAT_TRUE` (`validation.ts`), 의미 검증 `REPEAT_NOT_ITEM` (`CATALOG_ROW_ITEM_TYPES` 만) · `REPEAT_WITH_KEY` (같은 노드의 `binding.key` 와 함께 불가, `graph.ts`). Code 보기 대조표에 자리 (`fieldCoverage.ts` — 코드는 Phase 6).
- **resolver**: 「첫 항목 = 템플릿」 다섯 자리 (소유 노드 · 안쪽 owner 의 slot 채움 · 소유 slot 채움 · 원본 template 자리 · 빈 slot 대체) 를 `repeats(id)` 하나로 바꿨다 — 표시 없는 항목은 고정 항목으로 제자리. 원본 (library) template 자리는 반복하지 않는다 (표시를 둘 수 없다). 빈 slot 대체 (원본 첫 항목으로 반복) 는 지웠다 — 항목 없는 목록은 연결할 때 원본 항목을 소유 노드로 넣는다 (`rowTemplateInsert`, 이제 `repeat` 와 type 표의 item). 소스의 「첫 항목」 패턴 0 (grep).
- **판정 함수**: §4.3 의 `collectionEntries` 는 `catalogRowItemGroups` (`C/commands/rowTemplate.ts`) 로 구현 — 행이 닿는 항목 단계 목록 (resolver 와 같은 길: 항목 없는 부품을 지나 내려가고 Tabs 는 TabList 로도, 자기 binding 을 가진 노드에서 멈춤). 「출처 ① ② ③」 구분은 ① · ② 가 Phase 5 라 아직 없다 (③ owner 만).
- **명령**: `markRowTemplates` (연결 — template · keep, 이미 있으면 no-op) · `clearRowTemplates` (해제 — 표시만 지워 고정 항목 하나로) · `setRowTemplate` (「템플릿 바꾸기」 — 같은 단계의 표시를 옮김, Tab 은 짝 TabPanel 도, 한 명령). `catalogBindingCommand(targets, binding, newId, mode)` 와 binding 이 든 노드의 `insertNodes` 가 같은 step 에서 부른다. 패널 값 `DataBindingValue.rowTemplateMode` (문서에 저장 안 됨 — `catalogBindingRef` 가 버린다).
- **UI**: 연결 칸 선택지 (`CollectionBinding.tsx` `RowTemplateModeChoice` — RAC RadioGroup) · Layers 템플릿 행 (`CatalogLayerNode.repeat` — 아이콘 · 「× N」 · 데이터 0 행이면 × 0 (`recordDrawn`) · 데이터 행마다 행을 두지 않는다, 문서 위치 없는 Table 합성 행만 투영 행 — Table 은 Phase 4) · 템플릿 행은 데이터가 비어도 남는다 (`collectionRowHidden` 예외) · Canvas 점선 외곽 (`catalogOverlay.ts` `repeatRows`) · 우클릭 「Use as row template」 (`canvasMenu.ts` — 항목 type 만, Canvas · Layers 공용) · Layers store 가 표시 이동 · key 충돌 변화에도 다시 읽는다.
- **key 충돌 진단 (§4.6)**: 섞인 목록의 데이터 행 key 가 고정 항목 key 와 겹치면 Layers 템플릿 행에 경고 삼각형 (`boundRowsOf` `keyConflicts` — 그려진 record 의 `props.id` 로 읽어 고정 항목 key 편집이 바로 보인다; 처음엔 resolver 에 실었으나 고정 항목만 바뀐 증분 단계에서 owner record 가 다시 해석되지 않아 읽을 때 계산으로 옮김). 행을 버리거나 key 를 바꾸지 않는다.
- **섞인 목록 실행 (§4.7)**: Preview `remove` · `removeSelectedItems` 는 데이터 항목만 key 로 거른다 (`replayItemEdits`) — 고정 항목은 데이터에 없어 영향 없음 (코드 확인). 끌어 옮기기 경계 규칙 (결정 4) 은 Phase 6 (`onMove`) 와 함께.
- **낡은 테스트 갱신** (옛 규칙 = 연결 뒤 나머지 항목은 숨은 표본 · Layers 는 데이터 행 투영): `boundRowTemplate` (두 선택지 · Undo · 해제) · `phase4eBoundRows` · `phase4eLayersBoundRows` · `phase4eLayersRowSample` · `emptyStateLayersSync` · `phase4eRowSample` (빈 slot 대체 → 다시 연결하면 자기 템플릿) · `adr253PickerListBox` · `adr253SlotFill` (원본 자리는 고정) · `rowRefreshScope` (방문 상한 100 → 150 — 항목이 자기 노드라 행마다 소유 경로, 0 행 62 → 3 행 107, 형제 1,000 과 무관) · `getItem` · `rowRefreshScope` fixture 는 binding 을 문서에 직접 쓰던 것을 `insertNodes` 로. i18n 게이트 (매개변수 문구 · 우클릭 키 수 29 → 30) · Code 보기 대조표 크기 222 → 223.
- **G3 테스트** `adr310MixedList.test.tsx`: `[고정 A, 반복 B (3 행), 고정 C]` — Canvas record 5 (A · B r0 r1 r2 · C) · DOM option 5 (행 순서) · Layers A · B (× 3) · C, 「템플릿 바꾸기」 Undo · Redo, 고정 C 의 key = r2 → 템플릿 행 경고 `["r2"]` (행 5 그대로), 해제 → B 고정 항목 하나 (A · B · C).
- **원복 RED 6**: A resolver `repeats` 항상 false → 8 실패 · B `markRowTemplates` no-op → 5 · C `setRowTemplate` 가 옛 표시를 남김 → G3 · D Layers 충돌 변화 감시 끔 → G3 · E `clearRowTemplates` no-op → 2 · F 데이터 0 행에서 템플릿 행 숨김 → Layers 1. 전부 복원 (cmp).
- **회귀**: type-check 0 (shared · builder · publish). shared 2,474 중 실패 11 → Code 보기 대조표 크기 수리 뒤 기존 10. builder unit 9,039 중 실패 22 → 이번 Phase 의 새 실패 6 (Layers 기대값 4 파일 · i18n 2) 수리 뒤 따로 12/12, 나머지는 Phase 2 기록의 기존 실패 · 부하 시간 초과와 같다. (이 Phase 의 첫 재실행에서 「통과」 로 보인 Layers 파일 1 건은 suite 로드 실패 — `layerTree.ts` 의 `const node` 이중 선언을 번들러만 거부했다 — 였고 이번에 suite 로드 실패도 따로 센다.)
- **live** (5173 새 프로젝트 `verify-adr310-p3`, Chrome MCP): People 표 (3 행) · ListBox (Inbox · Starred · Archive) → Design 패널 연결 칸의 선택지 「Keep all as fixed items」 + People → Canvas Inbox · Starred · Archive · Kim · Lee · Park, Layers 고정 3 + ⟳ × 3 → Layers 우클릭 「Use as row template」 (Starred) → Canvas Inbox · Kim · Lee · Park · Archive · Archive(복제본) + 점선 외곽 → 복제본 삭제 → **Publish DOM option 5 = Inbox · Kim · Lee · Park · Archive** → Archive Item ID = p2 → 템플릿 행 경고 (행 그대로) → 연결 해제 → Inbox · Starred · Archive (고정), 저장 문서 contract 67 · `repeat` 0 · binding 0, 콘솔 오류 0.
- 번들 (G0 대비 누적): Builder +2,121 · Preview −2 B (Phase 3 만 +1,728 / −2).

### Phase 4 — bound Table Row 템플릿 (2026-11-15, 닫힘)

- **합성 행 삭제**: resolver 의 `projectTableRows` (문서 위치 없는 Row · Cell 합성 — `CATALOG_TABLE_ROW_SOURCE` · 합성 정의 id) 를 지웠다. 연결한 Table 은 Phase 3 의 반복 경로를 그대로 탄다 — `collectionItems.ts` 의 Table 항목 `Row` 가 `repeat: true`. Table 에만 남은 것은 반복 앞의 두 단계 (`boundTableRows`): 세션 `tableSort` 또는 보기 정렬로 행을 정렬 (header Column 의 key 로) · 높이 고정이면 `ceil(높이 / 최소 행 높이) + 1` 행, 아니면 표본 (`sampledRows`) 으로 자른 뒤 반복하고, 반복 뒤 (`finishBoundTable`) 에 clip · `rowCount` · `rowsShown` · 보기 정렬 표시를 싣는다.
- **템플릿 Cell 이 열을 읽는다**: 표시를 붙일 때 (`markRowTemplates` → `markTemplate`) Row 면 `fillTableTemplateCells` 가 내용 없는 Cell 에 그 열 key 의 `{key}` 를 넣는다 (이미 `{…}` 나 자식 노드가 있으면 둔다). 반복된 행의 Cell 은 `{field}` 하나뿐인 글자면 그 행 값을 `classifyTableCellDisplay` 로 표시 (목록 값 「a, b +N」 — 옛 합성 셀과 같은 글자). 열 추가 (`insertTableColumns`) 는 템플릿 Row 의 새 Cell 에 그 열의 `{key}` (`templateCell`). 행 없는 Table 의 연결은 palette Row + Cell 을 넣은 뒤 표시 (`rowTemplateInsert` Table 분기).
- **열 key 고정 (live 중 발견)**: palette Table 의 Column 은 `key` 가 없어 열 key = 라벨 소문자다. 템플릿 Cell 이 `{type}` 을 적은 뒤 라벨만 「Role」 로 바꾸면 Cell 은 type 을 읽는데 header 의 정렬 key 는 `role` 이 되어 그 열 정렬이 듣지 않는다 (옛 합성 행은 라벨 편집이 곧 필드 변경이라 칸이 비었다). 표시를 붙일 때 key 없는 Column 에 지금 key 를 적는다 (`fillTableTemplateCells`). key 자체를 바꾸는 쓰기는 템플릿 Cell 이 따라간다 (`renameTableColumnField` — Cell 글자가 정확히 `{옛 key}` 일 때만, Properties 쓰기 경로에 동반 명령 `catalogColumnKeyRenameCommands`; 지금 Column `key` 를 편집하는 패널 칸은 없다 — Code 보기 적용 (Phase 6) 등 명령 경로 대비).
- **고정 Row**: `insertTableRow` 의 `TABLE_ROWS_FROM_DATA` 거절을 지웠다 — 연결한 Table 도 템플릿 옆에 합계 행 같은 고정 Row 를 받는다 (반복 행 뒤 · 앞 제자리). 원래 거절은 node Table 에서만 걸렸다 (palette instance 는 owner 가 template 위치라 지나감 — §10 의 해소 내용).
- **DOM · 증분 경로 수리 2**: ① 반복 행의 record 가 템플릿의 자동 HTML id 를 물려받아 RAC Table 이 Cell id 를 collection key 로 써 「Duplicate key」 — 반복된 행 (`#row:` id) 은 저작 id 를 받지 않는다 (`domBinding.runtime.ts` `rowCopy`, 첫 행은 템플릿 identity 라 그대로). ② 첫 데이터 행이 템플릿 요소를 재사용해 id 가 바뀌면 RAC 가 「Cannot change the id of an item」 — Row 를 `itemKey` 대상에 넣어 id 가 바뀌면 다시 mount. ③ 템플릿 Cell 에 노드 (Badge) 를 넣으면 구조 증분 영역이 반복 행 안 record 를 골라 `RESOLVED_REGION_MISSING` — 영역 후보를 `#row:` 밖 owner 로 올린다 (`compositionRoot.ts`, `planBindingOwners` 와 같은 규칙).
- **Layers**: 합성 행 전용 투영 (`CatalogLayerNode.projection` · `selects`, 「+N more」 선택 우회) 을 지웠다 — Table 도 템플릿 행 하나 + 「× 행 수」 (Phase 3 의 공통 경로, 행 수 = 그려진 행).
- **contract**: 67 그대로 (올리지 않음). Phase 2 · 3 의 67 이 오늘 main 에 나갔지만 Phase 4 는 형식 필드를 늘리지 않는다 (`repeat` 는 Phase 3) — 바뀐 것은 Table Row 에 `repeat` 를 쓰는 명령뿐이고, 옛 bound Table (합성 행) 문서는 검증 프로젝트에만 있다 (개발 단계 — 마이그레이션 없음, 메모리 `feedback-no-document-migration-code-dev-stage`). 68 은 ADR-306 몫.
- **G4 테스트** `adr310TableTemplate.test.tsx` (5): 3 열 Table 연결 → Row 1 (repeat) · Cell 3 `{name}` `{type}` `{status}`, 저장 노드 수가 0 · 100 · 1,000 행에서 같음 (높이 400 → 14 행) · 템플릿 Cell 의 Badge `{status}` 가 모든 행에 · 열 추가 → 템플릿 Cell `{owner}` · 고정 Row 「Total」 이 데이터 뒤 (DOM `role="row"` 5) · 해제 → 템플릿 고정 · 연결이 Column key 를 고정 (라벨 편집 뒤에도 Cell · key 그대로) · 행 없는 Table 연결 → `{key}` Cell Row.
- **낡은 테스트 갱신** (옛 규칙 = 합성 행 · 거절): `adr256TableNodeTree` (bound body 가 고정 행을 받는다) · `adr277TableOrigin` (연결 → 빈 Cell 이 열 key 를 읽음, 해제 → `{name}` … 고정) · `phase4eTableRows` (key 편집 = `setFields` + 동반 명령) · `adr257TableOperations` (같은 동반) · `phase4eLayersBoundRows` · `phase4eLayersRowSample` (Table 도 `Row` repeat × 100) · `adr310CollectionTypeTable.static` (항목 목록에 Row).
- **원복 RED 11**: A Table 항목 repeat false → 15 실패 · B `fillTableTemplateCells` no-op → 5 · C 열 추가 Cell 이 key 를 안 읽음 → 4 · D 반복 행 안 영역 올리기 끔 → 1 · E 반복 행이 저작 id 유지 → 8 (RAC 행동 parity 포함) · F Row 를 `itemKey` 에서 뺌 → 7 · G key 개명 no-op → 2 · H 정렬 건너뜀 → 1 · I 빈 Table 에 Row 안 넣음 → 1 · J `TABLE_ROWS_FROM_DATA` 복원 → `adr256TableNodeTree` 1 (G4 묶음 4 파일은 palette instance 라 GREEN — 거절이 node Table 에서만 걸리던 사실과 같다) · K Column key 고정 끔 → 1. 전부 복원 (cmp).
- **회귀**: type-check 0 (6/6). builder 전체 — Phase 4 로 생긴 새 실패 24 를 위 갱신 · 수리 2 (DOM key · id 변경) 로 0, Table 을 언급하는 unit 43 파일 885 중 실패 1 = Phase 3 기록의 기존 실패 (`phase4eOriginView`). shared — Table 관련 68 파일 중 실패 7 파일 = 기존 실패 목록과 같음. stale-symbols 게이트 0.
- **성능** (Q3 대조군 = Phase 4 직전 `02eb776c5` worktree):
  - jsdom + node 엔진 교대 3 쌍, bound Table 3 열 × mock 100 · 1,000 행, 높이 고정 · auto. 그려진 record 수 같음 (고정 138 · auto 426). 연결 ms before 7.7 ~ 23 / after 7.7 ~ 26, Table 편집 중앙값 6.4 ~ 14.8 / 6.4 ~ 14.4, 데이터 새로고침 중앙값 3.8 ~ 7.3 / 3.7 ~ 7.4 — 모두 쌍 사이 흔들림 안.
  - ratchet (`600:scroll-boxes` 제외 12 seed, 같은 동시 실행 3): 작업 트리 A 초과 433 · 직전 커밋 432 — 기준 (11-13 `cddbad466`) 이후 다른 커밋들의 drift 이고 Phase 4 이전부터다. 유일한 차이 `60:app-pages-images` edit `domMutations` (첫 측정 57 → 97) 는 재측정에서 직전 커밋도 91 ~ 97 · Phase 4 를 얹은 worktree 97 ~ 99 로 겹쳐 측정 편차 (React 렌더 수 같음).
- **번들** (G0 대비 누적): Builder +2,220 · Preview +0 B (Phase 4 만 +99 / +2). 예산 +4,096 / +3,584 안.
- **live** (5173 새 프로젝트 `verify-adr310-p4`, Chrome MCP): People310 (3 행) + palette Table → Design 패널 데이터 소스 People310 → Canvas Kim · Lee · Park, 패널 항목 필드 `{name}` `{type}` `{status}` · Layers `⟳ Row × 3` → 템플릿 Status Cell 에 Badge `{status}` → 세 행 모두 Badge (Active · Away · Active) → 고정 Row 「Total」 이 데이터 뒤 → 열 Owner 추가 → 템플릿 Cell `{owner}` · Total 행 빈 Cell → 두 번째 Table 을 패널로 연결 (Column key name · type · status 고정 확인) → Properties 에서 Type 열 라벨 「Role」 → key type 그대로 · 칸 Admin · Editor · Viewer → Publish DOM 행 5 · 4 · Badge 3 (콘솔 오류 0) → 첫 Table 패널 연결 해제 → `repeat` 0 · 템플릿이 고정 행 → 새로고침 hydration 같은 화면 (contract 67 · repeat 1 · binding 1, 콘솔 오류 0).

### Phase 5 — 항목 자체 데이터 · 구간별 source · 묶음 section · 그룹 연결 (2026-11-15, 닫힘)

- **데이터 위치 한 함수** (Decision 2): resolver `repeatRows` 가 반복 항목 · section 의 행을 ① 자기 `binding` (key 없음) → ② 반복 중인 바깥 행의 하위 행 (`CatalogBoundRow.children` — binding 의 `fieldMap.children`) → ③ owner 의 행 순으로 읽는다. Phase 3 의 네 반복 자리 (소유 노드 · 프로젝트 template 자리 · 안쪽 owner 의 slot 채움 · 소유 slot 채움) 가 모두 이 함수를 지나고, owner 에 행이 없어도 ① 구간은 반복된다. ① 로 반복된 노드 자신은 그 binding 을 목록으로 다시 읽지 않는다 (`nodeBinding` · template `ownBinding` 에서 뺌). 정적 section 은 owner 의 행을 받아 안의 반복 항목이 ③ 으로도 읽는다. `repeat` 를 붙일 수 있는 type 에 section 3 · 그룹 항목 4 를 더했다 (`CATALOG_REPEAT_TYPES` — 검증 `REPEAT_NOT_ITEM`).
- **연결 명령**: `catalogBindingCommand` 의 대상이 항목 · section type 이면 그 노드의 `repeat` 만 켜고 끈다 (`setOwnRows`) — section 이면 안의 첫 항목을 ② 템플릿으로 (`markRowTemplates`). owner 쪽 명령 (`catalogHasRowTemplate` · `catalogStaticItemCount` · `markRowTemplates` · `clearRowTemplates` · `setRowTemplate`) 은 자기 데이터 구간을 빼고 본다 (`ownerItemGroups`) — 목록을 「첫 항목만」 으로 연결해도 ① 구간은 지워지지 않는다.
- **연결 계약**: 항목 6 (ListBoxItem · GridListItem · Tag · Breadcrumb · Card · SelectBox) · section 3 · 그룹 4 (RadioGroup · CheckboxGroup · ToggleButtonGroup · SegmentedControl) binding 에 `dataBinding` (`ITEM_DATA_BINDING_PROP`, D2 출처 composition — 기존 `dataBinding` 과 같은 키). section 의 연결 칸은 「하위 항목 필드」 (`fieldMap.children`) 를 Tree 처럼 연다.
- **구간별 source** (Decision 11 · §4.8 H2 표): ① 구간마다 그 구간 바로 뒤에 자기 `LoadMoreItem` (`catalogRenderRuns` — ListBox · GridList · Menu · CardView, key `__load-more:<항목>`, 표시 창 key = 항목 id, 스피너는 그 collection 의 로딩 — 세션 `loadingStateOf` 를 DOM 입력 `loadingOf` 로) · owner 의 ③ sentinel 은 지금처럼 목록 끝. 연결 없는 목록의 `loadingState` 는 구간들의 것 (모두 idle → idle, 아니면 처음 도는 구간 — `runsLoadingState`) · 빈 상태는 RAC `renderEmptyState` 가 항목 0 일 때 그대로. 불러온 선택 (`selectLoaded`) 은 구간 record 에서 가장 가까운 목록 owner (picker 안 ListBox 면 그 picker) 로 올라간다. 행 갱신 영역은 구간 항목이 아니라 그 목록 (`planBindingOwners` — 행 0 개 구간은 record 가 없어 처음엔 다시 해석되지 않았다, 구현 중 실측).
- **② 묶음 section**: section 을 하위 행이 있는 데이터에 연결하면 묶음마다 section, 안의 항목은 묶음의 하위 행마다. 중첩 반복의 record 행 key 는 바깥 key 와 합친다 (`withRowKey` — `g2/g2b`; 전에는 바깥 key 가 덮어 한 묶음의 둘째 항목부터 record 가 겹쳤다 — 원복 C). **R8 범위 축소**: ADR-284 묶기 (`groupRows`) 결과는 묶음마다 평평한 레코드 하나라 하위 행이 없다 — 묶음 section 의 데이터는 하위 행 필드를 가진 데이터만이고, 보기의 묶기 결과를 section 으로 펼치는 것은 이 ADR 밖 (284 후속).
- **그룹 연결** (§4.5): 그룹 항목은 그 그룹 owner 아래에서만 행 항목이다 (`GROUP_REPEAT_ITEMS` — `CATALOG_ROW_ITEM_TYPES` 에 넣으면 Table 머리글 · Card 안 Checkbox 까지 템플릿 후보가 된다). 행 시작에서 Radio · Checkbox 는 `value`, ToggleButton · SegmentedControlItem 은 `id` 가 행 key, 글자 (`children` · `label`) 가 표본이면 행 label (`keyRowItem`).
- **Layers · 배지**: 「× N」 은 구간마다 자기 그려진 행 수 (표본 밖 나머지는 ③ 구간 몫) · key 경고는 고정 항목과 겹침에 더해 구간 사이 겹침도 · 데이터 연결 배지는 ① 구간의 첫 행에만 (live 에서 행마다 셋이 행 글자를 가렸다 — `repeatsOwnRows`).
- **미룬 것** (재현 시나리오 없음 · 다음 Phase 와 함께): section 안 구간의 sentinel 은 목록 끝에 둔다 (section 은 RAC 일반 경로가 그린다 — 각자 자기 source 를 부르는 것은 같다) · 서버 검색 글자 (`setFilterText`) 는 owner collection 만 (RAC 의 클라이언트 거르기는 모든 항목에 걸린다) · 끌기 type 의 구간별 판정은 사용자 결정 4 와 함께 Phase 6 · MenuItem · TreeItem · Tab · Row 의 ① 연결 칸 (MenuItem 은 binding 파일이 없다) · 그룹 항목의 우클릭 「Use as row template」.
- **G5 테스트**: `adr310OwnRows.test.tsx` 7 — ① `[고정 A, B over People, C over Teams]` Canvas record · DOM option 순서 · key 한 번씩 · Layers × 3 · × 2 · C 를 People 로 바꾸면 경고 `p1 p2 p3` (행 7 그대로) · B 해제 → 고정 · section 둘이 서로 다른 데이터 · ② 묶음 section (묶음 2 · 하위 행 4, record 4) · 그룹 4 종 Canvas 행 = DOM (Radio · Checkbox `value` p1 ~ p3). `adr310Runs.test.tsx` 1 — 원격 source 둘 (각 2 쪽) 을 한 목록에: 두 sentinel 이 `/people?page=2` · `/teams?page=2` 를 각자 부르고 Person4 · Team4 가 DOM 에 구간 순서대로.
- **원복 RED 9**: A ① 끔 → 3 · B ② 끔 → 1 · C 행 key 합성 끔 → 1 · D 구간 sentinel 끔 → 원격 1 · E 갱신 영역 올리기 끔 → 원격 1 · F 그룹 key · 글자 끔 → 3 (ToggleButton 은 템플릿 `{label}` 로 이미 읽음) · G 그룹 항목 판정 끔 → 4 · H Layers 구간별 수 끔 → 1 · I 구간 사이 key 경고 끔 → 1. 전부 복원 (cmp).
- **회귀**: type-check 0 (6/6). shared 2,474 중 실패 10 = Phase 2 · 3 기록의 기존 실패 (Tabs · Separator · Toast rule 값 기대 — contract 65 뒤 낡음). builder unit 9,052 중 실패 13 = 기존 7 파일 (`phase3Presence` 4 · `resolveContainerStylesFallback` 2 · `adr256PresentWhen` · `adr256SlotInsertOptions` · `actionIcons` · `orientationDrivenTags` · `phase4eOriginView`) + 부하 시간 초과 (따로 돌리면 `phase4eOriginView` 기존 1 만). 스위트 뒤 고친 Layers · 연결 칸 · 배지 관련 29 파일 209 중 실패 1 (같은 기존). stale-symbols 0.
- **성능** (ratchet, `600:scroll-boxes` 제외 12 seed · 동시 실행 3 — Phase 4 와 같은 스크립트): 작업 트리 A 초과 432 · Phase 4 측정 (지금 HEAD 와 같은 코드) 433 — 새 초과 지표 0, 빠진 1 은 Phase 4 에서 측정 편차로 판정한 `domMutations.attributes`. 같은 지표 중 늘어난 것은 선택 seed 의 library 정의 조회 (`graph.ts#get library` · `library.ts#get`) +45 (+2.5 %, `select` · `select-spread` 둘 다 같은 수 — 결정적). 선택한 항목의 Design 패널에 새로 생긴 연결 칸이 원인으로 보이나 호출자는 확인하지 않았다. 대조군은 같은 시점 worktree 가 아니라 Phase 4 의 같은 커밋 측정 (몇 시간 차이 · 같은 기기) — 측정 편차가 시점에 따라 바뀔 수 있어 약한 대조다. `pnpm gate:perf-ratchet` 자체는 push 대상 commit 을 재고 `600:scroll-boxes` 하니스 실패 (Phase 0 기록, 이 ADR 이전) 로 판정 전에 멈춘다.
- **번들** (G0 대비 누적): Builder +3,399 · Preview +0 B (Phase 5 만 +1,179 / 0). 예산 +4,096 / +3,584 안 — Builder 는 남은 Phase 6 ~ 8 에 697 B.
- **live** (5173 새 프로젝트 `verify-adr310-p5`, Chrome MCP): Data 패널 붙여넣기로 People (3) · Teams (2) → palette ListBox (Inbox · Starred · Archive) → Starred 를 Layers 에서 골라 Design 패널 Collection 의 데이터 소스 People → Canvas Inbox · Kim · Lee · Park · Archive, Layers `⟳ × 3` (배지가 행마다 셋 붙어 고침 → 첫 행 하나) → 새로고침 뒤 그대로 → Archive 를 Teams → Canvas Inbox · Kim · Lee · Park · Design · Sales, Layers 고정 · `⟳ × 3` · `⟳ × 2` → palette RadioGroup (Option 1 · 2) 을 Teams 에 → Canvas Radio Design · Sales, 값 칸 Design · Sales → Publish DOM option 6 (inbox · p1 · p2 · p3 · t1 · t2) · Radio 2 (value t1 · t2) · Sales 누르면 선택 → Starred 연결 해제 → 고정 항목 (설명 글자 돌아옴), Teams 구간 그대로 → 새로고침: 저장 문서 Archive `repeat` + Teams binding · RadioGroup Teams + Radio `repeat`, record 고정 2 + 행 2 · Radio 행 2. 콘솔 오류 0 (Builder · Publish).

### Phase 6 — Code 보기 (§6) · `onMove` · `useTreeData` · 섞인 목록 끌기 (2026-11-15, 닫힘)

- **렌더 함수 = 템플릿 트리** (§6): 반복 항목 (`repeat`) 은 그 행의 렌더 함수로 나온다 — 본문은 템플릿 노드 트리 그대로이고 `{필드}` 는 `item.필드`, 항목 key prop 은 행 key (`id={item.id}` · Radio · Checkbox `value` · TabPanel `itemId`), collection 항목은 `textValue` (첫 글자 필드). 행 템플릿의 표본 글자 (리터럴 `children` · `label` …) 는 resolver 와 같이 빼고 (`withoutSampleContent`), 그룹 항목 글자는 행 label (`keyRowItem`). 형태 — 부품이 `items` 를 받고 (`CODE_VIEW_ITEMS_HOSTS` — 설치 RAC · S2 타입의 `items` 와 대조하는 정적 게이트 `adr310ItemsHosts.static.test.ts`) 항목이 템플릿 하나뿐이면 `<ListBox items={users}>{item => …}` · `<TabList items={…}>`, 고정 항목 옆 · ① 구간 · Table 의 Rows 자리 · TagGroup 은 그 자리에 `<Collection items={…}>`, Tabs 의 TabPanel 도 `<Collection>`, RAC 그룹 (Radio 등) 은 collection 이 아니라 `{users.map(item => <Radio key value>…)}`, 하위 행을 읽는 Tree 는 `{function renderItem(item) { … <Collection items={item.kids}>{renderItem}</Collection> … }}` (표본 하위 TreeItem 은 뺀다). 템플릿이 없는 연결 목록 (코드로 새로 쓴 목록) 은 지금 모양 그대로.
- **`useTreeData`**: 규칙이 편집하는 (`useListData` 였던) collection 을 하위 행 필드로 읽는 Tree 가 있으면 `useTreeData({initialItems, getKey, getChildren})` 로 쓰고 렌더 함수는 node 의 `item.value.필드` · `item.key` · `item.children` 을 읽는다. 평면 행 (`fieldMap.parentId`) Tree 는 `useListData` 그대로 (미룸 — 평면 → 중첩 변환 코드를 내지 않는다).
- **다시 읽기** (G6): 렌더 함수 본문은 읽기 전용 — 고치면 `notInCode` (G6 실패 대안 「왕복되지 않는 형태는 읽기 전용」). `<Collection>` · `map` 은 반복 항목 노드다 (anchor = 그 노드) — 다른 줄을 고쳐도 남고, 고정 항목 앞으로 옮기면 그 노드가 옮겨진다. `items` 의 binding 주인은 가장 가까운 연결 owner (① 은 자기 — `bindingHolder`), 목록 부품 (TableBody · TabList · TagList) 도 owner 의 것. 코드가 새로 쓴 `<Collection>` · `map` 은 거절한다 — 본문을 노드로 만들 수 없고, 기본 템플릿으로 바꿔 넣으면 쓴 본문이 조용히 사라진다 (구현 중 그렇게 만들었다가 원복 RED 가 어떤 테스트도 지나지 않음을 보여 거절로 바꿈 — 재생성 비교도 같은 줄을 거절한다). 새 목록은 `items` + 렌더 함수로 쓴다 — 그 렌더 함수는 비교하지 않는다 (label 필드만 읽음 — 이전과 같음). parse 는 `{function …}` 렌더 함수와 `{rows.map(item => …)}` 를 받는다 (`map` 원소).
- **식별 (identity) 수리 2** — 연결 Table 이 열을 코드에 내자 드러난 기존 결함: ① 한 hunk 안 짝짓기에서 부모의 자식을 `Slot` 을 건너 보지 않아 instance 위치의 자식이 늘 지워지고 다시 만들어졌다 (`kids`) · 같은 type 형제 여럿은 태그의 `key="…"` · `id="…"` 가 하나씩 맞을 때 그 노드로 (세 Column 의 줄을 고쳐도 같은 노드) · hunk 의 새 원소는 그 hunk 의 글자 안에 있는 것만 · ② 편집기가 여는 태그 줄을 바꾸면 (`<Table>` → `<Table sortDescriptor…>`) span 시작이 바뀐 줄의 끝으로 옮겨져 그 원소가 지워지고 다시 만들어졌다 — 같은 열 위치로 옮긴다 (그 자리에 같은 태그가 있을 때만 짝). ADR-285 G3 「정렬 따라가기」 (패널 · snippet) 가 이 둘로 깨졌다가 통과.
- **`onMove`** (§4.7): `COLLECTION_DRAG_DROP_EVENTS` 에 RAC `onMove` (항목 위 drop 포함, Tree 의 새 부모) — When 라벨 · Code 보기 `useDragAndDrop` · Preview `dragAndDropHooks`. move Do 의 놓은 쪽 `on` = 그 항목의 마지막 자식 (`useTreeData.move(key, target, index)` — dispatcher 가 `{index: MAX}` + 부모, 세션 move 가 끝에 둔다). 다른 쪽 값은 지금처럼 거절.
- **섞인 목록 끌기** (사용자 결정 4 — 확정): Preview 끌기 모듈이 목록의 항목을 순서대로 받는다 (`CatalogDragItems` — record 가 행이면 그 구간의 type, 고정 항목은 없음). 고정 항목은 데이터가 아니다 — 끌어도 key 가 빠지고 그것만이면 규칙이 돌지 않는다. 고정 항목 앞 · 뒤에 놓은 행은 그 구간의 처음 (`before` 첫 행) · 끝 (`after` 앞 구간의 마지막 행) 으로 target 이 바뀐다 (`onReorder` · `onMove` · `onInsert` · `onItemDrop`). **구간별 끌기 type**: 행마다 자기 구간 collection 의 type 을 싣고 (`getItems`), 순서를 바꾸는 목록은 자기 구간들의 type 을 받는다.
- **G6 테스트**: `adr310CodeView.test.tsx` 6 — 여섯 family (ListBox · Table · Tabs · Tree · RadioGroup · TagGroup) 의 렌더 본문 · 그대로 적용 = 변화 0 · 하위 행 Tree 의 `renderItem` · 섞인 목록 (① 구간) 의 `<Collection>` 자리 · 옆 편집에도 구간 · binding 유지 · 본문 수정 거절 · 고정 항목 앞으로 옮기면 그 노드가 첫째 (한 step) · ③ 「모두 고정」 목록의 `<Collection>` 옆 편집 뒤 binding 은 목록 것 · 그룹 `map` · Tree `renderItem` 옆 편집에 반복 항목 유지 · `useTreeData` + `onMove` 코드. `adr310Drag.test.tsx` 3 — 결정 4 경계 (people · teams 두 구간, 고정 셋) · 고정 key 제외 · 구간별 type · `onMove` 의 `on`. `adr284Drop.test.ts` 의 「`on` 은 규칙을 멈춘다」 기대를 「마지막 자식으로」 로 바꿈 (의도된 동작 변경). `adr310ItemsHosts.static.test.ts` 1.
- **golden 갱신**: ADR-284 acceptance 6 (emoji · ios-list · kanban · orders · photos · plants) · 291 orders — 연결 목록의 합성 한 줄이 템플릿 렌더 함수로, plants 의 Table 이 열 · `<Collection>` 행으로.
- **원복 RED** (`red6/run.py` — bash 아닌 python, 백업 + cmp 복원): A `items` 축약 끔 → 3 · B 표본 글자 남김 → 1 · C binding 주인 끔 → 2 · D `map` 파싱 끔 → 1 · E `function` 렌더 끔 → 2 · F `Slot` 건넌 짝짓기 끔 → ADR-285 1 · G 여는 줄 열 위치 끔 → ADR-285 1 · H key 짝짓기 끔 → ADR-285 2 · J 경계 target 끔 → 1 · K 고정 key 남김 → 1 · L 구간별 type 끔 → 1 · M `onMove` 끔 → 1 · N `useTreeData` 끔 → 1 · O 놓은 쪽 `on` 끔 → shared 1. 14 반응. 새 `<Collection>` 거절 (I) 은 재생성 비교가 같은 줄을 먼저 거절해 반응 없음 — 이중 방어로 둔다. 전부 복원 (cmp).
- **회귀 수리 (구현 중)**: 끌기 항목을 record 의 `#row:` 로 데이터 행인지 가르자 첫 행 (템플릿 자신의 record) 이 고정 항목으로 보여 실제 RAC 끌기 reorder 7 테스트 (`racBehaviorParity` 3 · `interactionWhenReach` 4) 가 깨졌다 → 반복 노드 (`repeat`) 의 record 인지로 판정 · 반복 항목이 없는 목록은 순서를 주지 않는다. When 감사 표에 `onMove` 4 행 (실제 RAC drag 로 「on」 drop — 264 통과).
- **회귀**: type-check 0 (6/6). builder 9,067 중 실패 16 → 따로 돌린 3 파일 (`existingComponentContracts` · `phase4ePalette` · `adr284Authoring`) 73 통과 = 부하 시간 초과, 남은 11 = Phase 5 기록의 기존 7 파일. shared 2,474 중 실패 18 → Code 보기 판정 2 파일 (`inverseParse` 6 · `equivalence` 2) 은 새 모양에 맞춰 고침 — 파싱 테스트의 원소 수 계산이 렌더 함수 본문의 원소를 빼고, ADR-284 판정 스크립트 (`scripts/code-view-equivalence.mjs`) 가 `<Collection items>` 를 가장 가까운 목록의 `items` 로 · `item.album` 의 속성 이름을 상태 `album` 으로 세지 않게 (5 예제 모두 같은 사실). 남은 10 = 기존 (Phase 5 와 같은 수).
- **번들** (G0 대비 누적): Builder +3,493 · Preview −2 B (Phase 6 만 +94 / −2 — Code 보기 · 끌기 모듈은 lazy). 예산 +4,096 / +3,584 안 — Builder 는 남은 Phase 7 · 8 에 603 B.
- **성능**: ratchet 측정 생략 — 바뀐 경로가 Code 보기 (lazy, 패널을 열 때) · 끌기 모듈 (lazy, 끌기 규칙이 있는 목록만) · dispatcher 의 move 분기라 ratchet seed (선택 · 스크롤 · 편집 · breakpoint) 가 지나지 않는다.
- **live** (5173 `verify-adr310-p5` — Phase 5 의 [Inbox, Starred, Teams 구간] ListBox + Teams RadioGroup, Chrome MCP): Code 패널 `pages/Home.tsx` 에 `<Collection items={teams}>{item => (<ListBoxItem id={item.id} textValue={String(item.label)} />)}</Collection>` · `{teams.map(item => (<Radio key={item.id} value={item.id} …>{`${item?.label ?? ''}`}</Radio>))}` → `<Collection>` 블록을 Inbox 앞으로 옮겨 「적용」 → 「문서에 1 곳을 반영했습니다」 · Canvas Design · Sales · Inbox · Starred → 새로고침 뒤 같은 순서 · 코드 첫 자식 `<Collection>` → 렌더 본문 `textValue` 를 고쳐 적용 → 「아래 줄 때문에 아무것도 적용하지 않았습니다 … 12 줄 — 문서로 옮겨지지 않는 부분」 (거절). 콘솔 오류 0 (새로고침 뒤 수집). 끌기 (`onMove` · 경계) 는 jsdom 의 실제 RAC drag 이벤트로 확인 (live 생략).
- **미룬 것**: 평면 행 Tree 의 `useTreeData` · 템플릿이 변수를 읽을 때 `dependencies` · 빈 상태 `renderEmptyState` · `LoadMoreItem` 의 코드 (Preview 는 이미 그린다) · Code 보기 DnD 블록의 구간별 type (Preview 는 구간별) · 렌더 본문 편집 (읽기 전용).

### Phase 7 — 표시 방식 「페이지」 · Pagination 연결 · 조회 단위 (2026-11-15, 닫힘)

- **저장**: `NodeEntry.rowDisplay?: { mode: "more" | "pages" | "virtual"; size?: 1 ~ 1,000 }` (없으면 「더 보기」 100 — `catalogRowDisplaySize`) · `NodeEntry.pagesOf?: NodeId` (Pagination → 목록, 사용자 결정 6 — 참조가 끊기면 연결 없음). 형식 검증 `ROW_DISPLAY` (방식 · 크기) · id 형식. contract 67 안의 선택 필드 (그 전 문서는 그대로 열린다). Code 보기 대조표에는 「Design 패널 · Preview 실행 상태」 로 둔다 (`notInCode`).
- **명령**: `setRowDisplay(id, display)` · `setPagination(paginationId, listId)` — 연결은 `pagesOf` 와 함께 Pagination 의 번호 묶음 (원본의 Pages ToggleButtonGroup) 에서 첫 번호 Button 을 템플릿 (`repeat`) 으로 두고 나머지 번호를 지운다 (`markRowTemplates` — Phase 5 의 그룹 반복), 해제는 표시만 지운다. 각각 한 step (Undo 로 되돌아감).
- **resolver**: 반복 항목의 행 출처에 넷째 — 가장 가까운 `pagesOf` 조상의 쪽 행 (`paginationRows` — `id` = `label` = 번호, 쪽 수를 모르면 0 행). 번호 묶음의 `selectedKeys` 는 지금 쪽 (`defaultSelectedKeys` 를 지움). 출처는 row source 의 `pages` 속성 — Builder 에는 없어 Canvas 는 작성 표본 (템플릿 하나) 을 그린다. composition root 의 rows 감싸개가 그 속성을 넘긴다 (빠뜨리면 번호가 하나 — 구현 중 실측).
- **세션** (Decision 12): 쪽 목록마다 조회 단위 (`pageUnits` — key = collection + 목록 노드, 표시 창 key 와 같다). 로컬 collection 은 `[(page − 1) × size, page × size)` 를 자른다 (`catalogBoundRows` 의 `start` — 전체 수 `total` 을 함께 실어 쪽 수). 원격 collection 은 단위가 자기 요청 (`loadPageUnit` — `page` · `pageSize` 인자, `ENDPOINT_LOAD_ARGUMENTS` 에 추가, 단위별 `AbortController`) 으로 받은 항목을 그 목록에만 쓴다 — collection 의 불러온 항목 (「더 보기」 목록이 읽는 것) 은 그대로, 편집 기록은 collection 의 것을 단위 항목 위에 다시 적용. endpoint 가 `{{ page }}` 를 읽지 않으면 쪽 수 없이 cursor 로 앞 · 뒤만 (`cursors[n]`). `reload` (원격 정렬 · 검색 포함) 는 원격 쪽 목록을 1 쪽으로, 로컬 목록은 질의 (보기 · 정렬) 가 바뀌면 1 쪽으로 (`pageRows` 가 질의를 기억). 쪽이 바뀌면 그 collection 의 목록과 그 목록의 Pagination 을 다시 해석한다 (`refreshNodes` — composition root 에 추가).
- **DOM**: 연결된 Pagination 의 `<nav>` 가 클릭을 capture 로 받는다 (RAC `usePress` 가 버튼에서 클릭을 멈춘다 — bubble 은 원복 RED F) — `CatalogPreviewInteractions.paginationClick`: 첫 자식 = 이전 쪽, 마지막 자식 = 다음 쪽, 번호 묶음의 Button = 그 쪽 (`goToPage`). runtime 연결: `domView.runtime` (`pageOf` · `goToPage`) → 상호작용 → DOM 입력 `paginationClick`.
- **패널**: Design 패널 Collection 의 데이터 소스 아래 「행 표시」 (끝에서 더 보기 / 페이지) · 「쪽당 행 수」 (기본 20) · 페이지 이동 (그 page 의 Pagination 고르기 · 없음) — 목록 owner type 에서만 (`COLLECTION_TYPE_TABLE` owner).
- **G7 테스트** `adr310Pages.test.tsx` 3 — 로컬 250 행 · size 20: 번호 13 · 「3」 → Row 41 ~ 60 · 선택 「3」 · → 61 · 선택 「4」 · ← ← 21 · 정렬을 바꾸면 1 쪽 · 선택 「1」 · 13 쪽 241 ~ 250 · Undo 둘 → 「더 보기」 100 행. 원격 (목록 A · B 쪽, C 「더 보기」): 번호 13 · B 「3」 → `/people?page=3&size=20` · B Row 41 · A Row 1 그대로 · C 행 그대로 · `reload` → B 1 쪽 · 선택 「1」 · 행 하나 수정이 A · B · C 모두에 보임. cursor 전용 (total 은 주지만 `{{ page }}` 없음): 번호 0 · → `/people?cursor=2` Row 21 · ← Row 1.
- **원복 RED** (`red7/run.py`): A 쪽 행 끔 → 3 · B root 감싸개가 `pages` 를 버림 → 3 · C offset 끔 → 1 · D 쪽 분기 끔 → 3 · E 단위 항목 대신 collection 항목 → 2 · F bubble 클릭 → 3 · G 원격 reset 끔 → 1 · H 「번호 있음」 판정 강제 → 1 (cursor endpoint 에 total 을 줘서 반응하게 함) · I resolver 선택 끔 → 2 · K 로컬 질의 reset 끔 → 1. 반응하지 않은 둘은 지웠다 — 클릭 핸들러의 선택 쓰기 (resolver 선택이 대신함) · 선택 동기화 effect. 전부 복원 (cmp).
- **live** (5173 새 프로젝트 `verify-adr310-p7`, Chrome MCP): Code 패널로 `src/data/people.ts` (250 행) 추가 → `pages/Home.tsx` 에 `<ListBox items={people}>` + `<Pagination />` 적용 (「2 곳 반영」) → Layers ListBox → Design 패널 Collection 「행 표시」 페이지 · 쪽당 행 수 20 · 페이지 이동 Pagination → Publish 탭: option 20 (Person 1 ~ 20) · 번호 `← 1 … 13 →` → 「3」 Person 41 ~ 60 · 선택 3 → → Person 61 · 선택 4 → ← ← Person 21 · 선택 2 → 「13」 option 10 (Person 241 ~ 250) · 선택 13. 콘솔 오류 0.
- **번들** (G0 대비 누적): Builder +4,078 · Preview −1 B (Phase 7 만 +585 / +1). 처음 잰 값은 Builder 누적 +4,688 로 예산 (+4,096) 을 넘었다 — 「행 표시」 패널 조각을 lazy chunk 로 (`RowDisplayChoice.tsx`), 새 명령을 commands barrel 에서 빼고 (`commands/rowDisplay` 직접 import — barrel 이 초기 chunk 로 끌고 들어갔다), Pagination 클릭 처리를 초기 번들의 DOM 렌더러에서 Preview 상호작용 (`CatalogPreviewInteractions.paginationClick` — lazy) 으로, 검증 코드 둘을 하나 (`ROW_DISPLAY`) 로. Phase 8 에 남은 Builder 18 B — 가상 스크롤은 lazy 모듈만 초기 번들 0 으로.
- **회귀**: type-check 0 (6/6). builder 9,070 중 실패 13 → 따로 돌린 `phase4ePalette` 통과 (부하), `stagedLoadReaders` 는 새 record 순회 (Pagination 후보 — 선택한 목록의 page) 를 목록에 넣음, 남은 11 = Phase 5 기록의 기존 7 파일. shared 2,476 중 실패 11 → `fieldCoverage` 필드 수 snapshot 갱신 (223 → 225 · notInCode 48 → 50), 남은 10 = 기존. i18n 키 6 (en-US · ko-KR · types).
- **live 재확인** (패널 lazy · 클릭 경로 이동 뒤): 저장된 `verify-adr310-p7` 를 다시 열어 Publish — 처음부터 20 행 · 선택 1 (방식 · 연결이 저장됨) → 3 · → · ← 같음, 콘솔 오류 0. Builder 탭은 Chrome MCP 스크린샷이 시간 초과 (renderer 응답 없음 — JS 는 동작) 라 Publish 주소를 `window.open` 가로채기로 얻어 새 탭에서 확인했다.
- **미룬 것**: 행마다 놓인 목록 (같은 노드의 record 여럿) 은 노드 단위 조회 단위를 같이 쓴다 (Decision 12 의 record id 단위) · 쪽 수를 모르는 원격 목록의 서버 보기 (`uniqueView`) 는 쪽 요청에 싣지 않는다 · 이전 · 다음 Button 의 비활성 표시 · 복사한 Pagination 의 `pagesOf` 다시 잇기 · 반복 구간이 둘 이상인 목록의 「페이지」 거절 검증 (지금은 패널이 owner 의 binding 만 본다).

### Phase 8 — 표시 방식 「가상 스크롤」 (2026-11-15, 닫힘)

- **사용자 결정 7 확정** (착수 질문): GridList grid · CardView 도 RAC `GridLayout` 으로 지원 — Canvas 가 같은 산식으로 칸을 놓고 G8 1px 대조를 grid 에도. 통과하지 못한 배치만 선택지에서 뺀다.
- [x] **grid 칸 산식** `C/runtime/gridLayoutCells.ts` `catalogGridLayoutCells` — 설치 react-stately 3.51.0 `GridLayout.update` 의 열 수 · 칸 폭 (`minItemSize` ~ `maxItemSize`) · 비례 높이 · 가로 간격 · 가장자리 여백을 그대로 옮긴 순수 함수. oracle = 설치 `GridLayout` 인스턴스 (가짜 virtualizer 에 폭 · 항목) — 기본값 · 카드 160 · 최대 칸 크기 · 한 열 4 경우 rect 일치 (`gridLayoutCells.test.ts`). 원복 RED: 여백 빼기 → 3 실패.
- [x] **`layoutOptions` 함수** `C/runtime/virtualLayout.ts` `catalogVirtualLayout` (순수) — ListLayout: 그려진 행의 진행 방향 크기 (같으면 `rowSize`, 다르면 평균 `estimatedRowSize` — RAC 가 행을 잰다) · section 머리 · gap · padding (네 변이 같을 때만 — `ListLayout` padding 은 값 하나), GridLayout: 칸 크기 = `minItemSize` = `maxItemSize` · gap = `minSpace` · 열 수, TableLayout: 행 · 머리글 높이. 막힘 `padding` · `cellSize` · `noRows` (grid). oracle = 설치 `ListLayout` (가짜 virtualizer) — padding 8 · gap 4 · 행 36 이 flex column 산식 `8 + i × 40` 과 같음 (`virtualLayout.test.ts` 4). 값 읽기는 `C/runtime/virtualListLayout.ts` (그려진 record 의 geometry · 엔진 입력 — RAC import 없음).
- [x] **DOM 감싸기** `C/runtime/catalogVirtualizer.components.tsx` (lazy chunk — `domBinding.components` 의 `withVirtualizer`, Builder 초기 번들 밖): `rowDisplay.mode === "virtual"` 목록을 RAC `Virtualizer` 로 감싸고 목록을 스크롤 상자로 (`display: block` · `overflow: auto` · list 는 CSS padding 0 — `Layout` 이 padding 을 더하므로 두 번 들어가 4 px 어긋났다, live 실측). Preview · Publish root 는 배치 엔진 없이 돌아 (NullLayoutEngine) geometry 가 없다 — 행 크기는 추정 40 을 주고 RAC 가 실제 행 (CSS 높이 = Canvas 와 같은 rule) 을 잰다. 세션: 가상 스크롤 목록은 불러온 행 전부 (`limit` = 최대 — 표시 창 없음).
- [x] **고를 수 있는 조건 · 패널**: 「행 표시」 에 「가상 스크롤」 — 정해진 높이가 없으면 (`catalogGrowsWithRows` 를 resolver 에서 내보냄 — Table 은 `heightMode === "fixed"`) 막고 이유를 둘째 줄에. `Layout` 배치 판정 (`padding` · `cellSize` · `noRows` — i18n 은 넣어 둠) 은 패널에서 아직 보이지 않는다 (번들 — 아래).
- **번들** (지금까지): Builder 누적 +4,074 · Preview +0 B (Phase 8 −4 / +1). 처음엔 +5,238 — lazy 가상 스크롤 chunk 가 초기 번들과 공유하는 모듈 (`delegatedDom` · `groupSelection`) 을 직접 import 해 rollup 이 공용 chunk 를 새로 갈랐다 (그 import 만 빼면 +4,074 로 돌아옴 — bisect). 두 함수를 감싸는 쪽이 넘기게 (`CatalogVirtualListReaders`) 바꿨다. 패널은 높이 조건만 보고 배치 판정 (padding · 카드 크기) 은 Preview chunk 에서 — 막히면 Preview 가 원래대로 그린다.
- [x] **grid (사용자 결정 7)** — 옵션은 geometry 없이 type · props · 스크롤 폭으로 정한다 (`C/runtime/virtualGrid.ts` `catalogVirtualGridOptions` — Preview 에는 geometry 가 없어 「템플릿 Card 의 그려진 크기」 안을 버림): CardView = 설치 S2 CardView `layoutOptions[size].regular` (minSpace · min · max 칸) 와 S2 의 「2열이 들어가는 가장 큰 크기」 규칙, GridList grid = RAC 레퍼런스 예제대로 `GridLayout` 기본값. 높이는 둘 다 측정 (`preserveAspectRatio` 없음 — 행 = 가장 큰 항목). Canvas: record 파생 값 `_rowDisplay` (문서 `rowDisplay` 가 record 에 없어 바꿔도 다시 배치되지 않았다) → `rewrap` 이 배치된 폭 (테두리 안) 에서 `catalogVirtualGridStyle` — 열 트랙 = 칸 폭 × 열 수 · column gap = 가로 간격 · 시작 padding = 간격 + 가운데 여백 · 위아래 padding · row gap = 세로 간격 · `align-items: start` — 을 `styleFor` 맨 끝에 (엔진 입력 형식: `"Npx"` · 트랙 배열). Undo 는 같은 분기가 지운다. Preview: `GridLayout` 하위 클래스가 `update` 때 스크롤 폭으로 같은 함수를 부른다 (함수는 DOM runtime 이 readers 로 넘긴다 — 정적 import 는 공유 chunk +932 B). waterfall 은 `WaterfallLayout` 이라 아직 막는다 (패널 이유 `waterfall`, Preview 는 그대로 그림). 테스트: `virtualGrid.test.ts` (S2 설치 소스에서 읽은 표 · 448/447 경계 · RAC `GridLayout` 인스턴스의 x · 폭 · 첫 행 y = 트랙) · `adr310VirtualGrid.test.ts` (Canvas 항목 rect = 산식, CardView 700 · 430 · GridList 900, Undo 복원). 원복 RED 5 — record 파생 값 끄기 · Undo 지우기 분기 끄기 · `styleFor` 반영 끄기 → Canvas 3/3 실패, S2 「2열 들어가는 크기」 규칙 끄기 · 가운데 여백 빼기 → 산식 테스트 1 실패 (복원 cmp 확인). 회귀: type-check 0, shared 2,487 중 실패 10 = 기존 목록, builder unit 은 기존 목록 + 부하 시간 초과 (따로 돌리면 `phase4eOriginView` 1 = 기존). 번들: grid 로 Builder +742 B (누적 +4,816) — 사용자 결정 5 상향 (+4,864 B, 사용자 확인 2026-11-15). **live** (5173 `verify-adr310-p7`, Chrome MCP — dev 핸들로 CardView 700 × 420 넣기 · People 연결 · `setRowDisplay(virtual)`, Publish 는 `window.open` 가로채기로 연 새 탭): Canvas 첫 행 x 12 · 241 · 470 · y 16 · 217 × 313.5 = Publish DOM 같은 값 (차이 0), 둘째 행 y Canvas 345.5 · DOM 346 (RAC 가 잰 높이를 정수로 올림 — 0.5 px) · 250 장 중 DOM 6 · 스크롤 가운데 Person 112 ~ 117 · 끝 247 ~ 250 · 카드 클릭 뒤 ↓↓→ End → Person 250 (스크롤 따라감, DOM 4) · 콘솔 오류 0. 미확인: 패널 「가상 스크롤」 선택 UI (Builder 탭 스크린샷 시간 초과 — 명령으로 대신), GridList grid live (unit 만).
- [x] **Table · 가로 목록** (live 에서 먼저 잰 차이 셋 — 고친 뒤 0):
  - **행 자르기 (결함)**: 높이를 정한 Table 은 resolver 가 높이에 드는 행만 남겨 (`boundTableRows` `heightMode` fixed) 가상 스크롤 Table 도 250 행 중 11 행에서 끝났다 (Publish scrollHeight 472). 가상 스크롤 Table 은 Preview (`rowSample` 없음) 에서 모든 행 — Builder 는 그대로 표본. `adr310VirtualTable.test.tsx` (Preview 세션 Row record 14 → 250).
  - **열 폭**: RAC `TableColumnLayout` 은 열 폭을 정수로 나누고 (199 · 200 · 199) 선택 · drag 열의 폭 없는 Column 을 `1fr` 로 읽는다. Canvas 는 `_tableTracks` 를 CSS grid 로 놓으므로 (199.33 ×3) `CatalogTableLayout` (`TableLayout` 하위 클래스) 이 `columnWidths` 를 Canvas 의 트랙 (첫 Row 의 엔진 입력 `gridTemplateColumns` — drag 열 포함) 을 스크롤 폭에서 푼 값으로 준다 — `tableTrackWidths.ts` `catalogTableTrackWidths` (css-grid-2 §12.6 maximize → §12.7.1 fr, Column 이 만드는 트랙 꼴만). oracle = 실제 Rust 엔진이 같은 트랙 · 폭으로 놓은 행 (`adr310TableTrackWidths.test.ts` 10 경우 소수 둘째 자리까지). 크기 조절 Table 은 RAC 열 폭 그대로 (`ResizableTableContainer` 의 Preview 조작). 터치 기기의 선택 열 (52) · drag 열 (20) 은 Canvas 트랙이 데스크톱 px (40 · 16) 라, `CatalogVirtualizer` 가 Row 의 기기 트랙 (`_tableDeviceTracks` · `_allowsDragging`) 을 그 기기의 토큰 px 로 풀어 넘긴다 (`catalogDeviceColumnTracks` — 2026-11-15 후속; 기기 px 는 DOM runtime 이 `readers.deviceColumns` 로 넘긴다 — chunk 의 정적 import 는 `deviceUnit.runtime` · `tableTracks` 를 chunk 로 갈라 초기 번들 +1,357 B 였다 → +1 B, 누적 Builder +4,855 · Preview −2).
  - **행 간격**: `TableLayout` 은 행 높이를 Cell 측정값 (40) 으로 정해 Row 의 아래 테두리 1 이 간격 밖이었다 (DOM 40 · Canvas 41, Row 요소 높이 1). `rowEdge` (Row 엔진 입력의 테두리 + padding) 를 행 높이 · 추정 높이에 더하고 Cell 을 위 여백만큼 내리며, Row 요소는 그 상자를 채운다 (`height: 100%` — `domBinding.runtime.ts` `catalogFillsVirtualBox`).
  - **가로 목록**: S2 목록 (ListBox · GridList · Tree · Menu) 에는 `orientation` 이 없어 `props.orientation` 을 읽던 분기는 늘 세로였다 — 작성자가 Styles 에서 flex row 로 둔 목록이 Preview 에서 세로로 놓였다. 방향은 목록의 그려진 흐름이다 (`virtualFlow.ts` `catalogVirtualFlow`: block · flex column · 한 열 grid (GridList stack) = 세로, flex row = 가로, 줄바꿈 · 역순 · stretch 아닌 정렬 · 여러 열 grid = 막음 `flow` — 패널이 이유를 보인다). 가로 `ListLayout` 은 항목 폭을 추정 폭 상자에서 재므로 항목이 같은 px 폭 (`flex-shrink: 0`, margin 없음) 일 때만 (`rowSize`), 아니면 Preview 가 원래대로 그린다 (`itemSize` — `padding` 처럼 Preview 판정). 항목은 줄 높이를 채운다 (`height: 100%` — Canvas flex 의 stretch).
  - 테스트: `virtualFlow.test.ts` 2 · `virtualLayout.test.ts` (Table 의 트랙 · `rowEdge`) · `adr310TableTrackWidths.test.ts` 11 · `adr310VirtualTable.test.tsx` 1. 원복 RED 5 — 가상 스크롤 Table 자르기 되살림 → 1 실패 · §12.6 끄기 → 2 · fr 재계산 끄기 → 2 · wrap 허용 → 1 · `rowEdge` 버림 → 1 (복원 cmp 확인). `CatalogTableLayout` 의 열 폭 · `rowEdge` 와 `height: 100%` 는 jsdom 에 스크롤 상자 크기가 없어 live 로만 (고치기 전 값: 열 199 · 200 · 199, 행 간격 40, 가로 항목 높이 32). 회귀: type-check 0 · shared 2,490 중 실패 10 = 기존 목록 · builder unit 관련 (adr310 · adr257 · Table · RowSample · RowDisplay) 65 파일 466 통과 (`adr310VirtualTable` 은 부하에서 5 초를 넘어 30 초 한도).
  - 번들: Builder 누적 +4,853 (이번 +37 — 처음엔 +64 로 상한 +4,864 를 넘어 패널에 보이지 않는 `itemSize` 문구를 빼고 resolver 분기를 줄였다) · Preview −2.
  - **live** (5173 `verify-adr310-p7`, Chrome MCP — dev 핸들로 넣기 · People 250 연결 · `setRowDisplay(virtual)`, Publish 는 `window.open` 가로채기): Table 600 × 300 — 열 x 0 · 199.33 · 398.66 · 폭 199.33 (Canvas 0 · 199.3 · 398.7), 행 y 33 · 74 · 115 · 높이 41 (Canvas 같음), scrollHeight 10,282 (= 32 + 250 × 41), scrollTop 5,000 → Person 123 y 35 (계산 값 그대로) · 끝 Person 250 y 260 (+41 = 안쪽 끝 301), 셀 클릭 ↓↓ → Person 3 · End → Person 250 (스크롤 따라감). 가로 ListBox 600 × 120 (flex row · 항목 폭 100) — Canvas 항목 x 4.5 + i × 100 · y 4.5 · 100 × 111 = DOM 같은 값, scrollWidth 25,008, 끝까지 Person 250. 세로 ListBox (앞 확인) 그대로 4.5 · 36.5 · 68.5 × 32. 콘솔 오류 0. 미확인: 패널의 `flow` 이유 표시 UI (순수 함수만 unit), 터치 기기 선택 열.
- [x] **G8 자동화** — `apps/builder/scripts/adr310-g8-virtual-live.mjs` (headed Chrome · Playwright, 새 프로젝트를 dev 핸들로 채움 · Publish 는 Preview 버튼이 연 창): 1,000 행 mock + 원격 collection (하니스가 띄운 127.0.0.1 서버 — 100 행씩 3 쪽 · cursor `next`) · 목록 여덟 (세로 · 가로 ListBox · Table · CardView · 더 보기 대조군 · 원격 · 패널용 둘). 판정 ⑥ 패널 「Show rows」 에서 Virtual scroll 실제 클릭 → 문서 `rowDisplay` virtual · 줄바꿈 목록은 막힘 + 이유 「Keep the items in one line」 · ① DOM 행 13 · 8 · 11 · 6 (≤ 60) · ② Canvas 표본 행 ↔ DOM `getBoundingClientRect` (목록 기준) 세로 · 가로 최대 1 · Table 행 0 · 열 0.01 · grid 0.5 px · ③ 원격 가상 목록 끝에서 `page=2` · `page=3` → Person250 · ④ End → Person1000 (스크롤 따라감) · ↑ Person999 · Space 선택 · Home · ⑤ frame (아래) · 콘솔 오류 0. production 은 `--serve-dist` (`pnpm perf:build-dist` 산출물 — 하니스 핸들에 연결 · 행 표시 명령을 더했다, `CatalogBuilderCore.tsx` 의 dev · harness 빌드 분기라 일반 빌드에서 빠진다 · `perfDist.mjs` 가 `publish/` 디렉터리의 index.html 을 낸다).
- [x] **⑤ frame — 사용자 결정 (2026-11-15, 결정 지점 ④ 질문)**: G8 의 「더 보기 대비 frame p95 가 나빠지지 않는다」 는 RAC `Virtualizer` 로 도달할 수 없다 — 더 보기는 compositor 스크롤이라 main thread 일이 0 이고, **같은 문서에 넣은 순수 RAC 가상 목록도** 목록 여럿 · CPU 4x 에서 p95 17.5 ~ 25.8 ms 로 떨어졌다 (가벼운 문서에서는 9.2). 기준을 「1x 에서 60Hz 최소선 (p95 ≤ 16.7 ms) + 1x · 4x 모두 같은 문서의 순수 RAC 가상 목록 p95 + 0.5 ms 이하」 로 바꾸고 우리 몫을 줄였다. 대조군 = `apps/builder/scripts/adr310VirtualBaseline.mjs` (600 × 300 · 행 32 · padding 4, 우리 목록과 같은 입력 — Preview 에는 배치 geometry 가 없어 행 크기를 추정하고 RAC 가 잰다; `--rac-fixed` 는 행 크기를 아는 RAC 참고) · 같은 문서 A/B (한 팔을 잴 때 다른 팔 목록 `display: none` — 더 보기 1,000 행 DOM 이 같은 문서에 떠 있으면 가상 쪽만 4x p95 25 → 10.2 ms 로 갈렸다 = 처음 측정 설계의 결함) · 3 회 교대 중앙값 · 측정 조건 production 빌드 · 120Hz · 보이는 탭 · Builder 탭 비움.
  - **우리 몫 (원인 둘, 실측으로 찾음)**: dev 의 commit · 마운트 세기 (React DevTools hook 자리 — 하니스 `--render-count`) 로 30 프레임에 ① commit 72 · 행 view 마운트 23 — 순수 RAC 도 추정 조건이면 같다: 추정 40 과 실제 32 가 달라 새 행마다 `ListLayout.updateItemSize` 가 다시 배치하고 view 를 재사용하지 못했다 ② 재사용된 행 안의 우리 자식이 다시 마운트 (CatalogDomNode 280 · Text 56) — 자식 React key 가 행마다 다른 record id (`…#row:pN`). 수리: `CatalogListLayout` (`catalogVirtualizer.components.tsx` — 잰 행 크기를 다음 추정값으로, 행은 계속 잼) → commit 34 · view 마운트 3, `catalogChildKey` · `catalogRowStableElement` (`domBinding.runtime.ts` — 데이터 행 record 아래 자식 key · 그린 요소 key 에서 그 행 접미사를 뗌 = 템플릿 자리) + 글자 binding 안 단일 자식 key 제거 → CatalogDomNode 마운트 15 · Text 3. 기각한 가설 (실측 반증): 문서 배치 범위 (`contain: strict` — 변화 없음) · Builder 창과 main thread 공유 (Builder 탭 비워도 같음) · 행 DOM 무게 (option + span 하나, 순수 RAC 와 같음) · 행 크기 고정 (실험 빌드 — 우리 몫이 남음).
  - 결과 (production, `--serve-dist`): 1x 가상 p95 9.1 ~ 9.3 · RAC 9.1 ~ 9.3 · 더 보기 9.2. 4x 가상 p95 17.5 (손실 프레임 55 ~ 59 %) vs 같은 조건 RAC 17.5 ~ 25 (48 ~ 72 %) — 두 실행 모두 PASS. 수리 전 4x 가상 25 (손실 80 %). 참고 (행 크기를 아는 RAC): 4x 17.3 (20 %). 스크롤 막대: 처음 추정 40 이라 1,000 행 전체 높이가 39,800 → 재면서 32,008 로 줄던 것이 첫 행을 잰 뒤 바로 32,008 (End 위치 39,501 → 31,709).
  - 테스트: `virtualRowReuse.test.ts` 3 (설치 `ListLayout` oracle — 스크롤로 새로 보인 행을 재도 다시 배치하지 않음 · 전체 높이 4 + 1,000 × 32 + 4, RAC 는 매 행 다시 배치 / 행 자식 key = 템플릿 자리 · 형제 유일 · 목록의 행 · 중첩 행은 그대로 / 그린 요소 key). 원복 RED 3 — 학습 끄기 · 자식 key = record id · 요소 key = record id → 각 1 실패 (복원 cmp 확인).
  - 번들: Builder 누적 +4,854 (상한 +4,864) · Preview −1 B (HEAD `ae8c300b2` 위 — 다른 세션 변경 포함).
  - 후속 (2026-11-15) — 터치 기기의 Table 선택 열 52 · drag 열 20: 위 열 폭 항목. G8 ⑦ (하니스 Table 의 첫 Column 에 `Checkbox[slot=selection]` · Preview `data-catalog-touch`) dev 실측 데스크톱 [40, 279, 279] · 터치 [52, 273, 273] · 머리글 = 본문 행, 원복 RED (터치 토큰 52 인데 [40, 279, 279]). `adr310TableTrackWidths.test.ts` 터치 7 (oracle = 터치 트랙의 Rust 엔진 배치).
  - 발견한 별도 결함 2 (가상 스크롤과 무관 — 일반 Table 에서도) — 2026-11-15 수리: ① 전체선택 Checkbox 가 든 머리글 행 높이 Canvas 35 · DOM 32 (G8 ② Table 이 3 px 로 FAIL) — 칸 안 Checkbox 의 `vertical-align: top` 이 수동 `Table.css` 에만 있어 엔진은 baseline 에 놓았다 → Column · Cell 의 part rule (`tableCellCheckboxPartRules`) 로 옮기고 수동 규칙 삭제. ② 바운드 Table 의 Row 템플릿 안 `setFields` (Cell 글자 · Checkbox 라벨) 가 `RESOLVED_INSTANCE_MISSING` 으로 거부 — `resolvePruned` 가 행 record id (`…#row:<key>`) 로 소유 경로를 적고 resolver 는 템플릿 자리로 물었다 → 자리 키로. 이어 비운 라벨이 「Checkbox」 로 돌아옴 — `withoutSampleContent` 가 빈 글자도 표본으로 뺐다 → 빈 글자는 남김. live G8 (dev) 14/14 PASS: ② Table 머리글 Canvas [40, 279, 279] × 32 = DOM, 본문 행 차이 0 · ⑧ 행 템플릿 Cell 의 선택 Checkbox 가 보이는 11 행 모두 라벨 없이. 원복 RED 3 (행 접미사 키 → `RESOLVED_INSTANCE_MISSING` · 빈 글자 빼기 → 「Checkbox」 · part rule 끔 → verticalAlign 없음).
- **live 중간 확인** (5173 `verify-adr310-p7`, Chrome MCP — Builder 탭 스크린샷이 시간 초과라 dev 하니스 핸들 `__COMPOSITION_CATALOG__` 로 ListBox 높이 300 · `setRowDisplay(virtual)` 를 명령으로, Publish 는 `window.open` 가로채기로 연 새 탭): 250 행 · DOM option 13 ~ 14 · 스크롤 중간 Person 78 ~ 91 · 끝 238 ~ 250 · 전체 높이 9,912 · 키보드 End → Person 250 (스크롤 따라감) · Home → Person 1 · Space 선택 · 콘솔 오류 0. **G8 (세로 목록)**: DOM 행 `getBoundingClientRect` (목록 기준) x 4.5 · y 4.5 / 36.5 / 68.5 / 100.5 · 높이 32 = Canvas 표본 행 geometry 같은 값 (차이 0 px, DPR 2 · 폭은 각 화면 폭 − 9).
