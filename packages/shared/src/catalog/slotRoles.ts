/**
 * ADR-148 Phase 0 — slotRole 공용 vocabulary + slot 구성(composition) resolver.
 *
 * REUSABLE_SLOT_DESIGN.md §2-1: 컴포넌트별 enum(allow-set)이 아니라 **공용 vocabulary +
 * generic reader** 로 둔다 (ADR-142 no-classification 정합 — 어느 컴포넌트가 어떤 slot 을
 * 갖는지는 origin 문서의 자식 구성이 SSOT, 코드에 컴포넌트별 allow-set 을 두지 않는다).
 *
 * 기원: ADR-147 의 builder-local `LISTBOX_ITEM_SLOT_ROLES`/`getListBoxItemSlotRole`
 * (apps/builder listBoxTemplateOrigins.ts) 를 본 모듈로 re-home + 일반화.
 *
 * **`_slots` 주입 계약 (render-space)**: builder projection(appendListBoxRowProjection)이
 * origin slot 자식에서 `resolveSlotComposition()` 결과를 projected row 의 `props._slots` 로
 * 주입하고, Skia escape(`packages/specs` skiaPrimitives `listbox_item`)와 DOM emit
 * (SelectionRenderers)이 이를 소비해 slot **존재 gating / 스타일 overlay / 스택 순서**를
 * 결정한다. `SlotComposition` 이 그 계약의 정본 타입이다 — specs 는 package boundary
 * (specs ← shared) 로 본 모듈을 import 할 수 없어 동일 shape 를 방어적으로 읽는다
 * (skiaPrimitives.ts `listbox_item` 참조 주석). `_slots` 는 projection 주입 전용이며
 * canonical 문서에 저장하지 않는다.
 */

/** slot 이름 공용 vocabulary — additive string union (확장 비용 상수 1줄, ADR-148 R5). */
export const SLOT_ROLES = [
  // P2 collection item (ADR-147 가동분)
  "icon",
  "label",
  "description",
  // P3 named-region (Card/Dialog 계열)
  "header",
  "content",
  "footer",
  "preview",
  // P3 액션 영역 (DialogFooter/CardFooter 자식)
  "action",
  // P4 value-compound (Meter/ProgressBar)
  "value",
  "track",
  // P5 trigger/panel (Disclosure/Select 계열)
  "trigger",
  "panel",
] as const;

export type SlotRole = (typeof SLOT_ROLES)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * 노드에서 slotRole 판독. canonical 노드는 `metadata.slotRole` 이 정본이고,
 * `props.slot`(RAC slot 이름) 은 fallback — PreviewElement/PanelNode 등 metadata 를
 * 운반하지 않는 파생 뷰에서도 동일 판독이 가능해야 한다 (ADR-147 seed 는 두 축을
 * 같은 값으로 병기: `metadata.slotRole: "label"` + `props.slot: "label"`).
 */
export function getSlotRole(node: unknown): SlotRole | null {
  if (!isRecord(node)) return null;
  const metadata = node.metadata;
  if (isRecord(metadata)) {
    const role = metadata.slotRole;
    if ((SLOT_ROLES as readonly string[]).includes(role as string)) {
      return role as SlotRole;
    }
  }
  const props = node.props;
  if (isRecord(props)) {
    const slot = props.slot;
    if ((SLOT_ROLES as readonly string[]).includes(slot as string)) {
      return slot as SlotRole;
    }
  }
  return null;
}

/** slot 자식 1개의 구성 — 존재(키 자체) + optional 여부 + 시각 스타일. */
export interface SlotChildConfig {
  role: SlotRole;
  /** `metadata.optional: true` — 데이터 없으면 미렌더 (ADR-147 승계 규약). */
  optional?: boolean;
  /** slot 자식 `props.style` — consumer 가 해당 slot 시각에 overlay 한다. */
  style?: Record<string, unknown>;
}

/** origin(또는 resolved anchor) 자식 구성에서 파생한 slot 구성 — 구성·스타일 축의 SSOT 뷰. */
export interface SlotComposition {
  /** slot 자식의 등장 순서 (같은 시각 영역 안에서 스택 순서를 결정). */
  order: SlotRole[];
  slots: Partial<Record<SlotRole, SlotChildConfig>>;
}

/**
 * 자식 배열에서 slot 구성을 추출한다. slot 자식이 하나도 없으면 **null** — consumer 는
 * 이를 "구성 정보 없음(legacy/비배선 문서)" 신호로 받아 기존 flat-props 동작으로
 * fallback 한다 (BC). 같은 role 중복 시 첫 자식이 이긴다.
 */
export function resolveSlotComposition(
  children: readonly unknown[] | null | undefined,
): SlotComposition | null {
  if (!children || children.length === 0) return null;

  const order: SlotRole[] = [];
  const slots: Partial<Record<SlotRole, SlotChildConfig>> = {};

  for (const child of children) {
    const role = getSlotRole(child);
    if (!role || slots[role]) continue;

    const config: SlotChildConfig = { role };
    if (isRecord(child)) {
      const metadata = child.metadata;
      if (isRecord(metadata) && metadata.optional === true) {
        config.optional = true;
      }
      const props = child.props;
      if (isRecord(props) && isRecord(props.style)) {
        config.style = props.style as Record<string, unknown>;
      }
    }
    order.push(role);
    slots[role] = config;
  }

  return order.length > 0 ? { order, slots } : null;
}

/**
 * consumer 공통 gating — 구성 정보가 있으면 해당 slot 자식의 존재 여부, 없으면(null)
 * legacy fallback 으로 항상 true. "origin 에서 slot 자식을 지우면 그 slot 이 사라진다"
 * (구성 SSOT = origin 문서의 자식 구성, ADR-148 Decision 3).
 */
export function isSlotEnabled(
  composition: SlotComposition | null | undefined,
  role: SlotRole,
): boolean {
  if (!composition) return true;
  return composition.slots[role] != null;
}

/**
 * projection 이 주입한 `props._slots` 값(unknown)의 방어적 판독 — layout 등 props 경유
 * consumer 용. shape 이 어긋나면 null (legacy 동작 fallback). specs 의 `listbox_item`
 * escape 는 package boundary 로 본 helper 를 import 하지 못해 동일 판독을 자체 보유한다.
 */
export function readSlotComposition(raw: unknown): SlotComposition | null {
  if (!isRecord(raw)) return null;
  const slots = raw.slots;
  if (!isRecord(slots)) return null;
  const order = Array.isArray(raw.order)
    ? raw.order.filter((role): role is SlotRole =>
        (SLOT_ROLES as readonly string[]).includes(role as string),
      )
    : [];
  return { order, slots: slots as SlotComposition["slots"] };
}
