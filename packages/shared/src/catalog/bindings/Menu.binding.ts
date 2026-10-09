/**
 * ADR-142 family ④(collections) — Menu primitive 의 `PrimitiveBinding`.
 *
 * RAC `Menu` — the list (`delegatedDom` `menu`): in a MenuTrigger's · SubmenuTrigger's Popover, or
 * open in an Autocomplete (ADR-256 후속 4). Its items are its MenuItem nodes.
 */

import type { PrimitiveBinding } from "../types";

export const menuBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "menu",
  },
  props: {
    accepts: {
      dataBinding: { kind: "binding", label: "Data", section: "content" },
      // 항목은 slot (자식 노드 — RAC 정적 collection) 또는 dataBinding (collection 행 + 항목 노드
      //   template — RAC 동적 collection) 이다. 옛 items-manager (`props.items` 인라인 배열) 는
      //   2026-10-09 삭제 — ADR-256 노드 트리 전환 뒤 어느 renderer 도 읽지 않았다 (contract 32).
      // ADR-256 후속 4: the trigger (its label · variant) is the MenuTrigger's Button node — a
      //   Menu node is RAC's list.
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      selectionMode: {
        kind: "enum",
        label: "Selection Mode",
        section: "state",
        default: "none",
        options: [
          { value: "none", label: "None" },
          { value: "single", label: "Single" },
          { value: "multiple", label: "Multiple" },
        ],
      },
    },
    toRacProps: "default",
  },
};
