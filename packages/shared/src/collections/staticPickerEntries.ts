/**
 * ADR-238 Phase 3 — Select · ComboBox 의 **정적 항목** (owner 자식 = ListBoxItem instance · ListBoxSection) 을 `items`
 * 행과 같은 모양으로 읽는다. 두 leg 가 같이 읽는다:
 * - Preview: `renderSelect` · `renderComboBox` 가 popover ListBox 를 합성하고 선택 writeback (`selectedValue` = 항목
 *   `props.value`) · ComboBox 입력 일치 (label) 를 이 행으로 한다.
 * - Canvas: scene 이 owner 에 `_staticItems` (평면 행) 를 실어 `resolveSelectDisplayValue` 가 선택 항목 글자를 찾는다.
 *
 * 행 key = `resolveSectionItemKey` (section instance 안 항목은 section key 접두 — 두 leg 같은 함수). 글자 = label 역할
 * 자식 (없으면 항목 `children`). 검색어 `textValue` = 항목의 **명시** 값 (origin 템플릿 `{label}` 은 명시 아님), 없으면 글자.
 */
import { getSlotRole, resolveSectionItemKey } from "../catalog/slotRoles";
import { resolveTextSourceText } from "@composition/specs";

export interface StaticPickerNode {
  id: string;
  type: string;
  props?: Record<string, unknown> | null;
  /** ref instance 해석 노드면 ref 대상 (Preview `_resolvedFrom` · Canvas `ref`). */
  _resolvedFrom?: string;
  ref?: unknown;
}

export interface StaticPickerRow {
  id: string;
  label: string;
  value?: unknown;
  textValue: string;
  description: string | null;
  icon: string | null;
  isDisabled: boolean;
  /** 항목 노드 id (DOM `data-element-id`) */
  nodeId: string;
}

export interface StaticPickerSection {
  type: "section";
  id: string;
  header: string;
  ariaLabel?: string;
  items: StaticPickerRow[];
  nodeId: string;
}

export type StaticPickerEntry = StaticPickerRow | StaticPickerSection;

const TEMPLATE_TOKEN = /^\{[^{}]+\}$/;

function explicitString(value: unknown): string | undefined {
  return typeof value === "string" &&
    value !== "" &&
    !TEMPLATE_TOKEN.test(value)
    ? value
    : undefined;
}

function toRow<T extends StaticPickerNode>(
  item: T,
  childrenOf: (id: string) => readonly T[],
  section: T | null,
): StaticPickerRow {
  const props = (item.props ?? {}) as Record<string, unknown>;
  const parts = childrenOf(item.id);
  const part = (role: string) => parts.find((p) => getSlotRole(p) === role);
  const textOf = (role: string): string | undefined => {
    const node = part(role);
    const text = node
      ? resolveTextSourceText(node.type, node.props ?? {})
      : undefined;
    return typeof text === "string" ? text : undefined;
  };
  const label =
    textOf("label") ??
    explicitString(resolveTextSourceText("ListBoxItem", props)) ??
    "";
  const iconName = part("icon")?.props?.iconName;
  const sectionRef = section?._resolvedFrom ?? section?.ref;
  return {
    id: resolveSectionItemKey(
      props,
      item.id,
      section
        ? {
            id: section.id,
            props: section.props,
            ref: typeof sectionRef === "string" ? sectionRef : undefined,
          }
        : null,
    ),
    label,
    ...(props.value !== undefined ? { value: props.value } : {}),
    textValue: explicitString(props.textValue) ?? label,
    description: textOf("description") ?? null,
    icon:
      typeof iconName === "string" && !TEMPLATE_TOKEN.test(iconName)
        ? iconName
        : null,
    isDisabled: props.isDisabled === true,
    nodeId: item.id,
  };
}

/**
 * owner 자식에서 정적 항목 · section 을 읽는다. 항목 · section 이 하나도 없으면 null (items 경로 · 바인딩 경로 그대로).
 */
export function readStaticPickerEntries<T extends StaticPickerNode>(
  children: readonly T[],
  childrenOf: (id: string) => readonly T[],
): StaticPickerEntry[] | null {
  const entries: StaticPickerEntry[] = [];
  for (const child of children) {
    if (child.type === "ListBoxItem") {
      entries.push(toRow(child, childrenOf, null));
    } else if (child.type === "ListBoxSection") {
      const kids = childrenOf(child.id);
      const header = kids.find((kid) => kid.type === "Header");
      const headerText = header
        ? resolveTextSourceText(header.type, header.props ?? {})
        : undefined;
      const sectionProps = (child.props ?? {}) as Record<string, unknown>;
      entries.push({
        type: "section",
        id: String(sectionProps.id ?? child.id),
        header: typeof headerText === "string" ? headerText : "",
        ...(typeof sectionProps["aria-label"] === "string"
          ? { ariaLabel: sectionProps["aria-label"] as string }
          : {}),
        items: kids
          .filter((kid) => kid.type === "ListBoxItem")
          .map((kid) => toRow(kid, childrenOf, child)),
        nodeId: child.id,
      });
    }
  }
  return entries.length > 0 ? entries : null;
}

/** section 을 펼친 평면 행 (선택 조회 · 표시 글자). */
export function flattenStaticPickerEntries(
  entries: readonly StaticPickerEntry[] | null | undefined,
): StaticPickerRow[] {
  if (!entries) return [];
  return entries.flatMap((entry): StaticPickerRow[] =>
    "type" in entry && entry.type === "section"
      ? entry.items
      : [entry as StaticPickerRow],
  );
}
