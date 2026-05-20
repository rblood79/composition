import type { PrimitiveBinding } from "../types";
import {
  FILE_TRIGGER_DEFAULT_CAMERA_VALUES,
  toFileTriggerRacProps,
  type FileTriggerCanonicalProps,
  type FileTriggerRacProps,
} from "../outputs/toRacProps";

const fileTriggerAccepts = {
  acceptedFileTypes: {
    kind: "string-array",
    label: "Accepted File Types",
    section: "file",
    default: ["image/*"],
  },
  defaultCamera: {
    kind: "enum",
    label: "Camera",
    section: "file",
    options: FILE_TRIGGER_DEFAULT_CAMERA_VALUES.map((value) => ({
      value,
      label: value[0]!.toUpperCase() + value.slice(1),
    })),
    emptyToUndefined: true,
  },
  allowsMultiple: {
    kind: "boolean",
    label: "Multiple",
    section: "state",
    default: false,
  },
  acceptDirectory: {
    kind: "boolean",
    label: "Directory",
    section: "state",
    default: false,
  },
} as const;

export const fileTriggerPrimitiveBinding: PrimitiveBinding<
  FileTriggerCanonicalProps,
  FileTriggerRacProps
> = {
  tag: "FileTrigger",
  family: "fields",
  runtime: {
    source: "react-aria-components",
    exportName: "FileTrigger",
  },
  defaultProps: {
    acceptedFileTypes: ["image/*"],
    allowsMultiple: false,
    acceptDirectory: false,
  },
  props: {
    accepts: fileTriggerAccepts,
  },
  toRacProps: toFileTriggerRacProps,
  placement: {
    kind: "node-with-children",
    children: [
      {
        type: "Button",
        props: {
          children: "Upload",
          type: "button",
          variant: "primary",
          fillStyle: "fill",
          size: "md",
        },
      },
    ],
  },
};
