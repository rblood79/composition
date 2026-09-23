/**
 * ADR-234 Phase 3c — 목록 항목 (Tab · Tag) 안 label Text 는 항목의 글자 (크기 · 굵기 · 상태별 색) 를 상속한다.
 * 3d — ListBoxItem 의 description slot 은 항목 CSS 의 slot 규칙 값.
 *
 * DOM: `.react-aria-Text` 가 자기 font-size · color 를 선언하므로 상속이 끊긴다 — 수동 CSS
 *   (`TabsIndicator.css` · `TagGroup.css`) 의 `.react-aria-Tab/Tag .react-aria-Text { … inherit }` 가 되살린다
 *   (Button 의 `.button-base > * { color: inherit }` 선례).
 * Canvas: 이 resolver 가 같은 값을 label 에 주입한다 — Skia (`buildSpecNodeData`) 와 layout (`fullTreeLayout`,
 *   글자 크기 = 측정 폭) 이 같이 읽는다. label 자기 style 에 값이 있으면 그것이 이긴다 (DOM 인라인 = 작성자 값).
 *
 * 값은 이관 전 목록 행 (projection · DOM 행) 이 쓰던 항목 rule 그대로 — Tab: size 글자 · 500 · muted / 선택 시
 *   `--fg` (`TabsIndicator.css`) · Tag: size 글자 · textWeight · chip 변형 글자색.
 */
import { resolveToken } from "@composition/specs";

import {
  resolveSkiaRule,
  resolveSkiaVisualRule,
} from "./resolveSkiaVisualRule";

/** `:root { line-height: 1.5 }` — 항목 rule 에 줄 높이가 없을 때 DOM 이 상속하는 값. */
const ROOT_LINE_HEIGHT_RATIO = 1.5;

/** 항목 type → 크기를 물려주는 owner type (항목에 size 가 없을 때). */
const ITEM_LABEL_OWNERS: Readonly<Record<string, string>> = {
  Tab: "Tabs",
  Tag: "TagGroup",
};

type NodeLike = {
  type: string;
  props?: Record<string, unknown> | null;
  parent_id?: string | null;
};

function propsOf(node: NodeLike | undefined): Record<string, unknown> {
  return (node?.props ?? {}) as Record<string, unknown>;
}

function toPx(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.startsWith("{")) {
    const resolved = resolveToken(value as Parameters<typeof resolveToken>[0]);
    return typeof resolved === "number" ? resolved : undefined;
  }
  return undefined;
}

export interface ItemLabelTypography {
  fontSize?: number;
  fontWeight?: number;
  /** `"<px>px"` — layout 은 숫자를 배율로, Skia 는 px 로 읽어 px 문자열로 싣는다. */
  lineHeight?: string;
  /** TokenRef (`{color.*}`) — 소비처가 theme 별로 해석 (Button 자식 색 상속과 같은 형태). */
  color?: string;
}

/**
 * `element` 가 항목 (Tab · Tag) 의 직계 Text 면 항목 글자, 아니면 null.
 */
export function resolveItemLabelTypography<T extends NodeLike>(
  element: T,
  elementsMap: ReadonlyMap<string, T>,
): ItemLabelTypography | null {
  if (!element.parent_id) return null;
  const item = elementsMap.get(element.parent_id);
  if (!item) return null;
  if (item.type === "ListBoxItem") {
    return resolveListBoxItemSlotTypography(element);
  }
  // 3e — GridList 카드 `[slot="description"] { color: var(--fg-muted) }` (크기는 Text 기본 그대로).
  if (item.type === "GridListItem") {
    return element.type === "Text" && propsOf(element).slot === "description"
      ? { color: "{color.neutral-subdued}" }
      : null;
  }
  if (element.type !== "Text") return null;
  const ownerType = ITEM_LABEL_OWNERS[item.type];
  if (!ownerType) return null;
  const rule = resolveSkiaRule(item.type);
  if (!rule) return null;

  const itemProps = propsOf(item);
  let size = typeof itemProps.size === "string" ? itemProps.size : undefined;
  if (!size) {
    // 항목 → 목록 틀 → owner (3단계 안).
    let cursor: NodeLike | undefined = item;
    for (let depth = 0; depth < 3 && cursor?.parent_id; depth += 1) {
      cursor = elementsMap.get(cursor.parent_id);
      if (cursor?.type === ownerType) {
        const ownerSize = propsOf(cursor).size;
        if (typeof ownerSize === "string") size = ownerSize;
        break;
      }
    }
  }
  const sizeSpec = (rule.sizes[size ?? rule.defaultSize ?? "md"] ??
    rule.sizes[rule.defaultSize ?? "md"]) as
    Record<string, unknown> | undefined;

  const selected =
    itemProps._isSelected === true || itemProps.isSelected === true;
  let color: string | undefined;
  if (item.type === "Tab") {
    // 선택 Tab 글자색 = `--fg` (TabsIndicator.css `.react-aria-Tab[data-selected]`), 아니면 rule text.
    color = selected
      ? "{color.neutral}"
      : (resolveSkiaVisualRule("Tab", undefined)?.text as string | undefined);
  } else {
    // Tag: Canvas chip 이 실제로 그리는 변형 (`variant` prop) 의 글자색. rule 의 `selected` 변형 (accent 배경 ·
    //   on-accent 글자) 은 Canvas 가 고르지 않는다 (DOM `TagGroup.css [data-selected]` 와의 기존 비대칭 —
    //   글자만 on-accent 로 바꾸면 흰 배경 위 흰 글자가 된다).
    const visual = resolveSkiaVisualRule(
      item.type,
      typeof itemProps.variant === "string" ? itemProps.variant : undefined,
    );
    color = visual?.text as string | undefined;
  }
  const variantWeight = (
    rule.variants[rule.defaultVariant ?? "default"] as
      { textWeight?: unknown } | undefined
  )?.textWeight;

  const fontSize = toPx(sizeSpec?.fontSize);
  // 줄 높이: 항목 rule 에 있으면 그것 (Tag — `.react-aria-Tag { line-height: var(--text-*--line-height) }`),
  //   없으면 DOM 이 상속하는 root 비율 1.5 (Tab — `:root { line-height: 1.5 }`).
  const lineHeightPx =
    toPx(sizeSpec?.lineHeight) ??
    (fontSize != null ? fontSize * ROOT_LINE_HEIGHT_RATIO : undefined);
  return {
    fontSize,
    lineHeight: lineHeightPx != null ? `${lineHeightPx}px` : undefined,
    fontWeight:
      typeof sizeSpec?.fontWeight === "number"
        ? sizeSpec.fontWeight
        : typeof variantWeight === "number"
          ? variantWeight
          : undefined,
    color,
  };
}

/** ListBox `[slot="description"]` 글자 크기 (`--text-xs`) · 줄 높이 (`--text-xs--line-height` = 4/3 배). */
const LISTBOX_DESCRIPTION_FONT_SIZE = 12;
const LISTBOX_ICON_SIZE = 16;

/**
 * ListBoxItem 의 slot 자식 (ADR-234 Phase 3d — 정적 항목 · Components 페이지 origin): DOM 은 항목 CSS
 * (`ListBox.css` `[slot="description"] { font-size: var(--text-xs); line-height: var(--text-xs--line-height);
 * color: var(--fg-muted) }`) 로 그린다. label 은 굵기만 다르고 (scene 이 catalog textWeight 를 주입) 크기는
 * Text 기본 그대로라 여기서는 description 만. 값은 Skia `listbox_item` escape (projection 행) 와 같다.
 */
function resolveListBoxItemSlotTypography(
  element: NodeLike,
): ItemLabelTypography | null {
  const slot = propsOf(element).slot;
  // `[slot="icon"]` 상자 = `--lb-icon-size` (기본 16) — glyph 도 그 크기 (이관 전 행의 `<Icon fontSize 16>`).
  if (element.type === "Icon" && slot === "icon") {
    return { fontSize: LISTBOX_ICON_SIZE };
  }
  if (element.type !== "Text" || slot !== "description") return null;
  return {
    fontSize: LISTBOX_DESCRIPTION_FONT_SIZE,
    lineHeight: `${Math.ceil((LISTBOX_DESCRIPTION_FONT_SIZE * 4) / 3)}px`,
    color: "{color.neutral-subdued}",
  };
}

/** label style 에 없는 키만 채운다 (작성자 값 우선). */
export function applyItemLabelTypography(
  style: Record<string, unknown> | undefined,
  typography: ItemLabelTypography,
): Record<string, unknown> {
  const next = { ...(style ?? {}) };
  if (next.fontSize == null && typography.fontSize != null)
    next.fontSize = typography.fontSize;
  if (next.fontWeight == null && typography.fontWeight != null)
    next.fontWeight = typography.fontWeight;
  if (next.color == null && typography.color != null)
    next.color = typography.color;
  if (next.lineHeight == null && typography.lineHeight != null)
    next.lineHeight = typography.lineHeight;
  return next;
}
