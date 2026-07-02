/**
 * ADR-914 Phase 3-A — Render Facet Declaration (파생 역전, 삭제 0)
 *
 * `DELEGATING_INTERNAL_RENDERERS` / `DELEGATING_RAC_RENDERERS` 의 membership 을
 * **declarative source-of-truth** 로 모은 파일. Phase 1 은 `entryUniverse.ts` 가
 * 이 두 set 을 *읽어서* mirror 했지만(read-only spine), Phase 3-A 는 방향을 역전한다:
 *
 *   [Phase 1] CanonicalNodeRenderer (set 정의 SSOT) ──→ entryUniverse (mirror)
 *   [Phase 3-A] renderFacetDeclaration (SSOT) ──→ CanonicalNodeRenderer set (파생)
 *                                              └──→ entryUniverse render facet (파생)
 *
 * 두 소비처(`CanonicalNodeRenderer.tsx` 의 hot-path 분기 / `entryUniverse.ts` 의 render
 * facet mode 판정)가 **동일 declaration 을 source 로 공유**한다. 한쪽이 다른 쪽을 import
 * 하지 않으므로 circular import 가 없다 (defaultPropsDerivation 의 `ENTRY_DERIVED_DEFAULT_TYPES`
 * Option A 패턴과 동형 — entry-derived 술어를 중립 파일에 두어 두 소비처가 congruent).
 *
 * **Hard Constraint**: 본 파일은 어떤 builder/shared 모듈도 import 하지 않는 순수 데이터다.
 * 순수성이 깨지면 (entryUniverse → declaration → CanonicalNodeRenderer → entryUniverse)
 * 순환이 재발한다.
 *
 * **삭제 0 (Phase 3-A scope)**: 본 phase 는 set membership 값을 byte-identical 유지하며
 * SSOT 만 declaration 으로 이전한다. rendererMap dead/generic row 삭제는 dead 확증이 끝난
 * 별도 slice (breakdown §6: "generic 으로 보인다는 grep 만으로 삭제 금지").
 *
 * 각 항목의 위임 사유(reason)는 `CanonicalNodeRenderer.tsx` 의 기존 멤버 주석에서 1:1 이전한
 * 것이며, contract(`renderFacetDeclarationContract.test.ts`)가 (a) 파생 set == 현 위임 종수
 * byte-identical (b) 위임 사유 1:1 보존을 matrix 로 검증한다.
 *
 * 인용 inventory: docs/adr/design/914-entry-universe-inventory.md §2.3/§2.4 (2026-06-20 freeze).
 */

/**
 * delegating render facet 분류 축.
 * - `delegating-internal`: `binding.source.kind==="internal"` self-compose →
 *   `rendererMap[type]`(element, context) 위임 + generic 자식 재귀 skip.
 * - `delegating-rac`: `binding.source.kind==="rac"` self-compose → 동일 위임 + 재귀 skip.
 */
export type DelegatingRenderKind = "delegating-internal" | "delegating-rac";

/** 단일 위임 render entry 의 declarative 표현. */
export interface RenderFacetDelegation {
  /**
   * lookup key. `delegating-internal` 은 `binding.source.renderer`(lowercase internal
   * renderer id), `delegating-rac` 은 element `type`(PascalCase) 으로 매칭한다 —
   * 기존 `CanonicalNodeRenderer.tsx:467-471` 소비 규약 그대로.
   */
  key: string;
  kind: DelegatingRenderKind;
  /** 위임 등록 사유 — 기존 멤버 주석 1:1 이전 (무손실 audit 용). */
  reason: string;
}

/**
 * delegating render 위임 declaration (internal 29 + rac 12).
 *   2026-06-24: Card 패밀리 5(card/cardpreview/cardheader/cardcontent/cardfooter) 추가 — Preview
 *   canonical 경로에서 self-compose 자식 슬롯 보강 누락(Skia↔Preview 비대칭) 해소.
 *   2026-06-25: tableview 추가 — TableView 자식(Header/Body/Column/Row/Cell) 미렌더 해소(동일 비대칭).
 *   2026-06-27: buttongroup 추가 — ButtonGroup 자식 Button×2 미렌더 해소(동일 비대칭, tableview 동형).
 *   2026-06-27: avatargroup/cardview/pagination 추가 — grep 전수 감사로 ButtonGroup 동형 누락 3건 적발.
 *     factory 가 자식(Avatar×3 / Card×3 / Button×5)을 생성하고 render{Type} 가 childrenByParent 로
 *     렌더하는 self-compose 인데 binding renderer="div" + 미등록 → 자식 통째 미렌더(동일 비대칭).
 *   2026-06-27: toast 추가 — 21후보 정밀 감사로 ButtonGroup 동형 잔여 1건 적발(renderToast 가 자식
 *     Heading/Description self-compose). palette 미노출 imperative 알림이나 선제 등록(6종 동형 일관).
 *
 * 순서는 기존 `CanonicalNodeRenderer.tsx` set 정의 순서를 그대로 보존한다 (Set 은
 * insertion order 를 유지하므로, 파생 set 이 byte-identical 하려면 순서 동일 필요).
 */
export const RENDER_FACET_DELEGATIONS: readonly RenderFacetDelegation[] = [
  // ── delegating-internal (29) — binding.source.kind==="internal" self-compose ──
  {
    key: "tabs",
    kind: "delegating-internal",
    reason:
      "renderTabs 가 childrenByParent 로 TabPanels→TabPanel itemId 페어링 + items 로 RAC Tab/TabPanel 합성. generic 자식 재귀로는 빈 TabList 만 렌더.",
  },
  {
    key: "progressbar",
    kind: "delegating-internal",
    reason:
      "renderProgressBar 가 자식 Label children 추출 → 자기완결 RAC ProgressBar. 자식 Value/Track 은 DOM 미렌더(RAC 자체 bar).",
  },
  {
    key: "meter",
    kind: "delegating-internal",
    reason:
      "renderMeter (ProgressBar 동형) — 자식 Label children 추출 → 자기완결 RAC Meter.",
  },
  {
    key: "breadcrumbs",
    kind: "delegating-internal",
    reason:
      "renderBreadcrumbs 가 items 를 useResolvedCollectionItems 로 RAC Breadcrumb/Link 합성. generic 자식 재귀로는 빈 nav 만 렌더(자식 재귀 skip). Skia 는 appendBreadcrumbRowProjection.",
  },
  {
    key: "disclosure",
    kind: "delegating-internal",
    reason:
      "renderDisclosure 가 자식 DisclosureHeader/Heading children 을 title 로 추출 + 나머지를 contentChildren 으로 분리해 RAC Disclosure self-compose. generic 재귀로는 title 추출/콘텐츠 분리 깨짐.",
  },
  {
    key: "disclosuregroup",
    kind: "delegating-internal",
    reason:
      "renderDisclosureGroup 이 childrenByParent 로 자식 Disclosure 들을 받아 DisclosureGroup 안에 재귀 렌더. INTERNAL 미등록 + generic 위임은 childrenByParent 보강 없어 빈 컨테이너로 렌더됨 → DELEGATING 등록으로 flatten 보강.",
  },
  {
    key: "nav",
    kind: "delegating-internal",
    reason:
      "renderNav 가 childrenByParent 로 자식을 받아 <nav> 안에 재귀 렌더(fallback 없음). disclosuregroup 동형 — generic 위임은 childrenByParent 보강 없어 빈 nav.",
  },
  {
    key: "tableview",
    kind: "delegating-internal",
    reason:
      "renderTableView 가 childrenByParent 로 자식(TableHeader/TableBody/Column/Row/Cell)을 받아 role=grid div 안에 재귀 렌더. disclosuregroup/nav 동형 — generic 위임(binding.source.renderer 구 'div')은 childrenByParent 보강 없어 shell 만 렌더(Skia 는 자식 generic box → 비대칭). 자식 Column/Cell 은 TableView 조상일 때만 renderColumn/renderCell 이 div 렌더(Table 데이터 경로는 null 유지).",
  },
  {
    key: "disclosurecontent",
    kind: "delegating-internal",
    reason:
      "renderDisclosureContent 가 childrenByParent 로 자식 element 렌더. props.children 텍스트 fallback 있어 텍스트는 generic 으로도 표시되나, 자식 element 시 누락 → 안전망 DELEGATING.",
  },
  {
    key: "field",
    kind: "delegating-internal",
    reason:
      "renderDataField 가 self-compose(부모 element value lookup + childrenByParent 자식 렌더 + DataField label/value 합성). 단순 ElementType + generic 재귀로는 부모 데이터 추출/자식 렌더 깨짐.",
  },
  {
    key: "select",
    kind: "delegating-internal",
    reason:
      "renderSelect 가 childrenByParent 로 SelectTrigger→SelectValue 를 찾아 자기완결 RAC Select self-compose. 자식 sub-part 가 catalog cutover 라 generic 재귀 시 소문자 raw tag → unknown-tag 경고 + RAC controller 깨짐.",
  },
  {
    key: "combobox",
    kind: "delegating-internal",
    reason:
      "renderComboBox — select 동형. childrenByParent 로 self-compose, 자식 sub-part catalog cutover 라 generic 재귀 시 raw tag 누수.",
  },
  {
    key: "tree",
    kind: "delegating-internal",
    reason:
      "renderTree 가 자식 TreeItem 을 renderTreeItemsRecursively 로 RAC Tree/TreeItem self-compose 재귀(--tree-item-level 들여쓰기). 자식 TreeItem catalog cutover 라 generic 재귀 시 raw tag 누수.",
  },
  {
    key: "taggroup",
    kind: "delegating-internal",
    reason:
      "renderTagGroup 이 items SSOT 로 RAC TagGroup self-compose + onSelectionChange/onRemove inline 핸들러 연결. generic toRacProps 는 이벤트 핸들러 drop → Tag remove 버튼 미렌더(DOM↔Skia 비대칭).",
  },
  {
    key: "listbox",
    kind: "delegating-internal",
    reason:
      "renderListBox 가 items SSOT self-compose + onSelectionChange inline 핸들러 합성. generic toRacProps 는 onSelectionChange drop → selection 동작 store 미반영.",
  },
  {
    key: "gridlist",
    kind: "delegating-internal",
    reason:
      "renderGridList — listbox 동형. items SSOT self-compose + onSelectionChange inline 합성.",
  },
  {
    key: "menu",
    kind: "delegating-internal",
    reason:
      "renderMenu — listbox 동형. items SSOT self-compose + onSelectionChange inline 합성.",
  },
  {
    key: "colorpicker",
    kind: "delegating-internal",
    reason:
      "rendererMap 이 factory child tree 를 받아 기존 div shell(ColorPicker) 합성 유지.",
  },
  {
    key: "colorswatchpicker",
    kind: "delegating-internal",
    reason:
      "rendererMap 이 factory child tree 를 받아 RAC ColorSwatchPickerItem 합성 유지.",
  },
  // ── Card 패밀리 (2026-06-24) — renderCard/renderCard{Preview,Header,Content,Footer} 가
  //   childrenByParent 로 슬롯 자식을 self-compose. DELEGATING 미등록이라 canonical Preview 경로에서
  //   childrenByParent 보강(flattenNodeChildrenByParent)을 못 받아 renderCard 의 hasStructuralChildren
  //   =false → props(title/description) 경로로만 렌더, CardPreview/Image/CardFooter 누락 → Skia(자식
  //   직접 렌더)와 비대칭이었음. disclosuregroup/nav 동형. binding renderer 도 "div"→고유 id 로 변경됨.
  {
    key: "card",
    kind: "delegating-internal",
    reason:
      "renderCard 가 childrenByParent 로 CardPreview/CardHeader/CardContent/CardFooter 슬롯을 받아 hasStructuralChildren 분기로 self-compose. 미등록 시 childrenByParent 빈 배열 → props(title/description) 경로로만 렌더, 자식 슬롯(이미지 포함) 누락 → Skia 비대칭.",
  },
  {
    key: "cardpreview",
    kind: "delegating-internal",
    reason:
      "renderCardPreview 가 childrenByParent 로 자식(Image)을 렌더하는 self-compose. 미등록 시 Image 누락.",
  },
  {
    key: "cardheader",
    kind: "delegating-internal",
    reason:
      "renderCardHeader 가 childrenByParent 로 자식(Heading)을 렌더. 미등록 시 자식 element 누락.",
  },
  {
    key: "cardcontent",
    kind: "delegating-internal",
    reason:
      "renderCardContent 가 childrenByParent 로 자식(Description)을 렌더. 미등록 시 자식 element 누락.",
  },
  {
    key: "cardfooter",
    kind: "delegating-internal",
    reason:
      "renderCardFooter 가 childrenByParent 로 자식(action button 등)을 렌더. 미등록 시 자식 누락.",
  },
  // ── ButtonGroup (2026-06-27) — renderButtonGroup 이 childrenByParent 로 자식 Button×2(factory
  //   자동 생성: Cancel outline / Save accent)를 <div role="group"> 안에 self-compose. binding renderer
  //   가 "div"→"buttongroup" 로 변경됨. disclosuregroup/nav/tableview 동형. 미등록 시 generic
  //   fall-through(rendererMap.ButtonGroup)로 빠지나 childrenByParent 보강을 못 받아 자식 Button 미렌더
  //   (Preview 빈 div, Skia 는 자식 직접 렌더 → 비대칭).
  {
    key: "buttongroup",
    kind: "delegating-internal",
    reason:
      "renderButtonGroup 이 childrenByParent 로 자식 Button×2 를 <div role=group> 안에 렌더하는 self-compose 컨테이너. 미등록 시 generic fall-through 로 childrenByParent 보강 누락 → 자식 Button 통째 미렌더(Skia 비대칭). tableview/card/nav 동형.",
  },
  // ── ButtonGroup 동형 컨테이너 (2026-06-27 grep 감사) — factory 가 자식을 생성하고 render{Type} 가
  //   childrenByParent 로 그 자식을 children.map(renderElement) 렌더하는 self-compose. "type별로 골라
  //   합성"이 아니라 generic map 이어도 childrenByParent 가 비면 자식 0개(ButtonGroup 동형). binding
  //   renderer 가 "div"→고유 id 로 변경됨. 미등록 시 자식(Avatar×3 / Card×3 / Button×5) 통째 미렌더.
  {
    key: "avatargroup",
    kind: "delegating-internal",
    reason:
      "renderAvatarGroup 이 childrenByParent 로 자식 Avatar×3(factory 자동 생성)을 flex div 안에 렌더하는 self-compose 컨테이너. 미등록 시 generic fall-through 로 childrenByParent 보강 누락 → 자식 Avatar 미렌더(Skia 비대칭). buttongroup 동형.",
  },
  {
    key: "cardview",
    kind: "delegating-internal",
    reason:
      "renderCardView 가 childrenByParent 로 자식 Card×3(factory 자동 생성)을 flex grid 안에 렌더하는 self-compose 컨테이너. 미등록 시 generic fall-through 로 childrenByParent 보강 누락 → 자식 Card 미렌더(Skia 비대칭). buttongroup 동형.",
  },
  {
    key: "pagination",
    kind: "delegating-internal",
    reason:
      "renderPagination 이 childrenByParent 로 자식 Button×5(factory 자동 생성 ←/1/2/3/→)를 <nav> 안에 렌더하는 self-compose 컨테이너. 미등록 시 generic fall-through 로 childrenByParent 보강 누락 → 자식 Button 미렌더(Skia 비대칭). buttongroup 동형.",
  },
  {
    key: "toast",
    kind: "delegating-internal",
    reason:
      "renderToast 가 childrenByParent 로 자식 Heading/Description(factory 자동 생성)을 <div role=alert> 안에 렌더하는 self-compose 컨테이너. 미등록 시 generic fall-through 로 childrenByParent 보강 누락 → 자식 미렌더(Skia 비대칭). buttongroup/pagination 동형. (palette 미노출 imperative 알림이나 imperative/AI/import element 생성 대비 선제 등록.)",
  },
  // ── Calendar (2026-07-02, B2 Style 패널 동기화) — renderCalendar 가 자식 CalendarHeader
  //   element.props.style 의 layout 부분(gap/padding/justifyContent)을 `<header>` 로 전달하고
  //   Calendar 컴포넌트가 grid/nav 를 self-compose. 미등록 시 INTERNAL_RENDERERS[calendar]=Calendar
  //   직접 컴포넌트 경로라 renderCalendar 가 안 쓰여 headerStyle 미전달(Style 패널 Layout 편집이 DOM
  //   header 에 미반영, Skia inline_icon_text 만 반영 → CSS↔Skia 비대칭). DELEGATING 전환으로 renderCalendar
  //   경유 + generic 자식 재귀 skip(CalendarHeader/CalendarGrid 는 Calendar 가 self-compose).
  {
    key: "calendar",
    kind: "delegating-internal",
    reason:
      "renderCalendar 가 자식 CalendarHeader element.props.style 의 layout(gap/padding/justifyContent)을 `<header>` 로 전달 + Calendar 가 grid/nav self-compose. 미등록 시 INTERNAL_RENDERERS 직접 컴포넌트 경로라 renderCalendar 미사용 → headerStyle 미전달(Style 패널 Layout 편집 DOM 미반영, Skia 만 반영 → 비대칭). 자식 CalendarHeader/CalendarGrid 는 self-compose 라 재귀 skip.",
  },
  {
    key: "rangecalendar",
    kind: "delegating-internal",
    reason:
      "renderRangeCalendar — calendar 동형. 자식 CalendarHeader/CalendarGrid self-compose, headerStyle 전달 위해 DELEGATING 경유.",
  },

  // ── delegating-rac (12) — binding.source.kind==="rac" self-compose ──
  {
    key: "Slider",
    kind: "delegating-rac",
    reason:
      "renderSlider 가 Slider.tsx 로 Label/Output/Track/Thumb 자기완결 렌더. RAC[component] 직접 렌더 시 canonical 자식(SliderTrack/Output/Thumb)이 INTERNAL 미매핑 → 소문자 raw tag 누수 + RAC 의미 깨짐.",
  },
  {
    key: "NumberField",
    kind: "delegating-rac",
    reason:
      "renderNumberField 가 RAC NumberField controller 자기완결 렌더(Slider 동형). 자식 sub-part catalog cutover 라 generic 재귀 시 raw tag 누수.",
  },
  {
    key: "SearchField",
    kind: "delegating-rac",
    reason:
      "renderSearchField 가 RAC SearchField controller 자기완결 렌더(NumberField 동형).",
  },
  {
    key: "TextField",
    kind: "delegating-rac",
    reason:
      'renderTextField 가 composition TextField wrapper(data-label-position emit)로 self-compose. generic 경로(RAC TextField 직접)는 labelPosition(enum)을 data-* 로 미emit → generated CSS [data-label-position="side"] selector 영원히 미매칭 → Label 항상 top (ADR-913 후속).',
  },
  {
    key: "CheckboxGroup",
    kind: "delegating-rac",
    reason:
      'renderCheckboxGroup 이 <div className="checkbox-items"> wrapper + orientation prop 전달(→ data-orientation)을 자기완결 처리. generic 경로는 wrapper 미합성 + orientation(enum)을 data-* 로 미emit → horizontal 미동작.',
  },
  {
    key: "RadioGroup",
    kind: "delegating-rac",
    reason:
      "renderRadioGroup — CheckboxGroup 동형. .radio-items wrapper + orientation 자기완결 처리.",
  },
  {
    key: "ToggleButtonGroup",
    kind: "delegating-rac",
    reason:
      "renderToggleButtonGroup 이 controlled selectedKeys/onSelectionChange 를 자기완결 wiring(자식 isSelected → batchUpdateElementProps). generic rac 경로(RAC ToggleButtonGroup 직접)는 selectedKeys/onSelectionChange 를 미emit → uncontrolled + store 미반영 → 클릭해도 토글 미동작. CheckboxGroup/RadioGroup 동형(2026-06-22).",
  },
  {
    key: "ToggleButton",
    kind: "delegating-rac",
    reason:
      "renderToggleButton 이 group 안에서 id={element.id} 를 RAC ToggleButton 에 전달(RAC group selection key 매칭 필수) + 단독일 때 onPress 토글(updateElementProps) 자기완결. generic rac 경로는 id 미전달 → groupState.selectedKeys.has(props.id) 매칭 실패 + 단독 토글 wiring 부재. ToggleButtonGroup 과 한 쌍(2026-06-22).",
  },
  {
    key: "DateField",
    kind: "delegating-rac",
    reason:
      "renderDateField 가 composition DateField wrapper(self-compose + defaultValue)로 자기완결 렌더. RAC DateField 는 자식 <DateInput>{(segment)=>...} render function 이 필요해 generic 자식 재귀로 표현 불가 → segment 0개.",
  },
  {
    key: "TimeField",
    kind: "delegating-rac",
    reason:
      "renderTimeField — DateField 동형. render function 자식이 generic 재귀로 표현 불가.",
  },
  {
    key: "Switch",
    kind: "delegating-rac",
    reason:
      'renderSwitch 가 <div className="indicator">(track) + ::before(thumb) DOM 자식을 자기완결 합성. generic rac 경로(RAC Switch 직접)는 그 자식 div 미생성 → indicator 시각 완전 누락 (ADR-913 slice 3).',
  },
  {
    key: "Checkbox",
    kind: "delegating-rac",
    reason:
      'renderCheckbox 가 <div className="checkbox">(box) + svg(checkmark) DOM 자식을 자기완결 합성. generic rac 경로는 그 자식 div 미생성 → checkmark 미렌더. Radio 는 ::before pseudo-element ring 모델이라 DOM 자식 불요 → 제외(generic 정상).',
  },
];

/**
 * delegating-internal set 파생 — `binding.source.renderer`(lowercase) 로 매칭.
 *
 * `CanonicalNodeRenderer.tsx` 의 `DELEGATING_INTERNAL_RENDERERS` 가 이 헬퍼로 생성된다.
 * insertion order 보존(declaration 순서 == 기존 set 순서).
 */
export function deriveDelegatingInternalRenderers(): ReadonlySet<string> {
  return new Set(
    RENDER_FACET_DELEGATIONS.filter(
      (d) => d.kind === "delegating-internal",
    ).map((d) => d.key),
  );
}

/**
 * delegating-rac set 파생 — element `type`(PascalCase) 로 매칭.
 *
 * `CanonicalNodeRenderer.tsx` 의 `DELEGATING_RAC_RENDERERS` 가 이 헬퍼로 생성된다.
 */
export function deriveDelegatingRacRenderers(): ReadonlySet<string> {
  return new Set(
    RENDER_FACET_DELEGATIONS.filter((d) => d.kind === "delegating-rac").map(
      (d) => d.key,
    ),
  );
}

/**
 * entry render facet mode 판정용 lowercase lookup.
 *
 * `entryUniverse.ts` 의 `resolveRenderMode` 가 기존엔 set 을 lowercase 정규화해
 * 매칭했는데, declaration 을 source 로 쓰면 동일 결과를 declaration 에서 직접 파생한다.
 * key 가 이미 lowercase(internal) 또는 PascalCase(rac) 혼재라, 양쪽 다 lowercase 로
 * 정규화한 lookup 을 제공한다 (기존 entryUniverse 의 lower() 정규화와 동일 의미).
 */
export function deriveDelegatingLowerLookup(): {
  internal: ReadonlySet<string>;
  rac: ReadonlySet<string>;
} {
  const internal = new Set<string>();
  const rac = new Set<string>();
  for (const d of RENDER_FACET_DELEGATIONS) {
    if (d.kind === "delegating-internal") internal.add(d.key.toLowerCase());
    else rac.add(d.key.toLowerCase());
  }
  return { internal, rac };
}
