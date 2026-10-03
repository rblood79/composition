import type { PropsSchema } from "@composition/shared";

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
    default: "md",
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
 * Card 편집 계약 — 신규 InspectorFieldKind 0 (기존 string/variant/size 재사용).
 * `title`/`description` 은 템플릿 바인딩 키, `variant`/`size` 는 root props passthrough.
 */
export const CARD_PROPS_SCHEMA: PropsSchema = {
  title: {
    kind: "string",
    label: "Title",
    default: "Card Title",
    section: "content",
  },
  description: {
    kind: "string",
    label: "Description",
    default: "Card description text goes here.",
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
    default: "md",
    section: "appearance",
  },
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
    default: "info",
    section: "appearance",
  },
};

/** Reusable id → its declared edit contract. */
export const REUSABLE_PROPS_SCHEMAS: Readonly<Record<string, PropsSchema>> = {
  "component-iconbutton": ICONBUTTON_PROPS_SCHEMA,
  "component-card": CARD_PROPS_SCHEMA,
  "component-inline-alert": INLINE_ALERT_PROPS_SCHEMA,
};
