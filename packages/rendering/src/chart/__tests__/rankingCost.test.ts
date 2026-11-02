import { expect, it } from "vitest";
import { groupOthers } from "../budget";

it("others 순위는 범주 점수를 한 번만 계산하고 합계·동률 순서를 보존한다", () => {
  const count = 1000;
  let reads = 0;
  class CountedMap extends Map<number, number> {
    override get(key: number) {
      reads++;
      return super.get(key);
    }
  }
  const grid = {
    categories: Array.from({ length: count }, (_, i) => `c-${i}`),
    hasValues: true,
    series: Array.from({ length: 8 }, (_, si) => ({
      key: `s-${si}`,
      id: `s-${si}`,
      seriesIndex: si,
      values: new CountedMap(
        Array.from({ length: count }, (_, ci) => [
          ci,
          ((ci * 7919 + si * 31) % 997) - 500,
        ]),
      ),
    })),
  };
  const scores = grid.categories.map((_, ci) =>
    grid.series.reduce(
      (sum, series) => sum + Math.abs(series.values.get(ci) ?? 0),
      0,
    ),
  );
  const ranking = scores
    .map((_, i) => i)
    .sort((a, b) => scores[b] - scores[a] || a - b);
  reads = 0;
  const result = groupOthers(grid, 20, "Other");
  expect(result.ranking).toEqual(ranking);
  // 점수 산출과 남긴/합친 범주 읽기 각각 한 번.
  expect(reads).toBeLessThanOrEqual(count * grid.series.length * 2);
  expect(result.categories).toHaveLength(20);
  for (const [si, series] of result.series.entries()) {
    const total = [...grid.series[si].values.values()].reduce(
      (sum, value) => sum + value,
      0,
    );
    expect(
      [...series.values.values()].reduce((sum, value) => sum + value, 0),
    ).toBe(total);
  }
});
