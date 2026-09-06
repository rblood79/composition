import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { ensureTemplateOrigins } from "../ensureTemplateOrigins";

export const LISTBOX_ITEM_DEFAULT_ORIGIN_ID = "component-listbox-item-default";
export const LISTBOX_ITEM_SELECTED_ORIGIN_ID =
  "component-listbox-item-selected";
export const LISTBOX_ORIGIN_ID = "component-listbox";
export const LISTBOX_TEMPLATE_ANCHOR_ROLE = "listbox-item-template-anchor";

// ADR-148 Phase 0: 구 builder-local `LISTBOX_ITEM_SLOT_ROLES`/`getListBoxItemSlotRole` 은
//   shared 공용 vocabulary 로 re-home 됐다 — `@composition/shared` 의 `SLOT_ROLES`/
//   `getSlotRole`/`resolveSlotComposition` 사용 (설계도 §2-1: 컴포넌트별 allow-set 을
//   코드에 두지 않는다. 어느 slot 을 갖는지는 아래 origin seed 의 자식 구성이 SSOT).
//   SelectionIndicator 는 선택 상태 기반 동적 렌더(Skia 체크마크 / DOM Check)라 조합
//   자식 노드가 아니라 render-time concern (ADR-147 판정 승계).

/**
 * ADR-147: ListBoxItem reusable origin 의 조합 자식(Icon / Text(label) / Text(description)).
 *
 * 템플릿 바인딩 `{icon}`/`{label}`/`{description}` 은 row projection(columnMapping/dataBinding)
 * 또는 static item 이 채운다. origin flat props(`children`/`textValue`/`description`)는 BC 및
 * render.shapes/row projection 데이터 경로 유지를 위해 보존한다(자식은 authoring 구조 + slot 스타일 SSOT).
 */
function listBoxItemSlotChildren(originId: string): CanonicalNode[] {
  return [
    {
      id: `${originId}__icon`,
      type: "Icon",
      name: "Icon",
      props: { slot: "icon", iconName: "{icon}" },
      metadata: {
        type: "listbox-item-slot",
        systemOwned: true,
        slotRole: "icon",
        optional: true,
      },
    },
    {
      id: `${originId}__label`,
      type: "Text",
      name: "Label",
      props: { slot: "label", children: "{label}" },
      metadata: {
        type: "listbox-item-slot",
        systemOwned: true,
        slotRole: "label",
      },
    },
    {
      id: `${originId}__description`,
      type: "Text",
      name: "Description",
      props: { slot: "description", children: "{description}" },
      metadata: {
        type: "listbox-item-slot",
        systemOwned: true,
        slotRole: "description",
        optional: true,
      },
    },
  ];
}

const LISTBOX_SYSTEM_ORIGIN_IDS = new Set([
  LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
  LISTBOX_ITEM_SELECTED_ORIGIN_ID,
  LISTBOX_ORIGIN_ID,
]);

type ListBoxAuthoringInput = {
  children?: Array<{ id?: unknown; type?: unknown; ref?: unknown }>;
  dataBinding?: unknown;
  props?: Record<string, unknown>;
};

export type ListBoxAuthoringMode =
  | { mode: "data-bound"; rowDataSource: "dataBinding" | "items" }
  | { mode: "static"; rowDataSource: "static-children" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasDataBinding(value: unknown): boolean {
  return value !== null && value !== undefined;
}

function hasNonEmptyItems(props: Record<string, unknown> | undefined): boolean {
  return Array.isArray(props?.items) && props.items.length > 0;
}

function hasStaticListBoxItemRefChildren(
  children: ListBoxAuthoringInput["children"],
): boolean {
  return Boolean(
    children?.some(
      (child) =>
        child.type === "ListBoxItem" ||
        child.ref === LISTBOX_ITEM_DEFAULT_ORIGIN_ID ||
        child.ref === LISTBOX_ITEM_SELECTED_ORIGIN_ID,
    ),
  );
}

export function detectListBoxAuthoringMode(
  input: ListBoxAuthoringInput,
): ListBoxAuthoringMode {
  if (hasDataBinding(input.dataBinding)) {
    return { mode: "data-bound", rowDataSource: "dataBinding" };
  }
  if (hasNonEmptyItems(input.props)) {
    return { mode: "data-bound", rowDataSource: "items" };
  }
  if (hasStaticListBoxItemRefChildren(input.children)) {
    return { mode: "static", rowDataSource: "static-children" };
  }
  return { mode: "static", rowDataSource: "static-children" };
}

export function isListBoxTemplateAnchor(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const metadata = value.metadata;
  if (!isRecord(metadata)) return false;
  return metadata.templateRole === LISTBOX_TEMPLATE_ANCHOR_ROLE;
}

function createListBoxItemDefaultOrigin(): CanonicalNode {
  return {
    id: LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
    type: "ListBoxItem",
    name: "ListBoxItem/Default",
    reusable: true,
    props: {
      children: "{label}",
      textValue: "{label}",
      description: "{description}",
    },
    // ADR-147: label/description/icon slot 조합 자식. flat props 와 병존(데이터 경로 BC).
    children: listBoxItemSlotChildren(LISTBOX_ITEM_DEFAULT_ORIGIN_ID),
    metadata: {
      type: "listbox-template-origin",
      systemOwned: true,
      componentFamily: "ListBox",
      variant: "default",
    },
  };
}

function createListBoxItemSelectedOrigin(): CanonicalNode {
  return {
    id: LISTBOX_ITEM_SELECTED_ORIGIN_ID,
    type: "ListBoxItem",
    name: "ListBoxItem/Selected",
    reusable: true,
    props: {
      children: "{label}",
      textValue: "{label}",
      description: "{description}",
      // 시맨틱 정본 변수 (css-tokens.md: {color.accent-subtle} ↔ --accent-subtle).
      //   구 seed 의 `--color-accent-subtle` 은 정의부 0건인 죽은 변수였다 (2026-07-20 정정).
      style: {
        backgroundColor: "var(--accent-subtle)",
      },
    },
    // ADR-147: selected variant 도 동일 slot 조합 자식. 차이는 origin props.style(배경).
    children: listBoxItemSlotChildren(LISTBOX_ITEM_SELECTED_ORIGIN_ID),
    metadata: {
      type: "listbox-template-origin",
      systemOwned: true,
      componentFamily: "ListBox",
      variant: "selected",
    },
  };
}

/**
 * ListBox origin 의 **기본 행 데이터**.
 *
 * 행 템플릿(`component-listbox-item-*`)은 `{icon}`/`{label}`/`{description}` 을 보간하므로
 * items 가 비면 보간할 대상이 없어 **컬렉션이 통째로 빈 채로 남는다** — 컴포넌트 라이브러리
 * 마스터가 자기 모습을 못 보여준다. 그래서 시드가 대표 행 3개를 기본값으로 싣는다.
 *
 * 내용은 특정 도메인에 매이지 않는 중립 예시다 (아이콘은 lucide 이름). 사용자가 items 를
 * 편집하면 `repairOrigin` 이 기존 props 를 보존하므로 **이 기본값이 덮어쓰지 않는다** —
 * 기존 문서도 그대로 유지된다.
 */
const LISTBOX_DEFAULT_ITEMS: ReadonlyArray<Record<string, string>> = [
  {
    id: "inbox",
    icon: "inbox",
    label: "Inbox",
    description: "Unread messages",
  },
  {
    id: "starred",
    icon: "star",
    label: "Starred",
    description: "Marked as important",
  },
  {
    id: "archive",
    icon: "archive",
    label: "Archive",
    description: "Stored for later",
  },
];

function createListBoxOrigin(): CanonicalNode {
  return {
    id: LISTBOX_ORIGIN_ID,
    type: "ListBox",
    name: "ListBox",
    reusable: true,
    props: {
      orientation: "vertical",
      selectionMode: "single",
      items: [...LISTBOX_DEFAULT_ITEMS],
    },
    slot: [LISTBOX_ITEM_DEFAULT_ORIGIN_ID, LISTBOX_ITEM_SELECTED_ORIGIN_ID],
    metadata: {
      type: "listbox-origin",
      systemOwned: true,
      componentFamily: "ListBox",
    },
  };
}

/** 구 seed 의 죽은 변수 리터럴 (정의부 0건) — repair 시 정본 변수로 한정 교체. */
const LEGACY_SELECTED_BG = "var(--color-accent-subtle)";

function repairLegacyDeadVarProps(
  props: CanonicalNode["props"],
): CanonicalNode["props"] {
  const style = (props as Record<string, unknown> | undefined)?.style as
    Record<string, unknown> | undefined;
  if (style?.backgroundColor !== LEGACY_SELECTED_BG) return props;
  // 사용자 편집값이 아닌 구 seed 리터럴만 교체 (사용자 값 보존 원칙 유지).
  return {
    ...props,
    style: { ...style, backgroundColor: "var(--accent-subtle)" },
  };
}

function repairOrigin(
  existing: CanonicalNode | undefined,
  createNode: () => CanonicalNode,
): CanonicalNode {
  const base = createNode();
  if (!existing) return base;
  return {
    ...base,
    props: repairLegacyDeadVarProps(existing.props ?? base.props),
    children: existing.children ?? base.children,
    // ADR-154: 사용자 responsive override 보존 (composite origin reseed 소실 방지)
    ...(existing.responsive ? { responsive: existing.responsive } : {}),
    metadata: {
      ...base.metadata,
      ...(existing.metadata ?? {}),
      type: existing.metadata?.type ?? base.metadata?.type ?? "listbox-origin",
      systemOwned: true,
      componentFamily: "ListBox",
    },
  };
}

export function ensureListBoxTemplateOrigins(
  document: CompositionDocument,
): CompositionDocument {
  return ensureTemplateOrigins(
    document,
    LISTBOX_SYSTEM_ORIGIN_IDS,
    (existingOrigins) => [
      repairOrigin(
        existingOrigins.get(LISTBOX_ITEM_DEFAULT_ORIGIN_ID),
        createListBoxItemDefaultOrigin,
      ),
      repairOrigin(
        existingOrigins.get(LISTBOX_ITEM_SELECTED_ORIGIN_ID),
        createListBoxItemSelectedOrigin,
      ),
      repairOrigin(existingOrigins.get(LISTBOX_ORIGIN_ID), createListBoxOrigin),
    ],
  );
}
