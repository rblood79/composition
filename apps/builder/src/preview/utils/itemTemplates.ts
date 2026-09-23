import {
  fillsToCssBackgroundStyle,
  resolveItemTemplateChipStyle,
  resolveSlotComposition,
} from "@composition/shared";
import type { TagItemTemplate } from "@composition/shared/types";

/** Preview 가 item template origin 에서 읽는 필드 (resolve 된 canonical 노드). */
export interface TemplateOriginRecord {
  slot?: unknown;
  children?: unknown[];
  metadata?: unknown;
  props?: unknown;
  fills?: unknown;
}

/** resolve 된 문서 트리 → id 색인 (template origin · slot 보유자 조회용). */
export function indexTemplateOriginRecords(
  nodes: readonly unknown[],
): Map<string, TemplateOriginRecord> {
  const byId = new Map<string, TemplateOriginRecord>();
  const walk = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const record = node as TemplateOriginRecord & { id?: unknown };
    if (typeof record.id === "string") byId.set(record.id, record);
    if (Array.isArray(record.children)) record.children.forEach(walk);
  };
  nodes.forEach(walk);
  return byId;
}

/**
 * item template origin 의 root style — `props.style` 위에 fills 파생 배경을 merge.
 * Style 패널 Background 편집은 canonical `fills` 채널에 기록된다 (커밋 시 sanitize 가
 * style.backgroundColor 를 비움). builder Skia projection (row fills → buildSpecNodeData 배경
 * 변환) 과 같은 우선순위. 값이 없으면 null.
 */
export function resolveTemplateOriginRootStyle(
  record: TemplateOriginRecord | undefined,
): Record<string, unknown> | null {
  const props = record?.props as { style?: unknown } | undefined;
  const style = props?.style;
  const styleRecord =
    style && typeof style === "object" && !Array.isArray(style)
      ? (style as Record<string, unknown>)
      : null;
  const legacyPropsFills = (
    record?.metadata as { legacyProps?: { fills?: unknown } } | undefined
  )?.legacyProps?.fills;
  const fills =
    Array.isArray(record?.fills) && record.fills.length > 0
      ? record.fills
      : Array.isArray(legacyPropsFills) && legacyPropsFills.length > 0
        ? legacyPropsFills
        : undefined;
  const fillBackground = fillsToCssBackgroundStyle(fills) as Record<
    string,
    unknown
  >;
  const merged = { ...(styleRecord ?? {}), ...fillBackground };
  return Object.keys(merged).length > 0 ? merged : null;
}

const TAB_ITEM_DEFAULT_ORIGIN_ID = "component-tab-item-default";
const TAB_ITEM_SELECTED_ORIGIN_ID = "component-tab-item-selected";

/**
 * ADR-233 — Tabs 의 Tab 항목 template 해석기 (builder `resolveTabTemplateOriginIds` 와 같은 규칙).
 *
 * - slot 보유자: ref instance 는 master (`_resolvedFrom`) · 문서 Tabs 는 자기 `slot` (round 3 m2 —
 *   문서 전역 1개가 아니라 Tabs 마다).
 * - slot → origin: slot[0] default · 항목 중 `metadata.variant === "selected"` → slot[1] → 표준 상수.
 * - style: Tag chip 과 같은 shared `resolveItemTemplateChipStyle` (두 leg 공용).
 * template 은 (default, selected) origin 쌍마다 한 번 만든다.
 */
export function createTabTemplateResolver(
  byId: ReadonlyMap<string, TemplateOriginRecord>,
): {
  forSlot: (slot: unknown) => TagItemTemplate | null;
  forOwner: (owner: {
    slot?: unknown;
    _resolvedFrom?: string;
  }) => TagItemTemplate | null;
} {
  const cache = new Map<string, TagItemTemplate | null>();
  const compositionOf = (originId: string) => {
    const origin = byId.get(originId);
    return origin ? resolveSlotComposition(origin.children) : null;
  };
  const forSlot = (slot: unknown): TagItemTemplate | null => {
    let defaultOriginId = TAB_ITEM_DEFAULT_ORIGIN_ID;
    let selectedOriginId = TAB_ITEM_SELECTED_ORIGIN_ID;
    if (Array.isArray(slot)) {
      if (typeof slot[0] === "string") defaultOriginId = slot[0];
      const selected =
        slot.find(
          (entry): entry is string =>
            typeof entry === "string" &&
            (byId.get(entry)?.metadata as { variant?: unknown } | undefined)
              ?.variant === "selected",
        ) ?? (typeof slot[1] === "string" ? slot[1] : undefined);
      if (selected) selectedOriginId = selected;
    }
    const cacheKey = `${defaultOriginId}\u0000${selectedOriginId}`;
    const cached = cache.get(cacheKey);
    if (cached !== undefined) return cached;
    let template: TagItemTemplate | null = null;
    if (byId.get(defaultOriginId) || byId.get(selectedOriginId)) {
      const composition = compositionOf(defaultOriginId);
      const selectedComposition = compositionOf(selectedOriginId);
      template = {
        composition,
        selectedComposition,
        rootStyles: {
          base: resolveItemTemplateChipStyle(
            resolveTemplateOriginRootStyle(byId.get(defaultOriginId)),
            composition,
          ),
          selected: resolveItemTemplateChipStyle(
            resolveTemplateOriginRootStyle(byId.get(selectedOriginId)),
            selectedComposition,
          ),
        },
      };
    }
    cache.set(cacheKey, template);
    return template;
  };
  return {
    forSlot,
    forOwner: (owner) =>
      forSlot(
        owner._resolvedFrom ? byId.get(owner._resolvedFrom)?.slot : owner.slot,
      ),
  };
}
