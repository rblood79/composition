/**
 * ADR-214 Phase 3 — Properties 문자열 입력의 `{{` 자동완성 후보. ADR-248 4e-7: 출처는 필드 값 출처
 * (`FieldValueSource.useVariableNames`) 가 정하고, 없으면 프로젝트 변수 이름 (data store) 만 — 옛 canonical
 * 문서의 페이지 · 요소 변수는 `useVisibleVariableNames.legacy.ts`.
 *
 * 참조 안정 (같은 내용이면 같은 배열) — `PropertyInput` memo 비교가 stateNames 참조를 본다.
 */
import { useMemo, useRef } from "react";
import { useProjectVariableDefs } from "../../../stores/data";

const EMPTY: readonly string[] = Object.freeze([]);

/** Names in order, the same array while the content is the same. */
export function useStableNames(names: readonly string[]): readonly string[] {
  const previous = useRef<readonly string[]>(EMPTY);
  return useMemo(() => {
    if (
      names.length === previous.current.length &&
      names.every((n, i) => n === previous.current[i])
    )
      return previous.current;
    previous.current = names.length === 0 ? EMPTY : names;
    return previous.current;
  }, [names]);
}

/** The project variables' names (the data store's definitions). */
export function useProjectVariableNames(): readonly string[] {
  const defs = useProjectVariableDefs();
  const names = useMemo(() => {
    const out: string[] = [];
    for (const def of defs) if (!out.includes(def.name)) out.push(def.name);
    return out;
  }, [defs]);
  return useStableNames(names);
}
