/**
 * Dialog 콘텐츠 시각은 catalog, 열림/포커스/배경막은 RAC overlay가 담당한다. Dialog origin 은 레퍼런스
 * `DialogTrigger > Button + Modal > Dialog` (ADR-256 Phase 8b) — overlay 는 Modal 노드다.
 */

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
      // (Dismissing on an outside press is the Modal's — RAC `ModalOverlayProps.isDismissable`,
      // ADR-256 Phase 8b.)
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
  // 본문 시각만 담당한다. 런타임 모달 backdrop 은 Modal 노드 (RAC Modal 의 ModalOverlay) 소유 — ADR-256 Phase 8b.
};
