# ADR-326 breakdown — Cascader 열린 목록을 원본 노드로

> 본문: [ADR-326](../326-cascader-open-content-nodes.md). 선행: [ADR-322](../completed/322-cascader-hierarchical-picker.md) · [322 breakdown](322-cascader-hierarchical-picker-breakdown.md). 리뷰: [reviews/326.md](../reviews/326.md) — Round 1 의 h1 ~ h4 · m5 를 §4.1 · §4.3 · §4.4 · §4.5 · §4.7 에, Round 2 의 h1 · m5 를 §4.4 · §4.7 에 반영했다 (2026-11-28).

## 1. 범위 · 출처

- 출처: 사용자 요청 2026-11-28 (본문 Status). 분리 점검 4 질문은 본문 Status 에 적었다 (사용자 지시한 분리).
- 범위 안: Cascader 원본의 열린 내용 노드 · 항목 자리 이동 · DOM 의 catalog renderer 전환 · Canvas 펼침 · Design 패널 Open · 전용 CSS 삭제 · contract · Builder 표본 창의 시작 경로 보존 · Breadcrumbs 접힌 메뉴의 `onAction`.
- 범위 밖: 방식 추가 · 값 모델 · 검색 규칙 · 단계별 로드 규칙 · 폼 값 input (ADR-322 그대로). Select · ComboBox 의 구조. columns 의 하위 단계를 Canvas 에 그리기. library template 자리의 반복 행 계약 (ADR-310 그대로).
- 이미 끝난 것 (같은 날, ADR 밖): Value 칸 드롭다운 (`catalogRuntime/singleSelection.ts` Cascader 분기 · `defaultValue` = `selection-value`) · `isSearchable` 삭제 (검색 늘 표시).

## 2. 대조 표 — ADR-322 의 결정 중 바뀌는 것과 남는 것

| ADR-322                                                              | 이 ADR                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------- |
| 결정 11 「Canvas — 닫힌 필드와 시작 값 글자만」                      | **대체** — Open 이면 막 연 화면을 그린다                |
| R6 「Canvas 는 열린 목록을 보여 주지 않는다」                        | **대체**                                                |
| breakdown §4.1 「항목 = Cascader 직계 `CascaderItem`」               | **대체** — `Popover > CascaderList > CascaderItem`      |
| breakdown §4.6 Canvas                                                | **대체** — 이 문서 §4.5                                 |
| Phase 3 「열린 모양 = Cascader rule `externalStyles`」               | **대체** — 열린 상자 블록 하나 + 부품 rule (HC3)        |
| Phase 4 기록 「표본 밖 key 는 Canvas 에서 key 글자 (설계된 비대칭)」 | **대체** — 시작 경로 보존 (§4.7). 닫힌 필드도 경로 글자 |
| 결정 3 방식 셋 · 사용자 결정 1 (기본 columns)                        | 유지                                                    |
| HC4 값 = key · 겹치는 key 는 고를 수 없음 (결정 4)                   | 유지                                                    |
| 데이터 세 모양 (결정 5) · 단계별 로드 (결정 7)                       | 유지 — 읽는 자리만 옮긴다                               |
| 닫힌 D1 예외 (폼 값 input — §3.1)                                    | 유지 — 목록 무변경                                      |
| 검색 (Phase 5) · 다중 · 「어느 단계든」                              | 유지 — 검색 칸만 노드가 된다 (늘 있음)                  |
| HC5 성능 · lazy chunk                                                | 유지 (HC4 로 다시 잰다)                                 |

Select 와의 대조:

| 축               | Select (지금)                                         | Cascader (지금)                              | Cascader (이 ADR 뒤)                                       |
| ---------------- | ----------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------- |
| 열린 상자        | `Popover` 노드 (catalog renderer · `data-size`)       | lazy chunk 의 RAC `Popover` (노드 아님)      | `Popover` 노드                                             |
| 목록             | `ListBox` 원본 instance                               | RAC `Menu` · `Tree` · `GridList` (노드 아님) | `CascaderList` 노드 — 안쪽 RAC 컬렉션은 lazy chunk 가 조립 |
| 항목             | `ListBoxItem` (ListBox 안)                            | `CascaderItem` (Cascader 직계)               | `CascaderItem` (`CascaderList` 안)                         |
| 항목의 DOM 모양  | 항목 노드의 renderer (id · 작성 style)                | 표에서 만든 RAC 행 (record 와 끊김)          | RAC 행이 항목 record 의 DOM 입력을 받는다 (§4.3)           |
| 상자 폭          | rule 블록 `width: var(--trigger-width)` · Canvas 닻폭 | 전용 CSS `min-width`                         | Select 와 같은 블록 · 같은 닻 폭 계산                      |
| 패널 Open        | Value 절                                              | 없음                                         | Value 절                                                   |
| Canvas 펼침      | 그린다                                                | 그리지 않는다                                | 막 연 화면을 그린다                                        |
| 열린 모양의 정본 | rule (Canvas 부품 규칙 + 생성 CSS)                    | DOM 전용 CSS                                 | rule                                                       |

## 3. D1 — 바뀌지 않는 것의 확인 목록

- 여는 Button 의 trigger props · 메뉴 이름 (`aria-labelledby`) · focus 복원 · Esc — 필드가 지금처럼 `useMenuTrigger` · `useOverlayTrigger` 로 갖고 `PopoverContext` 로 넘긴다 (`cascaderOverlay.components.tsx`). 바뀌는 것은 그 context 를 받는 쪽이 lazy chunk 의 RAC `Popover` 에서 catalog `Popover` 노드 (`CatalogPopover`) 로 바뀌는 것뿐이다.
- `PopoverContext.trigger` 이름을 `"Cascader"` 로 준다 (본문 F10 — RAC 는 이 이름을 `data-trigger` 로만 쓴다). 메뉴 · 대화상자의 동작은 `MenuContext` · `DialogContext` · `OverlayTriggerStateContext` 가 정한다 — 이름과 무관한지 Phase 0 P1 이 확인한다.
- tree · drill 의 RAC `Dialog` 요소는 문서 노드가 아니다 (RAC 가 내는 role). Canvas 에는 없으므로 DOM 에서 배치에 끼어들지 않게 둔다 — §4.3.
- 검색 칸: SearchField 노드를 catalog renderer 가 그리고, lazy chunk 가 RAC `Autocomplete` 로 감싼다 (지금과 같은 조립 — 입력이 focus 를 갖고 목록은 가상 focus).
- 경로 줄: RAC `Breadcrumbs` · `Breadcrumb` 요소 그대로 (`BreadcrumbsRun`). 접힌 조상은 S2 처럼 폴더 메뉴 (RAC `MenuTrigger` > `Menu` > `MenuItem`) 다 — 지금 Cascader 의 경로 줄은 접지 않으므로 깊은 경로에서 DOM 이 달라진다 (S2 Breadcrumbs 의 것으로).
- 행에 붙는 것은 `data-catalog-id` · `data-*` 표식 · `style` 뿐이다 — role · `aria-*` · 키 handler 는 쓰지 않는다.
- 새로 쓰는 role · `aria-*` · 키 handler 0 — `adr322D1Static.static.test.ts` 의 파일 목록에 새 파일을 넣는다.

## 4. 설계

### 4.1 노드 · prop

```
Cascader                                   (type-Cascader — 지금 그대로의 prop + isOpen · defaultOpen)
├ FieldLabel > Label …                     (그대로)
├ Button > SelectValue + Icon              (그대로)
├ Description · FieldError                 (그대로)
└ Popover                                  (type-Popover — Select 의 `__popover` 와 같은 자리, props {})
   ├ SearchField                           (origin-component-searchfield instance — label "" · 접근 이름은 i18n)
   ├ Breadcrumbs                           (type-Breadcrumbs 노드 — presentWith: drill 일 때만)
   │  └ Breadcrumb × 4                     (origin-component-breadcrumb-item-default instance — 자리 넷, §4.4)
   ├ ActionButton[slot=back]               (quiet · icon-only — presentWith: drill 일 때만)
   └ CascaderList                          (새 type — 단계 목록 상자, 사용자 prop 0 · `size` 는 내부 전달 값)
      └ CascaderItem …                     (중첩 — 계층. 표본 11 개가 여기로)
```

- `CascaderList`: binding `source: internal renderer "cascaderlist"`, rule = 세로 flex · gap 0 · 안쪽 여백 (S2 Menu 의 값 — `d3S2Alignment` 대조). DOM 은 방식에 따라 RAC `Menu` · `Tree` · `GridList` 요소가 이 노드의 요소다 (`data-catalog-id` 를 그 요소에).
- **원본의 입력 (Round 1 h4)**: `CASCADER_DEFINITIONS` 의 `accepts` 에 `mode: "string"`, `defaults` 에 `mode: "columns"` 를 더한다 — `bindingMaps.from` 은 `accepts` 의 키여야 한다 (`validation.ts:3090-3107`). template 루트의 `mode: "columns"` 과 같은 값이고, 둘이 어긋나지 않게 정적 검사 하나가 묶는다.
- drill 전용 부품: 정의에 `bindingMaps: { cascaderDrill: { from: "mode", values: { drill: "1" } } }` (그 밖 = 빈 글자), `Breadcrumbs` 와 「뒤로」 두 노드에 `presentWith: "cascaderDrill"`. `mode` 쓰기는 그 자리를 다시 해석한다 (본문 F7). Phase 1 의 판정: 등록 검증 통과 · `mode` 를 패널 · instance override · Undo 로 바꿀 때 두 record 가 서고 사라진다. `mode` 가 변수 식이면 해석된 값으로 갈리는지도 같은 단위에서 본다 (갈리지 않으면 `templateBindings` 가 읽는 값을 본문 R10 으로 보고).
- traits: `CascaderItem.owners = ["Cascader"]` 유지 (조상 판정), `CascaderList: { container: "collection", owners: ["Cascader"], children: ["CascaderItem"] }`. 항목 표 (`COLLECTION_TYPE_TABLE`) 의 Cascader 행에 목록 부품 (`list`) 을 적는다 — 항목 「+」 · 반복 표시 · 「더 보기」 판정이 그 자리를 읽는다.
- binding: `...OVERLAY_OPEN_PROPS` 를 Cascader 에 (Value 절 「Open」 · `defaultOpen` 숨김).
- `sizePropagation`: `Cascader = [...FIELD_PARTS, "Button", "CascaderList", "SearchField", "Breadcrumbs"]` — Popover 는 통과 (`CATALOG_SIZE_PASS_THROUGH`).
- contract 87 → **88**.

### 4.2 항목 읽기 — 한 함수로

`catalogCascaderItems(cascader, get, typeOf)` — Cascader → Popover → CascaderList 의 직계 `CascaderItem` (없으면 빈 목록). 아래가 이 함수를 읽는다:

| 읽는 곳                                                 | 지금                                 |
| ------------------------------------------------------- | ------------------------------------ |
| `runtime/cascader.ts` `cascaderStaticItems`             | `node.children` 직접                 |
| `delegatedDom.runtime.ts` `cascader` `watchesChildren`  | 직계 CascaderItem 재귀               |
| `dataBindingCommand.ts` (반복 항목 넣기)                | Cascader 직계에 삽입                 |
| `resolver.ts` 행 전달 (`["Tabs","TabList","Cascader"]`) | Cascader 의 owned children 에 rowSet |
| `resolver.ts:4633-4638` (표본 항목 버리기)              | Cascader 의 `lib:` 자식              |
| `commands/collections.ts` 항목 「+」                    | owner = Cascader                     |
| `catalogRuntime/singleSelection.ts` (Value 칸)          | `cascaderTableOf` (위 함수를 통해)   |

resolver 의 행 전달은 picker 의 길 (Select 의 binding 이 Popover 를 건너 ListBox 항목에 닿는 `boundOwnerOf` · owner rowing) 을 그대로 쓸 수 있는지 Phase 1 에서 먼저 본다 — 쓸 수 있으면 `"Cascader"` 특례를 지운다.

### 4.3 DOM

- `cascader` renderer: 자식을 모두 `renderAll` 로 그린다 (지금은 CascaderItem 을 뺀 자식만). Popover 노드는 닫혀 있으면 RAC 가 그리지 않는다 (`CatalogPopover` — context 의 열림 상태).
- 필드는 열림 context (`MenuContext` · `DialogContext` · `OverlayTriggerStateContext` · `RootMenuTriggerStateContext` · `PopoverContext`) 를 **항상** 준다 — 지금은 열렸을 때만 lazy chunk 안에서 준다. context 값 조립 (`cascaderOverlay.components.tsx` 의 Provider 부분) 은 필드 모듈로 올라오되 RAC context import 만 하므로 첫 화면 몫은 작다 (Phase 2 A/B 실측 — R3).
- `cascaderlist` renderer: `lazy()` 로 지금의 `cascaderMenu` · `cascaderPanel` 본문 (Popover 껍질을 뺀 것) 을 그린다. 필요한 값 (항목 표 · 고른 key · 쓰기 · 방식 · 단계별 로드 · 지금 단계 · 행 입력 함수) 은 필드가 React context 하나 (`CascaderOpenContext`) 로 준다.
- 검색: `cascaderlist` 의 lazy 본문이 RAC `Autocomplete` 를 여는 자리는 Popover 안 전체여야 한다 (검색 칸과 목록이 형제) — Popover 노드의 자식 렌더를 감싸는 얇은 Provider 자리 하나를 둔다 (`CatalogPopover` 에 넣지 않고 `cascader` renderer 가 Popover 노드의 children 을 감싼다 — 다른 Popover 에 영향 0). 검색어가 있으면 `CascaderList` 자리가 결과 목록으로 바뀐다 (지금 동작).
- tree · drill 의 RAC `Dialog`: Popover 노드의 children 을 감싸는 같은 자리에서 `Dialog` 로 감싼다. 배치는 `display: contents` (rule 블록의 nested — Canvas 에는 요소가 없다). 접근성 트리에서 role 이 유지되는지 Phase 0 P3 (Chrome · WebKit) — 안 되면 Dialog 가 Popover 의 flex 배치를 그대로 이어받는 블록 (같은 rule 값의 사본 금지 — `:is()` 별칭으로 한 블록).
- **항목 행 ↔ 항목 record (Round 1 h3)**:
  - 항목 표의 항목 (`CascaderEntry`) 에 `recordId` 를 싣는다 — `cascaderStaticItems` 가 `child.id` 를 옮긴다 (연결된 목록의 행도 행마다 `CascaderItem` record 가 있다). 모양 값은 표에 싣지 않는다 — 표는 데이터만이고, 모양 편집이 표를 다시 만들지 않는다 (HC4).
  - lazy 본문이 행을 그릴 때 `CascaderOpenContext` 의 `rowProps(recordId)` 를 불러 RAC 항목 요소에 편다. `rowProps` 는 `cascaderlist` renderer 가 만든다 — catalog renderer 가 노드 하나를 그릴 때 쓰는 것과 같은 DOM 입력 (`marker(input)` 의 `data-catalog-id` 등 + 그 record 의 작성 style). 보이는 행만 부른다 (보이는 단계만 만드는 구조 그대로).
  - class 는 `react-aria-CascaderItem` (RAC 기본 class 대신) — `CascaderItem` rule 의 생성 CSS 가 세 방식의 행에 같이 걸린다. 상태는 RAC 의 `data-*` (`data-selected` · `data-focused` · `data-disabled` · `data-expanded`). 작성 style 은 그 위에 inline 으로 — 다른 노드와 같은 우선순위.
  - 대상 행: columns 의 `MenuItem` (`cascaderMenu.components.tsx:135` · `:154`) · tree 의 `TreeItem` · drill 의 `GridListItem` (`cascaderPanel.components.tsx:187` · `:392`) · 검색 결과 (`cascaderSearch.components.tsx:109`). 「<가지> 전체」 · 로딩 · 「접힌 항목」 줄은 record 가 없다 — rule 값만 받는다.
  - 다시 그리기: 항목 record 의 변경 (모양 편집 · Undo) 은 지금의 자식 구독 (`delegatedDom.runtime.ts` `cascader` `watchesChildren`) 이 `cascaderlist` 로 옮겨 가 맡는다 — 표는 그대로 두고 그 행만 새 입력을 받는다.
- columns 의 하위 단계 Popover: lazy chunk 가 그리는 RAC `Popover` 에 `data-size` 를 준다 — Menu 시트의 `[data-trigger="SubmenuTrigger"][data-size]` 블록이 그대로 걸린다 (새 CSS 0).

### 4.4 경로 줄 (drill) — crumb 자리 넷 (Round 1 h2 · m5)

반복 행으로 만들지 않는다. library template 은 `repeat` 를 받지 않고 (`validation.ts:3116-3138`) resolver 는 `lib:` 자리를 반복하지 않는다 (`resolver.ts:1731-1735` · `:1749`) — 본문 F8.

- **자리**: `Breadcrumbs` 노드 아래 `Breadcrumb` 원본 instance 넷. S2 Breadcrumbs 가 한 번에 그리는 crumb 은 많아야 넷이다 — 다 들어가고 넷 이하면 전부, 아니면 첫 crumb + 폴더 메뉴 + 끝 한둘 (`breadcrumbsCollapse.ts:82-112` · `:120`). 그래서 자리 넷이면 깊이와 무관하게 그려지는 crumb 을 모두 담는다.
- **한 함수** `cascaderTrail(table, levelPathId, rootLabel)` (`runtime/cascader.ts` — 순수) → `{ crumbs, slots }`:
  - `crumbs` = 전체 경로 — 필드 라벨 (맨 앞) + 지금 단계까지의 조상, 각 `{ key, text }` (`key` 는 조상의 `pathId`, 맨 앞은 맨 위 단계를 뜻하는 고정 key).
  - `slots` = 자리 넷에 놓을 `crumbs` 의 색인. 넷 이하면 전부 (자리 1 ~ 길이), 넷을 넘으면 첫 crumb · 끝에서 둘째 · 끝 (자리 1 · 3 · 4).
  - 폴더 메뉴의 항목은 여기서 정하지 않는다 (Round 2 m5).
- **접힘 판정**: `catalogBreadcrumbsVisibleCount` 에 실제 crumb 수 (`crumbs.length`) 를 받는 입력을 더한다 — 자리 수보다 크면 넷 이하여도 접는다 (S2 의 `size > MAX_VISIBLE_ITEMS` 가지와 같은 결과). 이때 폭 계산에 드는 것은 첫 crumb 과 끝 둘의 폭뿐이라 (`:101-112`) 자리에 있는 값으로 충분하다. Canvas `settleBreadcrumbs` 와 DOM `BreadcrumbsRun` 이 같은 입력을 넘긴다.
- **폴더 메뉴의 항목 = 판정 뒤**: 판정이 낸 「보이는 끝 crumb 수」 `visible` 로 `catalogBreadcrumbsCollapse(crumbs, visible)` 를 **전체 경로** 에 부른다 — 메뉴 = `crumbs.slice(1, 길이 − visible)` (`breadcrumbsCollapse.ts:120-125`, 지금 Breadcrumbs 가 자기 crumb 노드에 하는 것과 같은 호출). `root > A > B > C > D > E` 에서 끝 둘이 보이면 메뉴는 `A · B · C`, 끝 하나만 보이면 `A · B · C · D` 다 — 끝에서 둘째 자리는 숨고 그 조상은 메뉴에 있다. 보이지도 메뉴에 있지도 않은 조상은 없다 (첫 crumb + 메뉴 + 보이는 끝 = 전체 경로).
- **Canvas**: 자리 record 의 글자와 Breadcrumbs record 의 전체 경로 길이를 파생 값으로 싣는다. 자리의 숨김은 `settleBreadcrumbs` 가 판정 뒤에 정한다 (지금 crumb 을 숨기는 길 그대로). 메뉴는 Canvas 에 폴더 버튼만 그려지므로 항목 목록은 쓰지 않는다 (지금 단계 = 시작 값의 단계 — §4.5). 편집 대상이 아니다 (Design 패널은 자리의 글자 칸을 내지 않는다).
- **DOM**: 필드가 같은 함수를 실행 중 단계로 불러 `CascaderOpenContext` 에 두고, Breadcrumbs · 자리 renderer 가 그 값으로 덮는다 — 닫힌 필드의 값 글자와 같은 길이다 (Canvas 는 파생 값 `_cascaderValue`, DOM 은 실행 중 값 — `presence.ts:3523` · `domBinding.runtime.ts:1759`). 막 연 화면에서는 두 쪽의 단계가 같으므로 (§4.5) 같은 함수 · 같은 입력 · 같은 결과다. 단계 이동은 React state 하나라 노드를 다시 해석하지 않는다.
- **누르기**: 보이는 crumb 은 Breadcrumbs 의 `onAction(key)` → 그 단계로. 접힌 조상은 폴더 메뉴 항목이다 — `BreadcrumbsRun` 의 메뉴가 Breadcrumbs 의 `onAction` 을 같은 key 로 부른다 (S2 `Breadcrumbs.tsx:195` 와 같게. 지금은 `href` 만 넘긴다 — `delegatedDom.components.tsx:659-672`). 이 수정은 공용 Breadcrumbs 의 것이라 Cascader 밖의 접힌 Breadcrumbs 에도 닿는다 (`href` 가 있는 항목은 링크 그대로). 경로 줄의 메뉴 항목은 노드가 아니라 위의 판정 뒤 목록에서 온다. 「뒤로」 = 한 단계 위.
- **no-go 면** (P6): 멈추고 사용자에게 보고한다. 남는 후보는 library 자리의 반복 행 계약인데 (본문 「경로 줄에서 버린 길」), 그것은 ADR-310 의 계약을 넓히는 결정이라 이 breakdown 의 대체 길로 두지 않는다.

### 4.5 Canvas — 막 연 화면

- 열림: `OVERLAY_OPEN_OWNERS` · `CATALOG_OPEN_PICKER_TYPES` 등 §5 의 목록에 Cascader. 닻 = 여는 Button (기본 분기). 폭 = 닻 폭 (`catalogPickerMenuWidth` 의 Select 분기와 같은 값 — quiet 는 Cascader 에 그대로 적용되는지 Phase 4 에서 S2 Picker 값과 대조).
- 시작 상태 함수 `cascaderOpeningView(table, mode, startKeys)` (`runtime/cascader.ts` — 순수. `cascaderOpen.ts` 는 React hook 을 쓰는 파일이라 Canvas 가 읽지 못한다):
  - `columns`: 보이는 항목 = 첫 단계. 펼침 없음.
  - `tree`: 보이는 항목 = 첫 단계 + 고른 항목들의 조상 아래. 펼친 가지 = 그 조상.
  - `drill`: 지금 단계 = 첫 고른 항목의 부모 (없으면 맨 위). 보이는 항목 = 그 단계. 경로 = 그 부모까지의 조상 (`cascaderTrail` 의 입력).
  - 「어느 단계든」 이 켜진 columns · drill 의 「<가지> 전체」 줄은 하위 단계에만 있다 — drill 에서 지금 단계가 가지 안이면 그 줄도 그린다 (owner 가 그리는 줄 — 노드 아님).
  - 시작 key 의 판정은 표의 `cascaderValueMatch` 그대로다 — 겹치거나 없는 key 는 고른 항목이 아니다 (맨 위 단계). 표가 두 쪽에서 같은 답을 내게 하는 것은 §4.7 이다.
- DOM 의 초기 state (`cascaderPanel.components.tsx` 의 `expanded` · `level`) 가 같은 함수를 읽는다 — 두 벌 금지.
- 항목 record 의 표시 상태 (파생 값 `_cascaderRow`): `none` (숨김) · `pass` (상자 없이 통과 — `display: contents`, drill 에서 지금 단계의 조상) · `row` (자기 줄만) · `open` (자기 줄 + 자식). `catalogHiddenAtRest` 의 「CascaderItem 은 늘 숨김」 줄을 이 값으로 바꾼다. 닫혀 있으면 계산하지 않는다 (Popover 가 숨겨져 자손이 배치에서 빠진다).
- 항목 줄: `CascaderItem` 이 자기 상자 위쪽 (줄 높이만큼의 padding-top) 에 이름 · chevron · 선택 표시를 그린다 (사용자 결정 2 의 권고 길 — 본문 F11). tree 의 들여쓰기 = 깊이 × 단계 폭 (파생 padding-left). 값은 `CascaderItem` rule 의 size 블록 · `paint` 트리 (선택 · 비활성 상태). 항목 record 에 쓴 모양은 그 줄에 그대로 그려진다 — DOM 은 §4.3 의 행 입력으로 같은 값을 받는다.
- 선택 표시: 막 연 화면에서 Preview 가 보이는 것만 — 고른 항목이 보이는 단계에 있으면 선택 상태 (columns 는 첫 단계에 있을 때만).
- 「보이는 행」 의 뜻 (HC2): 열린 상자의 잘림 (`max-height` · `overflow`) 안에 있는 행이다. 막 연 Preview 는 목록 맨 위를 보인다 (검색 칸이 focus 를 갖고 목록은 가상 focus — 스크롤하지 않는다). 상자 아래로 넘친 행은 대칭 대상이 아니다 — Canvas 는 스크롤하지 않는다.
- 선택 · Layers: 열린 상자 클릭 = Cascader 선택 (`targetPick.ts` 의 본체 → 소유자), 선택 테두리 = 열린 본체 (`canvasSelectionGeometry.ts`). Layers 의 항목 줄은 지금처럼 모두 보인다.
- Library page: 닫힌 채 (Select 와 같다 — 사용자 결정 3).

### 4.6 모양 — rule

- Cascader rule `externalStyles` = 한 블록: `.react-aria-Popover[data-trigger="Cascader"]` — `width` · `min-width: var(--trigger-width)` · `padding` · `max-height` · `overflow` (Select 블록의 값을 상수로 공유) + nested (`CascaderList` 테두리 없음 · tree/drill 의 `Dialog` 배치). `overlayExternalPartRules` 가 Canvas 부품 규칙으로 읽는다 (본문 F4).
- `CascaderItem` rule: S2 Menu 항목의 값 (높이 · 좌우 여백 · 글자 단계 · 모서리 · hover · focus · selected · disabled 칠) — MenuItem rule 과 상수 공유.
- `CascaderList` rule: 위 §4.1.
- `CASCADER_PANEL_STYLES` 삭제. 정적 검사 (HC3): Cascader · CascaderItem · CascaderList rule 밖에서 `.cascader-` 선택자 0 · `externalStyles` 의 선택자가 모두 `[data-trigger="Cascader"]` 로 시작.

### 4.7 시작 경로 보존 — Builder 의 표본 창 (Round 1 h1)

지금: Builder 는 창 100 으로 읽고 Preview 는 전부 읽는다 (본문 F15). 시작 함수가 같아도 입력 표가 달라 같은 값에서 다른 단계가 열린다. 고치는 순서는 「계층 전체에서 판정 → 그 다음 창」 이다.

- **남길 key**: resolver 가 Cascader (와 자기 연결을 가진 단계 항목) 의 행을 읽을 때 시작 key 목록 (`cascaderStartKeys` — `value` 다음 `defaultValue`) 을 행 읽기에 같이 넘긴다. 행 읽기의 다섯째 인자 (`CatalogRowSlices` — Table 이 묶음 · 고정 행을 넘기는 자리) 에 필드 하나 (`keepKeys`). Builder 의 `catalogBuilderBoundRows` 는 받은 것을 `catalogBoundRows` 로 넘기기만 한다. Preview 는 전부 읽으므로 쓰지 않는다.
- **`catalogBoundRows` — 창 앞에서 판정**, 모양마다:

  | 모양                    | 지금의 창                                                             | 남기는 행                                                                                                                                |
  | ----------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
  | 평면 (`parentId`)       | 전체를 트리로 묶은 뒤 뿌리 100 (`dataBinding.ts:1380-1382`)           | 창의 뿌리 + 아래 어디든 남길 key 를 가진 뿌리 (하위 행은 지금도 자르지 않는다)                                                           |
  | 중첩 (`children`)       | 뿌리 행 100 (`:1333`)                                                 | 같다 — 남길 key 는 원본의 중첩 배열을 훑어 찾는다                                                                                        |
  | 단계 표 (`levelParent`) | 단계마다 창 100 → 부모로 거르기 → 높이 표본 (`resolver.ts:1752-1763`) | 창의 행 + 남길 key 를 가진 행 + 그 조상 행 (부모 필드를 따라 윗 단계 표에서) + 막 연 화면에서 열리는 단계의 행 (부모 = 시작 항목의 조상) |
  - 남길 key 를 가진 행은 **모두** 남긴다 (처음 하나만이 아니라) — 겹치는 key 의 판정 (`duplicate`) 이 계층 전체와 같아진다.
  - 남긴 행은 원본 순서의 제자리에 선다 (창 뒤에 붙이지 않고 순서대로 — 창의 100 째 다음에 원본 순서로).
  - 단계 표의 높이 표본 (`sampledRows`) 은 남긴 행을 버리지 않는다.

- **자식 유무 보존 (Round 2 h1)**: 표는 가지 · 잎을 남아 있는 자식으로 다시 정한다 (`cascader.ts:113` · `:123`) — 창이 자식을 모두 자른 가지는 잎이 되고, 같은 key 의 잎이 있으면 겹침으로 바뀐다. 그래서 표본의 **모든** 행이 원래의 자식 유무를 싣는다:
  - 행 읽기가 창을 자르기 전에 「이 행 아래 행이 원본에 하나라도 있는가」 를 행에 적는다 (`CatalogBoundRow` 의 표식 하나). 평면 · 중첩은 하위 행을 자르지 않아 지금도 맞고, 단계 표는 아랫 단계 표 전체의 부모 필드 값 색인으로 정한다 (memo — 시작 key 색인과 같은 단위).
  - resolver 가 그 표식을 항목 record 의 내부 prop 으로 옮기고 (`catalogCascaderLevelKey` 를 싣는 자리 — `resolver.ts:1031`), `cascaderStaticItems` 가 `hasChildItems` 로 읽는다 (단계별 로드의 읽지 않은 가지가 들어오는 자리 — `cascader.ts:308`). 표 함수는 고치지 않는다.
  - 판정만이 아니라 그림에도 쓰인다 — 자식이 잘린 가지 행도 Canvas 에서 chevron 을 갖는다 (Preview 와 같은 줄).
- **단계별 로드의 읽지 않은 가지**: Preview 세션이 `branchKeys` 를 정하는 판정 (endpoint 가 `{{ parentKey }}` 를 읽고 key 유일을 선언 · 행의 자식 표시 필드 · 읽은 단계 — `catalogPreviewSession.ts:3044-3115`) 을 순수 함수로 꺼낸다 (`runtime/cascaderLevels.ts`). 세션은 자기가 읽은 단계 상태로, Builder 의 행 읽기는 「읽은 단계 없음」 으로 같은 함수를 부르고 결과를 위와 같은 행 표식에 적는다. 막 연 Preview 가 바로 그 상태다 (첫 열기의 자식 단계 `load` 0 회 — Round 2 실측). 그래서 시작 값이 읽지 않은 가지의 key 면 두 쪽 모두 `branch` (값 글자 = key), 읽지 않은 단계 안의 key 면 두 쪽 모두 `missing` 이다.
- **닫는 근거 — 불변식 하나**: 시작 key 마다, Builder 표의 `cascaderValueMatch` 종류 · 그 항목의 조상 key 사슬 · 경로 이름이 계층 전체로 만든 표와 같다. 재료는 셋뿐이다 — 그 key 를 가진 항목 전부 (남김) · 각 항목의 가지 여부 (자식 유무 표식) · 조상 (남김). `anyLevel` 은 같은 prop, `conflicts` 는 단계를 읽은 뒤에만 생긴다. 이 불변식을 P8 이 무작위 대조로 본다 (seed 고정 — 무작위 계층 × 세 모양 × 창 크기 × 시작 key, 겹치는 key 를 일부러 섞는다).
  - 색인 (key → 뿌리 · 행) 은 원본 행 배열 단위로 memo 한다 — 편집마다 다시 훑지 않는다 (본문 R4).

- **결과**: 시작 key 에 대해 Builder 의 표와 Preview 의 표가 같은 판정 · 같은 조상 사슬을 낸다. `cascaderOpeningView` · `cascaderTrail` · 닫힌 필드의 값 글자 (`cascaderValueText`) 가 모두 같은 답이다. Design 패널 Value 칸의 선택지에도 지금 값의 항목이 들어온다.
- **달라도 되는 것**: 상자 아래로 넘친 뒤쪽 행의 수와 자리 (뿌리 5,000 중 Canvas 는 100 + 남긴 행) — 보이는 행이 아니다 (§4.5). 겹침 알림의 개수 (닫힌 필드 Description — ADR-322 그대로 표본 기준).
- 판정 (P8 · G5) — 선택 key 의 판정과 시작 부모를 같이 본다: (1) 부모 120 × 자식 1 · 시작 `R120-1` 을 세 모양으로 — `item` · 부모 `R120`, drill 의 행 key 가 Preview 와 같음. (2) 창 밖에 같은 key 하나를 더 둔 입력 — 두 쪽 모두 `duplicate`. (3) Round 2 의 입력 — 뿌리 가지 `X` (유일한 자식이 아랫 표 102 행) 와 `P` 아래 잎 `X` (101 행) — 두 쪽 모두 `item` · 부모 `P`. (4) 단계별 로드 — `11=서울` (읽지 않은 자식) 에서 시작 `11` 은 두 쪽 `branch`, 시작 `11-1` 은 두 쪽 `missing`. (5) 위 불변식의 무작위 대조. 원복 RED (시작 경로 보존을 끄면 (1) 이 `missing`, 자식 유무 표식을 끄면 (3) 이 `duplicate`).

## 5. 「열리는 picker」 목록 — Cascader 를 넣을 자리

| 목록 · 분기                                      | 자리                                        | 넣는 까닭                                      |
| ------------------------------------------------ | ------------------------------------------- | ---------------------------------------------- |
| `OVERLAY_OPEN_OWNERS`                            | `runtime/overlayState.ts:12-23`             | Canvas 열림 판정 · 선택 테두리 · 증분 의존     |
| `CATALOG_OPEN_PICKER_TYPES`                      | `runtime/runtimeStateProps.ts:145`          | 안쪽 Popover 의 열림 소유 = Cascader           |
| `CONTEXT_PLACED_POPOVER_PARENTS`                 | `runtime/domBinding.runtime.ts:3359`        | Popover 기본 placement 를 빼고 context 값 사용 |
| context 배치 배열 · 닻                           | `runtime/overlayLayout.ts:76 · 172-184`     | Canvas 배치 (닻 = Button — 기본 분기 확인)     |
| 폭 분기 `ownerType === "Select" \|\| "ComboBox"` | `runtime/compositionRoot.ts:6445`           | Canvas 폭 = 닻 폭                              |
| `s2MenuWidthStyle` · `LISTBOX_PICKER_TYPES` 분기 | `runtime/domBinding.runtime.ts:3385 · 3851` | DOM 폭 · 충돌 여백 (Select 와 같은 값)         |
| trigger 부품의 `_overlayOpen`                    | `runtime/presence.ts:3507-3540`             | 여는 Button 의 눌림 표시                       |
| `OVERLAY_OPEN_PROPS`                             | `bindings/Cascader.binding.ts`              | 패널 Open                                      |

Phase 4 의 G4 가 이 표를 한 줄씩 대조한다 (누락 = Canvas 와 Preview 가 갈리는 자리).

## 6. Phase 0 시제품 (G0)

| ID  | 확인                                                                                                                                                                                                                                                                                                                                                                            | no-go 면                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| P1  | catalog Popover 노드가 필드의 context (`trigger: "Cascader"`) 로 열리고 닫힘 — 메뉴 이름 · focus 복원 · Esc (columns · tree)                                                                                                                                                                                                                                                    | context 이름은 그대로 두고 Popover 노드에 class    |
| P2  | SearchField 노드 + RAC `Autocomplete` 감싸기 — 입력 focus · 목록 가상 focus · → 로 하위 단계                                                                                                                                                                                                                                                                                    | 검색 칸만 lazy chunk 가 같은 renderer 로 직접 그림 |
| P3  | RAC `Dialog` 의 `display: contents` — 접근성 트리의 role · 이름 (Chrome · WebKit)                                                                                                                                                                                                                                                                                               | §4.3 의 `:is()` 별칭 블록                          |
| P4  | `CascaderItem` 이 줄 (이름 · chevron · 선택 표시) 을 직접 그림 — Canvas primitive · 글자 측정                                                                                                                                                                                                                                                                                   | 사용자 결정 2 의 대안 (Text · Icon 자식 노드)      |
| P5  | Canvas 에서 `pass` 항목 (`display: contents`) 아래의 줄이 목록 상자에 바로 놓임 (drill)                                                                                                                                                                                                                                                                                         | drill 은 지금 단계의 항목만 목록 직계로 투영       |
| P6  | 경로 자리 넷 (§4.4) — 깊이 2 · 4 · 6 × 폭 둘에서 「crumb 을 전부 그린 Breadcrumbs」 와 보이는 crumb · rect 가 같음 (Canvas · Chrome) · `root > A > B > C > D > E` 를 폭 310px (끝 둘이 보임) · 180px (하나만 보임) 에서: 보이는 crumb 의 위치 · 메뉴의 모든 key · 클릭 결과가 기준 Breadcrumbs 와 같음 — 180px 에서 메뉴의 `D` 를 누르면 `D` 단계로 이동 (리뷰 m5 의 종결 조건) | 멈추고 사용자 보고 (§4.4 끝)                       |
| P7  | 번들 기준선 (일반 `vite build` → `adr209-bundle-closure.mjs`) · 전용 CSS 삭제분 추정                                                                                                                                                                                                                                                                                            | — (사용자 결정 1 의 숫자)                          |
| P8  | 시작 경로 보존 (§4.7) — 부모 120 × 자식 1 · 시작 `R120-1` 을 세 모양으로: 선택 key 의 판정 · 시작 부모가 Builder 표 = Preview 표 (§4.7 의 입력 (1) ~ (4) + 고정 seed 무작위 대조 · 자식 유무 표식을 끄면 (3) 이 `duplicate` — 리뷰 h1 의 종결 조건) · 5,000 행 연결의 편집 1 회 비용                                                                                            | 단계 표 모양만 막히면 그 모양의 보존 범위를 보고   |
| P9  | 행 ↔ record (§4.3) — 한 항목의 배경 편집이 세 방식 · 검색 결과의 그 RAC 행에만 닿고 Undo 로 돌아옴 · 모양 편집이 항목 표를 다시 만들지 않음                                                                                                                                                                                                                                     | 행 입력을 표와 함께 다시 만드는 길 (HC4 재측정)    |

## 7. Phase

| Phase | 내용                                                                                                                                                                                                                                                                                                                                    | Gate |
| :---: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--: |
|   0   | 코드 사실 재대조 · 시제품 P1 ~ P9 · 사용자 결정 1                                                                                                                                                                                                                                                                                       |  G0  |
|   1   | 문서 구조 — 원본 template · `accepts.mode` · `bindingMaps` · `CascaderList` 등록 (binding · rule · traits · nesting · 항목 표) · contract 88 · 항목 읽기 함수 (§4.2) · 바인딩 명령 · resolver · 시작 경로 보존 (§4.7 — 닫힌 필드의 값 글자가 먼저 맞는다). Preview 는 지금 조립 그대로 (Popover 노드는 아직 그리지 않는다), Canvas 닫힘 |  G1  |
|   2   | DOM columns — 필드가 context 를 항상 줌 · Popover · SearchField 노드 렌더 · `cascaderlist` lazy 본문 · 항목 행 class 와 행 ↔ record (§4.3) · 열린 상자 rule 블록 (폭 · 테두리)                                                                                                                                                          |  G2  |
|   3   | DOM tree · drill — `Dialog` 배치 · 경로 자리 넷 (§4.4) · Breadcrumbs 접힌 메뉴의 `onAction` · 「뒤로」 · `CASCADER_PANEL_STYLES` 삭제 · HC3 정적 검사                                                                                                                                                                                   |  G3  |
|   4   | Open — binding · §5 의 목록 · 시작 상태 함수 · 항목 표시 상태 · Canvas columns 막 연 화면 · 패널 · 선택                                                                                                                                                                                                                                 |  G4  |
|   5   | Canvas tree · drill 막 연 화면 (경로 자리의 파생 값 · 접힘) · 대칭 하니스 (세 방식 — 표본 창 밖 값 · 항목 모양 편집 포함)                                                                                                                                                                                                               |  G5  |
|   6   | 종결 — HC4 재측정 · 번들 합계 · live 전체 · VoiceOver 청취 · 규칙 문서 (`catalog-subparts.md` 「picker 의 선택 목록」 · `canvas-rendering.md` · `data-interaction.md` 의 Cascader 표본) · ADR-322 대체 표시 · CHANGELOG                                                                                                                 |  G6  |

Phase 1 은 구조만 바꾸고 화면은 같다 — 여기서 커밋 가능 상태를 한 번 만든다 (R1 을 먼저 닫는다). 시작 경로 보존은 닫힌 필드에서도 보이는 변화라 Phase 1 의 live 에 한 줄 (표본 밖 값 → 경로 글자) 을 넣는다.

## 8. 파일 추정 (Phase 0 에서 확정)

| 영역          | 파일                                                                                                                                                                                                                                                                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 문서 · 등록   | `document/cascaderOrigins.ts` · `document/types.ts` (contract) · `bindings/Cascader.binding.ts` · `bindings/index.ts` · `componentCatalog.ts` · `domain/componentTraits.ts` · `document/collectionItems.ts` · `document/sizePropagation.ts` · `d2Provenance.ts`                                                                                             |
| rule · CSS    | `generated/componentRulesTable.ts` · 생성 CSS (`Cascader.css` · `CascaderItem.css` · 새 `CascaderList.css`) · `rendering/__tests__/catalogCss.test.ts` (파일 수)                                                                                                                                                                                            |
| 항목 · 데이터 | `runtime/cascader.ts` (`recordId` · `cascaderOpeningView` · `cascaderTrail`) · `runtime/dataBinding.ts` (남길 key) · `resolution/resolver.ts` · `commands/collections.ts` · `apps/builder/…/dataBindingCommand.ts` · `apps/builder/…/catalogDataRead.ts` · `apps/builder/…/itemInsert.ts`                                                                   |
| DOM           | `runtime/delegatedDom.runtime.ts` · `runtime/delegatedDom.components.tsx` (`BreadcrumbsRun` 메뉴 `onAction` · 실제 crumb 수) · `runtime/cascader.components.tsx` · `cascaderOverlay.components.tsx` · `cascaderMenu.components.tsx` · `cascaderPanel.components.tsx` · `cascaderSearch.components.tsx` · `domBinding.runtime.ts` · `domRegistry.runtime.ts` |
| Canvas · 열림 | `runtime/presence.ts` · `runtime/overlayState.ts` · `runtime/overlayLayout.ts` · `runtime/compositionRoot.ts` (`settleOverlays` · `settleBreadcrumbs`) · `runtime/breadcrumbsCollapse.ts` · `runtime/runtimeStateProps.ts` · `document/rulePartRules.ts` · `apps/builder/…/ruleShapes.ts`                                                                   |
| 패널 · i18n   | (Open 은 계약에서 자동) · `apps/builder/src/i18n/messages/*` (검색 칸 접근 이름 등 문구가 늘면)                                                                                                                                                                                                                                                             |
| 테스트 · live | `adr322*` 단위 5 · `adr322D1Static` · 새 `adr326*` (구조 · 시작 상태 · 경로 자리 · 시작 경로 보존 · 행 ↔ record · HC3 정적) · Breadcrumbs 접힘 단위 · 대칭 하니스 · `apps/builder/scripts/adr322-g*-live.mjs` 재사용 + `adr326-*-live.mjs`                                                                                                                  |
| 문서          | 규칙 셋 · ADR-322 본문 표시 · README · CHANGELOG                                                                                                                                                                                                                                                                                                            |

추정 shared 26 ~ 32 · builder 7 ~ 10 · rendering 1 ~ 2 파일 + 테스트.

## 9. Phase 결과

### Phase 0 — G0 닫힘 (2026-11-28, HEAD `90b35a386` → `bea55a323`)

**코드 사실 재대조 (F1 ~ F19)** — 내용 차이 0. 줄 이동: F2 `cascaderMenu.components.tsx` RAC `Popover` :167 → :168 · F3 Select 블록 `componentRulesTable.ts:1873-1890` · F4 Cascader 블록 :1639 · F12 `LIBRARY_CONTRACT_VERSION` 87 은 `types.ts:223` (변환 없음 주석 :222). 단서 둘: F5 의 닻 — `overlayLayout.ts:76-82` 에서 Button 닻은 Select (와 기본 분기) 뿐이고 ComboBox · DatePicker · DateRangePicker 는 `Group` 이다 → Cascader 는 기본 분기 (Button) 로 들어간다 (§5 표 그대로). F10 — RAC `Popover` 는 `trigger` 를 render prop 값으로도 넘긴다 (`Popover.mjs:66` · `:114`) — 동작 분기는 여전히 둘뿐.

**P7 번들 기준선** (일반 `vite build` — `VITE_USE_WEBGL_CANVAS=true VITE_FEATURE_FILL_V2=true pnpm turbo run build --filter=@composition/builder` → `adr209-bundle-closure.mjs`, `90b35a386`): Builder initial JS gzip **1,668,315 B** · Preview **172,335 B** · CSS 57,924 / 68,809 B. **Builder 는 이미 절대 상한 1,668,000 을 315 B 넘었다** (F13 의 1,667,731 뒤 같은 날 커밋들 — `0100635ca` Value 칸 드롭다운 · `14ac34a95` · `0d8655e53` · `22d693c1d`). deploy workflow 의 상한 검사 (`deploy.yml` 「Initial bundle ceiling」) 가 지금 main 을 막는다. 전용 CSS 삭제분 추정: `CASCADER_PANEL_STYLES` 는 rule 표 (`componentRulesTable.ts:1637-1751`) 안이라 initial chunk 에 있다 (dist `assets/utils-*.js` 에 `cascader-panel` 실측) — 그 상수만 gzip 하면 약 730 B 라, 번들 안에서 빠지는 몫은 그보다 작은 수백 B 로 본다 (Phase 3 에서 A/B 로 잰다). 첫 화면에 더해지는 것은 rule 블록 · 표시 파생 · 열림 목록. → 사용자 결정 1 을 묻는다 (G0 조건).

**P8 시작 경로 보존 — go** (`apps/builder/src/builder/catalogRuntime/__tests__/adr326P8StartPath.test.ts`, 8 건):

| 입력                                                     | 계층 전체 (Preview)          | §4.7 규칙             | 원복 RED                              |
| -------------------------------------------------------- | ---------------------------- | --------------------- | ------------------------------------- |
| (a) 지금의 코드 — 부모 120 × 자식 1 · `R120-1` (세 모양) | `item` (실제 resolver)       | —                     | 창 100 = `missing` (F15 재현)         |
| (1) 같은 입력 — 규칙                                     | `item` · 부모 `R120`         | 같음                  | 보존 끔 → `missing`                   |
| (2) 창 밖 같은 key 하나 더                               | `duplicate`                  | `duplicate`           | 지금의 창 → `item`                    |
| (3) Round 2 의 `X` (102 행 자식 · 101 행 잎)             | `item` · 부모 `P`            | 같음 · chevron 유지   | 자식 유무 표식 끔 → `duplicate`       |
| (4) 단계별 로드 `11=서울`                                | `11` branch · `11-1` missing | 같음 (읽은 단계 없음) | 지금의 Builder → `11` `item`          |
| (5) 무작위 6,480 건 (seed `0x326`)                       | —                            | 불일치 0              | 지금의 창 4,238 · 표식 끔 497 건 갈림 |

- 모델의 범위: 평면 · 중첩은 실제 `catalogBoundRows` (전부) 가 만든 트리에서 뿌리만 고른다 (§4.7 표 — 하위 행은 자르지 않는다). 단계 표는 resolver 의 「단계 창 → 부모 거르기 → 높이 표본」 (`resolver.ts:1752-1763`) 을 옮긴 모델이고, 같은 key 의 윗 행 전부를 조상으로 남긴다 (단계 표는 부모를 key 로 찾는다). 「막 연 화면에서 열리는 단계의 행」 은 판정 불변식에 들지 않아 이 시제품 밖이다 (Phase 5 G5).
- 비용 (6): 5,000 행 평면 (부모 1,000 × 4) 에서 지금의 Builder 읽기 2.00 ms · 규칙 (memo 없음 — 뿌리마다 하위 key 훑기) 2.82 ms (Node · vitest, 5 회 중앙값). 평면은 지금도 전체를 투영한 뒤 뿌리를 자르므로 더해지는 것은 훑기뿐이다. 중첩 · 단계 표의 색인은 Phase 1 에서 원본 행 배열 단위 memo 로 (R4).
- reviews/326.md 의 h1 (Round 1 · 2) 을 `fixed` 로 갱신했다.

**P6 경로 자리 넷 — 판정 층 go, live 남음** (`packages/shared/src/catalog/runtime/__tests__/adr326P6TrailSlots.test.ts`, 3 건): 자리 폭 + 실제 crumb 수의 판정 · 판정 뒤 전체 경로의 메뉴가 「전부 그린 Breadcrumbs」 와 같다 — `root > A > B > C > D > E` 310 → 끝 둘 · 메뉴 `A B C`, 180 → 끝 하나 · 메뉴 `A B C D`, 깊이 2 ~ 8 무작위 3,000 건. 실제 crumb 수 입력은 자리 수를 넘으면 맞지 않는 가지로 보내는 것으로 충분하다 (끝 crumb 루프는 끝 둘만 읽고 둘에서 자른다 — `breadcrumbsCollapse.ts:101-112`).

- **발견 — crumb 의 `flexShrink: 0`**: 이 동치는 crumb 폭이 그려지는 crumb 수와 무관할 때만 성립한다. S2 는 crumb 에 `flexShrink: 0` 을 준다 (`Breadcrumbs.tsx:261` `breadcrumbStyles`). 저장소의 Breadcrumb rule (`componentRulesTable.ts` Breadcrumb `containerStyles`) · 수동 `components/styles/Breadcrumbs.css` 에는 없다 — `nowrap` 줄에서 여러 낱말 crumb 은 min-content 까지 줄어 (엔진 · DOM 모두 CSS 규칙) 전부 그린 폭이 자리 폭보다 작아질 수 있다. Phase 3 에서 S2 값을 rule 에 넣는다 (Breadcrumbs 컴포넌트 자체의 S2 차이이기도 하다).
- **live go (같은 날 이어서)** — `apps/builder/scripts/adr326-phase0-prototypes.mjs` p6 (설치본 RAC `Breadcrumbs` + 폴더 `MenuTrigger` > `Menu` 에 `onAction`, 판정은 제품의 `breadcrumbsCollapse.ts`, 기준 = 전부 그린 Breadcrumbs): 8 입력 (리뷰 입력 crumb 60 · gap 8 · 폴더 32 의 310 · 180 px, 낱말 crumb 깊이 2 · 4 · 6 × 420 · 240 px, crumb `flex-shrink: 0`) 모두 보이는 끝 crumb 수 · 보이는 crumb 의 x · 폭 · 메뉴 key 가 같다 (Chrome 158 · WebKit 27.2). 180 px 에서 메뉴 `A B C D` — `D` 를 누르면 `onAction("D")`, 메뉴의 모든 항목과 보이는 첫 crumb 도 각자 key 로. 보이지도 메뉴에도 없는 조상 0. reviews m5 → fixed. Canvas 쪽 rect 는 자리 파생 값 · `settleBreadcrumbs` 의 crumb 수 입력이 생기는 G3 · G5 에서 잰다.

**P1 · P2 · P3 — go, 조건 하나** (`apps/builder/scripts/adr326Prototypes.mjs` · `adr326-phase0-prototypes.mjs`, Chrome 158 · WebKit 27.2 headless · DPR 1). arm a = 지금의 조립 (ADR-322 — 열 때만 context + RAC `Popover`, `trigger: "MenuTrigger"` · `"DialogTrigger"`), arm b = §4.3 의 조립 (필드가 context 를 늘 줌 · `trigger: "Cascader"` · 제품의 `CatalogPopover` (공용 `Popover` — `data-size="M"` · FocusScope) · 그 children 을 감싼 `Autocomplete` · SearchField 노드 (지우기 버튼 포함) 와 lazy 목록 자리가 형제 · tree 는 RAC `Dialog` `display: contents`). 같은 키 순서 (columns 14 단계 — 열기 · ↓ 가상 focus · → 하위 단계 둘 · Enter 고르기 · Esc 둘 · 검색 입력 → 결과 고르기 · 바깥 클릭 · Tab / tree 12 단계 — 열기 · Tab · → 펼침 · 고르기 · Esc · 검색 · 바깥 클릭) 의 focus · 가상 focus · 열린 메뉴 수 · 펼친 행 · 이름 (trigger · popover · 목록 · Dialog) · 값을 arm a 와 대조:

- **바깥 클릭 뒤 focus 만 갈림** — arm a 는 여는 Button, arm b 는 `body` (Chrome columns · tree, WebKit tree) → 다음 Tab 이 필드 앞 요소로 간다. 원인: 공용 `Popover` 의 `ContentFocusScope` (`restoreFocus`) 가 RAC `Overlay` 의 FocusScope 안에 한 겹 더 있다. 그 복원을 끄면 (`restoreFocus: false` — RAC `Overlay` 의 것만) 두 브라우저 · 두 방식 모두 arm a 와 **차이 0** · 접근성 트리 같음. → **Phase 2 조건**: Cascader 의 Popover 노드는 공용 Popover 의 복원을 끈다 (`CatalogPopover` 가 `trigger: "Cascader"` 일 때 — 다른 Popover 영향 0).
- **대조군 Select (기존 결함, 이 ADR 밖)**: 같은 `CatalogPopover` > ListBox 의 Select 도 바깥 클릭 뒤 focus 가 `body` 다 (Chrome · WebKit, 복원을 끄면 trigger). Esc · 고르기 뒤는 trigger. Select 를 같이 고칠지는 사용자에게 보고한다 (공용 Popover 의 picker 분기 — 범위 밖이라 여기서 고치지 않는다).
- 접근성 트리 (Chrome = CDP `getFullAXTree`, WebKit = Playwright `ariaSnapshot` — DOM 에서 계산한 값, 브라우저 트리 아님 · WebKit 의 실제 낭독은 G6 VoiceOver): arm b 가 더하는 것은 설계대로의 두 줄뿐 — SearchField 원본의 지우기 버튼 (RAC — Tab 순서 밖) 과 공용 Popover 의 `OverlayArrow` svg (`img` — Select 의 목록에도 같다). 그 밖의 role · 이름 · 부모 관계 같음.
- **P3**: tree 의 `Dialog` 를 `display: contents` (상자 높이 0) 로 두어도 Chrome 의 브라우저 트리에 `dialog` 가 남고 searchbox · 행이 그 안이다 (arm a 의 block Dialog 와 같은 트리). §4.3 의 `:is()` 별칭 블록 대체 길은 필요 없다.
- Tree 는 `Autocomplete` 의 collection context 를 읽지 않아 (RAC 1.22.1 `Tree.mjs` — `SelectableCollectionContext` 없음) 같은 `Autocomplete` 안에 두어도 자기 focus 를 지킨다 (위 tree 단계 차이 0). drill 의 `GridList` 는 그 context 를 읽는다 (`GridList.mjs:6`) — 한 `Autocomplete` 아래 drill 흐름은 리뷰 Round 1 의 대조가 통과했다. Phase 3 의 G3 가 다시 잰다.
- **측정 범위 밖**: VoiceOver 청취 (G6 사용자) · 실제 catalog renderer 가 그리는 SearchField 노드의 부품 구조 (Phase 2 — 시제품은 RAC SearchField + Input + 지우기 Button).

**P4 — go (코드 근거, 등급 A)**: owner 가 자기 상자 안 자리에 글자 · 글리프를 그리는 Canvas 길이 이미 있다 — Step 의 번호 (`ruleShapes.ts` `catalogStepChromeShapes` — `type: "text"` · `maxWidth` · `align` · `baseline`, 자리 높이는 `catalogStepLineHeight`), Table 칸의 펼침 chevron (`treeCellChevronShapes` — `icon_font`, 자리는 `catalogBoxModel` 의 padding), 한 줄 말줄임 (`nodeRendererText.ts` `maxLines: 1` · `ellipsis`). 줄의 높이는 줄 높이만큼의 padding-top (§4.5) 이라 엔진이 글자를 재지 않는다 — 글자 측정은 그리는 쪽 (paragraph) 만. 사용자 결정 2 의 권고 길 (노드 수 그대로) 에 막힘 없음. 남은 위험 — 긴 이름의 말줄임 · 글자 자리가 DOM 의 RAC 행과 같은지 — 은 G5 의 rect · `/cross-check` 가 잰다.

**P5 — go** (`packages/engine/src/tree.rs` `contents_two_pass_levels_place_rows_as_list_children`): 세로 flex 목록 상자 (padding · row gap 2) 아래 drill 의 막 연 모양 — 숨긴 형제 (`display: none`) · 지금 단계 조상 두 단이 `display: contents` · 지금 단계 줄 셋 (padding-top 32 · 하나는 숨긴 자식을 가짐) — 의 줄 rect 가 평평한 목록 (줄 셋이 직계) 과 같다 · 목록 높이 같음. 원복 RED: 안쪽 통과 항목을 `block` 으로 바꾸면 실패 (gap 이 줄 사이에 서지 않음 — 바이트 복원 확인). 기존 `contents_*` 넷 (한 단 column · 중첩 row · 증분 재배치) 도 통과.

**P9 — go** (`apps/builder/src/builder/catalogRuntime/__tests__/adr326P9RowRecord.test.ts`, 3 건, 실제 workspace + 팔레트 Cascader): (1) 항목 표의 모든 항목이 자기 CascaderItem record 하나로 되짚어진다 — `cascaderStaticItems` 가 항목 record 를 표 순서로 걷기 때문 · 방식 셋 모두 · 검색 결과도 같은 표 항목. (2) `Books` 한 항목의 배경 편집이 그 record 의 쓴 style (`wroteStyleKey` · `visual` — DOM 의 `writtenStyleOf(recordId)` 가 읽는 것, SideNav · Tree 의 RAC 행이 이미 쓰는 길) 에만 닿고 이웃은 그대로, Undo 로 돌아온다. (3) 모양 편집 (배경 · 글자색) 은 표의 입력 (`cascaderStaticItems`) 을 바꾸지 않고 이름 편집은 바꾼다 — 표를 데이터 서명으로 memo 하면 모양 편집이 표를 다시 만들지 않는다 (HC4). 지금의 DOM 은 렌더마다 표를 새로 만든다 (`delegatedDom.runtime.ts` `cascader` — memo 없음) → Phase 2 에서 서명 memo 를 둔다.

**G0 판정 — 닫힘**: F1 ~ F19 재대조 · 시제품 아홉 go (P1 의 조건 하나는 Phase 2 몫) · 번들 기준선 · 사용자 결정 1 답 (1,672,000 — 그 뒤 ADR-323 몫과 합산해 지금 상한 1,677,000, 이 ADR 몫은 1,668,315 기준 +3,685 까지) · 리뷰 pending 0 (h1 · m5 fixed). Phase 1 은 사용자 결정 2 (항목 글자를 노드로 둘지 — 권고 = 직접 그림, P4 go) 의 답이 필요하다.

**판독 지적 수리 (Phase 1 판독 — codex, 2026-11-28)** — 두 MEDIUM 모두 시제품 · 판정 스크립트의 결함이었다 (제품 코드 변경 0). 고친 뒤 P1 · P3 다시 go (Chrome 158 · WebKit 27.2, arm 차이 0 · 접근성 트리 같음 · 기대값 실패 0 — `b-nr` 선택, 위 「Phase 2 조건」 그대로).

- **m1 (`adr326Prototypes.mjs` — 다시 열면 지난 검색어가 남음) → fixed.** 원인: arm b 의 검색어 `useState` 를 `ContentB` (필드가 context 와 함께 늘 그리는 자리) 에 두었다 — `CatalogPopover` 가 닫혀도 그 상태는 남는다. arm a 는 열 때마다 lazy 몸통이 새로 그려 빈 검색창이다. 수리: 검색어를 Popover 노드의 children 자리 (`SearchScope` — Popover 가 열렸을 때만 그린다) 로 옮겼다. 판정에 「reopen after search」 (결과를 고른 뒤 다시 열기 — 검색칸 값 `""` · 목록 = 단계 목록) 를 더했다. **Phase 2 조건 추가**: `cascader` renderer 가 Popover 노드의 children 을 감싸는 자리 (§4.3) 가 검색어를 갖는다 — 필드 · renderer 본체에 두지 않는다.
- **m2 (`adr326-phase0-prototypes.mjs` — 두 arm 이 같이 틀려도 go) → fixed.** 원인 둘. (1) 시제품 `LevelMenu` 가 고른 값을 모든 단계 Menu 의 `selectedKeys` 에 넣었다 (제품은 그 단계의 자식만 — `cascaderMenu.components.tsx:71-76`). 루트 Menu 에 보이지 않는 선택이 생겨 RAC 기본 `escapeKeyBehavior: "clearSelection"` (`react-aria` `useSelectableCollection.mjs:187`) 이 Esc 를 삼켰고 (controlled 라 바뀌는 것 없음), 루트가 닫히지 않은 채 뒤 단계 (Enter → 「명」 → ↓ → Enter) 가 루트 항목 「세종」 을 골랐다. 제품의 선택 모델로 고치고, tree 도 제품처럼 `escapeKeyBehavior: "none"` (`cascaderPanel.components.tsx:249`). (2) 판정이 arm a 와의 같음만 보았다 — 단계마다 그 자체로 맞아야 하는 기대값 (`EXPECT` — 고른 잎 이름 · Esc 뒤 닫힘과 focus trigger · 검색칸 값 · 결과 목록 / 단계 목록 · 바깥 클릭 뒤 닫힘) 을 더해, 고른 arm 에 실패가 있으면 no-go. 결과 Menu 의 접근 이름은 MenuContext 의 `aria-labelledby` 가 필드 이름으로 덮으므로 목록은 `data-part` (`results` · `list`) 로 가른다.
- **원복 RED**: 새 판정으로 옛 시제품 (`HEAD` 판) 을 돌리면 Chrome p1 no-go (기대 실패 `Esc again` · `type 명` · `↓ Enter (result)`) · p3 no-go (arm 차이 1 · `reopen after search`), WebKit 도 같다 (+ p1 `reopen after search`). 원복 스크립트 + `cmp` 바이트 복원 확인.
- **발견 — 지금의 Cascader (ADR-322) 기존 결함, 이 수리 범위 밖**: 제품과 같은 선택 모델에서 **루트 단계의 잎** (「세종」) 을 고른 뒤 다시 열면 Esc 로 닫히지 않는다 (arm a · b 둘 다, Chrome — 위 (1) 과 같은 기제: 루트 Menu 의 `selectedKeys` 에 그 잎이 있어 `clearSelection` 이 Esc 를 쓴다). tree · drill 은 Phase 0 의 「finding 1」 로 이미 `escapeKeyBehavior="none"` 이고 columns 의 `cascaderMenu` · `cascaderSearch` Menu 에는 없다. 제품 live 는 아직 재지 않았다 → **Phase 2 조건**: columns 몸통을 옮길 때 단계 Menu · 결과 Menu 에 `escapeKeyBehavior="none"` 을 주고 「루트 잎 고르기 → 다시 열기 → Esc → 닫힘 · focus trigger」 를 G2 live 에 넣는다 (지금 결함의 live 재현을 먼저 기록).

### Phase 1 — G1 닫힘 (2026-11-28, `684ab6b42` · `549426830` · `8a19bd6bf` · `572de01ba` · `baf15b164` · 단위 3)

**단위 1 — 구조 (`f14a8eb7c`)**: 원본 = §4.1 그대로 (`Popover > SearchField + Breadcrumbs (crumb 자리 넷) + ActionButton[slot=back] + CascaderList > CascaderItem…`) · `accepts.mode` + 기본값 `columns` · `bindingMaps.cascaderDrill` + 두 drill 부품의 `presentWith` · contract 88 · 항목 읽기 `catalogCascaderItems` (표 · DOM 구독 · 바인딩 명령) · resolver 의 `"Cascader"` owner 특례 제거 (picker 길로 행이 목록 상자 fill 에 닿는다 — §4.2 의 「먼저 본다」 답: 쓸 수 있다).

- **사용자 결정 2 (Text · Icon 자식 노드) 의 구현 판단**: 항목 원본 `component-cascaderitem` (`CascaderItem > Text[slot=label] {label} + Icon[slot=descriptor] chevron-right XS` — MenuItem 원본의 자리 이름 · 값) 을 nested reusable origin 으로 등록했다 (`NESTED_REUSABLE_ORIGIN_TYPES` — 「+」 가 같은 원본을 쓴다). 이름의 정본은 그대로 항목의 `label` 이다 — 표 · 데이터 연결 (`GROUP_ROW_ITEM` 의 text = `label`) · Design 패널 「Label」 칸 · Value 드롭다운이 바뀌지 않고, Text 는 원본의 `{label}` 바인딩으로 따라간다. 버린 길: Tree · ListBox 처럼 이름을 Text 노드의 글자로 옮기기 — `label` prop (D2) 을 지우고 표 · 연결 · 패널을 모두 고쳐야 해 결정 2 의 범위 (「Layers 에서 글자를 따로 고른다」) 를 넘는다. traits `CascaderItem.children` 에 `Text` · `Icon` 을 더했다. chevron 은 지금 모든 항목에 있다 — 가지일 때만 그리는 것은 Canvas 가 항목을 그리는 Phase 4 (파생 숨김) 몫이다.
- **바인딩 명령**: 행 template 을 목록 상자 자리 (`[root, popover, list]`) 의 fill 에 그 하나만 둔다 (`placeCascaderRowTemplate` — 표본 11 을 사본으로 만들지 않는다. 만들면 표본이 행 옆에 남는다). 연결된 Cascader 의 행 item 판정 (`catalogRowItemGroups`) 은 `CascaderItem` 만 — 경로 줄의 crumb 자리가 행 template 으로 표시되던 것을 막았다.
- **발견 · 수리 (R10, 공용)**: 구조 편집 (도움말 넣기 · 부품 이동 …) 이 instance 자리를 사본으로 만들면 (`materialize.ts`) `presentWith` 가 빠져 drill 부품이 columns 에서도 섰다 (AlertDialog 의 취소 버튼도 같은 기제 — 잠재 결함). 사본이 `presentWith` 를 갖고, resolver 는 fill 의 소유 노드를 그 composite 의 바인딩으로 (`ownedPresence`), Layers (`positions.ts` `ownedPresentWithGiven`) 는 소유자 사슬의 가장 가까운 instance 로 판정한다. 원복 RED 확인 (`adr326Structure.test.ts` 3번).
- 단위 `adr326Structure.test.ts` 4 (구조 · mode 쓰기 · Undo · Redo · 도움말 뒤 · 바깥 instance 의 값 — record 와 Layers). ADR-322 단위 전부 재통과 (fixture 의 contract 숫자 · 항목 자리만 갱신).
- live (chrome-autorun, 5175): 팔레트 Cascader → Canvas record 트리 (Popover 숨김 > SearchField + CascaderList > 항목 · Text · Icon) · Layers `Popover > SearchField + CascaderList` · Design 패널 Mode Drill → Layers 에 Breadcrumbs · Undo / Redo · Publish drill 에서 Electronics › Computers › Laptops 고르기 → 「Electronics / Computers / Laptops」 · 콘솔 오류 0.

**단위 2 — 시작 경로 보존 §4.7 (1) ~ (3) (`493676a4e`)**: 행 읽기 slices 에 `keepKeys` (그 key 를 가진 행 · 그 key 를 품은 뿌리 — 창 밖에서도 원본 순서의 제자리) · `whole` (단계 표 — 전부 읽고 부모별 색인 (`levelRowsByParent`, 행 배열 단위 memo) 뒤 높이 표본, 보존 key 행은 표본 밖이어도 남김). resolver 의 `cascaderKeepKeys` 가 시작 key 에 단계 표가 가리키는 조상을 깊은 단계부터 더한다. 연결된 Cascader 의 `value` · `defaultValue` 쓰기는 구조 변경으로 본다 (`writesCascaderStart` — 행을 다시 읽는다).

- 판단: 단계 표의 자식 유무 표식 (§4.7 「자식 유무 보존」) 을 따로 싣지 않고 단계 표를 전부 읽는 길로 풀었다 — 부모별로 거른 뒤 표본을 자르므로 자식이 있는 항목은 표본에서도 자식 하나 이상을 갖는다 (가지 · chevron 이 Preview 와 같다). 평면 · 중첩은 하위 행을 자르지 않아 표식이 필요 없다. 단계별 원격 로드의 읽지 않은 가지 (§4.7 (4)) 만 표식이 필요하다 — 남은 일.
- 단위 `adr326StartPath.test.ts` 5 (실제 workspace · 창 100): (1) `R120-1` 세 모양 item · 부모 R120 = Preview · (2) 창 밖 같은 key → 두 쪽 duplicate · (3) Round 2 의 X → item · 부모 P · 뿌리 X 가지 유지 · 쓰기 뒤 따라옴 + Undo · 행의 단계 key. 원복 RED: `keepKeys` 끔 → 3 실패, `whole` 끔 → 3 실패.
- live: ADR-322 G4 (Chrome · WebKit) 6/6 PASS (하니스는 행 template 위치만 새 구조로).

**회귀 수리 (`1a8b0aaa0`)**: G6 live R4 「Mapped」 (값 = 이름, 단계는 행 id) 에서 읽지 않은 「중구」 가 잎이었다 — 항목이 원본 instance 가 되며 `catalogCascaderLevelKey` 가 CascaderItem record 로 넘어가지 않았다. 두 자리 (instance 루트로 넘기는 목록 · 루트가 받는 resolver 표식) 에 더했다 — 각 줄 원복 RED. G6 (Chrome · WebKit) 가 Phase 1 이전 판 (`d1f6fc1f3` 소스로 잠시 되돌려 같은 하니스) 과 같다: 3번 「drill 에서 Enter 로 들어가기」 만 실패 — **이전 판에서도 실패** (열면 focus 가 검색 칸 — 같은 날 「검색 늘 표시」 뒤, 이 ADR 밖 · 보고). Phase 3 의 G3 이 drill 키보드를 다시 잰다.

**Phase 1 판독 수리 (codex, 2026-11-28 — `.agent/autorun/20261128-131431-adr326/review-phase-1.json`, HIGH 9)**: 9 건 모두 재현 (단위 RED) 뒤 수리 — rejected · deferred 0. 회귀 테스트 `adr326Review1.test.ts` (구조 7) · `adr326Review1Data.test.ts` (데이터 4), 수리 줄마다 원복 RED 13/13 (원복 스크립트 · 바이트 복원 확인).

| 지적                                                     | 판정 | root cause → 수리                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| h1 `collections.ts:570` 「모두 고정 항목으로 두고」 무시 | 수리 | 행 template 을 넣는 명령이 목록 상자의 자식 목록을 template 하나로 바꿨다 (`setChildList`). `keep` 이면 표본을 먼저 자기 항목으로 만든 뒤 (`ensureChildList` — 고친 이름 포함) 뒤에 붙인다 (`placeCascaderRowTemplate` `keepItems` · `rowTemplateInsert` 가 mode 를 받는다). 「첫 항목을 템플릿으로」 는 그대로 표본이 행에 자리를 내준다.                                                                                                                                                    |
| h2 `resolver.ts:3549` 컴포넌트 안 단계 key               | 수리 | 1a8b0aaa0 이 소유 노드 경로에만 넣었다 — project template 의 중첩 composite 자리 (`projectTemplate` 의 `instanceRoot` 목록) 에도 `catalogCascaderLevelKey`.                                                                                                                                                                                                                                                                                                                                   |
| h3 `resolver.ts:3505` 컴포넌트 안 시작 경로              | 수리 | `projectTemplate` 의 자기 바인딩 행 읽기가 `keepKeys` 없이 읽었다 — props 가 정해진 뒤 Cascader template 노드면 `cascaderKeepKeys` 로 다시 읽는다 (start key 가 있을 때만).                                                                                                                                                                                                                                                                                                                   |
| h4 `resolver.ts:1780` 변수 시작 값                       | 수리 | resolver 는 record 의 `{{ }}` 해석 전에 시작 key 를 읽었다. 행 source 에 `stateProps` (그 노드의 페이지 · 프로젝트 · 입력 변수로 푼 props — `catalogNodeStateProps`, compositionRoot 가 `viewStateSource` 로 구현) 를 두고 `cascaderKeepKeys` 가 `value` · `defaultValue` 를 그것으로 푼다.                                                                                                                                                                                                   |
| h5 `delegatedDom.runtime.ts:4698` 목록 지운 뒤 Undo      | 수리 | `watchesChildren` 이 목록 상자가 있을 때만 Popover 를 구독했다 — Popover 는 늘 구독한다.                                                                                                                                                                                                                                                                                                                                                                                                      |
| h6 `resolver.ts:5077` 바깥 instance 의 mode              | 수리 | (record) inner owner 의 fill 사본이 `projectTemplate` 로 그려질 때 `presentWith` 를 볼 바인딩이 없었다 — 그 fill 동안 `ownedPresence` 를 세우고 project 노드의 판정이 그것을 읽는다. (Layers) `presentWithGiven` 이 바깥 instance 의 경로 patch 를 읽지 않았고 (`overridesAt` 로 덧씌움), project template 노드의 사본 (자기 fill) 을 그 노드의 자리로 보지 않았다 · 마지막 instance 단계가 project 노드면 그 노드의 props (`nodePropsOnPath`). 도움말 없는 대조군의 Layers 도 같이 고쳐졌다. |
| h7 `cascaderOrigins.ts:55` 변수 mode                     | 수리 | 같은 기제 (h4) — `templateBindings` 의 `bindingMaps` 가 `stateProps` 로 푼 값을 고른다 (소유 · template 두 호출부). Layers 는 문서의 변수 기본값으로 푼다 (`canvasStateValue` — Canvas 와 같은 값). Preview 실행 중 변수가 바뀌면 `refreshState` 가 그 변수를 읽는 구조 prop (`writesPresentWith` · `writesCascaderStart` 대상) 의 노드를 `refreshNodes` 로 다시 해석한다 (지적 밖 같은 기제 — 값만 다시 읽어 drill 부품이 서지 않았다).                                                      |
| h8 `cascaderOrigins.ts:114` 「+」 항목의 이름            | 수리 | `catalogItemRowFill` 이 원본의 `{label}` 자리 (항목 Text) 에 경로 patch 로 고정 글자를 써 바인딩을 끊었다. 원본이 `label` 을 받으면 (CascaderItem · Step) 이름은 항목의 `label` prop 에 쓴다.                                                                                                                                                                                                                                                                                                 |
| h9 `resolver.ts:1836` 단계 표 전체 재투영                | 수리 | 부모 행마다 `whole` 읽기를 다시 해 행 배열이 매번 새것이었고 색인 WeakMap 이 늘 빗나갔다. 한 resolution 안에서 (노드 · 경로) 마다 한 번 읽고 기억한다 (`wholeLevelRows`). 부모 120 × 자식 5 의 시작 값 쓰기 1회 = 전체 읽기 2 회 이하 (단위 게이트).                                                                                                                                                                                                                                          |

- 판단: h4 · h7 은 resolver 에 상태 env 를 넣지 않고 행 source 의 선택 함수로 풀었다 — resolver 가 `{{ }}` 를 읽는 곳은 이 두 자리뿐이고, 행 source 에는 이미 같은 모양의 선택 함수 (`pages` · `tableColumns` · `filterTree`) 가 있다. 원본 정의 (`bindingMaps`) 를 쓰는 AlertDialog 의 `variant` · `cancelLabel` 도 같은 길로 변수 값을 따른다.
- 회귀: shared 전체 3057 통과 · builder Cascader · 항목 「+」 · Step · AlertDialog 스위트 18 파일 153 통과. builder unit (catalogRuntime · preview) 병렬 전량은 shared 와 동시에 돌린 탓에 시간 초과 21 — 그 9 파일을 HEAD src 로 돌려도 18 실패 (같은 시간 초과), 나머지 3 은 단독 2회 통과, 9 파일 순차 실행 (`--no-file-parallelism`) 은 전부 통과.
- live (chrome-autorun, 5175 — 새 프로젝트, `__COMPOSITION_CATALOG__` 명령 · 같은 Builder workspace): (h8) Cascader 「+」 → 넷째 항목 label · Text 「Item 4」, label 을 「New Label」 로 → Canvas Text 도 「New Label」. (h1) Books → 「My books」 뒤 「keep」 연결 → 항목 Electronics · Clothing · My books · Remote, 해제 → Electronics · Clothing · My books · Item. (h6) 도움말 + Create Component + instance mode drill → Canvas record 와 Layers (`readModel.childRows`) 모두 SearchField · Breadcrumbs · ActionButton · CascaderList (전에는 columns 부품). (h7) 프로젝트 변수 panelMode = drill · mode `{{ panelMode }}` → record mode drill · Canvas · Layers 모두 drill 부품. 콘솔 오류 0. h5 (DOM 구독) 는 Preview 의 React 구독 목록이라 단위 (`watchesChildren` 반환 — Popover 포함, 원복 RED) 로만 확인했다.

**수리 검증 (codex verify-1, 2026-11-28) — HIGH 5 남음 → 실행자 수리 (autorun 밖, 모니터 세션)**: 앞 수리가 만든 결함 5 건. 모두 재현 · 수리, rejected · deferred 0.

| 지적                                                          | 판정 | 원인 · 수리                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| v1 `stateTemplate.ts:491` 컴포넌트 안 Cascader 의 페이지 변수 | 수리 | `catalogNodeStateProps` 의 변수 목록이 노드 owner 사슬만 걸어 원본 정의에서 끝났다 — record (`catalogRecordVariables`) 는 instance 가 선 페이지를 읽는다. instance 경로의 바깥 instance 에서 페이지로 이어 간다 (`throughInstances` — 이 함수만, `catalogBindingKey` · 보기 `!var` 는 그대로). 시작 값 · `bindingMaps` (mode) 둘 다. |
| v2 `compositionRoot.ts:3655` instance override 의 변수 mode   | 수리 | `refreshState` 의 구조 재해석 대상이 `entry.props` 만 봤다. instance 의 `descendantOverrides` patch props 도 같은 판정 (자리 노드 · library template 의 `presentWith` 키 — `presentWithKeysOf`) 으로 본다.                                                                                                                           |
| v3 `collections.ts:579` keep 의 반복 템플릿                   | 수리 | `keepItems` 가 새 항목을 만들어 공용 `keep` (마지막 항목 복제 — 설정 포함) 을 건너뛰었다. 이제 항목만 자기 노드로 만들고 (`ensureChildList`) 반복 템플릿은 `markRowTemplates` 가 만든다 — 도움말을 먼저 넣은 대조군과 같은 길.                                                                                                       |
| v4 `positions.ts:275` Layers 의 PropVar                       | 수리 | `canvasStateValue` 가 `{{ }}` 만 풀었다 — `!var.<id>[.path]` 도 같은 기본값 목록에서 id 로 읽는다.                                                                                                                                                                                                                                   |
| v5 `positions.ts:252` AlertDialog 빈 변수 cancelLabel         | 수리 | Layers 는 변수 값 (빈 글자 → 없음), resolver 는 `{{ }}` 원문 (→ 있음) 으로 갈렸다. resolver 의 `presentWith` 판정이 `templateBindings` 의 변수 값 (`presenceValues` — bindings 원문은 자리 글자용으로 그대로) 을 읽는다. S2 `{cancelLabel && <Button>}` 과 같다.                                                                     |

- 회귀 6 (`adr326Review1` 「수리 검증」 5 · `adr326Review1Data` 1), 원복 RED 6/6 (수리 줄마다 되돌려 해당 테스트만 실패 · 바이트 복원 확인). type-check 통과 · G3 ratchet 105 = 기준선 · shared `--changed` 통과 · builder `--changed` 의 실패 17 파일은 동시 실행 시간 초과 — 단독 실행 전부 통과 (parity 2 포함).
- live (Playwright, 5175 새 프로젝트, `__COMPOSITION_CATALOG__`): (v1) 페이지 변수 pageMode = drill · mode `{{ pageMode }}` · Create Component → instance 의 Popover 자식 DOM · Canvas · Layers 모두 SearchField · Breadcrumbs · ActionButton · CascaderList. (v4) mode = `!var` 프로젝트 변수 (drill) → 셋 모두 drill 부품. (v5) cancelLabel `{{ cancelText }}` (빈 값) → 취소 버튼 record 0 · Layers 0, `Cancel` → 1 · 1, Undo → 0 · 0. 콘솔 오류 0. v2 (Preview 실행 중 변수) · v3 (데이터 연결) 은 단위로만.

**단위 3 — §4.7 (4) 단계별 원격 로드의 읽지 않은 가지 · HC4 (2026-11-28)**:

- **판정 함수 하나** (`runtime/cascaderLevels.ts`): `cascaderLoadsLevels` (endpoint 가 `{{ parentKey }}` 를 읽고 key 유일 선언 · mock 아님) · `cascaderBranchKeys` (읽은 단계를 뺀 행 중 자식 표시 필드가 `true` — 필드가 없으면 모든 행) · `collectionRowKeyOf` (ADR-325 의 행 key — 세션 `dataKeyOf` 를 옮겼다) · `cascaderFieldKey`. 세션 `cascaderLevels` 는 자기 단계 상태로, Builder 의 행 읽기 (`catalogBuilderBoundRows` → `cascaderLevelsRead`) 는 「읽은 단계 없음」 으로 같은 함수를 부른다 — 막 연 Preview 와 같은 상태. Builder 는 그런 Cascader · 단계 항목의 행을 Preview 처럼 `remoteLevels` 로 읽고 (행의 단계 key = collection key), 자식이 없는 행 중 가지인 것에 표식 (`CatalogBoundRow.levelBranch`) → resolver 가 항목 record 의 내부 prop `catalogCascaderBranch` (단계 key 와 같은 목록 `CASCADER_ROW_MARKS` 로 항목 원본 루트까지) → `cascaderStaticItems` 의 `hasChildItems`. 표 함수는 고치지 않았다.
- 단위 `adr326LevelBranches.test.ts` 2 (실제 workspace + Preview 세션 · 채널 · `CATALOG_DATA` — 표식 필드 있음 · 없음): 시작 `11` 은 두 쪽 `branch`, `11-1` 은 두 쪽 `missing`, `36` 은 표식 필드가 `false` 면 `item` · 필드가 없으면 `branch`. 원복 RED 3/3 (Builder 표식 끔 · `cascaderStaticItems` 읽기 끔 · 넘김 목록에서 뺌 — 모두 Builder 쪽 `item`).
- live (chrome-autorun, 5175 — 새 프로젝트, endpoint 응답은 페이지 fetch 대체): Cascader 셋 (시작 `11` · `36` · `11-1`) 에 Data 패널 「Test」 로 첫 응답 → Canvas 항목 record 의 표식 서울 · 부산 = 가지 · 세종 = 아님, 닫힌 필드 값 글자 (SelectValue 파생) `11` · `세종` · `11-1`. Publish 같은 문서 `11` · `세종` · `11-1`. 콘솔 오류 0.
- **HC4 — 발견 · 수리 (결정 2 의 비용)**: 322 HC5 하니스가 Builder 의 문서 준비 단계에서 멈췄다. 연결된 Cascader 의 template 이 묶은 prop (`label` · `description` · `size` …) 하나를 쓰면 `bindingDependents` 가 그 instance 아래 record 를 모두 다시 해석하는데, record 마다 따로 pruned 해석을 했고 그 경로가 행 계층 전체를 다시 투영했다 — record × 행. 항목마다 Text · Icon 이 생겨 (결정 2) record 가 셋이 되며 커졌다: label 쓰기 1회 = record 1,307 에 7.8 s, 3,917 에 67 s (resolver 방문 536,602 / record 806). 수리: 큐에 같은 record 아래 후손이 16 개 이상이면 그 record 의 subtree 를 pruned 해석 한 번으로 풀고 후손은 그 결과에서 읽는다 (`compositionRoot.ts` `bulkPruned` · `resolvePruned(…, subtree)` — 같은 resolver, 호출만 하나). 결과: 3,917 record 0.37 s · 16,697 record (5,000 끝 항목) 2.6 s. 단위 `adr326BindingDependentsScale.test.ts` (방문 < record × 4 · label · description · size · Undo 뒤 record 가 새 root 와 같음), 원복 RED (536,602 방문). builder catalogRuntime 전체 4,470 통과.
- HC4 재측정: record — 5,555 항목 (5 × 10 × 10 × 10) 에 16,696 (항목당 3.0 — 항목 · Text · Icon, 선형). 열기 — 322 HC5 하니스 (`HC5_ONLY`, fresh dev 서버 5176): Chrome 1x ×0.31 ~ 0.35 · 4x ×0.21 ~ 0.24 · WebKit 1x ×0.35 ~ 0.58 (기준 ×1.5 안, 322 의 Chrome 4x ×0.19 ~ 0.21 · WebKit 1x ×0.38 ~ 0.43).
- 측정 함정: 실행 중인 dev 서버에서 소스를 고치면 앱의 모듈 URL 이 `?t=` 판이 되어, 하니스의 `import("/src/builder/stores/data.ts")` 가 다른 store 인스턴스를 받고 `applyDataChange` 가 끝나지 않는다 — 소스를 고친 뒤의 live 는 새 dev 서버로.

**G1 판정 (2026-11-28)**: ADR-322 의 기존 판정 재통과 — 단위 (data · levels · wiring · form · run + 326 의 구조 · 시작 경로 · 판독 · 단계 가지 · 규모) 13 파일 76, shared 3,081 · Preview 1,416 · builder catalogRuntime 4,470 통과. live G4 (Chrome · WebKit) 6/6 · G6 11/12 (3번 「drill 에서 Enter 로 들어가기」 만 실패 — Phase 1 이전 판에서도 실패, 이 ADR 밖 · Phase 3 의 G3 이 drill 키보드를 다시 잰다). 원본 등록 검증 · 방식 변경에 drill 부품이 서고 사라짐 (R10 — 단위 1 · 판독 수리의 원복 RED · live). `pnpm codex:preflight` — guard · format · typecheck · registration · css-boundary · chart-contract · agent-catalog 통과, rule-size 만 실패 (`canvas-rendering.md` 55,244 > 55,100 · `panel-structure.md` 39,913 > 39,624 — 이 Phase 가 고치지 않은 규칙 파일, HEAD 그대로 · 보고). **닫힘.** 다음 Phase 2 (DOM columns) — 조건은 task-state 의 Phase 2 메모 (검색어 상태 자리 · 결과 Menu Esc · 공용 Popover 의 focus 복원 · 표 서명 memo · 항목 recordId).
