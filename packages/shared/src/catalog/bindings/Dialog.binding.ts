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
        default: "M",
      },
      // (Dismissing on an outside press is the Modal's — RAC `ModalOverlayProps.isDismissable`,
      // ADR-256 Phase 8b.)
      // S2 Dialog `isDismissible` (2026-11-18 사용자 결정): S2 의 CloseButton (머리 끝의 ✕ —
      //   `catalogDialogChromeShapes` · DOM `Dialog`) + 바깥 클릭 닫기 (Modal 의 RAC `isDismissable` —
      //   파생 `_dialogDismissible`) + ButtonGroup 숨김 (「Dismissible dialogs replace their
      //   ButtonGroup with a close button」 — `catalogHiddenAtRest`).
      isDismissible: {
        kind: "boolean",
        label: "Dismissible",
        section: "overlay",
      },
      role: {
        kind: "enum",
        label: "Role",
        section: "content",
        default: "dialog",
        options: [
          { value: "dialog", label: "Dialog" },
          { value: "alertdialog", label: "Alert dialog" },
        ],
      },
    },
    toRacProps: "default",
  },
  // 본문 시각만 담당한다. 런타임 모달 backdrop 은 Modal 노드 (RAC Modal 의 ModalOverlay) 소유 — ADR-256 Phase 8b.
};
