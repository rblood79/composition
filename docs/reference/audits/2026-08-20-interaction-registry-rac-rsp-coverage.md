# 인터랙션 registry 커버리지 감사 — RAC / RSP 레퍼런스 대조

> 작성: 2026-08-20
> 대상: `packages/shared/src/interactions/capabilityRegistry.ts` ↔ `.agents/skills/react-aria/references/components` (RAC 52종) + `.agents/skills/react-spectrum/references/components` (RSP 71종)
> 계기: React Aria 공식 예제 "Filterable CRUD Table"(식물 추적 앱 — 검색·필터·정렬·열 리사이즈·추가/수정/삭제 다이얼로그·폼 검증)을 컴포넌트 패널의 컴포넌트 추가 + 인터랙션 패널의 이벤트 추가만으로 재현할 수 있는지 판정 요청
> 참조: [ADR-158](../../adr/completed/158-interactions-rules-capability-registry.md)(Implemented), [ADR-152](../../adr/152-data-panel-collection-binding-integration.md)(Proposed), [ADR-159](../../adr/completed/159-collection-field-template-binding.md)(Implemented), `.claude/rules/ssot-hierarchy.md`

## 결론

1. **CRUD 예제는 현재 재현 불가**다. 컴포넌트 배치는 전부 되고, 목록 표시는 설계상 되나 Preview 에서 0행이며, 추가·수정·삭제는 해당 액션이 존재하지 않는다.
2. registry 는 원칙(RAC 레퍼런스 기준)은 이미 지키고 있으나 **커버리지가 절반**이다. 팔레트 61종 중 등록 26종, 등록된 26종 안에도 레퍼런스 대비 누락 callback 이 있다.
3. `deferred` 12종의 차단 원인은 **하나가 아니라 둘**이며, 그중 4종은 렌더러 한 줄 수정으로 풀린다.

| 축                       | 실측                                                             |
| ------------------------ | ---------------------------------------------------------------- |
| 팔레트 타입              | 61                                                               |
| registry 등록            | 26 (43%)                                                         |
| 미등록 중 근거 있는 것   | 17 (RAC 11 + RSP 6)                                              |
| 미등록 중 근거 없는 것   | 18 (표시 전용 / composition 자체 타입)                           |
| 등록됐으나 callback 누락 | 15종에서 발견 (`Table` 의 `onSortChange` / `onRowAction` 포함)   |
| `deferred` (Do 축 보류)  | 12 — 원인 A(prop 통로 없음) 8 + 원인 B(렌더러 uncontrolled) 4    |

## 1. 조사 방법

- 레퍼런스 원본(`react-aria.adobe.com` / `react-spectrum.adobe.com`)은 이 실행 환경의 egress 정책에서 차단되어, 저장소에 동봉된 스킬 레퍼런스 스냅샷을 근거로 삼았다.
- 각 레퍼런스 문서의 `## API` 표(또는 `## Props API` / `## Events` 절)에서 prop 행을 파싱해 `on[A-Z]` callback 과 controlled prop 을 추출했다.
- DOM 상속 callback(`onClick` / `onMouseEnter` / `onKeyDown` / `on*Capture` 등)은 제외했다 — ADR-158 이 DOM 별칭 10종을 은퇴 어휘로 규정했기 때문이다.
- 팔레트 목록은 `apps/builder/src/builder/panels/components/paletteItems.ts` 의 `PALETTE_ORDER`, registry 는 `CAPABILITY_REGISTRY` 를 직접 파싱했다.

## 2. 커버리지 실측

### 2-1. 미등록 팔레트 타입 35종 — 근거가 있는 것은 17종

RAC 레퍼런스 근거 (11종):

| 타입                | RAC callback                                                            | controlled prop     |
| ------------------- | ----------------------------------------------------------------------- | ------------------- |
| `DropZone`          | onDrop, onDropEnter, onDropExit, onDropMove, onDropActivate, onHover\*   | —                   |
| `FileTrigger`       | onSelect                                                                | —                   |
| `CheckboxGroup`     | onChange, onFocus, onBlur, onFocusChange                                | value               |
| `DateField`         | onChange, onFocus, onBlur, onFocusChange                                | value               |
| `TimeField`         | onChange, onFocus, onBlur, onFocusChange                                | value               |
| `DateRangePicker`   | onChange, onOpenChange, onFocus, onBlur, onFocusChange                  | value, isOpen       |
| `RangeCalendar`     | onChange, onFocusChange                                                 | value               |
| `ToggleButtonGroup` | onSelectionChange                                                       | selectedKeys        |
| `Breadcrumbs`       | onAction                                                                | —                   |
| `Tooltip`           | onOpenChange                                                            | isOpen              |
| `ProgressBar`       | —                                                                       | value, isIndeterminate |

RSP 레퍼런스 근거 (6종) — RAC 문서에 대응이 없어 1차 조사에서 "근거 없음"으로 분류했던 항목의 정정:

| 타입        | RSP callback                                                                                       | controlled prop                          |
| ----------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `TableView` | onSortChange, onResize, onResizeStart, onResizeEnd, onAction, onSelectionChange, onExpandedChange, onLoadMore | sortDescriptor, selectedKeys, expandedKeys |
| `CardView`  | onAction, onSelectionChange, onLoadMore                                                            | selectedKeys                             |
| `Card`      | onAction, onPress 계열                                                                              | —                                        |
| `IconButton`| onPress 계열, onFocus, onBlur, onFocusChange (RSP `ActionButton`)                                   | —                                        |
| `Dialog`    | onDismiss                                                                                          | —                                        |
| `Image`     | onLoad, onError                                                                                    | —                                        |

근거 없음 확정 (18종): `Text` `Icon` `Separator` `Badge` `Skeleton` `Avatar` `AvatarGroup` `StatusLight` `InlineAlert` `ProgressCircle` `IllustratedMessage` `Toolbar` `ButtonGroup` `TailSwatch` `frame` `Nav` `Section` `Slot` — RAC·RSP 어느 쪽에도 이벤트가 없거나 대응 컴포넌트가 없다. 표시 전용 요소이므로 공통 capability 3종(`show`/`hide`/`toggle`)만 갖는 현재 상태가 정합이다.

부수 발견: `TextArea` 는 catalog 등록과 팩토리 지원이 모두 있으나 `PALETTE_ORDER` 누락으로 패널에 표시되지 않는다. RSP 레퍼런스에는 onChange / onFocus / onBlur / onFocusChange / onSelect 가 있다.

### 2-2. 등록된 26종 내부의 누락

레퍼런스에 존재하나 `CAPABILITY_REGISTRY[type].events` 에 없는 callback:

| 타입                                | 누락 callback                                    |
| ----------------------------------- | ------------------------------------------------ |
| `Table`                             | **onSortChange**, **onRowAction**, onExpandedChange |
| `ListBox` / `GridList` / `Tree`     | **onAction**                                     |
| `Menu`                              | onClose, onSelectionChange                       |
| `SearchField`                       | onClear                                          |
| `Select` / `ComboBox` / `TextField` / `NumberField` / `RadioGroup` / `DatePicker` | onFocus, onBlur, onFocusChange |
| `Checkbox` / `Switch`               | onPress 계열, onFocus, onBlur, onFocusChange     |
| `Calendar`                          | onFocusChange                                    |

CRUD 예제가 여기에 직접 걸린다 — 열 정렬은 `onSortChange`, "행을 눌러 수정 다이얼로그 열기"는 `onRowAction` / `onAction` 이다. 둘 다 레퍼런스에 있고 registry 에만 없다.

## 3. `deferred` 12종의 차단 원인 — 두 분류

registry 는 이들을 "Preview 가 `default*` 만 배선 → patch 무반응(분류 c)"으로 일괄 기록하고 있으나, 실측 결과 원인이 둘로 갈린다.

### 원인 A — catalog binding 의 `accepts` 에 controlled prop 자체가 없음 (8종)

| 타입              | 필요 prop                  | `accepts` 존재 |
| ----------------- | -------------------------- | -------------- |
| `Select`          | selectedKey, isOpen        | 둘 다 없음     |
| `ComboBox`        | selectedKey, inputValue    | 둘 다 없음     |
| `Table`           | selectedKeys, sortDescriptor | 둘 다 없음   |
| `DisclosureGroup` | expandedKeys               | 없음           |
| `DatePicker`      | value, isOpen              | 둘 다 없음     |
| `Calendar`        | value                      | 없음           |
| `Popover`         | isOpen                     | 없음           |
| `Menu`            | isOpen                     | 없음           |

prop 이 RAC 까지 도달할 통로가 없다. `capabilityBindingReach.test.ts` 가 막는 지점이며, binding `accepts` 확장이 선행돼야 한다.

### 원인 B — 통로는 있으나 렌더러가 uncontrolled 로 소비 (4종)

```tsx
// packages/shared/src/renderers/FormRenderers.tsx:189 (TextField)
defaultValue={String(element.props.value || "")}
...
onChange={(value) => updateElementProps(element.id, { ...element.props, value: String(value) })}
```

| 타입          | 위치                       | 현재                     |
| ------------- | -------------------------- | ------------------------ |
| `TextField`   | `FormRenderers.tsx:189`    | `defaultValue={props.value}` |
| `NumberField` | `FormRenderers.tsx:257`    | `defaultValue={props.value}` |
| `SearchField` | `FormRenderers.tsx:343`    | `defaultValue={props.value}` |
| `Switch`      | `FormRenderers.tsx:930`    | `defaultSelected={props.isSelected}` + `key={element.id}` 고정 |

이 4종은 `defaultValue=` → `value=` (Switch 는 `defaultSelected=` → `isSelected=`) 전환으로 controlled 가 된다. `onChange` 가 이미 값을 element props 로 되돌려 쓰고 있어 controlled 계약이 반쯤 성립해 있다.

대조군: `Checkbox`(`FormRenderers.tsx:569`)는 같은 `defaultSelected` 를 쓰되 `key` 에 상태를 포함시켜 remount 로 반영시키고 있고, 그래서 registry 에 `remount: true` 로 등재돼 있다. 즉 우회 패턴이 이미 저장소 안에 있다.

### 부수 발견 — 폼 입력값은 이미 런타임에 축적된다

위 `onChange` 들이 값을 `updateElementProps` 로 element props 에 기록하므로, 사용자가 입력한 값은 런타임 props 에 그대로 남는다. "폼 제출값 수집"은 FormData 배관이 아니라 **Form 하위 필드 요소의 `props.value` 를 읽는 것**으로 해소될 수 있다.

## 4. RSP 전용 발견 — mutation 이벤트 어휘

RSP `ListView`(= composition `GridList`) / `TreeView`(= `Tree`) 는 다음을 정식 이벤트로 규정한다:

```
onInsert  onMove  onReorder  onItemDrop  onRootDrop  onDrop  onDragStart  onDragMove  onDragEnd  onLoadMore
```

RSP `ActionBar` 는 `onClearSelection` / `onAction` 으로 **선택 행 일괄 작업**을 규정한다. CRUD 예제의 "선택 후 삭제" UI 가 이 패턴이며, composition 에는 대응 컴포넌트가 없다.

즉 삽입·이동·재정렬은 Adobe 어휘에 이미 이벤트로 존재하므로, composition 이 자체 mutation 어휘를 발명할 필요가 없다.

## 5. RSP 어휘 ↔ RAC hook 구현 근거 대응

RSP 의 고수준 이벤트는 전부 RAC 쪽에 구현 근거가 있다.

| RSP 이벤트 (어휘 근거)                                          | RAC 구현 근거                                |
| --------------------------------------------------------------- | -------------------------------------------- |
| ListView / TreeView `onInsert` `onMove` `onReorder` `onItemDrop` `onRootDrop` | `useDragAndDrop` (dnd 가이드에 동일 이름 존재) |
| TableView `onResize` `onResizeStart` `onResizeEnd`              | `ResizableTableContainer` (Table 레퍼런스)   |
| `onLoadMore`                                                    | `useAsyncList` + `LoadMoreItem`              |
| Table `onSortChange`                                            | `useAsyncList().sort` + `sortDescriptor`     |

또한 `react-stately` 는 이미 `apps/builder` / `packages/shared` 양쪽의 의존성(^3.47.0)이고, 빌더 자체 UI 가 `useListData` 를 쓰고 있으며(`useFavoriteComponents.ts` / `useRecentComponents.ts` / `useRecentSearches.ts`), 반환 타입이 `apps/builder/src/types/builder/stately.types.ts` 에 이미 선언돼 있다 (`UseListDataResult` / `UseTreeDataResult` / `UseAsyncListResult`).

| stately hook             | 메서드                                                                   |
| ------------------------ | ------------------------------------------------------------------------ |
| `useListData`            | append, prepend, insert, remove, removeSelectedItems, move, update, getItem, setSelectedKeys |
| `useTreeData`            | append(parentKey), insert, remove, move(toParentKey), update             |
| `useAsyncList`           | reload, loadMore, sort, setFilterText                                    |
| `useOverlayTriggerState` | open, close, toggle                                                      |

현행 G1 게이트는 `racRef`(구현 근거) 하나만 요구한다. 어휘 근거(`rspRef`)를 함께 인용하게 하면 두 레퍼런스를 동시에 집행할 수 있고, 이는 D2 규칙("RSP 참조 + RAC/custom 구현 가능 범위 전부 채택")과 정합한다.

## 6. CRUD 예제 재현 판정

| 예제 기능                | 현재                                                        | 판정   |
| ------------------------ | ----------------------------------------------------------- | ------ |
| 컴포넌트 배치            | 필요한 팔레트 항목 전부 존재                                | 가능   |
| 행 목록 데이터           | `dataBinding` → DataTable 경로 존재, 그러나 Preview 0행     | 결함   |
| 열 정렬 / 열 리사이즈    | `TableView.binding` 에 토글 존재, 트리거는 registry 미등재  | 부분   |
| 다이얼로그 열기 / 닫기   | `Modal.open` / `Modal.close`                                | 가능   |
| 페이지 이동 / 토스트     | `navigate` / `toast`                                        | 가능   |
| 행 추가 / 수정 / 삭제    | 데이터 변경 액션 없음                                       | 불가   |
| 검색 / 필터 연동         | `useCollectionData` 에 `filterText` / `sort` 존재, 오소링 경로 없음 | 불가 |
| 수정 폼에 기존 값 채우기 | 트리거 인자 폐기 + `TextField.setValue` 보류                | 불가   |

선행 차단 결함: `CollectionDataProvider` 가 저장소 어디에서도 마운트되지 않아 `dataTableService` 가 영구 `undefined` 이며, 빌더 Skia 캔버스에는 행이 보이지만 Preview iframe 은 0행이다. publish 축은 collection 소비 코드가 0건이다. 두 건 모두 ADR-152 의 격차 7 / 격차 4 로 기록돼 있다.

액션 어휘 전량(`packages/shared/src/interactions/`):

```ts
APP_ACTIONS = { navigate, toast }                                 // 앱 액션 2종
CapabilityAction = { targetId, capability, params?: { value } }   // 대상 요소 prop 1개 patch
```

dispatcher 분기도 `navigate` / `toast` / `capability` 셋뿐이다. 추가로 `Form.submit` / `Form.reset` 은 `imperative: true` 로 등재돼 CapabilityPicker 에 노출되지만 dispatcher 가 `ok:false` 로 거절한다 — `resolveCapabilities()` 가 imperative 를 걸러내지 않는 정합성 결함이다.

## 7. 파생 과제 (권고 — 결정 아님)

| 항목                                                                  | 성격          |
| --------------------------------------------------------------------- | ------------- |
| `CollectionDataProvider` 마운트 + publish collection 소비             | 선행 결함 수리 |
| 렌더러 4종 controlled 전환 (`defaultValue` → `value`)                 | 1줄 수정 4건  |
| binding `accepts` 확장 8종 (selectedKey / isOpen / sortDescriptor 등) | D2 확장       |
| registry 등재 17종 + 등록 26종의 누락 callback 보강                   | 어휘 보강     |
| 트리거 payload 전달 (`bindings.ts` 가 RAC callback 인자를 폐기 중)     | 계약 변경     |
| `rspRef` 인용 게이트 추가 + 레퍼런스 문서 대조 정적 테스트            | 검증 자동화   |
| 컬렉션 아이템 소유권(`useListData` 계열)의 SSOT 경계 판정             | **미결정**    |

마지막 항목만 판정이 필요하다. 선택 상태·열림 상태·입력값은 전부 기존 prop patch 어휘로 커버되며, prop patch 로 환원되지 않는 것은 컬렉션 아이템의 추가·삭제·이동뿐이다.

## 8. 재현 방법

1. 팔레트 61종 목록: `node -e` 로 `PALETTE_ORDER` 파싱, registry 26종: `CAPABILITY_REGISTRY` 최상위 키 파싱 후 차집합.
2. 레퍼런스 대조: `.agents/skills/react-aria/references/components/*.md` 와 `.agents/skills/react-spectrum/references/components/*.md` 의 API 표에서 `` `on[A-Z]\w+` `` 추출, DOM 상속 callback 제외.
3. 원인 A: `packages/shared/src/catalog/bindings/{Type}.binding.ts` 의 `accepts` 키에 controlled prop 존재 여부 확인.
4. 원인 B: `packages/shared/src/renderers/FormRenderers.tsx` 의 `defaultValue` / `defaultSelected` 사용 지점(189 / 257 / 343 / 569 / 930) 확인.
