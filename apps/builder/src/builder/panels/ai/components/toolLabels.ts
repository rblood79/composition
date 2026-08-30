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

export interface ToolLabel {
  /** 호출 시점 — "무엇을 하려는가" */
  readonly intent: string;
  /** 결과 시점 — "무엇이 됐는가" */
  readonly done: string;
}

export const TOOL_LABELS: Readonly<Record<string, ToolLabel>> = {
  create_element: { intent: "요소 생성", done: "생성함" },
  update_element: { intent: "요소 수정", done: "수정함" },
  delete_element: { intent: "요소 삭제", done: "삭제함" },
  get_editor_state: { intent: "화면 구성 확인", done: "확인함" },
  get_selection: { intent: "선택 확인", done: "확인함" },
  search_elements: { intent: "요소 검색", done: "찾음" },
  batch_design: { intent: "여러 곳 한번에 변경", done: "변경함" },
  bind_collection: { intent: "데이터 연결", done: "연결함" },
  create_interaction_rule: { intent: "동작 규칙 추가", done: "추가함" },
  run_command: { intent: "빌더 명령 실행", done: "실행함" },
};

/** 모르는 도구는 이름 그대로 — 삼키지 않는다. */
export function toolIntentLabel(name: string): string {
  return TOOL_LABELS[name]?.intent ?? name;
}

function toolDoneLabel(name: string): string {
  return TOOL_LABELS[name]?.done ?? `${name} 완료`;
}

/** 인자에서 사람이 읽을 한 조각만 뽑는다 — 전체 JSON 은 신입에게 소음이다. */
function subject(args: Record<string, unknown> | undefined): string | null {
  if (!args) return null;
  for (const key of ["type", "componentType", "commandId", "trigger", "tag"]) {
    const value = args[key];
    if (typeof value === "string" && value) return value;
  }
  const id = args.elementId;
  if (typeof id === "string" && id) {
    return id === "selected" ? "선택한 요소" : `${id.slice(0, 8)}…`;
  }
  return null;
}

/** 호출 시점 한 줄 — "요소 생성 · Button" */
export function describeToolCall(
  name: string,
  args?: Record<string, unknown>,
): string {
  const detail = subject(args);
  return detail
    ? `${toolIntentLabel(name)} · ${detail}`
    : toolIntentLabel(name);
}

/** 결과 시점 한 줄 — 실패는 이유를 그대로 보여준다 (숨기면 신입이 막힌다). */
export function describeToolResult(name: string, result: unknown): string {
  const record = (result ?? {}) as Record<string, unknown>;
  if (record.success === false) {
    const reason = record.error;
    return typeof reason === "string" && reason
      ? `${toolIntentLabel(name)} 실패 · ${reason}`
      : `${toolIntentLabel(name)} 실패`;
  }

  const data = record.data as Record<string, unknown> | undefined;
  const detail = subject(data);
  return detail
    ? `${detail} ${toolDoneLabel(name)}`
    : `${toolIntentLabel(name)} · ${toolDoneLabel(name)}`;
}
