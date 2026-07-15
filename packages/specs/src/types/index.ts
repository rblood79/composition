/**
 * Types - Public API
 *
 * @packageDocumentation
 */

// Spec Types
export type {
  ArchetypeId,
  ComponentSpec,
  ComponentState,
  ContainerStylesSchema,
  VariantSpec,
  // ADR-908 Phase 1: Fill Spec Schema SSOT (타입만 도입)
  FillStateTokens,
  FillTokenSpec,
  SizeSpec,
  IndicatorSpec,
  RenderSpec,
  SpecRenderContext,
  CompositionSpec,
  ContainerVariantStyles,
  DelegationSpec,
  PropertySchema,
  SectionDef,
  FieldDef,
  BaseFieldDef,
  VisibilityCondition,
  VariantField,
  SizeField,
  BooleanField,
  EnumField,
  StringField,
  NumberField,
  IconField,
  CustomField,
  ChildrenManagerField,
  ItemsManagerField,
  ItemsManagerFieldItemSchema,
  DerivedUpdateFn,
  CustomFieldComponentProps,
  PropagationRule,
  PropagationSpec,
  IndicatorModeSpec,
} from "./spec.types";

// Shape Types
export type {
  Shape,
  ShapeBase,
  RectShape,
  RoundRectShape,
  CircleShape,
  ArcShape,
  TextShape,
  ShadowShape,
  BorderShape,
  BorderStyleValue,
  ContainerShape,
  ContainerLayout,
  GradientShape,
  ImageShape,
  LineShape,
  IconFontShape,
  ColorValue,
} from "./shape.types";

// Token Types
export type {
  TokenRef,
  ColorTokenRef,
  SpacingTokenRef,
  TypographyTokenRef,
  RadiusTokenRef,
  ShadowTokenRef,
  StrictTokenRef,
  TokenCategories,
  ColorTokens,
  SpacingTokens,
  TypographyTokens,
  RadiusTokens,
  ShadowTokens,
} from "./token.types";

export { isValidTokenRef } from "./token.types";

// State Types
export type { StateStyles, StateEffect } from "./state.types";

// Menu Items Types (ADR-068 + ADR-099 Phase 5 Section/Separator union)
export type {
  StoredMenuItem,
  StoredMenuSection,
  StoredMenuSeparator,
  StoredMenuEntry,
  RuntimeMenuItem,
} from "./menu-items";
export { isMenuSectionEntry, isMenuSeparatorEntry } from "./menu-items";

// Select Items Types (ADR-073)
export type { StoredSelectItem, RuntimeSelectItem } from "./select-items";
export { toRuntimeSelectItem } from "./select-items";

// ComboBox Items Types (ADR-073)
export type { StoredComboBoxItem, RuntimeComboBoxItem } from "./combobox-items";
export { toRuntimeComboBoxItem } from "./combobox-items";

// ListBox Items Types (ADR-076 + ADR-099 Phase 1 Section union)
export type {
  StoredListBoxItem,
  StoredListBoxSection,
  StoredListBoxEntry,
  RuntimeListBoxItem,
} from "./listbox-items";
export { toRuntimeListBoxItem, isListBoxSectionEntry } from "./listbox-items";

// TagGroup Items Types (ADR-097)
export type { StoredTagItem, RuntimeTagItem } from "./taggroup-items";
export { toRuntimeTagItem } from "./taggroup-items";

// Breadcrumb Items Types (ADR-912 영역 B (A))
export type {
  StoredBreadcrumbItem,
  RuntimeBreadcrumbItem,
} from "./breadcrumb-items";
export { toRuntimeBreadcrumbItem } from "./breadcrumb-items";

// GridList Items Types (ADR-099 Phase 5 Section union)
export type {
  StoredGridListItem,
  StoredGridListSection,
  StoredGridListEntry,
  RuntimeGridListItem,
} from "./gridlist-items";
export {
  toRuntimeGridListItem,
  isGridListSectionEntry,
} from "./gridlist-items";
