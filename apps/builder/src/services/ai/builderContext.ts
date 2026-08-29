/**
 * `BuilderContext` 조립 — **필요한 시점(턴 시작)에** canonical 정본에서 만든다.
 *
 * 이전에는 AIPanel 의 effect 가 스토어 변경마다 만들어 conversation store 에 넣어 두고,
 * `runAgent` 가 그 값을 읽었다. 두 가지가 걸렸다:
 *
 * 1. 패널이 mount 된 채 감춰지면 (`<Activity mode="hidden">` — effect 정지) 컨텍스트가
 *    null 로 남고, 그 상태의 제출은 **조용히 무시**됐다 (2026-08-29 재현:
 *    `[useAgentLoop] No context available` 경고만, 사용자 메시지조차 추가되지 않음).
 * 2. 출처가 `pageElementsSnapshot` — 레이어 트리용 **구조 전용** 캐시라 props-only
 *    변경에 갱신되지 않는다. 선택 요소의 props 는 프롬프트에 그대로 실리므로, 속성을
 *    바꾼 직후 물으면 변경 전 값이 모델에 갔다.
 *
 * 둘 다 "렌더 부수효과로 미리 만들어 둔다" 에서 나왔다. 도구가 쓰는 것과 **같은 정본**을
 * 쓰는 자리에서 읽으면 준비 안 됨 상태도, 낡은 값도 존재하지 않는다.
 */
import type { BuilderContext } from "../../types/integrations/chat.types";
import { getAiToolReadModel } from "./tools/canonicalToolReadModel";

/** 조립에 필요한 노드 모양만 — ADR-126: 신규 코드는 `Element` 대신 구조 계약을 쓴다. */
export interface BuilderContextNode {
  id: string;
  type: string;
  page_id?: string | null;
  parent_id?: string | null;
  deleted?: boolean;
  props?: unknown;
}

/** 조립 입력 — 도구 read model 과 같은 모양 (테스트에서 대체 가능). */
export interface BuilderContextSource {
  elements: readonly BuilderContextNode[];
  elementsById: ReadonlyMap<string, BuilderContextNode>;
  state: { currentPageId?: string | null; selectedElementId?: string | null };
}

export function buildBuilderContext(
  source: BuilderContextSource = getAiToolReadModel(),
): BuilderContext {
  const { elements, elementsById, state } = source;
  const currentPageId = state.currentPageId || "default";
  const selectedElementId = state.selectedElementId ?? undefined;
  const selected = selectedElementId
    ? elementsById.get(selectedElementId)
    : undefined;

  return {
    currentPageId,
    selectedElementId,
    elements: elements
      .filter((element) => !element.deleted && element.page_id === currentPageId)
      .map((element) => ({ id: element.id, type: element.type })),
    selectedElement: selected
      ? {
          id: selected.id,
          type: selected.type,
          props: selected.props as Record<string, unknown>,
          parent_id: selected.parent_id ?? null,
        }
      : undefined,
  };
}
