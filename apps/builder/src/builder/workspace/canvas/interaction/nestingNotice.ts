/**
 * 중첩 preflight 결과를 사용자에게 알린다 — 옮겼으면 warning + 되돌리기, 못 옮겼으면
 * error. 문구는 toast store 의 `messageKey` 채널로 넘겨 렌더 시점에 언어를 해소한다
 * (하드코딩하면 토스트가 떠 있는 동안 언어를 바꿔도 직전 언어가 남는다 — `stores/toast.ts`).
 */
import type { NestingViolation } from "@composition/shared";

import { historyManager } from "../../../stores/history";
import { useToastStore } from "../../../stores/toast";
import type { NestingRelocation } from "./nestingRelocation";

type NoticeKind = "leaf" | "owner" | "notAllowed";

function classify(v: NestingViolation): NoticeKind {
  if (v.leafParent || v.layer === "pen-structure") return "leaf";
  if (v.owners && v.owners.length > 0) return "owner";
  return "notAllowed";
}

function paramsOf(
  v: NestingViolation,
  target?: string,
): Record<string, string> {
  return {
    parent: v.parentType,
    child: v.childType,
    owners: (v.owners ?? []).join(" · "),
    target: target ?? "",
  };
}

const RELOCATED_KEY: Record<NoticeKind, string> = {
  leaf: "errors.nestingLeafRelocated",
  owner: "errors.nestingOwnerRelocated",
  notAllowed: "errors.nestingNotAllowedRelocated",
};

const REJECTED_KEY: Record<NoticeKind, string> = {
  leaf: "errors.nestingLeafRejected",
  owner: "errors.nestingOwnerRejected",
  notAllowed: "errors.nestingNotAllowedRejected",
};

/**
 * 옮긴 뒤 부른다 — 이동이 실제로 일어난 다음이어야 되돌리기가 그 이동을 되돌린다.
 * `withUndo` 는 이 relocation 이 history entry **하나**에 대응할 때만 `true` 로 넘긴다
 * (여러 entry 를 남기는 경로에서 undo 1회는 마지막 하나만 되돌린다).
 */
export function notifyNestingRelocation(
  relocation: NestingRelocation,
  relocatedToLabel: string,
  options: { withUndo?: boolean } = {},
): void {
  const kind = classify(relocation.violation);
  useToastStore.getState().showToast("warning", RELOCATED_KEY[kind], {
    bypassCooldown: true,
    messageKey: RELOCATED_KEY[kind],
    messageParams: paramsOf(relocation.violation, relocatedToLabel),
    ...(options.withUndo === false
      ? {}
      : {
          action: {
            label: "Undo",
            labelKey: "errors.undo",
            onClick: () => {
              historyManager.undo();
            },
          },
        }),
  });
}

export function notifyNestingRejected(violation: NestingViolation): void {
  const kind = classify(violation);
  useToastStore.getState().showToast("error", REJECTED_KEY[kind], {
    bypassCooldown: true,
    messageKey: REJECTED_KEY[kind],
    messageParams: paramsOf(violation),
  });
}
