/**
 * @fileoverview ADR-280 Phase 1 — the registry's only hand input: which RAC concepts each catalog
 * type has, who owns them, and which capabilities the Preview does not deliver yet.
 *
 * `deriveRegistry` turns this and the concept files into `CAPABILITY_REGISTRY`. Every name a
 * concept brings must exist on the type's installed RAC props — `RacPropsOf` below makes a
 * missing callback or prop a compile error (Decision 1: the installed RAC is the authority).
 *
 * @see docs/adr/280-interactions-rac-surface-registry-controlled-runtime.md
 * @see docs/adr/design/280-interactions-rac-surface-registry-controlled-runtime-breakdown.md §1e-1 · §2
 */
import type {
  AutocompleteProps,
  BreadcrumbsProps,
  ButtonProps,
  CalendarProps,
  CheckboxGroupProps,
  CheckboxProps,
  ColorAreaProps,
  ColorFieldProps,
  ColorSliderProps,
  ColorSwatchPickerProps,
  ColorWheelProps,
  ComboBoxProps,
  DateFieldProps,
  DatePickerProps,
  DateRangePickerProps,
  DialogTriggerProps,
  DisclosureGroupProps,
  DisclosureProps,
  DropZoneProps,
  FileTriggerProps,
  FormProps,
  GridListItemProps,
  GridListProps,
  LinkProps,
  ListBoxItemProps,
  ListBoxProps,
  MenuProps,
  MenuTriggerProps,
  ModalOverlayProps,
  NumberFieldProps,
  PopoverProps,
  RadioGroupProps,
  RadioProps,
  RangeCalendarProps,
  RowProps,
  SearchFieldProps,
  SelectProps,
  SliderProps,
  SwitchProps,
  TabProps,
  TableProps,
  TabsProps,
  TagGroupProps,
  TagProps,
  TextFieldProps,
  TimeFieldProps,
  ToggleButtonGroupProps,
  ToggleButtonProps,
  TooltipProps,
  TooltipTriggerComponentProps,
  TreeItemProps,
  TreeProps,
} from "react-aria-components";
import { action, rowAction } from "./concepts/action";
import { expansionKeys, expansionOne } from "./concepts/expansion";
import { dragDrop, fileSelect } from "./concepts/files";
import { focus } from "./concepts/focus";
import { focusedDate } from "./concepts/focusedDate";
import { form } from "./concepts/form";
import { hover } from "./concepts/hover";
import {
  colorScheme,
  inheritedDisabled,
  inheritedLocale,
  inheritedReadOnly,
  inheritedRequired,
} from "./concepts/inherited";
import { inputValue } from "./concepts/inputValue";
import { keyboard } from "./concepts/keyboard";
import { multiSelection } from "./concepts/multiSelection";
import { open, openObserved } from "./concepts/open";
import { press } from "./concepts/press";
import { remove } from "./concepts/remove";
import { search } from "./concepts/search";
import {
  selectionAsValue,
  singleSelectionPicker,
  singleSelectionTabs,
  singleSelectionValue,
} from "./concepts/singleSelection";
import { sort } from "./concepts/sort";
import { toggle } from "./concepts/toggle";
import {
  valueColor,
  valueDate,
  valueDateRange,
  valueNumber,
  valueStrings,
  valueText,
} from "./concepts/value";
import { valueCommitColor, valueCommitNumber } from "./concepts/valueCommit";
import type { ComponentInteractionSpec } from "./concepts/types";

/** The pointer side events every pressable control has (hidden — ADR B decides the panel). */
const POINTER = [
  { concept: hover },
  { concept: focus },
  { concept: keyboard },
] as const;
const FIELD_FOCUS = [{ concept: focus }, { concept: keyboard }] as const;
/** A collection item: press · hover only, its state is the collection's (owner item — hidden). */
const ITEM = [
  { concept: press, owner: "item" },
  { concept: hover, owner: "item" },
] as const;
const TOGGLE_BUTTON_LABELS = {
  check: "capabilities.turnOn",
  uncheck: "capabilities.turnOff",
  toggleCheck: "capabilities.toggleOnOff",
} as const;

/** ADR-281 Decision 3 — what a frame passes down (user decision 1 — page root + frame). */
const INHERITED = [
  { concept: inheritedDisabled },
  { concept: inheritedReadOnly },
  { concept: inheritedRequired },
  { concept: inheritedLocale },
] as const;

export const COMPONENT_INTERACTION_SPECS = {
  // ── page root · frame — props their descendants inherit (ADR-281) ────
  body: { concepts: [...INHERITED, { concept: colorScheme }] },
  frame: { concepts: INHERITED },

  // ── press · file inputs ──────────────────────────────────────────────
  Button: { concepts: [{ concept: press }, ...POINTER] },
  Link: { concepts: [{ concept: press }, ...POINTER] },
  FileTrigger: { concepts: [{ concept: fileSelect }] },
  DropZone: { concepts: [{ concept: dragDrop }] },

  // ── toggles ──────────────────────────────────────────────────────────
  Checkbox: {
    concepts: [{ concept: toggle }, { concept: hover }, ...FIELD_FOCUS],
  },
  ToggleButton: {
    concepts: [
      { concept: toggle, labels: TOGGLE_BUTTON_LABELS },
      { concept: press },
      ...POINTER,
    ],
  },
  Switch: {
    concepts: [{ concept: toggle }, { concept: hover }, ...FIELD_FOCUS],
  },
  CheckboxGroup: {
    concepts: [{ concept: valueStrings, owner: "group" }],
  },
  ToggleButtonGroup: {
    concepts: [{ concept: multiSelection, owner: "group" }],
  },
  RadioGroup: {
    concepts: [
      { concept: singleSelectionValue, owner: "group" },
      { concept: focus },
    ],
  },

  // ── text · number fields ─────────────────────────────────────────────
  TextField: {
    concepts: [{ concept: valueText }, ...FIELD_FOCUS],
  },
  TextArea: {
    concepts: [{ concept: valueText }, ...FIELD_FOCUS],
  },
  SearchField: {
    concepts: [{ concept: valueText }, { concept: search }, ...FIELD_FOCUS],
  },
  NumberField: {
    concepts: [{ concept: valueNumber }, ...FIELD_FOCUS],
  },
  ColorField: {
    concepts: [{ concept: valueColor }, ...FIELD_FOCUS],
  },

  // ── sliders · color controls ─────────────────────────────────────────
  Slider: { concepts: [{ concept: valueCommitNumber }] },
  ColorArea: { concepts: [{ concept: valueCommitColor }] },
  ColorSlider: { concepts: [{ concept: valueCommitColor }] },
  ColorWheel: { concepts: [{ concept: valueCommitColor }] },
  ColorSwatchPicker: {
    concepts: [{ concept: selectionAsValue }],
  },

  // ── pickers ──────────────────────────────────────────────────────────
  Select: {
    concepts: [{ concept: singleSelectionPicker }, { concept: open }],
  },
  ComboBox: {
    concepts: [
      { concept: singleSelectionPicker },
      { concept: inputValue },
      { concept: openObserved },
    ],
  },
  Autocomplete: { concepts: [{ concept: inputValue }] },

  // ── collections ──────────────────────────────────────────────────────
  ListBox: {
    concepts: [
      {
        concept: multiSelection,
      },
      { concept: action },
    ],
  },
  GridList: {
    concepts: [
      {
        concept: multiSelection,
      },
      { concept: action },
    ],
  },
  CardView: {
    concepts: [{ concept: multiSelection }, { concept: action }],
  },
  Table: {
    concepts: [
      { concept: multiSelection },
      { concept: sort },
      { concept: rowAction },
    ],
  },
  Tree: {
    concepts: [
      { concept: multiSelection },
      { concept: expansionKeys },
      { concept: action },
    ],
  },
  TagGroup: { concepts: [{ concept: multiSelection }, { concept: remove }] },
  Menu: {
    concepts: [{ concept: action }, { concept: multiSelection }],
  },
  Breadcrumbs: { concepts: [{ concept: action }] },
  Tabs: {
    concepts: [
      {
        concept: singleSelectionTabs,
      },
    ],
  },
  Disclosure: { concepts: [{ concept: expansionOne }] },
  DisclosureGroup: {
    concepts: [{ concept: expansionKeys, owner: "group" }],
  },

  // ── overlays — open is the trigger's (Phase 0 probe P1); a body alone owns its own ─────
  MenuTrigger: {
    concepts: [{ concept: open, owner: "trigger" }],
  },
  DialogTrigger: {
    concepts: [{ concept: open, owner: "trigger" }],
  },
  TooltipTrigger: {
    concepts: [{ concept: open, owner: "trigger" }],
  },
  ContextualHelp: {
    concepts: [{ concept: open, owner: "trigger" }],
  },
  Modal: { concepts: [{ concept: open }] },
  // (A body's open is its trigger's when it has one — the runtime routes the write there.)
  Tooltip: { concepts: [{ concept: open }] },
  Popover: { concepts: [{ concept: open }] },

  // ── date · time ──────────────────────────────────────────────────────
  DateField: { concepts: [{ concept: valueDate }] },
  TimeField: { concepts: [{ concept: valueDate }] },
  DatePicker: {
    concepts: [{ concept: valueDate }, { concept: open }],
  },
  DateRangePicker: {
    concepts: [{ concept: valueDateRange }, { concept: open }],
  },
  Calendar: {
    concepts: [{ concept: valueDate }, { concept: focusedDate }],
  },
  RangeCalendar: {
    concepts: [{ concept: valueDateRange }, { concept: focusedDate }],
  },

  // ── form ─────────────────────────────────────────────────────────────
  Form: { concepts: [{ concept: form }] },

  // ── collection items (owner item — every event hidden, the state is the collection's) ─
  ListBoxItem: { concepts: ITEM },
  GridListItem: { concepts: ITEM },
  TreeItem: { concepts: ITEM },
  Row: { concepts: ITEM },
  Tag: { concepts: ITEM },
  Tab: { concepts: [{ concept: hover, owner: "item" }] },
  Radio: { concepts: [{ concept: hover, owner: "item" }] },
} as const satisfies Record<string, ComponentInteractionSpec>;

// ── compile-time check: every derived name exists on the type's installed RAC props ──────

/**
 * The installed RAC props of each spec'd type. S2-only types read the RAC component S2 builds on
 * (CardView → GridList · ContextualHelp → DialogTrigger · TextArea → TextField).
 */
/**
 * ADR-281 — a page root's · frame's props: RAC context props they pass down and S2 `Provider`'s
 * `locale` · `colorScheme` (S2 is not a dependency of this package — its `ColorScheme` is
 * `'light' | 'dark'`, `Provider.d.ts:5`).
 */
type PageRootProps = Pick<ButtonProps, "isDisabled"> &
  Pick<TextFieldProps, "isReadOnly" | "isRequired"> & {
    locale?: string;
    colorScheme?: "light" | "dark";
  };

interface RacPropsOf {
  Button: ButtonProps;
  Link: LinkProps;
  FileTrigger: FileTriggerProps;
  DropZone: DropZoneProps;
  Checkbox: CheckboxProps;
  ToggleButton: ToggleButtonProps;
  Switch: SwitchProps;
  CheckboxGroup: CheckboxGroupProps;
  ToggleButtonGroup: ToggleButtonGroupProps;
  RadioGroup: RadioGroupProps;
  TextField: TextFieldProps;
  TextArea: TextFieldProps;
  SearchField: SearchFieldProps;
  NumberField: NumberFieldProps;
  ColorField: ColorFieldProps;
  Slider: SliderProps;
  ColorArea: ColorAreaProps;
  ColorSlider: ColorSliderProps;
  ColorWheel: ColorWheelProps;
  ColorSwatchPicker: ColorSwatchPickerProps;
  Select: SelectProps<object>;
  ComboBox: ComboBoxProps<object>;
  Autocomplete: AutocompleteProps;
  ListBox: ListBoxProps<object>;
  GridList: GridListProps<object>;
  CardView: GridListProps<object>;
  body: PageRootProps;
  frame: Omit<PageRootProps, "colorScheme">;
  Table: TableProps;
  Tree: TreeProps<object>;
  TagGroup: TagGroupProps;
  Menu: MenuProps<object>;
  Breadcrumbs: BreadcrumbsProps<object>;
  Tabs: TabsProps;
  Disclosure: DisclosureProps;
  DisclosureGroup: DisclosureGroupProps;
  MenuTrigger: MenuTriggerProps;
  DialogTrigger: DialogTriggerProps;
  TooltipTrigger: TooltipTriggerComponentProps;
  ContextualHelp: DialogTriggerProps;
  Modal: ModalOverlayProps;
  Tooltip: TooltipProps;
  Popover: PopoverProps;
  DateField: DateFieldProps<never>;
  TimeField: TimeFieldProps<never>;
  DatePicker: DatePickerProps<never>;
  DateRangePicker: DateRangePickerProps<never>;
  Calendar: CalendarProps<never>;
  RangeCalendar: RangeCalendarProps<never>;
  Form: FormProps;
  ListBoxItem: ListBoxItemProps;
  GridListItem: GridListItemProps;
  TreeItem: TreeItemProps;
  Row: RowProps<object>;
  Tag: TagProps;
  Tab: TabProps;
  Radio: RadioProps;
}

type Specs = typeof COMPONENT_INTERACTION_SPECS;
type NamesOfConcept<C> = C extends {
  events: readonly (infer E)[];
}
  ? | E
    | (C extends { hiddenEvents: readonly (infer H)[] } ? H : never)
    | (C extends { state: { prop: infer P; callback: infer B } }
        ? P | Exclude<B, "">
        : never)
    | (C extends { state: { defaultProp: infer D } } ? D : never)
  : never;
type NamesOfSpec<S> = S extends { concepts: readonly (infer U)[] }
  ? U extends { concept: infer C }
    ? NamesOfConcept<C>
    : never
  : never;
/** Per type: the derived names its RAC props lack (must be `never`). */
type MissingOnRac = {
  [K in keyof Specs]: K extends keyof RacPropsOf
    ? Exclude<NamesOfSpec<Specs[K]>, keyof RacPropsOf[K]>
    : "no RacPropsOf entry";
};
/**
 * A type in the specs without its RAC props, or a name RAC does not declare, fails here — the
 * error names the type (property) and the missing names.
 */
export const RAC_SURFACE_CHECK = null as unknown as MissingOnRac satisfies {
  [K in keyof Specs]: never;
};
