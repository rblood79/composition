/** Dialog 콘텐츠 시각은 catalog, 열림/포커스/배경막은 RAC overlay가 담당한다. */

import type { PrimitiveBinding } from "../types";

export const dialogBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "dialog",
  },
  props: {
    accepts: {
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      isDismissable: {
        kind: "boolean",
        label: "Dismissable",
        section: "state",
      },
      // live consumer: LayoutRenderers.tsx renderDialog line 630
      role: {
        kind: "enum",
        label: "Role",
        section: "state",
        default: "dialog",
        options: [
          { value: "dialog", label: "Dialog" },
          { value: "alertdialog", label: "Alert Dialog" },
        ],
      },
    },
    toRacProps: "default",
  },
  // 본문 시각만 담당한다. 런타임 모달 backdrop은 DialogTrigger의 ModalOverlay 소유.
};
