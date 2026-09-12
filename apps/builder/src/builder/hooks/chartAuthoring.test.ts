// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { loadRecentFromStorage } from "./useRecentComponents";
import { loadFavoritesFromStorage } from "./useFavoriteComponents";
import { getPaletteItems } from "../panels/components/paletteItems";
import { createChartDefinition } from "../factories/definitions/DisplayComponents";
import type { ComponentCreationContext } from "../factories/types";

describe("Chart 생성/저장 호환", () => {
  beforeEach(() => localStorage.clear());
  it("기존 recent 중복의 횟수를 합치고 최신 위치를 보존한다", () => {
    localStorage.setItem(
      "composition_recent_components",
      JSON.stringify([
        { id: "Chart", type: "Chart", count: 3 },
        { id: "Button", type: "Button", count: 2 },
        { id: "chart-bar", type: "chart-bar", count: 4 },
      ]),
    );
    expect(loadRecentFromStorage()).toEqual([
      { id: "chart-bar", type: "chart-bar", count: 7 },
      { id: "Button", type: "Button", count: 2 },
    ]);
    localStorage.setItem(
      "composition_favorite_components",
      JSON.stringify(["Button", "Chart", "chart-bar", "chart-area"]),
    );
    expect(loadFavoritesFromStorage().map((item) => item.type)).toEqual([
      "Button",
      "chart-bar",
      "chart-area",
    ]);
  });
  it("7종 팔레트가 canonical Chart와 초기 props를 factory에 한 번에 준다", () => {
    const items = getPaletteItems().filter(
      (item) => item.category === "charts",
    );
    expect(items.map((item) => item.type)).toEqual([
      "chart-area",
      "chart-bar",
      "chart-line",
      "chart-pie",
      "chart-radar",
      "chart-radial",
      // ADR-217
      "chart-scatter",
    ]);
    for (const item of items) {
      expect(item.componentType).toBe("Chart");
      const context = {
        parentElement: null,
        elements: [],
        pageId: "page",
        doc: { version: "composition-1.0", children: [] },
        initialProps: item.initialProps,
      } as ComponentCreationContext;
      const definition = createChartDefinition(context);
      expect(definition.parent.type).toBe("Chart");
      expect(definition.parent.props.chartType).toBe(
        item.type.replace("chart-", ""),
      );
      expect(definition.parent.props.isAnimationActive).toBe(true);
      expect(definition.parent.props.data).not.toBe(item.initialProps?.data);
      expect(definition.children).toEqual([]);
    }
  });
});
