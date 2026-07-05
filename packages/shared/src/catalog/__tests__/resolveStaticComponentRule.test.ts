/**
 * ADR-916 P2-CAT ① — resolveStaticComponentRule (조항 4: doc override 타입 분리).
 *
 * `resolveComponentRule(type, doc?)` 은 doc.componentRules override 를 소비한다.
 * catalog 정적 참조 계약(스냅샷 빌더·조상 체인 propagation 소비자)은 theme rule
 * base **만** 읽어야 하므로(런타임 doc override 는 재빌드+재주입 Gate 대상, H3),
 * doc 파라미터가 물리적으로 없는 별도 진입점을 강제한다 → override 유입 =
 * compile error(grep gate 로의 강등 대신 타입 분리로 구조적 봉합).
 */
import { describe, it, expect } from "vitest";

import {
  resolveStaticComponentRule,
  getComponentRulesTable,
} from "../resolvers/resolveComponentRule";

describe("ADR-916 P2-CAT ① — resolveStaticComponentRule (조항 4)", () => {
  it("등록된 type 의 theme rule base 를 반환한다", () => {
    const rule = resolveStaticComponentRule("Avatar");
    expect(rule).toBeDefined();
    expect(rule?.defaultSize).toBe("md");
  });

  it("build-time 테이블 값과 동일하다 (doc override 경로 부재)", () => {
    const table = getComponentRulesTable();
    expect(resolveStaticComponentRule("Avatar")).toBe(table["Avatar"]);
  });

  it("미등록 type 은 undefined (Negative)", () => {
    expect(resolveStaticComponentRule("DoesNotExistComponent")).toBeUndefined();
  });

  it("doc 파라미터 유입은 compile error (조항 4 — 구조적 봉합)", () => {
    // @ts-expect-error — resolveStaticComponentRule 은 doc 파라미터를 받지 않는다.
    // 이 라인이 type-check 게이트에서 에러를 억제하지 못하면(=시그니처가 doc 을
    // 받게 되면) tsc 가 "unused @ts-expect-error" 로 실패시킨다 → 봉합 회귀 감지.
    resolveStaticComponentRule("Avatar", { componentRules: {} });
    expect(resolveStaticComponentRule("Avatar")).toBeDefined();
  });
});
