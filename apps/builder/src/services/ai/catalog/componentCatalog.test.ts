/**
 * ADR-134 G5 — AI 카탈로그가 catalog SSOT 의 **파생**인가.
 *
 * 여기서 확인하는 것은 "카탈로그에 무엇이 적혀 있는가" 가 아니라 "적힌 것이 SSOT 에서
 * 나왔는가" 다. 값을 손으로 적어 두고 같은 값을 단언하면 아무것도 검증하지 못한다 —
 * 그래서 기대값을 `COMPONENT_RULES_TABLE` / `getCatalogEntry` 에서 **읽어서** 대조한다.
 */
import { describe, expect, it } from "vitest";
import {
  componentCatalog,
  getCatalogEntry,
  getComponentRulesTable,
} from "@composition/shared";
import {
  formatCatalogEntry,
  formatCatalogIndex,
  getAiCatalogEntry,
  getAiComponentCatalog,
  getCatalogByCategory,
} from "./componentCatalog";

describe("AI 카탈로그 커버리지", () => {
  it("catalog type 을 하나도 빠뜨리지 않는다 (65+ 요건)", () => {
    const ai = getAiComponentCatalog();
    const catalogTypes = new Set(componentCatalog.map((e) => e.type));
    expect(new Set(ai.map((e) => e.type))).toEqual(catalogTypes);
    expect(ai.length).toBeGreaterThanOrEqual(65);
    // type 당 1개 — 같은 type 이 두 번 나오면 모델이 어느 쪽을 믿을지 알 수 없다
    expect(new Set(ai.map((e) => e.type)).size).toBe(ai.length);
  });

  it("primitive/reusable 동명 type 은 palette 노출 쪽(reusable)을 정본으로 삼는다", () => {
    // Toolbar/Form/Card/InlineAlert — 실제 생성물은 origin ref 인스턴스다
    const collisions = componentCatalog
      .map((e) => e.type)
      .filter((t, i, all) => all.indexOf(t) !== i);
    expect(collisions.length).toBeGreaterThan(0);

    for (const type of collisions) {
      const entry = getAiCatalogEntry(type);
      expect(entry?.kind, type).toBe("reusable");
      expect(entry?.placeable, type).toBe(true);
      // primitive accepts 를 광고하지 않는다 (존재하지 않는 편집 prop)
      expect(entry?.props, type).toEqual([]);
    }
  });

  it("카테고리 인덱스가 팔레트 노출 항목을 전부 담는다", () => {
    const placeable = new Set(
      componentCatalog.filter((e) => e.panel.placeable).map((e) => e.type),
    );
    const indexed = [...getCatalogByCategory().values()].flat();
    expect(new Set(indexed)).toEqual(placeable);
  });
});

describe("SSOT 파생 대조", () => {
  const table = getComponentRulesTable() as Record<
    string,
    { variants?: object; sizes?: object }
  >;

  it("variant / size 허용 값이 COMPONENT_RULES_TABLE 과 일치한다 (전 컴포넌트)", () => {
    const mismatches: string[] = [];

    for (const entry of getAiComponentCatalog()) {
      const rule = table[entry.type];
      for (const prop of entry.props) {
        if (prop.kind !== "variant" && prop.kind !== "size") continue;
        const expected = Object.keys(
          (prop.kind === "variant" ? rule?.variants : rule?.sizes) ?? {},
        );
        if (expected.length === 0) continue; // rule 미등록 — override-only
        const actual = [...(prop.values ?? [])];
        if (actual.join(",") !== expected.join(",")) {
          mismatches.push(
            `${entry.type}.${prop.name}: ${actual.join("|")} ≠ ${expected.join("|")}`,
          );
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("enum 허용 값이 catalog accepts 의 options 와 일치한다 (전 컴포넌트)", () => {
    const mismatches: string[] = [];

    for (const entry of getAiComponentCatalog()) {
      const catalogEntry = getCatalogEntry(entry.type);
      if (catalogEntry?.kind !== "primitive") continue;
      const accepts = catalogEntry.binding.props.accepts;

      for (const prop of entry.props) {
        if (prop.origin !== "semantic") continue;
        const contract = accepts[prop.name];
        if (!contract?.options) continue;
        const expected = contract.options.map((o) => o.value);
        const actual = [...(prop.values ?? [])];
        if (actual.join(",") !== expected.join(",")) {
          mismatches.push(`${entry.type}.${prop.name}`);
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("semantic prop 집합이 catalog accepts 와 정확히 같다 (누락·창작 0)", () => {
    const mismatches: string[] = [];

    for (const entry of getAiComponentCatalog()) {
      // 조합 컴포넌트는 편집 계약이 origin 문서에 있다 — 위 fold 규칙 test 가 담당
      if (entry.kind === "reusable") continue;
      const catalogEntry = getCatalogEntry(entry.type);
      if (catalogEntry?.kind !== "primitive") continue;
      const expected = Object.keys(catalogEntry.binding.props.accepts).sort();
      const actual = entry.props
        .filter((p) => p.origin === "semantic")
        .map((p) => p.name)
        .sort();
      if (actual.join(",") !== expected.join(",")) {
        mismatches.push(`${entry.type}: ${actual.join("|")} ≠ ${expected.join("|")}`);
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("RAC primitive 이름이 binding source 에서 온다 (D1 권위)", () => {
    const button = getAiCatalogEntry("Button");
    const catalogButton = getCatalogEntry("Button");
    const source =
      catalogButton?.kind === "primitive" ? catalogButton.binding.source : null;
    expect(source?.kind).toBe("rac");
    expect(button?.racPrimitive).toBe(
      source?.kind === "rac" ? source.component : undefined,
    );
    // internal source (RAC 아님) 는 racPrimitive 를 만들어 내지 않는다
    const icon = getAiCatalogEntry("Icon");
    expect(icon?.racPrimitive).toBeUndefined();
  });
});

describe("프롬프트 직렬화", () => {
  it("Button 상세에 SSOT variant 값이 그대로 실린다", () => {
    const entry = getAiCatalogEntry("Button");
    expect(entry).toBeDefined();
    const text = formatCatalogEntry(entry!);
    const variants = Object.keys(
      (getComponentRulesTable() as Record<string, { variants?: object }>)
        .Button?.variants ?? {},
    );
    expect(variants.length).toBeGreaterThan(0);
    for (const value of variants) expect(text).toContain(value);
    expect(text).toContain("RAC Button");
  });

  it("style origin prop 은 컴포넌트 상세에 넣지 않는다 (중복 주입 방지)", () => {
    const entry = getAiCatalogEntry("Button")!;
    const text = formatCatalogEntry(entry);
    const styleProps = entry.props.filter((p) => p.origin === "style");
    expect(styleProps.length).toBeGreaterThan(0);
    for (const prop of styleProps) {
      expect(text).not.toContain(`- ${prop.name}:`);
    }
  });

  it("Tier 1 인덱스는 카테고리별 한 줄", () => {
    const index = formatCatalogIndex();
    const categories = [...getCatalogByCategory().keys()];
    expect(index.split("\n")).toHaveLength(categories.length);
    for (const category of categories) expect(index).toContain(`- ${category}:`);
  });
});
