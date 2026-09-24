/**
 * ADR-240 Phase 2 — 영역 채움 노드 (mode C `children` 배열에 들어가는 노드) 를 만든다.
 *
 * - reusable origin (추천 · 후보) → `{ type: "ref", ref }` (종전 Slot 채우기 모양).
 * - **자유 내용** (팔레트 primitive — reusable origin 이 없는 leaf) → plain 노드. props 는 팔레트 생성과 같은 합성
 *   (`composeCreationProps` — catalog 기본 + 생성 style). Canvas · Preview 해석기는 mode C plain 노드를 이미 그린다
 *   (G0 진단 (b) 기준선).
 *
 * 노드 id 는 형제 안에서만 유일하면 된다 — Canvas synthetic id 가 `<instance>/<영역 경로>/<id>` 다.
 */
import type { CanonicalNode } from "@composition/shared";

import { getDefaultProps } from "../../types/builder/unified.types";
import { composeCreationProps } from "../factories/creationStyleDefaults";
import { getReusableCompositeOriginId } from "./reusableCompositeOrigins";

/** 영역에 넣을 수 있는 자유 내용 type (팔레트 항목 중 reusable origin 이 없는 leaf · frame). */
export const SLOT_FILL_PRIMITIVE_TYPES: readonly string[] = [
  "Text",
  "Image",
  "Icon",
  "Separator",
  "frame",
];

const PRIMITIVE_SET: ReadonlySet<string> = new Set(SLOT_FILL_PRIMITIVE_TYPES);

export function isSlotFillPrimitiveType(type: string): boolean {
  return PRIMITIVE_SET.has(type);
}

export function slotFillPrimitiveLabel(type: string): string {
  return type === "frame" ? "Frame" : type;
}

/** 자유 내용 노드 props — 팔레트 생성과 같은 합성 (catalog 기본 + 생성 style + initialProps). */
export function buildSlotFillPrimitiveProps(
  type: string,
  initialProps?: Record<string, unknown>,
): Record<string, unknown> {
  return composeCreationProps(type, getDefaultProps(type), initialProps);
}

function existingIds(children: readonly unknown[]): Set<string> {
  const ids = new Set<string>();
  for (const child of children) {
    const id = (child as { id?: unknown } | null)?.id;
    if (typeof id === "string") ids.add(id);
  }
  return ids;
}

/** 형제 안 유일 id — `base`, 겹치면 `base-2` · `base-3` …. */
export function slotFillNodeId(
  base: string,
  siblings: readonly unknown[],
): string {
  const taken = existingIds(siblings);
  if (!taken.has(base)) return base;
  let index = 2;
  while (taken.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

/** reusable origin 채움 노드. */
export function buildSlotFillRefNode(
  origin: { id: string; customId?: string | null },
  siblings: readonly unknown[],
): CanonicalNode {
  return {
    id: slotFillNodeId(origin.customId ?? origin.id, siblings),
    type: "ref",
    ref: origin.id,
  } as CanonicalNode;
}

/**
 * 팔레트 type 하나의 채움 노드 — reusable origin 이 있으면 ref, 자유 내용 primitive 면 plain, 그 밖 (복합 factory
 * type) 은 null.
 */
export function buildSlotFillNodeForType(
  type: string,
  siblings: readonly unknown[],
  initialProps?: Record<string, unknown>,
): CanonicalNode | null {
  const originId = getReusableCompositeOriginId(type);
  if (originId) {
    const node = buildSlotFillRefNode({ id: originId }, siblings);
    return initialProps && Object.keys(initialProps).length > 0
      ? ({ ...node, props: { ...initialProps } } as CanonicalNode)
      : node;
  }
  if (!isSlotFillPrimitiveType(type)) return null;
  return {
    id: slotFillNodeId(type.toLowerCase(), siblings),
    type,
    props: buildSlotFillPrimitiveProps(type, initialProps),
  } as CanonicalNode;
}
