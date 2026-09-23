/**
 * ADR-234 Phase 2 — 이관: 상태 변형 복제본 → origin 의 ref + patch (시각 결과 보존).
 *
 * breakdown §4 Phase 2 이관 계약 (review round 1 h1 · h2):
 * - **origin id 고정**: 사용자 instance 가 ref 하는 origin 노드와 그 자식 id 는 그대로 — 선택 가능한
 *   가족은 내용만 선택 상태로 다시 쓰고 (`metadata.variant: "selected"`), 휴지 모양은 새
 *   `--unselected` 변형이 갖는다. 옛 `--selected` / `-selected` 노드는 origin 과 같은 상태라 제거.
 * - **patch 는 층으로 합성 가능하게**: 선택/휴지 차이는 `--unselected` 에만 둔다 (휴지 유효값 −
 *   origin 유효값: 다른 키 = 휴지 값 · origin 에만 있는 키 = `null` · fills 차이 = 휴지 fills 또는
 *   `[]`). 다른 상태 (disabled · hover · pressed · focus-visible) 는 **그 상태가 바꾸던 키만** (230
 *   관리 키 + fills) — 실행 중 층 겹침 (휴지 → 상태) 이 이관 전 모양을 그대로 낸다. 전체 차분으로
 *   두면 선택+disabled 가 휴지 배경으로 그려진다 (Phase 2 실행 판단 — breakdown §7).
 * - 230 이 무시하던 관리 키 밖 raw 값은 목표 유효값에 없으므로 버린다 — 이관이 새 모양을 켜지 않는다.
 * - 변형을 **직접** ref 한 노드: 옛 복제본 자식 id → origin 자식 id 대응표로 `descendants` 키를
 *   옮기고 (root · 중첩 · descendants 안 ref), `-selected` 대상은 origin 으로 바꾼다. 대응 없는
 *   경로가 하나라도 있으면 그 가족 이관을 통째로 보류한다 (부분 이관 없음).
 * - 멱등: 이관을 지난 문서는 같은 객체 (재hydration Δ0).
 */
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { catalogReusableOriginId } from "@composition/shared";

import { COMPONENTS_SYSTEM_BODY_ID } from "../pages/systemComponentsPage";
import {
  STATE_VARIANT_BASE_TYPES,
  buildStateVariantRef,
  isSelectedStateOrigin,
  readStateVariantSelf,
  stateVariantOriginId,
  type StateVariantState,
} from "./stateVariantOrigins";
import { readStateLayer } from "./stateVariantLayers";
import { getCanonicalRefPathSegment } from "../../adapters/canonical/canonicalRefResolution";

// ───────────────────────────── 유효값 차분 ─────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function same(a: unknown, b: unknown): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}

/**
 * `target` 을 만들려면 `base` 에 얹을 patch — 다른 키 = target 값, base 에만 있는 키 = `null`.
 * style 은 키 단위 (한 단계). 차이가 없으면 null.
 */
export function diffEffectiveProps(
  target: Record<string, unknown> | undefined,
  base: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  const t = target ?? {};
  const b = base ?? {};
  const out: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(t), ...Object.keys(b)])) {
    if (key === "style") continue;
    if (!(key in t)) out[key] = null;
    else if (!same(t[key], b[key])) out[key] = t[key];
  }
  const ts = isRecord(t.style) ? t.style : {};
  const bs = isRecord(b.style) ? b.style : {};
  const style: Record<string, unknown> = {};
  for (const key of new Set([...Object.keys(ts), ...Object.keys(bs)])) {
    if (!(key in ts)) style[key] = null;
    else if (!same(ts[key], bs[key])) style[key] = ts[key];
  }
  if (Object.keys(style).length > 0) out.style = style;
  return Object.keys(out).length > 0 ? out : null;
}

function readFills(node: CanonicalNode | undefined): unknown[] | undefined {
  return Array.isArray(node?.fills) && node.fills.length > 0
    ? node.fills
    : undefined;
}

/** fills 차이 → 휴지 쪽 fills (없으면 `[]` = 채움 없음 명시). 같으면 undefined. */
function diffFills(
  target: unknown[] | undefined,
  base: unknown[] | undefined,
): unknown[] | undefined {
  if (same(target ?? [], base ?? [])) return undefined;
  return target ?? [];
}

// ───────────────────────────── 문서 순회 ─────────────────────────────

function findComponentsBody(
  nodes: readonly CanonicalNode[],
): CanonicalNode | undefined {
  for (const node of nodes) {
    if (node.id === COMPONENTS_SYSTEM_BODY_ID) return node;
    const hit = findComponentsBody(node.children ?? []);
    if (hit) return hit;
  }
  return undefined;
}

function replaceBody(
  nodes: readonly CanonicalNode[],
  body: CanonicalNode,
): CanonicalNode[] {
  return nodes.map((node) => {
    if (node.id === COMPONENTS_SYSTEM_BODY_ID) return body;
    if (!node.children) return node;
    return { ...node, children: replaceBody(node.children, body) };
  });
}

/** 자식 subtree 의 id 를 DFS 순서로 (구조 대응표 재료). */
function subtreeIds(node: CanonicalNode): string[] {
  return (node.children ?? []).flatMap((child) => [
    child.id,
    ...subtreeIds(child),
  ]);
}

/** 두 subtree 가 같은 구조 (type · 순서) 면 a id → b id 표, 아니면 null. */
function mapSubtreeIds(
  from: CanonicalNode,
  to: CanonicalNode,
): Map<string, string> | null {
  const map = new Map<string, string>();
  const walk = (a: CanonicalNode, b: CanonicalNode): boolean => {
    const ac = a.children ?? [];
    const bc = b.children ?? [];
    if (ac.length !== bc.length) return false;
    for (let index = 0; index < ac.length; index += 1) {
      const x = ac[index]!;
      const y = bc[index]!;
      if (x.type !== y.type) return false;
      map.set(x.id, y.id);
      if (!walk(x, y)) return false;
    }
    return true;
  };
  return walk(from, to) ? map : null;
}

// ───────────────────────── 230 상태 변형 가족 ─────────────────────────

/** 선택 가능한 가족 (origin = 선택 상태). import 순환에서 모듈 초기화 순서를 타지 않게 지연 계산. */
function isSelectableFamily(type: string): boolean {
  return STATE_VARIANT_BASE_TYPES[type]?.includes("selected") === true;
}

interface FamilyPlan {
  /** body 에서 교체할 노드 (id → 새 노드, null = 제거). */
  replace: Map<string, CanonicalNode | null>;
  /** 변형 직접 ref 대상 교체 (옛 id → 새 id). */
  retarget: Map<string, string>;
  /** 옛 복제본 자식 id → origin 자식 id. */
  childIds: Map<string, string>;
}

function planStateVariantFamily(
  origin: CanonicalNode,
  clones: readonly CanonicalNode[],
): FamilyPlan | null {
  const plan: FamilyPlan = {
    replace: new Map(),
    retarget: new Map(),
    childIds: new Map(),
  };
  for (const clone of clones) {
    const ids = mapSubtreeIds(clone, origin);
    if (!ids) return null; // 대응 없는 경로 → 가족 보류
    for (const [from, to] of ids) plan.childIds.set(from, to);
  }
  const selectedClone = clones.find(
    (clone) => readStateVariantSelf(clone)?.state === "selected",
  );
  if (isSelectableFamily(String(origin.type))) {
    // origin = 휴지 (옛 default) + selected 층 → 선택 상태. 휴지 모양은 `--unselected`.
    const layer = selectedClone ? readStateLayer(selectedClone) : null;
    const restProps = origin.props ?? {};
    const restFills = readFills(origin);
    const selectedStyle = (layer?.props?.style ?? {}) as Record<
      string,
      unknown
    >;
    const selectedProps: Record<string, unknown> = {
      ...restProps,
      ...(Object.keys(selectedStyle).length > 0
        ? {
            style: {
              ...((restProps.style as Record<string, unknown> | undefined) ??
                {}),
              ...selectedStyle,
            },
          }
        : {}),
    };
    const selectedFills = layer?.fills ?? restFills;
    const nextOrigin: CanonicalNode = {
      ...origin,
      props: selectedProps,
      ...(selectedFills ? { fills: selectedFills } : {}),
      metadata: {
        ...(origin.metadata ?? {}),
        type: origin.metadata?.type ?? "catalog-origin",
        variant: "selected",
      },
    };
    if (!selectedFills && "fills" in nextOrigin) delete nextOrigin.fills;
    const unselected = buildStateVariantRef(nextOrigin, "unselected");
    const propsPatch = diffEffectiveProps(restProps, selectedProps);
    const fillsPatch = diffFills(restFills, selectedFills);
    const unselectedNode: CanonicalNode = {
      ...unselected,
      props: propsPatch ?? {},
      ...(fillsPatch !== undefined ? { fills: fillsPatch } : {}),
    };
    plan.replace.set(origin.id, nextOrigin);
    if (selectedClone) {
      // 옛 selected 자리에 휴지 변형 (origin 바로 뒤) — 옛 `--selected` 직접 ref 는 origin 으로.
      plan.replace.set(selectedClone.id, unselectedNode);
      plan.retarget.set(selectedClone.id, origin.id);
    } else {
      plan.replace.set(`${origin.id}::insert-unselected`, unselectedNode);
    }
  }
  for (const clone of clones) {
    const self = readStateVariantSelf(clone);
    if (!self || self.state === "selected") continue;
    const layer = readStateLayer(clone);
    const ref = buildStateVariantRef(origin, self.state as StateVariantState);
    plan.replace.set(clone.id, {
      ...ref,
      ...(clone.name ? { name: clone.name } : {}),
      props: layer?.props ?? {},
      ...(layer?.fills !== undefined ? { fills: layer.fills } : {}),
    } as CanonicalNode);
  }
  return plan;
}

// ───────────────────────── 항목 템플릿 (Tab · Tag · ListBoxItem) ─────────────────────────

/** 이관 대상 항목 템플릿 쌍 (default id = 새 origin id). GridListItem 은 selected 가 없어 대상 밖. */
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

function slotRoleOf(node: CanonicalNode): string {
  const metadata = node.metadata as { slotRole?: unknown } | undefined;
  if (typeof metadata?.slotRole === "string")
    return `role:${metadata.slotRole}`;
  const slot = (node.props as { slot?: unknown } | undefined)?.slot;
  if (typeof slot === "string") return `slot:${slot}`;
  return `type:${String(node.type)}`;
}

/**
 * default · selected 자식을 역할로 짝짓는다 — origin 자식 = default id + selected 내용 (selected 에만
 * 있는 자식은 selected id 로 origin 에, default 에만 있는 자식은 origin 에 숨김). 휴지 변형의 자손
 * patch 도 여기서 만든다.
 */
function mergeTemplateChildren(
  defaults: readonly CanonicalNode[],
  selecteds: readonly CanonicalNode[],
  pathPrefix: string,
  descendants: Record<string, Record<string, unknown>>,
): CanonicalNode[] {
  const byRole = new Map<string, CanonicalNode[]>();
  for (const child of selecteds) {
    const list = byRole.get(slotRoleOf(child)) ?? [];
    list.push(child);
    byRole.set(slotRoleOf(child), list);
  }
  const out: CanonicalNode[] = [];
  const used = new Set<CanonicalNode>();
  for (const def of defaults) {
    const match = byRole.get(slotRoleOf(def))?.find((c) => !used.has(c));
    // descendants 키 = segment 경로 (name 우선 — Canvas 는 이것만 읽고 Preview 는 id · segment 둘 다).
    const segment = getCanonicalRefPathSegment(def);
    const path = pathPrefix ? `${pathPrefix}/${segment}` : segment;
    if (!match) {
      // default 에만 — origin 에 숨겨 두고 휴지 변형이 되살린다.
      out.push({ ...def, enabled: false } as CanonicalNode);
      descendants[path] = { enabled: true };
      continue;
    }
    used.add(match);
    const merged: CanonicalNode = {
      ...def,
      props: match.props ?? def.props,
      ...(readFills(match) ? { fills: match.fills } : {}),
      children: mergeTemplateChildren(
        def.children ?? [],
        match.children ?? [],
        path,
        descendants,
      ),
    };
    if (!readFills(match)) delete (merged as { fills?: unknown }).fills;
    if ((merged.children ?? []).length === 0 && !def.children) {
      delete (merged as { children?: unknown }).children;
    }
    const patch: Record<string, unknown> = {
      ...(diffEffectiveProps(def.props, merged.props) ?? {}),
    };
    const fillsPatch = diffFills(readFills(def), readFills(merged));
    if (fillsPatch !== undefined) patch.fills = fillsPatch;
    if (Object.keys(patch).length > 0) descendants[path] = patch;
    out.push(merged);
  }
  for (const extra of selecteds) {
    if (used.has(extra)) continue;
    // selected 에만 — origin 에 있고 휴지 변형이 숨긴다.
    out.push(extra);
    const extraSegment = getCanonicalRefPathSegment(extra);
    descendants[pathPrefix ? `${pathPrefix}/${extraSegment}` : extraSegment] = {
      enabled: false,
    };
  }
  return out;
}

function planItemTemplatePair(
  defaultNode: CanonicalNode,
  selectedNode: CanonicalNode,
): FamilyPlan {
  const descendants: Record<string, Record<string, unknown>> = {};
  // 소비처 규칙 (Tab · Tag · ListBox 두 leg): 선택 행 = default root style 위에 selected root style
  //   overlay · fills 는 selected 우선 · slot 구성은 selected 것.
  const defaultProps = defaultNode.props ?? {};
  const selectedProps = selectedNode.props ?? {};
  const originProps: Record<string, unknown> = {
    ...defaultProps,
    ...selectedProps,
    style: {
      ...((defaultProps.style as Record<string, unknown> | undefined) ?? {}),
      ...((selectedProps.style as Record<string, unknown> | undefined) ?? {}),
    },
  };
  if (
    Object.keys(originProps.style as Record<string, unknown>).length === 0 &&
    !defaultProps.style &&
    !selectedProps.style
  ) {
    delete originProps.style;
  }
  const originFills = readFills(selectedNode) ?? readFills(defaultNode);
  const origin: CanonicalNode = {
    ...defaultNode,
    ...(selectedNode.name ? { name: selectedNode.name } : {}),
    props: originProps,
    ...(originFills ? { fills: originFills } : {}),
    children: mergeTemplateChildren(
      defaultNode.children ?? [],
      selectedNode.children ?? [],
      "",
      descendants,
    ),
    metadata: {
      ...(defaultNode.metadata ?? {}),
      type: defaultNode.metadata?.type ?? "catalog-origin",
      variant: "selected",
    },
  };
  if (!originFills) delete (origin as { fills?: unknown }).fills;
  const propsPatch = diffEffectiveProps(defaultProps, originProps);
  const fillsPatch = diffFills(readFills(defaultNode), originFills);
  const unselected: CanonicalNode = {
    id: stateVariantOriginId(defaultNode.id, "unselected"),
    type: "ref",
    ref: defaultNode.id,
    reusable: true,
    ...(defaultNode.name ? { name: defaultNode.name } : {}),
    props: propsPatch ?? {},
    ...(fillsPatch !== undefined ? { fills: fillsPatch } : {}),
    ...(Object.keys(descendants).length > 0 ? { descendants } : {}),
    metadata: {
      ...(defaultNode.metadata ?? {}),
      variant: "unselected",
    },
  } as unknown as CanonicalNode;
  const plan: FamilyPlan = {
    replace: new Map([
      [defaultNode.id, origin],
      [selectedNode.id, unselected],
    ]),
    retarget: new Map([[selectedNode.id, defaultNode.id]]),
    childIds: new Map(),
  };
  const ids = mapSubtreeIds(selectedNode, defaultNode);
  if (ids) for (const [from, to] of ids) plan.childIds.set(from, to);
  return plan;
}

// ───────────────────────── 문서 전체 적용 ─────────────────────────

function remapPathKey(key: string, childIds: ReadonlyMap<string, string>) {
  return key
    .split("/")
    .map((segment) => childIds.get(segment) ?? segment)
    .join("/");
}

/** slot 배열 · ref 대상 · descendants 키를 새 모양으로 (변형을 직접 참조한 노드만 바뀐다). */
function rewriteReferences(
  nodes: readonly CanonicalNode[],
  retarget: ReadonlyMap<string, string>,
  slotMap: ReadonlyMap<string, string>,
  childIds: ReadonlyMap<string, string>,
  skipIds: ReadonlySet<string>,
): { nodes: CanonicalNode[]; changed: boolean } {
  let changed = false;
  const out = nodes.map((node) => {
    let next = node;
    if (!skipIds.has(node.id)) {
      const ref = (node as { ref?: unknown }).ref;
      if (node.type === "ref" && typeof ref === "string") {
        const nextRef = retarget.get(ref);
        const descendants = (node as { descendants?: unknown }).descendants;
        let nextDescendants = descendants;
        if (isRecord(descendants) && childIds.size > 0) {
          const entries = Object.entries(descendants).map(
            ([key, value]) => [remapPathKey(key, childIds), value] as const,
          );
          if (
            entries.some(
              ([key], index) => key !== Object.keys(descendants)[index],
            )
          ) {
            nextDescendants = Object.fromEntries(entries);
          }
        }
        if (nextRef || nextDescendants !== descendants) {
          next = {
            ...next,
            ...(nextRef ? { ref: nextRef } : {}),
            ...(nextDescendants !== descendants
              ? { descendants: nextDescendants }
              : {}),
          } as CanonicalNode;
        }
      }
      if (Array.isArray(node.slot) && node.slot.some((id) => slotMap.has(id))) {
        next = {
          ...next,
          slot: node.slot.map((id) => slotMap.get(id) ?? id),
        };
      }
    }
    if (node.children) {
      const inner = rewriteReferences(
        node.children,
        retarget,
        slotMap,
        childIds,
        skipIds,
      );
      if (inner.changed) next = { ...next, children: inner.nodes };
    }
    if (next !== node) changed = true;
    return next;
  });
  return { nodes: out, changed };
}

/**
 * 문서의 상태 변형 복제본 · 항목 템플릿 selected 를 origin 의 ref 모양으로 옮긴다. 이관할 것이
 * 없으면 같은 문서 객체.
 */
export function migrateVariantsToOriginInstances(
  document: CompositionDocument,
): CompositionDocument {
  const body = findComponentsBody(document.children);
  if (!body?.children) return document;
  const byId = new Map(body.children.map((node) => [node.id, node]));

  const plans: FamilyPlan[] = [];
  const slotMap = new Map<string, string>();
  for (const origin of body.children) {
    const states = STATE_VARIANT_BASE_TYPES[String(origin.type)];
    if (!states || origin.id !== catalogReusableOriginId(String(origin.type))) {
      continue;
    }
    if (readStateVariantSelf(origin)) continue;
    const clones = body.children.filter(
      (node) =>
        node.type !== "ref" &&
        readStateVariantSelf(node)?.variantOf === origin.id,
    );
    if (clones.length === 0) continue;
    const plan = planStateVariantFamily(origin, clones);
    if (!plan) {
      console.warn(
        `[ADR-234] 상태 변형 이관 보류 — "${origin.id}" 복제본 자식 구조가 origin 과 다르다`,
      );
      continue;
    }
    plans.push(plan);
  }
  for (const pair of ITEM_TEMPLATE_VARIANT_PAIRS) {
    const defaultNode = byId.get(pair.defaultId);
    const selectedNode = byId.get(pair.selectedId);
    if (!defaultNode || !selectedNode) continue;
    if (isSelectedStateOrigin(defaultNode)) continue;
    plans.push(planItemTemplatePair(defaultNode, selectedNode));
    // slot 은 [휴지, origin] — 소비처 규칙 "slot[0] = 기본 · variant selected = 선택" 을 그대로 쓴다.
    slotMap.set(
      pair.defaultId,
      stateVariantOriginId(pair.defaultId, "unselected"),
    );
    slotMap.set(pair.selectedId, pair.defaultId);
  }
  if (plans.length === 0) return document;

  const replace = new Map<string, CanonicalNode | null>();
  const retarget = new Map<string, string>();
  const childIds = new Map<string, string>();
  const inserts = new Map<string, CanonicalNode>();
  for (const plan of plans) {
    for (const [id, node] of plan.replace) {
      if (id.endsWith("::insert-unselected")) {
        inserts.set(id.slice(0, -"::insert-unselected".length), node!);
      } else {
        replace.set(id, node);
      }
    }
    for (const [from, to] of plan.retarget) retarget.set(from, to);
    for (const [from, to] of plan.childIds) childIds.set(from, to);
  }

  const nextBodyChildren: CanonicalNode[] = [];
  for (const node of body.children) {
    const replacement = replace.has(node.id) ? replace.get(node.id) : node;
    if (replacement) nextBodyChildren.push(replacement);
    const inserted = inserts.get(node.id);
    if (inserted) nextBodyChildren.push(inserted);
  }
  const migratedIds = new Set(
    nextBodyChildren
      .filter((node) => replace.has(node.id) || inserts.has(node.id))
      .map((node) => node.id),
  );
  for (const node of inserts.values()) migratedIds.add(node.id);
  const replacedBody = { ...body, children: nextBodyChildren };
  const rewritten = rewriteReferences(
    replaceBody(document.children, replacedBody),
    retarget,
    slotMap,
    childIds,
    migratedIds,
  );
  return { ...document, children: rewritten.nodes };
}
