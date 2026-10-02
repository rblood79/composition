import type { ComponentElementProps } from "../../types/builder/unified.types";

/** One element's props write in a batch (the old store's batch update entry). */
export interface BatchPropsUpdate {
  elementId: string;
  props: ComponentElementProps;
  /**
   * `props.style` 을 **부분 patch** 로 취급해 대상 요소의 현재 style 위에 덮는다 (기본은 통째 교체).
   *
   * 기본 교체 의미는 Inspector 의 style 편집 (키 삭제 포함) 이 의존하므로 바꿀 수 없다. 반면
   * propagation (`buildPropagationUpdates`) 이 만드는 patch 는 바꾸는 키 하나뿐이라, 교체로 적용하면
   * 자식의 나머지 style 이 사라진다 (r2 feh2). 이 자리에서만 병합으로 전환한다 — 생산자가 현재 style
   * 전체를 복사해 오면 `sanitizePropsPatch` 가 fill 파생 키 (backgroundColor 등) 를 patch 로 보고
   * 지워버리기 때문이다 (round 3 fe2m1).
   */
  mergeStyle?: boolean;
}
