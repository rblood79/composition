# ADR-238 구현 상세 — 목록 항목 안 slot · Section 층 · Select/ComboBox 항목 origin

> 본문: [ADR-238](../238-collection-item-slots-sections-picker-items.md) · base: [ADR-234](../completed/234-variant-instances-and-slot-filled-collections.md) · 같은 base 의 앞선 적용: [ADR-237](../completed/237-origin-instance-slot-extension.md)

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

(실행 시 기록)
