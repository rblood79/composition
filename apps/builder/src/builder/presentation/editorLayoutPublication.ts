import type { ComputedLayout } from "../workspace/canvas/layout/engines/LayoutEngine";

export interface PresentationTargetedLayoutPublication<T = ComputedLayout> {
  readonly kind: "presentation-targeted";
  readonly rootKey: string;
  readonly roots: readonly string[];
  readonly affectedNodeIds: ReadonlySet<string>;
  /** affected node만 보유한다. canonical base map을 복사하지 않는다. */
  readonly layoutDelta: ReadonlyMap<string, T>;
  readonly presentationRevision: number;
  readonly baseCanonicalRevision: number;
  /** 같은 계획에서 분할된 root publication을 함께 적용하기 위한 sequence. */
  readonly planSequence: number;
}
