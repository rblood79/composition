/**
 * 도구 한 줄 어휘 (ADR-134 Phase 8, D9).
 *
 * 1년차 신입 baseline 의 핵심은 "무엇이 일어났는지 읽을 수 있는가" 다. 사용자는
 * `create_element` 를 읽지 않는다 — **무엇을 만들었는지**를 읽는다.
 *
 * 손으로 쓴 한국어 층이라 도구 목록과 어긋날 수 있다. 그래서 모르는 도구를 뭉뚱그린 라벨
 * ("도구 실행 완료") 로 삼키지 않고 **이름을 그대로 노출**하고, `toolLabels.test.ts` 가
 * 정의 전수를 대조한다 (Phase 5 `specSync` 와 같은 구조 — 손으로 쓴 것만 게이트한다).
 * 실제로 Phase 8 이전의 표는 도구 7종만 알고 있었고, Phase 3/4/ADR-196 이 더한 3종
 * (`bind_collection` / `create_interaction_rule` / `run_command`) 은 전부 뭉뚱그려졌다.
 */

export interface ToolLabelKeys {
  /** 호출 시점 — "무엇을 하려는가" */
  readonly intent: string;
  /** 결과 시점 — "무엇이 됐는가" */
  readonly done: string;
}

/** 도구 → 라벨 **키** 두 갈래 (의도 / 완료). 해소는 표시 시점에 (ADR-200). */
export const TOOL_LABEL_KEYS: Record<string, ToolLabelKeys> = {
  create_element: {
    intent: "aiTool.createElement",
    done: "aiTool.createElementDone",
  },
  update_element: {
    intent: "aiTool.updateElement",
    done: "aiTool.updateElementDone",
  },
  delete_element: {
    intent: "aiTool.deleteElement",
    done: "aiTool.deleteElementDone",
  },
  get_editor_state: {
    intent: "aiTool.getEditorState",
    done: "aiTool.getEditorStateDone",
  },
  get_selection: {
    intent: "aiTool.getSelection",
    done: "aiTool.getEditorStateDone",
  },
  search_elements: {
    intent: "aiTool.searchElements",
    done: "aiTool.searchElementsDone",
  },
  batch_design: {
    intent: "aiTool.batchDesign",
    done: "aiTool.batchDesignDone",
  },
  bind_collection: {
    intent: "aiTool.bindCollection",
    done: "aiTool.bindCollectionDone",
  },
  create_interaction_rule: {
    intent: "aiTool.createInteractionRule",
    done: "aiTool.createInteractionRuleDone",
  },
  run_command: { intent: "aiTool.runCommand", done: "aiTool.runCommandDone" },
};

/** 표시 시점 해소기 — 이 모듈은 순수 `.ts` 라 훅을 못 쓴다 (ADR-200 어법). */
export type TranslateFn = (
  key: string,
  params?: Record<string, string | number | boolean>,
) => string;

/** 모르는 도구는 이름 그대로 — 삼키지 않는다. */
export function toolIntentLabel(name: string, t: TranslateFn): string {
  const key = TOOL_LABEL_KEYS[name]?.intent;
  return key ? t(key) : name;
}

function toolDoneLabel(name: string, t: TranslateFn): string {
  const key = TOOL_LABEL_KEYS[name]?.done;
  return key ? t(key) : t("aiTool.genericDone", { name });
}

/** 인자에서 사람이 읽을 한 조각만 뽑는다 — 전체 JSON 은 신입에게 소음이다. */
function subject(
  args: Record<string, unknown> | undefined,
  t: TranslateFn,
): string | null {
  if (!args) return null;
  for (const key of ["type", "componentType", "commandId", "trigger", "tag"]) {
    const value = args[key];
    if (typeof value === "string" && value) return value;
  }
  const id = args.elementId;
  if (typeof id === "string" && id) {
    return id === "selected"
      ? t("aiTool.selectedElement")
      : `${id.slice(0, 8)}…`;
  }
  return null;
}

/** 호출 시점 한 줄 — "요소 생성 · Button" */
export function describeToolCall(
  name: string,
  t: TranslateFn,
  args?: Record<string, unknown>,
): string {
  const intent = toolIntentLabel(name, t);
  const detail = subject(args, t);
  return detail ? t("aiTool.callWithDetail", { intent, detail }) : intent;
}

/** 결과 시점 한 줄 — 실패는 이유를 그대로 보여준다 (숨기면 신입이 막힌다). */
export function describeToolResult(
  name: string,
  result: unknown,
  t: TranslateFn,
): string {
  const record = (result ?? {}) as Record<string, unknown>;
  const intent = toolIntentLabel(name, t);
  if (record.success === false) {
    const reason = record.error;
    return typeof reason === "string" && reason
      ? t("aiTool.failedWithReason", { intent, reason })
      : t("aiTool.failed", { intent });
  }

  const data = record.data as Record<string, unknown> | undefined;
  const detail = subject(data, t);
  const done = toolDoneLabel(name, t);
  return detail
    ? t("aiTool.resultWithDetail", { detail, done })
    : t("aiTool.resultPlain", { intent, done });
}
