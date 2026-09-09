import { monotoneTangents } from "@composition/specs";
import type { ChartOrientation } from "@composition/specs";
import type { CurveProps } from "recharts";

type CurveFactory = Exclude<NonNullable<CurveProps["type"]>, string>;

/** Recharts 공개 curve factory에서 기존 Canvas의 접선 규약을 유지한다. */
export function createLegacyMonotone(
  orientation: ChartOrientation,
  curve: "monotone" | "step" | "linear" = "monotone",
): CurveFactory {
  return (context) => {
    let points: Array<{ along: number; across: number }> = [];
    let area = false;
    let boundary = 0;
    const screen = (along: number, across: number): [number, number] =>
      orientation === "horizontal" ? [across, along] : [along, across];
    return {
      areaStart() {
        area = true;
        boundary = 0;
      },
      areaEnd() {
        area = false;
      },
      lineStart() {
        points = [];
      },
      lineEnd() {
        if (points.length === 0) return;
        const start = screen(points[0].along, points[0].across);
        if (area && boundary === 1) context.lineTo(...start);
        else context.moveTo(...start);
        if (points.length === 1 && !area) context.lineTo(...start);
        const tangents = monotoneTangents(
          points.map((p) => p.along),
          points.map((p) => p.across),
        );
        for (let i = 1; i < points.length; i++) {
          const prev = points[i - 1];
          const point = points[i];
          if (curve === "linear") {
            context.lineTo(...screen(point.along, point.across));
            continue;
          }
          if (curve === "step") {
            const middle = (prev.along + point.along) / 2;
            context.lineTo(...screen(middle, prev.across));
            context.lineTo(...screen(middle, point.across));
            context.lineTo(...screen(point.along, point.across));
            continue;
          }
          const delta = (point.along - prev.along) / 3;
          context.bezierCurveTo(
            ...screen(
              prev.along + delta,
              prev.across + tangents[i - 1] * delta,
            ),
            ...screen(point.along - delta, point.across - tangents[i] * delta),
            ...screen(point.along, point.across),
          );
        }
        if (area && boundary === 1) context.closePath();
        boundary = (boundary + 1) % 2;
      },
      point(x: number, y: number) {
        points.push(
          orientation === "horizontal"
            ? { along: y, across: x }
            : { along: x, across: y },
        );
      },
    };
  };
}

export const legacyMonotoneVertical: CurveFactory =
  createLegacyMonotone("vertical");
export const legacyMonotoneHorizontal: CurveFactory =
  createLegacyMonotone("horizontal");

export const legacyStepHorizontal: CurveFactory = createLegacyMonotone("horizontal", "step");

export const legacyLinear: CurveFactory = createLegacyMonotone("vertical", "linear");
export const legacyStepVertical: CurveFactory = createLegacyMonotone("vertical", "step");
