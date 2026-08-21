// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ProgressCircle } from "@composition/shared/components";

/**
 * design-data 감사 §1-3 형제 대칭 (2026-08-21) — DOM leg 의 minValue/maxValue 정규화.
 * Skia leg(value_fill_arc)는 packages/specs 의 skiaPrimitives.progressCircleMinMax.test.ts,
 * 본 테스트는 DOM SVG(stroke-dashoffset) + aria 가 같은 (value-min)/(max-min) 공식을
 * 쓰는지 확증한다 (구 0-100 하드코딩 회귀 게이트).
 */

function fractionOf(container: HTMLElement): number | null {
  const circles = container.querySelectorAll("circle");
  const ind = circles[1];
  if (!ind) return null;
  const da = parseFloat(ind.getAttribute("stroke-dasharray") || "0");
  const doff = parseFloat(ind.getAttribute("stroke-dashoffset") || "0");
  return da ? (da - doff) / da : null;
}

describe("ProgressCircle DOM minValue/maxValue (§1-3, 2026-08-21)", () => {
  it("min 50 / max 150 / value 100 → 50% 호 + aria min/max/now", () => {
    const { container } = render(
      <ProgressCircle value={100} minValue={50} maxValue={150} />,
    );
    const pc = container.querySelector('[role="progressbar"]')!;
    expect(pc.getAttribute("aria-valuemin")).toBe("50");
    expect(pc.getAttribute("aria-valuemax")).toBe("150");
    expect(pc.getAttribute("aria-valuenow")).toBe("100");
    expect(fractionOf(container)!).toBeCloseTo(0.5, 5);
  });

  it("기본 0-100 유지: value 25 → 25%", () => {
    const { container } = render(<ProgressCircle value={25} />);
    expect(fractionOf(container)!).toBeCloseTo(0.25, 5);
  });

  it("value 가 min 이하 → indicator 미렌더 (fraction 0)", () => {
    const { container } = render(
      <ProgressCircle value={10} minValue={50} maxValue={150} />,
    );
    expect(fractionOf(container)).toBeNull();
  });

  it("span<=0 방어: min==max → indicator 미렌더", () => {
    const { container } = render(
      <ProgressCircle value={50} minValue={100} maxValue={100} />,
    );
    expect(fractionOf(container)).toBeNull();
  });
});
