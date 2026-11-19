import type { PrimitiveBinding } from "../types";
import { buttonBinding } from "./Button.binding";
import { ITEM_KEY_PROP_CONTRACT } from "../document/itemLinks";
import { ARIA_LABELING_PROPS } from "./accessibilityProps";

const {
  variant: _variant,
  fillStyle: _fillStyle,
  ...accepts
} = buttonBinding.props.accepts;

export const actionButtonBinding: PrimitiveBinding = {
  ...buttonBinding,
  source: { kind: "internal", renderer: "actionbutton" },
  props: {
    ...buttonBinding.props,
    accepts: {
      ...accepts,
      isQuiet: { kind: "boolean", label: "Quiet", section: "appearance" },
      // (2026-11-14, 사용자 「Type · Auto focus 숨겨」) S2 문서 예제의 조작 칸 (children · size ·
      //   staticColor · isQuiet · isDisabled · isPending) 에 없는 두 prop — 받기만 하고 패널에 내지 않는다.
      type: { ...accepts.type!, editorHidden: true },
      autoFocus: { ...accepts.autoFocus!, editorHidden: true },
      // (2026-11-19 — an item key in its group's data run (a Pagination's page number — the row's
      //  key; `first` · `last` its end buttons). Not offered in the panel: a plain action's id is its
      //  HTML ID (Behavior).)
      id: { ...ITEM_KEY_PROP_CONTRACT, editorHidden: true },
      // (2026-11-19 — an icon-only step button's name: a Pagination's 「Icons only」 keeps its word here.)
      "aria-label": ARIA_LABELING_PROPS["aria-label"],
      // (2026-11-19 — RAC `useButton`'s `aria-current`: a Pagination's shown page (`page`). A developer
      //  ARIA attribute — accepted, not offered in the panel (사용자 결정 2026-11-11 「숨김」).)
      "aria-current": {
        editorHidden: true,
        kind: "enum",
        label: "Current",
        section: "state",
        options: ["page", "step", "location", "date", "time", "true", "false"].map(
          (value) => ({ value, label: value }),
        ),
      },
    },
  },
};
