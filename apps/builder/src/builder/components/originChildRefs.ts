import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import {
  getReusableOriginId,
  isDelegatedSubpartChild,
} from "@composition/shared";
import { mergePropsWithStyleDeep } from "../../adapters/canonical/instanceResolver";
import { applyFactoryPropagation } from "../utils/propagationEngine";
import { COMPONENTS_SYSTEM_BODY_ID } from "../pages/systemComponentsPage";

/**
 * ADR-229 Phase 2 — 저작 조합층 자식의 ref 화 (규칙 하나).
 *
 * 조합 origin (Form · Toolbar · generic ButtonGroup/Pagination …) 의 자식 중 reusable origin 이
 * 있는 type (Button · TextField …) 은 그 origin 의 **instance** 로 시드한다 — `type:"ref"` +
 * `props` 는 origin 과 다른 키만 (ADR-228 명시 initialProps 규칙 · `diffPropsAgainstOrigin`).
 * 자식이 자기 subtree 를 갖고 있으면 (Form 의 TextField > Label/Input/FieldError) origin subtree
 * 에 root props 전파 (`applyFactoryPropagation` — 생성 경로와 같은 함수) 를 얹은 **기대 subtree**
 * 와 대조해, 전파로 설명되지 않는 차이만 `descendants` patch (mode A) 로 옮긴다.
 *
 * 변환하지 않는 경우 (진단 기록 · 자식은 plain 그대로 — 조용한 대체 금지):
 * - origin 부재 (`missing-origin`) — `props:{}` 로 대체하지 않는다.
 * - 순환 (`cycle`) — 변환 중인 조합 origin 사슬 안의 origin 을 가리킨다.
 * - subtree 불일치 (`subtree-mismatch`) — 자식 수/type 이 다르거나 descendants patch 로 표현
 *   못 하는 필드 (responsive · slot · 자식 fills 외) 가 갈린다. 이때도 그 plain 자식의 자식은
 *   규칙대로 계속 본다.
 * - sub-part (`isDelegatedSubpartChild` — ADR-923 P5 술어 하나) 는 부모 rule delegation 이 정본.
 *
 * 2단 seed (`convertNewOriginChildrenToRefs`): ensurer 들이 plain 으로 보충을 끝낸 뒤, 진입 시
 * **없었던** origin 의 자식만 변환한다. 대조 index 는 변환 전 문서 (①의 완성 props) 로 고정해
 * 순회 순서와 무관하게 같은 결과를 낸다. 기존 origin 의 자식은 일절 건드리지 않는다 (F8 · G4).
 */

export type OriginChildRefDiagnostic = {
  originId: string | null;
  childId: string;
  reason: "missing-origin" | "cycle" | "subtree-mismatch";
  detail?: string;
};

export type OriginChildSeedContext = {
  /** 변환 전 문서의 reusable origin index (id → 노드). */
  originsById: ReadonlyMap<string, CanonicalNode>;
  parentType: string | null;
  grandparentType: string | null;
  /** 변환 중인 조합 origin 사슬 — 이 안의 origin 을 가리키면 순환. */
  ownerChain: ReadonlySet<string>;
  diagnostics: OriginChildRefDiagnostic[];
};

type PlainNode = CanonicalNode & {
  props?: Record<string, unknown>;
  children?: CanonicalNode[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function valueEquals(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * ADR-228 명시 initialProps 규칙 — origin 유효값과 **다른 키만** patch (style 은 키 단위).
 * `canonicalMutations.diffRefPropsAgainstMaster` 와 같은 판정 (chartType 예외는 팔레트 진입점
 * 문제라 seed 에는 없다).
 */
export function diffPropsAgainstOrigin(
  props: Record<string, unknown> | undefined,
  originProps: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const base = originProps ?? {};
  for (const [key, value] of Object.entries(props ?? {})) {
    if (key === "style") {
      if (!isRecord(value)) {
        if (!valueEquals(base.style, value)) patch.style = value;
        continue;
      }
      const baseStyle = isRecord(base.style) ? base.style : {};
      const styleDiff: Record<string, unknown> = {};
      for (const [styleKey, styleValue] of Object.entries(value)) {
        if (!valueEquals(baseStyle[styleKey], styleValue)) {
          styleDiff[styleKey] = styleValue;
        }
      }
      if (Object.keys(styleDiff).length > 0) patch.style = styleDiff;
      continue;
    }
    if (!valueEquals(base[key], value)) patch[key] = value;
  }
  return patch;
}

type FlatSeed = {
  id: string;
  type: string;
  parent_id: string | null;
  props: Record<string, unknown>;
  source: CanonicalNode;
};

function flattenSubtree(
  node: CanonicalNode,
  parentId: string | null,
  out: FlatSeed[],
): void {
  out.push({
    id: node.id,
    type: node.type,
    parent_id: parentId,
    props: { ...(node.props ?? {}) },
    source: node,
  });
  for (const child of node.children ?? []) flattenSubtree(child, node.id, out);
}

function nestSubtree(
  parentId: string,
  flat: readonly FlatSeed[],
): CanonicalNode[] {
  return flat
    .filter((item) => item.parent_id === parentId)
    .map((item) => {
      const children = nestSubtree(item.id, flat);
      return {
        ...item.source,
        props: item.props,
        ...(children.length > 0 ? { children } : {}),
      } as CanonicalNode;
    });
}

/**
 * origin subtree 안의 ref 자식 (이미 변환된 기존 origin) 을 그 origin 으로 열어 plain 모양으로
 * 만든다 — 대조는 항상 plain ↔ plain. descendants 를 가진 ref 는 열지 않는다 (대조가 어긋나
 * 보류로 떨어진다 — 조용한 대체보다 안전).
 */
function openOriginSubtree(
  node: CanonicalNode,
  originsById: ReadonlyMap<string, CanonicalNode>,
  visited: ReadonlySet<string>,
): CanonicalNode {
  const children = (node.children ?? []).map((child) => {
    const ref = (child as { ref?: unknown }).ref;
    if (child.type !== "ref" || typeof ref !== "string") {
      return openOriginSubtree(child, originsById, visited);
    }
    const master = originsById.get(ref);
    if (
      !master ||
      master.type === "ref" ||
      visited.has(ref) ||
      (child as { descendants?: unknown }).descendants !== undefined
    ) {
      return child;
    }
    const opened = openOriginSubtree(
      master,
      originsById,
      new Set([...visited, ref]),
    );
    return {
      ...opened,
      id: child.id,
      props: mergePropsWithStyleDeep(master.props ?? {}, child.props ?? {}),
      reusable: undefined,
    } as CanonicalNode;
  });
  return children.length > 0 ? { ...node, children } : node;
}

/** origin subtree 에 (origin ⊕ 자식 props) 를 root 로 한 factory 전파를 얹은 기대 subtree. */
function expectedSubtree(
  origin: CanonicalNode,
  rootProps: Record<string, unknown>,
  originsById: ReadonlyMap<string, CanonicalNode>,
): CanonicalNode[] {
  const opened = openOriginSubtree(origin, originsById, new Set([origin.id]));
  const flat: FlatSeed[] = [];
  for (const child of opened.children ?? [])
    flattenSubtree(child, origin.id, flat);
  if (flat.length === 0) return [];
  const root = {
    id: origin.id,
    type: origin.type,
    parent_id: null,
    props: rootProps,
    source: origin,
  };
  const propagated = applyFactoryPropagation(root, flat);
  return nestSubtree(origin.id, propagated);
}

/** descendants patch 로 옮길 수 없는 자식 필드 — 갈리면 변환 보류. */
const UNPATCHABLE_CHILD_FIELDS = ["responsive", "slot", "sizing"] as const;

/**
 * mode A patch 에서 노드 필드로 읽히는 키 — props 에 이 이름이 있으면 patch 로 못 옮긴다
 * (`type` 은 mode B 교체 · 배열 `children` 은 mode C · 나머지는 `propsFromDescendantPatch` 예약).
 */
const PATCH_RESERVED_PROP_KEYS: ReadonlySet<string> = new Set([
  "id",
  "type",
  "ref",
  "reusable",
  "name",
  "metadata",
  "descendants",
  "sizing",
  "responsive",
  "fills",
]);

function unpatchablePropKey(
  patch: Record<string, unknown>,
): string | null {
  for (const key of Object.keys(patch)) {
    if (PATCH_RESERVED_PROP_KEYS.has(key)) return key;
    if (key === "children" && Array.isArray(patch[key])) return key;
  }
  return null;
}

/**
 * 저작 subtree ↔ 기대 subtree 대조. 같은 위치의 자식은 type 이 같아야 하고, props 차이는
 * patch 로 (plain 에 없는 키는 origin 값 채택 — patch 는 삭제를 표현하지 못한다). fills 가
 * 갈리면 patch 의 `fills` 로. 실패는 detail 문자열.
 */
function diffSubtree(
  actual: readonly CanonicalNode[],
  expected: readonly CanonicalNode[],
  pathPrefix: string,
  out: Record<string, Record<string, unknown>>,
): string | null {
  if (actual.length !== expected.length) {
    return `${pathPrefix || "<root>"}: 자식 수 ${actual.length} ≠ origin ${expected.length}`;
  }
  for (let index = 0; index < actual.length; index += 1) {
    const node = actual[index]!;
    const target = expected[index]!;
    if (node.type !== target.type) {
      return `${pathPrefix}${node.id}: type ${node.type} ≠ origin ${target.type}`;
    }
    for (const field of UNPATCHABLE_CHILD_FIELDS) {
      if (
        node[field] !== undefined &&
        !valueEquals(node[field], target[field])
      ) {
        return `${pathPrefix}${node.id}: ${field} 가 origin 과 갈린다`;
      }
    }
    const path = `${pathPrefix}${pathSegmentOf(target)}`;
    const propsPatch = diffPropsAgainstOrigin(node.props, target.props);
    const reserved = unpatchablePropKey(propsPatch);
    if (reserved) {
      return `${pathPrefix}${node.id}: props.${reserved} 차이는 descendants patch 로 표현할 수 없다`;
    }
    const patch: Record<string, unknown> = { ...propsPatch };
    if (node.fills !== undefined && !valueEquals(node.fills, target.fills)) {
      patch.fills = node.fills;
    }
    if (Object.keys(patch).length > 0) out[path] = patch;
    const nested = diffSubtree(
      node.children ?? [],
      target.children ?? [],
      `${path}/`,
      out,
    );
    if (nested) return nested;
  }
  return null;
}

/** 해소기 (`getCanonicalRefPathSegment`) 와 같은 segment — canonical 노드는 name → id. */
function pathSegmentOf(node: CanonicalNode): string {
  return node.name || node.id;
}

function isRefNode(node: CanonicalNode): boolean {
  return (
    node.type === "ref" || typeof (node as { ref?: unknown }).ref === "string"
  );
}

/**
 * 규칙 하나: reusable origin 이 있는 type 의 자식 → origin instance (ref). 변환하지 않은 노드는
 * 그 자식으로 계속 내려간다.
 */
export function toOriginChildSeed(
  node: CanonicalNode,
  context: OriginChildSeedContext,
): CanonicalNode {
  if (isRefNode(node)) return node;
  // item template origin 의 slot 자식 (ListBox/Tag item 의 Icon/Avatar/Text — `metadata.slotRole`)
  //   은 두 leg 가 **모양 (type · props.slot)** 으로 읽는 slot vocabulary 지 저작 조합이 아니다 —
  //   ref 로 바꾸면 `resolveSlotComposition` 이 role 을 잃는다.
  if (typeof node.metadata?.slotRole === "string") return node;
  const { parentType, grandparentType } = context;
  if (isDelegatedSubpartChild(node.type, parentType, grandparentType)) {
    return node;
  }
  const originId = getReusableOriginId(node.type);
  const converted = originId
    ? convertToRef(node as PlainNode, originId, context)
    : null;
  if (converted) return converted;

  const children = node.children;
  if (!children || children.length === 0) return node;
  let changed = false;
  const nextChildren = children.map((child) => {
    const next = toOriginChildSeed(child, {
      ...context,
      parentType: node.type,
      grandparentType: parentType,
    });
    if (next !== child) changed = true;
    return next;
  });
  return changed ? { ...node, children: nextChildren } : node;
}

function convertToRef(
  node: PlainNode,
  originId: string,
  context: OriginChildSeedContext,
): CanonicalNode | null {
  const diagnose = (
    reason: OriginChildRefDiagnostic["reason"],
    detail?: string,
  ): null => {
    context.diagnostics.push({ originId, childId: node.id, reason, detail });
    return null;
  };
  if (context.ownerChain.has(originId)) return diagnose("cycle");
  const origin = context.originsById.get(originId);
  if (!origin || origin.type === "ref") return diagnose("missing-origin");
  if (origin.type !== node.type) {
    return diagnose(
      "missing-origin",
      `origin type ${origin.type} ≠ ${node.type}`,
    );
  }

  const props = diffPropsAgainstOrigin(node.props, origin.props);
  const descendants: Record<string, Record<string, unknown>> = {};
  const actualChildren = node.children ?? [];
  if (actualChildren.length > 0 || (origin.children?.length ?? 0) > 0) {
    const expected = expectedSubtree(
      origin,
      mergePropsWithStyleDeep(origin.props ?? {}, node.props ?? {}),
      context.originsById,
    );
    const mismatch = diffSubtree(actualChildren, expected, "", descendants);
    if (mismatch) return diagnose("subtree-mismatch", mismatch);
  }

  const { children: _children, props: _props, type: _type, ...rest } = node;
  return {
    ...rest,
    type: "ref",
    ref: originId,
    props,
    ...(Object.keys(descendants).length > 0 ? { descendants } : {}),
  } as CanonicalNode;
}

function collectOriginsById(
  nodes: readonly CanonicalNode[],
  out: Map<string, CanonicalNode>,
): void {
  for (const node of nodes) {
    if (node.reusable === true && !out.has(node.id)) out.set(node.id, node);
    collectOriginsById(node.children ?? [], out);
  }
}

/** 문서의 reusable origin id 집합 — 2단 seed 의 "진입 시 존재" 판정용. */
export function collectReusableOriginIds(
  document: CompositionDocument,
): Set<string> {
  const map = new Map<string, CanonicalNode>();
  collectOriginsById(document.children, map);
  return new Set(map.keys());
}

/**
 * 2단 seed ②: Components body 안 reusable origin 중 `existingOriginIds` 에 없던 것의 자식만
 * ref 로 변환한다. 대조 index 는 입력 문서 (변환 전) 로 고정.
 */
export function convertNewOriginChildrenToRefs(
  document: CompositionDocument,
  options: { existingOriginIds: ReadonlySet<string> },
): { document: CompositionDocument; diagnostics: OriginChildRefDiagnostic[] } {
  const originsById = new Map<string, CanonicalNode>();
  collectOriginsById(document.children, originsById);
  const diagnostics: OriginChildRefDiagnostic[] = [];

  const convertOrigin = (origin: CanonicalNode): CanonicalNode => {
    const children = origin.children;
    if (!children || children.length === 0) return origin;
    let changed = false;
    const nextChildren = children.map((child) => {
      const next = toOriginChildSeed(child, {
        originsById,
        parentType: origin.type,
        grandparentType: null,
        ownerChain: new Set([origin.id]),
        diagnostics,
      });
      if (next !== child) changed = true;
      return next;
    });
    return changed ? { ...origin, children: nextChildren } : origin;
  };

  const visit = (
    nodes: readonly CanonicalNode[],
    insideBody: boolean,
  ): CanonicalNode[] => {
    let changed = false;
    const next = nodes.map((node) => {
      if (
        insideBody &&
        node.reusable === true &&
        !options.existingOriginIds.has(node.id)
      ) {
        const converted = convertOrigin(node);
        if (converted !== node) changed = true;
        return converted;
      }
      if (!node.children) return node;
      const children = visit(
        node.children,
        insideBody || node.id === COMPONENTS_SYSTEM_BODY_ID,
      );
      if (children === node.children) return node;
      changed = true;
      return { ...node, children };
    });
    return changed ? next : (nodes as CanonicalNode[]);
  };

  const children = visit(document.children, false);
  return {
    document:
      children === document.children ? document : { ...document, children },
    diagnostics,
  };
}
