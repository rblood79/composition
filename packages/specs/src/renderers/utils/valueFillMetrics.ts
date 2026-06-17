/**
 * Value-fill track metric 상수 — ProgressBar / Meter.
 *
 * **ADR-912 단계5 step4 경량 이관 (2026-06-17)**: ProgressBar.spec / Meter.spec 의
 * catalog cutover + 물리 삭제로, spec 파일이 보유하던 size별 track 높이 상수(barHeight)를 본
 * 모듈로 분리한다. Skia 시각(`value_fill_bar` skiaPrimitive escape)은 catalog rule 의 size 값을
 * 읽지만, layout intrinsic height 계산(builder `utils.ts` calculateContentHeight progress/meter
 * 분기)은 본 상수를 직접 소비한다. spec body(ComponentSpec 객체) 삭제와 무관하게 보존되어야 하므로
 * 본 모듈로 분리한다.
 *
 * **패키지 경계**: layout(builder)이 호출하므로 specs 내부에 둔다. catalog rule(shared/catalog)은
 * 같은 barHeight 값을 Skia 그리기용으로 보유하나(이미 spec.sizes 값 복사), specs → shared 역방향
 * import 는 금지이므로 본 모듈은 rule 을 참조하지 않고 상수로 유지한다. rule(Skia 그리기) ↔ 본
 * 상수(layout 높이)가 같은 값을 갖는 것이 D3 대칭의 조건.
 *
 * @packageDocumentation
 */

/**
 * ADR-912: ProgressBar size별 track 높이. componentRulesTable.ProgressBarTrack.sizes 정합.
 * 구 ProgressBar.spec.PROGRESSBAR_DIMENSIONS 에서 이관.
 */
export const PROGRESSBAR_DIMENSIONS: Record<string, { barHeight: number }> = {
  sm: { barHeight: 4 },
  md: { barHeight: 8 },
  lg: { barHeight: 12 },
  xl: { barHeight: 16 },
};

/**
 * ADR-912: Meter size별 track 높이. componentRulesTable.MeterTrack.sizes 정합.
 * 구 Meter.spec.METER_DIMENSIONS 에서 이관.
 */
export const METER_DIMENSIONS: Record<string, { barHeight: number }> = {
  sm: { barHeight: 4 },
  md: { barHeight: 8 },
  lg: { barHeight: 12 },
  xl: { barHeight: 16 },
};
