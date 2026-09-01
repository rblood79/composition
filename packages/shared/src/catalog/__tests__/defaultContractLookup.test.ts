import { describe, expect, it } from "vitest";

import {
  getComponentRulesTable,
  getPrimitiveBinding,
  resolveBindingPropDefault,
  resolveComponentRuleByTag,
} from "../index";
import { toRacProps } from "../outputs/toRacProps";
import type { CanonicalNode } from "../../types/composition-document.types";

/**
 * ADR-923 Phase 3 r22m1 — prop 부재 기본값 조회의 단일 원천.
 *
 * `toRacProps` 는 props 에 키가 없으면 `accepts[key].default` 를 채워 컴포넌트에 넘긴다. layout
 * (Skia) 도 같은 값을 써야 같은 canonical 입력이 두 표면에서 같은 상자가 된다 — 소비처가 자기
 * 리터럴을 들면 prop 없는 입력에서만 갈린다 (Table 400 vs 300). layout 은 lowercase 태그로
 * 동작하므로 두 조회 모두 casing 을 흡수한다.
 */
describe("resolveBindingPropDefault — binding accepts default 조회", () => {
  it("Pascal · lowercase 둘 다 같은 값 (Table 높이 축)", () => {
    expect(resolveBindingPropDefault("Table", "height")).toBe(400);
    expect(resolveBindingPropDefault("table", "height")).toBe(400);
    expect(resolveBindingPropDefault("Table", "heightMode")).toBe("fixed");
    expect(resolveBindingPropDefault("table", "heightMode")).toBe("fixed");
  });

  it("toRacProps 가 prop 부재에 채우는 값과 같다", () => {
    const binding = getPrimitiveBinding("Table")!;
    const node = {
      id: "t1",
      type: "Table",
      props: {},
    } as unknown as CanonicalNode;
    const racProps = toRacProps(node, binding);
    expect(racProps.height).toBe(resolveBindingPropDefault("Table", "height"));
    expect(racProps.heightMode).toBe(
      resolveBindingPropDefault("Table", "heightMode"),
    );
  });

  it("미등록 타입 · 미선언 키는 undefined", () => {
    expect(resolveBindingPropDefault("Table", "notAProp")).toBeUndefined();
    expect(resolveBindingPropDefault("NotAComponent", "height")).toBeUndefined();
  });
});

describe("resolveComponentRuleByTag — lowercase 태그 rule 조회", () => {
  it("Badge / Select 의 defaultSize 를 casing 무관하게 준다", () => {
    expect(resolveComponentRuleByTag("badge")?.defaultSize).toBe("sm");
    expect(resolveComponentRuleByTag("Badge")?.defaultSize).toBe("sm");
    expect(resolveComponentRuleByTag("select")?.defaultSize).toBe("md");
  });

  it("테이블 전 타입에서 lowercase 조회가 Pascal 조회와 같은 rule", () => {
    for (const type of Object.keys(getComponentRulesTable())) {
      expect(
        resolveComponentRuleByTag(type.toLowerCase()),
        type,
      ).toBe(getComponentRulesTable()[type]);
    }
  });

  it("미등록 태그는 undefined", () => {
    expect(resolveComponentRuleByTag("notacomponent")).toBeUndefined();
  });
});
