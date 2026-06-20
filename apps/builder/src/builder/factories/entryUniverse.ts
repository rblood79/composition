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
 * Hard Constraint #2: `packages/shared` 는 builder 함수를 import 하지 않는다.
 * 본 resolver 는 builder-local 이므로 shared (`rendererMap`) 를 import 해도 방향이
 * 정상이다 (builder → shared).
 *
 * 인용 inventory: docs/adr/design/914-entry-universe-inventory.md (2026-06-20 freeze).
 */

import { rendererMap } from "@composition/shared/renderers";

import { ComponentFactory } from "@/builder/factories/ComponentFactory";
import { COMPLEX_COMPONENT_TAGS } from "@/builder/factories/constants";
import { getRegisteredPropagationTags } from "@/builder/utils/propagationRegistry";
import { POPOVER_CHILDREN_TAGS } from "@/builder/workspace/canvas/layout/engines/implicitStyles";
import { SYNTHETIC_CHILD_PROP_MERGE_TAGS } from "@/builder/workspace/canvas/skia/buildSpecNodeData";
import { INTERNAL_RENDERERS } from "@/preview/components/CanonicalNodeRenderer";
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
  | "delegating-rac"
  | "delegating-internal"
  | "internal"
  | "generic";

/** creation facet — palette add 시 factory 가 child tree 를 어떻게 만드는지 (Phase 4 에서 세분). */
export type CreationFacetMode = "none" | "complex";

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
    /** Taffy 레이아웃 제외 (popover-hosted). */
    popoverHosted: boolean;
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
const syntheticMergeSet = SYNTHETIC_CHILD_PROP_MERGE_TAGS;
const popoverHostedSet = POPOVER_CHILDREN_TAGS;
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
    },
    defaults: resolveDefaultsFacet(type),
    creation: {
      mode: COMPLEX_COMPONENT_TAGS.has(type) ? "complex" : "none",
    },
    propagation: {
      registered: propagationTagsLower.has(lower(type)),
    },
    childRuntime: {
      syntheticPropMerge: syntheticMergeSet.has(type),
      popoverHosted: popoverHostedSet.has(type),
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
