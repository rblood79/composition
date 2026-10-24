import { getPrimitiveBinding, type PropsSchema } from "@composition/shared";

/**
 * Edit contracts of the reusable origins that declare their own props (ADR-148 Phase 2). Pure
 * data: the old origin seeds put them on the origin document's metadata; the catalog Properties
 * panel (ADR-248 Phase 4e-4) reads them by reusable id.
 */

/**
 * ADR-276 — Button 편집 계약: 팔레트 Button origin 은 `Button > Icon{icon} + Text{label}` (옛
 * IconButton template) 이라 `label` · `icon` 은 템플릿 바인딩 키 (`icon` 은 기본값 없음 — 비우면
 * 채워지지 않은 `{icon}` 글리프가 숨는다, `label` 을 비우면 Text 자리가 없다), 나머지는 root Button
 * 의 binding 계약 그대로 (root props passthrough — `children` 은 없다: 글자는 Text 자식).
 */
const buttonRootAccepts = (type: string): PropsSchema => {
  const { children: _children, ...accepts } = (getPrimitiveBinding(type)?.props
    .accepts ?? {}) as PropsSchema & { children?: unknown };
  return accepts;
};
export const BUTTON_PROPS_SCHEMA: PropsSchema = {
  label: {
    kind: "string",
    label: "Label",
    default: "Button",
    section: "content",
  },
  icon: {
    kind: "icon",
    label: "Icon",
    section: "content",
  },
  ...buttonRootAccepts("Button"),
};
/** ADR-276 — ToggleButton 편집 계약: Button 과 같은 꼴 (root 는 ToggleButton binding). */
export const TOGGLEBUTTON_PROPS_SCHEMA: PropsSchema = {
  label: {
    kind: "string",
    label: "Label",
    default: "Toggle",
    section: "content",
  },
  icon: {
    kind: "icon",
    label: "Icon",
    section: "content",
  },
  ...buttonRootAccepts("ToggleButton"),
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
  // S2 1.8.0 fillStyle: S2 값 이름 그대로 border · subtleFill · boldFill (2026-10-13,
  //   InlineAlert.binding.ts 와 같은 계약).
  fillStyle: {
    kind: "fillStyle",
    label: "Fill Style",
    default: "border",
    section: "appearance",
    options: [
      { value: "border", label: "Border" },
      { value: "subtleFill", label: "Subtle Fill" },
      { value: "boldFill", label: "Bold Fill" },
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
  "component-button": BUTTON_PROPS_SCHEMA,
  "component-togglebutton": TOGGLEBUTTON_PROPS_SCHEMA,
  "component-card": CARD_PROPS_SCHEMA,
  "component-inline-alert": INLINE_ALERT_PROPS_SCHEMA,
  "component-illustratedmessage": ILLUSTRATED_MESSAGE_PROPS_SCHEMA,
  "component-avatargroup": AVATAR_GROUP_PROPS_SCHEMA,
  "component-popover": POPOVER_PROPS_SCHEMA,
  "component-tooltip": TOOLTIP_PROPS_SCHEMA,
  "component-menu": MENU_PROPS_SCHEMA,
};
