/**
 * ADR-303 G2 (정적 · 단위) — `{color.container}` 의 판정 함수 · 재분류 자리 · DOM 변수.
 * 두 consumer 대칭은 `apps/builder/tests/parity/adr303ContainerParity.browser.test.ts` 가 잰다.
 */
import { describe, expect, it } from "vitest";
import { tokenToCSSVar, type TokenRef } from "@composition/rendering";
import { COMPONENT_RULES_TABLE } from "../../generated/componentRulesTable";
import {
  CATALOG_CONTAINER_TOKEN,
  CATALOG_LAYER_ROLES,
  catalogContainerLayerAbove,
  catalogContainerLayerOf,
  catalogContainerReaders,
} from "../containerLayer";
import type { CatalogConsumerNode } from "../compositionRoot";

const node = (
  ruleId: string | undefined,
  props: Record<string, unknown> = {},
  extra: Partial<CatalogConsumerNode> = {},
) =>
  ({
    id: `n-${ruleId}`,
    parentId: "",
    ruleId,
    props,
    children: [],
    ...extra,
  }) as unknown as CatalogConsumerNode;

describe("ADR-303 — containerLayerOf (한 판정 함수)", () => {
  it("rule 컨테이너의 휴지 배경 층 (S2 값 — Phase 1 배정)", () => {
    expect(catalogContainerLayerOf(node("Popover"))).toBe("layer-2");
    expect(catalogContainerLayerOf(node("Modal"))).toBe("layer-2");
    expect(catalogContainerLayerOf(node("Card"))).toBe("elevated");
    expect(
      catalogContainerLayerOf(node("Card", { variant: "secondary" })),
    ).toBe("layer-1");
    expect(catalogContainerLayerOf(node("Table"))).toBe("base");
  });

  it("투명 · 비층 배경은 컨테이너가 아니다 (층만 물려준다)", () => {
    expect(
      catalogContainerLayerOf(node("Card", { variant: "quiet" })),
    ).toBeUndefined();
    expect(
      catalogContainerLayerOf(node("Table", { isQuiet: true })),
    ).toBeUndefined();
    expect(catalogContainerLayerOf(node("Tooltip"))).toBeUndefined();
    // (reader 자신 — 자기 배경이 `{color.container}`)
    expect(catalogContainerLayerOf(node("ListBox"))).toBeUndefined();
    expect(catalogContainerLayerOf(node(undefined))).toBeUndefined();
  });

  it("작성한 칠: 맨 위 층이 불투명 단색 hex 면 컨테이너 아님 · 칠이 rule 을 덮는다", () => {
    const hex = {
      id: "h",
      kind: "color",
      color: "#ff0000ff",
      enabled: true,
      opacity: 1,
      blendMode: "normal",
    } as const;
    expect(
      catalogContainerLayerOf(node("Popover", {}, { fills: [hex] as never })),
    ).toBeUndefined();
    // (꺼진 층은 보이지 않는다 — rule 로 돌아간다)
    expect(
      catalogContainerLayerOf(
        node("Popover", {}, { fills: [{ ...hex, enabled: false }] as never }),
      ),
    ).toBe("layer-2");
  });

  it("가장 가까운 컨테이너 조상 · 없으면 base", () => {
    const records = new Map<string, CatalogConsumerNode>([
      [
        "card",
        node(
          "Card",
          { variant: "secondary" },
          { id: "card", parentId: "body" },
        ),
      ],
      ["mid", node("Group", {}, { id: "mid", parentId: "card" })],
      ["body", node(undefined, {}, { id: "body", parentId: "" })],
    ]);
    const get = (id: string) => records.get(id);
    expect(catalogContainerLayerAbove({ parentId: "mid" }, get)).toBe(
      "layer-1",
    );
    expect(catalogContainerLayerAbove({ parentId: "body" }, get)).toBe("base");
  });
});

describe("ADR-303 — 재분류 자리 · DOM 변수", () => {
  it("결정 4 (a) 의 reader = 실제로 배경을 칠하는 자리만 (G2 하니스 실측)", () => {
    expect([...catalogContainerReaders()].sort()).toEqual(
      [
        "Breadcrumb",
        "Breadcrumbs",
        "DropZone",
        "ListBox",
        "Menu",
        "Nav",
      ].sort(),
    );
    // (칠하지 않는 base 자리는 남긴다 — Link 배경 none · Separator 는 선 색 · Group 투명, 실측)
    for (const type of ["Link", "Separator", "Group"])
      expect(
        JSON.stringify(
          COMPONENT_RULES_TABLE[type as keyof typeof COMPONENT_RULES_TABLE],
        ),
        type,
      ).not.toContain(CATALOG_CONTAINER_TOKEN);
  });

  it("`--container-bg` 값 = 층 토큰의 등록 변수 (손 이름 0 — `var(--layer-2)` 같은 미등록 변수 없음)", () => {
    for (const role of CATALOG_LAYER_ROLES) {
      const css = tokenToCSSVar(`{color.${role}}` as TokenRef);
      expect(css, role).toMatch(/^var\(--bg(-[a-z]+)?\)$/);
    }
    expect(tokenToCSSVar(CATALOG_CONTAINER_TOKEN as TokenRef)).toBe(
      "var(--container-bg, var(--bg))",
    );
  });
});
