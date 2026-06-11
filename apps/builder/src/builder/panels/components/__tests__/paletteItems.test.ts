// ADR-912 6 registry collapse — ComponentList 파생 proof (test-first)
//
// 목표: ComponentList 의 7 정적 배열(61 항목)을 catalog entry.panel 파생 + PALETTE_ONLY overlay 로
// 대체해도 palette 표시가 1:1 보존되는지(회귀 0) 검증. getPaletteItems() 파생 결과가
// PALETTE_ORACLE(현 palette 스냅샷)과 category/label/icon/layoutOnly/순서까지 같아야 한다.
//
// kill criteria: 파생 결과 ≠ oracle 이면 ComponentList 파생 전환 시 palette 회귀 → collapse 보류.

import { describe, expect, it } from "vitest";
import { PALETTE_ORACLE } from "./paletteOracle";
import { getPaletteItems, ICON_MAP } from "../paletteItems";

describe("ADR-912 collapse — getPaletteItems() == palette oracle (회귀 0)", () => {
  const derived = getPaletteItems();

  it("항목 수가 oracle 과 동일하다", () => {
    expect(derived.length).toBe(PALETTE_ORACLE.length);
  });

  it("type 집합이 oracle 과 동일하다 (palette O/catalog X 7 overlay 포함)", () => {
    const oracleTypes = new Set(PALETTE_ORACLE.map((p) => p.type));
    const derivedTypes = new Set(derived.map((p) => p.type));
    // 누락(파생에서 빠짐) = palette 회귀
    const missing = [...oracleTypes].filter((t) => !derivedTypes.has(t));
    // 잉여(의도치 않은 노출)
    const extra = [...derivedTypes].filter((t) => !oracleTypes.has(t));
    expect(
      missing,
      `파생에서 누락된 palette type (회귀): ${missing.join(", ")}`,
    ).toEqual([]);
    expect(extra, `파생이 추가 노출한 type: ${extra.join(", ")}`).toEqual([]);
  });

  it("각 type 의 (category, label, icon, layoutOnly) 가 oracle 과 1:1 일치한다", () => {
    const derivedByType = new Map(derived.map((p) => [p.type, p]));
    const mismatches: string[] = [];
    for (const o of PALETTE_ORACLE) {
      const d = derivedByType.get(o.type);
      if (!d) continue; // 누락은 위 테스트가 잡음
      if (d.category !== o.category)
        mismatches.push(
          `${o.type}.category: oracle=${o.category} derived=${d.category}`,
        );
      if (d.label !== o.label)
        mismatches.push(
          `${o.type}.label: oracle="${o.label}" derived="${d.label}"`,
        );
      // oracle.icon 은 lucide 식별자(string), derived.icon 은 lucide 컴포넌트.
      // oracle string 이 가리키는 lucide == derived 가 반환한 lucide 인지 검증.
      if (ICON_MAP[o.icon] !== d.icon)
        mismatches.push(
          `${o.type}.icon: oracle="${o.icon}" derived=${(d.icon as { displayName?: string }).displayName ?? "(unknown)"}`,
        );
      if (Boolean(d.layoutOnly) !== Boolean(o.layoutOnly))
        mismatches.push(
          `${o.type}.layoutOnly: oracle=${!!o.layoutOnly} derived=${!!d.layoutOnly}`,
        );
    }
    expect(mismatches, `panel 메타 불일치:\n${mismatches.join("\n")}`).toEqual(
      [],
    );
  });

  it("category 순서 + 항목 순서가 oracle 과 완전히 동일하다 (UI 표시 순서)", () => {
    // 순서까지 1:1 — palette UI 표시 순서 보존
    const oracleSeq = PALETTE_ORACLE.map((p) => `${p.category}/${p.type}`);
    const derivedSeq = derived.map((p) => `${p.category}/${p.type}`);
    expect(derivedSeq).toEqual(oracleSeq);
  });
});
