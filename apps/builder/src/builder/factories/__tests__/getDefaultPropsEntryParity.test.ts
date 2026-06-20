/**
 * ADR-914 Phase 2 — Defaults Facet Proof parity (HC#5 diff fixture)
 *
 * `getDefaultProps(type)` 의 entry-derived 전환이 기존 literal row 출력을 회귀
 * 없이 재현하는지 검증한다. Hard Constraint #5 (literal default 제거는 diff fixture
 * 없이는 금지) 를 충족하는 fixture — row 삭제 *전* 에 통과시켜 pre-deletion 동작을
 * pin 하고, 삭제 *후* 에도 동일 통과해야 한다 (entry-derived 경로 == literal).
 *
 * Phase 2a scope: **Button 단일 proof family** (5종 derived 중 가장 안전한 1종으로
 * 7-step ownership-transfer 메커니즘을 먼저 검증). 나머지 4종(Badge/Link/
 * ToggleButton/Text)은 후속 slice. Icon 은 random iconName 회귀 위험으로 제외
 * (deriveDefaultPropsFromCatalog 가 iconName 미포함 → palette add 시 빈 아이콘).
 *
 * 2축 검증:
 *  - Parity A (HC#5): getDefaultProps(type) == DEFAULT_PROPS_ORACLE[type] (deep-equal
 *    + strict key-set). deep-equal 단독은 undefined-vs-absent 차이를 숨기므로
 *    (toEqual 이 {a:undefined} == {} 처리) key-set 비교를 병행한다.
 *  - Parity B: resolveComponentEntryRuntime(type).defaults.resolve() == getDefaultProps(type).
 *    entry facet 과 public accessor 가 동일 권한임을 증명.
 *
 * kill criteria: Parity A 또는 strict key-set 불일치 시 row 삭제 중단.
 *
 * 실행: pnpm -F @composition/builder exec vitest run src/builder/factories/__tests__/getDefaultPropsEntryParity.test.ts
 */

import { describe, it, expect } from "vitest";

import { resolveComponentEntryRuntime } from "@/builder/factories/entryUniverse";
import { getDefaultProps } from "@/types/builder/unified.types";
import { DEFAULT_PROPS_ORACLE } from "@/types/builder/__tests__/defaultPropsOracle";

// Phase 2a proof family (Button 단일). 후속 slice 에서 Badge/Link/ToggleButton/Text 확장.
const PROOF_FAMILY = ["Button"] as const;

const oracleByType = new Map(
  DEFAULT_PROPS_ORACLE.map((o) => [o.type, o] as const),
);

describe("ADR-914 Phase 2a — getDefaultProps Button entry-derived parity (HC#5)", () => {
  it("Parity A — getDefaultProps(Button) 가 oracle 과 deep-equal (비결정적 키 제외)", () => {
    for (const type of PROOF_FAMILY) {
      const oracle = oracleByType.get(type);
      expect(oracle, `${type} oracle 미정의`).toBeTruthy();
      const nonDet = new Set(oracle!.nonDeterministicKeys ?? []);

      const actual = getDefaultProps(type) as Record<string, unknown>;
      // 비결정적 키를 양쪽에서 제거 후 deep-equal.
      const stripNonDet = (o: Record<string, unknown>) => {
        const copy: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(o)) {
          if (!nonDet.has(k)) copy[k] = v;
        }
        return copy;
      };
      expect(stripNonDet(actual)).toEqual(stripNonDet(oracle!.props));
    }
  });

  it("Parity A strict key-set — undefined-vs-absent 함정 차단", () => {
    // toEqual 은 {a:undefined} 와 {} 를 같게 보므로, key 부재/present-but-undefined
    // 차이를 별도 key-set 비교로 잡는다 (hydration/DB 직렬화에서 다르게 처리됨).
    for (const type of PROOF_FAMILY) {
      const oracle = oracleByType.get(type)!;
      const nonDet = new Set(oracle.nonDeterministicKeys ?? []);
      const actualKeys = Object.keys(getDefaultProps(type))
        .filter((k) => !nonDet.has(k))
        .sort();
      const oracleKeys = Object.keys(oracle.props)
        .filter((k) => !nonDet.has(k))
        .sort();
      expect(actualKeys, `${type} key-set 불일치`).toEqual(oracleKeys);
    }
  });

  it("Parity B — entry facet resolve() == getDefaultProps()", () => {
    for (const type of PROOF_FAMILY) {
      const entry = resolveComponentEntryRuntime(type);
      const viaFacet = entry.defaults.resolve() as Record<string, unknown>;
      const viaAccessor = getDefaultProps(type) as Record<string, unknown>;
      expect(viaFacet).toEqual(viaAccessor);
    }
  });

  it("defaults facet source — Button 은 entry-derived, 비파생 type 은 map", () => {
    // 분기가 실제로 동작함을 증명 (all-derived / all-map 사고 차단).
    expect(resolveComponentEntryRuntime("Button").defaults.source).toBe(
      "entry-derived",
    );
    expect(resolveComponentEntryRuntime("TextField").defaults.source).toBe(
      "map",
    );
  });
});
