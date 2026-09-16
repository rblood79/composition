/**
 * ADR-214 Phase 3 — Properties 문자열 입력의 `{{` 자동완성 후보: 이 요소에서 보이는 변수 이름
 * (요소 → 조상 → 페이지 → 프로젝트, shared `resolveVisibleVariables` — 한 이름 = 한 변수 HC5).
 * 가시성 해석은 `useVisibleVariables` 하나 — 여기는 이름 투영 + 참조 안정 (같은 내용이면 같은
 * 배열) 만 더한다. `PropertyInput` memo 비교가 stateNames 참조를 본다.
 */
import { useMemo, useRef } from "react";
import { useVisibleVariables } from "./useVisibleVariables";

const EMPTY: readonly string[] = Object.freeze([]);

export function useVisibleVariableNames(
  elementId: string | undefined,
): readonly string[] {
  const visible = useVisibleVariables(elementId);
  const previous = useRef<readonly string[]>(EMPTY);
  return useMemo(() => {
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
  }, [visible]);
}
