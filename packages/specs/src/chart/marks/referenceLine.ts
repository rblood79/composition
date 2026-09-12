/**
 * ADR-217 — 값 축 기준선 (RSC `ReferenceLine` 의 값 축 부분집합).
 *
 * 위치는 `value(v)` 하나다 (RSC `getPositionEncoding` = `scale(value)`). domain 은 이미 값을
 * 포함하도록 넓어져 있어 (`valueExtent(…, referenceValues)`) 선은 항상 plot 안이다. 라벨은 선
 * 끝 **안쪽** (세로 차트 = 오른쪽 위, 수평 차트 = 위쪽 오른쪽) — RSC 의 "축 위 라벨 + 눈금
 * 숨김" 은 여백 재계산이 따라와 채택하지 않았다 (breakdown §2.2).
 *
 * `layer` 는 두 묶음으로 돌려준다 — scene 이 `back` 을 데이터 마크 앞에, `front` 를 값 라벨
 * 뒤에 끼운다 (두 consumer 가 `marks` 순서대로 그리므로 같은 겹침).
 */
import type { LinearScale } from "../scales";
import { r2 } from "../scales";
import type { ResolvedReferenceLine } from "../presentation";
import type {
  ChartLineType,
  ChartOrientation,
  LineMark,
  Mark,
  Rect,
  TextMark,
} from "../types";

/** 기준선 토큰 fallback (rule `chart.reference` 미보유 spec) — RSC gray-800 상당. */
export const CHART_REFERENCE_FALLBACK_TOKEN = "{color.neutral}";

/** 파선 패턴 — Skia `strokeDasharray` · DOM `stroke-dasharray` 같은 배열. */
export const CHART_REFERENCE_DASH: Readonly<
  Record<ChartLineType, readonly number[] | undefined>
> = {
  solid: undefined,
  dashed: [6, 4],
  dotted: [2, 3],
};

export interface ReferenceLineInput {
  lines: readonly ResolvedReferenceLine[];
  /** 값 축 스케일 — 세로 차트는 y, 수평 차트는 x 로 푼다. */
  value: LinearScale;
  plot: Rect;
  orientation: ChartOrientation;
  fontSize: number;
}

export interface ReferenceLineMarks {
  back: Mark[];
  front: Mark[];
}

export function buildReferenceLineMarks(
  input: ReferenceLineInput,
): ReferenceLineMarks {
  const { lines, value, plot, orientation, fontSize } = input;
  const out: ReferenceLineMarks = { back: [], front: [] };
  if (lines.length === 0) return out;
  const horizontal = orientation === "horizontal";
  const gap = r2(fontSize * 0.3);
  const x0 = plot.x;
  const x1 = r2(plot.x + plot.w);
  const y0 = plot.y;
  const y1 = r2(plot.y + plot.h);
  for (const line of lines) {
    const at = r2(value(line.value));
    const dash = CHART_REFERENCE_DASH[line.lineType];
    const mark: LineMark = horizontal
      ? { kind: "line", x1: at, y1: y0, x2: at, y2: y1, role: "reference" }
      : { kind: "line", x1: x0, y1: at, x2: x1, y2: at, role: "reference" };
    if (dash) mark.dash = dash;
    const bucket = line.layer === "back" ? out.back : out.front;
    bucket.push(mark);
    if (line.label === undefined) continue;
    const label: TextMark = horizontal
      ? {
          kind: "text",
          x: r2(at + gap),
          y: r2(y0 + gap),
          text: line.label,
          anchor: "start",
          baseline: "top",
          role: "reference",
        }
      : {
          kind: "text",
          x: r2(x1 - gap),
          y: r2(at - gap),
          text: line.label,
          anchor: "end",
          baseline: "bottom",
          role: "reference",
        };
    bucket.push(label);
  }
  return out;
}
