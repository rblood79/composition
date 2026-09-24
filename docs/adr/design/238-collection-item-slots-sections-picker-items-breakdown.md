# ADR-238 구현 상세 — 목록 항목 안 slot · Section 층 · Select/ComboBox 항목 origin

> 본문: [ADR-238](../completed/238-collection-item-slots-sections-picker-items.md) · base: [ADR-234](../completed/234-variant-instances-and-slot-filled-collections.md) · 같은 base 의 앞선 적용: [ADR-237](../completed/237-origin-instance-slot-extension.md)

## 1. 전제 확정 기록 (fork 4 질문 · 사용자 confirm)

사용자 confirm 2026-09-24 (AskUserQuestion — 범위 "1+2+3"). 조사 근거: 같은 날 `/deep-research` (react-aria.adobe.com) + 설치된 `react-aria-components@1.21.0` 소스 대조.

1. **base / 응용**: 234 가 origin · instance · slot 의 뜻 (변형 = 완성된 상태 origin 의 ref · slot = 목록 틀의 추천 항목 · 목록 = instance 자식 · 바인딩 목록 = `items`) 을 정한 base 다. 238 은 237 과 나란한 응용 — 237 이 "범위 밖 (후속 ADR)" 으로 남긴 Select · ComboBox 항목 origin · Menu section 과 RAC 조사의 항목 안 slot 을 같은 규칙으로 옮긴다. 234 · 237 의 결정은 재검토하지 않는다.
2. **schema 직교성**: 새 저장 **필드** 없음 (`slot` · `enabled` · `descendants` · `type: "ref"` · `metadata.slotRole` 그대로). 새 canonical **노드 type** 3 (`ListBoxSection` · `MenuSection` · `GridListSection`) 과 기존 catalog `Header` 의 목록 안 사용이 추가된다 — RAC 컴포넌트 이름 그대로 (D1). HTML `<section>` 인 기존 `Section` type 과는 다른 type 이다.
3. **선행 전제 역전 검증**: 의존 방향 238 → 234 단방향. 234 의 "정적 목록 = 자식 · 바인딩 = `items`" 를 그대로 따른다 — section 이 섞인 정적 `items` 도 이 규칙으로 옮기고, 바인딩 목록의 section entry 는 `items` 에 남긴다. Select · ComboBox 는 Menu 선례 (234 Phase 3f — owner 자신이 목록 틀, 항목은 popover 내용) 를 따른다.
4. **범위**: ① 항목 안 slot (ListBoxItem · MenuItem · GridListItem · Tag 의 역할 자식 on/off · origin 역할 추가) ② Section 층 (ListBox · Menu · GridList 의 Section + Header, Menu Separator 포함) ③ Select · ComboBox 항목 = ListBoxItem instance 자식. 범위 밖: Tree · Table · Dialog/Toast 이름 영역 · 자유 내용 slot · Menu 하위 메뉴 (SubmenuTrigger) · LoadMore 항목.

## 2. 레퍼런스 — RAC (`react-aria-components@1.21.0` · react-aria.adobe.com · starter `packages/react-aria-starter/src`, read-only)

| ID  | 사실                                                                                                                                                                                                                                                                                          | 근거                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| R1  | 한 패턴 안 같은 컴포넌트는 `slot` prop 으로 구분하고, 부모 context provider 의 `slots` 객체가 slot 별 props 를 넘긴다. provider 가 `slots` 를 가진 context 에서 **없는 slot 이름을 쓰면 오류** (`useSlottedContext` — 사용 가능한 이름을 나열하며 throw). `slot` 이 없는 자식은 DEFAULT_SLOT. | react-aria.adobe.com/customization · `dist/private/utils.mjs` `useSlottedContext`                          |
| R2  | 항목이 받는 이름 있는 slot (provider `slots` 키): ListBoxItem · MenuItem = `label` · `description` (MenuItem 은 Keyboard 로 단축키) · GridListItem = `description` · `selection` · `drag` (label 없음) · Tag = `remove`. Icon 은 어느 항목에서도 slot 이름 없이 DEFAULT_SLOT 자식.            | `dist/private/{ListBox,Menu,GridList,TagGroup}.mjs` provider `slots` · react-aria.adobe.com/ListBox        |
| R3  | Section 은 collection 안의 묶음 층 — 항목을 section 요소 (`ListBoxSection` · `MenuSection` · `GridListSection`) 로 감싸고 `<Header>` (GridList 는 `GridListHeader`) 로 제목. section 은 한 단계 (중첩 없음). Menu 는 section 사이 `<Separator>`.                                              | react-aria.adobe.com/collections · `dist/exports/{ListBox,Menu,GridList}` export 목록                      |
| R4  | 항목 id 는 selection 과 갱신 추적에 쓰이며 **section 을 가로질러 전역 유일**해야 한다.                                                                                                                                                                                                        | react-aria.adobe.com/collections                                                                           |
| R5  | Select · ComboBox 의 목록은 `Popover > ListBox > ListBoxItem` (section 은 `ListBoxSection`) — 항목 컴포넌트가 ListBox 와 같다. 선택은 Select `selectedKey` / ComboBox `selectedKey` ↔ 항목 id.                                                                                                | `dist/exports/{Select,ComboBox}` (ListBox · ListBoxItem · ListBoxSection re-export) · starter `Select.tsx` |
| R6  | GridListItem 의 `selection` (Checkbox) · `drag` (Button) 과 Tag 의 `remove` (Button) 는 owner 설정 (`selectionMode` · drag and drop · `onRemove`) 이 켤 때 나타나는 부품이다 — 항목 저작 구조가 아니다 (ADR-147 이 SelectionIndicator 를 render-time 으로 판정한 것과 같다).                  | starter `GridList.tsx` · `TagGroup.tsx` · ADR-147                                                          |

## 3. 코드 사실 (2026-09-24, main `44ec413ad`)

| ID  | 사실                                                                                                                                                                                                                                                                                                                                           | 위치                                                                                                                                                                                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | 항목 origin 은 역할 자식을 이미 갖는다 — ListBoxItem: Icon(icon, optional) · Text(label) · Text(description, optional) / MenuItem: icon · label · shortcut · description / GridListItem: label · description (icon 없음) / Tag: icon · avatar · label. 역할은 `metadata.slotRole`, 선택 역할은 `metadata.optional: true`.                      | `components/listbox/listBoxTemplateOrigins.ts:25-63` · `menu/menuTemplateOrigins.ts:19-66` · `gridlist/gridListTemplateOrigins.ts:23-50` · `taggroup/tagGroupTemplateOrigins.ts:35-` (`apps/builder/src/builder/`)                                                                      |
| F2  | 역할 구성 reader 하나 (`resolveSlotComposition`) 를 두 leg 가 읽는다 — optional 역할은 "데이터가 없으면 미렌더".                                                                                                                                                                                                                               | `packages/shared/src/catalog/slotRoles.ts:26-50` (어휘) · `:171-215`                                                                                                                                                                                                                    |
| F3  | instance 항목의 역할 on/off · 글자는 이미 `descendants` 로 표현된다 — 정적 목록 이관이 label 글자 patch, Tag 는 icon · avatar 가 없는 행에 `{enabled:false}` 를 쓴다. 그러나 Properties 에 항목 instance 의 역할 on/off 표면이 없다.                                                                                                           | `components/staticCollectionMigration.ts:147-153,173-195`                                                                                                                                                                                                                               |
| F4  | ListBoxItem 역할 자식 재생성 액션 `createListBoxItemSlotChildElement` 는 소비처 0 (정의만 남음).                                                                                                                                                                                                                                               | `panels/properties/listBoxItemSlotChildActions.ts:25-52`                                                                                                                                                                                                                                |
| F5  | GridListItem label 자식은 `props.slot` 을 싣지 않는다 — `slot:"label"` 을 실으면 GridListItem 맥락에서 "Invalid slot" 크래시 (R1 · R2 의 실측).                                                                                                                                                                                                | `gridlist/gridListTemplateOrigins.ts:27-32`                                                                                                                                                                                                                                             |
| F6  | Section 은 `items` 엔트리 모양뿐 (ADR-099) — `{type:"section", header, items}` (ListBox · GridList), Menu 는 per-section selection 필드까지. canonical 노드 type 이 없다. Preview 는 section entry 를 RAC `ListBoxSection` · `MenuSection` · `GridListSection` 으로, layout 은 헤더 행 높이를 센다. ItemsManager 가 section 편집 UI 를 갖는다. | `packages/specs/src/types/listbox-items.ts:40-62,87-91` · `menu-items.ts:47-60` · `packages/shared/src/renderers/SelectionRenderers.tsx:14-17,45` · `CollectionRenderers.tsx:937-971` · `layout/engines/utils.ts:2859-2863,3174` · `panels/properties/generic/ItemsManager.tsx:263-281` |
| F7  | 정적 목록 이관은 section · separator · 하위 메뉴 행이 섞인 `items` 를 **건너뛴다** — 그런 목록은 234 이후에도 `items` 모델에 남아 두 모델이 공존한다. ListBox 는 section entry 가 섞이면 정적 children 경로로 보존하는 flat guard 가 있다.                                                                                                     | `staticCollectionMigration.ts:359-370` · `packages/shared/src/components/ListBox.tsx:155-183`                                                                                                                                                                                           |
| F8  | 정적 항목 RAC key = `props.id` 우선, 없으면 노드 id. 상속 항목의 해석 노드 id 는 instance 안 로컬이라, 같은 origin 을 참조하는 형제 instance 둘이 같은 key 를 낼 수 있다 (2026-09-24 CheckboxGroup Preview 로컬 id 중복 수리 `44ec413ad` 와 같은 뿌리).                                                                                        | `packages/shared/src/catalog/slotRoles.ts:344-357` · `preview/components/CanonicalNodeRenderer.tsx` (delegating 조회)                                                                                                                                                                   |
| F9  | Select · ComboBox 항목 = `items` 배열이 SSOT (ADR-073 P2, ComboBox 는 ADR-101 이 legacy `ComboBoxItem` Element 를 흡수). factory 가 4 행 seed. Preview 는 `items` → RAC Popover/ListBox 합성. canonical 항목 노드 · 항목 origin 이 없다.                                                                                                       | `factories/definitions/SelectionComponents.ts:25-60,134-150` · `packages/shared/src/renderers/SelectionRenderers.tsx:1133-1175,1438-1455`                                                                                                                                               |
| F10 | Menu 선례 (234 Phase 3f): owner 자신이 목록 틀 (`listType: null`), 항목 = MenuItem instance 자식, Canvas 는 트리거만 그리고 항목은 popover 내용 (Skia `_hasChildren` 에서 제외).                                                                                                                                                               | `docs/adr/design/234-variant-instances-and-slot-filled-collections-breakdown.md:235-241` · `slotRoles.ts:365-372` (`STATIC_LIST_FAMILY_BY_OWNER`)                                                                                                                                       |
| F11 | slot host 표에는 목록 틀 5 · Breadcrumbs · 그룹 9 만 있다 — 항목 (ListBoxItem 등) · section · Select/ComboBox 행은 없다.                                                                                                                                                                                                                       | `components/slotHostPolicy.ts:203-290,292-297`                                                                                                                                                                                                                                          |
| F12 | catalog 에 `Header` rule 이 있고 (sizes · 글자), `Section` type 은 HTML `<section>` 컨테이너다 (목록 section 과 다른 뜻).                                                                                                                                                                                                                      | `packages/shared/src/catalog/generated/componentRulesTable.ts:5873` · `catalog/bindings/Section.binding.ts:4`                                                                                                                                                                           |

## 4. Phase

### Phase 0 — inventory freeze (G0)

- F1~F12 재grep 일치 확인. ADR-236 (타입 특성 표) 반영 상태 확인 — 반영됐으면 새 항목 역할 표 · section type 을 그 표 위치에 둔다 (내용은 238 이 정한다).
- 진단 RED:
  - (a) ListBox instance 항목을 선택해도 Properties 에 description on/off 가 없다 (F3).
  - (b) section entry 가 섞인 정적 ListBox · Menu 는 이관되지 않고 `items` 로 남는다 — Slot "+" 가 section 안에 항목을 넣을 수 없다 (F7 · F11).
  - (c) 같은 section origin 을 참조하는 section instance 둘의 상속 항목이 Preview 에서 같은 RAC key 를 낸다 (F8 · R4 — 선택이 두 항목을 같이 켠다). section origin 의 항목이 Slot "+" 로 들어가 `props.id` 를 가진 경우를 포함한다 (리뷰 r1 h1). 238 설계가 이 모양을 만들기 전에 RED 로 고정한다.
  - (d) Select · ComboBox 항목 모양을 ListBoxItem origin 에서 바꿔도 Select popover 항목에 닿지 않는다 (F9).
  - (e) GridListItem 에 `slot:"label"` 역할 자식을 더하면 Preview "Invalid slot" (F5 — 역할 표가 RAC slot 이름으로 제한돼야 하는 근거).
- 쓰기 경로 표: 팔레트 · factory · AI tool · Pencil import · 붙여넣기 · ItemsManager 가 section · Select/ComboBox 항목 · 항목 역할 자식을 어떤 모양으로 쓰는지.
- 이관 수식 실측 (문서당): (i) Components 페이지 새 노드 — section origin 3 (Header + 항목 ref 2 씩) · Select/ComboBox origin 항목 ref (seed 4 행 × 2) (ii) section 이 섞인 정적 목록 1개당 section `s` · 항목 `m` → section 노드 `s` + Header `s` + 항목 ref `m` 의 Δbyte (iii) 정적 Select/ComboBox 1개당 행 `k` → ref 자식 `k` (234 실측 항목당 150~250 B 범위 확인) (iv) 바인딩 목록 Δ0.

### Phase 1 — 항목 안 slot (G1)

- **항목 역할 표 하나** (항목 type → 허용 역할 · 역할별 RAC slot 이름 · 필수 여부). RAC provider 가 받는 이름 (R2) 만 `slot` 으로 싣고, 나머지는 DEFAULT_SLOT:

  | 항목         | 역할 (필수 = ●)                         | RAC slot 이름                                      |
  | ------------ | --------------------------------------- | -------------------------------------------------- |
  | ListBoxItem  | icon · label ● · description            | label → `label` · description → `description`      |
  | MenuItem     | icon · label ● · description · shortcut | label · description 은 이름 · shortcut 은 Keyboard |
  | GridListItem | icon (새) · label ● · description       | description 만 이름 (label 은 DEFAULT — F5)        |
  | Tag          | icon · avatar · label ●                 | 없음 (전부 DEFAULT — `remove` 는 owner 설정, R6)   |

- **instance 표면**: 항목 instance (Slot "+" 로 넣은 자기 자식 · 상속 항목의 synthetic 표면 모두) 의 Properties Slot 절에 origin 역할 목록을 보이고, optional 역할만 on/off — 쓰기 = 그 항목 instance 의 `descendants[역할 경로].enabled` (234 `enabled` 3값 그대로). 필수 역할 (label) 은 끌 수 없다 (RAC 접근성 이름 — `textValue` 부재 방지).
- **origin 표면**: Components 페이지 항목 origin 에서 표에 있지만 자식이 없는 역할을 더한다 (GridListItem icon). 새 역할 자식 = F1 과 같은 plain 모양 (`metadata.slotRole` · `optional:true`). F4 는 이 액션으로 대체하고 소비처 0 코드를 지운다 (원본 삭제는 사용자 승인 후).
- **selection · drag · remove 는 역할이 아니다** (R6) — owner 설정이 켜는 render-time 부품으로 둔다.

### Phase 2 — Section 층 (G2)

- **새 type 3**: `ListBoxSection` · `MenuSection` · `GridListSection` (catalog entry — D3 rule, 생성 CSS archetype 명시). 자식 = `Header` (GridList 는 RAC `GridListHeader` 로 렌더) + 항목 instance. Menu 는 section 사이 `Separator` 자식을 허용.
- **section origin**: Components 페이지에 `component-listbox-section` · `component-menu-section` · `component-gridlist-section` (Header + 항목 ref 2). owner origin (ListBox · Menu · GridList) 의 `slot` 에 section origin 을 더한다 (owner slot 이 없을 때만 seed · 있으면 사용자 값 보존 — 237 그룹 slot 과 같은 조건). section 자신도 slot host (후보 = 그 목록의 항목 origin).
- **RAC key (R4 · F8)** — 항목이 문서의 어디에 실제로 있는지로 가른다 (리뷰 r1 h1):
  - **instance 자기 자식** (Slot "+" · 이관이 만든 항목 — 문서에 실제 노드가 있다) = `resolveStaticItemKey` 그대로 (`props.id`, 없으면 노드 id). 이 `props.id` 는 삽입 · 이관 경로가 형제와 다르게 배정한다 (`collectionItemInsert.ts` · `staticCollectionMigration.ts:390`).
  - **origin 에서 상속된 항목** (synthetic — section instance 가 section origin 의 항목을 상속) = **항상** `<상속을 연 instance 의 key>/<origin 안 항목 key>`. 상속 항목의 `props.id` 는 origin 에 저장된 값이라 같은 origin 의 instance 둘에서 그대로 겹친다 — `props.id` 가 있어도 접두를 빼지 않는다.
  - 선택값 (`selectedKeys` · Menu section 의 `selectedKeys`) 이 상속 항목을 가리킬 때도 같은 접두 key 를 쓴다. section 은 새 층이라 기존 문서에 상속 항목을 가리키는 선택값이 없다 — section 이관은 행을 instance 자기 자식으로 만들어 행 `id` 를 `props.id` 로 유지한다.
  - Preview 는 44ec413ad 의 객체 동일성 조회를 section 에도 적용 (id 조회 충돌과 RAC key 충돌은 별개 — 둘 다 막는다).
- **이관**: section · separator 가 섞인 정적 `items` → section instance 자식 + 항목 instance (234 가족 표 확장, `hasUnsupportedRows` 에서 section · separator 를 뺀다). 하위 메뉴 행이 있는 Menu 는 계속 건너뛴다 (범위 밖). 바인딩 목록은 `items` 유지 — ItemsManager section UI 는 바인딩 전용으로 남는다.
- **두 leg**: Canvas layout 은 section 을 block 자식으로 (헤더 행 높이 = catalog `Header` rule), Skia 는 Header 글자 · Separator 선. Preview 는 RAC section 컴포넌트 (D1 그대로).

### Phase 3 — Select · ComboBox 항목 origin (G3)

- **목록 틀 = owner 자신** (Menu 선례 F10): Select · ComboBox 의 정적 항목 = ListBoxItem origin (`component-listbox-item-default` · `-selected`) 의 instance 자식, section 은 `ListBoxSection` instance. Canvas 는 트리거만 (항목은 popover 내용 — `_hasChildren` 제외), Preview 는 자식을 Popover > ListBox 로 합성.
- **선택 계약** (리뷰 r1 m1 — 행의 `id` 와 `value` 는 다른 값이다, 기본 factory 부터 `id` = UUID · `value` = 업무 값):
  - 행 `id` → 항목 `props.id` (= RAC key). 기존 `selectedKey` 는 행 `id` 를 가리키므로 같은 항목을 가리킨다.
  - 행 `value` → 항목 `props.value` (RAC `ListBoxItem` 의 `value` prop — D2 기존 prop, 새 prop 아님. Phase 0 에서 binding `accepts` 선언 확인).
  - 선택 writeback (`SelectionRenderers.tsx:1362-1370` 의 `selectedKey` → `selectedValue` 조회) 은 정적 자식 경로에서 **선택 항목의 `props.value`** 를 읽는다 (없으면 key). 이관 전과 같은 `selectedValue` 가 저장돼야 한다.
- **표시 글자** (리뷰 r1 m3): Canvas `SelectValue` reader 는 `selectDisplayValue.ts` 의 우선순위를 그대로 둔다 — ComboBox `inputValue` (자유 입력) → 선택 항목 글자 → placeholder. 바꾸는 것은 "선택 항목 글자" 조회 한 곳 (`items` 행 → canonical 항목 자식의 label 역할 글자) 뿐이다.
- **ComboBox 필터링** (리뷰 r1 m2): RAC 필터 입력은 항목 `textValue` 다. 이관은 행의 `textValue` 를 **명시값 그대로** 항목 `props.textValue` 로 옮기고, 행에 없을 때만 label 글자를 쓴다 (`SelectionRenderers.tsx:1552` 의 `item.textValue ?? item.label` 과 같은 우선순위).
- **이관**: 정적 `items` → 항목 instance 자식 (234 가족 표에 Select · ComboBox 행 · `listType: null`). 바인딩 (`dataBinding` · 템플릿) 은 `items` 유지. slot host 표에 Select · ComboBox 행 (후보 = ListBoxItem origin 2 + ListBoxSection origin).

### Phase 4 — 성능 · BC 종결 (G4 · G5)

- G4: 같은 세션 headed A/B (대조 arm = 238 전 빌드 worktree, 234 · 237 방식). fixture = 사람이 만든 모양의 문서 (section 3 × 항목 10 ListBox · Menu, Select 20 행 × 50) + 불리 조작 (항목 origin 편집 · breakpoint 전환).
- G5: 가족별 이관 전후 Canvas 픽셀 동일 (section 목록 · Select/ComboBox 트리거) · Δbyte 수식 일치 · 재hydration Δ0 (unit + IndexedDB 저장 층 live).

## 5. 파일 변경 예상 (Phase 0 에서 확정)

| 영역                  | 파일                                                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 역할 표 · 역할 표면   | `packages/shared/src/catalog/slotRoles.ts` · `panels/properties/` (Slot 절) · `components/gridlist/gridListTemplateOrigins.ts` · `listBoxItemSlotChildActions.ts` (대체)         |
| section type · origin | `packages/shared/src/catalog/{componentCatalog.ts,generated/componentRulesTable.ts,bindings/*Section.binding.ts}` · `components/{listbox,menu,gridlist}/*` · `slotHostPolicy.ts` |
| 두 leg                | `packages/shared/src/renderers/{SelectionRenderers,CollectionRenderers}.tsx` · `preview/components/CanonicalNodeRenderer.tsx` · `workspace/canvas/{scene,layout,skia}/*`         |
| 이관                  | `components/staticCollectionMigration.ts` · `components/reusableCompositeOrigins.ts`                                                                                             |
| Select · ComboBox     | `factories/definitions/SelectionComponents.ts` · `SelectionRenderers.tsx` (renderSelect · renderComboBox) · Skia `SelectValue` reader                                            |

## 6. 실행 기록

### Phase 0 — inventory (G0, 2026-09-24 · main `61d29f98a`)

- **F1~F12 재확인**: 일치. 줄 이동만 — F6 ListBox section 렌더 `SelectionRenderers.tsx:589-595` · GridList `:980-988` · Menu `CollectionRenderers.tsx:935-986` · ItemsManager `SectionRow :260-412` · F7 flat guard `ListBox.tsx:155-169,183` · F9 writeback `SelectionRenderers.tsx:1362-1372` · textValue `:1552` · `defaultInputValue :1639` · F12 `Header` rule `componentRulesTable.ts:5873-5916` (archetype `simple` · element `div` · sizes md fontSize `text-xs` · padding 12/6 · weight 700).
- **새 사실 (본문 영향)**:
  - N1 **238 전 Canvas 는 section 이 섞인 정적 ListBox · GridList 를 빈 행으로 그린다** — projection (`getFlatProjectionRows`, `listBoxRowProjectionModel.ts:32-38`) 이 section entry 를 평면 행 하나로 보고 이름은 `header` 를 안 읽어 비고 안쪽 items 는 그리지 않는다 (live: `projection:gridlist-row:sec-gl:s1` 50px 행 2 개, 글자 0). layout 은 헤더 높이 + 안쪽 항목을 센다 (`utils.ts:2859-2880` · `collectionItemMetrics.ts:582` 하드코딩 `fontSize*1.75`). → **사용자 판정 (AskUserQuestion) "Preview 구조로 판정"**: section 가족 G5 는 이관 뒤 Canvas 가 Preview DOM 구조를 그리는지로 본다 (본문 Status · R2 · G5 개정).
  - N2 `Header` 는 catalog rule 만 있고 `componentCatalog` entry · binding · Preview renderer 가 없다 (`renderers/index.ts` 에 없음) — Phase 2 가 배선한다. `Separator` 는 canonical type (`componentCatalog.ts:125-129` · `Separator.binding.ts`) 이나 Menu 안 경로는 없다.
  - N3 Skia Menu 트리거 판정 `buildSpecNodeData.ts:1802-1817` 은 `MenuItem` 자식만 빼고 `_hasChildren` 을 본다 — section 자식이 생기면 트리거 글자가 사라진다 (Phase 2 에서 넓힌다).
  - N4 nesting 규칙: `nestingRules.ts:239-240` Select · ComboBox 허용 자식 = Label · SelectTrigger · Description · FieldError, `:138` ListBoxItem owner = `["ListBox"]` 고정 (Phase 3 에서 넓힌다). `:103-104` 는 HTML `Section` type 이름으로 ListBox ⊃ Section · Header 를 허용.
  - N5 ListBoxItem binding `accepts` = children · size · isDisabled 뿐 (`ListBoxItem.binding.ts:42-53`) — `value` · `textValue` 선언 없음 (Phase 3 에서 더한다, RAC 기존 prop).
  - N6 ComboBox writeback 이 본문 외 두 곳 더 있다 — 선택 `SelectionRenderers.tsx:1680-1688` (value + label → `inputValue`) · 입력 label 일치 `:1775-1784`.
  - N7 Preview `STATIC_ITEM_TYPES` (`CanonicalNodeRenderer.tsx:173-179`) 에 MenuItem 이 없다 (Menu 는 `renderMenu` 가 직접 조립 — 영향 없음).
- **진단 RED** (`adr238Diagnostics.test.tsx`): (a) · (e) 는 Phase 1 로 GREEN (`it`) · (b) section 목록 이관 안 됨 `expected [section] to be undefined` · (c) 같은 section origin instance 둘의 상속 항목 key `Set size 1 ≠ 2` (`props.id` 있는 항목) · (d) Select origin 항목 ref `0` — `it.fails` 3.
- **쓰기 경로 표**:

  | 경로 | section (ListBox · Menu · GridList) | Select · ComboBox 항목 | 항목 역할 자식 |
  | --- | --- | --- | --- |
  | 팔레트 (`useElementCreator.ts:344-389`) | 쓰지 않음 (owner = reusable ref `{}`) | instance 는 origin `items` 상속 · origin 은 factory 행 `{id: UUID, label, value}` ×4 (`SelectionComponents.ts:25-30,134-139`) | 쓰지 않음 (항목 origin seed 만) |
  | AI tool | 불가 (`items` = `items-manager` kind, `manifest.ts:83-98`) | 불가 (같음) | 불가 (metadata 필드 없음) |
  | Pencil import | `items` 그대로 (import 는 정적 목록 이관 안 탐 — `importPayloadAdapter.ts:62-72`) | `items` 그대로 | metadata 통과 |
  | 붙여넣기 · 복제 (`multiElementCopy.ts`) | props 그대로 (행 id 유지) | 같음 | 요소 id 새로 · `props.id` 유지 |
  | ItemsManager | section `{type:"section", header:"New Section", items:[]}` (`elements.ts:2351-2364`, 정적 owner 에서는 숨김) | 행 `{label:"Option", value:"", id}` (`elements.ts:2311-2326`) | 쓰지 않음 |
  | Slot "+" · 이관 | 평면 항목만 (section 행 있으면 건너뜀) | 대상 아님 | ref 항목 `descendants` (label 글자 · 값 없는 역할 `enabled:false`) |

- **이관 수식 실측**: Phase 2 · 3 구현 뒤 G5 에서 잰다 (수식은 본문 BC 행).

### Phase 1 — 항목 안 slot (G1)

- 역할 표 `ITEM_SLOT_ROLE_TABLE` + `resolveItemRoleSlotName` · `isItemRoleSlotNameAllowed` (`packages/shared/src/catalog/slotRoles.ts`) — RAC slot context 를 읽는 자식 (Text · Keyboard) 은 표의 RAC 이름만, Icon · Avatar 는 역할 이름 (CSS `[slot]` 훅 — ListBox.css · TagGroup.css). 기존 seed 의 Tag label `slot:"label"` · Menu shortcut `slot:"shortcut"` 는 표 밖이지만 DOM 이 RAC Text 로 직접 그리지 않고 조립 (`renderMenuItemSlotParts` · Tag chip) 해 크래시가 없어 그대로 둔다 (BC Δ0).
- 표면 `apps/builder/src/builder/components/itemSlotRoles.ts` (`buildItemRoleSurface` · `planItemRoleToggle` · `planItemRoleChild`) + Properties `ItemSlotRolesSection` ("Item roles" — instance optional 역할 스위치 · label 은 "필수" · origin 은 없는 역할 추가). 쓰기 = 역할 자식 synthetic id `<항목>/<segment>` 의 `enabled` → `updateSelectedPropertiesWithChildren` 가 바깥 instance `descendants[path]` 로 (자기 자식 항목이면 그 항목의 `descendants[segment]`). origin 역할 추가 = `addElement` + `moveElementToContainer` (표 순서 위치) 한 history 트랜잭션. 빈 자기 갱신이 `{}` patch 키를 남기던 것 (`buildInstanceDescendantPatches`) 을 건너뛴다.
- 해석된 ref 자식 조회 `getResolvedRefChildren` (`syntheticDescendantLookup.ts`) — canonical ref 노드도 같은 해석기.
- F4 `createListBoxItemSlotChildElement` (소비처 0) 는 이 액션으로 대체됐다 — `listBoxItemSlotChildActions.ts` + 테스트 삭제 (2026-09-24 사용자 승인).
- unit `adr238Phase1.itemRoles.test.tsx` 6/6 (역할 표 · 표 밖 이름 거부 · synthetic 항목 description off → Canvas scene · Preview DOM 둘 다 빠짐 · 자기 자식 항목 on · label 끄기 거부 · GridListItem icon 추가 index 0 · Preview 크래시 0).
- live `apps/builder/scripts/adr238-live-exercise.mjs` 6/6 (Compare Mode · Preview 미개방): "Item roles" 절 (Description 스위치 · Label 스위치 없음) · 끄기 → `descendants["component-listbox__item-1/Description"].enabled=false` · 항목 높이 50 → 32 · description rect 없음 · 둘째 항목 50 그대로 · 켜기 → 50 · GridListItem origin Icon 추가 → 자식 순서 `[Icon(slot=icon), Text(slot 없음), Text(description)]` · reload 뒤 그대로 · page error 0.

### Phase 2 — Section 층 (G2)

- catalog 새 type 4: `Header` (RAC Header · 자식 Title) · `ListBoxSection` · `MenuSection` · `GridListSection` (archetype `container` · element `section` · placeable false). 생성 CSS 3 은 index.css 에 싣지 않는다 — 담당 CSS 는 각 목록 CSS (`ListBox.css` `.react-aria-ListBoxSection` 등). 도달 분류 `unobserved` (팔레트 기본 상태에 section 없음) · 로드 인벤토리 생성 99 · index 74 · 미로드 25.
- nesting: ListBox ⊃ ListBoxSection ⊃ Header · ListBoxItem (Menu · GridList 동형, Menu 는 Separator 허용) · ListBoxSection owner = ListBox · Select · ComboBox.
- section origin 3 (`collectionSectionOrigins.ts`) — Header "Section" + 항목 instance 2 (`props.id` item-1 · item-2) · owner origin slot 이 시스템 항목 후보만 담을 때만 끝에 더한다. 가족 표는 지연 평가 + origin id 리터럴 — 항목 origin 모듈과 순환 import 라 모듈 평가 시점 상수가 새 프로젝트 경로에서 undefined 였다 (ListBox section origin 이 조용히 빠짐, 같은 이유로 `*_STATIC_FAMILY` 의 origin 필드도 getter).
- RAC key `resolveSectionItemKey` (`slotRoles.ts`) — **ref instance section 안 항목은 전부** `<section key>/<항목 key>` (계획은 상속 항목만). 두 resolver 의 상속 id 모양이 다르다 (Preview 는 origin id 유지 + `_resolvedFrom` · Canvas 는 `<instance>/<segment>` + `ref`) — "상속 여부" 를 id 로 가르면 leg 마다 답이 갈린다. section instance 는 새 층이라 기존 선택값이 가리키는 항목이 없다 (BC Δ0). 이관이 만드는 section 은 plain 노드라 행 id 가 그대로 key.
- 이관: section · separator 가 섞인 정적 `items` → plain section 노드 (`props.id` · `aria-label` · Menu section 의 selection key) + Header + 항목 instance / Separator (하위 메뉴 행은 계속 건너뜀). 삽입 (`collectionItemInsert.ts`) — section origin 후보 → section instance (`props.id` 새 key, 선택 key 는 쓰지 않는다).
- 두 leg: Preview = RAC `ListBoxSection` · `MenuSection` · `GridListSection` + `Header`/`GridListHeader`/`MenuHeader` (section 별 Menu selection). Canvas = section block · Header 글자 (ListBox 14/700/21 muted padding 0 12 · GridList 16/400/24 — 각 목록 CSS 값) · 둘째 이후 ListBoxSection margin-top 12 · layout `TEXT_LEAF_TAGS` += header · Menu 트리거는 section · Separator 를 자식으로 세지 않는다.
- unit `adr238Phase2.sections.test.tsx` 14/14 · browser `tests/parity/adr238SectionDom.browser.test.ts` 3/3 (DOM oracle · 이관 전후 DOM 같음).
- live `apps/builder/scripts/adr238-live-sections.mjs` 5/5 (Compare Mode · Preview 미개방, 폭 400): reload 이관 모양 · ListBox Canvas rect = DOM oracle (section y5 h89 / y108 h57 · Header h21 · 항목 h32, Header 폭 ±1.5 = 글자 측정 sub-pixel) · GridList(stack) section h124/74 · Header h24 · 카드 h50 · Menu 트리거 상자 = section 없는 Menu · page error 0.
- 원복 RED: section origin 보장 제거 → 6 RED · section key 접두 제거 → 2 RED.

### Phase 3 — Select · ComboBox 항목 origin (G3)

- 가족 표 Select · ComboBox 행 (`listType: null`, 항목 = ListBoxItem · section = ListBoxSection) — 행 `id` → `props.id` · `value` → `props.value` · **명시** `textValue` 만 `props.textValue` · `isDisabled`. 바인딩 owner 는 `items` 유지. Select · ComboBox origin 도 sub-part 뒤에 항목 instance 4 · slot = ListBoxItem origin 2 + ListBoxSection origin.
- 행 읽기 한 곳 `readStaticPickerEntries` (`packages/shared/src/collections/staticPickerEntries.ts`) — Preview `renderSelect` · `renderComboBox` 의 popover 합성 · 선택 writeback (`selectedValue` = 항목 `value`, 없으면 key) · ComboBox 입력 일치와 Canvas scene `_staticItems` (owner 평면 행 → `resolveSelectDisplayValue`) 가 같이 읽는다.
- ComboBox 입력 일치 = label **또는** textValue — RAC 는 선택 뒤 input 을 textValue 로 채우는데 label 만 비교해 선택이 풀렸다 (items 경로도 같은 결함, 둘 다 수리).
- **live 에서 찾은 기존 회귀 수리**: Canvas 트리거가 선택과 무관하게 placeholder 를 그렸다. SelectValue text source 가 placeholder 전용이라 (ADR-923 round 15 `04503eebd`, 2026-09-01) owner propagation 이 `children` 에 싣는 고른 글자 (2026-08-22 `1578e8580`) 를 draw 가 읽지 않았다 — 팔레트 instance 는 238 전에도 같은 증상. `textSource.ts` 에 선택 값 leaf 군 (`SelectValue` = `children → placeholder`) — DOM (RAC SelectValue) 이 고른 글자를, 없으면 placeholder 를 그리는 것과 같다. Preview 는 SelectValue 자식 `children` 을 placeholder 로 직접 읽어 영향 없음.
- unit `adr238Phase3.pickers.test.tsx` 11/11 (이관 모양 · 선택 계약 id ≠ value · Preview writeback · ComboBox textValue 검색 · inputValue 우선 · origin slot style · Slot 삽입 · section 항목 선택 · Skia draw 글자) · 진단 (d) `it` 전환.
- live `apps/builder/scripts/adr238-live-pickers.mjs` 9/9 (Compare Mode · Preview 미개방): 팔레트 모양 Select · ComboBox instance — origin 항목 ListBoxItem instance 4 · 둘째 항목 선택 → Skia 트리거 글자 "Cat" (수리 전 "Choose an option...") · plain Select · ComboBox · section Select reload 이관 모양 (`props.id`/`value`/명시 `textValue`/`isDisabled` · ListBoxSection) · 트리거 상자 (root · SelectTrigger · SelectValue) 이관 전 = 후 · Skia 글자 이관 전 = 후 (일본 · 대한민국 · Pick) · section 항목 선택 = "Japan" · 항목 · section 자식 layout rect 0 (popover 내용) · 두 번째 reload 모양 불변 · page error 0.
- 원복 RED: `_staticItems` 주석 제거 → 3 RED · ComboBox textValue 일치 제거 → 1 RED · SelectValue text source 되돌림 → 1 RED ("Choose an option...").
- 회귀: builder components 26 파일 · canvas · preview · panels · stores · utils 전량 (기존 실패 historyActions.static 1 — ADR-232) · shared 1407 (기존 Modal placeable 1) · specs 565 · parity 1492 (기존 실패 4 — Dc6 inventory 2 · Hc2 GridList · Dialog fixed, 238-base worktree 에서 같은 4 실패 확인) · type-check 0.

### Phase 4 — 성능 · BC 종결 (G4 · G5)

- 대조 arm = 238 전 커밋 `61d29f98a` worktree (scratchpad, 그 lockfile · 엔진 wasm 소스 동일이라 복사 · dev `127.0.0.1:5174`). 두 arm 같은 세션 · headed · arm 교대 · warm-up 3 · 표본 7 · DPR 1 · visible · Home 만 보이게.
- **G4** `apps/builder/scripts/adr238-g4-perf-ab.mjs` — fixture 는 두 arm 모두 정적 `items` 로 넣고 reload (그 빌드의 hydration 이 만든 production 모양): sections = ListBox 6 · Menu 6 × section 3 × 항목 10 · select = Select 50 × 20 행. 조작 = owner 편집 · 항목 origin (`component-listbox-item-default`) 편집 · breakpoint.
  - 1차 (재사용 · prune 없음): select 편집 +11.8 ms (항목 ref 1,000 개 해석).
  - 증분화 ① popover 내용 scene 제외 (Canvas 가 그리지 않는 Select · ComboBox · Menu 항목) ② 해석 재사용 확장 — 237 leaf 재사용을 origin 자식이 있는 instance 로 (origin subtree 에 ref · `{{ }}` 가 없으면 origin canonical 동일성이 subtree 를 대신한다 · 합성 자손 기록 replay · section 을 상태 조상에 추가). → sections 편집 +1.1 · origin 편집 +3.1 · breakpoint +0.8 / select +4.6 · +12.5 · +2.7 → **사용자 판정 (2026-09-24): "Select 최적화 후 예외"**.
  - 증분화 ③ Select 최적화 — popover 항목을 **해석 전에** 뺀다: 문서 자식은 scene visit (`createPopoverChildFilter`, `adapters/canonical/popoverContent.ts`), instance 가 origin 에서 받는 자식은 해석기 `prunePopoverContent` (scene build 만 opt-in — Properties · Layers 조회는 전 항목). Select · ComboBox 는 선택 key · value 에 맞는 행 (그 section) 만 남겨 트리거 글자를 해석기가 그대로 만든다. prune 으로 Menu origin 이 "빈 slot" 표시를 켜던 것 → owner `hasPopoverContent` (canonical 기준) 를 slot 표시 판정이 읽는다.
  - **최종 (3 pair median p95, 238 전 → 238)**: select 편집 5.2 → 4.3 (−0.9) · origin 편집 4.1 → 4.8 (+0.7) · breakpoint 1.5 → 2.4 (+0.9) **PASS** / sections 편집 4.2 → 5.5 (+1.3) · origin 편집 4.4 → 6.5 (+2.1) · breakpoint 1.4 → 1.9 (+0.5 PASS). 두 번째 측정에서 sections 편집 0 ~ +2.1 · origin 편집 +1.3 ~ +3.8 (기준 arm 자체 2.0 ~ 4.8 흔들림). rebuilt 7/7 · 오류 0.
  - 총비용 (Q3): sections breakpoint +57 ms (61 → 117) — 238 전 Canvas 는 section 목록을 key 만 찍힌 빈 행으로 그렸다 (G0). 같은 규모 평면 목록 대조군 (`--fixture flat`, 두 빌드 모두 234 이관) 은 ~102 ms 로 238 회귀 없음, 같은 세션 프로파일에서 평면 124.7 vs section 132.3 ms (헤더 · section 36 노드분, 특정 hotspot 없음) — 글자를 실제로 그리는 비용이다. 편집 총비용 Δ −0.4 ~ +1.4.
  - **R5 잔존 (예외 기록)**: section 목록 편집 · 항목 origin 편집 +1.3 ~ +3.8 ms (실제 노드화 — 234 R4 와 같은 성격). 재개 조건 = 실제 문서 체감 저하 보고.
- **G5** `apps/builder/scripts/adr238-g5-bc-live.mjs` — before 빌드가 저장한 문서를 IndexedDB 저장 층째 after 에 넣고 reload:
  - 픽셀 Δ0 **14/14**: Components origin (Select · ComboBox · ListBox · Menu · GridList · ListBoxItem) · palette Select · ComboBox instance · 정적 items Select · ComboBox (factory 모양) · 평면 ListBox · section Menu 트리거.
  - 구조 oracle (G0 개정): section ListBox · GridList — before 는 key ("s1" · "s2") 만 찍힌 빈 행, after 는 헤더 · 항목 글자 (Phase 2 live 가 Preview DOM 수치로 판정).
  - 의도한 차이 2: 선택된 Select (plain · instance) — before 는 선택해도 "Pick" (ADR-923 r15 text source 회귀), after 는 "Japan" (Preview 와 같음, Phase 3 수리).
  - 노드 수식: Components 292 → 312 (+20 = 12 + 8) · plain Select · ComboBox +3 (= k) · section ListBox · GridList +7 (= 2s + m) · section Menu +5 (section 1 + Header 1 + 항목 2 + Separator 1) · 평면 ListBox · palette instance Δ0. byte: Select 항목당 ~172 B (150 ~ 250 범위). 저장 층 104,487 → 115,501 B.
  - 재hydration Δ0 (after reload 2 회 store 스냅샷 동일) · 오류 0/0.
- 원복 RED: slot 표시 `hasPopoverContent` 제거 → 1 RED · 해석 뒤 prune 제거 → 2 RED · visit 필터 제거 → unit GREEN (동작 동일 · 성능 전용 경로 — 근거는 G4: 필터 전 select 편집 +2.1 → 필터 후 −0.9).
- 회귀: Phase 1 · 2 · 3 live 6/6 · 5/5 · 10/10 (popover 항목 선택 — scene 밖 노드 — 오류 0 추가) · 234 live 5/5 · 5/5 · 3/3 · 9/9 · 237 live 9/9 · builder unit 7,388 (기존 실패 5 — 238-base 에서 같은 실패 확인) · parity 1,493 (기존 실패 4) · type-check 0.

### 판독 (review-loop-closure — 판독 1 + 수리 검증 1)

- 판독 1 (실행자 직접, 계약 체크리스트 대조): HIGH 0.
  - MEDIUM 수리: owner `hasPopoverContent` 가 scene 서명 (`createNodeProjectionSignature`) 에 없어, popover 항목이 전부 scene 밖인 owner 에서 그 값만 바뀌면 (빈 Menu origin 에 첫 항목) 서명이 같다 → 조건부 키로 서명에 넣었다 (없으면 키 생략 — 다른 노드 서명 불변).
  - 확인 — 재사용 확장의 stale 경로: scene 후처리 (Breadcrumb · Tag · picker 주석 · 위치 상태) 는 모두 새 객체로 교체해 재사용된 합성 자손을 고치지 않는다 · origin subtree 는 canonical 동일성이 대신한다 · 자기 자식 · ref · `{{ }}` 있는 subtree 는 대상 밖 · section 을 상태 조상에 추가.
  - LOW deferred (가설 — production writer 없음): SearchField · NumberField 의 SelectValue 도 text source 가 `children → placeholder` 가 되지만 factory `children` 은 `""`/부재, propagation 은 placeholder 만 쓴다 — AI 열린 props 쓰기로 SelectValue `children` 을 채울 때만 Preview (placeholder 만 읽음) 와 갈린다.
  - LOW deferred: `id` 없는 Select 행 — 이관 전에도 RAC 생성 key 라 reload 뒤 선택 key 가 맞지 않았다 (값 일치 fallback 은 양쪽 동일).
- 수리 검증: scene · Phase 3 unit 363 · Phase 3 live 10/10 · Phase 2 live 5/5 · type-check 0 → 닫힘.

### 번들 (task guard — ADR-201 initial 상한)

- production 빌드 initial closure JS gzip (`adr209-bundle-closure.mjs`, 238 전 `61d29f98a` worktree vs 현재): Builder 1,391,030 → 1,396,132 (**+5,102 B**) · Preview 640,019 → 643,341 (**+3,322 B**). 238 전 HEAD 가 이미 상한 (1,328,315 / 601,346) 을 +62,715 / +38,673 넘어 있다 (238 밖 기존 초과) — 사용자 보고.
