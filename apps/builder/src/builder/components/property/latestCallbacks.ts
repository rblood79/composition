import {
  createElement,
  useInsertionEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";

type Callback = (...args: never[]) => unknown;

/**
 * memo 비교에서 콜백 prop 을 뺀 컨트롤에 **가장 최근 렌더의 콜백**을 이어 준다.
 *
 * Property 컨트롤은 값이 같으면 다시 렌더되지 않도록 `onChange` 를 비교에서 뺀다. 그러면
 * 컨트롤이 첫 렌더의 콜백을 계속 쥐고, 렌더 시점 상태로 배열 전체를 다시 쓰는 호출처가
 * 그 사이의 편집을 되돌린다 (2026-10-05 감사 H1). 이 래퍼는 memo 밖에서 매번 렌더되어
 * 최신 props 를 ref 에 담고, 안쪽에는 렌더마다 같은 proxy 를 넘긴다 — 안쪽 memo 비교는
 * 그대로 두고 호출만 최신 콜백으로 간다.
 */
export function withLatestCallbacks<P extends object>(
  Inner: ComponentType<P>,
  keys: readonly (keyof P)[],
): ComponentType<P> {
  function LatestCallbacks(props: P) {
    const latest = useRef(props);
    // 레이아웃 effect 보다 먼저 — 자식 effect 가 같은 commit 에 콜백을 불러도 최신 값을 본다.
    useInsertionEffect(() => {
      latest.current = props;
    });
    const [proxies] = useState(() => {
      const map = new Map<keyof P, Callback>();
      for (const key of keys) {
        map.set(key, (...args: never[]) =>
          (latest.current[key] as Callback | undefined)?.(...args),
        );
      }
      return map;
    });
    const next = { ...props };
    for (const key of keys) {
      if (typeof props[key] === "function") {
        next[key] = proxies.get(key) as P[keyof P];
      }
    }
    return createElement(Inner, next);
  }
  LatestCallbacks.displayName = `LatestCallbacks(${
    Inner.displayName ?? Inner.name ?? "Component"
  })`;
  return LatestCallbacks;
}
