# Reusable·Slot Landscape 전수 분석 — catalog `kind:"reusable"` 0건의 실체와 slot 삽입점 지도

> 2026-07-07. 목적: "Catalog SSOT Reusable Slot 완성" 영역의 착수 전 실측 — (1) 현황 주장 검증,
> (2) 115 binding 전수 구조 분류, (3) slot 삽입점 패턴 일반화, (4) reusable 전환 후보와 차단 요인,
> (5) ADR-147 승격 판단 입력. **분석 문서 — 코드 변경 없음.**
>
> 방법: catalog/types/canonical schema/ADR-142·146·147·912·915 정독 + binding 115개 전수 스캔
> (병렬 3-agent) + git log 실측. 선례: [2026-05-30-canonical-component-inventory.md](2026-05-30-canonical-component-inventory.md).

## 0. 결론 요약

**"Reusable 항목 0건 / ADR-147 미구현 / 6-registry collapse ~50%" 라는 현황 인식은 개별 수치로는
맞지만, 세 축 모두 이미 다른 메커니즘으로 진행·종결된 부분이 있어 착수 전 정정이 필요하다.**

1. **reusable 메커니즘은 catalog 밖에서 이미 가동 중.** `REUSABLE_COMPOSITE_ORIGINS`
   (Toolbar·Form, ADR-912 R-5 proof 2건) + ListBox 계열 origin 3종(ADR-146/147) +
   Tabs/Card 검증·fork UX(ADR-138 Implemented). catalog `kind:"reusable"` 0건은
   "reusable 부재"가 아니라 **등록 이원화(catalog ↔ 별도 레지스트리) 미해소**다.
   그리고 이 이원화에는 스키마 원인이 있다 — §7 type 충돌 참조.
2. **ADR-147 은 Phase 1~5 가 이미 반영됐다** (`f12808623`, 2026-05-29). Proposed 잔존
   이유는 Phase 7 cross-check 대기이며, 이후 ADR-912 가 ListBoxItem Skia 경로를
   spec `render.shapes` → catalog rule + `listbox_item` escape 로 대체하고 ListBox spec 을
   물리 삭제(`d139a445b`)해서 **본문 Phase 2 서술이 stale** — 승격 전 amend 필요.
3. **6-registry collapse 는 P2 종결(사용자 결정 2026-06-17/18, `2fb5860b3`).** 잔여
   #4 rendererMap(DELEGATING ~24 = 영구 잔존 설계) / #6 factory creators(45)는 독립
   collapse 작업이 아니라 각각 generic 흡수·R-5 reusable child template 에 **종속**으로 판정됨.
   "~50% 미완"이 아니라 "파생 가능 축은 종결, 잔여 2축은 종속 판정".

## 1. 현황 주장 ↔ 실측 대조

| 주장                              | 실측                                                                                                                      | 판정                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Primitive 항목 110+               | `primitiveEntry()` 115 호출 = binding 115 파일, family ①~⑦ 전부 `cutover:"catalog"`                                       | ✅ 정확                                     |
| Native 항목 2 (frame, Slot)       | `nativeEntry` frame + Slot(layoutOnly), metadata-only                                                                     | ✅ 정확                                     |
| Reusable 항목 0건                 | catalog `kind:"reusable"` entry 0. 단 reusable origin 은 Toolbar/Form/ListBox 계열 등 **가동 중** (§2)                    | ⚠️ 수치만 정확 — "미구현" 아님, 등록 이원화 |
| ADR-147 미구현                    | **Phase 1~5 반영 완료** (`f12808623` + 후속 3 커밋). Status Proposed = Phase 7 cross-check 대기 + ADR-912 이후 전제 stale | ❌ 정정 필요                                |
| ADR-915 진행 중                   | Accepted (2026-06-25). P0+P1 반영(`db2cf46bc`), P1.5(RSP custom)·P2/P3 잔여                                               | ✅ 정확                                     |
| 6-registry collapse ~50%          | P2 종결 선언(축 한정 달성). #1 ComponentList·#2 ALIAS(0)·#3 BASE_TAG_SPEC_MAP 파생 완료, #5 부분(6/92), #4·#6 은 종속 축  | ⚠️ 프레임 정정 필요                         |
| ADR-142 (문맥상 Proposed 취급)    | **Implemented 2026-06-02** (scope 축소). 후속 실행은 ADR-912 Implemented 2026-06-18                                       | ❌ 정정 필요                                |
| Binding 115 vs Prop Contract 편차 | ADR-915 P0+P1 로 폼 축 복원 완료, P1.5(contextualHelp 12 spec 등)·P2/P3(컬렉션 core·Color 채널 등) 잔여                   | ✅ 정확 (잔여 명세화됨)                     |

## 2. 스키마·메커니즘 인벤토리 (slot/reusable 전 계층)

### 2-1. canonical schema (`composition-document.types.ts`)

| 필드                                    | 의미                                                                                                                                                                        | 현재 소비 실태                                                                                                                                                            |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CanonicalNode.reusable: boolean`       | 재사용 원본 승격                                                                                                                                                            | ListBox 계열 3 origin + Toolbar/Form origin + 사용자 승격 flow(ADR-138)                                                                                                   |
| `CanonicalNode.slot: false \| string[]` | **pencil 공식 semantics: 이 slot 에 삽입 가능한 reusable component ID 추천 목록** (slot 이름 목록이 아님)                                                                   | 실사용 1건 — ListBox origin `slot:[item-default, item-selected]` (:211). resolver 는 추천 범위 밖 자식에 **non-blocking 경고만** (`resolvers/canonical/index.ts:385-404`) |
| `RefNode.descendants`                   | 3-mode override (patch / node replace / children replace)                                                                                                                   | 구현·테스트 완료 (ADR-138 G1 vitest 11 시나리오)                                                                                                                          |
| `FrameNode.placeholder`                 | 빈 slot placeholder UI hint                                                                                                                                                 | frame 전용                                                                                                                                                                |
| child `metadata.slotRole`               | **ADR-147 이 도입한 slot 식별 컨벤션** — `icon`/`label`/`description` (`LISTBOX_ITEM_SLOT_ROLES`). SelectionIndicator 는 render-time concern 으로 제외(ComponentTag 비멤버) | ListBoxItem origin 조합 자식에서 가동                                                                                                                                     |

핵심: **slot "이름"의 SSOT 는 `CanonicalNode.slot` 이 아니라 child `metadata.slotRole`** 이다.
`slot` 필드는 삽입 가능 reusable ID allow-list(추천)로, 두 축이 직교한다. 신규 slot 설계 시
이 구분을 유지해야 pencil format 정합이 깨지지 않는다.

### 2-2. catalog (`packages/shared/src/catalog`)

- `kind:"reusable"` union: `{ type, family, cutover, reusableId, panel }` — **entry 0건**.
  `getCatalogDefaultProps` 는 reusable/native 에 빈 객체 반환(파생 대상 0, factory-local).
- `PropsSchema`(= `Record<string, PropContract>`) 타입이 reusable 의 D2 편집 스키마로 예약되어
  있으나(ADR-142 Decision #14) 소비 구현 없음.
- binding `rac.slots` 메타: **field 계열 9종만 보유, 전부 `[description, errorMessage]`** —
  TextField/TextArea/SearchField/NumberField/TimeField/DateField/ColorField/CheckboxGroup/RadioGroup.
  internal source 74종은 rac 메타 자체가 없어 구조 신호가 주석·factory·projection 에만 있다.

### 2-3. reusable origin 실행 계층 (catalog 밖)

| 메커니즘                                                     | 멤버                                                                                                                                      | 방식                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `REUSABLE_COMPOSITE_ORIGINS` (`reusableCompositeOrigins.ts`) | Toolbar(1단: Button×3+Separator), Form(2단: Form>FormField>Label+TextField)                                                               | palette-add 시 `useElementCreator` 가 COMPLEX/simple 분기 **앞에서** 조회 → `type:"ref"` instance 생성. origin 은 Components page body 에 멱등 seed (`ensureReusableCompositeOrigins`, bootstrap 2진입점). **신규 조합 = origin 모듈 + 맵 1줄 (factory 코드 0)** — ADR-912 HC#5 증명 |
| ListBox 계열 (`listBoxTemplateOrigins.ts`)                   | `component-listbox` (slot allow-list 보유) + `component-listbox-item-default/-selected` (reusable + slotRole 조합 자식 + flat props 병존) | ADR-146 ref-template + ADR-147 slot 조합. row projection 이 `{label}`/`{description}`/`{icon}` 템플릿 바인딩을 columnMapping/dataBinding 으로 채움                                                                                                                                   |
| ADR-138 reusable 검증·UX                                     | Tabs(dynamic items)·Card(region/descendants) pilot                                                                                        | origin-instance 부착, items shallow fork + `InstanceForkBadge`. Implemented 2026-05-18                                                                                                                                                                                               |

**이원화의 실질**: Toolbar 는 catalog 에 **primitive entry 로 이미 존재**한다(rac:Toolbar —
origin 문서의 root 노드이자 RAC leaf). 생성 경로만 REUSABLE_COMPOSITE_ORIGINS 가 가로채
ref instance 를 만든다. `CATALOG_BY_TYPE` 은 type 당 entry 1개이므로 같은 type 에
`kind:"reusable"` entry 를 추가하면 primitive entry 와 **충돌**한다 — §7 참조.

## 3. Binding 115 구조 landscape — 5분류

전수 스캔 결과, slot/조합 관점에서 115 binding 은 다섯 구조 유형으로 나뉜다.

| 유형                                           | 정의                                                                                                  | 멤버 (전수)                                                                                                                                                                                                                                                                                                                                         | slot 함의                                                                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **A. RAC slot 명시 field** (9)                 | `rac.slots:[description,errorMessage]` — D1 권위가 삽입점 선언                                        | TextField, TextArea, SearchField, NumberField, TimeField, DateField, ColorField, CheckboxGroup, RadioGroup                                                                                                                                                                                                                                          | 표준 보조 텍스트 slot. Label/Input/FieldError 자식은 canonical children 트리                                      |
| **B. factory 자동 자식 compound** (~16)        | factory 가 명명된 자식 트리 자동 생성, `_hasChildren` shell                                           | Card(+CardPreview/Header/Content/Footer), Toast(Heading+Description), Meter·ProgressBar(Label+Value+Track), Slider(Track+Thumb+Output), AvatarGroup, ButtonGroup, CardView, Pagination, TableView(+TableHeader/TableBody/Column/Row/Cell), ColorPicker, ColorSwatchPicker, InlineAlert, Dialog(+DialogFooter), Tooltip, Disclosure(+Header/Content) | **실질 slot = factory 자식 자리.** named-region(Card)·value-compound(Meter)·trigger/panel(Disclosure) 패턴의 원천 |
| **C. projection 전용 sub-part** (~20)          | canonical element 없음 — 런타임 SceneNode(Skia 대칭 목적 등록), DOM 은 부모 self-compose(독립 노드 0) | ListBoxItem, GridListItem, Tab, TabList, Tag, TagList, TableRow, TableCell, Breadcrumb, DateInput, CalendarGrid, CalendarHeader, DisclosureHeader†, SelectTrigger/Value/Icon, SliderTrack/Thumb/Output, MeterTrack/Value, ProgressBarTrack/Value                                                                                                    | slot 을 canonical 로 승격하려면 ADR-147 모델(조합 자식 + projection 주입) 이식 필요                               |
| **D. wrapper self-compose (DELEGATING)** (~13) | items/dataBinding SSOT → RAC 합성 렌더러가 자식 재귀 대신 자기완결                                    | Select, ComboBox, Menu, Tabs, TagGroup, Tree, Table, Breadcrumbs, Disclosure, DisclosureGroup, ListBox, GridList, DatePicker/DateRangePicker/Calendar/RangeCalendar                                                                                                                                                                                 | collection 삽입점은 `items-manager` itemSchema 가 데이터로 정의 (아래)                                            |
| **E. 순수 leaf** (나머지 ~57)                  | 단일 box/text/glyph — 내부 구조 없음                                                                  | Button, ToggleButton, Text, Heading, Paragraph, Code, Kbd, Label, Description, FieldError, Icon, Badge, Avatar, Link, Separator, Skeleton, StatusLight, ProgressCircle, Checkbox, Radio, Switch, Input, Cell, Column, Color leaf 5종 등                                                                                                             | slot 없음. 단 **조합의 재료** — icon+Button 류는 reusable 문서로 (§5)                                             |

† DisclosureHeader 는 B(Disclosure factory 자식)이면서 DOM 은 부모 self-compose — B/C 경계 사례.

**collection itemSchema 실측** (D 유형의 데이터 정의 slot): Menu 가 가장 리치
(`label,value,href,isDisabled,icon,shortcut,description,onActionId` 8키), ListBox 6키
(icon 은 projection 주입), ComboBox 7키, GridList 4키, TagGroup 3키(`label,isDisabled,allowsRemoving`).
itemSchema 키가 곧 collection item 의 slot 후보 목록이다.

## 4. Slot 삽입점 패턴 일반화 — 5 + 1

| 패턴                               | 구조                                                                         | 근거 실증                                                                                                                                                                                                | 일반화 대상                                                                                                                                        |
| ---------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P1. field 보조 텍스트**          | control + `[description, errorMessage]`                                      | RAC slots 메타 9종 (D1 권위)                                                                                                                                                                             | 신규 field 는 자동 상속 — 추가 설계 불필요                                                                                                         |
| **P2. collection item multi-slot** | leading icon \| label / description 스택 \| trailing (check·shortcut·remove) | **ADR-147 ListBoxItem 가동 중** (slotRole + projection 주입 + `listbox_item` escape)                                                                                                                     | GridListItem(label/description), MenuItem(icon/shortcut/description — itemSchema 에 이미 존재), Tag(label/remove), TreeItem(chevron/label)         |
| **P3. named-region**               | preview / header / content / footer                                          | Card factory 4 자식 + propagation(title→Header, description→Content), Dialog+DialogFooter, Toast(title/description)                                                                                      | 사용자 문서의 "header/content/footer/action 일반화" 요구와 정확히 대응. **P3 이 reusable origin 저작의 기본 골격** (Toolbar/Form proof 도 P3 계열) |
| **P4. value-display compound**     | Label / Value / Track                                                        | Meter ≡ ProgressBar 완전 동형(factory 3 자식), Slider(Output/Track/Thumb — rac.parts 와 sub-part 가 일치하는 유일 세트)                                                                                  | 게이지류 신규 컴포넌트                                                                                                                             |
| **P5. trigger / panel**            | trigger 영역 + overlay/panel 영역                                            | Disclosure(Header trigger/Content panel), Select·ComboBox·NumberField·SearchField 가 **공유하는 field-trigger sub-part 세트**(SelectTrigger/Value/Icon — alias 해체로 합류), DatePicker(trigger/popover) | dropdown·아코디언류                                                                                                                                |
| **+ layout slot**                  | frame / Slot native + page frame(header/content/footer/custom)               | ADR-130/135 별도 시스템 (projection·mirror 규칙 존재)                                                                                                                                                    | 컴포넌트 slot 과 직교 — 혼동 금지                                                                                                                  |

## 5. Reusable 전환 후보와 차단 요인

### 적격성 기준 (ADR-912 R-5 실측 판정 승계)

- **적격**: factory definition 이 순수 자식 트리 생성이고 DOM 이 generic 자식 재귀 —
  origin 문서 + 레지스트리 1줄로 대체 가능 (Toolbar/Form 이 이 조건으로 통과).
- **부적격**: DELEGATING self-compose / event-handler 합성 — origin 문서가 렌더러의 자기완결
  로직을 대체하지 못함. **2026-06-16 판정: 차기 적격 실측 0건** (DisclosureGroup/Disclosure/
  Nav/ToggleButtonGroup 검토 후 전부 부적격). 잔여 factory creator 45개의 조합 저작은
  rendererMap generic 흡수(#4)와 종속 관계.

### 후보 우선순위

| 순위 | 후보                                                          | 유형                                   | 차단 요인                                                                                                                          | 근거                                                                                                                                                                                       |
| :--: | ------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
|  1   | **icon + Button / icon + ToggleButton**                       | **신규 조합** (기존 factory 대체 아님) | 없음 — DELEGATING 차단 비적용                                                                                                      | Button·Icon·ToggleButton binding 주석이 명시 지목 ("아이콘 붙은 Button 은 reusable 조합 문서", ADR-142 §3). 첫 `kind:"reusable"` catalog entry 최적 — 신규 type 명이라 §7 type 충돌도 없음 |
|  2   | **Card 4-region**                                             | factory 대체                           | 적격성 재판정 필요 — catalog 주석상 DOM 은 generic(`react-aria-Card[data-variant]`)이나 CardPreview 자식 Image 경로가 self-compose | P3 패턴 정본. propagation(title/description 라우팅)의 origin 문서 이식 설계 필요                                                                                                           |
|  3   | **Toast / InlineAlert / IllustratedMessage** (상태 메시지 군) | factory 대체                           | Toast 는 DELEGATING(renderToast), IllustratedMessage 는 INTERNAL_RENDERERS 어댑터(props 직접 소비) — 각각 재판정                   | heading+description 2-slot 동형 3종 — 묶음 저작 효율                                                                                                                                       |
|  4   | **collection item slot 확장** (GridListItem → MenuItem)       | ADR-147 패턴 이식                      | ADR-147 closure 선행 필요 (§6) — ListBox 단일 proof scope 명시 (ADR-147 Consequences)                                              | itemSchema 에 icon/shortcut/description 이 이미 데이터로 존재                                                                                                                              |
|  5   | Pagination / ButtonGroup / AvatarGroup / CardView             | factory 대체                           | 전부 DELEGATING self-compose — 현 기준 부적격                                                                                      | rendererMap #4 축 정리 후 재검토                                                                                                                                                           |

### 차단 메모리 정합

`feedback-no-dormant-foundation-ahead-of-flip`: 소비처 없는 reusable child template schema
선축은 차단 영역 (ADR-912 P2 종결 문서가 #6 파생 불가 사유로 직접 인용). 따라서
"reusable 항목 batch 생성" 식 일괄 접근은 이 차단과 충돌 — **소비 경로가 있는 후보(1~3)부터
수직 슬라이스**가 기존 판정과 정합하는 경로다.

## 6. ADR-147 승격 판단 입력

| 항목             | 실측                                                                                                                                                                                                                                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 반영 완료        | Phase 1(origin 조합+slotRole) / 2(spec+CSS `[slot]`) / 3(Preview `<Text slot>` emit + Path2 description 수정) / 4(getItemIcon columnMapping) / 5(ListBoxItemEditor slot 재작성, Field·"Convert to Dynamic" 제거) — `f12808623`, 이후 `a7d2b9299`(layout 편집+이중 렌더 수정), `66e979930`(RAC 정합+height drift), `4e1f43f03` |
| 잔여             | Phase 7 cross-check + closure (커밋 메시지 명시 "cross-check 대기"). Phase 6 마이그레이션은 개발 단계 판정으로 축소 (`feedback-dev-stage-no-bc-migration` 정합; `legacyListBoxTemplateMigration.ts` 는 존재)                                                                                                                  |
| **전제 stale 1** | 본문 Decision 4/breakdown Phase 2 의 D3 경로가 "ListBoxItem.spec `render.shapes`" 기준 — 이후 ADR-912 가 catalog rule + `listbox_item` skiaPrimitive(replace) 로 대체(2026-06-14 `53da62b6a`)하고 ListBox spec 물리 삭제(`d139a445b`). R4(generic 렌더러 흡수)가 예정대로 실현된 것이나 **본문은 미반영**                     |
| **전제 stale 2** | SelectionIndicator — 본문은 조합 자식으로 선언했으나 구현은 render-time concern 으로 제외 (ComponentTag 비멤버, 구현 주석 명시). slotRole 은 3종만                                                                                                                                                                            |
| **전제 stale 3** | slot allow-list — breakdown 은 `slot:["label","description",...]` (slot 이름)로 썼으나 구현은 pencil 공식 semantics(reusable ID 목록)를 따라 ListBox origin 에 부여, slot 이름은 slotRole 로 분리. **구현이 옳고 문서가 낡음**                                                                                                |
| 승격 경로        | 본문 amend(진행 로그 + stale 3건 정정) → `/cross-check` ListBoxItem 3축 → live behavior 1회 exercise → Implemented. 승격 자체는 사용자 확인 사안                                                                                                                                                                              |

## 7. catalog `kind:"reusable"` 통합 — 설계 긴장 1건

단순 "entry 추가"가 안 되는 이유: **`CATALOG_BY_TYPE` 는 type 당 entry 1개**인데, R-5 proof 의
Toolbar/Form 은 origin root 가 RAC primitive type 그 자체다 — Toolbar 는 이미 primitive entry
(rac:Toolbar, family ①)로 등록돼 있고 binding 은 origin 내부 leaf 렌더에 여전히 필요하다.
같은 type 에 reusable entry 를 겹칠 수 없다. 선택지:

- **(a) primitive entry 에 `reusableOriginId?` 부가 필드** — union kind 유지, 생성 경로 힌트만
  catalog 로 이관. `REUSABLE_COMPOSITE_ORIGINS` 를 catalog 파생으로 대체(diff 최소). 단
  "kind:reusable 항목"은 계속 0건 — union 의 reusable variant 는 icon+Button 류 **신규 type 전용**이 됨.
- **(b) 신규 조합만 `kind:"reusable"` entry** — icon-button 등 origin root 가 독자 type 명을
  갖는 경우만 reusable entry 로 등록. Toolbar/Form 은 (a) 방식과 병행.
- **(c) 현행 이원화 유지** — REUSABLE_COMPOSITE_ORIGINS 가 이미 "origin 모듈 + 맵 1줄" 계약을
  충족. catalog 통합의 실익(팔레트 meta 는 이미 primitive entry 가 제공)이 작다는 판정도 가능.

어느 쪽이든 **ADR 없이 결정할 사안이 아니라 후속 결정 대상** — 본 문서는 선택지 기록까지만.

## 8. 권장 착수 순서 (제안)

1. **ADR-147 closure** — stale 3건 amend + cross-check + live exercise → 승격 여부 사용자 확인.
   slot 모델의 유일 가동 실증을 문서 정합 상태로 만드는 것이 모든 후속의 base.
2. **icon+Button reusable 수직 슬라이스** — 신규 조합이라 차단 0. 첫 `kind:"reusable"` catalog
   entry + origin 모듈 + palette 노출 + propsSchema(PropContract) 소비 첫 구현까지 한 슬라이스.
   §7 선택지 결정을 이 슬라이스의 설계 입력으로 포함.
3. **collection item slot 이식** (GridListItem → MenuItem) — ADR-147 패턴 복제, itemSchema 와 정합.
4. P2/P3 prop parity 잔여(ADR-915 후속)와 rendererMap #4 축은 독립 트랙 유지.

## 부록 — 근거 커밋/파일 인덱스

- catalog: `packages/shared/src/catalog/componentCatalog.ts` (115 primitive + 2 native),
  `types.ts` (`ComponentCatalogEntry` union, `PropsSchema`, `rac.slots`)
- reusable 실행 계층: `apps/builder/src/builder/components/reusableCompositeOrigins.ts`,
  `toolbar/toolbarTemplateOrigins.ts`, `form/formTemplateOrigins.ts`,
  `listbox/listBoxTemplateOrigins.ts` (slotRole 정의 :23-41, slot allow-list :211)
- resolver slot 소비: `apps/builder/src/resolvers/canonical/index.ts:385-404`
- ADR-147 반영: `f12808623`(Phase 1-5) → `a7d2b9299` → `66e979930` → `4e1f43f03`;
  Skia 경로 대체: `53da62b6a`(ListBoxItem catalog cutover) → `d139a445b`(ListBox spec 삭제)
- R-5 proof: `2ab101fd5`(Toolbar) → `542e42190`(Form); P2 종결: `2fb5860b3`
- ADR-915 반영: `db2cf46bc`(P0+P1)
- ADR: 142(Implemented 2026-06-02) / 912(Implemented 2026-06-18, completed/) /
  146(Implemented 2026-05-28, completed/) / 147(Proposed) / 138(Implemented 2026-05-18) /
  915(Accepted 2026-06-25)
