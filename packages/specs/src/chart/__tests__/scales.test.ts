/**
 * ADR-194 Phase 2 G2 — 스케일·눈금 경계.
 *
 * 경계 4종(음수 / 0 / 단일값 / NaN)이 **예외가 아니라 유한한 결과**로 접히는지가
 * 계약이다. 여기서 NaN 이 새면 path `d` 문자열에 "NaN" 이 실려 Skia 가 통째로
 * 미렌더하고 (MakeFromSVGString → null) DOM 은 콘솔 경고만 내는 비대칭이 된다.
 */
import { describe, it, expect } from "vitest";
import {
  approxTextWidth,
  bandScale,
  formatTick,
  linearScale,
  niceTicks,
  r2,
  toFiniteNumber,
} from "../scales";

describe("linearScale", () => {
  it("domain 을 range 로 선형 매핑한다 (역방향 range 포함)", () => {
    const s = linearScale([0, 100], [200, 0]);
    expect(s(0)).toBe(200);
    expect(s(100)).toBe(0);
    expect(s(50)).toBe(100);
  });

  it("domain 폭 0 은 range 중앙으로 접는다 (0 나눗셈 → NaN 차단)", () => {
    const s = linearScale([5, 5], [0, 80]);
    expect(s(5)).toBe(40);
    expect(Number.isFinite(s(5))).toBe(true);
  });

  it("비유한 입력도 유한 좌표를 낸다", () => {
    const s = linearScale([0, 10], [0, 100]);
    expect(Number.isFinite(s(NaN))).toBe(true);
    expect(Number.isFinite(s(Infinity))).toBe(true);
  });
});

describe("bandScale", () => {
  it("범주를 균등 분할하고 padding 만큼 좁힌다", () => {
    const b = bandScale(4, [0, 400], 0.2);
    expect(b.step).toBe(100);
    expect(b.bandwidth).toBe(80);
    expect(b.at(0)).toBe(10);
    expect(b.at(3)).toBe(310);
  });

  it("범주 0개는 bandwidth 0 (호출부가 empty 로 갈린다)", () => {
    const b = bandScale(0, [0, 400]);
    expect(b.bandwidth).toBe(0);
    expect(b.count).toBe(0);
  });
});

describe("niceTicks — 경계", () => {
  it("일반 범위는 1/2/5×10ⁿ 눈금을 낸다", () => {
    expect(niceTicks(0, 100, 5).ticks).toEqual([0, 20, 40, 60, 80, 100]);
    expect(niceTicks(0, 10, 5).ticks).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it("음수 포함 범위는 0 을 지난다", () => {
    const { domain, ticks } = niceTicks(-30, 70, 5);
    expect(domain[0]).toBeLessThanOrEqual(-30);
    expect(domain[1]).toBeGreaterThanOrEqual(70);
    expect(ticks).toContain(0);
  });

  it("단일값 v(≠0) 는 0 과 v 를 담는 폭 있는 domain 이 된다", () => {
    const { domain, ticks } = niceTicks(42, 42, 5);
    expect(domain[1] - domain[0]).toBeGreaterThan(0);
    expect(domain[0]).toBeLessThanOrEqual(42);
    expect(domain[1]).toBeGreaterThanOrEqual(42);
    expect(ticks.length).toBeGreaterThan(1);
  });

  it("단일값 0 은 [0,1]", () => {
    expect(niceTicks(0, 0, 5)).toEqual({ domain: [0, 1], ticks: [0, 0.5, 1] });
  });

  it("음의 단일값도 폭 있는 domain (하한이 값보다 작다)", () => {
    const { domain } = niceTicks(-7, -7, 5);
    expect(domain[0]).toBeLessThanOrEqual(-7);
    expect(domain[1]).toBeGreaterThanOrEqual(-7);
    expect(domain[1] - domain[0]).toBeGreaterThan(0);
  });

  it("NaN/Infinity 는 [0,1] 로 접힌다", () => {
    expect(niceTicks(NaN, 10).domain).toEqual([0, 1]);
    expect(niceTicks(0, Infinity).domain).toEqual([0, 1]);
  });

  it("count ≤ 0 이어도 눈금이 최소 2개는 나온다", () => {
    expect(niceTicks(0, 100, 0).ticks.length).toBeGreaterThanOrEqual(2);
  });

  it("모든 눈금이 유한하고 domain 안에 있다 (무작위 100케이스)", () => {
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 100; i++) {
      const a = (rand() - 0.5) * 10 ** Math.floor(rand() * 6);
      const b = (rand() - 0.5) * 10 ** Math.floor(rand() * 6);
      const { domain, ticks } = niceTicks(Math.min(a, b), Math.max(a, b), 5);
      expect(Number.isFinite(domain[0])).toBe(true);
      expect(Number.isFinite(domain[1])).toBe(true);
      expect(ticks.length).toBeGreaterThan(0);
      for (const t of ticks) {
        expect(Number.isFinite(t)).toBe(true);
        expect(t).toBeGreaterThanOrEqual(domain[0] - 1e-6);
        expect(t).toBeLessThanOrEqual(domain[1] + 1e-6);
      }
    }
  });
});

describe("보조 함수", () => {
  it("toFiniteNumber — 숫자 문자열은 받고 나머지는 null", () => {
    expect(toFiniteNumber(3)).toBe(3);
    expect(toFiniteNumber("4.5")).toBe(4.5);
    expect(toFiniteNumber("")).toBeNull();
    expect(toFiniteNumber("abc")).toBeNull();
    expect(toFiniteNumber(null)).toBeNull();
    expect(toFiniteNumber(NaN)).toBeNull();
  });

  it("formatTick — locale 무관 en-US 고정 (두 consumer 문자열 동일)", () => {
    expect(formatTick(1234.5)).toBe("1,234.5");
    expect(formatTick(0)).toBe("0");
    expect(formatTick(NaN)).toBe("");
  });

  it("r2 — 소수 2자리 고정", () => {
    expect(r2(1 / 3)).toBe(0.33);
    expect(r2(10)).toBe(10);
  });

  it("approxTextWidth — 길이·폰트에 비례", () => {
    expect(approxTextWidth("", 12)).toBe(0);
    expect(approxTextWidth("abcd", 10)).toBe(22);
  });
});
