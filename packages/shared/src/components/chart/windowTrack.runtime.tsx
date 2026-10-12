/**
 * ADR-211 창 트랙 — layout 이 예약한 자리 (플롯 아래) 에 얹는 뷰 상태 Slider.
 *
 * shared RAC `Slider` 를 그대로 쓴다 (변경 0). ADR-216: **thumb 둘** (`value: [start, end]`) ·
 * `0 … n` · step 1 — 화살표 1 슬롯, Home/End 끝, PageUp/Down 은 RAC 기본. 손잡이 = d3
 * `MODE_HANDLE` (한쪽 경계만), 채움 (thumb 사이) 드래그 = d3 `MODE_DRAG` (창 이동, 길이 보존 —
 * `dx` 를 `[−start, n − end]` 로 clamp). thumb 교차는 RAC 가 막고, 최소 창 (`min(fitEff, n)`) 은
 * 모델 (`clampWindowRange`, §2.3 — start 를 지키고 end 를 민다) 이 강제한다.
 *
 * 이 모듈은 `Chart.tsx` (initial 번들) 만 import 한다 — lazy `RechartsChart` 청크가 shared
 * `Slider` 를 직접 import 하면 rolldown 이 Slider·Label·Skeleton 을 initial 과 lazy 가 같이
 * 읽는 별도 청크로 떼어내 gzip 순증 ~2.5 KiB 가 붙는다 (P4 실측). RechartsChart 는 render prop
 * 으로 받는다.
 */
import type { Rect } from "@composition/rendering";

import { type ReactNode } from "react";

import { ChartWindowTrack } from "./windowTrack.components";

export const CHART_WINDOW_TRACK_LABEL = "Visible range";

export const CHART_WINDOW_THUMB_LABELS = ["Range start", "Range end"];

export interface ChartWindowTrackProps {
  track: Rect;
  start: number;
  /** 끝 (exclusive) */
  end: number;
  /** 범주 수 — Slider `maxValue` */
  n: number;
  /**
   * 창 변경 (clamp 전 값). 최소 창 위반은 모델이 §2.3 규약 (`end = start + min(fitEff, n)`, n 에서
   * 부족하면 start 축소) 으로 맞춘다 — 시작 thumb 을 최소 창에서 오른쪽으로 밀면 창이 통째로
   * 밀리고 (211 의 화살표 1 슬롯 그대로), 끝 thumb 은 최소보다 좁아지지 않는다.
   */
  onChange: (start: number, end: number) => void;
}

export type RenderChartWindowTrack = (
  props: ChartWindowTrackProps,
) => ReactNode;

export const renderChartWindowTrack: RenderChartWindowTrack = (props) => (
  <ChartWindowTrack {...props} />
);
