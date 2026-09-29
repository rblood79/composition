/**
 * ADR-237 Phase 3 — Breadcrumbs 항목 origin (`component-breadcrumb-item-default`).
 *
 * 234 목록 모델 (항목 = origin 의 instance 자식 · slot = 추천 항목) 을 Breadcrumbs 에 적용한다. origin = 링크 모양
 * (가장 완성된 항목), 현재 항목 모양은 상태 변형 `--current` (seed 는 `ensureStateVariantOrigins`). 현재 판정은
 * RAC 위치 규칙 (마지막 = current) 이 정본이다.
 *
 * 조각 = [label Text, 구분자 Icon] (DOM `li[Link(label), Icon]` — 사용자 결정 2026-09-29, crumb · icon · crumb). 폭
 * `fit-content` · 크기 = Breadcrumbs `size` 위임 (Skia `resolveParentDelegatedSize`). instance 의 글자는
 * `descendants.Label.children`.
 *
 * 위치: Components body 에 이미 있으면 그 자리에서 repair (사용자 편집 보존), 없으면 Breadcrumbs origin 바로 앞
 * (없으면 body 끝). 바뀐 것이 없으면 같은 문서 객체.
 */
import {
  catalogBreadcrumbSeparatorIcon,
  type CanonicalNode,
  type CompositionDocument,
} from "@composition/shared";

import { getCanonicalRefChildSegment } from "../../../adapters/canonical/canonicalRefResolution";
import { COMPONENTS_SYSTEM_BODY_ID } from "../../pages/systemComponentsPage";

import { BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID } from "../templateItemOriginIds";

export { BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID };
export const BREADCRUMBS_ORIGIN_ID = "component-breadcrumbs";

/** 조합 자식 표시 이름 = descendants segment (instance label 은 `descendants.Label.children`). */
export const BREADCRUMB_LABEL_SEGMENT = "Label";
export const BREADCRUMB_SEPARATOR_SEGMENT = "Separator";

/**
 * 조합 자식을 가진 origin 표시 — 이 값이 있으면 repair 는 자식을 건드리지 않는다 (사용자가 지운 구분자를 되살리지
 * 않는다). 없으면 이관 전 leaf origin: `props.children` 글자를 label 자식으로 옮기고 구분자를 더한다.
 */
const ITEM_SLOTS_MARKER = 1;

function labelChild(text: string): CanonicalNode {
  return {
    id: `${BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID}__label`,
    type: "Text",
    name: BREADCRUMB_LABEL_SEGMENT,
    // RAC Breadcrumb · Link 는 Text slot context 가 없다 — `slot` 을 싣지 않는다 (DEFAULT_SLOT).
    props: { children: text },
    metadata: {
      type: "breadcrumb-item-slot",
      systemOwned: true,
      slotRole: "label",
    },
  } as CanonicalNode;
}

const BREADCRUMB_SEPARATOR_ICON_NAME =
  catalogBreadcrumbSeparatorIcon(undefined).name;

/**
 * 구분자 = 편집 가능한 Icon (사용자 결정 2026-09-29 — 종전 `::after` "›"). 이름 기본값 = catalog
 * `Breadcrumb.variants.default.trailingIcon.name`, 크기 · 색 · 간격은 catalog 가 정한다 (자식에 싣지 않는다).
 * 현재 조각 (마지막 · `--current`) 에서는 소비자가 숨긴다 — 노드는 문서에 남는다.
 */
function separatorChild(): CanonicalNode {
  return {
    id: `${BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID}__separator`,
    type: "Icon",
    name: BREADCRUMB_SEPARATOR_SEGMENT,
    props: { slot: "separator", iconName: BREADCRUMB_SEPARATOR_ICON_NAME },
    metadata: {
      type: "breadcrumb-item-slot",
      systemOwned: true,
      slotRole: "separator",
      optional: true,
    },
  } as CanonicalNode;
}

export function createBreadcrumbItemOrigin(): CanonicalNode {
  return {
    id: BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID,
    type: "Breadcrumb",
    name: "Breadcrumb/Default",
    reusable: true,
    props: {
      href: "#",
      style: { width: "fit-content" },
    },
    children: [labelChild("Breadcrumb"), separatorChild()],
    metadata: {
      type: "breadcrumb-template-origin",
      systemOwned: true,
      componentFamily: "Breadcrumbs",
      variant: "default",
      itemSlots: ITEM_SLOTS_MARKER,
    },
  } as CanonicalNode;
}

function repairOrigin(existing: CanonicalNode): CanonicalNode {
  const base = createBreadcrumbItemOrigin();
  const metadata = {
    ...base.metadata,
    ...(existing.metadata ?? {}),
    type: existing.metadata?.type ?? base.metadata?.type,
    systemOwned: true,
    componentFamily: "Breadcrumbs",
  } as Record<string, unknown>;
  // marker 는 기존 origin 자신의 것만 (seed 기본 metadata 의 marker 를 물려받으면 이관 전 origin 을 건너뛴다).
  if (
    (existing.metadata as Record<string, unknown> | undefined)?.itemSlots ===
    ITEM_SLOTS_MARKER
  ) {
    return {
      ...base,
      ...existing,
      props: existing.props ?? base.props,
      children: existing.children ?? [],
      metadata,
    } as CanonicalNode;
  }
  // 이관 전 leaf origin — 글자를 label 자식으로 (사용자가 바꾼 글자 보존), 구분자 추가.
  const { children: text, ...props } = (existing.props ??
    base.props ??
    {}) as Record<string, unknown>;
  return {
    ...base,
    ...existing,
    props,
    children: [
      labelChild(
        typeof text === "string" || typeof text === "number"
          ? String(text)
          : "Breadcrumb",
      ),
      separatorChild(),
      ...(existing.children ?? []),
    ],
    metadata: { ...metadata, itemSlots: ITEM_SLOTS_MARKER },
  } as unknown as CanonicalNode;
}

export function ensureBreadcrumbsTemplateOrigins(
  document: CompositionDocument,
): CompositionDocument {
  let changed = false;
  const patchBody = (body: CanonicalNode): CanonicalNode => {
    const children = body.children ?? [];
    const index = children.findIndex(
      (node) => node.id === BREADCRUMB_ITEM_DEFAULT_ORIGIN_ID,
    );
    if (index >= 0) {
      const repaired = repairOrigin(children[index]!);
      if (JSON.stringify(repaired) === JSON.stringify(children[index])) {
        return body;
      }
      changed = true;
      const next = [...children];
      next[index] = repaired;
      return { ...body, children: next };
    }
    changed = true;
    const at = children.findIndex((node) => node.id === BREADCRUMBS_ORIGIN_ID);
    const next = [...children];
    next.splice(at >= 0 ? at : next.length, 0, createBreadcrumbItemOrigin());
    return { ...body, children: next };
  };
  const visit = (nodes: readonly CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) => {
      if (node.id === COMPONENTS_SYSTEM_BODY_ID) return patchBody(node);
      if (!node.children) return node;
      const children = visit(node.children);
      return children.every((child, i) => child === node.children![i])
        ? node
        : { ...node, children };
    });
  const children = visit(document.children);
  return changed ? { ...document, children } : document;
}

/** ref 체인 끝 (plain) 노드 — 순환 · 끊긴 체인은 undefined. */
function resolveRefMaster(
  node: CanonicalNode,
  byId: ReadonlyMap<string, CanonicalNode>,
): CanonicalNode | undefined {
  let cursor: CanonicalNode | undefined = node;
  for (let hop = 0; hop < 8 && cursor; hop += 1) {
    if (cursor.type !== "ref") return cursor;
    const ref: unknown = (cursor as { ref?: unknown }).ref;
    cursor = typeof ref === "string" ? byId.get(ref) : undefined;
  }
  return undefined;
}

/**
 * 2026-09-29 — Breadcrumb 항목 instance 의 글자 (`props.children`) → label 자식 patch (`descendants.<Label>.children`).
 * origin 이 [Text, 구분자 Icon] 이 된 뒤 (`ensureBreadcrumbsTemplateOrigins`) instance 의 자기 글자는 아무도 읽지
 * 않는다. 이미 label patch 가 있으면 그것이 이긴다 (글자만 지운다). 멱등 — 옮길 글자가 없으면 같은 문서 객체.
 */
export function migrateBreadcrumbLabelsToSlot(
  document: CompositionDocument,
): CompositionDocument {
  const byId = new Map<string, CanonicalNode>();
  const index = (nodes: readonly CanonicalNode[]) => {
    for (const node of nodes) {
      byId.set(node.id, node);
      if (node.children) index(node.children);
    }
  };
  index(document.children);
  const labelSegmentOf = (master: CanonicalNode): string | null => {
    if (master.type !== "Breadcrumb") return null;
    const siblings = master.children ?? [];
    const label = siblings.find(
      (child) =>
        (child.metadata as Record<string, unknown> | undefined)?.slotRole ===
        "label",
    );
    return label ? getCanonicalRefChildSegment(siblings, label) : null;
  };
  let changed = false;
  const migrate = (node: CanonicalNode): CanonicalNode => {
    if (node.type !== "ref") return node;
    const props = node.props as Record<string, unknown> | undefined;
    const text = props?.children;
    if (typeof text !== "string" && typeof text !== "number") return node;
    const master = resolveRefMaster(node, byId);
    const segment = master ? labelSegmentOf(master) : null;
    if (!segment) return node;
    const { children: _text, ...restProps } = props!;
    const descendants = {
      ...((node as { descendants?: Record<string, unknown> }).descendants ??
        {}),
    };
    const patch = (descendants[segment] ?? {}) as Record<string, unknown>;
    if (patch.children === undefined) {
      descendants[segment] = { ...patch, children: String(text) };
    }
    changed = true;
    return { ...node, props: restProps, descendants } as CanonicalNode;
  };
  const visit = (nodes: readonly CanonicalNode[]): CanonicalNode[] =>
    nodes.map((node) => {
      const next = migrate(node);
      if (!next.children) return next;
      const children = visit(next.children);
      return children.every((child, i) => child === next.children![i])
        ? next
        : { ...next, children };
    });
  const children = visit(document.children);
  return changed ? { ...document, children } : document;
}
