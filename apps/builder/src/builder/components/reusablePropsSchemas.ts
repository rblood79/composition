import { getPrimitiveBinding, type PropsSchema } from "@composition/shared";

/**
 * Edit contracts of the reusable origins that declare their own props (ADR-148 Phase 2). Pure
 * data: the old origin seeds put them on the origin document's metadata; the catalog Properties
 * panel (ADR-248 Phase 4e-4) reads them by reusable id.
 */

/**
 * IconButton 편집 계약 — 신규 InspectorFieldKind 0 (기존 string/icon/variant/size 재사용).
 * `label`/`icon` 은 템플릿 바인딩 키, `variant`/`size` 는 root props passthrough.
 */
export const ICONBUTTON_PROPS_SCHEMA: PropsSchema = {
  label: {
    kind: "string",
    label: "Label",
    default: "Button",
    section: "content",
  },
  icon: {
    kind: "icon",
    label: "Icon",
    default: "star",
    section: "content",
  },
  variant: {
    kind: "variant",
    label: "Variant",
    default: "primary",
    section: "appearance",
  },
  size: {
    kind: "size",
    label: "Size",
    default: "M",
    section: "appearance",
  },
  // design-data 감사 §2-A (2026-08-21): Button root binding 은 staticColor/isDisabled 를
  //   기수용하나 propsSchema 미노출로 instance 편집 불가하던 결손. 둘 다 variant/size 와
  //   같은 root props passthrough 축 (origin root Button 이 직접 소비 — R2 불변식).
  staticColor: {
    kind: "enum",
    label: "Static Color",
    default: "auto",
    section: "appearance",
    options: [
      { value: "auto", label: "Auto" },
      { value: "white", label: "White" },
      { value: "black", label: "Black" },
    ],
  },
  isDisabled: {
    kind: "boolean",
    label: "Disabled",
    default: false,
    section: "state",
  },
};

/**
 * Card 편집 계약 — 신규 InspectorFieldKind 0 (기존 variant/size 재사용). `variant`/`size` ·
 * `href`/`target` 은 root props passthrough (S2 standalone Card 의 `href` — 링크 Card, 2026-10-09).
 * ADR-256 Phase 10 (사용자 결정 「S2 그대로」): S2 Card 에 title · description prop 이 없다 — 제목 ·
 * 설명은 Content 안 Text 노드의 글자 (캔버스 더블클릭 · Text 선택으로 편집).
 */
export const CARD_PROPS_SCHEMA: PropsSchema = {
  variant: {
    kind: "variant",
    label: "Variant",
    default: "primary",
    section: "appearance",
  },
  size: {
    kind: "size",
    label: "Size",
    default: "M",
    section: "appearance",
  },
  href: getPrimitiveBinding("Card")!.props.accepts!.href!,
  target: getPrimitiveBinding("Card")!.props.accepts!.target!,
};

/**
 * InlineAlert 편집 계약 — 신규 InspectorFieldKind 0 (기존 string/variant 재사용).
 * `title`/`description` 은 템플릿 바인딩 키, `variant` 는 root props passthrough.
 */
export const INLINE_ALERT_PROPS_SCHEMA: PropsSchema = {
  title: {
    kind: "string",
    label: "Title",
    default: "Alert Heading",
    section: "content",
  },
  description: {
    kind: "string",
    label: "Description",
    default: "There was an error processing your request. Please try again.",
    section: "content",
  },
  variant: {
    kind: "variant",
    label: "Variant",
    // S2 1.8.0 (2026-10-10): info → informative.
    default: "informative",
    section: "appearance",
  },
  // S2 1.8.0 fillStyle (2026-10-10): S2 border · subtleFill · boldFill — house 값은
  //   outline · subtle · bold (라벨이 S2 이름, InlineAlert.binding.ts 와 같은 계약).
  fillStyle: {
    kind: "fillStyle",
    label: "Fill Style",
    default: "outline",
    section: "appearance",
    options: [
      { value: "outline", label: "Border" },
      { value: "subtle", label: "Subtle Fill" },
      { value: "bold", label: "Bold Fill" },
    ],
  },
};

/**
 * S2 IllustratedMessage (2026-10-09) — `title` · `description` are the template bindings (Heading ·
 * Description), `size` · `orientation` the root's props (passthrough).
 */
export const ILLUSTRATED_MESSAGE_PROPS_SCHEMA: PropsSchema = {
  title: {
    kind: "string",
    label: "Title",
    default: "No results",
    section: "content",
  },
  description: {
    kind: "string",
    label: "Description",
    default: "Try another search term.",
    section: "content",
  },
  size: {
    kind: "size",
    label: "Size",
    default: "M",
    section: "appearance",
  },
  orientation: {
    kind: "enum",
    label: "Orientation",
    default: "vertical",
    section: "appearance",
    options: [
      { value: "vertical", label: "Vertical" },
      { value: "horizontal", label: "Horizontal" },
    ],
  },
};

/**
 * S2 AvatarGroup (2026-10-09) — `label` is the template binding (the Text after the avatars), the
 * rest the root's props (passthrough — the type's own contract).
 */
export const AVATAR_GROUP_PROPS_SCHEMA: PropsSchema = {
  label: {
    kind: "string",
    label: "Label",
    default: "Team",
    section: "content",
  },
  ...getPrimitiveBinding("AvatarGroup")?.props.accepts,
};

/**
 * ADR-255 — an overlay origin whose root is its trigger (Popover = DialogTrigger > Button +
 * Popover, Tooltip = TooltipTrigger > Button + Tooltip): the instance edits the trigger's props
 * (root passthrough) and the overlay's (template bindings `{placement}` … to the overlay node) —
 * each contract as its type's binding declares it. `size` · `variant` take the overlay rule's
 * steps as choices (the instance's type is the trigger, whose rule has none).
 */
function overlayOriginSchema(
  trigger: string,
  overlay: string,
  keys: readonly string[],
  choices: Readonly<Record<string, readonly string[]>>,
): PropsSchema {
  const accepts = (type: string) =>
    (getPrimitiveBinding(type)?.props.accepts ?? {}) as PropsSchema;
  const own = accepts(overlay);
  return {
    ...Object.fromEntries(
      keys.map((key) => [
        key,
        choices[key]
          ? {
              ...own[key]!,
              kind: "enum" as const,
              options: choices[key]!.map((value) => ({ value, label: value })),
            }
          : own[key]!,
      ]),
    ),
    ...accepts(trigger),
  } as PropsSchema;
}
const OVERLAY_POSITION_KEYS = [
  "placement",
  "offset",
  "crossOffset",
  "shouldFlip",
  "containerPadding",
] as const;
export const POPOVER_PROPS_SCHEMA = overlayOriginSchema(
  "DialogTrigger",
  "Popover",
  ["size", ...OVERLAY_POSITION_KEYS],
  { size: ["S", "M", "L"] },
);
export const TOOLTIP_PROPS_SCHEMA = overlayOriginSchema(
  "TooltipTrigger",
  "Tooltip",
  ["variant", "size", ...OVERLAY_POSITION_KEYS],
  {
    // design-data Tooltip (2026-10-10): neutral · informative · negative — positive 삭제.
    variant: ["neutral", "informative", "negative"],
    size: ["S", "M", "L"],
  },
);

/**
 * ADR-256 후속 4 — the Menu origin (MenuTrigger > Button + Popover > Menu): the instance edits the
 * trigger's props and the Menu's `size` · `selectionMode` (template bindings to the Menu node —
 * `size` also to the Button and the Popover).
 */
export const MENU_PROPS_SCHEMA = overlayOriginSchema(
  "MenuTrigger",
  "Menu",
  ["size", "selectionMode"],
  { size: ["S", "M", "L", "XL"] },
);

/** Reusable id → its declared edit contract. */
export const REUSABLE_PROPS_SCHEMAS: Readonly<Record<string, PropsSchema>> = {
  "component-iconbutton": ICONBUTTON_PROPS_SCHEMA,
  "component-card": CARD_PROPS_SCHEMA,
  "component-inline-alert": INLINE_ALERT_PROPS_SCHEMA,
  "component-illustratedmessage": ILLUSTRATED_MESSAGE_PROPS_SCHEMA,
  "component-avatargroup": AVATAR_GROUP_PROPS_SCHEMA,
  "component-popover": POPOVER_PROPS_SCHEMA,
  "component-tooltip": TOOLTIP_PROPS_SCHEMA,
  "component-menu": MENU_PROPS_SCHEMA,
};
