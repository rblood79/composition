/**
 * ADR-230 — 기본 요소의 상태별 origin 분해 (seed).
 *
 * 상태 prop 을 가진 leaf 의 catalog origin (`component-button` …) 마다 상태 변형 origin
 * (`<origin>--<state>`) 을 Components 페이지 body 에 **default 바로 오른쪽** 으로 시드한다.
 * 변형은 `metadata.variant` (상태) + `metadata.variantOf` (default origin id) 로 묶이고
 * (item template 의 host `slot` 배열은 collection 전용 — leaf 는 역참조만), 자식 subtree 는
 * default 와 동형 (id `<variant>__n`), style/fills 는 **비워서** 시드한다 — 부재 키 = catalog
 * 폴백이라 시각 Δ0 · 재hydration Δ0 (breakdown §2 Phase 0 확정). 변형 origin 자체에
 * `isSelected:true` 를 굽지 않는다 — 두 leg 해소기가 `variant` 를 유효 상태로 가정한다.
 *
 * 상태 열은 타입별 D2 계약 (`isSelected` 계약은 5 타입뿐 — Button/Link 는 disabled 만).
 */
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { catalogReusableOriginId } from "@composition/shared";
import { COMPONENTS_SYSTEM_BODY_ID } from "../pages/systemComponentsPage";
import { CATALOG_ORIGIN_METADATA_TYPE } from "./catalogOriginMarker";

/**
 * 선언적 상태 (Phase 1 — 두 leg 유효 상태로 해소) 와 interaction 상태 (Phase 2 — Preview DOM
 * 의 RAC data 속성으로만 해소, 캔버스는 변형 origin 자신을 catalog 상태 토큰으로 정적 표시 —
 * ADR-150 경계).
 */
export type StateVariantState =
  | "selected"
  | "disabled"
  | "hover"
  | "pressed"
  | "focus-visible"
  // ADR-234: 선택 가능한 가족의 휴지 상태 — origin = 선택 상태, 휴지 모양은 이 변형이 갖는다.
  | "unselected"
  // ADR-237 Phase 2: Disclosure 의 접힘 — origin = 펼친 상태 (가장 완성된 모양), 접힌 모양은 이 변형이 갖는다.
  //   props `isExpanded:false` + style patch 만 (구조 patch `enabled` 금지 — review round 1 h2).
  | "collapsed"
  // ADR-237 Phase 3: Breadcrumbs 의 현재 항목 — origin = 링크 모양, 현재 모양은 이 변형이 갖는다. 현재 판정은 RAC
  //   위치 규칙 (마지막 = current) 이 정본이고 변형은 그 상태의 모양만 정한다.
  | "current";

export const DECLARATIVE_STATE_VARIANTS: readonly StateVariantState[] = [
  "selected",
  "disabled",
];

export const INTERACTION_STATE_VARIANTS: readonly StateVariantState[] = [
  "hover",
  "pressed",
  "focus-visible",
];

/** seed · projection · CSS 방출이 같이 도는 상태 열 (선언적 먼저, interaction 뒤). */
export const ALL_STATE_VARIANTS: readonly StateVariantState[] = [
  ...DECLARATIVE_STATE_VARIANTS,
  ...INTERACTION_STATE_VARIANTS,
];

/** 기본 요소 집합 (Phase 0 inventory) — 팔레트 reusable 이면서 상태 prop 계약이 있는 leaf. */
export const STATE_VARIANT_BASE_TYPES: Readonly<
  Record<string, readonly StateVariantState[]>
> = {
  Button: ["disabled", ...INTERACTION_STATE_VARIANTS],
  ToggleButton: ["selected", "disabled", ...INTERACTION_STATE_VARIANTS],
  Link: ["disabled", ...INTERACTION_STATE_VARIANTS],
  Checkbox: ["selected", "disabled", ...INTERACTION_STATE_VARIANTS],
  Switch: ["selected", "disabled", ...INTERACTION_STATE_VARIANTS],
  // ADR-233 Phase 2: 팔레트 밖 reusable origin `component-radio` 가 생겨 230 보류가 풀렸다.
  Radio: ["selected", "disabled", ...INTERACTION_STATE_VARIANTS],
  // ADR-237 Phase 2 — 항목 템플릿 5종 (RAC render props isSelected · isHovered · isPressed · isFocusVisible ·
  //   isDisabled — breakdown R4). 선택 가능한 4종은 origin = 선택 상태 + `--unselected` (234 규칙 — GridListItem 은
  //   이 표로 처음 이관). MenuItem 은 선택 없이 상호작용 4.
  Tab: ["selected", "disabled", ...INTERACTION_STATE_VARIANTS],
  Tag: ["selected", "disabled", ...INTERACTION_STATE_VARIANTS],
  ListBoxItem: ["selected", "disabled", ...INTERACTION_STATE_VARIANTS],
  GridListItem: ["selected", "disabled", ...INTERACTION_STATE_VARIANTS],
  MenuItem: ["disabled", ...INTERACTION_STATE_VARIANTS],
  // ADR-237 Phase 2 — Disclosure (RAC render prop isExpanded — R5): origin = 펼침 + `--collapsed`.
  Disclosure: ["collapsed"],
  // ADR-237 Phase 3 — Breadcrumb 항목 (RAC render prop isCurrent — R3): origin = 링크 + `--current`.
  Breadcrumb: ["current"],
  // ADR-239 Phase 1 — TreeItem (RAC render props isSelected · isDisabled · 상호작용 · isExpanded): origin = 선택 상태 +
  //   `--unselected` · 상호작용 4 · `--collapsed` (237 접힘 층 — root 전용).
  TreeItem: ["selected", "disabled", ...INTERACTION_STATE_VARIANTS, "collapsed"],
};

/** 이관 대상 항목 템플릿 쌍 (default id = 새 origin id). GridListItem 은 selected 템플릿이 없어 대상 밖 — ADR-237
 *  Phase 2 부터 상태 변형 표 (`STATE_VARIANT_BASE_TYPES`) 의 선택 가능한 가족으로 이관된다. */
export const ITEM_TEMPLATE_VARIANT_PAIRS: ReadonlyArray<{
  defaultId: string;
  selectedId: string;
}> = [
  {
    defaultId: "component-tab-item-default",
    selectedId: "component-tab-item-selected",
  },
  {
    defaultId: "component-tag-item-default",
    selectedId: "component-tag-item-selected",
  },
  {
    defaultId: "component-listbox-item-default",
    selectedId: "component-listbox-item-selected",
  },
];

export function isInteractionStateVariant(state: StateVariantState): boolean {
  return INTERACTION_STATE_VARIANTS.includes(state);
}

const STATE_LABELS: Readonly<Record<StateVariantState, string>> = {
  unselected: "Unselected",
  collapsed: "Collapsed",
  current: "Current",
  selected: "Selected",
  disabled: "Disabled",
  hover: "Hover",
  pressed: "Pressed",
  "focus-visible": "Focus",
};

export function stateVariantOriginId(
  originId: string,
  state: StateVariantState,
): string {
  return `${originId}--${state}`;
}

export function isStateVariantState(
  value: unknown,
): value is StateVariantState {
  return (
    value === "unselected" ||
    value === "collapsed" ||
    value === "current" ||
    value === "selected" ||
    value === "disabled" ||
    value === "hover" ||
    value === "pressed" ||
    value === "focus-visible"
  );
}

export interface StateVariantSelf {
  state: StateVariantState;
  variantOf: string;
}

/** 이 노드가 상태 변형 origin 자신이면 `{state, variantOf}` — 아니면 null. */
export function readStateVariantSelf(
  node:
    { metadata?: unknown; type?: unknown; ref?: unknown } | null | undefined,
): StateVariantSelf | null {
  const metadata = node?.metadata as
    { variant?: unknown; variantOf?: unknown } | undefined;
  if (!metadata) return null;
  const { variant } = metadata;
  // ADR-234: 변형 = origin 의 ref — 소속은 `ref` 가 말한다 (`variantOf` 는 이관 전 복제본만).
  const variantOf =
    typeof metadata.variantOf === "string"
      ? metadata.variantOf
      : typeof node?.ref === "string"
        ? node.ref
        : undefined;
  if (!isStateVariantState(variant) || typeof variantOf !== "string") {
    return null;
  }
  return { state: variant, variantOf };
}

/** ADR-234: 선택 가능한 가족 origin 이 이관을 지났는가 (origin = 선택 상태 표식). */
export function isSelectedStateOrigin(
  node: { metadata?: unknown } | null | undefined,
): boolean {
  return (
    (node?.metadata as { variant?: unknown } | undefined)?.variant ===
    "selected"
  );
}

/**
 * ADR-234 — origin 의 ref 변형 (빈 patch). 자식은 origin 에서 상속 (복제 0) · 표시는
 * `metadata.variant` 강제 상태.
 */
export function buildStateVariantRef(
  origin: CanonicalNode,
  state: StateVariantState,
): CanonicalNode {
  const baseName =
    typeof origin.name === "string" && origin.name.length > 0
      ? origin.name
      : String(origin.type);
  return {
    id: stateVariantOriginId(origin.id, state),
    type: "ref",
    ref: origin.id,
    reusable: true,
    name: `${baseName}/${STATE_LABELS[state]}`,
    // ADR-237 Phase 2 — 접힘 변형은 그 상태의 prop 값 (`isExpanded:false`) 을 갖는다: 두 leg 의 유효 펼침
    //   판정 (Canvas `isDisclosureExpandedInContext` · Preview RAC `isExpanded`) 이 변형 노드 자신을 접힌 모양으로
    //   그린다. 구조 patch (`enabled`) 는 싣지 않는다 (review round 1 h2).
    props: state === "collapsed" ? { isExpanded: false } : {},
    metadata: {
      type: CATALOG_ORIGIN_METADATA_TYPE,
      systemOwned: true,
      componentFamily: String(origin.type),
      variant: state,
    },
  } as unknown as CanonicalNode;
}

function cloneVariantChildren(
  children: readonly CanonicalNode[] | undefined,
  variantId: string,
  counter: { n: number },
): CanonicalNode[] | undefined {
  if (!children || children.length === 0) return undefined;
  return children.map((child) => {
    counter.n += 1;
    const id = `${variantId}__${counter.n}`;
    const nested = cloneVariantChildren(child.children, variantId, counter);
    return {
      ...child,
      id,
      ...(nested ? { children: nested } : {}),
    };
  });
}

/** default origin 에서 상태 변형 origin 한 개를 만든다 (style/fills 비움). */
export function buildStateVariantOrigin(
  defaultOrigin: CanonicalNode,
  state: StateVariantState,
): CanonicalNode {
  const variantId = stateVariantOriginId(defaultOrigin.id, state);
  const { style: _style, ...propsWithoutStyle } = (defaultOrigin.props ??
    {}) as Record<string, unknown>;
  const {
    fills: _fills,
    responsive: _responsive,
    ...rest
  } = defaultOrigin as CanonicalNode & { responsive?: unknown };
  const children = cloneVariantChildren(defaultOrigin.children, variantId, {
    n: 0,
  });
  const baseName =
    typeof defaultOrigin.name === "string" && defaultOrigin.name.length > 0
      ? defaultOrigin.name
      : String(defaultOrigin.type);
  const { children: _children, ...restWithoutChildren } = rest;
  return {
    ...restWithoutChildren,
    id: variantId,
    name: `${baseName}/${STATE_LABELS[state]}`,
    reusable: true,
    props: { ...propsWithoutStyle, style: {} },
    ...(children ? { children } : {}),
    metadata: {
      ...(defaultOrigin.metadata ?? { type: CATALOG_ORIGIN_METADATA_TYPE }),
      type: CATALOG_ORIGIN_METADATA_TYPE,
      systemOwned: true,
      componentFamily: String(defaultOrigin.type),
      variant: state,
      variantOf: defaultOrigin.id,
    },
  } as CanonicalNode;
}

/**
 * 상태 변형을 가질 base origin 이면 그 상태 열 — seed (`ensureStateVariantOrigins`) 와 이관
 * (`migrateVariantsToOriginInstances`) 이 같은 술어를 읽는다.
 *
 * ADR-237 Phase 1 (F4): 종전 `node.id === catalogReusableOriginId(type)` 은 root type 이 Button 인 IconButton
 * origin (`component-iconbutton`) 을 빠뜨렸다. 판정 = 시스템 소유 reusable origin 이고 root type 이 표에 있음
 * (사용자가 만든 reusable 은 `systemOwned` 가 없어 대상 밖 — 변형을 몰래 붙이지 않는다).
 */
export function isStateVariantBaseOrigin(
  node: CanonicalNode,
): readonly StateVariantState[] | null {
  const states = STATE_VARIANT_BASE_TYPES[String(node.type)];
  if (!states) return null;
  if (node.reusable !== true) return null;
  const metadata = node.metadata as { systemOwned?: unknown } | undefined;
  if (
    metadata?.systemOwned !== true &&
    node.id !== catalogReusableOriginId(String(node.type))
  ) {
    return null;
  }
  if (readStateVariantSelf(node)) return null;
  // ADR-237 Phase 2 — 234 이관 전 항목 템플릿 쌍은 변형을 받지 않는다: selected 템플릿은 이관이 지우고, default 는
  //   이관을 지나 선택 상태 origin 이 된 뒤 (hydration 두 번째 seed pass) 변형을 받는다.
  const pair = ITEM_TEMPLATE_VARIANT_PAIRS.find(
    (candidate) =>
      candidate.selectedId === node.id || candidate.defaultId === node.id,
  );
  if (pair && (pair.selectedId === node.id || !isSelectedStateOrigin(node))) {
    return null;
  }
  return states;
}

function collectIds(nodes: readonly CanonicalNode[], out: Set<string>): void {
  for (const node of nodes) {
    out.add(node.id);
    if (node.children) collectIds(node.children, out);
  }
}

/**
 * Components 페이지 body 의 기본 요소 origin 마다 부재 변형 origin 을 default 바로 뒤 — 이미
 * 있는 변형 run 의 **끝** — 에 넣는다 (Phase 1 문서에 Phase 2 interaction 변형을 보충해도 기존
 * `--selected`/`--disabled` 자리는 그대로). 기존 변형 (사용자 편집 포함) 은 그대로 · 변경 0 이면
 * 같은 문서 객체를 돌려준다 (재hydration Δ0).
 */
export function ensureStateVariantOrigins(
  document: CompositionDocument,
): CompositionDocument {
  const existingIds = new Set<string>();
  collectIds(document.children, existingIds);

  let changed = false;
  const patchBody = (body: CanonicalNode): CanonicalNode => {
    const source = body.children ?? [];
    const next: CanonicalNode[] = [];
    for (let index = 0; index < source.length; index += 1) {
      const node = source[index]!;
      next.push(node);
      const states = isStateVariantBaseOrigin(node);
      if (!states) continue;
      while (
        index + 1 < source.length &&
        readStateVariantSelf(source[index + 1])?.variantOf === node.id
      ) {
        index += 1;
        next.push(source[index]!);
      }
      // ADR-234: 이관을 지난 origin (= 선택 상태) 은 복제본이 아니라 ref 변형을 보충하고, selected 자리는
      //   휴지 상태 (`unselected`) 다 — `--selected` 를 되살리지 않는다 (재hydration Δ0).
      const migrated = isSelectedStateOrigin(node);
      const hasRefVariant = next.some(
        (candidate) =>
          candidate.type === "ref" &&
          (candidate as { ref?: unknown }).ref === node.id &&
          readStateVariantSelf(candidate) !== null,
      );
      const seedAsRef = migrated || hasRefVariant;
      const seedStates = migrated
        ? states.map((state) => (state === "selected" ? "unselected" : state))
        : states;
      for (const state of seedStates) {
        const variantId = stateVariantOriginId(node.id, state);
        if (existingIds.has(variantId)) continue;
        existingIds.add(variantId);
        // ADR-237 Phase 2 · 3 — 새 어휘 (`collapsed` · `current`) 는 이관 전 복제본 모양이 없다: 처음부터 ref 변형.
        next.push(
          seedAsRef || state === "collapsed" || state === "current"
            ? buildStateVariantRef(node, state)
            : buildStateVariantOrigin(node, state),
        );
        changed = true;
      }
    }
    return changed ? { ...body, children: next } : body;
  };

  const visit = (nodes: readonly CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) => {
      if (node.id === COMPONENTS_SYSTEM_BODY_ID) return patchBody(node);
      if (!node.children) return node;
      const children = visit(node.children);
      return children === node.children ||
        children.every((child, index) => child === node.children![index])
        ? node
        : { ...node, children };
    });

  const children = visit(document.children);
  return changed ? { ...document, children } : document;
}
