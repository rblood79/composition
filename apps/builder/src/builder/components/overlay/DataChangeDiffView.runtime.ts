/**
 * 데이터 proposal 승인 diff 뷰 — ADR-213 Phase 4 (AX-2 · R3 · R4, AgentReview 아트보드).
 *
 * `AgentCommandConfirmDialog` 가 `id === "data.propose"` 요청에 본문 대신 그린다. 요약은
 * `summarizeDataChange` (순수) 가 만들고 여기서는 문구만 붙인다: 테이블별 필드 추가/변경 ·
 * 행 삽입 수 + 샘플 3행 · 바인딩 변경 · endpoint 정의 (신규/변경) · "사용처 N" (152 역참조).
 * 되돌림 가능 표시는 다이얼로그 meta 줄 (undo: history) 이 이미 담당한다.
 */

import type { DataOp } from "@composition/shared";

import { getAiReadHost } from "../../../services/ai/aiReadHost";

import { type DataChangeSummaryContext } from "../../../services/ai/data/dataChangeSummary";

import { getDataToolReadModel } from "../../../services/ai/data/dataToolReadModel";

import "./DataChangeDiffView.css";

/**
 * 요약 컨텍스트 — data store 와 열린 Builder 의 문서 (AI read host, ADR-248 4e-5). 테스트는
 * `context` 를 직접 준다.
 */
export function readDataChangeSummaryContext(): DataChangeSummaryContext {
  const { collections, apiEndpoints, usage } = getDataToolReadModel();
  const elementTypes = new Map<string, string>();
  for (const element of getAiReadHost()?.elements() ?? []) {
    if (typeof element.type === "string")
      elementTypes.set(element.id, element.type);
  }
  return {
    collections,
    usage,
    endpointIds: new Set(apiEndpoints.map((e) => e.id)),
    elementTypes,
  };
}

export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export interface DataChangeDiffViewProps {
  ops: readonly DataOp[];
  /** 생략하면 store 에서 읽는다 */
  context?: DataChangeSummaryContext;
}
