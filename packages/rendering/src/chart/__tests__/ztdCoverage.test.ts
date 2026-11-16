/**
 * ADR-306 G0 — ztd-charts 0.5.0 의 36 항목 · 채널 · 옵션 key 가 전부 분류됐는가 (breakdown §3).
 * key 목록 (`ztdRegistry.pinned.ts`) 은 원본 텍스트에서 옮긴 외부 oracle 이고 분류 (`ztdCoverage.fixture.ts`)
 * 와 따로 적는다 — 분류 쪽에서 key 를 빼거나 더하면 여기서 실패한다.
 */
import { describe, expect, it } from "vitest";
import { CHART_TYPES } from "../types";
import { ZTD_COMMON_OPTIONS, ZTD_REGISTRY } from "./ztdRegistry.pinned";
import { ZTD_CLASS, ZTD_COMMON_CLASS } from "./ztdCoverage.fixture";

const sorted = (keys: Iterable<string>) => [...keys].sort();

describe("ADR-306 G0 — ztd 0.5.0 분류 census", () => {
  it("36 항목을 그대로 분류한다", () => {
    expect(Object.keys(ZTD_REGISTRY)).toHaveLength(36);
    expect(sorted(Object.keys(ZTD_CLASS))).toEqual(
      sorted(Object.keys(ZTD_REGISTRY)),
    );
  });

  it("공통 옵션 key 전부가 분류됐다", () => {
    expect(sorted(Object.keys(ZTD_COMMON_CLASS))).toEqual(
      sorted(ZTD_COMMON_OPTIONS),
    );
  });

  it.each(Object.keys(ZTD_REGISTRY))(
    "%s — 채널 · 옵션 key 집합이 원본과 같다",
    (type) => {
      const pinned = ZTD_REGISTRY[type];
      const cls = ZTD_CLASS[type];
      expect(sorted(Object.keys(cls.channels))).toEqual(
        sorted(pinned.channels),
      );
      expect(sorted(Object.keys(cls.options))).toEqual(sorted(pinned.options));
    },
  );

  it("Phase 6 뒤 결정 대기 항목 0 — 공통 상호작용이 전부 채택 · 대응으로 닫혔다", () => {
    const open: string[] = [];
    for (const [key, c] of Object.entries(ZTD_COMMON_CLASS))
      if (c.kind === "decision") open.push(`common.${key}`);
    for (const [type, cls] of Object.entries(ZTD_CLASS))
      for (const [key, c] of Object.entries(cls.options))
        if (c.kind === "decision") open.push(`${type}.${key}`);
    expect(open).toEqual([]);
  });

  it("encoding 채널은 전부 채택이다 (Decision 8)", () => {
    for (const [type, cls] of Object.entries(ZTD_CLASS))
      for (const [key, c] of Object.entries(cls.channels))
        expect(c.kind, `${type}.${key}`).toBe("adopt");
  });

  it("채택 prop 이름은 비어 있지 않은 식별자다", () => {
    for (const cls of Object.values(ZTD_CLASS))
      for (const c of [
        ...Object.values(cls.channels),
        ...Object.values(cls.options),
      ])
        if (c.kind === "adopt") {
          expect(c.props.length).toBeGreaterThan(0);
          for (const p of c.props) expect(p).toMatch(/^[a-z][A-Za-z]*$/);
        }
  });

  it("제공 항목 = 기존 type 9 + 새 chartType 27 (family 5)", () => {
    const entries = Object.values(ZTD_CLASS);
    const existing = entries.filter((e) => e.family === null);
    const fresh = entries.filter((e) => e.family !== null);
    expect(existing).toHaveLength(9);
    for (const e of existing)
      expect(CHART_TYPES as readonly string[]).toContain(e.chartType);
    expect(new Set(fresh.map((e) => e.chartType)).size).toBe(27);
    const perFamily: Record<string, number> = {};
    for (const e of fresh)
      perFamily[e.family!] = (perFamily[e.family!] ?? 0) + 1;
    expect(perFamily).toEqual({
      category: 12,
      kpi: 3,
      distribution: 4,
      matrix: 4,
      network: 4,
    });
  });
});
