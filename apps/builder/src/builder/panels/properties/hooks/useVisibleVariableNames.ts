/**
 * ADR-214 Phase 3 — Properties 문자열 입력의 `{{` 자동완성 후보: 이 요소에서 보이는 변수 이름
 * (요소 → 조상 → 페이지 → 프로젝트, shared `resolveVisibleVariables` — 한 이름 = 한 변수 HC5).
 * 참조 안정 (같은 내용이면 같은 배열) — `PropertyInput` memo 비교가 stateNames 참조를 본다.
 */
import { useMemo, useRef } from "react";
import { resolveVisibleVariables, type VariableDef } from "@composition/shared";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { useDataStore } from "../../../stores/data";

const EMPTY: readonly string[] = Object.freeze([]);

export function useVisibleVariableNames(
  elementId: string | undefined,
): readonly string[] {
  const document = useCanonicalDocumentStore((s) =>
    s.currentProjectId ? (s.documents.get(s.currentProjectId) ?? null) : null,
  );
  const variables = useDataStore((s) => s.variables);
  const previous = useRef<readonly string[]>(EMPTY);
  return useMemo(() => {
    const projectVariables: VariableDef[] = Array.from(variables.values())
      .filter((v) => !v.owner || v.owner.kind === "project")
      .map((v) => ({ id: v.id, name: v.name, type: v.type }));
    const visible = resolveVisibleVariables(
      document,
      elementId ? { kind: "element", elementId } : null,
      projectVariables,
    );
    const names: string[] = [];
    for (const entry of visible)
      if (!names.includes(entry.def.name)) names.push(entry.def.name);
    if (
      names.length === previous.current.length &&
      names.every((n, i) => n === previous.current[i])
    )
      return previous.current;
    previous.current = names.length === 0 ? EMPTY : names;
    return previous.current;
  }, [document, variables, elementId]);
}
