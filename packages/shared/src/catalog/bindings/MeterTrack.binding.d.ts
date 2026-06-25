import type { PrimitiveBinding } from "../types";
/**
 * MeterTrack — Meter compound 의 value 채움 막대 (Skia-전용 sub-part).
 *
 * **DOM no-op (ADR-912 선행-2, 2026-06-04)**: DOM 에서 Meter 는 RAC `<Meter>` 단일
 *   컴포넌트로 track+fill 을 내부 렌더한다. 부모 Meter 가 자식 element 를 DOM 트리에서
 *   순회하지 않으므로 MeterTrack 자식 노드는 DOM 에 렌더되지 않는다 → source.renderer
 *   는 DOM 미도달. Skia 만 MeterTrack 노드를 그린다([[ProgressBarTrack]] 동형 비대칭).
 *
 * **Skia = value_fill_bar escape**: track box(buildCatalogShapes) 위에 value 비례 채움
 *   막대. value/isIndeterminate 는 props(resolveProgressProps 주입), 채움 색은 variant 별
 *   rule.fillBar (informative/positive/notice/negative — Meter 상태 색). ProgressBarTrack 과
 *   동일 escape 키, 차이는 variant 4종의 fillBar 색뿐(컴포넌트 분기 0 — no-classification).
 */
export declare const meterTrackBinding: PrimitiveBinding;
//# sourceMappingURL=MeterTrack.binding.d.ts.map