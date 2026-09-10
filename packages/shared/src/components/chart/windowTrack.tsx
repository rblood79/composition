/**
 * ADR-211 창 트랙 — layout 이 예약한 자리 (플롯 아래) 에 얹는 뷰 상태 Slider.
 *
 * shared RAC `Slider` 를 그대로 쓴다 (변경 0): thumb 하나 · `0 … n − fitEff` · step 1 —
 * 화살표 1 슬롯, Home/End 끝, PageUp/Down 은 RAC 기본. 창 길이는 불변 (마지막 창은
 * `n − fitEff` 에서 시작).
 *
 * 이 모듈은 `Chart.tsx` (initial 번들) 만 import 한다 — lazy `RechartsChart` 청크가 shared
 * `Slider` 를 직접 import 하면 rolldown 이 Slider·Label·Skeleton 을 initial 과 lazy 가 같이
 * 읽는 별도 청크로 떼어내 gzip 순증 ~2.5 KiB 가 붙는다 (P4 실측). RechartsChart 는 render prop
 * 으로 받는다.
 */
import type { Rect } from "@composition/specs";
import type { ReactNode } from "react";
import { Slider } from "../Slider";

export const CHART_WINDOW_TRACK_LABEL = "Visible range";

export interface ChartWindowTrackProps {
  track: Rect;
  start: number;
  maxStart: number;
  onChange: (start: number) => void;
}

export type RenderChartWindowTrack = (
  props: ChartWindowTrackProps,
) => ReactNode;

export function ChartWindowTrack({
  track,
  start,
  maxStart,
  onChange,
}: ChartWindowTrackProps) {
  return (
    <Slider
      aria-label={CHART_WINDOW_TRACK_LABEL}
      className="chart-window-track"
      data-chart-window-start={start}
      data-chart-window-max={maxStart}
      minValue={0}
      maxValue={maxStart}
      step={1}
      value={start}
      onChange={(value) => onChange(Array.isArray(value) ? value[0] : value)}
      showValueLabel={false}
      style={{
        position: "absolute",
        left: track.x,
        top: track.y,
        width: track.w,
        height: track.h,
        // 라벨·값 행이 없다 — 트랙 한 줄을 예약 높이 가운데에 (thumb 18 이 24 안에 든다).
        gridTemplateAreas: '"track"',
        gridTemplateColumns: "1fr",
        gap: 0,
        alignContent: "center",
      }}
    />
  );
}

export const renderChartWindowTrack: RenderChartWindowTrack = (props) => (
  <ChartWindowTrack {...props} />
);
