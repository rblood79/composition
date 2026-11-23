import type { PrimitiveBinding } from "../types";

export const tokenFieldBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "tokenfield" },
  props: {
    accepts: {
      label: { kind: "string", label: "Label", section: "content" },
      description: { kind: "string", label: "Description", section: "content" },
      // 문서는 문자열, 실행 중에는 RAC TokenFieldValue. 구간은 공통 tokenizer에서 파생한다.
      value: { kind: "string", label: "Value", section: "value" },
      placeholder: { kind: "string", label: "Placeholder", section: "content" },
      // S2 체크리스트 §4.1 (2026-11-22): S2 에 TokenField 가 없어 TextArea 의 크기 단계 (S · M · L · XL).
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      // (Phase 2, 2026-11-23: S2 TextArea's label layout — the side column and its alignment; a Form's
      //  values reach it too, `CATALOG_FORM_FIELDS`.)
      labelPosition: {
        kind: "enum",
        label: "Label Position",
        section: "appearance",
        default: "top",
        options: [
          { value: "top", label: "Top" },
          { value: "side", label: "Side" },
        ],
      },
      labelAlign: {
        kind: "enum",
        label: "Label align",
        section: "appearance",
        default: "start",
        options: [
          { value: "start", label: "Start" },
          { value: "end", label: "End" },
        ],
        visibleWhen: { key: "labelPosition", equals: "side" },
      },
      allowsNewlines: {
        kind: "boolean",
        label: "Allows newlines",
        section: "state",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
      // (Phase 4, 2026-11-23: S2 TextArea's necessity · error — RAC TokenField has no validation, so
      //  the screen reader gets them from the D1 exception (`tokenField.components.tsx`): its
      //  TokenInput's `aria-required` · `aria-invalid`, the error text by RAC `aria-describedby`.)
      isRequired: { kind: "boolean", label: "Required", section: "validation" },
      isInvalid: { kind: "boolean", label: "Invalid", section: "validation" },
      errorMessage: {
        kind: "string",
        label: "Error Message",
        section: "validation",
      },
      necessityIndicator: {
        kind: "enum",
        label: "Necessity Indicator",
        section: "appearance",
        default: "icon",
        options: [
          { value: "icon", label: "Icon" },
          { value: "label", label: "Label" },
        ],
      },
      autoFocus: { kind: "boolean", label: "Auto Focus", section: "state" },
      "aria-label": {
        kind: "string",
        label: "Aria Label",
        section: "content",
        editorHidden: true,
      },
    },
    toRacProps: "default",
  },
};

export const tokenInputBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "tokeninput" },
  props: {
    accepts: {
      children: { kind: "string", label: "Text", section: "content" },
      placeholder: { kind: "string", label: "Placeholder", section: "content" },
      // (the TokenField's size reaches it through the box Group — `CATALOG_SIZE_PROPAGATION`, as an Input)
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
    },
    toRacProps: "default",
  },
};

export const tokenBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components/TokenField",
    component: "Token",
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Text", section: "content" },
      // (its TokenInput's size — `CATALOG_SIZE_PROPAGATION.TokenInput`)
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
    },
    toRacProps: "default",
  },
};
