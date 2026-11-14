import type { PrimitiveBinding } from "../types";
import { buttonBinding } from "./Button.binding";
import { formBinding } from "./Form.binding";

const {
  variant: _variant,
  fillStyle: _fillStyle,
  ...accepts
} = buttonBinding.props.accepts;

const {
  method: { default: _methodDefault, ...formMethod },
  encType: formEncType,
  target: formTarget,
} = formBinding.props.accepts as Required<typeof formBinding.props.accepts>;

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
      // (2026-11-14, 사용자 「ActionButton S2 전환 — 프로퍼티 누락 추가」) S2 `ActionButtonProps` (RAC
      //   `ButtonProps`) 의 나머지 — form 제출 · focus 속성. 개발자용 HTML 속성이라 받기만 하고 패널에
      //   내지 않는다 (2026-11-11 사용자 결정). DOM: `actionbutton` renderer → RAC Button.
      name: {
        kind: "string",
        label: "Name",
        section: "forms",
        editorHidden: true,
      },
      value: {
        kind: "string",
        label: "Submit value",
        section: "forms",
        editorHidden: true,
      },
      form: {
        kind: "string",
        label: "Form",
        section: "forms",
        editorHidden: true,
      },
      formAction: {
        kind: "string",
        label: "Form action",
        section: "forms",
        editorHidden: true,
      },
      formMethod: { ...formMethod, label: "Form method", section: "forms" },
      formEncType: { ...formEncType, label: "Form enc type", section: "forms" },
      formTarget: { ...formTarget, label: "Form target", section: "forms" },
      formNoValidate: {
        kind: "boolean",
        label: "Form no validate",
        section: "forms",
        editorHidden: true,
      },
      excludeFromTabOrder: {
        kind: "boolean",
        label: "Exclude from tab order",
        section: "state",
        editorHidden: true,
      },
      preventFocusOnPress: {
        kind: "boolean",
        label: "Prevent focus on press",
        section: "state",
        editorHidden: true,
      },
    },
  },
};
