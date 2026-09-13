/**
 * ADR-214 — 이 요소에서 보이는 변수 (정의 + 소유자). Phase 3 의 이름 목록
 * (`useVisibleVariableNames`) 과 같은 입력 · 같은 가시성 규칙, 소유자까지 필요한 소비처
 * (Interactions setState picker · Phase 5 인덱스) 용.
 */
import { useMemo } from "react";
import {
  resolveVisibleVariables,
  type VariableDef,
  type VisibleVariable,
} from "@composition/shared";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { useDataStore } from "../../../stores/data";

/** 프로젝트 변수 정의 (VariableDef 형상, project 소유자만) — 가시성 · 충돌 검증 · 사용처 집계의 공통 입력 */
export function useProjectVariableDefs(): VariableDef[] {
  const variables = useDataStore((s) => s.variables);
  return useMemo(
    () =>
      Array.from(variables.values())
        .filter((v) => !v.owner || v.owner.kind === "project")
        .map((v) => ({
          id: v.id,
          name: v.name,
          type: v.type,
          ...(v.defaultValue !== undefined ? { defaultValue: v.defaultValue } : {}),
        })),
    [variables],
  );
}

export function useVisibleVariables(
  elementId: string | undefined,
): VisibleVariable[] {
  const document = useCanonicalDocumentStore((s) =>
    s.currentProjectId ? (s.documents.get(s.currentProjectId) ?? null) : null,
  );
  const variables = useDataStore((s) => s.variables);
  return useMemo(() => {
    const projectVariables: VariableDef[] = Array.from(variables.values())
      .filter((v) => !v.owner || v.owner.kind === "project")
      .map((v) => ({
        id: v.id,
        name: v.name,
        type: v.type,
        ...(v.defaultValue !== undefined ? { defaultValue: v.defaultValue } : {}),
      }));
    return resolveVisibleVariables(
      document,
      elementId ? { kind: "element", elementId } : null,
      projectVariables,
    );
  }, [document, variables, elementId]);
}
