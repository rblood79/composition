import type { PrimitiveBinding } from "../types";

export const tokenFieldBinding: PrimitiveBinding = {
  source: { kind: "internal", renderer: "tokenfield" },
  props: {
    accepts: {
      label: { kind: "string", label: "Label", section: "content" },
      description: { kind: "string", label: "Description", section: "content" },
      // 문서는 문자열, 실행 중에는 RAC TokenFieldValue. 구간은 공통 tokenizer에서 파생한다.
      value: { kind: "string", label: "Value", section: "content" },
      placeholder: { kind: "string", label: "Placeholder", section: "content" },
      allowsNewlines: {
        kind: "boolean",
        label: "Allows Newlines",
        section: "state",
      },
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
      isReadOnly: { kind: "boolean", label: "Read Only", section: "state" },
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
    },
    toRacProps: "default",
  },
};
