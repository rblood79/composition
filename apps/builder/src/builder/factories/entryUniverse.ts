/**
 * ADR-914 Phase 1 — Component Entry Universe (additive spine, no deletion)
 *
 * 한 component entry 가 보유하는 runtime 권한 facet (render / defaults / creation /
 * propagation / childRuntime) 을 **existing 손등록 registry 를 읽어 mirror** 하는
 * read-only bridge. Phase 1 은 새 authority spine 을 먼저 세우는 단계로, 어떤
 * registry 도 삭제하지 않는다 (§7 Rollback: additive → revert 없이 비활성화 가능).
 *
 * 본 resolver 의 유일한 소비처는 `entryUniverseContract.test.ts` 다. dormant
 * foundation 금지 (breakdown §1 Out of scope) 원칙에 따라, contract 가 실제로
 * 읽는 facet 만 노출한다. deletion phase (2~6) 에서 각 facet 이 registry 의
 * source 권한을 점진 이전받는다.
 *
 * **Phase 7 (contract swap, 2026-06-21)**: entryUniverseContract 를 primary gate 로
 * 승격한다. 이를 위해 render facet 에 `hasTagSpecEntry` / `hasCatalogCutover` 두
 * substrate 를 추가했다 — ADR-139 invariant B (`placeable ⟹ rendererMap` /
 * `placeable ⟹ TAG_SPEC_MAP OR catalog`) 를 entry contract 가 흡수하려면 render facet 이
 * rendererMap boolean 외에 TAG_SPEC_MAP / catalog 멤버십도 노출해야 하기 때문 (Phase 1~6
 * 은 rendererMap boolean 만 노출 → 10 placeable TAG_SPEC_MAP intended-absent 를 표현할
 * substrate 가 0 이던 gap). contract 가 즉시 소비(invariant B forward leg + exception 흡수
 * matrix)하므로 dormant 아님. ADR-139 `componentRegistrationContract` 는 invariant A
 * (spec 파일 universe ⟹ TAG_SPEC_MAP) + baseline ratchet 을 계속 담당 (병행 유지).
 *
 * Hard Constraint #2: `packages/shared` 는 builder 함수를 import 하지 않는다.
 * 본 resolver 는 builder-local 이므로 shared (`rendererMap` / `getCatalogCutoverTypes`) 와
 * specs (`TAG_SPEC_MAP`) 를 import 해도 방향이 정상이다 (builder → shared/specs).
 *
 * 인용 inventory: docs/adr/design/914-entry-universe-inventory.md (2026-06-20 freeze).
 */

import { rendererMap } from "@composition/shared/renderers";
import { getCatalogCutoverTypes } from "@composition/shared";
import { TAG_SPEC_MAP } from "@composition/specs";

import { ComponentFactory } from "@/builder/factories/ComponentFactory";
import { COMPLEX_COMPONENT_TAGS } from "@/builder/factories/constants";
import { isReusableCompositeType } from "@/builder/components/reusableCompositeOrigins";
import { getRegisteredPropagationTags } from "@/builder/utils/propagationRegistry";
import {
  POPOVER_CHILDREN_TAGS,
  FIELD_VISIBLE_CHILD_TAGS,
} from "@/builder/workspace/canvas/layout/engines/implicitStyles";
import { SYNTHETIC_CHILD_PROP_MERGE_TAGS } from "@/builder/workspace/canvas/skia/buildSpecNodeData";
import { INTERNAL_RENDERERS } from "@/preview/components/canonicalRendererRegistry";
import { deriveDelegatingLowerLookup } from "@/preview/components/renderFacetDeclaration";
import {
  ENTRY_DERIVED_DEFAULT_TYPES,
  deriveDefaultPropsFromCatalog,
} from "@/types/builder/defaultPropsDerivation";
import {
  DEFAULT_PROPS_MAP,
  type ComponentElementProps,
} from "@/types/builder/unified.types";

/**
 * render facet — Preview/Skia 가 component 를 어떻게 DOM 으로 렌더하는지.
 *
 * - `delegating-rac`: `binding.source.kind==="rac"` self-compose → rendererMap 위임 + 자식 재귀 skip
 * - `delegating-internal`: `binding.source.kind==="internal"` self-compose → rendererMap 위임 + 자식 재귀 skip
 * - `internal`: `INTERNAL_RENDERERS` (React.ElementType) 직접 렌더, generic 자식 재귀 가능
 * - `generic`: rendererMap fallback (또는 generic resolveHtmlTag) — 본 set 에 미등록
 */
export type RenderFacetMode =
  "delegating-rac" | "delegating-internal" | "internal" | "generic";

/**
 * creation facet — palette add 시 factory 가 child tree 를 어떻게 만드는지.
 *
 * ADR-914 Phase 4 (2026-06-21): binary `none|complex` → 3-mode 확장.
 * - `none`: factory child tree 가 필요 없는 leaf. creator 함수 불필요 (palette-add 는
 *   useElementCreator else 분기로 `getDefaultProps(type)` 단일 element 생성). Avatar 가
 *   Phase 4-B 에서 creator 제거 후 이 mode 의 proof.
 * - `reusableOrigin`: Components page reusable origin (catalog `kind:"reusable"` entry —
 *   ADR-148 Phase 1 로 구 `REUSABLE_COMPOSITE_ORIGINS` 맵 대체) 으로
 *   대체된 composite (Toolbar/Form). palette-add 는 type:"ref" instance 생성.
 * - `complex`: `COMPLEX_COMPONENT_TAGS` 멤버 — factory creator 가 child tree 를 만든다
 *   (declaredChildren + delegate 포함). 사용자 결정: delegate(Table custom) 식별용 새
 *   손등록 set 은 collapse 목적(surface 감소)에 역행하므로 미도입, complex 에 포괄.
 */
export type CreationFacetMode = "none" | "reusableOrigin" | "complex";

/**
 * defaults facet 의 권한 source.
 * - `entry-derived`: catalog binding default 파생 (`deriveDefaultPropsFromCatalog`). ADR-914 가
 *   row 삭제 후 이 경로가 단일 source.
 * - `map`: 아직 `DEFAULT_PROPS_MAP` literal row 가 권한 (전환 미완 type).
 */
export type DefaultsFacetSource = "entry-derived" | "map";

/** entry 가 mirror 한 runtime facet (Phase 1 read-only). */
export interface ComponentEntryRuntime {
  type: string;
  /** placeable (ComponentFactory.creators 에 creator 존재) 여부. */
  placeable: boolean;
  render: {
    mode: RenderFacetMode;
    /** rendererMap 에 자체 renderer entry 가 있는가. */
    hasRendererEntry: boolean;
    /**
     * ADR-914 Phase 7: TAG_SPEC_MAP (`@composition/specs`) 에 자체 Skia spec entry 가 있는가
     * (대소문자 무시 — `frame` canonical ↔ `Frame` spec). false = Skia spec 부재.
     */
    hasTagSpecEntry: boolean;
    /**
     * ADR-914 Phase 7: catalog cutover (`getCatalogCutoverTypes`) 경유로 렌더되는가.
     * true 면 TAG_SPEC_MAP 부재여도 buildCatalogShapes generic 으로 Skia 렌더 — invariant B
     * (`placeable ⟹ TAG_SPEC_MAP OR catalog`) 의 catalog leg. 대소문자 무시.
     */
    hasCatalogCutover: boolean;
  };
  defaults: {
    /**
     * 이 entry 가 default props 를 resolve 할 수 있는가.
     * = `DEFAULT_PROPS_MAP` literal row 존재 OR `CATALOG_DERIVED_DEFAULT_TYPES` 멤버.
     * ADR-914 Phase 2: row 삭제 후에도 derived 경로로 resolve 가능하면 true 유지
     * (ownership transfer — registry → entry).
     */
    hasDefaultPropsRow: boolean;
    /** 어느 권한이 resolve() 를 답하는가. */
    source: DefaultsFacetSource;
    /** 실제 default props. derived family → 파생, 그 외 → DEFAULT_PROPS_MAP[type](). */
    resolve: () => ComponentElementProps;
  };
  creation: {
    mode: CreationFacetMode;
  };
  propagation: {
    /** registerPropagationSpec 으로 등록된 parent tag 인가 (no-op rules:[] 포함). */
    registered: boolean;
  };
  childRuntime: {
    /** Skia `_hasChildren` 주입 차단 (자식 props 참조 self-compose). */
    syntheticPropMerge: boolean;
    /** 엔진 레이아웃 제외 (popover-hosted). */
    popoverHosted: boolean;
    /**
     * Field 컨테이너의 **비-Label 가시 child.type 화이트리스트** (포함형 filter membership).
     * null = field visible-filter 대상 아님. Label 은 hasLabel live gate 라 맵 밖 (facet 미보유).
     * ADR-914 Phase 6 후속: FIELD_VISIBLE_CHILD_TAGS SSOT mirror.
     */
    fieldVisibleChildTags: readonly string[] | null;
  };
}

// ── lowercase 정규화 lookup (render set 은 type 표기가 혼재) ──
const lower = (s: string): string => s.toLowerCase();

// ADR-914 Phase 3-A: delegating render facet 의 SSOT 는 renderFacetDeclaration 이다 (방향
//   역전). 기존엔 CanonicalNodeRenderer 의 DELEGATING_* set 을 import 해 lowercase 정규화했지만,
//   이제 declaration 에서 직접 파생한다 (set 과 entry facet 이 동일 declaration source 공유 —
//   값 congruent, circular import 없음). internal renderer(React.ElementType 매핑)는 declaration
//   scope 밖이라 CanonicalNodeRenderer export 를 그대로 읽는다.
const { internal: delegatingInternalLower, rac: delegatingRacLower } =
  deriveDelegatingLowerLookup();
const internalRendererLower = new Set(
  Object.keys(INTERNAL_RENDERERS).map(lower),
);

/** render facet mode 를 existing render set 우선순위로 판정. */
function resolveRenderMode(type: string): RenderFacetMode {
  const l = lower(type);
  // delegating (rac/internal) 이 generic 위임보다 우선 — 자식 재귀 skip 의미를 보존.
  if (delegatingRacLower.has(l)) return "delegating-rac";
  if (delegatingInternalLower.has(l)) return "delegating-internal";
  if (internalRendererLower.has(l)) return "internal";
  return "generic";
}

const propagationTagsLower = getRegisteredPropagationTags(); // 이미 lowercase

// ADR-914 Phase 7 (contract swap — invariant B substrate, 2026-06-21): entry universe 가
//   ADR-139 invariant B (`placeable ⟹ rendererMap` / `placeable ⟹ TAG_SPEC_MAP OR catalog`)
//   를 흡수하려면, render facet 이 rendererMap 뿐 아니라 TAG_SPEC_MAP / catalog cutover
//   멤버십도 노출해야 한다 (Phase 1~6 은 rendererMap boolean 만 노출 → TAG_SPEC_MAP
//   intended-absent 표현 substrate 가 0 이던 gap). 두 lookup 은 ADR-139 contract 와 동일
//   source (`@composition/specs` TAG_SPEC_MAP + `@composition/shared` getCatalogCutoverTypes).
const tagSpecKeysLower = new Set(Object.keys(TAG_SPEC_MAP).map(lower));
const catalogCutoverLower = new Set([...getCatalogCutoverTypes()].map(lower));

// ADR-914 Phase 6 (childRuntime facet membership SSOT, 2026-06-21): childRuntime facet 의
//   membership 권한 source. `syntheticPropMerge` ⟸ SYNTHETIC_CHILD_PROP_MERGE_TAGS
//   (buildSpecNodeData.ts), `popoverHosted` ⟸ POPOVER_CHILDREN_TAGS (implicitStyles.ts).
//   본 resolver 는 두 set 을 *읽어* facet 으로 노출하고, 실 소비처(buildSpecNodeData 2 +
//   StoreRenderBridge 3 / implicitStyles 1)가 **동일 set 을 직접 소비**한다. entryUniverseContract
//   가 `syntheticPropMerge ⟺ SYNTHETIC.has` / `popoverHosted ⟺ POPOVER.has` 양방향 parity 로
//   facet 이 이 membership 을 소유함을 증명한다 (Phase 4-C COMPLEX 와 동형 — 별도 declaration
//   파일 없이 단일 source 공유, surface 증가 0).
//
// ADR-914 Phase 6 후속 slice (field visible filter, 2026-06-21): `fieldVisibleChildTags` ⟸
//   FIELD_VISIBLE_CHILD_TAGS (implicitStyles.ts). field 4 filter 분기가 inline `c.type` 비교를
//   버리고 동일 맵을 직접 소비하도록 코드 이동(값/동작 byte-identical) → POPOVER 선례 동형
//   비-dormant. facet 은 컨테이너 type → 가시 child.type 정렬 배열 노출, contract 가 양방향
//   per-container parity 로 소유 증명. Label gate / sideMode 합성은 맵 밖 adapter 잔존.
const syntheticMergeSet = SYNTHETIC_CHILD_PROP_MERGE_TAGS;
const popoverHostedSet = POPOVER_CHILDREN_TAGS;

// ADR-914 Phase 6 후속 slice (field/collection visible filter, 2026-06-21): field 4 분기의
//   비-Label 가시성 membership SSOT (FIELD_VISIBLE_CHILD_TAGS, implicitStyles.ts). entry facet 이
//   읽어 노출하고, 실 소비처(implicitStyles 4 filter 분기)가 **동일 맵을 직접 소비**한다 → POPOVER
//   선례와 동형 (dormant 아님). key 는 lowercase containerTag (combobox/select/.../timefield).
//   facet 은 컨테이너 type → 가시 child.type 정렬 배열을 노출, contract 가 양방향 parity 로 증명.
const fieldVisibleChildLower: Map<string, readonly string[]> = new Map(
  Object.entries(FIELD_VISIBLE_CHILD_TAGS).map(([tag, set]) => [
    lower(tag),
    [...set].sort(),
  ]),
);
const rendererKeys = new Set(Object.keys(rendererMap));

/**
 * defaults facet resolve — derived family 는 catalog 파생, 그 외는 DEFAULT_PROPS_MAP.
 *
 * `getDefaultProps` (unified.types.ts) 와 **동일 분기 술어** (`CATALOG_DERIVED_DEFAULT_TYPES`)
 * 를 공유하므로, 한쪽이 다른 쪽을 import 하지 않아도 출력이 congruent 하다 (circular import
 * 회피, plan Option A). row 삭제 후 derived family 는 이 경로가 단일 source.
 */
function resolveDefaultsFacet(type: string): {
  hasDefaultPropsRow: boolean;
  source: DefaultsFacetSource;
  resolve: () => ComponentElementProps;
} {
  // entry-derived 전환 완료 type (Icon 제외) 은 파생이 단일 source — getDefaultProps 와 동일 술어.
  const isEntryDerived = ENTRY_DERIVED_DEFAULT_TYPES.has(type);
  const hasLiteralRow = Object.prototype.hasOwnProperty.call(
    DEFAULT_PROPS_MAP,
    type,
  );
  return {
    // row 삭제 후에도 entry-derived 면 resolve 가능 → true 유지 (ownership transfer).
    hasDefaultPropsRow: hasLiteralRow || isEntryDerived,
    source: isEntryDerived ? "entry-derived" : "map",
    resolve: () =>
      isEntryDerived
        ? deriveDefaultPropsFromCatalog(type)
        : (DEFAULT_PROPS_MAP[type]?.() ?? {}),
  };
}

/**
 * creation facet mode 를 existing source 우선순위로 판정 (ADR-914 Phase 4).
 *
 * 우선순위: reusableOrigin > complex > none.
 * - reusableOrigin 이 complex 보다 우선 — Toolbar/Form 은 COMPLEX 에 없지만(creators 미등록,
 *   ref instance 경로) 의미상 composite. 단 현 두 set 은 disjoint 라 순서 무관.
 * - none = creator 부재 leaf (palette-add 는 useElementCreator else 분기).
 *
 * **Phase 4-C (membership SSOT, 2026-06-21) / ADR-148 Phase 1 (2026-07-17)**: `complex`
 * mode 의 membership SSOT 는 `COMPLEX_COMPONENT_TAGS` (constants.ts), `reusableOrigin` 은
 * **catalog `kind:"reusable"` entry** (`REUSABLE_BY_TYPE` — `isReusableCompositeType` 이
 * `getReusableEntry` 로 파생) 다. 본 resolver 는 두 set 을 *읽어* facet mode 로 노출하고,
 * `useElementCreator:192` 의 palette-add gate 가 **동일 두 set 을 같은 우선순위로 소비**한다
 * (entryUniverse:183 ↔ useElementCreator:192 가 같은 SSOT 를 congruent 소비 — 별도
 * declaration 파일 없이 단일 source 공유). `entryUniverseContract` 가 `creation.mode==="complex"
 * ⟺ COMPLEX_COMPONENT_TAGS.has` / `==="reusableOrigin" ⟺ isReusableCompositeType` 양방향
 * parity 로 facet 이 이 membership 을 소유함을 증명한다.
 */
function resolveCreationMode(type: string): CreationFacetMode {
  if (isReusableCompositeType(type)) return "reusableOrigin";
  if (COMPLEX_COMPONENT_TAGS.has(type)) return "complex";
  return "none";
}

/**
 * component type 의 entry runtime facet 을 existing registry 에서 mirror.
 *
 * Phase 1 은 read-only — 어떤 registry 도 mutate 하지 않는다. 이후 deletion phase 가
 * 각 facet 의 source 권한을 registry → entry 로 이전한다.
 */
export function resolveComponentEntryRuntime(
  type: string,
): ComponentEntryRuntime {
  const placeable = ComponentFactory.getRegisteredTypes().includes(type);
  return {
    type,
    placeable,
    render: {
      mode: resolveRenderMode(type),
      hasRendererEntry: rendererKeys.has(type),
      hasTagSpecEntry: tagSpecKeysLower.has(lower(type)),
      hasCatalogCutover: catalogCutoverLower.has(lower(type)),
    },
    defaults: resolveDefaultsFacet(type),
    creation: {
      mode: resolveCreationMode(type),
    },
    propagation: {
      registered: propagationTagsLower.has(lower(type)),
    },
    childRuntime: {
      syntheticPropMerge: syntheticMergeSet.has(type),
      popoverHosted: popoverHostedSet.has(type),
      fieldVisibleChildTags: fieldVisibleChildLower.get(lower(type)) ?? null,
    },
  };
}

/**
 * entry universe 의 모든 placeable component type 을 enumerate.
 *
 * placeable = `ComponentFactory.getRegisteredTypes()` (ADR-139 contract 와 동일
 * 진입점). `entryUniverseContract` 가 placeable ⟹ entry row 1:1 정합을 검증한다.
 */
export function getEntryUniverseTypes(): string[] {
  return ComponentFactory.getRegisteredTypes();
}
