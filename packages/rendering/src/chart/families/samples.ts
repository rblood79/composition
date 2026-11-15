/**
 * ADR-306 Phase 4 — 표본 행 생성의 seed 난수 · 정규 분포. ztd-charts 0.5.0 `src/spec/samples.ts`
 * (`seeded` LCG · `gauss` Box-Muller) 의 식을 그대로 옮겼다 — 표본이 실행마다 같다.
 *
 * 출처: https://github.com/Junhan2/ztd-charts `3c4376cda61361d630ae4cc7bd472af64ba30d2e`
 * MIT License — Copyright (c) Junhan2 and contributors.
 */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function gauss(rnd: () => number): number {
  const u = Math.max(1e-9, rnd());
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
