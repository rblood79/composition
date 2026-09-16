/**
 * ADR-214 — 이 요소에서 보이는 변수 (정의 + 소유자). Phase 3 의 이름 목록
 * (`useVisibleVariableNames`) 과 같은 입력 · 같은 가시성 규칙, 소유자까지 필요한 소비처
 * (Interactions setState picker · Phase 5 인덱스) 용.
 */
import { useMemo } from "react";
import { resolveVisibleVariables, type VisibleVariable } from "@composition/shared";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { useProjectVariableDefs } from "../../../stores/data";

/** 프로젝트 변수 정의 (VariableDef 형상, project 소유자만) — 정본은 data store 의 훅 하나. */
export { useProjectVariableDefs };

export function useVisibleVariables(
  elementId: string | undefined,
): VisibleVariable[] {
  const document = useCanonicalDocumentStore((s) =>
    s.currentProjectId ? (s.documents.get(s.currentProjectId) ?? null) : null,
  );
  const projectVariables = useProjectVariableDefs();
  return useMemo(
    () =>
      resolveVisibleVariables(
        document,
        elementId ? { kind: "element", elementId } : null,
        projectVariables,
      ),
    [document, projectVariables, elementId],
  );
}
