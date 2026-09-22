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
import { CATALOG_ORIGIN_METADATA_TYPE } from "./catalogOrigins";

/**
 * 선언적 상태 (Phase 1 — 두 leg 유효 상태로 해소) 와 interaction 상태 (Phase 2 — Preview DOM
 * 의 RAC data 속성으로만 해소, 캔버스는 변형 origin 자신을 catalog 상태 토큰으로 정적 표시 —
 * ADR-150 경계).
 */
export type StateVariantState =
  "selected" | "disabled" | "hover" | "pressed" | "focus-visible";

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
};

export function isInteractionStateVariant(state: StateVariantState): boolean {
  return INTERACTION_STATE_VARIANTS.includes(state);
}

const STATE_LABELS: Readonly<Record<StateVariantState, string>> = {
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
  node: { metadata?: unknown } | null | undefined,
): StateVariantSelf | null {
  const metadata = node?.metadata as
    { variant?: unknown; variantOf?: unknown } | undefined;
  if (!metadata) return null;
  const { variant, variantOf } = metadata;
  if (!isStateVariantState(variant) || typeof variantOf !== "string") {
    return null;
  }
  return { state: variant, variantOf };
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

function isBaseOrigin(
  node: CanonicalNode,
): readonly StateVariantState[] | null {
  const states = STATE_VARIANT_BASE_TYPES[String(node.type)];
  if (!states) return null;
  if (node.id !== catalogReusableOriginId(String(node.type))) return null;
  if (readStateVariantSelf(node)) return null;
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
      const states = isBaseOrigin(node);
      if (!states) continue;
      while (
        index + 1 < source.length &&
        readStateVariantSelf(source[index + 1])?.variantOf === node.id
      ) {
        index += 1;
        next.push(source[index]!);
      }
      for (const state of states) {
        const variantId = stateVariantOriginId(node.id, state);
        if (existingIds.has(variantId)) continue;
        existingIds.add(variantId);
        next.push(buildStateVariantOrigin(node, state));
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
