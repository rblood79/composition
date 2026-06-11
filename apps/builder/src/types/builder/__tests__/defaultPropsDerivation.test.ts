// ADR-912 6 registry collapse §2-5 #3 — Factory/default props 파생 proof (test-first)
//
// 목표: createDefault*Props 손-코딩(unified.types.ts)을 catalog binding accepts.default 파생 +
// builder-local overlay 로 대체해도 컴포넌트 초기 props 가 목표값(factory ∪ catalog)과 1:1
// 일치하는지(회귀 0) 검증. deriveDefaultPropsFromCatalog(type) 결과가 DEFAULT_PROPS_ORACLE 과
// 같은 키/값(Icon.iconName 등 비결정적 키 제외)이어야 한다.
//
// kill criteria: 파생 결과 ≠ oracle 이면 factory 파생 전환 시 초기 props 회귀 → collapse 보류.

import { describe, expect, it } from "vitest";
import { DEFAULT_PROPS_ORACLE } from "./defaultPropsOracle";
import {
  CATALOG_DERIVED_DEFAULT_TYPES,
  deriveDefaultPropsFromCatalog,
} from "../defaultPropsDerivation";

describe("ADR-912 collapse #3 — deriveDefaultPropsFromCatalog() == factory default oracle (회귀 0)", () => {
  it("proof family 전체가 CATALOG_DERIVED_DEFAULT_TYPES 에 등록되어 있다", () => {
    for (const o of DEFAULT_PROPS_ORACLE) {
      expect(
        CATALOG_DERIVED_DEFAULT_TYPES.has(o.type),
        `${o.type} 가 CATALOG_DERIVED_DEFAULT_TYPES 미등록`,
      ).toBe(true);
    }
  });

  it("각 type 의 파생 props 가 oracle 과 1:1 일치한다 (비결정적 키 제외)", () => {
    const mismatches: string[] = [];
    for (const o of DEFAULT_PROPS_ORACLE) {
      const derived = deriveDefaultPropsFromCatalog(o.type) as Record<
        string,
        unknown
      >;
      const nonDet = new Set(o.nonDeterministicKeys ?? []);

      // oracle 의 모든 키가 derived 에 같은 값으로 존재
      for (const key of Object.keys(o.props)) {
        if (nonDet.has(key)) continue;
        if (derived[key] !== o.props[key]) {
          mismatches.push(
            `${o.type}.${key}: oracle=${JSON.stringify(o.props[key])} derived=${JSON.stringify(derived[key])}`,
          );
        }
      }
      // derived 에 oracle 밖 잉여 키가 없어야(비결정적 키 제외)
      for (const key of Object.keys(derived)) {
        if (nonDet.has(key)) continue;
        if (!(key in o.props)) {
          mismatches.push(
            `${o.type}.${key}: derived 잉여(oracle 미정의)=${JSON.stringify(derived[key])}`,
          );
        }
      }
    }
    expect(
      mismatches,
      `factory default 파생 불일치:\n${mismatches.join("\n")}`,
    ).toEqual([]);
  });

  it("파생 base 에 style 키가 누출되지 않는다 (catalog 무관 영구 잔여)", () => {
    // style 은 factory 가 합성하는 builder-local — 파생 메커니즘이 만들면 안 됨(회귀 신호)
    for (const o of DEFAULT_PROPS_ORACLE) {
      const derived = deriveDefaultPropsFromCatalog(o.type) as Record<
        string,
        unknown
      >;
      expect(
        "style" in derived,
        `${o.type} 파생에 style 키 누출 — catalog base 오염`,
      ).toBe(false);
    }
  });
});
