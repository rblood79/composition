/**
 * StateIcon — boolean 토글의 아이콘 (ADR-197 Phase 2)
 *
 * 호출부는 "어느 쪽이 켜짐인지" 를 해석하지 않는다: `pair` 와 `on` 만 넘기면
 * 레지스트리의 index 1 이 활성 형태다. 짝이 없는 토글은 애초에 키가 없으므로
 * 이 컴포넌트를 쓸 수 없고, 그것이 의도된 fallback (정적 아이콘 유지) 이다.
 */

import type { MorphIconProps } from "./MorphIcon";
import { MorphIcon } from "./MorphIcon";
import type { IconStatePair } from "./statePairs";
import { ICON_STATE_PAIRS } from "./statePairs";

export interface StateIconProps extends Omit<MorphIconProps, "icon"> {
  pair: IconStatePair;
  on: boolean;
}

export function StateIcon({ pair, on, ...rest }: StateIconProps) {
  const [off, active] = ICON_STATE_PAIRS[pair];
  return <MorphIcon icon={on ? active : off} {...rest} />;
}
