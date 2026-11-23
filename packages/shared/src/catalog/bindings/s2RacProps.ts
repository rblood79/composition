/**
 * S2 체크리스트 §9.1 · §9.2 「숨김」 (2026-11-24, 사용자 /goal 「권장 순서대로 1 → 2 → 3」 의 2) — S2 ·
 * RAC 가 선언하는 동작 · HTML prop 중 노코드 패널에 낼 뜻이 없는 것. binding 이 받기만 하고
 * (`editorHidden`) DOM 의 RAC 컴포넌트에 그대로 넘긴다 — Button form 속성
 * (`BUTTON_FORM_FOCUS_ACCEPTS`) 과 같은 방식 (2026-11-11 사용자 결정 「개발자용 속성은 패널에
 * 없음」). 동작은 RAC 의 것 (D1) 이라 Canvas 는 읽지 않는다. 회귀 `s2RacProps.test.tsx`.
 *
 * 아래 「패널」 표 (§9 「패널」 — 2026-11-24) 는 같은 길로 RAC 에 가되 Property 패널에 보인다.
 */
import type { PropContract } from "../types";

const hidden = (
  contract: Omit<PropContract, "editorHidden" | "section"> &
    Partial<Pick<PropContract, "section">>,
): PropContract =>
  ({ section: "interaction", ...contract, editorHidden: true }) as PropContract;

const DISABLED_BEHAVIOR = hidden({
  kind: "enum",
  label: "Disabled behavior",
  options: [
    { value: "all", label: "All" },
    { value: "selection", label: "Selection" },
  ],
});
const ESCAPE_KEY_BEHAVIOR = hidden({
  kind: "enum",
  label: "Escape key behavior",
  options: [
    { value: "clearSelection", label: "Clear selection" },
    { value: "none", label: "None" },
  ],
});
const KEYBOARD_NAVIGATION_BEHAVIOR = hidden({
  kind: "enum",
  label: "Keyboard navigation behavior",
  options: [
    { value: "arrow", label: "Arrow" },
    { value: "tab", label: "Tab" },
  ],
});
const SHOULD_SELECT_ON_PRESS_UP = hidden({
  kind: "boolean",
  label: "Select on press up",
});
const DISALLOW_TYPE_AHEAD = hidden({
  kind: "boolean",
  label: "Disallow type ahead",
});
const AUTO_COMPLETE = hidden({
  kind: "string",
  label: "Auto complete",
  section: "forms",
});
const COMMIT_BEHAVIOR = hidden({
  kind: "enum",
  label: "Commit behavior",
  options: [
    { value: "clear", label: "Clear" },
    { value: "reset", label: "Reset" },
    { value: "select", label: "Select" },
  ],
});

/** A collection's keyboard · selection behaviour (RAC `GridList` · `Tree` · `Table` · S2 `CardView`). */
export const S2_HIDDEN_COLLECTION_ACCEPTS: Readonly<
  Record<string, PropContract>
> = {
  disabledBehavior: DISABLED_BEHAVIOR,
  escapeKeyBehavior: ESCAPE_KEY_BEHAVIOR,
  shouldSelectOnPressUp: SHOULD_SELECT_ON_PRESS_UP,
};

export const S2_HIDDEN_KEYBOARD_NAVIGATION_ACCEPTS: Readonly<
  Record<string, PropContract>
> = { keyboardNavigationBehavior: KEYBOARD_NAVIGATION_BEHAVIOR };

export const S2_HIDDEN_TYPE_AHEAD_ACCEPTS: Readonly<
  Record<string, PropContract>
> = { disallowTypeAhead: DISALLOW_TYPE_AHEAD };

/** S2 CardView's own: its keyboard orientation (RAC `GridList` `orientation`). */
export const S2_HIDDEN_ORIENTATION_ACCEPTS: Readonly<
  Record<string, PropContract>
> = {
  orientation: hidden({
    kind: "enum",
    label: "Keyboard orientation",
    options: [
      { value: "vertical", label: "Vertical" },
      { value: "horizontal", label: "Horizontal" },
    ],
  }),
};

export const S2_HIDDEN_ESCAPE_ACCEPTS: Readonly<Record<string, PropContract>> =
  { escapeKeyBehavior: ESCAPE_KEY_BEHAVIOR };

export const S2_HIDDEN_PRESS_UP_ACCEPTS: Readonly<
  Record<string, PropContract>
> = { shouldSelectOnPressUp: SHOULD_SELECT_ON_PRESS_UP };

/** A grid item's · cell's focus (RAC `GridListItem` · `TreeItem` · `Column` · `Cell`). */
export const S2_HIDDEN_ITEM_FOCUS_ACCEPTS: Readonly<
  Record<string, PropContract>
> = {
  allowsArrowNavigation: hidden({
    kind: "boolean",
    label: "Arrow navigation inside",
  }),
  focusMode: hidden({
    kind: "enum",
    label: "Focus mode",
    options: [
      { value: "cell", label: "Cell" },
      { value: "child", label: "Child" },
    ],
  }),
};

/** A link item's HTML attributes (RAC `GridListItem` · `TreeItem` — the Link's hidden four). */
export const S2_HIDDEN_ITEM_LINK_ACCEPTS: Readonly<
  Record<string, PropContract>
> = {
  download: hidden({ kind: "boolean", label: "Download", section: "link" }),
  hrefLang: hidden({ kind: "string", label: "Href lang", section: "link" }),
  ping: hidden({ kind: "string", label: "Ping", section: "link" }),
  referrerPolicy: hidden({
    kind: "string",
    label: "Referrer policy",
    section: "link",
  }),
};

export const S2_HIDDEN_AUTO_COMPLETE_ACCEPTS: Readonly<
  Record<string, PropContract>
> = { autoComplete: AUTO_COMPLETE };

export const S2_HIDDEN_COMMIT_BEHAVIOR_ACCEPTS: Readonly<
  Record<string, PropContract>
> = { commitBehavior: COMMIT_BEHAVIOR };

/** S2 NumberField's stepper names (RAC `NumberField` — the buttons' `aria-label`). */
export const S2_HIDDEN_STEPPER_LABEL_ACCEPTS: Readonly<
  Record<string, PropContract>
> = {
  incrementAriaLabel: hidden({
    kind: "string",
    label: "Increment label",
    section: "accessibility",
  }),
  decrementAriaLabel: hidden({
    kind: "string",
    label: "Decrement label",
    section: "accessibility",
  }),
};

/** S2 ComboBox's list wrap (RAC `ComboBox` `shouldFocusWrap`). */
export const S2_HIDDEN_FOCUS_WRAP_ACCEPTS: Readonly<
  Record<string, PropContract>
> = {
  shouldFocusWrap: hidden({ kind: "boolean", label: "Focus wrap" }),
};

/** S2 MenuTrigger's flip (RAC `MenuTrigger` → its Popover). */
export const S2_HIDDEN_FLIP_ACCEPTS: Readonly<Record<string, PropContract>> = {
  shouldFlip: hidden({ kind: "boolean", label: "Flip", section: "overlay" }),
};

/** S2 Card's name in a CardView (RAC `GridListItem` `textValue`). */
export const S2_HIDDEN_TEXT_VALUE_ACCEPTS: Readonly<
  Record<string, PropContract>
> = {
  textValue: hidden({
    kind: "string",
    label: "Text value",
    section: "content",
  }),
};

/** §9 「패널」 — S2 동작 prop (보임). RAC 가 동작을 갖는다 (D1). */
const panel = (contract: PropContract): PropContract => contract;

export const S2_PANEL_DISALLOW_EMPTY_ACCEPTS: Readonly<
  Record<string, PropContract>
> = {
  disallowEmptySelection: panel({
    kind: "boolean",
    label: "Disallow Empty Selection",
    section: "state",
  }),
};

export const S2_PANEL_CLOSE_ON_SELECT_ACCEPTS: Readonly<
  Record<string, PropContract>
> = {
  shouldCloseOnSelect: panel({
    kind: "boolean",
    label: "Close on select",
    section: "overlay",
  }),
};

export const S2_PANEL_FOCUS_WRAP_ACCEPTS: Readonly<
  Record<string, PropContract>
> = {
  shouldFocusWrap: panel({
    kind: "boolean",
    label: "Focus wrap",
    section: "interaction",
  }),
};

/** S2 NumberField `commitBehavior` — what a blur does to an out-of-range value. */
export const S2_PANEL_NUMBER_COMMIT_ACCEPTS: Readonly<
  Record<string, PropContract>
> = {
  commitBehavior: panel({
    kind: "enum",
    label: "Commit behavior",
    section: "value",
    default: "snap",
    options: [
      { value: "snap", label: "Snap" },
      { value: "validate", label: "Validate" },
    ],
  }),
};

/** S2 ComboBox `formValue` — the key or the text goes in the form. */
export const S2_PANEL_FORM_VALUE_ACCEPTS: Readonly<
  Record<string, PropContract>
> = {
  formValue: panel({
    kind: "enum",
    label: "Form value",
    section: "forms",
    default: "key",
    options: [
      { value: "key", label: "Key" },
      { value: "text", label: "Text" },
    ],
  }),
};

export const S2_PANEL_NON_MODAL_ACCEPTS: Readonly<
  Record<string, PropContract>
> = {
  isNonModal: panel({
    kind: "boolean",
    label: "Non-modal",
    section: "overlay",
  }),
};

export const S2_PANEL_CLOSE_ON_PRESS_ACCEPTS: Readonly<
  Record<string, PropContract>
> = {
  shouldCloseOnPress: panel({
    kind: "boolean",
    label: "Close on press",
    section: "overlay",
    default: true,
  }),
};

/** S2 StatusLight `role` — a status that changes at run time is announced. */
export const S2_PANEL_STATUS_ROLE_ACCEPTS: Readonly<
  Record<string, PropContract>
> = {
  role: panel({
    kind: "enum",
    label: "Role",
    section: "content",
    options: [{ value: "status", label: "Status" }],
  }),
};

/**
 * S2 ContextualHelp's popover place (`placement` · `offset` · `crossOffset` · `containerPadding` ·
 * `shouldFlip` — S2 hands them to its Popover). No defaults: unset is the Popover's own.
 */
export const S2_PANEL_HELP_POPOVER_ACCEPTS: Readonly<
  Record<string, PropContract>
> = {
  placement: panel({
    kind: "enum",
    label: "Placement",
    section: "overlay",
    options: [
      "bottom",
      "bottom start",
      "bottom end",
      "top",
      "top start",
      "top end",
      "left",
      "left top",
      "left bottom",
      "start",
      "start top",
      "start bottom",
      "right",
      "right top",
      "right bottom",
      "end",
      "end top",
      "end bottom",
    ].map((value) => ({ value, label: value })),
  }),
  offset: panel({ kind: "number", label: "Offset", section: "overlay" }),
  crossOffset: panel({
    kind: "number",
    label: "Cross offset",
    section: "overlay",
  }),
  containerPadding: panel({
    kind: "number",
    label: "Container padding",
    section: "overlay",
  }),
  shouldFlip: panel({
    kind: "boolean",
    label: "Should flip",
    section: "overlay",
  }),
};

const S2_RAC_CONTRACTS: ReadonlySet<PropContract> = new Set(
  [
    S2_HIDDEN_COLLECTION_ACCEPTS,
    S2_HIDDEN_KEYBOARD_NAVIGATION_ACCEPTS,
    S2_HIDDEN_TYPE_AHEAD_ACCEPTS,
    S2_HIDDEN_ORIENTATION_ACCEPTS,
    S2_HIDDEN_ESCAPE_ACCEPTS,
    S2_HIDDEN_PRESS_UP_ACCEPTS,
    S2_HIDDEN_ITEM_FOCUS_ACCEPTS,
    S2_HIDDEN_ITEM_LINK_ACCEPTS,
    S2_HIDDEN_AUTO_COMPLETE_ACCEPTS,
    S2_HIDDEN_COMMIT_BEHAVIOR_ACCEPTS,
    S2_HIDDEN_STEPPER_LABEL_ACCEPTS,
    S2_HIDDEN_FOCUS_WRAP_ACCEPTS,
    S2_HIDDEN_FLIP_ACCEPTS,
    S2_HIDDEN_TEXT_VALUE_ACCEPTS,
    S2_PANEL_DISALLOW_EMPTY_ACCEPTS,
    S2_PANEL_CLOSE_ON_SELECT_ACCEPTS,
    S2_PANEL_FOCUS_WRAP_ACCEPTS,
    S2_PANEL_NUMBER_COMMIT_ACCEPTS,
    S2_PANEL_FORM_VALUE_ACCEPTS,
    S2_PANEL_NON_MODAL_ACCEPTS,
    S2_PANEL_CLOSE_ON_PRESS_ACCEPTS,
    S2_PANEL_STATUS_ROLE_ACCEPTS,
  ].flatMap((accepts) => Object.values(accepts)),
);

/**
 * The authored §9 props of a record (hidden and panel), for its RAC component — the keys whose contract in
 * `accepts` is one of the tables above (by identity: a type's visible prop of the same name — Tabs'
 * `orientation` — is not one). A renderer that picks its RAC props by hand spreads this.
 */
export function catalogS2RacProps(
  accepts: Readonly<Record<string, PropContract>> | undefined,
  props: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!accepts) return out;
  for (const [key, contract] of Object.entries(accepts))
    if (S2_RAC_CONTRACTS.has(contract) && props[key] !== undefined)
      out[key] = props[key];
  return out;
}
