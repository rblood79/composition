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
 * 것이며, contract(`renderFacetDeclarationContract.test.ts`)가 (a) 파생 set == 현 28종
 * byte-identical (b) 28종 위임 사유 1:1 보존을 matrix 로 검증한다.
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
 * delegating render 위임 declaration (28종 = internal 18 + rac 10).
 *
 * 순서는 기존 `CanonicalNodeRenderer.tsx` set 정의 순서를 그대로 보존한다 (Set 은
 * insertion order 를 유지하므로, 파생 set 이 byte-identical 하려면 순서 동일 필요).
 */
export const RENDER_FACET_DELEGATIONS: readonly RenderFacetDelegation[] = [
  // ── delegating-internal (18) — binding.source.kind==="internal" self-compose ──
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

  // ── delegating-rac (10) — binding.source.kind==="rac" self-compose ──
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
