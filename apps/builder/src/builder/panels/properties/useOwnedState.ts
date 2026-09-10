import { useCallback, useState } from "react";

/**
 * 요소(owner) 가 바뀌면 초기값으로 돌아가는 로컬 상태 (ADR-210 P4).
 *
 * `key={elementId}` 로 컨트롤을 remount 하면 같은 효과지만 RAC Select/Input 십여 개를 선택할 때마다
 * 다시 mount 해 Builder longtask 가 늘었다 (frame A/B 실측). 대신 owner 가 바뀐 렌더에서 상태를
 * 초기값으로 되돌린다 (React 의 "이전 렌더 정보 저장" 패턴 — 렌더 중 setState). key 와 같은 계약:
 * A → B → A 로 돌아와도 A 의 선택 화면·pending 통화는 남지 않는다 (P2 판독 MEDIUM).
 *
 * `initial` 은 안정된 값이어야 한다 (원시값 또는 모듈 상수).
 */
export function useOwnedState<T>(
  owner: string,
  initial: T,
): [T, (next: T | ((previous: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const [seenOwner, setSeenOwner] = useState(owner);
  if (seenOwner !== owner) {
    setSeenOwner(owner);
    setValue(initial);
  }
  const set = useCallback(
    (next: T | ((previous: T) => T)) => setValue(next),
    [],
  );
  // owner 가 바뀐 그 렌더에서는 아직 이전 값이 보이므로 초기값을 돌려준다.
  return [seenOwner === owner ? value : initial, set];
}
