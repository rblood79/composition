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
