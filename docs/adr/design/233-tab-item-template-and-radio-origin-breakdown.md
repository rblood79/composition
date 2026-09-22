# ADR-233 구현 상세 — Tabs 의 Tab 항목 템플릿 origin + Radio origin

> 본문: [233-tab-item-template-and-radio-origin.md](../233-tab-item-template-and-radio-origin.md)
> 선례: ADR-229 (TagGroup 항목 템플릿 · 조합 자식 ref) · ADR-230 (기본 요소 상태 변형 origin) · ADR-228 (reusable origin · Modal `placeable:false`)

## 1. 전제 lock-in (4 질문)

1. **base / 응용 분류**: base = ADR-148/229 의 item template 모델과 ADR-228/229 의 reusable origin + 조합 자식 ref 규칙 (둘 다 Implemented). 이 ADR 은 그 모델을 Tabs · RadioGroup 에 적용하는 **응용**이다. base 쪽 해소기 (`resolveCanonicalRefTree` 일반 자식 경로 · `toOriginChildSeed` · `stateVariantResolution`) 는 바꾸지 않는다.
2. **schema 직교성**: 새 필드 0. Tab 항목 origin 은 229 의 `slot: [default, selected]` + `metadata.variant` 모양, Radio origin 은 228 의 `component-<type>` 모양, Radio 상태 변형은 230 의 `<origin>--<state>` 모양 — 전부 기존 schema 의 인스턴스다.
3. **선행 ADR 전제 재검증**: ADR-230 이 Radio/Tab 을 뺀 사유는 "base origin 부재" 하나 (230 breakdown §2 `:60`, `:130`, `:159`) — 이 ADR 이 그 선행 조건을 채우고, 230 의 해소 경로는 그대로 쓴다 (의존 방향 230 → 233 이 아니라 233 이 230 의 입력을 만든다). ADR-066 (Tab = `items` SSOT, Tab element 없음) 은 유지한다 — Tab 을 canonical 자식으로 되돌리지 않는다.
4. **사용자 confirm**: 2026-09-23 후속 후보 실측 보고 ("1 + 2 를 한 ADR 로") 직후 사용자 `/create-adr` 호출. Tab 항목의 disabled/interaction 변형 · Breadcrumbs · Select 팝업 · 기존 문서 이관은 범위 밖 (본문 Context §Soft).

## 2. 코드 사실 (2026-09-23, main `3f50bcf6c`)

| ID  | 사실                                                                                                                                                                                                                                                                                | 근거 (경로:라인)                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| F1  | 항목 템플릿 origin 이 있는 collection 은 4개뿐 — ListBox (default·selected) · GridList · Menu · Tag (default·selected)                                                                                                                                                              | `components/{listbox,gridlist,menu,taggroup}/*TemplateOrigins.ts`                                             |
| F2  | Tab 행 projection 은 템플릿을 읽지 않는다 — rows group · 각 Tab 노드 모두 `templateOriginId: null`. Tab props = `{title, children, style:{width:fit-content}, _isSelected, _showIndicator, tabId, variant?, size?, isDisabled?}`                                                    | `workspace/canvas/scene/canvasSceneNode.ts:2486-2585` (null `:2537`, `:2582`)                                 |
| F3  | Tab 선택 판정 = `selectedKey ?? defaultSelectedKey` (ListBox/Tag 공용 `isListBoxRowSelected` 와 다름)                                                                                                                                                                               | `canvasSceneNode.ts:2505-2511`                                                                                |
| F4  | Tag 선례의 read-through: `resolveTagTemplateOriginIds` (owner root `slot` → legacy TagList slot → 상수, selected 는 `metadata.variant`) · `resolveTagItemTemplateStyle` (responsive 해소 + shared `resolveItemTemplateChipStyle`) · chip 에 style/fills/_slots 주입                 | `canvasSceneNode.ts:674-711`, `:713-727`, `:2161-2181`                                                        |
| F5  | Preview Tabs 는 `<Tab id={item.id}>{item.title}</Tab>` — 템플릿 · 항목별 `isDisabled` 둘 다 없다 (Skia 행은 `row.isDisabled` 를 싣는다 — 기존 비대칭)                                                                                                                               | `packages/shared/src/renderers/LayoutRenderers.tsx:118`, `:134-135`, `:197`                                   |
| F6  | Preview 템플릿 주입 채널 = `App.tsx` `templateSlotCompositions` (문서 1회 계산) → renderContext (`listBox…` · `gridList…` · `menuItem…` · `tag`)                                                                                                                                    | `apps/builder/src/preview/App.tsx:300`, `:893-898`                                                            |
| F7  | Tabs factory = `items [{id,title}]` + TabList (빈 props) + TabPanels > TabPanel (`itemId` 페어링) — ADR-066                                                                                                                                                                         | `factories/definitions/LayoutComponents.ts:8-66`                                                              |
| F8  | Tab 은 catalog primitive (palette 비노출 · projection 전용) — `accepts` 는 `title` · `size`, Skia `tab_indicator`                                                                                                                                                                   | `packages/shared/src/catalog/componentCatalog.ts:785-793` · `catalog/bindings/Tab.binding.ts`                 |
| F9  | RadioGroup factory = Label + Radio ×2 (canonical 자식, 각 Radio > Label) — ADR-912 starter 구조                                                                                                                                                                                     | `factories/definitions/GroupComponents.ts:184-260` · Radio 단독 `:428-455`                                    |
| F10 | Radio 는 catalog primitive (`selection`) 지만 reusable origin 이 없다 — `PALETTE_REUSABLE_ORIGIN_TYPES` 52 에 없음 · 팔레트 (`PALETTE_ORDER`) 에도 없음                                                                                                                             | `componentCatalog.ts:595`, `:1228-1296` · `panels/components/paletteItems.ts:186`                             |
| F11 | 조합 자식 ref 규칙은 reusable origin 이 있는 타입만 바꾼다 — Radio 는 그대로 plain                                                                                                                                                                                                  | `components/originChildRefs.ts:289-325` (`getReusableOriginId` `:305-308`)                                    |
| F12 | 2단 seed 는 **이번 호출 전에 없던** origin 의 자식만 ref 로 바꾼다 — 기존 문서의 `component-radiogroup` 자식은 plain 유지                                                                                                                                                           | `originChildRefs.ts:384-420`                                                                                  |
| F13 | 팔레트 밖 reusable 선례 = Modal (`placeable:false`, 기존 문서 ref 해소용 등록 유지)                                                                                                                                                                                                 | `componentCatalog.ts:1316-1338`                                                                               |
| F14 | 상태 변형 기본 요소 = 5 (Button · ToggleButton · Link · Checkbox · Switch) — Radio/Tab 제외 사유 = base origin 부재                                                                                                                                                                 | `components/stateVariantOrigins.ts:45-53` · ADR-230 breakdown `:60`, `:130`, `:159`                           |
| F15 | Skia Radio 선택 = 조상 RadioGroup `value` (깊이 3 탐색) 우선, 없으면 자기 `isSelected`                                                                                                                                                                                              | `workspace/canvas/skia/buildSpecNodeData.ts:1154-1170` (호출 `:1720`)                                         |
| F16 | Preview RadioGroup 은 자식을 `child.type === "Radio"` 로 거른다 — ref 자식은 Preview 해소기가 master type 으로 실체화한 뒤여야 한다 (229 G0 가 Form Button 에서 확인한 경로)                                                                                                        | `packages/shared/src/renderers/FormRenderers.tsx:901-920` · `renderRadio` `:833`                              |
| F17 | slot 보유자 정책 표 = ListBox · GridList · Tag origin id 집합 (Tabs 없음)                                                                                                                                                                                                           | `components/slotHostPolicy.ts:1-40`                                                                           |
| F18 | Preview 는 Radio 를 catalog RAC primitive 로 직접 그린다. 고아 collection 항목 호스트 표 `ORPHAN_ITEM_HOST` 에 Radio 가 없고, `renderRadio` 의 그룹 fallback 은 이 경로에서 호출되지 않는다 → 독립 Radio = `TypeError: … reading 'isDisabled'` (리뷰 h1 진단 RED, 독립 Tab 은 통과) | `apps/builder/src/preview/components/CanonicalNodeRenderer.tsx:134-167`, `:574-644` · `FormRenderers.tsx:868` |
| F19 | Preview selected 변형 = `isSelected: true` 만 켠다 — RAC Radio 는 `isSelected` 를 받지 않고 그룹 `value` 로만 선택된다                                                                                                                                                              | `CanonicalNodeRenderer.tsx:467` · `catalog/bindings/Radio.binding.ts:15-20`                                   |
| F20 | 기존 시스템 root slot 보충 선례 — `component-taggroup.slot` 이 없을 때만 채운다 (기존 노드 JSON 은 필드 1 만큼 바뀐다)                                                                                                                                                              | `components/taggroup/tagGroupTemplateOrigins.ts:163-165`                                                      |

Phase 0 에서 확정할 것 (현재 미확정): Tab 항목 추가·편집 UI 경로 (Tabs 는 `items-manager` binding 이 없다 — 어디서 `items` 와 TabPanel 쌍을 만드는가) · Tab 행 높이/폭 측정이 템플릿 style 을 읽어야 하는 층 (229 F28 chip 폭 선례) · Radio ref 자식의 Preview 실체화 여부 (F16 RED/GREEN).

## 3. Phase

### Phase 0 — inventory freeze (G0)

- F1~F20 재grep · 미확정 3건 확정 (§2 끝).
- 진단 RED 고정: ① Tabs origin 에 Tab 항목 origin 을 손으로 붙인 fixture 에서 Skia Tab 이 origin style 을 안 읽는다 ② RadioGroup origin 자식을 Radio ref 로 손 시드한 fixture 가 두 leg 에서 Radio 로 실체화되는지 (F15 · F16) — 실패하면 해소기 수리가 Phase 2 선행.
- 진단 RED ③: production catalog 경로 (`getCatalogCutoverTypes()` 로 등록한 `CanonicalNodeRenderer`) 에서 독립 Radio (default · `isSelected` · `isDisabled`) 렌더 크래시 (F18) — 리뷰 진단을 제품 트리 테스트로 고정.
- BC 예상 (리뷰 m2 — 세 칸을 나눈다): **추가 노드** Tab 항목 origin 2 (+ label 자식 2) · `component-radio` 1 (+ Label 1) · Radio 상태 변형 5 (+ Label 5) = **Δnode 16** · **허용 보충 필드** `component-tabs.slot` (부재 시만) = **Δfield 1** · **Δbyte** 추정 ≈ 3.3 KB (228 실측 205 B/노드) → G0 에서 실제 직렬화 길이로 확정해 G4 기준값으로 쓴다.

### Phase 1 — Tab 항목 템플릿 origin (G1 · G2 Skia)

- `components/tabs/tabsTemplateOrigins.ts` (신규): `component-tab-item-default` · `component-tab-item-selected` (`metadata.variant: "selected"`), 자식 Text `{label}` (`slotRole: "label"`). `component-tabs` origin root 에 `slot: [default, selected]` (Tag 와 같은 root 소유 — 229 F27).
- ensurer 등록 (`ensureTemplateOrigins` — 229 와 같은 소유자 하나).
- Skia: `resolveTabTemplateOriginIds` · `appendTabRowProjection` 에 템플릿 style/fills/_slots 주입 (Tag 선례 F4 동형, 선택 판정은 F3 그대로). 폭·높이 측정 층 (Phase 0 확정분) 동시 수정.
- Preview: `templateSlotCompositions.tab` → renderContext `tabTemplate` → `renderTabs` 가 Tab 에 root style (+ selected overlay) · label slot 적용. shared `resolveItemTemplateChipStyle` 재사용 (두 leg 같은 함수).
- slot 보유자 정책 (`slotHostPolicy.ts`) 에 Tab 항목 origin id 집합. Slot 절 "+" 는 Phase 0 에서 기존 탭 추가 경로가 확인되면 그것을 호출 (TabPanel 쌍 생성), 없으면 후속으로 기록.

### Phase 2 — Radio origin + 상태 변형 (G1 · G2 Skia)

- `PALETTE_REUSABLE_ORIGIN_TYPES` 에 Radio 추가 + Modal 선례처럼 `placeable:false` (팔레트 노출 0 · 등록 1). 목록 이름과 뜻이 어긋나면 (팔레트 밖 항목) 별도 상수 `NESTED_REUSABLE_ORIGIN_TYPES` 로 분리 — Phase 0 에서 ratchet test (`catalogOrigins.test` · `componentRegistrationContract.test`) 영향으로 판정.
- `component-radio` seed = `buildCatalogOrigin("Radio")` (factory 와 같은 트리, 228 계약).
- RadioGroup: 새로 생기는 `component-radiogroup` origin 의 Radio 자식 → ref (`toOriginChildSeed` 가 자동, F11) · 생성 경로도 같은 규칙. 기존 문서 origin 은 plain 유지 (F12).
- 상태 변형: `STATE_VARIANT_BASE_TYPES.Radio = ["selected", "disabled", ...INTERACTION]` — seed · 해소는 230 경로 그대로. Skia 유효 selected = F15 투영 뒤 (230 m3 지점).
- **독립 Radio Preview 호스트 (리뷰 h1)**: `CanonicalNodeRenderer` 의 고아 호스트 자리에 Radio 전용 분기 — RadioGroup 조상 (`collectionAncestor === "radiogroup"`, ref 자식이 실체화된 뒤 포함) 이 없으면 RAC `RadioGroup` (`display: contents` · `aria-label`) 으로 감싼다. 호스트 `value` = 유효 selected (자기 `isSelected` 또는 selected 변형 — F19 의 `next.isSelected`) 면 그 Radio `value`, 아니면 `null` · `isDisabled` 는 Radio 에 그대로 · 호스트는 render-only (canonical · binding 무변경). 조상 추적 집합 (`COLLECTION_HOST_TYPES`) 에 `radiogroup` 을 넣어 그룹 안 Radio 는 호스트 0. Skia 는 조상이 없으면 자기 상태 (F15) — 두 leg 같은 입력.
- 호스트 적용 자리 (리뷰 round 2 구현 메모): 현행 고아 호스트 호출은 rendererMap fallback 에만 있다 (`CanonicalNodeRenderer.tsx:689`). `ORPHAN_ITEM_HOST` 에 Radio 를 등록하는 것만으로는 닫히지 않는다 — catalog primitive 반환 경로에도 같은 wrapper 를 적용한다. 아래 production catalog 경로 unit 이 이를 직접 검증한다.
- unit: production catalog 경로 독립 default (`data-selected` 없음) · Selected 변형 (`data-selected`) · Disabled 변형 (`data-disabled`) · 그룹 안 ref Radio (DOM RadioGroup 1개 · 호스트 0) — 원복 RED.

### Phase 3 — 두 leg · 성능 (G2 · G3)

- Skia live (headed Playwright): Tab 항목 origin label fontWeight · root padding · selected fills → Tabs instance Tab rect + 픽셀 동시 Δ · `component-radio` 편집 → 새 RadioGroup instance 안 Radio rect/픽셀 · `Radio/Selected` fills → 선택된 Radio 만.
- Preview: renderer unit (renderTabs · renderRadioGroup 에 템플릿/ref 입력 → DOM style · 자식 수) — iframe 실측은 사용자 확인 대상 (메모리 `feedback-no-compare-mode-preview-checks-now`, 지시 해제 시 live 로 올린다).
- G3 (리뷰 l3 — `measurement-validity.md` §1 Q2·Q3): `perf-baseline.mjs` fixture 쌍 `tabs`/`tab-refs` (Tabs 100 × Tab 5 — plain arm 은 Tab 항목 origin 없음 · ref arm 은 233 모양) · `radiogroups`/`radiogroup-refs` (RadioGroup 100 × Radio 3 — plain Radio vs ref Radio). 같은 세션 headed, arm 교대.
  - 조작 3: 정적 편집 (instance 하나 props) · **불리 조작** 항목 origin 편집 (Tab 항목 padding · `component-radio` fills — 전 instance 무효화) · breakpoint 전환 (desktop ↔ mobile).
  - 조건: warm-up 3 · 측정 페이지 1개만 보이게 (ADR-227 함정 — 두 페이지가 보이면 전환 프레임이 두 번 그린다) · DPR 고정 · visibilityState visible 기록.
  - 지표: `PERF_LABEL.SCENE_BUILD` 직접 계측 (메모리 `feedback-perf-gate-metric-must-match-contract-not-harness-total`), 조작별 7회 p95 median · 대조는 plain arm.
  - plain arm 기록 (리뷰 round 2 메모): origin 이 없는 plain arm 에서 각 불리 조작에 대응하는 조작과 표본 발생 조건 (무효화가 실제 일어났는지) 을 같이 기록한다. 무효화가 없는 표본을 같은 작업의 성능으로 비교하지 않는다.

### Phase 4 — BC · 문서 (G4)

- unit `adr233BackwardCompat.test.ts`: 230 모양 문서 + 사용자 저작 → hydration → (i) 불변: 사용자 저작 노드 · 기존 origin 자식/순서/props · 사용자가 둔 `component-tabs.slot` (있으면 보존 — 별도 fixture) · 기존 `component-radiogroup` plain 자식 (ii) 허용 보충: `component-tabs` 의 변경 필드 = `slot` 하나 (부재 fixture) (iii) 추가 노드 16 · Δbyte = G0 실측값 정확 · 재hydration Δnode/Δfield/Δbyte 0.
- live `adr233-bc-live.mjs`: IndexedDB 저장 층에서 230 모양 문서 재작성 → reload → 보충 Δ · 재reload Δ0 (230 함정: Playwright context 마다 새 IndexedDB).
- README · CHANGELOG · `### Live Exercise`.

## 4. 파일 경계

| 영역    | 파일                                                                                                                                                                                         |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| seed    | `components/tabs/tabsTemplateOrigins.ts` (신규) · `components/ensureTemplateOrigins.ts` · `components/catalogOrigins.ts` · `components/stateVariantOrigins.ts`                               |
| catalog | `packages/shared/src/catalog/componentCatalog.ts` (Radio reusable 등록 한 줄 + placeable) — binding 파일 무변경 (D2)                                                                         |
| Skia    | `workspace/canvas/scene/canvasSceneNode.ts` (Tab 행) · 측정 층 (Phase 0 확정)                                                                                                                |
| Preview | `preview/App.tsx` (`templateSlotCompositions.tab`) · `packages/shared/src/renderers/LayoutRenderers.tsx` (`renderTabs`) · `preview/components/CanonicalNodeRenderer.tsx` (독립 Radio 호스트) |
| 패널    | `components/slotHostPolicy.ts`                                                                                                                                                               |
| 하니스  | `apps/builder/scripts/adr233-*.mjs` · `perf-baseline.mjs` fixture 4                                                                                                                          |

## 5. 중단 기준

- Phase 0 ② (Radio ref 자식 실체화) 가 두 leg 중 하나에서 RED 이고 해소기 수리가 base 해소기 (`resolveCanonicalRefTree` / Preview mode A) 의 계약 변경을 요구하면 Phase 2 보류 — Tab 쪽만 진행하고 사용자에게 보고.
- catalog binding 파일 (`bindings/*.binding.ts`) 수정이 필요해지면 중단 (D2 경계).
- G3 가 +1 ms 를 넘고 캐시 가설 (228 잔여 (a)) 로 못 닫으면 해당 축 보류.

## 6. 실행 기록

### Phase 0 — inventory (2026-09-23, 사용자 `/execute-adr 233` "완료까지 모든 phase")

- F1~F20 재확인 (main `3f50bcf6c`): F2 · F3 · F4 · F5 · F6 · F10 · F13 · F14 · F17 · F18 · F19 · F20 경로:라인 그대로. F10 의 reusable 목록 = `PALETTE_REUSABLE_ORIGIN_TYPES` (`componentCatalog.ts:1228`) — `adr228Inventory` 가 이 목록 ↔ `PALETTE_ORDER` 일치를 강제하므로 팔레트 밖 Radio 는 **별도 상수** 로 등록 (R4 판정).
- 미확정 3건 확정:
  1. **Tab 항목 추가 경로 없음** — Properties 에 Tabs `items` 편집기 · TabPanel 쌍 생성 경로가 없다 (`panels/properties` grep: Tabs 는 aria-label 판정 · editorTypes 타입뿐). Slot 절 "+" 는 `SlotInsertAction` `none` (버튼 숨김) — 탭 추가 UI 는 후속 후보.
  2. **Tab 측정 층** — Tab leaf 폭은 inline style 을 읽는다 (`utils.ts` inline UI 분기: fontSize = `resolveTextRenderStyle(style)` · padding = `parseBoxModel` 인라인 우선). 높이는 Tag 선례처럼 template 이 있으면 `height: auto`. Tabs 컨테이너 높이 추정 (`utils.ts` `type === "tabs"` 분기, rule `Tabs.sizes[size].height` 29 고정) 은 Phase 3 live 로 판정.
  3. **Radio ref 실체화** — 진단 ② GREEN: Preview `resolveCanonicalDocument` · Skia `buildCanonicalSceneModel` 둘 다 RadioGroup 의 ref 자식을 type `Radio` 로 실체화 (plain · instance). 해소기 수리 불필요 (R2 해소) — `adr233RadioRefChildren.test.ts`.
- 진단 RED: ① `canvasSceneNode.tabTemplate.test.ts` 4 RED (Tab 행 `templateOriginId: null` · style 미주입) ③ `CanonicalNodeRenderer.standaloneRadio.test.tsx` 5 RED (`TypeError: Cannot read properties of null (reading 'isDisabled')`, production catalog 경로).
- Δbyte: 추가 노드는 Phase 1·2 seed 뒤 실제 직렬화로 잰다 → Phase 4 BC 기준값 (§Phase 4).
- 기존 실패 (233 무관): `adr113DescendantsGrepGate` — HEAD `3f50bcf6c` 의 `catalogOrigins.ts` Modal 수집 · `migrateDialogTriggerInstances.ts` descendants 접근 4건.

### Phase 1 — Tab 항목 템플릿 origin (2026-09-23)

- seed: `components/tabs/tabsTemplateOrigins.ts` (Tab/Default · Tab/Selected + label Text · `component-tabs.slot` 부재 시만 보충) · `TEMPLATE_ORIGIN_REUSABLE_TYPES` += Tabs · ensurer 등록.
- Skia: `resolveItemTemplateSlotOriginIds` (Tag · Tab 공용 slot 해석) · `resolveTabTemplateOriginIds` (owner = scene 부모 Tabs sourceNode 또는 instance master) · `appendTabRowProjection` 에 style (layout 키 제외 + label typography, template 있으면 `height: auto`) · fills · `templateOriginId`.
- Preview: `App.tsx` `templateSlotCompositions.tab` → renderContext `tabTemplate` → `renderTabs` 가 RAC Tab `style({isSelected})` 로 base + selected overlay.
- 패널: `slotHostPolicy` Tabs host (후보 = Tab 항목 origin) · 삽입 `none`.
- unit: tabTemplate 5 · tabsTemplateOrigins 4 · tabsItemTemplate (shared) 2 · slotHostPolicy +1 GREEN. `catalogOrigins.test` ratchet 갱신 (generic 49→48 · complex 38→37 · G4 root 48→47 / desc 136→132).

### Phase 2 — Radio origin + 상태 변형 + 독립 Radio Preview 호스트 (2026-09-23)

- 등록: `NESTED_REUSABLE_ORIGIN_TYPES = ["Radio"]` (`componentCatalog.ts`) — `PALETTE_REUSABLE_ORIGIN_TYPES` 와 같은 파생 · generic seed 목록 끝 (`getCatalogOriginTypes`). **정정 (R4 판정)**: 설계 문구 "`placeable:false` (Modal 선례)" 대신 다른 reusable 과 같은 모양 (reusable 이 placeable · 동명 primitive 는 false). `placeable` 은 팔레트 노출이 아니라 삽입 가능 여부 (AI 도구 · `create_element`) 를 가르고 팔레트 노출 정본은 `PALETTE_ORDER` (Radio 없음 — 노출 0 유지). Modal 모양 (둘 다 false) 은 R② · R④ 는 맞지만 AI "라디오" → Radio 생성 경로 (`dynamicInjection.ts` KO_ALIASES) 를 끊는다. 이 모양에서 AI 가 만든 Radio 는 `component-radio` instance (reusable 우선). R④ (placeable reusable ⇒ 팔레트) 에 팔레트 밖 reusable 예외 명시.
- seed: `component-radio` = `buildCatalogOrigin("Radio")` (Radio > Label) · 새 `component-radiogroup` 의 Radio 자식 → ref (변환 보류 0) · 기존 RadioGroup origin plain 자식 불변 · `STATE_VARIANT_BASE_TYPES.Radio` 5.
- Preview 호스트 (R7): `CanonicalNodeRenderer` catalog primitive 반환 경로에 `hostOrphanRadio` — 조상 추적 (`COLLECTION_HOST_TYPES`) 에 `radiogroup` · 호스트 `value` = 유효 selected 면 그 Radio value 아니면 null · `display: contents`. rendererMap 경로는 `renderRadio` 가 이미 자체 RadioGroup 으로 감싸므로 붙이지 않는다 (이중 그룹 방지). 같은 자리에서 변형 origin 자신의 상태 (`metadata.variant` → isSelected · isDisabled) 를 `toRacProps` 입력에도 싣는다 — 종전엔 rendererMap 경로에만 닿아 catalog 경로의 Disabled 변형이 `data-disabled` 를 못 냈다 (ADR-230 계약 누락).
- unit: standaloneRadio 6 (Phase 0 RED 5 → GREEN) · adr233RadioOrigin 5 · ratchet 갱신 (catalogOrigins generic 48→49 · complex 37→38 · G4 root 47→48 / desc 132→133 · adr230 BC 변형 23→28 / Δnode 33→43 · entryUniverse complex 잔여 6→5 · compositeCreation COMPLEX∩reusable 41→42).
- 기존 실패 (233 무관, HEAD `3f50bcf6c` Modal 은퇴 · DialogTrigger): shared `componentCatalog` placeable 단일성 (Modal placeable 0) · AI `componentCatalog` (Modal 정본) · `factoryInlineDirtyBaseline` (Dialog) · shared `generatedCssLoadInventory` (생성 CSS 96) · builder `adr113DescendantsGrepGate` · `historyActions.static` (ADR-177 page-position).
