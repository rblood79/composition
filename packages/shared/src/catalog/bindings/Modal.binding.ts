/**
 * ADR-142 family ⑥(overlays) — Modal primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) primitive. composition wrapper(`Modal.tsx`)가 RAC ModalOverlay/Modal +
 * focus trap 합성(internal source). 자식(Dialog 등)은 canonical children.
 *
 * **Skia generic 발효 (ADR-142 Inc3, 2026-06-01)**: render.shapes=[] (portal 시각 없음).
 * buildCatalogShapes 가 variant fill transparent shell 만 그림 — 시각 무해(안 보임), legacy []
 * 와 시각 동일. backdrop 은 ModalOverlay 가 별도 담당 → skiaPrimitive 불필요.
 */

import type { PrimitiveBinding } from "../types";

export const modalBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "modal",
  },
  props: {
    accepts: {
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      /**
       * ADR-158 Phase 3 (2026-08-16) — 등재 capability `Modal.open`/`close` 가
       * patch 하는 prop. `toRacProps` 는 `accepts` 에 선언된 키만 emit 하므로
       * 여기 없으면 **RAC 에 영원히 도달하지 않는다** — capability 는 `racRef:
       * ModalOverlayProps.isOpen (controlled)` 로 등재돼 있는데 dispatcher 가
       * patch 해도 화면이 그대로였다 (라이브 실측).
       *
       * default 를 두지 않는다 — 미설정 시 RAC Modal 이 닫힌 채 렌더 자체를
       * 하지 않는 현행 동작을 그대로 보존한다.
       */
      isOpen: { kind: "boolean", label: "Open", section: "state" },
      trapFocus: { kind: "boolean", label: "Trap Focus", section: "state" },
      autoFocus: { kind: "boolean", label: "Auto Focus", section: "state" },
    },
    toRacProps: "default",
  },
};
