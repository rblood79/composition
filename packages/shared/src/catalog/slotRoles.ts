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

import { resolveToken } from "@composition/specs";

import { COMPONENT_RULES_TABLE } from "./generated/componentRulesTable";

/** slot 이름 공용 vocabulary — additive string union (확장 비용 상수 1줄, ADR-148 R5). */
export const SLOT_ROLES = [
  // P2 collection item (ADR-147 가동분 + Phase 4 MenuItem)
  "icon",
  // ADR-229 Phase 1 — Tag item template 의 좌측 이미지 슬롯 (icon 과 같은 자리를 다툰다 —
  //   소비자는 데이터가 있는 활성 slot 중 avatar > icon 하나만 고른다).
  "avatar",
  "label",
  "description",
  "shortcut",
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

/** slot 자식 1개의 구성 — 존재(키 자체) + optional 여부 + 시각 스타일 + 텍스트. */
export interface SlotChildConfig {
  role: SlotRole;
  /** `metadata.optional: true` — 데이터 없으면 미렌더 (ADR-147 승계 규약). */
  optional?: boolean;
  /** slot 자식 `props.style` — consumer 가 해당 slot 시각에 overlay 한다. */
  style?: Record<string, unknown>;
  /**
   * slot 자식의 텍스트 (`props.text ?? props.children`, string 한정) — ADR-159 P2.
   * `{field}` 템플릿 정본 소스 (`resolveRowTemplateSource` precedence 1순위).
   * 토큰 없는 텍스트는 compile null → 소비자 휴리스틱 fallback (BC — 표시 축 무변).
   */
  text?: string;
}

/** origin(또는 resolved anchor) 자식 구성에서 파생한 slot 구성 — 구성·스타일 축의 SSOT 뷰. */
export interface SlotComposition {
  /** slot 자식의 등장 순서 (같은 시각 영역 안에서 스택 순서를 결정). */
  order: SlotRole[];
  slots: Partial<Record<SlotRole, SlotChildConfig>>;
}

/**
 * slot 자식의 `props.size` 토큰을 catalog `{type}.sizes[size].fontSize` → px 로 해소한다.
 *
 * **Why (2026-07-21 사용자 보고)**: Label/Text slot 자식은 텍스트 크기를 raw `style.fontSize` 이
 * 아니라 `props.size`(size 토큰, catalog `COMPONENT_RULES_TABLE[type].sizes[size].fontSize` 로
 * fontSize 매핑)로 authoring 한다. `resolveSlotComposition` 이 `props.style` 만 추출하면 size
 * 편집이 slot 구성 채널을 못 타 origin(ListBoxItem/Default) label size 변경이 instance 행에
 * 전파되지 않는다 (Skia escape `slots.label.style.fontSize` / DOM emit `slotStyleOf("label")`
 * 둘 다 미반영). px **숫자**로 해소하면 두 consumer 가 동일 소비 (Skia `resolveSpecFontSize`
 * number 분기 / DOM inline `fontSize:number`) — TokenRef 를 실으면 DOM inline 이 무효 CSS.
 * 타이포 토큰은 theme 무관(dark 반전 없음)이라 eager px 해소가 안전하다.
 */
function resolveSlotChildSizeFontSize(child: unknown): number | undefined {
  if (!isRecord(child)) return undefined;
  const type = child.type;
  const props = child.props;
  if (typeof type !== "string" || !isRecord(props)) return undefined;
  const size = props.size;
  if (typeof size !== "string") return undefined;
  const rule =
    COMPONENT_RULES_TABLE[type as keyof typeof COMPONENT_RULES_TABLE];
  const sizes = isRecord(rule) ? rule.sizes : undefined;
  const sizeEntry = isRecord(sizes) ? sizes[size] : undefined;
  const fontSize = isRecord(sizeEntry) ? sizeEntry.fontSize : undefined;
  if (typeof fontSize === "number") return fontSize;
  if (typeof fontSize === "string" && fontSize.startsWith("{")) {
    const resolved = resolveToken(
      fontSize as Parameters<typeof resolveToken>[0],
    );
    if (typeof resolved === "number") return resolved;
  }
  return undefined;
}

/**
 * slot 자식의 `fills` 배열(디자인 채널)에서 대표 단색 배경을 추출한다 — CSS `backgroundColor`
 * 로 fold.
 *
 * **Why (2026-07-21 사용자 보고)**: Text/Label slot 자식의 "배경"은 Style 패널이 raw
 * `style.backgroundColor` 이 아니라 노드 `fills` 배열(`{type:"color", color:"#RRGGBBAA",
 * enabled}`)로 authoring 한다 (origin 은 실 자식이라 scene builder 가 `fills → box.fillColor`
 * 로 렌더). `resolveSlotComposition` 이 `props.style` 만 추출하면 label 배경 편집이 slot
 * 채널을 못 타 instance 행(Skia escape / DOM emit)에 미전파된다 — size 축([[resolveSlotChildSizeFontSize]])
 * 과 동형의 fills 판. `fillsToBackgroundColor`(builder) 와 동일 규약: 마지막 활성 color fill
 * 의 색을 hex6(alpha drop)로. specs ← shared 경계상 builder 헬퍼를 못 써 inline.
 */
function resolveSlotChildFillBackground(child: unknown): string | undefined {
  if (!isRecord(child)) return undefined;
  const fills = child.fills;
  if (!Array.isArray(fills)) return undefined;
  for (let i = fills.length - 1; i >= 0; i--) {
    const fill = fills[i];
    if (!isRecord(fill)) continue;
    if (fill.enabled === false) continue;
    if (fill.type !== "color") continue;
    const color = fill.color;
    if (typeof color === "string" && color.length >= 4) {
      return color.slice(0, 7);
    }
  }
  return undefined;
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
      // ADR-159 P2: slot 자식 텍스트 캡처 — `{field}` 템플릿 소스 (string 한정).
      if (isRecord(props)) {
        const text = props.text ?? props.children;
        if (typeof text === "string" && text.length > 0) {
          config.text = text;
        }
      }
      // props.size 토큰 → fontSize(px) fold (explicit style.fontSize 우선). Label/Text
      //   slot 자식의 size 편집 전파 채널 (resolveSlotChildSizeFontSize 주석 참조).
      const explicitFontSize = isRecord(config.style)
        ? config.style.fontSize
        : undefined;
      if (explicitFontSize == null) {
        const sizeFontSize = resolveSlotChildSizeFontSize(child);
        if (sizeFontSize != null) {
          config.style = { ...(config.style ?? {}), fontSize: sizeFontSize };
        }
      }
      // fills(디자인 배경 채널) → backgroundColor fold (explicit style.backgroundColor 우선).
      //   Label/Text slot 자식의 배경 편집 전파 채널 (resolveSlotChildFillBackground 주석 참조).
      const explicitBg = isRecord(config.style)
        ? config.style.backgroundColor
        : undefined;
      if (explicitBg == null) {
        const fillBg = resolveSlotChildFillBackground(child);
        if (fillBg != null) {
          config.style = { ...(config.style ?? {}), backgroundColor: fillBg };
        }
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

/**
 * ADR-229 Phase 1 — item template origin root style 중 **chip 에 싣지 않는** 저작 조합 layout 키.
 * Tag chip 같은 leaf 행은 origin 이 slot 자식을 가로로 놓으려고 쓴 display/gap/width 를 받으면
 * 안 된다 (leading/label 배치는 rule 몫). 두 leg (builder projection · Preview App) 가 같은 집합을 뺀다.
 */
export const ITEM_TEMPLATE_AUTHORING_LAYOUT_STYLE_KEYS: ReadonlySet<string> =
  new Set([
    "display",
    "flexDirection",
    "flexWrap",
    "alignItems",
    "justifyContent",
    "alignContent",
    "gap",
    "rowGap",
    "columnGap",
    "width",
    "height",
  ]);

/**
 * ADR-229 Phase 1 — origin root style (responsive 해소 뒤) + slot 구성 → leaf chip 에 실을 style.
 *
 * - root style 에서 `ITEM_TEMPLATE_AUTHORING_LAYOUT_STYLE_KEYS` 를 뺀다.
 * - label slot 자식의 typography (`resolveSlotComposition` 이 size/fills 를 fold 한 style) 를 root 위에
 *   얹는다: chip 은 한 줄 텍스트라 label 의 글자 = chip 의 글자 (Skia 는 `buildCatalogShapes` 가
 *   `style.fontSize/fontWeight/fontFamily/color` 를, DOM 은 chip inline style 이 같은 키를 읽는다).
 * 값이 없으면 null — chip 은 rule 값 그대로 (BC).
 */
export function resolveItemTemplateChipStyle(
  rootStyle: Record<string, unknown> | null | undefined,
  composition: SlotComposition | null | undefined,
): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  if (rootStyle) {
    for (const [key, value] of Object.entries(rootStyle)) {
      if (ITEM_TEMPLATE_AUTHORING_LAYOUT_STYLE_KEYS.has(key) || value == null)
        continue;
      out[key] = value;
    }
  }
  const labelStyle = composition?.slots.label?.style;
  if (labelStyle) {
    for (const [key, value] of Object.entries(labelStyle)) {
      if (value == null) continue;
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * ADR-233 Phase 3 — 고정 높이 rule (Tab: 생성 CSS `height: 29px` md) 을 가진 행에 item template 을 얹을 때의
 * 높이 규칙. template style 이 있으면 행은 `height: auto` 로 padding · 글자에 따라 자라되 rule 높이 아래로는
 * 줄지 않는다 (`minHeight`) — 편집 전 (template 비움) 과 기본 padding 에서는 종전 높이 그대로. 두 leg
 * (Skia `appendTabRowProjection` · Preview `renderTabs`) 가 같은 값을 싣는다. rule 높이가 없으면 auto 만.
 */
export function resolveItemTemplateRowBoxStyle(
  ruleType: string,
  sizeName: string | undefined,
): Record<string, unknown> {
  const sizes = (
    COMPONENT_RULES_TABLE as unknown as Record<
      string,
      { defaultSize?: string; sizes?: Record<string, { height?: unknown }> }
    >
  )[ruleType];
  const height = sizes?.sizes?.[sizeName ?? sizes.defaultSize ?? "md"]?.height;
  return typeof height === "number" && height > 0
    ? { height: "auto", minHeight: height }
    : { height: "auto" };
}

/** leading slot 자식 style 의 크기 채널 — icon 은 `fontSize`, avatar 는 `width`/`height` (양수 숫자만). */
export function readLeadingSlotSize(
  style: Record<string, unknown> | undefined,
  role: "icon" | "avatar",
): number | undefined {
  if (!style) return undefined;
  const raw = role === "icon" ? style.fontSize : (style.width ?? style.height);
  return typeof raw === "number" && raw > 0 ? raw : undefined;
}

/**
 * ADR-234 Phase 3 — 정적 목록 항목 (TabList 의 Tab · TagList 의 Tag · ListBox 의 ListBoxItem …) 의 RAC key.
 * `props.id` (RAC `<Tab id>` — TabPanel `itemId` 짝 · Tabs `selectedKey` 가 가리키는 값) 가 정본이고, 없으면
 * 노드 id. 두 leg (Canvas 유효 상태 · layout panel 짝 · Preview `renderTabs`) 가 이 함수 하나를 읽는다.
 */
export function resolveStaticItemKey(
  props: Record<string, unknown> | null | undefined,
  nodeId: string,
): string {
  const id = props?.id;
  return typeof id === "string" && id !== ""
    ? id
    : typeof id === "number"
      ? String(id)
      : nodeId;
}

/**
 * ADR-234 Phase 3 — 정적 목록 가족: owner type → 항목을 담는 목록 틀 type (`null` = owner 자신) · 항목 type.
 * 두 leg 의 ref 해석 (Canvas `resolveCanonicalRefTree` · Preview resolver) 이 바인딩 owner 에서 origin 의
 * 정적 항목을 펼치지 않을 때 읽는다.
 */
export const STATIC_LIST_FAMILY_BY_OWNER: Readonly<
  Record<string, { listType: string | null; itemType: string }>
> = {
  Tabs: { listType: "TabList", itemType: "Tab" },
  TagGroup: { listType: "TagList", itemType: "Tag" },
  ListBox: { listType: null, itemType: "ListBoxItem" },
  GridList: { listType: null, itemType: "GridListItem" },
  Menu: { listType: null, itemType: "MenuItem" },
  // ADR-237 Phase 3 — Breadcrumbs (목록 틀 = owner) · 바인딩 목록은 `items` 행 그대로.
  Breadcrumbs: { listType: null, itemType: "Breadcrumb" },
};

/**
 * 바인딩 목록 owner 인가 — 행은 데이터 + 항목 템플릿 (breakdown §1-3) 이라 origin 의 정적 항목 자식은
 * 그리지 않는다 (그리면 데이터 행과 정적 항목이 함께 보인다).
 */
export function isBoundListOwnerProps(
  props: Record<string, unknown> | null | undefined,
): boolean {
  return props?.dataBinding != null || props?.columnMapping != null;
}
